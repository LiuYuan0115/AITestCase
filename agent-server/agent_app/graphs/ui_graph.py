"""
UI Agent LangGraph：用图结构替代手写 for-turn 循环

目标：
- 支持自然语言驱动：LLM 通过工具调用(browser_action/update_ui_document/analyze_response)操作浏览器、生成计划/报告
- 支持 Web + 插件注入（Shadow DOM）场景：选择器建议使用 data-testid，并可直接跨 open shadow root（Playwright 支持）
- 具备基础“自愈/鲁棒”：原子操作带等待、滚动、可选高亮、失败截图、有限重试；失败信息回传给 LLM 进行下一步修正
"""

from __future__ import annotations

import json
import os
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict
from types import SimpleNamespace
import re

from langgraph.graph import StateGraph, END

from agent_app.prompts import UI_AGENT_SYSTEM_PROMPT
from agent_app.tooling import ui_agent_tools_schema
from agent_app.ui.screenshots import get_screenshot_dir
from agent_app.config import is_anthropic_model
from agent_app.ui.runner import UiRunner, parse_plan_json

# 这些 helper 在你的工程里已存在（用于更稳的 tab/page 定位与语义化定位）。
# 若缺失，本文件也做了降级处理。
try:
    from agent_app.ui.browser_helpers import locate_target_page, smart_locate_element, build_accessibility_snapshot
except Exception:  # pragma: no cover
    locate_target_page = None
    smart_locate_element = None
    build_accessibility_snapshot = None


class UiState(TypedDict, total=False):
    sessionId: str
    instruction: str
    url: str
    plan: str
    # 可执行 Plan JSON（闭环模式优先使用，不一定展示给用户）
    planJson: str
    report: str
    headless: bool
    additionalPrds: List[Dict[str, str]]  # 辅助参考文档列表（可多选）

    # runtime
    playwright: Any
    browser: Any
    page: Any

    # prompt inputs
    pageInfo: str
    pageAccessibility: str
    messages: List[Dict[str, Any]]

    # llm outputs
    modelMessage: Any
    toolCalls: List[Any]

    # control
    turn: int
    maxTurns: int
    screenshotCount: int

    # final outputs
    finalType: str
    finalResponse: str
    finalPlan: Optional[str]
    finalReport: Optional[str]
    # 便于定位“没执行但回复”的问题
    toolResults: List[str]
    hadToolExecution: bool
    # 是否允许一次请求内多轮继续（默认 False：执行一轮即 finalize，确保释放浏览器控制）
    autoContinue: bool
    # workflow: direct（LLM 直接工具操控）| closed_loop（自然语言->Plan JSON->Runner->Report）
    workflow: str
    # 自愈参数（闭环模式）
    autoHeal: bool
    maxHealRounds: int
    healRound: int
    # 最近一次执行结果（便于生成自愈 prompt / 报告摘要）
    lastRunStats: Dict[str, Any]
    lastFailedSummary: str


# -----------------------------
# 纯文本/JSON 动作解析（fallback）
# -----------------------------

def _extract_action_dicts_from_text(text: str) -> List[Dict[str, Any]]:
    """从文本中提取 JSON 动作对象：{"action":"click","selector":"..."}"""
    if not text:
        return []
    s = text.replace("```json", "```").replace("```JSON", "```").replace("```", "")
    candidates: List[str] = []
    buf: List[str] = []
    depth = 0
    in_str = False
    escape = False
    for ch in s:
        if in_str:
            buf.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            buf.append(ch)
            continue
        if ch == "{":
            if depth == 0:
                buf = ["{"]
            else:
                buf.append("{")
            depth += 1
            continue
        if ch == "}":
            if depth > 0:
                buf.append("}")
                depth -= 1
                if depth == 0:
                    candidates.append("".join(buf))
                    buf = []
            continue
        if depth > 0:
            buf.append(ch)

    out: List[Dict[str, Any]] = []
    for cand in candidates:
        try:
            obj = json.loads(cand)
        except Exception:
            continue
        if isinstance(obj, dict) and (obj.get("action") or obj.get("action_type")):
            out.append(obj)
    return out


def _extract_action_dicts_from_plaintext(text: str) -> List[Dict[str, Any]]:
    """解析 click/fill/screenshot 这类纯文本动作（兼容截图中那种输出）"""
    if not text:
        return []
    quoted_values = re.findall(r'"([^"]+)"', text) + re.findall(r'“([^”]+)”', text)
    fallback_fill_value = quoted_values[-1].strip() if quoted_values else ""

    s = text.replace("```json", "```").replace("```JSON", "```").replace("```", "").strip()
    actions = ["navigate", "click", "fill", "hover", "select", "screenshot", "evaluate", "assert", "wait", "goto"]
    action_set = set(actions)
    pattern = r'(?i)\b(' + "|".join(actions) + r')\b'
    matches = list(re.finditer(pattern, s))
    if not matches:
        return []

    def _guess_fill_value_and_selector(payload_text: str) -> Dict[str, str]:
        p = (payload_text or "").strip()
        m_value = re.search(r'\bvalue\s*:\s*([\s\S]+)$', p, re.I)
        if m_value:
            sel = p[: m_value.start()].strip()
            val = m_value.group(1).strip().strip('"').strip('“”')
            return {"selector": sel, "value": val}
        tokens = p.split()
        if len(tokens) >= 2:
            last = tokens[-1].strip().strip('"').strip('“”')
            if last and (":" not in last) and (last.lower() not in action_set) and (len(last) <= 40):
                sel = p[: p.rfind(tokens[-1])].strip()
                return {"selector": sel, "value": last}
        return {"selector": p, "value": ""}

    chunks: List[Dict[str, Any]] = []
    for i, m in enumerate(matches):
        act = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(s)
        payload = s[start:end].strip()

        obj: Dict[str, Any] = {"action": act}
        if act == "screenshot":
            chunks.append(obj)
            continue

        if act in ["navigate", "goto"]:
            m_url = re.search(r'(https?://\S+)', payload)
            if m_url:
                obj["url"] = m_url.group(1).strip()
            chunks.append(obj)
            continue

        if act == "wait":
            ms = 1000
            m_ms = re.search(r'(\d+)\s*ms', payload, re.I)
            m_s = re.search(r'(\d+)\s*s', payload, re.I)
            m_num = re.search(r'\b(\d+)\b', payload)
            if m_ms:
                ms = int(m_ms.group(1))
            elif m_s:
                ms = int(m_s.group(1)) * 1000
            elif m_num:
                ms = int(m_num.group(1))
            obj["wait_time_ms"] = ms
            chunks.append(obj)
            continue

        # click/fill/hover/select
        m_sel = re.search(r'(testid:[^\s]+)|(extid:[^\s]+)|(role:[^\n]+)|(aria:[^\n]+)|(label:[^\n]+)|(placeholder:[^\n]+)|(text:[^\n]+)|([.#\[].+)', payload, re.I)
        if m_sel:
            selector = m_sel.group(0).strip()
            if act == "fill":
                guessed = _guess_fill_value_and_selector(selector)
                obj["selector"] = guessed["selector"].strip()
                if guessed["value"]:
                    obj["text"] = guessed["value"]
                elif fallback_fill_value:
                    obj["text"] = fallback_fill_value
            else:
                obj["selector"] = selector
        if act == "fill" and not obj.get("selector"):
            guessed = _guess_fill_value_and_selector(payload)
            if guessed["selector"]:
                obj["selector"] = guessed["selector"]
            if guessed["value"]:
                obj["text"] = guessed["value"]
            elif fallback_fill_value:
                obj["text"] = fallback_fill_value
        chunks.append(obj)

    cleaned: List[Dict[str, Any]] = []
    for o in chunks:
        a = (o.get("action") or o.get("action_type") or "").lower()
        if a in ["click", "fill", "hover", "select"] and not o.get("selector"):
            continue
        cleaned.append(o)
    return cleaned


def _normalize_action_to_tool_args(action_obj: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """把 action dict 统一成 browser_action 参数"""
    if not action_obj:
        return None
    raw_action = (action_obj.get("action_type") or action_obj.get("action") or "").strip().lower()
    if not raw_action:
        return None
    mapping = {
        "goto": "navigate",
        "go_to": "navigate",
        "navigate": "navigate",
        "click": "click",
        "fill": "fill",
        "input": "fill",
        "type": "fill",
        "hover": "hover",
        "select": "select",
        "screenshot": "screenshot",
        "evaluate": "evaluate",
        "assert": "assert",
        "wait": "wait",
        "sleep": "wait",
    }
    action_type = mapping.get(raw_action, raw_action)
    args: Dict[str, Any] = {"action_type": action_type}
    if action_obj.get("url"):
        args["url"] = action_obj.get("url")
    if action_obj.get("selector"):
        args["selector"] = action_obj.get("selector")
    # 兼容 text/value/option
    if action_obj.get("text") is not None:
        args["text"] = action_obj.get("text")
    if action_obj.get("value") is not None:
        args["value"] = action_obj.get("value")
    if action_obj.get("option") is not None:
        args["option"] = action_obj.get("option")
    if action_obj.get("js_code") is not None:
        args["js_code"] = action_obj.get("js_code")
    if action_obj.get("script") is not None:
        args["script"] = action_obj.get("script")
    # wait
    if action_obj.get("wait_time_ms") is not None:
        args["wait_time_ms"] = action_obj.get("wait_time_ms")
    if action_obj.get("wait_time") is not None:
        args["wait_time_ms"] = action_obj.get("wait_time")
    # assert
    if action_obj.get("assert_type") is not None:
        args["assert_type"] = action_obj.get("assert_type")
    if action_obj.get("expected") is not None:
        args["expected"] = action_obj.get("expected")
    if action_obj.get("step_name") is not None:
        args["step_name"] = action_obj.get("step_name")
    return args


def build_ui_graph(openai_client, model_name: str, session_store, anthropic_client=None):
    """
    构建 UI Agent LangGraph
    """

    # -----------------------------
    # Helpers
    # -----------------------------
    def _safe_json_loads(s: str) -> Dict[str, Any]:
        try:
            return json.loads(s) if s else {}
        except Exception:
            return {}

    def _tool_call_fields(tool_call: Any) -> Dict[str, Any]:
        """
        兼容 OpenAI tool_call 对象 / dict
        """
        if isinstance(tool_call, dict):
            return {
                "id": tool_call.get("id"),
                "name": (tool_call.get("function") or {}).get("name") or tool_call.get("name"),
                "arguments": (tool_call.get("function") or {}).get("arguments") or tool_call.get("arguments", "{}"),
            }
        func = getattr(tool_call, "function", None)
        return {
            "id": getattr(tool_call, "id", None),
            "name": getattr(func, "name", None),
            "arguments": getattr(func, "arguments", "{}"),
        }

    def _refresh_page_context(state: UiState) -> None:
        """
        刷新 pageInfo / Accessibility Snapshot，供下一轮 LLM 更准确决策
        """
        page = state.get("page")
        if not page:
            state["pageInfo"] = "No active page."
            state["pageAccessibility"] = ""
            return
        try:
            state["pageInfo"] = f"Current URL: {page.url}\nTitle: {page.title()}"
        except Exception as e:
            state["pageInfo"] = f"Page info error: {str(e)}"

        # Accessibility snapshot（可截断）
        snap = ""
        if build_accessibility_snapshot:
            try:
                snap = build_accessibility_snapshot(page) or ""
            except Exception:
                snap = ""
        if snap:
            # 控 token
            snap = snap[:12000]
            state["pageAccessibility"] = f"\n\nAccessibility Snapshot:\n{snap}"
        else:
            state["pageAccessibility"] = ""

    def _highlight_locator(page: Any, locator: Any) -> None:
        """
        Playwright 自带 locator.highlight()（新版本支持）；否则降级用 evaluate 添加 outline
        """
        try:
            locator.highlight()
            page.wait_for_timeout(250)
            return
        except Exception:
            pass
        try:
            handle = locator.element_handle()
            if handle:
                page.evaluate(
                    """(el) => {
                        const prev = el.style.outline;
                        el.style.outline = '3px solid #ff3b30';
                        setTimeout(()=>{ el.style.outline = prev; }, 300);
                    }""",
                    handle,
                )
                page.wait_for_timeout(300)
        except Exception:
            return

    def _locate(page: Any, selector: str):
        """
        定位策略：
        1) 优先调用 smart_locate_element（若存在）
        2) 否则按 Playwright locator(selector)
        """
        if not selector:
            raise ValueError("selector is required")
        if smart_locate_element:
            try:
                loc = smart_locate_element(page, selector)
                if loc is not None:
                    return loc
            except Exception:
                pass
        return page.locator(selector)

    def _should_execute_plan(state: UiState) -> bool:
        """仅在用户明确要求执行 plan 时触发 runner，避免影响现有直控逻辑"""
        instruction = (state.get("instruction") or "").strip()
        plan = (state.get("plan") or "").strip()
        if not plan:
            return False
        keywords = ["执行计划", "执行测试计划", "运行计划", "run plan", "execute plan", "按计划执行", "执行测试", "生成报告"]
        return any(k in instruction for k in keywords)

    def _use_closed_loop(state: UiState) -> bool:
        """是否启用闭环模板：自然语言 -> Plan(JSON) -> Runner -> Report"""
        workflow = (state.get("workflow") or "").strip().lower()
        if workflow in {"closed_loop", "plan_runner", "template", "plan", "run"}:
            return True
        # 兼容：前端只传 mode
        if workflow in {"closedloop", "closed"}:
            return True
        # 兜底：如果用户明确提到生成计划/执行/报告，则启用闭环
        instruction = (state.get("instruction") or "").strip().lower()
        keywords = ["生成计划", "生成测试计划", "plan json", "执行测试", "run", "执行", "生成报告", "runner", "自动化"]
        return any(k.lower() in instruction for k in keywords)

    def _extract_json_only(text: str) -> str:
        """从模型输出中提取第一个 JSON 对象；若失败则原样返回"""
        cand = _extract_first_json_object(text)
        return (cand or (text or "")).strip()

    def _call_llm_json(system: str, user: str, max_tokens: int = 2000) -> str:
        """调用 LLM 生成 JSON（只返回 JSON 字符串）。OpenAI/Anthropic 双栈兼容。"""
        if is_anthropic_model(model_name) and anthropic_client:
            # Anthropic messages.create（非流式更快更稳，适合 JSON-only）
            resp = anthropic_client.messages.create(
                model=model_name,
                max_tokens=max_tokens,
                temperature=0,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            content = getattr(resp, "content", None)
            if isinstance(content, list):
                text = "".join([getattr(b, "text", "") if getattr(b, "type", None) == "text" else (b.get("text") if isinstance(b, dict) and b.get("type") == "text" else "") for b in content])
            else:
                text = getattr(resp, "text", "") or ""
            return _extract_json_only(text)

        # OpenAI
        resp = openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        text = (resp.choices[0].message.content or "").strip()
        return _extract_json_only(text)

    def _plan_json_to_markdown(plan_dict: Dict[str, Any]) -> str:
        """把可执行 Plan JSON 转成可读的 Markdown 计划（用于前端展示/编辑）"""
        name = plan_dict.get("name") or plan_dict.get("meta", {}).get("name") or "UI Test Plan"
        base_url = plan_dict.get("baseUrl") or plan_dict.get("base_url") or plan_dict.get("meta", {}).get("baseUrl")
        steps = plan_dict.get("steps") or []

        md = f"# UI 自动化测试计划\n\n## 概要\n- **名称**: {name}\n"
        if base_url:
            md += f"- **Base URL**: {base_url}\n"
        md += "\n## 步骤\n\n| ID | Action | Target | Value/Expected | Note |\n|---|---|---|---|---|\n"

        for s in steps:
            sid = str(s.get("id", ""))
            action = str(s.get("action") or s.get("action_type") or "").strip()
            target = s.get("target") or {}
            t_str = ""
            if isinstance(target, dict) and target:
                by = target.get("by")
                if by == "role":
                    t_str = f"role:{target.get('role','')},name:{target.get('name','')}"
                else:
                    t_str = f"{by}:{target.get('value') or target.get('text') or target.get('selector') or ''}" if by else str(target)
            value = s.get("value") or s.get("text") or s.get("option") or s.get("assert_value") or s.get("expected") or ""
            note = s.get("note") or s.get("step_name") or ""
            md += f"| {sid} | {action} | {t_str} | {str(value)[:60]} | {str(note)[:40]} |\n"
        md += "\n\n> 说明：推荐优先使用 `testid:` / `extid:` / `role:` 选择器以提升稳定性。\n"
        return md

    def _build_plan_prompt(state: UiState) -> str:
        """Planner Prompt：自然语言 -> 可执行 Plan JSON"""
        # 控制输入大小，避免 token 浪费
        page_info = (state.get("pageInfo") or "")[:2000]
        a11y = (state.get("pageAccessibility") or "")[:8000]
        refs = state.get("additionalPrds") or []
        ref_text = ""
        if refs:
            ref_text = "\n\n# Reference Documents\n" + "\n\n".join(
                [f"## {r.get('title','Reference')}\n{(r.get('content') or '')[:1200]}" for r in refs[:5]]
            )

        return f"""You are a senior QA automation engineer.

Task:
Convert the user's natural-language intent into an EXECUTABLE UI automation Plan JSON for Playwright runner.

Constraints:
1) Output JSON only. No markdown, no explanations.
2) Schema (top-level): {{"name": string, "baseUrl"?: string, "steps": Step[]}}
3) Step schema:
   - id: string
   - action: one of [navigate, click, fill, hover, select, assert, wait, screenshot, evaluate]
   - url?: string (for navigate)
   - target?: {{by: one of [testid, extid, role, aria, label, placeholder, text, css], role?: string, name?: string, exact?: bool, value?: string}}
   - value?: string (for fill/select)
   - assert_type?: one of [url_contains, url_equals, text_visible, element_visible, element_hidden, element_count]
   - assert_value?: string|number
   - wait_time?: number (ms)
   - step_name?: string
4) Prefer stable selectors: testid/extid > role/name > label/placeholder > text > css.
5) If the user's request is ambiguous, create the smallest reasonable plan that navigates, locates key element(s), and asserts a visible success signal.

Current page context:
{page_info}
{a11y}
{ref_text}

User request:
{state.get('instruction','')}
"""

    def generate_plan(state: UiState) -> UiState:
        """闭环：自然语言 -> Plan(JSON) + Markdown"""
        try:
            _refresh_page_context(state)
            prompt = _build_plan_prompt(state)
            plan_json = _call_llm_json(
                system="Output JSON only.",
                user=prompt,
                max_tokens=2500,
            )
            # validate
            plan_dict = json.loads(plan_json)
            # ensure minimal fields
            if not isinstance(plan_dict, dict) or "steps" not in plan_dict:
                raise ValueError("Invalid plan JSON: missing 'steps'")
            # parse with runner to ensure compatibility
            _ = parse_plan_json(json.dumps(plan_dict, ensure_ascii=False))

            state["planJson"] = json.dumps(plan_dict, ensure_ascii=False)
            state["plan"] = _plan_json_to_markdown(plan_dict)
            state["finalPlan"] = state["plan"]
            state["finalType"] = "plan_generated"
            state["finalResponse"] = "OK: Plan JSON generated."
            state["toolResults"] = (state.get("toolResults") or []) + ["OK: plan generated (closed_loop)."]
            return state

        except Exception as e:
            state["finalType"] = "query"
            state["finalResponse"] = f"Error: generate_plan failed: {type(e).__name__}: {str(e)}"
            return state

    def heal_plan(state: UiState) -> UiState:
        """闭环自愈：根据失败信息修正 Plan JSON"""
        try:
            heal_round = int(state.get("healRound", 0)) + 1
            state["healRound"] = heal_round
            _refresh_page_context(state)
            current_json = (state.get("planJson") or "").strip()
            failed_summary = (state.get("lastFailedSummary") or "").strip()
            if not current_json:
                raise ValueError("Missing planJson for healing")

            prompt = f"""You are fixing a flaky UI automation plan.

Return a FULL corrected Plan JSON only.

Current Plan JSON:
{current_json}

Failure summary:
{failed_summary}

Current page context:
{(state.get('pageInfo') or '')[:1500]}
{(state.get('pageAccessibility') or '')[:8000]}

Rules:
1) Output JSON only.
2) Prefer more robust selectors (testid/extid/role/name/placeholder).
3) Add minimal wait/assert steps if necessary.
"""
            new_plan_json = _call_llm_json(
                system="Output JSON only.",
                user=prompt,
                max_tokens=2500,
            )
            plan_dict = json.loads(new_plan_json)
            _ = parse_plan_json(json.dumps(plan_dict, ensure_ascii=False))

            state["planJson"] = json.dumps(plan_dict, ensure_ascii=False)
            state["plan"] = _plan_json_to_markdown(plan_dict)
            state["finalPlan"] = state["plan"]
            state["toolResults"] = (state.get("toolResults") or []) + [f"OK: plan healed (round {heal_round})."]
            return state
        except Exception as e:
            state["toolResults"] = (state.get("toolResults") or []) + [f"Error: heal_plan failed: {type(e).__name__}: {str(e)}"]
            return state

    def post_report(state: UiState) -> UiState:
        """闭环：执行后统一生成报告输出（finalResponse/plan/report 对齐）"""
        stats = state.get("lastRunStats") or {}
        passed = stats.get("passed")
        total = stats.get("total")
        failed = stats.get("failed")
        plan_name = stats.get("plan_name")
        heal_round = int(state.get("healRound", 0))

        if plan_name and total is not None:
            state["finalType"] = "closed_loop_done"
            state["finalResponse"] = (
                f"OK: Executed plan '{plan_name}'. Passed {passed}/{total}, failed {failed}."
                + (f" (auto-heal rounds: {heal_round})" if heal_round else "")
            )
        # 同步对外字段
        state["finalPlan"] = state.get("finalPlan") or state.get("plan")
        state["finalReport"] = state.get("finalReport") or state.get("report")
        return state

    def _looks_like_json_plan(text: str) -> bool:
        s = (text or "").strip()
        return s.startswith("{") and ("\"steps\"" in s or "'steps'" in s)

    def _extract_first_json_object(text: str) -> Optional[str]:
        if not text:
            return None
        s = (text or "").strip()
        s = s.replace("```json", "```").replace("```JSON", "```").replace("```", "")
        depth = 0
        in_str = False
        escape = False
        buf: List[str] = []
        started = False
        for ch in s:
            if in_str:
                if started:
                    buf.append(ch)
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
                if started:
                    buf.append(ch)
                continue
            if ch == "{":
                if not started:
                    started = True
                    buf = ["{"]
                    depth = 1
                else:
                    buf.append("{")
                    depth += 1
                continue
            if ch == "}":
                if started:
                    buf.append("}")
                    depth -= 1
                    if depth == 0:
                        return "".join(buf)
                continue
            if started:
                buf.append(ch)
        return None

    def _convert_markdown_plan_to_json(markdown_plan: str) -> str:
        """将 Markdown plan 转换为 Plan JSON（仅在 execute_plan 路径触发）"""
        prompt = f"""Convert the following UI test plan from Markdown to executable Plan JSON.

Rules:
1) Output JSON only (no markdown fences, no explanations)
2) Top-level: name (string), baseUrl (optional), steps (array)
3) Each step: id, action, url?, target?, value?/text?/option?, assert_type?/expected?, wait_time_ms?

Markdown plan:
---
{(markdown_plan or '')[:12000]}
---"""
        if is_anthropic_model(model_name) and anthropic_client:
            text = _call_anthropic_stream([{"role": "system", "content": "Output JSON only."}, {"role": "user", "content": prompt}], model_name)
        else:
            resp = openai_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "system", "content": "Output JSON only."}, {"role": "user", "content": prompt}],
            )
            text = (resp.choices[0].message.content or "").strip()
        json_obj = _extract_first_json_object(text) or text
        json.loads(json_obj)
        return json_obj

    def _take_failure_screenshot(state: UiState, step_name: str) -> str:
        screenshot_dir = get_screenshot_dir()
        os.makedirs(screenshot_dir, exist_ok=True)
        idx = int(state.get("screenshotCount", 0)) + 1
        state["screenshotCount"] = idx
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_step = "".join([c for c in (step_name or "step") if c.isalnum() or c in ("-", "_")])[:40]
        path = os.path.join(screenshot_dir, f"fail_{idx:03d}_{safe_step}_{ts}.png")
        try:
            state["page"].screenshot(path=path, full_page=True)
            return path
        except Exception:
            return path

    def _execute_browser_action(state: UiState, args: Dict[str, Any]) -> str:
        """
        执行 browser_action：带基础鲁棒/自愈（等待 + 滚动 + 高亮 + 有限重试 + 失败截图）
        """
        page = state.get("page")
        if not page:
            return "❌ No active page to operate on."

        action_type = args.get("action_type")
        selector = args.get("selector", "")
        url = args.get("url", "")

        # 兼容多种字段名（tool schema 可能演进）
        value = args.get("value", "")
        if value in (None, ""):
            value = args.get("text", "")
        if value in (None, ""):
            value = args.get("option", "")

        script = args.get("script", "")
        if script in (None, ""):
            script = args.get("js_code", "")

        # wait 的等待时间（ms）
        wait_ms = args.get("wait_time_ms", None)
        if wait_ms is None:
            wait_ms = args.get("ms", None)

        # 通用超时与截图选项
        try:
            timeout_ms = int(args.get("timeout_ms", 15000))
        except Exception:
            timeout_ms = 15000
        full_page = bool(args.get("full_page", True))

        step_name = args.get("step_name", action_type or "browser_action")

        def _ensure_ready():
            try:
                page.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
            except Exception:
                pass

        last_err = None
        for attempt in range(3):
            try:
                _ensure_ready()

                if action_type == "navigate":
                    if not url:
                        raise ValueError("navigate requires url")
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)
                    return f"✅ Navigated to: {url}"

                if action_type == "get_content":
                    # 返回轻量上下文：URL + Title + 可见文本片段 + Accessibility Snapshot
                    title = ""
                    try:
                        title = page.title()
                    except Exception:
                        title = ""
                    visible_text = ""
                    try:
                        # 只取 body innerText 的前一段，避免 token 爆炸
                        visible_text = page.locator("body").inner_text(timeout=5000)[:6000]
                    except Exception:
                        visible_text = ""
                    snap = ""
                    if build_accessibility_snapshot:
                        try:
                            snap = (build_accessibility_snapshot(page) or "")[:8000]
                        except Exception:
                            snap = ""
                    return (
                        f"Current URL: {page.url}\n"
                        f"Title: {title}\n\n"
                        f"Visible Text (truncated):\n{visible_text}\n\n"
                        f"Accessibility Snapshot (truncated):\n{snap}"
                    )

                if action_type == "screenshot":
                    screenshot_dir = get_screenshot_dir()
                    os.makedirs(screenshot_dir, exist_ok=True)
                    idx = int(state.get("screenshotCount", 0)) + 1
                    state["screenshotCount"] = idx
                    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                    path = os.path.join(screenshot_dir, f"shot_{idx:03d}_{ts}.png")
                    page.screenshot(path=path, full_page=full_page)
                    return f"📸 Screenshot saved: {path}"

                if action_type == "evaluate":
                    if not script:
                        raise ValueError("evaluate requires script")
                    out = page.evaluate(script)
                    # JSON 可序列化输出
                    try:
                        dumped = json.dumps(out, ensure_ascii=False)
                    except Exception:
                        dumped = str(out)
                    return f"✅ Evaluate OK. Result: {dumped[:2000]}"

                
                if action_type == "wait":
                    # 默认等待 1000ms；优先使用 wait_time_ms / ms，其次使用 value/text
                    ms = 1000
                    try:
                        if wait_ms is not None:
                            ms = int(wait_ms)
                        elif value not in (None, ""):
                            ms = int(value)
                    except Exception:
                        ms = 1000
                    page.wait_for_timeout(ms)
                    return f"⏳ Waited: {ms}ms"

                if action_type == "assert":

                    assert_type = (args.get("assert_type") or "text_visible").strip()

                    expected = args.get("expected")

                    if expected in (None, ""):

                        expected = value or ""


                    if assert_type == "url_contains":

                        if str(expected) and str(expected) in page.url:

                            return f"✅ Assert OK: url contains '{expected}'"

                        raise AssertionError(f"URL assert failed: expected contains '{expected}', current={page.url}")


                    if assert_type == "url_equals":

                        if str(expected) and page.url == str(expected):

                            return f"✅ Assert OK: url equals '{expected}'"

                        raise AssertionError(f"URL assert failed: expected equals '{expected}', current={page.url}")


                    if assert_type in ("text_visible", "text_hidden"):

                        if not str(expected):

                            raise ValueError("assert(expected) is required for text_*")

                        tloc = page.get_by_text(str(expected), exact=False).first

                        if assert_type == "text_visible":

                            tloc.wait_for(state="visible", timeout=timeout_ms)

                            return f"✅ Assert OK: text visible '{expected}'"

                        try:

                            tloc.wait_for(state="hidden", timeout=timeout_ms)

                        except Exception:

                            if tloc.is_visible():

                                raise AssertionError(f"Text still visible: '{expected}'")

                        return f"✅ Assert OK: text hidden '{expected}'"


                    if assert_type in ("element_visible", "element_hidden", "element_count"):

                        if not selector:

                            raise ValueError("selector is required for element_* asserts")

                        eloc = _locate(page, selector)

                        if assert_type == "element_visible":

                            eloc.first.wait_for(state="visible", timeout=timeout_ms)

                            return f"✅ Assert OK: element visible ({selector})"

                        if assert_type == "element_hidden":

                            try:

                                eloc.first.wait_for(state="hidden", timeout=timeout_ms)

                            except Exception:

                                try:

                                    eloc.first.wait_for(state="detached", timeout=timeout_ms)

                                except Exception:

                                    if eloc.first.is_visible():

                                        raise AssertionError(f"Element still visible: {selector}")

                            return f"✅ Assert OK: element hidden ({selector})"

                        try:

                            exp_n = int(expected)

                        except Exception:

                            raise ValueError("element_count expected must be an integer")

                        cnt = eloc.count()

                        if cnt == exp_n:

                            return f"✅ Assert OK: element count == {exp_n} ({selector})"

                        raise AssertionError(f"Element count assert failed: expected {exp_n}, got {cnt} ({selector})")


                    # 兼容旧默认：text_contains

                    if not str(expected):

                        raise ValueError("assert expected is required")

                    try:

                        page.get_by_text(str(expected), exact=False).first.wait_for(state="visible", timeout=timeout_ms)

                        return f"✅ Assert OK: text contains '{expected}'"

                    except Exception:

                        body_text = page.locator("body").inner_text(timeout=5000)

                        if str(expected) in body_text:

                            return f"✅ Assert OK: body contains '{expected}'"

                    raise AssertionError(f"Text not found: '{expected}'")

# click/fill/hover/select 需要 selector
                loc = _locate(page, selector).first
                loc.wait_for(state="visible", timeout=timeout_ms)
                try:
                    loc.scroll_into_view_if_needed(timeout=3000)
                except Exception:
                    pass

                # 可视化反馈（可关：如你未来加 params）
                _highlight_locator(page, loc)

                if action_type == "click":
                    loc.click(timeout=timeout_ms)
                    return f"✅ Clicked: selector={selector}"

                if action_type == "hover":
                    loc.hover(timeout=timeout_ms)
                    return f"✅ Hovered: selector={selector}"

                if action_type == "fill":
                    loc.fill(value or "", timeout=timeout_ms)
                    return f"✅ Filled: selector={selector}, value={value}"

                if action_type == "press":
                    key = args.get("key") or value
                    if not key:
                        raise ValueError("press requires 'key' (e.g., Enter)")
                    loc.press(str(key), timeout=timeout_ms)
                    return f"✅ Pressed: selector={selector}, key={key}"

                if action_type == "select":
                    loc.select_option(value, timeout=timeout_ms)
                    return f"✅ Selected: selector={selector}, value={value}"

                raise ValueError(f"Unknown action_type: {action_type}")

            except Exception as e:
                last_err = e
                shot = _take_failure_screenshot(state, step_name)
                # 失败时做一次额外等待（对慢加载很有帮助）
                try:
                    page.wait_for_timeout(600)
                except Exception:
                    pass

                if attempt < 2:
                    continue
                err = f"{type(e).__name__}: {str(e)}"
                return (
                    f"❌ browser_action failed after retries.\n"
                    f"- action_type: {action_type}\n"
                    f"- selector: {selector}\n"
                    f"- url: {url}\n"
                    f"- value: {value}\n"
                    f"- screenshot: {shot}\n"
                    f"- error: {err}\n"
                )

        # fallback
        return f"❌ browser_action failed: {str(last_err)}"

    # -----------------------------
    # Graph nodes
    # -----------------------------
    def init_state(state: UiState) -> UiState:
        state["turn"] = 0
        state["maxTurns"] = int(state.get("maxTurns", 15))
        # workflow & self-heal defaults
        state["workflow"] = (state.get("workflow") or "direct").strip().lower()
        state["autoHeal"] = bool(state.get("autoHeal", True))
        state["maxHealRounds"] = int(state.get("maxHealRounds", 1) or 1)
        state["healRound"] = int(state.get("healRound", 0) or 0)
        state["lastRunStats"] = state.get("lastRunStats") or {}
        state["lastFailedSummary"] = state.get("lastFailedSummary") or ""
        # 默认单轮：避免一次请求里长时间占用/操控浏览器
        state["autoContinue"] = bool(state.get("autoContinue", False))
        state["finalType"] = "query"
        state["finalResponse"] = ""
        state["finalPlan"] = None
        state["finalReport"] = None
        state["screenshotCount"] = int(state.get("screenshotCount", 0))
        state["messages"] = []
        state["toolCalls"] = []
        state["toolResults"] = []
        state["hadToolExecution"] = False
        return state

    def connect_browser(state: UiState) -> UiState:
        """
        连接浏览器：
        - 默认（headless=False）：优先 CDP 连接到用户已打开的 Chrome（便于测插件注入）
        - headless=True：启动新的无头 Chromium（便于纯 Web 测试）
        """
        from playwright.sync_api import sync_playwright

        p = sync_playwright().start()
        state["playwright"] = p

        headless_mode = bool(state.get("headless", False))
        url = state.get("url") or ""

        try:
            if headless_mode:
                browser = p.chromium.launch(headless=True)
                ctx = browser.new_context()
                page = ctx.new_page()
                if url:
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)
                state["browser"] = browser
                state["page"] = page
                _refresh_page_context(state)
                return state

            # 有头：优先连接 CDP（用于测试插件注入/用户真实浏览器状态）
            try:
                browser = p.chromium.connect_over_cdp("http://localhost:9222")
                state["browser"] = browser
            except Exception:
                # CDP 失败兜底：启动新的有头 Chromium，确保至少能执行并截图
                browser = p.chromium.launch(headless=False)
                ctx = browser.new_context()
                page = ctx.new_page()
                if url:
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)
                state["browser"] = browser
                state["page"] = page
                _refresh_page_context(state)
                return state

            page = None
            if locate_target_page and url:
                try:
                    page = locate_target_page(browser, url)
                except Exception:
                    page = None

            # fallback：取第一个 page
            if not page:
                try:
                    if browser.contexts and browser.contexts[0].pages:
                        page = browser.contexts[0].pages[0]
                except Exception:
                    page = None

            # fallback：创建新 page
            if not page:
                ctx = browser.contexts[0] if browser.contexts else browser.new_context()
                page = ctx.new_page()
                if url:
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)

            state["page"] = page
            _refresh_page_context(state)
            return state

        except Exception as e:
            # 错误信息必须为英文
            err = f"Error: Failed to connect to Chrome via CDP (http://localhost:9222): {str(e)}"
            err += "\n\nPlease start Chrome with remote debugging enabled:\n"
            err += "macOS: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n"
            err += "Windows: chrome.exe --remote-debugging-port=9222\n"
            err += "Linux: google-chrome --remote-debugging-port=9222\n"
            state["pageInfo"] = err
            state["pageAccessibility"] = ""
            return state

    def build_prompt(state: UiState) -> UiState:
        NL = "\n"
        plan = state.get("plan") or ""
        report = state.get("report") or ""
        sep = f"---{NL}"

        # 处理辅助参考文档（如用户在输入框用 @ 引用的右侧文档）
        additional_prds = state.get("additionalPrds") or []
        additional_text = ""
        if additional_prds:
            additional_text = f"{NL}### Reference Documents{NL}"
            per_doc_max = max(1200, 8000 // (len(additional_prds) + 1))
            for i, prd in enumerate(additional_prds, 1):
                title = (prd.get("title") or f"Reference {i}").strip()
                content = (prd.get("content") or "").strip()
                if len(content) > per_doc_max:
                    content = content[:per_doc_max] + f"{NL}{NL}... (truncated) ..."
                additional_text += f"{NL}#### {title}{NL}{NL}{content}{NL}{NL}---{NL}"

        system_content = (
            f"{UI_AGENT_SYSTEM_PROMPT}\n\n"
            f"## Current State\n\n"
            f"### Page Info\n{state.get('pageInfo','')}{state.get('pageAccessibility','')}\n\n"
            f"### Existing Plan\n"
            f"{(sep + plan[:8000] + NL + '---') if plan else '(none)'}\n\n"
            f"### Existing Report\n"
            f"{(sep + report[:8000] + NL + '---') if report else '(none)'}\n"
            f"{additional_text}"
        )

        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_content}]
        # 注入历史对话（session_store 中的 message dict 列表）
        try:
            messages.extend(session_store.get(state["sessionId"]))
        except Exception:
            pass

        messages.append({"role": "user", "content": state.get("instruction", "")})
        state["messages"] = messages
        return state

    def _call_anthropic_stream(messages: List[Dict], model: str, max_tokens: int = 8000) -> str:
        """调用 Anthropic API（流式，无工具调用）"""
        if not anthropic_client:
            raise ValueError("Anthropic client not configured")
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg.get("role") == "system":
                system_content += (msg.get("content") or "") + "\n"
            else:
                chat_messages.append({"role": msg.get("role"), "content": msg.get("content") or ""})
        full_response = ""
        with anthropic_client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system_content.strip() if system_content else None,
            messages=chat_messages,
        ) as stream:
            for t in stream.text_stream:
                full_response += t
        return full_response

    def _convert_openai_tools_to_anthropic(openai_tools: List[Dict]) -> List[Dict]:
        """将 OpenAI 格式的工具定义转换为 Anthropic 格式"""
        anthropic_tools = []
        for tool in openai_tools:
            if tool.get("type") == "function" and "function" in tool:
                func = tool["function"]
                anthropic_tools.append({
                    "name": func.get("name"),
                    "description": func.get("description", ""),
                    "input_schema": func.get("parameters", {})
                })
        return anthropic_tools

    def _call_anthropic_with_tools(messages: List[Dict], model: str, max_tokens: int = 8000) -> tuple[str, List[Dict]]:
        """调用 Anthropic API（支持工具调用）"""
        if not anthropic_client:
            raise ValueError("Anthropic client not configured")

        # 转换工具定义
        anthropic_tools = _convert_openai_tools_to_anthropic(ui_agent_tools_schema)

        # 处理消息历史（转换 tool_calls 和 tool results 为 Anthropic 格式）
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg.get("role") == "system":
                system_content += (msg.get("content") or "") + "\n"
            elif msg.get("role") == "tool":
                # Anthropic 格式：tool role 包含 tool_use_id 和 content
                tool_call_id = msg.get("tool_call_id", "")
                content = msg.get("content", "")
                chat_messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_call_id,
                        "content": content
                    }]
                })
            elif msg.get("tool_calls"):
                # 转换 tool_calls 为 Anthropic 格式
                content_blocks = []
                if msg.get("content"):
                    content_blocks.append({"type": "text", "text": msg.get("content")})
                for tc in msg.get("tool_calls", []):
                    func = tc.get("function", {}) if isinstance(tc, dict) else getattr(tc, "function", None)
                    if func:
                        if isinstance(func, dict):
                            name = func.get("name", "")
                            args = func.get("arguments", "{}")
                        else:
                            name = getattr(func, "name", "")
                            args = getattr(func, "arguments", "{}")
                        try:
                            args_dict = json.loads(args) if isinstance(args, str) else args
                        except:
                            args_dict = {}
                        content_blocks.append({
                            "type": "tool_use",
                            "id": tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", ""),
                            "name": name,
                            "input": args_dict
                        })
                chat_messages.append({"role": "assistant", "content": content_blocks})
            else:
                chat_messages.append({"role": msg.get("role"), "content": msg.get("content") or ""})

        # 调用 API
        response = anthropic_client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_content.strip() if system_content else None,
            messages=chat_messages,
            tools=anthropic_tools if anthropic_tools else None,
        )

        # 提取文本内容和工具调用
        text_content = ""
        tool_calls = []
        
        for block in response.content:
            if block.type == "text":
                text_content += block.text
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "function": {
                        "name": block.name,
                        "arguments": json.dumps(block.input, ensure_ascii=False)
                    }
                })
        
        return text_content, tool_calls

    def llm_step(state: UiState) -> UiState:
        state["turn"] = int(state.get("turn", 0)) + 1

        try:
            if is_anthropic_model(model_name) and anthropic_client:
                content, tool_calls = _call_anthropic_with_tools(state["messages"], model_name)
                # 转换 tool_calls 为 SimpleNamespace 格式（与 OpenAI 兼容）
                formatted_tool_calls = []
                for tc in tool_calls:
                    formatted_tool_calls.append(
                        SimpleNamespace(
                            id=tc["id"],
                            function=SimpleNamespace(
                                name=tc["function"]["name"],
                                arguments=tc["function"]["arguments"]
                            )
                        )
                    )
                state["modelMessage"] = {"content": content, "tool_calls": formatted_tool_calls if formatted_tool_calls else None}
                state["messages"].append({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": formatted_tool_calls if formatted_tool_calls else None
                })
                state["toolCalls"] = formatted_tool_calls
            else:
                # OpenAI
                resp = openai_client.chat.completions.create(
                    model=model_name,
                    messages=state["messages"],
                    tools=ui_agent_tools_schema,
                    tool_choice="auto",
                )
                msg = resp.choices[0].message
                state["modelMessage"] = msg
                state["messages"].append(
                    {
                        "role": "assistant",
                        "content": getattr(msg, "content", "") or "",
                        "tool_calls": getattr(msg, "tool_calls", None),
                    }
                )
                state["toolCalls"] = getattr(msg, "tool_calls", None) or []
        except Exception as e:
            # 错误信息必须为英文；并保证能走 finalize 做资源清理
            state["finalType"] = "query"
            state["finalResponse"] = f"Error: LLM call failed: {type(e).__name__}: {str(e)}"
            state["toolCalls"] = []
            return state

        # Fallback：无 tool_calls 时解析文本动作，合成 toolCalls
        if not (state.get("toolCalls") or []):
            content = ""
            mm = state.get("modelMessage")
            if isinstance(mm, dict):
                content = (mm.get("content") or "")
            else:
                content = getattr(mm, "content", "") or ""
            action_dicts = _extract_action_dicts_from_text(content)
            if not action_dicts:
                action_dicts = _extract_action_dicts_from_plaintext(content)
            synthesized: List[Any] = []
            for i, action_obj in enumerate(action_dicts):
                tool_args = _normalize_action_to_tool_args(action_obj)
                if not tool_args:
                    continue
                synthesized.append(
                    SimpleNamespace(
                        id=f"synthetic_{state.get('sessionId','')}_{state.get('turn',0)}_{i}",
                        function=SimpleNamespace(name="browser_action", arguments=json.dumps(tool_args, ensure_ascii=False)),
                    )
                )
            if synthesized:
                state["toolCalls"] = synthesized
            else:
                # 错误信息必须为英文
                state["finalType"] = "query"
                state["finalResponse"] = "Error: No executable actions were produced (no tool_calls and no parsable actions in model output)."

        return state

    def execute_plan(state: UiState) -> UiState:
        """Plan(JSON/Markdown) -> runner 执行 -> 回填 report"""
        try:
            page = state.get("page")
            raw_plan = (state.get("plan") or "").strip()
            raw_plan_json = (state.get("planJson") or "").strip()
            if not page:
                state["finalType"] = "query"
                state["finalResponse"] = "Error: No active page for executing plan."
                return state
            if not raw_plan and not raw_plan_json:
                state["finalType"] = "query"
                state["finalResponse"] = "Error: Plan is empty."
                return state
            # 优先使用闭环生成的 planJson；否则兼容旧逻辑（plan 可能是 Markdown 或 JSON）
            if raw_plan_json:
                plan_json = raw_plan_json
            else:
                plan_json = raw_plan if _looks_like_json_plan(raw_plan) else _convert_markdown_plan_to_json(raw_plan)
            plan_obj = parse_plan_json(plan_json)
            runner = UiRunner(page, headless=bool(state.get("headless", False)), max_retries=2)
            report = runner.run_plan(plan_obj)
            report_md = report.to_markdown()
            state["finalType"] = "report_generated"
            state["finalReport"] = report_md
            state["report"] = report_md
            # 回填：闭环优先返回 Markdown 计划（更适合前端展示/编辑）；同时保留可执行 JSON 供回放
            if raw_plan_json:
                state["planJson"] = plan_json
            state["finalPlan"] = state.get("finalPlan") or raw_plan
            state["lastRunStats"] = {
                "plan_name": plan_obj.name,
                "total": report.total_steps,
                "passed": report.passed_steps,
                "failed": report.failed_steps,
            }
            # 汇总失败信息（用于自愈）
            if report.failed_steps:
                failed_lines = []
                for r in report.results:
                    if not r.success:
                        failed_lines.append(
                            f"- step {r.step_id}: {r.message} (screenshot: {r.screenshot or 'N/A'})"
                        )
                state["lastFailedSummary"] = "\n".join(failed_lines)[:5000]
            else:
                state["lastFailedSummary"] = ""

            state["finalResponse"] = f"OK: Executed plan '{plan_obj.name}'. Passed {report.passed_steps}/{report.total_steps}, failed {report.failed_steps}."
            return state
        except Exception as e:
            state["finalType"] = "query"
            state["finalResponse"] = f"Error: execute_plan failed: {type(e).__name__}: {str(e)}"
            return state

    def route_after_llm(state: UiState) -> str:
        if int(state.get("turn", 0)) >= int(state.get("maxTurns", 15)):
            return "finalize_timeout"
        return "tool_step" if state.get("toolCalls") else "finalize"

    def tool_step(state: UiState) -> UiState:
        tool_calls = state.get("toolCalls") or []
        if not tool_calls:
            return state

        for tc in tool_calls:
            f = _tool_call_fields(tc)
            tool_id = f.get("id")
            tool_name = f.get("name")
            args_json = f.get("arguments") or "{}"
            args = _safe_json_loads(args_json)

            tool_result = ""
            try:
                if tool_name == "browser_action":
                    tool_result = _execute_browser_action(state, args)

                elif tool_name == "update_ui_document":
                    doc_type = args.get("doc_type")
                    content = args.get("content", "")
                    desc = args.get("description", "")
                    if doc_type == "plan":
                        state["plan"] = content
                        state["finalPlan"] = content
                    elif doc_type == "report":
                        state["report"] = content
                        state["finalReport"] = content
                    tool_result = f"OK: update_ui_document ({doc_type}). {desc}"

                elif tool_name == "analyze_response":
                    analysis_type = args.get("analysis_type", "query")
                    result = args.get("result", "")
                    state["finalType"] = analysis_type
                    state["finalResponse"] = result
                    tool_result = f"OK: analyze_response ({analysis_type})."

                else:
                    tool_result = f"Error: Unknown tool '{tool_name}'."

            except Exception as e:
                shot = _take_failure_screenshot(state, f"tool_{tool_name or 'unknown'}")
                # 错误信息必须为英文
                tool_result = (
                    f"Error: Tool execution failed: {tool_name}\n"
                    f"- error: {type(e).__name__}: {str(e)}\n"
                    f"- screenshot: {shot}\n"
                )

            # 把 tool 结果回填到 messages，供下一轮 LLM 观察
            state["messages"].append(
                {
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "content": tool_result,
                }
            )
            state["toolResults"] = (state.get("toolResults") or []) + [tool_result]
            state["hadToolExecution"] = True

        # 执行完工具后刷新页面上下文
        _refresh_page_context(state)
        state["toolCalls"] = []
        return state

    def route_after_tool(state: UiState) -> str:
        """
        默认：tool_step 执行完立即 finalize，确保请求结束后释放 Playwright/浏览器控制。
        若显式设置 autoContinue=True，则允许继续 build_prompt -> llm_step 的多轮自愈。
        """
        return "build_prompt" if bool(state.get("autoContinue", False)) else "finalize"

    def finalize(state: UiState) -> UiState:
        # 若无 finalResponse：优先返回工具执行摘要；否则返回明确错误，避免“Done”
        if not (state.get("finalResponse") or "").strip():
            tool_results = state.get("toolResults") or []
            if tool_results:
                state["finalType"] = state.get("finalType") or "query"
                state["finalResponse"] = "Tool execution results:\n" + "\n".join(tool_results[-12:])
            else:
                state["finalType"] = "query"
                state["finalResponse"] = "Error: No tool execution happened."

        # 输出 plan/report（若被工具更新）
        state["finalPlan"] = state.get("finalPlan") or state.get("plan")
        state["finalReport"] = state.get("finalReport") or state.get("report")

        # 资源清理
        try:
            browser = state.get("browser")
            if browser:
                # connect_over_cdp：优先断开连接；launch：关闭浏览器进程
                if hasattr(browser, "disconnect"):
                    try:
                        browser.disconnect()
                    except Exception:
                        pass
                if hasattr(browser, "close"):
                    try:
                        browser.close()
                    except Exception:
                        pass
        except Exception:
            pass
        try:
            p = state.get("playwright")
            if p:
                p.stop()
        except Exception:
            pass
        return state

    def finalize_timeout(state: UiState) -> UiState:
        if not state.get("finalResponse"):
            # 错误信息必须为英文
            state["finalResponse"] = "Error: Max turns reached."
        state["finalPlan"] = state.get("finalPlan") or state.get("plan")
        state["finalReport"] = state.get("finalReport") or state.get("report")
        return finalize(state)

    # -----------------------------
    # Build graph
    # -----------------------------
    g = StateGraph(UiState)

    g.add_node("init_state", init_state)
    g.add_node("connect_browser", connect_browser)
    g.add_node("build_prompt", build_prompt)
    g.add_node("generate_plan", generate_plan)
    g.add_node("heal_plan", heal_plan)
    g.add_node("post_report", post_report)
    g.add_node("execute_plan", execute_plan)
    g.add_node("llm_step", llm_step)
    g.add_node("tool_step", tool_step)
    g.add_node("finalize", finalize)
    g.add_node("finalize_timeout", finalize_timeout)

    g.set_entry_point("init_state")
    g.add_edge("init_state", "connect_browser")
    # connect_browser 后：闭环模式直接生成 Plan；否则走原来的 build_prompt（工具直控）
    g.add_conditional_edges(
        "connect_browser",
        lambda s: "generate_plan" if _use_closed_loop(s) else "build_prompt",
        {"generate_plan": "generate_plan", "build_prompt": "build_prompt"},
    )

    # direct 模式：build_prompt 后若明确要求执行现有 plan，则走 runner，否则走 llm
    g.add_conditional_edges(
        "build_prompt",
        lambda s: "execute_plan" if _should_execute_plan(s) else "llm_step",
        {"execute_plan": "execute_plan", "llm_step": "llm_step"},
    )

    # closed_loop 模式：生成计划后直接执行
    g.add_edge("generate_plan", "execute_plan")

    def route_after_execute_plan(state: UiState) -> str:
        if not _use_closed_loop(state):
            return "finalize"
        # auto-heal：仅在失败时触发，最多 N 轮
        try:
            stats = state.get("lastRunStats") or {}
            failed = int(stats.get("failed", 0) or 0)
        except Exception:
            failed = 0
        can_heal = bool(state.get("autoHeal", True)) and int(state.get("healRound", 0)) < int(state.get("maxHealRounds", 1))
        return "heal_plan" if (failed > 0 and can_heal) else "post_report"

    g.add_conditional_edges(
        "execute_plan",
        route_after_execute_plan,
        {"heal_plan": "heal_plan", "post_report": "post_report", "finalize": "finalize"},
    )

    g.add_edge("heal_plan", "execute_plan")
    g.add_edge("post_report", "finalize")
    g.add_conditional_edges("llm_step", route_after_llm, {"tool_step": "tool_step", "finalize": "finalize", "finalize_timeout": "finalize_timeout"})
    # tool_step 后默认直接 finalize，避免一次请求持续操控浏览器
    g.add_conditional_edges("tool_step", route_after_tool, {"build_prompt": "build_prompt", "finalize": "finalize"})
    g.add_edge("finalize", END)
    g.add_edge("finalize_timeout", END)

    return g.compile()
