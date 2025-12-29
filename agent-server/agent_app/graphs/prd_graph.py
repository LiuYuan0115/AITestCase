"""
PRD Agent LangGraph
"""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict, Optional


class AdditionalPrdItem(TypedDict):
    """辅助参考文档项（标题 + 内容）"""
    title: str
    content: str

from langgraph.graph import StateGraph, END

from agent_app.prompts import PRD_SYSTEM_PROMPT
from agent_app.tooling import prd_tools_schema, parse_first_tool_call, execute_prd_tool
from agent_app.config import is_anthropic_model


class PrdState(TypedDict, total=False):
    sessionId: str
    prdText: str
    instruction: str
    pictureKeyList: List[str]
    additionalPrds: List[AdditionalPrdItem]  # 辅助参考文档列表（可多选）
    messages: List[Dict[str, Any]]
    modelResponse: Any
    toolCall: Optional[Dict[str, Any]]
    result: Dict[str, Any]


def build_prd_graph(openai_client, model_name: str, session_store, max_prd_length: int = 8000, anthropic_client=None):
    """
    构建 PRD Graph：
    build_prompt -> call_llm -> (tool? handle_tool : finalize)
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
                chat_messages.append({"role": msg["role"], "content": msg["content"]})
        
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

    def build_prompt(state: PrdState) -> PrdState:
        prd_text = state.get("prdText", "") or ""
        instruction = state.get("instruction") or "请分析当前 PRD 文档"

        # 处理辅助参考文档（如果有）。注意控长度，避免 token 爆炸。
        additional_prds = state.get("additionalPrds") or []
        additional_text = ""
        if additional_prds:
            additional_text = "\n\n---\n\n## 辅助参考文档（以下内容仅供参考，用于理解上下文与关联逻辑）\n\n"
            per_doc_max = max(1000, max_prd_length // (len(additional_prds) + 1))
            for i, prd in enumerate(additional_prds, 1):
                title = (prd.get("title") or f"参考文档 {i}").strip()
                content = (prd.get("content") or "").strip()
                if len(content) > per_doc_max:
                    content = content[:per_doc_max] + "\n\n... (内容过长，已截断) ..."
                additional_text += f"### {title}\n\n{content}\n\n---\n\n"

        system_content = f"""{PRD_SYSTEM_PROMPT}

## 当前 PRD 文档内容
---
{prd_text[:max_prd_length]}
---
{additional_text}"""

        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_content}]
        messages.extend(session_store.get(state["sessionId"]))
        messages.append({"role": "user", "content": instruction})

        state["messages"] = messages
        return state

    def call_llm(state: PrdState) -> PrdState:
        if is_anthropic_model(model_name) and anthropic_client:
            # 使用 Anthropic SDK（不支持 tool_choice，直接获取文本响应）
            content = _call_anthropic_stream(state["messages"], model_name)
            
            class MockMessage:
                def __init__(self, c):
                    self.content = c
                    self.tool_calls = None
            
            state["modelResponse"] = MockMessage(content)
            state["toolCall"] = None
        else:
            # 使用 OpenAI SDK
            resp = openai_client.chat.completions.create(
                model=model_name,
                messages=state["messages"],
                tools=prd_tools_schema,
                tool_choice="auto",
            )
            msg = resp.choices[0].message
            state["modelResponse"] = msg
            state["toolCall"] = parse_first_tool_call(msg)
        return state

    def route(state: PrdState) -> str:
        return "handle_tool" if state.get("toolCall") else "finalize"

    def handle_tool(state: PrdState) -> PrdState:
        tool = state["toolCall"]
        result = execute_prd_tool(tool_name=tool["name"], arguments_json=tool["arguments"], current_prd=state.get("prdText", ""))
        state["result"] = result
        return state

    def finalize(state: PrdState) -> PrdState:
        msg = state.get("modelResponse")
        content = (getattr(msg, "content", None) or "").strip() if msg else ""
        if not content:
            content = "处理完成"
        state["result"] = {"type": "query", "response": content}
        return state

    graph = StateGraph(PrdState)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("call_llm", call_llm)
    graph.add_node("handle_tool", handle_tool)
    graph.add_node("finalize", finalize)

    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "call_llm")
    graph.add_conditional_edges("call_llm", route, {"handle_tool": "handle_tool", "finalize": "finalize"})
    graph.add_edge("handle_tool", END)
    graph.add_edge("finalize", END)
    return graph.compile()


