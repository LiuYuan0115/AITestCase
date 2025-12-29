"""
PM/DEV Chat-only LangGraph
"""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict

from langgraph.graph import StateGraph, END

from agent_app.prompts import PM_CHAT_SYSTEM_PROMPT, DEV_CHAT_SYSTEM_PROMPT
from agent_app.config import is_anthropic_model


class AdditionalPrdItem(TypedDict):
    """辅助参考文档项（标题 + 内容）"""
    title: str
    content: str


class ChatState(TypedDict, total=False):
    sessionId: str
    role: str  # pm | dev
    userMessage: str
    additionalPrds: List[AdditionalPrdItem]  # 辅助参考文档列表（可多选）
    messages: List[Dict[str, Any]]
    modelMessage: Any
    result: Dict[str, Any]


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

        # 注入辅助参考文档（如用户在输入框用 @ 引用的右侧文档）
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
        state["result"] = {"reply": content}
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


