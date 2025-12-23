"""
Ask 接口 LangGraph

功能：
- 支持多类型：testprd / testpoint / testcase
- 支持会话历史（可配置轮数）
- 超出上下文时自动总结压缩
- 模型参数可配置（model, temperature, max_tokens, thinkingConfig）
- 支持 OpenAI 和 Anthropic 双模型
"""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict, Optional
import re

from langgraph.graph import StateGraph, END

from agent_app.ask_config import get_ask_config, AskTypeConfig
from agent_app.config import is_anthropic_model


class AdditionalPrdItem(TypedDict):
    """辅助PRD项"""
    title: str
    content: str


class AskState(TypedDict, total=False):
    sessionId: str
    code: str
    type: str
    text: str  # 主PRD内容
    additionalPrds: List[AdditionalPrdItem]  # 辅助PRD列表
    effectiveText: str
    messages: List[Dict[str, Any]]
    modelMessage: Any
    answer: str
    config: AskTypeConfig


def build_ask_graph(openai_client, model_name: str, session_store=None, anthropic_client=None):
    """
    构建 Ask Graph

    参数：
    - openai_client: OpenAI SDK 客户端
    - model_name: 默认模型名（会被 ask_config 覆盖）
    - session_store: SessionStore 实例（用于会话历史）
    - anthropic_client: Anthropic SDK 客户端（可选，用于 Claude 模型）
    """

    def _truncate_text(text: str, max_chars: int) -> str:
        """截断输入文本"""
        if len(text) <= max_chars:
            return text
        # 保留前后各一半
        half = max_chars // 2
        return text[:half] + "\n\n... (内容过长，中间部分已省略) ...\n\n" + text[-half:]

    def _call_anthropic(messages: List[Dict], model: str, max_tokens: int, temperature: float) -> str:
        """调用 Anthropic API（使用流式响应避免超时）"""
        if not anthropic_client:
            raise ValueError("Anthropic client not configured")
        
        # 分离 system 和 user/assistant 消息
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content += msg["content"] + "\n"
            else:
                chat_messages.append({"role": msg["role"], "content": msg["content"]})
        
        # 使用流式响应避免 10 分钟超时限制
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

    def _summarize_history(history: List[Dict[str, Any]], model: str) -> str:
        """将历史对话压缩为摘要（超出上下文时使用）"""
        if not history:
            return ""

        # 构建对话文本
        conv_text = ""
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            conv_text += f"[{role}]: {content[:2000]}\n"

        summary_prompt = [
            {
                "role": "system",
                "content": (
                    "你是一个对话摘要助手。请将以下对话历史压缩为一段简洁的摘要（400字以内），"
                    "保留关键决策、约束、偏好和上下文信息。必须使用中文。"
                ),
            },
            {"role": "user", "content": conv_text[:8000]},
        ]

        try:
            if is_anthropic_model(model) and anthropic_client:
                return _call_anthropic(summary_prompt, model, 500, 0)
            else:
                resp = openai_client.chat.completions.create(
                    model=model,
                    messages=summary_prompt,
                    max_tokens=500,
                    temperature=0,
                )
                return resp.choices[0].message.content.strip()
        except Exception as e:
            # 摘要失败时返回空，避免阻塞主流程
            print(f"Warning: Failed to summarize history: {e}")
            return ""

    def _build_tagged_input(ask_type: str, main_text: str, additional_prds: List[AdditionalPrdItem], cfg: AskTypeConfig) -> str:
        """
        根据 ask_type 构建带标签的输入文本，匹配各个 prompt 要求的格式
        
        - testprd: [主PRD]...[/主PRD] + [辅助PRD]...[/辅助PRD] + [Figma交互补充]...[/Figma交互补充] + [补充说明]...[/补充说明]
        - testcase/testpoint: [优化后PRD]...[/优化后PRD] + [辅助PRD]...[/辅助PRD] + [Figma交互补充]...[/Figma交互补充] + [补充说明]...[/补充说明]
        - figma: 直接传文本（包含 Figma URL）
        """
        # 分类辅助文档（根据标题前缀识别类型）
        aux_prds: List[str] = []       # 辅助PRD
        figma_docs: List[str] = []     # Figma交互补充
        other_docs: List[str] = []     # 补充说明/其他
        
        max_per_doc = cfg.max_input_chars // (len(additional_prds) + 1) if additional_prds else cfg.max_input_chars
        
        for prd in (additional_prds or []):
            title = (prd.get("title") or "").strip()
            content = (prd.get("content") or "").strip()
            if len(content) > max_per_doc:
                content = content[:max_per_doc] + "\n\n... (内容过长，已截断) ..."
            
            # 根据标题前缀分类
            title_lower = title.lower()
            if "[figma" in title_lower or "figma交互" in title_lower or "figma设计" in title_lower:
                # 去掉标题前缀，保留实际标题
                clean_title = re.sub(r"^\[Figma[^\]]*\]\s*", "", title, flags=re.IGNORECASE).strip() or title
                figma_docs.append(f"### {clean_title}\n{content}")
            elif "[辅助prd]" in title_lower or "辅助prd" in title_lower:
                clean_title = re.sub(r"^\[辅助PRD\]\s*", "", title, flags=re.IGNORECASE).strip() or title
                aux_prds.append(f"### {clean_title}\n{content}")
            else:
                # 其他文档作为补充说明
                other_docs.append(f"### {title}\n{content}")
        
        # 根据 ask_type 构建带标签的文本
        parts: List[str] = []
        
        if ask_type == "figma":
            # figma 类型：直接返回原文本（包含 Figma URL 等信息）
            return main_text
        
        elif ask_type == "testprd":
            # testprd: [主PRD] 标签
            parts.append(f"[主PRD]\n{main_text}\n[/主PRD]")
            
            if aux_prds:
                parts.append(f"\n[辅助PRD]\n" + "\n\n".join(aux_prds) + "\n[/辅助PRD]")
            
            if figma_docs:
                parts.append(f"\n[Figma交互补充]\n" + "\n\n".join(figma_docs) + "\n[/Figma交互补充]")
            
            if other_docs:
                parts.append(f"\n[补充说明]\n" + "\n\n".join(other_docs) + "\n[/补充说明]")
        
        elif ask_type in ("testcase", "testpoint"):
            # testcase/testpoint: [优化后PRD] 标签
            parts.append(f"[优化后PRD]\n{main_text}\n[/优化后PRD]")
            
            if aux_prds:
                parts.append(f"\n[辅助PRD]\n" + "\n\n".join(aux_prds) + "\n[/辅助PRD]")
            
            if figma_docs:
                parts.append(f"\n[Figma交互补充]\n" + "\n\n".join(figma_docs) + "\n[/Figma交互补充]")
            
            if other_docs:
                parts.append(f"\n[补充说明]\n" + "\n\n".join(other_docs) + "\n[/补充说明]")
        
        else:
            # 其他类型：使用通用格式
            parts.append(main_text)
            if aux_prds or figma_docs or other_docs:
                parts.append("\n\n---\n\n## 参考文档\n")
                parts.extend(aux_prds)
                parts.extend(figma_docs)
                parts.extend(other_docs)
        
        return "\n".join(parts)

    def build_prompt(state: AskState) -> AskState:
        """构建消息列表（含历史上下文）"""
        ask_type = (state.get("type") or "testprd").strip().lower()
        cfg = get_ask_config(ask_type)
        state["config"] = cfg

        # ========== 日志输出：接收到的原始参数 ==========
        print("\n" + "="*80)
        print(f"🔵 [ASK Graph] 流程: {ask_type.upper()}")
        print("="*80)
        print(f"📥 接收到的原始参数:")
        print(f"   - type: {ask_type}")
        print(f"   - sessionId: {state.get('sessionId', 'N/A')}")
        text_raw = state.get("text", "") or ""
        print(f"   - text 长度: {len(text_raw)} 字符")
        additional_prds_raw = state.get("additionalPrds") or []
        print(f"   - additionalPrds 数量: {len(additional_prds_raw)}")
        if additional_prds_raw:
            for i, prd in enumerate(additional_prds_raw, 1):
                title = prd.get("title", f"文档{i}")
                content_len = len(prd.get("content", "") or "")
                print(f"      [{i}] {title} ({content_len} 字符)")
        print()

        # 获取系统 prompt
        try:
            system_prompt = cfg.get_prompt()
        except FileNotFoundError as e:
            system_prompt = str(e)

        # 处理主PRD输入文本（截断）
        text = text_raw
        if len(text) > cfg.max_input_chars:
            text = _truncate_text(text, cfg.max_input_chars)
            print(f"⚠️  主文本已截断: {len(text_raw)} → {len(text)} 字符")
        
        # 处理辅助PRD（如果有）
        additional_prds = additional_prds_raw
        
        # 使用带标签的格式构建输入文本（匹配各 prompt 要求）
        full_text = _build_tagged_input(ask_type, text, additional_prds, cfg)
        
        # ========== 日志输出：构建后的带标签格式 ==========
        print(f"📝 构建后的带标签格式 (总长度: {len(full_text)} 字符):")
        print("-"*80)
        # 显示前800字符预览
        preview_len = 800
        preview_text = full_text[:preview_len]
        if len(full_text) > preview_len:
            preview_text += f"\n\n... (还有 {len(full_text) - preview_len} 字符未显示) ..."
        print(preview_text)
        print("-"*80)
        print()
        
        # 保存本次实际用于推理的文本（用于后续校验/修复）
        state["effectiveText"] = full_text

        # 构建消息列表
        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        # testprd：增加硬性提醒，避免历史污染导致删减/丢图
        if ask_type == "testprd":
            extra_system_msg = (
                "硬性规则：仅以本次用户输入的 [主PRD] 标签内的 Markdown 为唯一事实来源。"
                "不得删减信息点、不得丢失任何图片链接；新增内容必须以【新增补充】标注。"
                "若历史对话与本次输入冲突，忽略历史对话。"
            )
            messages.append({
                "role": "system",
                "content": extra_system_msg,
            })

        # 加入会话历史（如果启用）
        history_count = 0
        if cfg.use_session_history and session_store:
            session_id = state.get("sessionId", "")
            history = session_store.get(session_id)

            if history:
                # 只保留最近 N 轮（1轮=用户+助手），避免历史污染与上下文膨胀
                if cfg.max_history_rounds and cfg.max_history_rounds > 0:
                    keep = cfg.max_history_rounds * 2
                    history = history[-keep:]
                # 检查是否需要总结压缩
                total_chars = sum(len(m.get("content", "")) for m in history)
                if cfg.summarize_on_overflow and total_chars > cfg.max_input_chars // 2:
                    # 超出阈值，做总结处理
                    summary = _summarize_history(history, openai_client, cfg.model)
                    if summary:
                        messages.append({
                            "role": "system",
                            "content": f"[历史对话摘要]\n{summary}",
                        })
                        history_count = 1  # 摘要算1条
                else:
                    # 未超出，直接加入历史
                    messages.extend(history)
                    history_count = len(history)

        # 加入当前用户输入（含主PRD + 辅助PRD）
        messages.append({"role": "user", "content": full_text})

        # ========== 日志输出：最终发送给 LLM 的消息列表 ==========
        print(f"📤 最终发送给 LLM 的消息列表:")
        print("-"*80)
        print(f"   消息总数: {len(messages)}")
        print(f"   - System messages: {len([m for m in messages if m['role'] == 'system'])}")
        if history_count > 0:
            print(f"   - History messages: {history_count}")
        print(f"   - User message: 1")
        print()
        for i, msg in enumerate(messages, 1):
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            content_len = len(content)
            content_preview = content[:200].replace("\n", "\\n")
            if len(content) > 200:
                content_preview += "..."
            print(f"   [{i}] role: {role:8s} | 长度: {content_len:6d} 字符")
            print(f"      预览: {content_preview}")
        print("="*80 + "\n")

        state["messages"] = messages
        return state

    def call_llm(state: AskState) -> AskState:
        """调用 LLM（支持 OpenAI 和 Anthropic）"""
        cfg = state.get("config") or get_ask_config(state.get("type", "testprd"))
        model = cfg.model

        # 判断使用哪个客户端
        if is_anthropic_model(model) and anthropic_client:
            # 使用 Anthropic SDK
            try:
                content = _call_anthropic(
                    state["messages"],
                    model,
                    cfg.max_tokens,
                    cfg.temperature
                )
                # 构造一个兼容的 message 对象
                class MockMessage:
                    def __init__(self, c):
                        self.content = c
                state["modelMessage"] = MockMessage(content)
            except Exception as e:
                raise e
        else:
            # 使用 OpenAI SDK
            request_params: Dict[str, Any] = {
                "model": model,
                "messages": state["messages"],
                "temperature": cfg.temperature,
                "max_tokens": cfg.max_tokens,
            }

            if cfg.thinking_budget > 0:
                request_params["extra_body"] = {
                    "thinkingConfig": {
                        "includeThoughts": cfg.include_thoughts,
                        "thinkingBudget": cfg.thinking_budget,
                    }
                }

            try:
                resp = openai_client.chat.completions.create(**request_params)
                state["modelMessage"] = resp.choices[0].message
            except Exception as e:
                if "extra_body" in request_params:
                    del request_params["extra_body"]
                    resp = openai_client.chat.completions.create(**request_params)
                    state["modelMessage"] = resp.choices[0].message
                else:
                    raise e

        return state

    def _strip_markdown_fence(text: str) -> str:
        """去掉 ```markdown ... ``` 包裹（模型有时会加）"""
        text = text.strip()
        # 去掉开头的 ```markdown 或 ```
        if text.startswith("```markdown"):
            text = text[len("```markdown"):].lstrip("\n")
        elif text.startswith("```"):
            text = text[3:].lstrip("\n")
        # 去掉结尾的 ```
        if text.endswith("```"):
            text = text[:-3].rstrip("\n")
        return text.strip()

    def finalize(state: AskState) -> AskState:
        """提取回答并更新会话历史"""
        def _extract_image_urls(md: str) -> List[str]:
            """
            从 Markdown/HTML 中提取图片链接：
            - Markdown: ![alt](url)
            - HTML: <img ... src="url" ...>
            """
            if not md:
                return []
            urls: List[str] = []
            # Markdown 图片
            for m in re.finditer(r"!\[[^\]]*\]\(([^)\s]+)\)", md):
                urls.append(m.group(1))
            # HTML img src
            for m in re.finditer(r"<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>", md, flags=re.IGNORECASE):
                urls.append(m.group(1))
            # 去重保持顺序
            seen = set()
            out: List[str] = []
            for u in urls:
                if u and u not in seen:
                    seen.add(u)
                    out.append(u)
            return out

        def _find_missing_image_urls(input_md: str, output_md: str) -> List[str]:
            input_urls = _extract_image_urls(input_md)
            if not input_urls:
                return []
            out = output_md or ""
            return [u for u in input_urls if u not in out]

        def _build_missing_context_snippets(input_md: str, missing_urls: List[str], window: int = 240) -> str:
            """
            为每个缺失 url 提供上下文片段，便于模型补回到正确位置附近
            """
            if not input_md or not missing_urls:
                return ""
            snippets: List[str] = []
            for url in missing_urls[:50]:
                idx = input_md.find(url)
                if idx < 0:
                    continue
                start = max(0, idx - window)
                end = min(len(input_md), idx + len(url) + window)
                snippet = input_md[start:end]
                snippets.append(f"- 缺失图片链接：{url}\n  上下文片段：\n  {snippet}\n")
            return "\n".join(snippets).strip()

        msg = state.get("modelMessage")
        content = (getattr(msg, "content", None) or "").strip() if msg else ""
        # 自动去掉 ```markdown 包裹（兜底处理）
        content = _strip_markdown_fence(content)

        # testprd：校验“丢图/明显缩水”，必要时触发一次修复重试
        ask_type = (state.get("type") or "testprd").strip().lower()
        if ask_type == "testprd":
            cfg = state.get("config") or get_ask_config("testprd")
            input_text = state.get("effectiveText") or state.get("text") or ""
            missing_urls = _find_missing_image_urls(input_text, content)
            ratio = (len(content) / max(1, len(input_text))) if input_text else 1.0
            too_short = bool(input_text) and ratio < 0.65

            if missing_urls or too_short:
                # 用缺失图片的上下文片段做“最小修复输入”，避免再次塞入全文导致上下文爆炸
                snippets = _build_missing_context_snippets(input_text, missing_urls)
                rules: List[str] = []
                if missing_urls:
                    rules.append(f"输出缺失 {len(missing_urls)} 个图片链接，必须全部补回。")
                if too_short:
                    rules.append(f"输出内容明显缩水（输出/输入≈{ratio:.2f}），不得删减信息点，请补全。")
                rule_text = "；".join(rules) or "需要修复输出。"

                repair_messages: List[Dict[str, Any]] = [
                    {"role": "system", "content": cfg.get_prompt()},
                    {
                        "role": "system",
                        "content": (
                            "你是 PRD 优化结果的修复器。必须严格遵守强约束：不得删减信息点、不得丢图、"
                            "新增内容必须以“新增补充：”标亮。输出必须为纯 Markdown，不要使用代码块。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"{rule_text}\n\n"
                            "请在【当前输出】基础上修复为【最终优化后的 PRD】。\n\n"
                            "[当前输出]\n"
                            f"{content}\n\n"
                            "[缺失项的原文上下文片段（必须补回到正确位置附近）]\n"
                            f"{snippets or '(无上下文片段，但仍需保证不删减信息点并保留全部图片链接)'}\n"
                        ),
                    },
                ]

                request_params: Dict[str, Any] = {
                    "model": cfg.model,
                    "messages": repair_messages,
                    "temperature": 0,
                    "max_tokens": cfg.max_tokens,
                }
                try:
                    resp2 = openai_client.chat.completions.create(**request_params)
                    repaired = (resp2.choices[0].message.content or "").strip()
                    repaired = _strip_markdown_fence(repaired)
                    if repaired:
                        content = repaired
                except Exception as e:
                    # 修复失败不阻塞主流程
                    print(f"Warning: testprd repair failed: {e}")

        state["answer"] = content or "处理完成"

        # 更新会话历史（如果启用）
        cfg = state.get("config") or get_ask_config(state.get("type", "testprd"))
        if cfg.use_session_history and session_store:
            session_id = state.get("sessionId", "")
            text = state.get("text", "")
            if session_id and text:
                session_store.append(session_id, "user", text[:5000])
                session_store.append(session_id, "assistant", state["answer"][:5000])

        return state

    # 构建图
    graph = StateGraph(AskState)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("call_llm", call_llm)
    graph.add_node("finalize", finalize)
    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "call_llm")
    graph.add_edge("call_llm", "finalize")
    graph.add_edge("finalize", END)
    return graph.compile()
