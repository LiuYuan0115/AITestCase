"""
Midscene Smart Router — LLM-as-Router for intelligent command routing.

Routes user natural language input to the appropriate action:
  - generate_cases: Screenshot page → VLM → structured test cases → Step 4
  - execute_cases: Run existing test cases via Midscene → Step 5
  - analyze: Screenshot → VLM analysis → reply
  - free_action: CDP → aiAct() direct execution
  - passthrough: Not a Midscene command, let the original agent handle it

Key design:
  - URL-based operations always use headless (no browser popup)
  - Current page operations use frontend screenshot (no browser needed)
  - CDP is only used for execution (user watches the automation)
"""

from __future__ import annotations

import json
import traceback
import re
from typing import Any, Dict, List, Optional, TypedDict

from agent_app.config import is_anthropic_model


class SmartRouterState(TypedDict, total=False):
    # Input
    sessionId: str
    instruction: str
    url: str
    screenshot: Optional[str]   # base64 from frontend
    outputFormat: str            # xmind / table / yaml

    # Router output
    intent: str
    extractedUrl: Optional[str]  # URL extracted from instruction
    needsCurrentPage: bool

    # Generated data
    cases: Optional[List[Dict[str, Any]]]
    formattedCases: Optional[str]

    # Final output
    finalType: str
    finalResponse: str
    finalStep: Optional[str]


ROUTER_PROMPT = """你是 QA 自动化智能助手。分析用户的输入，判断他们想做什么。

可能的意图：
1. generate_cases - 用户想生成测试用例（关键词：生成用例、设计测试、基于页面、基于URL、写测试用例）
2. execute_cases - 用户想执行已有的测试（关键词：执行、运行、跑测试、开始测试）
3. analyze - 用户想分析页面或功能（关键词：分析、有什么功能、检查、看看）
4. free_action - 用户想直接操作页面元素（关键词：点击、输入、滚动、打开、选择）
5. passthrough - 以上都不匹配，是普通对话/问答/与测试无直接关系的请求

输出严格 JSON（不要 markdown 包裹）：
{
  "intent": "generate_cases" | "execute_cases" | "analyze" | "free_action" | "passthrough",
  "url": "用户提到的URL（如有，否则null）",
  "needsCurrentPage": true或false
}

用户输入：
"""

GENERATE_CASES_PROMPT = """你是资深 QA 自动化测试工程师。请根据以下页面信息生成结构化的测试用例。

页面 URL: {url}
{screenshot_desc}

请生成 JSON 数组，每个测试用例包含：
{{
  "id": "TC-001",
  "name": "测试用例名称",
  "scenario": "具体操作步骤（自然语言，描述用户如何操作页面）",
  "expectedResults": ["预期结果1", "预期结果2"],
  "preconditions": "前置条件",
  "priority": "P0/P1/P2",
  "testData": {{}}
}}

要求：
1. 覆盖主要功能路径（正向、异常、边界）
2. scenario 用视觉描述，不用选择器
3. expectedResults 每条都是独立的可视化断言
4. 按优先级排序（P0 > P1 > P2）
5. 生成 8-15 条用例

直接输出 JSON 数组：
"""


def build_midscene_smart_graph(openai_client, model_name: str, session_store=None, anthropic_client=None):
    """Build the smart routing LangGraph."""

    def _keyword_fallback_intent(instruction: str) -> str:
        """Keyword-based intent fallback when LLM JSON parsing fails."""
        s = instruction.lower()
        gen_keywords = ['生成用例', '生成测试', '设计用例', '设计测试', '写用例', '写测试', '创建用例', '测试用例']
        exec_keywords = ['执行', '运行', '跑测试', '开始测试', '执行用例']
        analyze_keywords = ['分析', '检查', '有什么功能', '什么功能', '看看']
        action_keywords = ['点击', '输入', '滚动', '选择', '打开', '关闭', '提交']

        for kw in gen_keywords:
            if kw in s:
                return 'generate_cases'
        for kw in exec_keywords:
            if kw in s:
                return 'execute_cases'
        for kw in action_keywords:
            if kw in s:
                return 'free_action'
        for kw in analyze_keywords:
            if kw in s:
                return 'analyze'
        return 'passthrough'

    def _call_llm(system: str, user: str, max_tokens: int = 4000) -> str:
        """Call LLM. Supports OpenAI/Anthropic dual-stack."""
        if is_anthropic_model(model_name) and anthropic_client:
            resp = anthropic_client.messages.create(
                model=model_name,
                max_tokens=max_tokens,
                temperature=0,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            content = getattr(resp, "content", None)
            if isinstance(content, list):
                return "".join([
                    getattr(b, "text", "") if getattr(b, "type", None) == "text"
                    else (b.get("text", "") if isinstance(b, dict) and b.get("type") == "text" else "")
                    for b in content
                ])
            return getattr(resp, "text", "") or ""

        resp = openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0,
        )
        return (resp.choices[0].message.content or "").strip()

    def _call_llm_json(system: str, user: str, max_tokens: int = 4000) -> dict:
        """Call LLM and parse JSON response."""
        text = _call_llm(system, user, max_tokens)
        text = text.strip()
        # Strip markdown fences
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
            text = text.strip()
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Extract JSON object by matching braces
        start = text.find('{')
        if start >= 0:
            depth = 0
            in_str = False
            escape = False
            for i in range(start, len(text)):
                ch = text[i]
                if in_str:
                    if escape:
                        escape = False
                    elif ch == '\\':
                        escape = True
                    elif ch == '"':
                        in_str = False
                else:
                    if ch == '"':
                        in_str = True
                    elif ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            return json.loads(text[start:i + 1])
        # Last resort: regex extract fields
        print(f"[smart_router] JSON parse failed, raw text: {text[:200]}")
        raise json.JSONDecodeError("No valid JSON found", text, 0)

    def _call_vlm_with_image(system: str, user: str, image_base64: str, max_tokens: int = 4000) -> str:
        """Call VLM with image (multimodal). Supports OpenAI-compatible API."""
        # Strip data URL prefix if present
        if image_base64.startswith("data:"):
            image_base64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": [
                {"type": "text", "text": user},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
            ]},
        ]

        if is_anthropic_model(model_name) and anthropic_client:
            resp = anthropic_client.messages.create(
                model=model_name,
                max_tokens=max_tokens,
                temperature=0,
                system=system,
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": user},
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_base64}},
                ]}],
            )
            content = getattr(resp, "content", None)
            if isinstance(content, list):
                return "".join([getattr(b, "text", "") for b in content if getattr(b, "type", None) == "text"])
            return getattr(resp, "text", "") or ""

        resp = openai_client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0,
        )
        return (resp.choices[0].message.content or "").strip()

    # ==================== Graph Nodes ====================

    def route_intent(state: SmartRouterState) -> SmartRouterState:
        """LLM determines user intent from natural language."""
        instruction = state.get("instruction", "")

        try:
            result = _call_llm_json(
                system="Output JSON only. No markdown fences. Be concise.",
                user=f"{ROUTER_PROMPT}{instruction}",
                max_tokens=500,
            )
            state["intent"] = result.get("intent", "passthrough")
            state["extractedUrl"] = result.get("url")
            state["needsCurrentPage"] = result.get("needsCurrentPage", False)
            print(f"[smart_router] Intent: {state['intent']} | URL: {state.get('extractedUrl')} | needsPage: {state['needsCurrentPage']}")
        except Exception as e:
            traceback.print_exc()
            # Fallback: keyword-based intent detection
            state["intent"] = _keyword_fallback_intent(instruction)
            print(f"[smart_router] LLM JSON failed ({e}), keyword fallback: {state['intent']}")

            # Extract URL from instruction
            url_match = re.search(r'https?://[^\s,，。]+', instruction)
            if url_match:
                state["extractedUrl"] = url_match.group(0)

        return state

    def handle_generate_cases(state: SmartRouterState) -> SmartRouterState:
        """Generate test cases from page screenshot or URL."""
        url = state.get("extractedUrl") or state.get("url", "")
        screenshot = state.get("screenshot")

        # If URL was provided in instruction but no screenshot, take a headless screenshot
        if state.get("extractedUrl") and not screenshot:
            print(f"[smart_router] Taking headless screenshot of: {url}")
            from agent_app.ui.midscene_runner import run_screenshot
            screenshot = run_screenshot(url)

        if not screenshot and not url:
            state["finalType"] = "error"
            state["finalResponse"] = "需要提供页面 URL 或当前页面截图才能生成测试用例"
            return state

        try:
            screenshot_desc = "（已附带页面截图，请基于截图中的 UI 元素生成测试用例）" if screenshot else ""
            prompt = GENERATE_CASES_PROMPT.format(url=url, screenshot_desc=screenshot_desc)

            if screenshot:
                raw = _call_vlm_with_image("Output JSON array only.", prompt, screenshot, max_tokens=4000)
            else:
                raw = _call_llm("Output JSON array only.", prompt, max_tokens=4000)

            # Parse JSON
            raw = raw.strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```\w*\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)
            start = raw.find("[")
            if start >= 0:
                raw = raw[start:]
            cases = json.loads(raw)

            if not isinstance(cases, list):
                cases = [cases]

            state["cases"] = cases

            # Format cases based on outputFormat
            output_format = state.get("outputFormat", "yaml")
            state["formattedCases"] = _format_cases(cases, output_format)

            state["finalType"] = "cases_generated"
            state["finalResponse"] = f"已基于页面生成 {len(cases)} 条测试用例"
            state["finalStep"] = "test_case"
            print(f"[smart_router] Generated {len(cases)} test cases")

        except Exception as e:
            traceback.print_exc()
            state["finalType"] = "error"
            state["finalResponse"] = f"测试用例生成失败: {e}"

        return state

    def handle_analyze(state: SmartRouterState) -> SmartRouterState:
        """Analyze current page via screenshot."""
        screenshot = state.get("screenshot")
        url = state.get("url", "")
        instruction = state.get("instruction", "")

        if not screenshot:
            state["finalType"] = "analysis"
            state["finalResponse"] = "请确保浏览器中有打开的页面，以便截图分析"
            return state

        try:
            prompt = f"用户请求：{instruction}\n\n请分析这个页面（URL: {url}），回答用户的问题。"
            response = _call_vlm_with_image(
                "你是 QA 测试专家。根据页面截图回答用户问题。",
                prompt,
                screenshot,
                max_tokens=2000,
            )
            state["finalType"] = "analysis"
            state["finalResponse"] = response
        except Exception as e:
            state["finalType"] = "error"
            state["finalResponse"] = f"页面分析失败: {e}"

        return state

    def handle_passthrough(state: SmartRouterState) -> SmartRouterState:
        """Not a Midscene command — signal frontend to use original agent."""
        state["finalType"] = "passthrough"
        state["finalResponse"] = ""
        return state

    def handle_execute(state: SmartRouterState) -> SmartRouterState:
        """Signal frontend to switch to Step 5 and start execution."""
        state["finalType"] = "execute"
        state["finalResponse"] = "切换到自动化测试步骤执行"
        state["finalStep"] = "auto_test"
        return state

    def handle_free_action(state: SmartRouterState) -> SmartRouterState:
        """Signal frontend to execute a free action via aiAct."""
        state["finalType"] = "free_action"
        state["finalResponse"] = state.get("instruction", "")
        state["finalStep"] = "auto_test"
        return state

    # ==================== Build Graph ====================
    from langgraph.graph import StateGraph, END

    g = StateGraph(SmartRouterState)

    g.add_node("route_intent", route_intent)
    g.add_node("generate_cases", handle_generate_cases)
    g.add_node("analyze", handle_analyze)
    g.add_node("passthrough", handle_passthrough)
    g.add_node("execute_cases", handle_execute)
    g.add_node("free_action", handle_free_action)

    g.set_entry_point("route_intent")

    g.add_conditional_edges(
        "route_intent",
        lambda s: s.get("intent", "passthrough"),
        {
            "generate_cases": "generate_cases",
            "execute_cases": "execute_cases",
            "analyze": "analyze",
            "free_action": "free_action",
            "passthrough": "passthrough",
        },
    )

    for node in ["generate_cases", "analyze", "passthrough", "execute_cases", "free_action"]:
        g.add_edge(node, END)

    return g.compile()


def _format_cases(cases: List[Dict], output_format: str) -> str:
    """Format test cases list into user's preferred format."""
    if output_format == "table":
        return _format_table(cases)
    elif output_format == "yaml":
        return _format_yaml(cases)
    else:  # xmind / default
        return _format_xmind(cases)


def _format_xmind(cases: List[Dict]) -> str:
    """Format as H1-H6 hierarchy Markdown (XMind compatible)."""
    lines = ["# 测试用例\n"]
    lines.append("## 功能测试\n")
    for tc in cases:
        lines.append(f"##### {tc.get('name', '')}")
        lines.append(f"###### 预期结果")
        for er in tc.get("expectedResults", []):
            lines.append(f"- {er}")
        lines.append("")
    return "\n".join(lines)


def _format_table(cases: List[Dict]) -> str:
    """Format as Markdown table."""
    lines = [
        "| ID | 场景 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |",
        "|------|------|------|------|------|------|",
    ]
    for tc in cases:
        eid = tc.get("id", "")
        name = tc.get("name", "")
        pre = tc.get("preconditions", "")
        scenario = tc.get("scenario", "")
        expected = "; ".join(tc.get("expectedResults", []))
        priority = tc.get("priority", "")
        lines.append(f"| {eid} | {name} | {pre} | {scenario} | {expected} | {priority} |")
    return "\n".join(lines)


def _format_yaml(cases: List[Dict]) -> str:
    """Format as YAML structure."""
    import yaml
    data = {
        "metadata": {"title": "测试用例", "version": "1.0"},
        "modules": [{
            "name": "功能测试",
            "test_points": [{
                "name": "功能验证",
                "checkpoints": [{
                    "name": "测试场景",
                    "scenarios": [
                        {
                            "id": tc.get("id", f"TC-{i+1:03d}"),
                            "title": tc.get("name", ""),
                            "priority": tc.get("priority", "P1"),
                            "preconditions": [tc["preconditions"]] if tc.get("preconditions") else [],
                            "steps": [{"step": j+1, "action": s} for j, s in enumerate(tc.get("scenario", "").split("，"))],
                            "expected": tc.get("expectedResults", []),
                        }
                        for i, tc in enumerate(cases)
                    ],
                }],
            }],
        }],
    }
    return f"```yaml\n{yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)}```"
