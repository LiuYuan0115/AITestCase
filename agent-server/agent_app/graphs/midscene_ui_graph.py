"""
Midscene UI Automation LangGraph

A standalone graph for Midscene-powered UI automation.
Completely independent from ui_graph.py.

Flow:
  init_state → parse_testcase → midscene_execute → finalize → END

Key design:
  - parse_testcase: LLM extracts scenario + expectedResults from user instruction
  - midscene_execute: Sidecar calls aiAct() (autonomous VLM planning), aiAssert(), aiQuery()
  - Reports: Midscene native HTML with visual replay
"""

from __future__ import annotations

import json
import traceback
import urllib.parse
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, END

from agent_app.config import is_anthropic_model


# ==================== State ====================

class MidsceneState(TypedDict, total=False):
    # Input
    sessionId: str
    instruction: str
    url: str
    headless: bool
    useCDP: bool
    cdpEndpoint: str
    additionalPrds: List[Dict[str, str]]

    # Direct testcases from frontend (skip LLM parsing)
    testCases: List[Dict[str, Any]]

    # Parsed testcase structure
    testcase: Dict[str, Any]

    # Midscene options
    cacheId: str
    cacheStrategy: str
    deepThink: bool
    aiContext: str

    # Output
    midsceneResult: Dict[str, Any]
    finalType: str
    finalResponse: str
    finalReport: Any
    reportLogContent: Any


# ==================== Helpers ====================

def _extract_first_json(text: str) -> str:
    """Extract first JSON object or array from text."""
    if not text:
        return text
    # Try to find JSON object
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        if start == -1:
            continue
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
                elif ch == start_char:
                    depth += 1
                elif ch == end_char:
                    depth -= 1
                    if depth == 0:
                        return text[start:i + 1]
    return text.strip()


# ==================== Graph Builder ====================

def build_midscene_ui_graph(openai_client, model_name: str, session_store=None, anthropic_client=None):
    """
    Build the Midscene UI automation LangGraph.

    Same signature as build_ui_graph() for consistency.
    """

    def _call_llm_json(system: str, user: str, max_tokens: int = 2000) -> str:
        """Call LLM to generate JSON. OpenAI/Anthropic dual-stack compatible."""
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
                text = "".join([
                    getattr(b, "text", "")
                    if getattr(b, "type", None) == "text"
                    else (b.get("text", "") if isinstance(b, dict) and b.get("type") == "text" else "")
                    for b in content
                ])
            else:
                text = getattr(resp, "text", "") or ""
            return _extract_first_json(text)

        # OpenAI compatible
        resp = openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0,
        )
        text = (resp.choices[0].message.content or "").strip()
        return _extract_first_json(text)

    # ==================== Graph Nodes ====================

    def init_state(state: MidsceneState) -> MidsceneState:
        """Initialize default state values."""
        state.setdefault("headless", True)
        state.setdefault("deepThink", False)
        state.setdefault("cacheStrategy", "read-write")
        state.setdefault("aiContext", "如果出现 Cookie 同意弹窗、广告弹窗或通知弹窗，先关闭它")
        state.setdefault("finalType", "")
        state.setdefault("finalResponse", "")
        return state

    def parse_testcase(state: MidsceneState) -> MidsceneState:
        """
        Parse user instruction into a structured testcase for Midscene.

        If testCases are already provided (from frontend Step 4 parsing),
        use the first one directly — skip LLM parsing entirely.

        Maps directly to Midscene APIs:
          - scenario → aiAct() (autonomous VLM-driven execution)
          - expectedResults → aiAssert() (visual assertions)
          - extractSchema → aiQuery() (structured data extraction)
          - preconditions → setAIActContext()
        """
        # ★ Direct testCases from frontend — skip LLM parsing
        direct_cases = state.get("testCases") or []
        if direct_cases:
            tc = direct_cases[0]
            state["testcase"] = tc

            # ★ cacheId 加入 URL 域名，隔离不同站点的缓存
            url = state.get("url", "")
            domain = ""
            try:
                domain = urllib.parse.urlparse(url).hostname or ""
                domain = domain.replace("www.", "")[:20]
            except Exception:
                pass
            tc_name = tc.get('id', tc.get('name', 'unnamed'))[:30]
            state["cacheId"] = f"tc-{domain}-{tc_name}" if domain else f"tc-{tc_name}"

            # Merge preconditions into aiContext
            preconditions = tc.get("preconditions", "")
            if preconditions:
                existing_ctx = state.get("aiContext", "")
                state["aiContext"] = f"{existing_ctx}. 背景信息: {preconditions}"

            state["finalType"] = "plan_generated"
            state["finalResponse"] = f"使用已有测试用例: {tc.get('name', '')}"
            print(f"[midscene_graph] Using direct testcase: {tc.get('name', '')} ({tc.get('id', '')})")
            return state

        instruction = state.get("instruction", "")
        url = state.get("url", "")
        refs = state.get("additionalPrds") or []
        ref_text = ""
        if refs:
            ref_text = "\n".join([
                f"- {r.get('title', '')}: {(r.get('content', ''))[:800]}"
                for r in refs[:3]
            ])

        prompt = f"""你是资深 QA 自动化工程师。请将用户的测试场景解析为结构化测试用例。

输出 JSON，格式如下：
{{
  "name": "测试用例名称",
  "preconditions": "前置条件描述（会设为 Midscene 的全局上下文）",
  "scenario": "具体操作场景的自然语言描述（不要用选择器，用视觉描述，这段文字会直接交给 AI 视觉模型执行）",
  "expectedResults": ["预期结果1", "预期结果2"],
  "testData": {{"field1": "value1"}},
  "extractSchema": null
}}

关键规则：
1. scenario 描述要具体、可执行，像在指导一个能看到屏幕的人操作
2. 在 scenario 中嵌入 testData 的具体值（如"在邮箱输入框中输入 test@example.com"）
3. expectedResults 每条都是一个独立的视觉断言，描述你期望在屏幕上看到什么
4. 不使用任何 CSS 选择器、XPath 或 data-testid
5. 描述元素时用视觉特征：位置、标签文字、占位符文字、按钮文字等
6. 如果用户的指令本身就很具体，直接使用，不要过度改写
7. extractSchema 仅在需要从页面提取结构化数据时填写，格式如 '{{username: string, role: string}}'

目标页面: {url}
{f"参考文档:{chr(10)}{ref_text}" if ref_text else ""}

用户测试场景：
{instruction}
"""
        try:
            result = _call_llm_json(
                system="Output JSON only. No markdown fences.",
                user=prompt,
                max_tokens=2000,
            )
            testcase = json.loads(result)

            # Validate minimal required fields
            if not testcase.get("scenario"):
                # Fallback: use raw instruction as scenario
                testcase["scenario"] = instruction
                testcase["name"] = instruction[:50]
                testcase["expectedResults"] = []

            state["testcase"] = testcase
            # ★ cacheId 加入 URL 域名，隔离不同站点的缓存
            llm_url = state.get("url", "")
            llm_domain = ""
            try:
                llm_domain = urllib.parse.urlparse(llm_url).hostname or ""
                llm_domain = llm_domain.replace("www.", "")[:20]
            except Exception:
                pass
            llm_tc_name = testcase.get('name', 'unnamed')[:30]
            state["cacheId"] = f"tc-{llm_domain}-{llm_tc_name}" if llm_domain else f"tc-{llm_tc_name}"

            # Merge preconditions into aiContext
            preconditions = testcase.get("preconditions", "")
            if preconditions:
                existing_ctx = state.get("aiContext", "")
                state["aiContext"] = f"{existing_ctx}. 背景信息: {preconditions}"

            state["finalType"] = "plan_generated"
            state["finalResponse"] = f"测试用例已解析: {testcase.get('name', '')}"

            # Log for debugging
            print(f"[midscene_graph] Parsed testcase: {testcase.get('name', '')}")
            print(f"[midscene_graph] Scenario: {testcase.get('scenario', '')[:100]}...")
            print(f"[midscene_graph] Expected results: {len(testcase.get('expectedResults', []))}")

            return state

        except Exception as e:
            traceback.print_exc()
            # Fallback: use raw instruction directly
            print(f"[midscene_graph] parse_testcase failed, using raw instruction: {e}")
            state["testcase"] = {
                "name": instruction[:50],
                "scenario": instruction,
                "expectedResults": [],
                "preconditions": "",
                "testData": {},
            }
            state["finalType"] = "plan_generated"
            state["finalResponse"] = f"直接使用原始指令（解析失败: {e}）"
            return state

    def midscene_execute(state: MidsceneState) -> MidsceneState:
        """Call Midscene Sidecar to execute the testcase."""
        from agent_app.ui.midscene_runner import run_testcase, check_health

        if not check_health():
            state["finalType"] = "error"
            state["finalResponse"] = (
                "Midscene Sidecar 未启动。请先运行:\n"
                "cd agent-server/midscene-sidecar && npm install && npm start"
            )
            return state

        testcase = state.get("testcase", {})
        url = state.get("url", "")

        if not url:
            state["finalType"] = "error"
            state["finalResponse"] = "Error: URL is required for Midscene execution."
            return state

        print(f"[midscene_graph] Executing via Sidecar: {testcase.get('name', '')}")
        print(f"[midscene_graph] URL: {url}")
        print(f"[midscene_graph] Headless: {state.get('headless', True)}")

        try:
            result = run_testcase(
                url=url,
                testcase=testcase,
                options={
                    "headless": state.get("headless", True),
                    "useCDP": state.get("useCDP", False),
                    "cdpEndpoint": state.get("cdpEndpoint", "http://localhost:9222"),
                    "cache": {
                        "strategy": state.get("cacheStrategy", "read-write"),
                        "id": state.get("cacheId", "default"),
                    },
                    "deepThink": state.get("deepThink", False),
                    "aiContext": state.get("aiContext", ""),
                    "timeout": 300,  # 5 分钟，首次连接可能因代理/TLS 预热较慢
                },
            )

            state["midsceneResult"] = result
            state["finalReport"] = result.get("report", {})
            state["reportLogContent"] = result.get("report", {}).get("logContent")

            status = result.get("status", "unknown")
            results = result.get("results", {})
            assertions = results.get("assertions", [])
            passed = sum(1 for a in assertions if a.get("success"))
            total = len(assertions)
            duration = result.get("durationMs", 0)

            # Build summary
            summary_parts = [f"状态: {status}"]
            if total > 0:
                summary_parts.append(f"断言: {passed}/{total} 通过")
            if duration:
                summary_parts.append(f"耗时: {duration / 1000:.1f}s")

            # Include failed assertion details
            failed_assertions = [a for a in assertions if not a.get("success")]
            if failed_assertions:
                summary_parts.append("\n失败的断言:")
                for fa in failed_assertions:
                    summary_parts.append(f"  - {fa.get('expected', '')}: {fa.get('reason', '')[:100]}")

            state["finalType"] = "report_generated"
            state["finalResponse"] = f"Midscene 执行完成 | {' | '.join(summary_parts)}"

            print(f"[midscene_graph] Done: {status} | {passed}/{total} assertions passed")
            return state

        except Exception as e:
            traceback.print_exc()
            state["finalType"] = "error"
            state["finalResponse"] = f"Midscene execution failed: {e}"
            return state

    def finalize(state: MidsceneState) -> MidsceneState:
        """Final cleanup and state preparation."""
        # Store conversation if session_store available
        if session_store:
            try:
                sid = state.get("sessionId", "")
                if sid:
                    session_store.append(sid, "user", state.get("instruction", ""))
                    session_store.append(sid, "assistant", state.get("finalResponse", ""))
            except Exception:
                pass
        return state

    # ==================== Build Graph ====================

    g = StateGraph(MidsceneState)

    g.add_node("init_state", init_state)
    g.add_node("parse_testcase", parse_testcase)
    g.add_node("midscene_execute", midscene_execute)
    g.add_node("finalize", finalize)

    g.set_entry_point("init_state")
    g.add_edge("init_state", "parse_testcase")

    # If parse produced an error, skip execution
    g.add_conditional_edges(
        "parse_testcase",
        lambda s: "midscene_execute" if s.get("finalType") != "error" else "finalize",
        {"midscene_execute": "midscene_execute", "finalize": "finalize"},
    )

    g.add_edge("midscene_execute", "finalize")
    g.add_edge("finalize", END)

    return g.compile()
