你要的 3 件事（自然语言→操作浏览器验证、上传测试计划执行、代码化且自愈鲁棒）你们这套工程其实已经打了地基：后端有 `/api/ui_agent`（LangGraph + Playwright），支持 `params.plan/report/headless` 透传，并且工具层已经定义了 `browser_action(navigate/click/fill/get_content/screenshot/evaluate/hover/select)` + `update_ui_document(plan/report)`；UI 智能体系统提示也明确了“计划/报告模式 vs 直接操作模式”的路由逻辑。下面我给你一个**可直接落地**的实现方案（含你们当前代码里必须先修的坑 + 自愈策略 + 计划上传执行）。

---

## 0）先修一个会让 UI 自动化直接跑不起来的代码问题（你现有 `ui_graph.py`）

你们的 `ui_graph.py` 里 `build_prompt` 用了 f-string 表达式里带 `\\n` 的写法，会触发 Python 语法错误（f-string expression 不能包含反斜杠）。相关片段在这里：

**修法（推荐）**：把换行符提到表达式外（或用 `NL = "\n"` 常量），例如：

```python
NL = "\n"
sep = f"---{NL}"
plan = state.get("plan") or ""
report = state.get("report") or ""

system_content = f"""{UI_AGENT_SYSTEM_PROMPT}

## Current State

### Page Info
{state.get("pageInfo","")}{state.get("pageAccessibility","")}

### Existing Plan
{(sep + plan[:8000] + NL + "---") if plan else "(none)"}

### Existing Report
{(sep + report[:8000] + NL + "---") if report else "(none)"}
"""
```

另外你们在 `llm_step` 里 append assistant message 的那行也被写坏了（`"...ontent"` 这种会直接语法/运行错误），应当是：

```python
state["messages"].append({
  "role": "assistant",
  "content": getattr(msg, "content", "") or "",
  "tool_calls": getattr(msg, "tool_calls", None)
})
```

> 这俩不修，你后面做任何自愈/鲁棒都发挥不了。

---

## 1）目标 1：自然语言输入 → 自动操作浏览器 → 自动验证 → 输出报告

### 1.1 你需要把“自然语言”分两条路径（你们 prompt 里已经这么设计了）

* **直接操作模式**：用户说“点击登录按钮/输入 admin”等 → 直接产出 tool calls 执行
* **计划/报告模式**：用户说“分析页面/生成计划/执行测试/生成报告”等 → 先生成 plan，再跑 executor，最后写 report

你们的 `/api/ui_agent` 已经把 `plan/report/headless` 放进 state 并返回给前端，所以“自然语言驱动”这部分只差把 plan 的结构规范化 + executor 做扎实。

### 1.2 建议你在 UI 自动化里引入一个**可执行 DSL（Plan JSON）**

别让 LLM 每一步都“自由发挥”，而是让它输出到固定结构：

```json
{
  "meta": { "name": "Login Smoke", "baseUrl": "https://xxx" },
  "steps": [
    { "id": "1", "action": "navigate", "url": "/login" },
    { "id": "2", "action": "fill", "target": { "by": "role", "role": "textbox", "name": "Email" }, "value": "a@b.com" },
    { "id": "3", "action": "fill", "target": { "by": "label", "text": "Password" }, "value": "123456" },
    { "id": "4", "action": "click", "target": { "by": "role", "role": "button", "name": "Sign in" } },
    { "id": "5", "assert": { "type": "url_contains", "value": "/dashboard" } }
  ]
}
```

LLM 的职责变成：

* 自然语言 → DSL
* DSL 执行中失败 → 基于可观测信息（页面文本/无障碍树/截图）生成“修复后的 locator 或改写 step”
  而不是让它“直接写 Playwright 脚本”。

### 1.3 Executor（执行器）只做三件事

1. **定位（Locator）**：尽量语义化（role/label/text），最后才 CSS
2. **操作（Action）**：带等待/重试/截图
3. **断言（Assert）**：可重复、可诊断

你们工具层已经支持 `browser_action` 的 click/fill/navigate/get_content/screenshot/evaluate 等，建议把执行器写成一个“确定性模块”，LLM 只负责生成/修复 DSL。

---

## 2）目标 2：上传测试计划 → 自动执行（并能回填 plan/report）

你们接口已经支持把 `plan/report` 作为字符串透传给后端，也有 `update_ui_document(plan|report)` 工具用来“生成或更新 UI 自动化文档”。

落地建议：

### 2.1 前端上传“测试计划”的两种形态

* **Markdown 计划**（最友好）：用户上传/粘贴一段 Markdown（你右侧文档区就能存）
* **结构化计划**（推荐内部）：JSON DSL（上面那种）

### 2.2 后端处理逻辑

* 如果传入的是 Markdown：先走一次 LLM “Markdown → Plan JSON DSL”
* 如果传入的是 JSON：直接执行
* 执行完：生成 Markdown report，并通过 `update_ui_document(doc_type="report")` 回填

你现在的 `/api/ui_agent` 已经会把最终 `finalPlan/finalReport` 返回给前端，只要你把“plan JSON ↔ Markdown”的转换约定好，就能形成闭环。

---

## 3）目标 3：有代码实现 UI 自动化，并具备自愈性与鲁棒性（关键）

### 3.1 自愈的本质：**定位自愈 + 步骤自愈**

#### A. 定位自愈（Locator healing）

优先级建议：

1. `get_by_role(role, name=...)`（最稳）
2. `get_by_label(text)` / `get_by_placeholder(text)`
3. `get_by_text(text)`（注意严格匹配/模糊匹配策略）
4. CSS（最后手段）
5. **fallback：从 Accessibility Snapshot 做语义检索**（你们已经在 connect_browser 里拿到了 snapshot 并拼到 state 里）

#### B. 步骤自愈（Step healing）

当某一步失败，别立刻整个 case fail：

* 先采集证据：截图、页面 URL、无障碍树、关键 DOM 文本
* 分类失败原因：元素不可见 / 被遮挡 / selector 失效 / 页面未稳定 / 新开 tab / 权限弹窗
* 让 LLM **只输出“修复后的 locator 或补充的等待/滚动/关闭弹窗动作”**，再重试 1~2 次

### 3.2 鲁棒性清单（你可以直接做成工程规范）

**每一步默认包裹：**

* `wait_for_load_state("domcontentloaded")`（你们已有类似逻辑）
* 对 click/fill：`locator.wait_for(state="visible")` + `scroll_into_view_if_needed()`
* 失败就：

  * screenshot（工具里已支持 screenshot）
  * 抽取 accessibility snapshot / page content（你们已设计“页面分析”能力）
  * 走 healing

---

## 4）给你一份“可直接抄”的 Python 代码骨架（Playwright + 自愈）

下面是**独立执行器**（你可以挂到 LangGraph 的 tool_step 里，或单独做 runner）。

```python
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Optional, Literal, Dict, List
import time

from playwright.sync_api import Page, TimeoutError as PwTimeout

By = Literal["role", "label", "text", "css"]

@dataclass
class Target:
    by: By
    # role
    role: Optional[str] = None
    name: Optional[str] = None
    # label/text
    text: Optional[str] = None
    # css
    selector: Optional[str] = None

@dataclass
class Step:
    id: str
    action: Literal["navigate", "click", "fill", "hover", "select", "assert"]
    url: Optional[str] = None
    target: Optional[Target] = None
    value: Optional[str] = None
    assert_type: Optional[Literal["url_contains", "text_visible"]] = None
    assert_value: Optional[str] = None

class UiRunner:
    def __init__(self, page: Page):
        self.page = page

    def _locate(self, t: Target):
        if t.by == "role":
            return self.page.get_by_role(t.role, name=t.name)
        if t.by == "label":
            return self.page.get_by_label(t.text)
        if t.by == "text":
            return self.page.get_by_text(t.text, exact=True)
        if t.by == "css":
            return self.page.locator(t.selector)
        raise ValueError(f"Unknown target.by={t.by}")

    def _safe_action(self, fn, *, retries=2, step_id=""):
        last_err = None
        for attempt in range(retries + 1):
            try:
                self.page.wait_for_load_state("domcontentloaded", timeout=8000)
                return fn()
            except Exception as e:
                last_err = e
                # 采证据：截图+URL
                try:
                    self.page.screenshot(path=f"./artifacts/fail_{step_id}_{attempt}.png", full_page=True)
                except Exception:
                    pass
                time.sleep(0.5)
        raise last_err

    def run_step(self, s: Step):
        if s.action == "navigate":
            assert s.url
            return self._safe_action(lambda: self.page.goto(s.url, wait_until="domcontentloaded"), step_id=s.id)

        if s.action in ("click", "hover"):
            loc = self._locate(s.target)
            def op():
                loc.wait_for(state="visible", timeout=10000)
                loc.scroll_into_view_if_needed()
                return loc.click(timeout=10000) if s.action == "click" else loc.hover(timeout=10000)
            return self._safe_action(op, step_id=s.id)

        if s.action in ("fill", "select"):
            loc = self._locate(s.target)
            val = s.value or ""
            def op():
                loc.wait_for(state="visible", timeout=10000)
                loc.scroll_into_view_if_needed()
                return loc.fill(val, timeout=10000) if s.action == "fill" else loc.select_option(val, timeout=10000)
            return self._safe_action(op, step_id=s.id)

        if s.action == "assert":
            if s.assert_type == "url_contains":
                assert s.assert_value
                if s.assert_value not in self.page.url:
                    raise AssertionError(f"URL assert failed: {self.page.url} not contains {s.assert_value}")
                return "OK"
            if s.assert_type == "text_visible":
                assert s.assert_value
                loc = self.page.get_by_text(s.assert_value, exact=False)
                loc.wait_for(state="visible", timeout=10000)
                return "OK"
            raise ValueError("Unknown assert")

        raise ValueError(f"Unknown action: {s.action}")
```

**怎么接入你们现有架构：**

* `/api/ui_agent` 已经创建 state 并 invoke graph
* 你在 `tool_step` 里拿到 `page` 后，调用 `UiRunner(page).run_step(...)`
* 失败就走“healing node”（下一节）

---

## 5）把“自愈”接进 LangGraph（推荐的图结构）

你们当前图大概是：`connect_browser -> build_prompt -> llm_step -> (tool_step -> llm_step)* -> finalize`
建议升级成：

1. `analyze_page`（拿 content + accessibility snapshot）
2. `plan_or_direct`（LLM 决定：生成 plan 还是直接执行一步）
3. `execute_step`
4. `validate_step`
5. `heal`（仅当失败：让 LLM 输出“修复后的 locator/补充动作”，然后回到 execute）
6. `report`

这样“自愈”不会污染主对话，而且每一步都有可追溯的证据链（截图/错误/修复历史）。

---

## 6）运行方式（有头/无头）与你们当前约定一致

* 有头模式通过 CDP 连本机 Chrome `localhost:9222`，README 也写了要用 `--remote-debugging-port=9222` 启动
* 环境准备 `playwright install chromium`
* API 调用示例（带 `params.headless`）

---

## 你下一步最值得做的 5 件事（按 ROI 排序）

1. **修 `ui_graph.py` 两个硬错误**（不然跑不起来）
2. 定义并落地 **Plan JSON DSL**（让执行器确定性、可回放）
3. 把 executor 抽成独立模块（上面 UiRunner），工具调用只做桥接
4. 加入 **healing node**：失败→采证据→只修 locator/补动作→重试
5. 把 report 标准化：每一步（成功/失败/重试/修复）都写进 Markdown，通过 `update_ui_document(report)` 回填

---

如果你愿意，我可以直接按你们现有代码结构（`tooling.py` 的 tool schema、`ui_graph.py` 的节点）把：

* **Plan DSL 的 JSON Schema**
* **Markdown 计划→DSL 的提示词**
* **heal 节点的提示词（只修 locator，不乱改 plan）**
* **失败分类 + 重试策略**
  整套补齐成可以直接贴进仓库的版本。你只要告诉我：你们现在主要测的是“网页应用”还是“Chrome 插件 sidepanel/页面注入”两类之一即可。
