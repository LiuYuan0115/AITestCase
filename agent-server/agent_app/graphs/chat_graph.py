"""
PM/DEV Chat-only LangGraph

支持：
- additionalPrds：直接传入的辅助参考文档（旧协议）
- docRefs：文档引用列表，从 DocStore 检索上下文（新协议，为知识库做准备）
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, END

from agent_app.prompts import PM_CHAT_SYSTEM_PROMPT, DEV_CHAT_SYSTEM_PROMPT
from agent_app.config import is_anthropic_model


class AdditionalPrdItem(TypedDict):
    """辅助参考文档项（标题 + 内容）"""
    title: str
    content: str


class DocRefItem(TypedDict, total=False):
    """文档引用项"""
    docId: str
    logicalId: Optional[str]
    title: Optional[str]
    kind: Optional[str]  # main | aux


class ChatState(TypedDict, total=False):
    sessionId: str
    role: str  # pm | dev
    userMessage: str
    additionalPrds: List[AdditionalPrdItem]  # 辅助参考文档列表（可多选）
    docRefs: List[DocRefItem]  # ✅ 新增：文档引用列表（从 DocStore 检索）
    messages: List[Dict[str, Any]]
    modelMessage: Any
    result: Dict[str, Any]
    usedDocRefs: List[Dict[str, Any]]  # ✅ 新增：实际使用的文档引用


def build_chat_graph(openai_client, model_name: str, session_store, anthropic_client=None):
    """
    build_prompt -> call_llm -> finalize
    """

    def _call_anthropic_stream(messages: List[Dict], model: str, max_tokens: int = 8000) -> str:
        """调用 Anthropic API（流式）"""
        if not anthropic_client:
            raise ValueError("Anthropic client not configured")
        
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content += msg["content"] + "\n"
            else:
                chat_messages.append({"role": msg["role"], "content": msg.get("content") or ""})
        
        full_response = ""
        with anthropic_client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system_content.strip() if system_content else None,
            messages=chat_messages,
        ) as stream:
            for text in stream.text_stream:
                full_response += text
        
        return full_response

    def build_prompt(state: ChatState) -> ChatState:
        role = (state.get("role") or "").strip().lower()
        system_prompt = PM_CHAT_SYSTEM_PROMPT if role == "pm" else DEV_CHAT_SYSTEM_PROMPT

        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        used_doc_refs: List[Dict[str, Any]] = []

        # ✅ 优先使用 docRefs（新协议：从 DocStore 检索上下文）
        doc_refs = state.get("docRefs") or []
        if doc_refs:
            doc_ids = [r.get("docId") for r in doc_refs if r.get("docId")]
            user_message = state.get("userMessage") or ""
            
            # 使用 retrieve 做轻量检索（关键词匹配）
            chunks = session_store.retrieve(doc_ids, query=user_message, top_k=10)
            
            if chunks:
                ref_text = "## 参考文档（以下内容来自用户引用的文档，仅供参考）\n\n"
                seen_docs = set()
                
                for doc_id, chunk, score in chunks:
                    # 获取文档元数据
                    doc = session_store.get_doc(doc_id) or {}
                    title = doc.get("title") or doc_id[:16]
                    logical_id = doc.get("logicalId")
                    
                    # 记录使用的文档
                    if doc_id not in seen_docs:
                        seen_docs.add(doc_id)
                        used_doc_refs.append({
                            "docId": doc_id,
                            "logicalId": logical_id,
                            "title": title,
                            "kind": doc.get("kind"),
                        })
                    
                    # 截取片段（避免上下文过长）
                    chunk_text = chunk[:1500] if len(chunk) > 1500 else chunk
                    ref_text += f"### {title}\n\n{chunk_text}\n\n---\n\n"
                
                messages.append({"role": "system", "content": ref_text})
        
        # 兼容旧协议：additionalPrds（直接传入内容）
        additional_prds = state.get("additionalPrds") or []
        if additional_prds:
            ref_text = "## 辅助参考文档（以下内容仅供参考）\n\n"
            per_doc_max = max(1200, 8000 // (len(additional_prds) + 1))
            for i, prd in enumerate(additional_prds, 1):
                title = (prd.get("title") or f"参考文档 {i}").strip()
                content = (prd.get("content") or "").strip()
                if len(content) > per_doc_max:
                    content = content[:per_doc_max] + "\n\n... (内容过长，已截断) ..."
                ref_text += f"### {title}\n\n{content}\n\n---\n\n"
            messages.append({"role": "system", "content": ref_text})

        messages.extend(session_store.get(state["sessionId"]))
        messages.append({"role": "user", "content": state.get("userMessage", "")})
        state["messages"] = messages
        state["usedDocRefs"] = used_doc_refs
        return state

    def call_llm(state: ChatState) -> ChatState:
        if is_anthropic_model(model_name) and anthropic_client:
            # Anthropic SDK
            content = _call_anthropic_stream(state["messages"], model_name)
            
            class MockMessage:
                def __init__(self, c):
                    self.content = c
            
            state["modelMessage"] = MockMessage(content)
        else:
            # OpenAI SDK
            resp = openai_client.chat.completions.create(
                model=model_name,
                messages=state["messages"],
            )
            state["modelMessage"] = resp.choices[0].message
        return state

    def finalize(state: ChatState) -> ChatState:
        msg = state.get("modelMessage")
        content = (getattr(msg, "content", None) or "").strip() if msg else ""
        if not content:
            content = "处理完成"
        state["result"] = {
            "reply": content,
            "usedDocRefs": state.get("usedDocRefs") or [],
        }
        return state

    graph = StateGraph(ChatState)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("call_llm", call_llm)
    graph.add_node("finalize", finalize)
    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "call_llm")
    graph.add_edge("call_llm", "finalize")
    graph.add_edge("finalize", END)
    return graph.compile()


