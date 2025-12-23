"""
UI 自动化执行器：独立的 Playwright 执行模块

支持：
- 结构化 Plan DSL 执行
- 自愈（定位自愈 + 步骤自愈）
- 证据采集（截图、URL、页面文本）
- 可重放、可追溯
"""

from __future__ import annotations

import os
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from agent_app.ui.browser_helpers import smart_locate_element, assert_element, collect_evidence
from agent_app.ui.screenshots import get_screenshot_dir


# ==================== 数据结构定义 ====================

TargetBy = Literal["role", "label", "text", "placeholder", "testid", "extid", "aria", "css"]
ActionType = Literal["navigate", "click", "fill", "hover", "select", "assert", "wait", "screenshot", "evaluate"]
AssertType = Literal["url_contains", "url_equals", "text_visible", "element_visible", "element_hidden", "element_count"]


@dataclass
class Target:
    """元素定位目标"""
    by: TargetBy
    # role 定位
    role: Optional[str] = None
    name: Optional[str] = None
    exact: bool = False
    # text/label/placeholder/testid/extid/aria/css 定位
    value: Optional[str] = None

    def to_selector(self) -> str:
        """转换为 smart_locate_element 可识别的选择器字符串"""
        if self.by == "role":
            selector = f"role:{self.role}"
            if self.name:
                selector += f",name:{self.name}"
            if self.exact:
                selector += ",exact:true"
            return selector
        elif self.by == "testid":
            return f"testid:{self.value}"
        elif self.by == "extid":
            return f"extid:{self.value}"
        elif self.by == "aria":
            return f"aria:{self.value}"
        elif self.by == "label":
            return f"label:{self.value}"
        elif self.by == "placeholder":
            return f"placeholder:{self.value}"
        elif self.by == "text":
            return f"text:{self.value}"
        elif self.by == "css":
            return self.value or ""
        return self.value or ""


@dataclass
class Step:
    """测试步骤"""
    id: str
    action: ActionType
    # navigate
    url: Optional[str] = None
    # click/fill/hover/select/assert(element)
    target: Optional[Target] = None
    # fill/select
    value: Optional[str] = None
    # assert
    assert_type: Optional[AssertType] = None
    assert_value: Optional[str] = None
    # wait
    wait_time: int = 1000
    # screenshot
    step_name: Optional[str] = None
    # evaluate
    script: Optional[str] = None


@dataclass
class StepResult:
    """步骤执行结果"""
    step_id: str
    success: bool
    message: str
    screenshot: Optional[str] = None
    retry_count: int = 0
    evidence: Optional[Dict[str, Any]] = None


@dataclass
class Plan:
    """测试计划"""
    name: str
    base_url: Optional[str] = None
    steps: List[Step] = field(default_factory=list)


@dataclass
class Report:
    """测试报告"""
    plan_name: str
    started_at: str
    finished_at: str
    total_steps: int
    passed_steps: int
    failed_steps: int
    results: List[StepResult] = field(default_factory=list)

    def to_markdown(self) -> str:
        """转换为 Markdown 格式"""
        status = "✅ 通过" if self.failed_steps == 0 else "❌ 失败"
        md = f"""# UI 自动化测试报告

## 概要
- **测试计划**: {self.plan_name}
- **状态**: {status}
- **开始时间**: {self.started_at}
- **结束时间**: {self.finished_at}
- **总步骤**: {self.total_steps}
- **通过**: {self.passed_steps}
- **失败**: {self.failed_steps}

## 详细结果

| 步骤 | 状态 | 消息 | 重试次数 |
|------|------|------|----------|
"""
        for r in self.results:
            status_icon = "✅" if r.success else "❌"
            msg = r.message[:50] + "..." if len(r.message) > 50 else r.message
            md += f"| {r.step_id} | {status_icon} | {msg} | {r.retry_count} |\n"

        # 失败步骤详情
        failed = [r for r in self.results if not r.success]
        if failed:
            md += "\n## 失败步骤详情\n\n"
            for r in failed:
                md += f"### 步骤 {r.step_id}\n\n"
                md += f"- **错误信息**: {r.message}\n"
                if r.screenshot:
                    md += f"- **截图**: {r.screenshot}\n"
                if r.evidence:
                    md += f"- **URL**: {r.evidence.get('url', 'N/A')}\n"
                md += "\n"

        return md


# ==================== 执行器 ====================

class UiRunner:
    """UI 自动化执行器"""

    def __init__(self, page: Any, headless: bool = False, max_retries: int = 2):
        self.page = page
        self.headless = headless
        self.max_retries = max_retries
        self.screenshot_dir = get_screenshot_dir()

    def run_step(self, step: Step) -> StepResult:
        """执行单个步骤（带自愈）"""
        last_error = None
        retry_count = 0
        screenshot = None

        for attempt in range(self.max_retries + 1):
            try:
                # 等待页面稳定
                try:
                    self.page.wait_for_load_state("domcontentloaded", timeout=5000)
                except Exception:
                    pass

                result = self._execute_action(step)
                if result["success"]:
                    return StepResult(
                        step_id=step.id,
                        success=True,
                        message=result["message"],
                        retry_count=retry_count
                    )
                else:
                    raise Exception(result["message"])

            except Exception as e:
                last_error = e
                retry_count = attempt

                # 采集证据
                if attempt < self.max_retries:
                    evidence = collect_evidence(self.page, self.screenshot_dir, step.step_name or step.id)
                    screenshot = evidence.get("screenshot")
                    # 等待后重试
                    self.page.wait_for_timeout(500)

        # 所有重试都失败
        evidence = collect_evidence(self.page, self.screenshot_dir, step.step_name or step.id)
        return StepResult(
            step_id=step.id,
            success=False,
            message=str(last_error),
            screenshot=evidence.get("screenshot"),
            retry_count=retry_count,
            evidence=evidence
        )

    def _execute_action(self, step: Step) -> Dict[str, Any]:
        """执行具体操作"""

        # navigate
        if step.action == "navigate":
            if not step.url:
                return {"success": False, "message": "Error: url is required for navigate"}
            self.page.goto(step.url, wait_until="domcontentloaded", timeout=30000)
            self.page.wait_for_timeout(1000)
            return {"success": True, "message": f"Navigated to {step.url}"}

        # click
        elif step.action == "click":
            if not step.target:
                return {"success": False, "message": "Error: target is required for click"}
            selector = step.target.to_selector()
            locator = smart_locate_element(self.page, selector)
            locator.wait_for(state="visible", timeout=10000)
            try:
                locator.scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass
            if not self.headless:
                try:
                    locator.highlight()
                    self.page.wait_for_timeout(300)
                except Exception:
                    pass
            locator.click(timeout=15000)
            if not self.headless:
                self.page.wait_for_timeout(500)
            return {"success": True, "message": f"Clicked {selector}"}

        # fill
        elif step.action == "fill":
            if not step.target:
                return {"success": False, "message": "Error: target is required for fill"}
            selector = step.target.to_selector()
            locator = smart_locate_element(self.page, selector)
            locator.wait_for(state="visible", timeout=10000)
            try:
                locator.scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass
            if not self.headless:
                try:
                    locator.highlight()
                    self.page.wait_for_timeout(300)
                except Exception:
                    pass
            locator.fill(step.value or "", timeout=15000)
            if not self.headless:
                self.page.wait_for_timeout(300)
            return {"success": True, "message": f"Filled {selector} with '{step.value}'"}

        # hover
        elif step.action == "hover":
            if not step.target:
                return {"success": False, "message": "Error: target is required for hover"}
            selector = step.target.to_selector()
            locator = smart_locate_element(self.page, selector)
            locator.wait_for(state="visible", timeout=10000)
            locator.hover(timeout=10000)
            return {"success": True, "message": f"Hovered {selector}"}

        # select
        elif step.action == "select":
            if not step.target:
                return {"success": False, "message": "Error: target is required for select"}
            selector = step.target.to_selector()
            locator = smart_locate_element(self.page, selector)
            locator.wait_for(state="visible", timeout=10000)
            locator.select_option(step.value or "", timeout=10000)
            return {"success": True, "message": f"Selected {step.value} in {selector}"}

        # assert
        elif step.action == "assert":
            target_selector = step.target.to_selector() if step.target else ""
            return assert_element(
                self.page,
                step.assert_type or "text_visible",
                target_selector,
                step.assert_value or step.value or ""
            )

        # wait
        elif step.action == "wait":
            self.page.wait_for_timeout(step.wait_time)
            return {"success": True, "message": f"Waited {step.wait_time}ms"}

        # screenshot
        elif step.action == "screenshot":
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            step_name_safe = (step.step_name or step.id).replace(" ", "_").replace("/", "_")[:30]
            filename = f"{step_name_safe}_{timestamp}.png"
            filepath = os.path.join(self.screenshot_dir, filename)
            self.page.screenshot(path=filepath, full_page=False)
            return {"success": True, "message": f"Screenshot saved: {filename}"}

        # evaluate
        elif step.action == "evaluate":
            if not step.script:
                return {"success": False, "message": "Error: script is required for evaluate"}
            result = self.page.evaluate(step.script)
            return {"success": True, "message": f"Evaluated: {str(result)[:200]}"}

        return {"success": False, "message": f"Unknown action: {step.action}"}

    def run_plan(self, plan: Plan) -> Report:
        """执行完整测试计划"""
        started_at = datetime.now().isoformat()
        results: List[StepResult] = []

        # 如果有 base_url，先导航
        if plan.base_url:
            nav_step = Step(id="0-base", action="navigate", url=plan.base_url)
            nav_result = self.run_step(nav_step)
            results.append(nav_result)
            if not nav_result.success:
                # 导航失败，终止执行
                return Report(
                    plan_name=plan.name,
                    started_at=started_at,
                    finished_at=datetime.now().isoformat(),
                    total_steps=len(plan.steps) + 1,
                    passed_steps=0,
                    failed_steps=1,
                    results=results
                )

        # 执行所有步骤
        for step in plan.steps:
            result = self.run_step(step)
            results.append(result)
            # 可选：失败时是否继续？这里选择继续执行

        finished_at = datetime.now().isoformat()
        passed = sum(1 for r in results if r.success)
        failed = len(results) - passed

        return Report(
            plan_name=plan.name,
            started_at=started_at,
            finished_at=finished_at,
            total_steps=len(results),
            passed_steps=passed,
            failed_steps=failed,
            results=results
        )


# ==================== Plan DSL 解析 ====================

def parse_plan_json(json_str: str) -> Plan:
    """从 JSON 字符串解析 Plan"""
    data = json.loads(json_str)
    
    steps: List[Step] = []
    for s in data.get("steps", []):
        target = None
        if s.get("target"):
            t = s["target"]
            target = Target(
                by=t.get("by", "css"),
                role=t.get("role"),
                name=t.get("name"),
                exact=t.get("exact", False),
                value=t.get("value") or t.get("text") or t.get("selector")
            )
        
        step = Step(
            id=s.get("id", str(len(steps) + 1)),
            action=s.get("action", "click"),
            url=s.get("url"),
            target=target,
            value=s.get("value"),
            assert_type=s.get("assert_type"),
            assert_value=s.get("assert_value"),
            wait_time=s.get("wait_time", 1000),
            step_name=s.get("step_name"),
            script=s.get("script")
        )
        steps.append(step)

    return Plan(
        name=data.get("name") or data.get("meta", {}).get("name", "Unnamed Plan"),
        base_url=data.get("baseUrl") or data.get("base_url") or data.get("meta", {}).get("baseUrl"),
        steps=steps
    )

