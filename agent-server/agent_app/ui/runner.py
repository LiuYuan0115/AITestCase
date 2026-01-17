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

from agent_app.ui.browser_helpers import (
    smart_locate_element, 
    assert_element, 
    collect_evidence,
    safe_locate_single,
    execute_with_navigation_handling,
    wait_for_page_stable,
    disable_animations,
    clear_accessibility_cache,
    ui_log,
)
from agent_app.ui.screenshots import get_screenshot_dir


# ==================== 错误分类（智能重试） ====================

# 不可恢复错误：直接失败，进入自愈逻辑，不浪费重试次数
NON_RECOVERABLE_ERRORS = [
    "no elements found",
    "strict mode violation", 
    "multiple elements",
    "selector is required",
    "url is required",
    "target is required",
    "script is required",
    "file_path is required",
    "unknown action",
]

def _is_recoverable_error(error_msg: str) -> bool:
    """
    判断错误是否可恢复（值得重试）
    
    可恢复错误：元素暂不可见、被遮挡、偶发 detach、超时等
    不可恢复错误：选择器根本不对、缺少必要参数等
    """
    error_lower = error_msg.lower()
    for pattern in NON_RECOVERABLE_ERRORS:
        if pattern in error_lower:
            return False
    return True


# ==================== 数据结构定义 ====================

TargetBy = Literal[
    "role", "label", "text", "placeholder", "testid", "id", "extid", "aria", "name",
    "title", "alt", "href", "value", "type", "class", "data", "xpath", "css"
]
ActionType = Literal["navigate", "click", "fill", "hover", "select", "assert", "wait", "screenshot", "evaluate", "upload", "go_back", "switch_tab", "close_tab"]
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
        elif self.by == "id":
            # 原生 id 属性
            return f"id:{self.value}"
        elif self.by == "extid":
            # data-ext-id 属性（插件专用）
            return f"extid:{self.value}"
        elif self.by == "aria":
            return f"aria:{self.value}"
        elif self.by == "label":
            return f"label:{self.value}"
        elif self.by == "placeholder":
            return f"placeholder:{self.value}"
        elif self.by == "name":
            # HTML name 属性
            return f"name:{self.value}"
        elif self.by == "title":
            return f"title:{self.value}"
        elif self.by == "alt":
            return f"alt:{self.value}"
        elif self.by == "href":
            return f"href:{self.value}"
        elif self.by == "value":
            return f"value:{self.value}"
        elif self.by == "type":
            return f"type:{self.value}"
        elif self.by == "class":
            return f"class:{self.value}"
        elif self.by == "data":
            return f"data:{self.value}"
        elif self.by == "xpath":
            return f"xpath:{self.value}"
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
    # click/fill/hover/select/assert(element)/upload
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
    # upload
    file_path: Optional[str] = None
    # switch_tab
    tab_index: int = 0
    tab_url: Optional[str] = None  # 通过 URL 匹配切换 tab（支持部分匹配）


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

        # 所有步骤详情（包含截图）
        md += "\n## 步骤详情\n\n"
        for r in self.results:
            status_icon = "✅" if r.success else "❌"
            md += f"### {status_icon} 步骤 {r.step_id}\n\n"
            md += f"- **结果**: {r.message}\n"
            if r.evidence:
                md += f"- **页面 URL**: {r.evidence.get('url', 'N/A')}\n"
            
            # 渲染截图（优先使用 URL，其次使用 evidence 中的 screenshot_url）
            screenshot_url = None
            if r.evidence and r.evidence.get("screenshot_url"):
                screenshot_url = r.evidence.get("screenshot_url")
            elif r.screenshot and r.screenshot.startswith("http"):
                screenshot_url = r.screenshot
            
            if screenshot_url:
                md += f"\n**截图**:\n\n![步骤截图]({screenshot_url})\n"
            elif r.screenshot:
                md += f"- **截图文件**: {r.screenshot}\n"
            md += "\n---\n\n"

        return md


# ==================== 执行器 ====================

class UiRunner:
    """UI 自动化执行器"""

    def __init__(self, page: Any, headless: bool = False, max_retries: int = 2):
        self.page = page
        self.headless = headless
        self.max_retries = max_retries
        self.screenshot_dir = get_screenshot_dir()
        # 记录初始页面 URL，用于 switch_tab index=0 时优先匹配回初始页面
        self._initial_url: str = ""
        try:
            self._initial_url = page.url if page else ""
        except Exception:
            pass

    def run_step(self, step: Step) -> StepResult:
        """执行单个步骤（带自愈）
        
        优化：按操作类型差异化等待
        - navigate/goto: 在 _execute_action 内部等待 domcontentloaded
        - click: 通过 execute_with_navigation_handling 自动处理导航
        - fill/hover/select: 不等 load_state，仅等元素 stable（Playwright 自带）
        """
        last_error = None
        retry_count = 0
        screenshot = None
        
        # 只有这些步骤类型需要截图（优化性能）
        needs_screenshot = step.action in ("assert", "screenshot")

        for attempt in range(self.max_retries + 1):
            try:
                # 优化：移除通用的 wait_for_load_state，按操作类型在 _execute_action 内部处理
                result = self._execute_action(step)
                if result["success"]:
                    # 只有 assert/screenshot 步骤才采集证据（包括截图）
                    if needs_screenshot:
                        evidence = collect_evidence(self.page, self.screenshot_dir, step.step_name or step.id)
                        return StepResult(
                            step_id=step.id,
                            success=True,
                            message=result["message"],
                            screenshot=evidence.get("screenshot"),
                            retry_count=retry_count,
                            evidence=evidence
                        )
                    else:
                        # 其他步骤不截图，直接返回
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
                error_msg = str(e)

                # 智能重试：仅对可恢复错误重试，不可恢复错误直接跳出
                if not _is_recoverable_error(error_msg):
                    # 不可恢复错误，直接进入自愈逻辑，不浪费重试次数
                    break
                
                # 可恢复错误：仅在最后一次重试前等待（减少不必要的等待）
                if attempt < self.max_retries:
                    # 短暂等待让页面稳定（从500ms减少到200ms）
                    try:
                        self.page.wait_for_timeout(200)
                    except Exception:
                        pass

        # 所有重试都失败，采集证据（仅在最终失败时截图，不在每次重试时截图）
        evidence = collect_evidence(self.page, self.screenshot_dir, step.step_name or step.id, full_page=False)
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
        import time as _time

        # navigate
        if step.action == "navigate":
            _start = _time.time()
            if not step.url:
                return {"success": False, "message": "Error: url is required for navigate"}
            self.page.goto(step.url, wait_until="domcontentloaded", timeout=30000)
            # 优化：禁用动画以加速后续操作
            disable_animations(self.page)
            # 优化：清空 accessibility 缓存（URL 变化后需要重新获取）
            clear_accessibility_cache()
            # 优化：移除固定的 1000ms 等待，改为短暂等待让页面初始渲染完成
            if not self.headless:
                self.page.wait_for_timeout(200)
            _duration_ms = (_time.time() - _start) * 1000
            ui_log("info", "runner_action_done", step_id=step.id, action="navigate", duration_ms=_duration_ms, url=step.url)
            return {"success": True, "message": f"Navigated to {step.url}"}

        # click
        elif step.action == "click":
            _start = _time.time()
            
            if not step.target:
                return {"success": False, "message": "Error: target is required for click"}
            selector = step.target.to_selector()
            
            # 使用 safe_locate_single 替代直接定位
            locate_result = safe_locate_single(self.page, selector)
            locator = locate_result.locator
            if locate_result.warning:
                ui_log(
                    "warning",
                    "runner_locate_multiple",
                    step_id=step.id,
                    action="click",
                    selector=selector,
                    url=getattr(self.page, "url", ""),
                    count=locate_result.count,
                    selected_index=locate_result.selected_index,
                    candidates=locate_result.candidates_summary,
                )
            if locate_result.count == 0:
                ui_log("warning", "runner_locate_none", step_id=step.id, action="click", selector=selector, url=getattr(self.page, "url", ""))
                return {"success": False, "message": f"Error: No elements found for {selector}"}
            
            # 【优化】先检查是否可见，避免长时间等待
            is_visible = False
            try:
                is_visible = locator.is_visible()
            except Exception:
                pass
            
            if not is_visible:
                locator.wait_for(state="visible", timeout=4000)
            
            # 【增强】对于 button 元素，等待它变成 enabled 状态
            # 解决上传文件后按钮从 disabled 变成 enabled 的延迟问题
            try:
                tag = locator.evaluate("el => el.tagName.toLowerCase()")
                if tag == "button":
                    is_enabled = locator.is_enabled()
                    if not is_enabled:
                        # 等待按钮启用，最多 5 秒
                        ui_log("info", "runner_wait_button_enabled", step_id=step.id, selector=selector)
                        locator.wait_for(state="enabled", timeout=5000)
            except Exception:
                pass
            
            try:
                locator.scroll_into_view_if_needed(timeout=1500)
            except Exception:
                pass
            if not self.headless:
                try:
                    locator.highlight()
                    self.page.wait_for_timeout(50)  # 从 100ms 减到 50ms
                except Exception:
                    pass
            
            # 使用统一导航处理器
            context = None
            try:
                context = self.page.context
            except Exception:
                pass
            
            nav_result = execute_with_navigation_handling(
                page=self.page,
                action_fn=lambda: locator.click(timeout=8000),  # 从 15s 减到 8s
                context=context,
                timeout_ms=2000  # 从 3s 减到 2s
            )
            
            _duration_ms = (_time.time() - _start) * 1000
            ui_log(
                "info",
                "runner_action_done",
                step_id=step.id,
                action="click",
                selector=selector,
                duration_ms=_duration_ms,
                url_before=nav_result.url_before,
                url_after=nav_result.url_after,
                navigation_occurred=nav_result.navigation_occurred,
                new_page=bool(nav_result.new_page),
                message=nav_result.message,
            )
            
            if nav_result.new_page:
                # 接管新页面
                self.page = nav_result.new_page
                # 优化：禁用动画 + 清空缓存
                disable_animations(self.page)
                clear_accessibility_cache()
                return {"success": True, "message": f"Clicked {selector} (new tab: {nav_result.url_after})"}
            elif nav_result.navigation_occurred:
                # 优化：禁用动画 + 清空缓存
                disable_animations(self.page)
                clear_accessibility_cache()
                return {"success": True, "message": f"Clicked {selector} (navigated to: {nav_result.url_after})"}
            else:
                # 优化：移除固定的 500ms 等待
                return {"success": True, "message": f"Clicked {selector}"}

        # fill
        elif step.action == "fill":
            if not step.target:
                return {"success": False, "message": "Error: target is required for fill"}
            selector = step.target.to_selector()
            
            # 使用 safe_locate_single
            locate_result = safe_locate_single(self.page, selector)
            locator = locate_result.locator
            if locate_result.warning:
                ui_log(
                    "warning",
                    "runner_locate_multiple",
                    step_id=step.id,
                    action="fill",
                    selector=selector,
                    url=getattr(self.page, "url", ""),
                    count=locate_result.count,
                    selected_index=locate_result.selected_index,
                    candidates=locate_result.candidates_summary,
                )
            if locate_result.count == 0:
                ui_log("warning", "runner_locate_none", step_id=step.id, action="fill", selector=selector, url=getattr(self.page, "url", ""))
                return {"success": False, "message": f"Error: No elements found for {selector}"}
            
            locator.wait_for(state="visible", timeout=10000)
            try:
                locator.scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass
            if not self.headless:
                try:
                    locator.highlight()
                    # 优化：减少高亮等待时间（从 300ms 减少到 100ms）
                    self.page.wait_for_timeout(100)
                except Exception:
                    pass
            
            # fill 可能触发表单自动提交
            context = None
            try:
                context = self.page.context
            except Exception:
                pass
            
            fill_value = step.value or ""
            nav_result = execute_with_navigation_handling(
                page=self.page,
                action_fn=lambda: locator.fill(fill_value, timeout=15000),
                context=context,
                timeout_ms=2000
            )
            ui_log(
                "info",
                "runner_action_done",
                step_id=step.id,
                action="fill",
                selector=selector,
                url_before=nav_result.url_before,
                url_after=nav_result.url_after,
                navigation_occurred=nav_result.navigation_occurred,
                new_page=bool(nav_result.new_page),
                message=nav_result.message,
            )
            
            if nav_result.new_page:
                self.page = nav_result.new_page
                # 优化：禁用动画 + 清空缓存
                disable_animations(self.page)
                clear_accessibility_cache()
                return {"success": True, "message": f"Filled {selector} with '{step.value}' (new tab)"}
            elif nav_result.navigation_occurred:
                # 优化：禁用动画 + 清空缓存
                disable_animations(self.page)
                clear_accessibility_cache()
                return {"success": True, "message": f"Filled {selector} with '{step.value}' (navigated)"}
            else:
                # 优化：移除固定的 300ms 等待
                return {"success": True, "message": f"Filled {selector} with '{step.value}'"}

        # hover
        elif step.action == "hover":
            _start = _time.time()
            
            if not step.target:
                return {"success": False, "message": "Error: target is required for hover"}
            selector = step.target.to_selector()
            
            # 使用 safe_locate_single
            locate_result = safe_locate_single(self.page, selector)
            locator = locate_result.locator
            if locate_result.count == 0:
                ui_log("warning", "runner_locate_none", step_id=step.id, action="hover", selector=selector, url=getattr(self.page, "url", ""))
            elif locate_result.count > 1 and locate_result.warning:
                ui_log(
                    "warning",
                    "runner_locate_multiple",
                    step_id=step.id,
                    action="hover",
                    selector=selector,
                    url=getattr(self.page, "url", ""),
                    count=locate_result.count,
                    selected_index=locate_result.selected_index,
                    candidates=locate_result.candidates_summary,
                )
            
            # 【优化】先检查元素是否已经可见，避免不必要的等待
            is_visible = False
            try:
                is_visible = locator.is_visible()
            except Exception:
                pass
            
            if not is_visible:
                # 元素不可见，尝试短暂等待
                try:
                    locator.wait_for(state="visible", timeout=1500)
                    is_visible = True
                except Exception:
                    # 可能是 SVG 等特殊元素，尝试 attached
                    try:
                        locator.wait_for(state="attached", timeout=800)
                    except Exception:
                        pass
            
            # 滚动到视图（短超时）
            try:
                locator.scroll_into_view_if_needed(timeout=1000)
            except Exception:
                pass
            
            # hover 也可能触发菜单导航
            context = None
            try:
                context = self.page.context
            except Exception:
                pass
            
            # 【优化】直接用 force=True，避免两次尝试
            def do_hover():
                locator.hover(timeout=2000, force=True)
            
            nav_result = execute_with_navigation_handling(
                page=self.page,
                action_fn=do_hover,
                context=context,
                timeout_ms=1000  # 缩短导航等待
            )
            
            _duration_ms = (_time.time() - _start) * 1000
            ui_log(
                "info",
                "runner_action_done",
                step_id=step.id,
                action="hover",
                selector=selector,
                duration_ms=_duration_ms,
                url_before=nav_result.url_before,
                url_after=nav_result.url_after,
                navigation_occurred=nav_result.navigation_occurred,
                new_page=bool(nav_result.new_page),
                message=nav_result.message,
            )
            
            if nav_result.new_page:
                self.page = nav_result.new_page
            
            return {"success": True, "message": f"Hovered {selector}"}

        # select
        elif step.action == "select":
            if not step.target:
                return {"success": False, "message": "Error: target is required for select"}
            selector = step.target.to_selector()
            
            # 使用 safe_locate_single
            locate_result = safe_locate_single(self.page, selector)
            locator = locate_result.locator
            if locate_result.warning:
                ui_log(
                    "warning",
                    "runner_locate_multiple",
                    step_id=step.id,
                    action="select",
                    selector=selector,
                    url=getattr(self.page, "url", ""),
                    count=locate_result.count,
                    selected_index=locate_result.selected_index,
                    candidates=locate_result.candidates_summary,
                )
            if locate_result.count == 0:
                ui_log("warning", "runner_locate_none", step_id=step.id, action="select", selector=selector, url=getattr(self.page, "url", ""))
                return {"success": False, "message": f"Error: No elements found for {selector}"}
            
            locator.wait_for(state="visible", timeout=10000)
            
            # select 可能触发导航
            context = None
            try:
                context = self.page.context
            except Exception:
                pass
            
            select_value = step.value or ""
            nav_result = execute_with_navigation_handling(
                page=self.page,
                action_fn=lambda: locator.select_option(select_value, timeout=10000),
                context=context,
                timeout_ms=2000
            )
            ui_log(
                "info",
                "runner_action_done",
                step_id=step.id,
                action="select",
                selector=selector,
                url_before=nav_result.url_before,
                url_after=nav_result.url_after,
                navigation_occurred=nav_result.navigation_occurred,
                new_page=bool(nav_result.new_page),
                message=nav_result.message,
            )
            
            if nav_result.new_page:
                self.page = nav_result.new_page
            
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
            # 使用增强的等待策略
            wait_for_page_stable(
                self.page, 
                timeout_ms=5000, 
                network_idle_timeout=2000,
                dom_settle_ms=300
            )
            
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

        # upload
        elif step.action == "upload":
            _start = _time.time()
            file_path_arg = step.file_path or step.value or ""
            if not file_path_arg:
                return {"success": False, "message": "Error: file_path is required for upload"}
            
            # 支持多文件上传（逗号分隔）
            file_paths = [p.strip() for p in file_path_arg.split(",") if p.strip()]
            files_to_upload = file_paths if len(file_paths) > 1 else file_paths[0]
            
            # 策略1：先尝试找页面上的 input[type=file]，直接设置文件（最可靠）
            file_inputs = self.page.locator("input[type='file']")
            file_input_count = file_inputs.count()
            
            if file_input_count > 0:
                if step.target:
                    selector = step.target.to_selector()
                    locator = smart_locate_element(self.page, selector)
                    
                    # 检查 selector 本身是否是 file input
                    try:
                        tag_name = locator.evaluate("el => el.tagName.toLowerCase()")
                        input_type = locator.evaluate("el => el.type || ''")
                        if tag_name == "input" and input_type == "file":
                            locator.set_input_files(files_to_upload)
                            _duration_ms = (_time.time() - _start) * 1000
                            ui_log("info", "runner_action_done", step_id=step.id, action="upload", duration_ms=_duration_ms, file_count=len(file_paths), target=selector)
                            return {"success": True, "message": f"Uploaded {len(file_paths)} file(s) to {selector}"}
                    except Exception:
                        pass
                    
                    # 尝试在 selector 元素内部找 file input
                    try:
                        nested_input = locator.locator("input[type='file']").first
                        if nested_input.count() > 0:
                            nested_input.set_input_files(files_to_upload)
                            _duration_ms = (_time.time() - _start) * 1000
                            ui_log("info", "runner_action_done", step_id=step.id, action="upload", duration_ms=_duration_ms, file_count=len(file_paths), target="nested_input")
                            return {"success": True, "message": f"Uploaded {len(file_paths)} file(s) to nested input"}
                    except Exception:
                        pass
                
                # 直接使用第一个 file input
                file_inputs.first.set_input_files(files_to_upload)
                _duration_ms = (_time.time() - _start) * 1000
                ui_log("info", "runner_action_done", step_id=step.id, action="upload", duration_ms=_duration_ms, file_count=len(file_paths), target="file_input")
                return {"success": True, "message": f"Uploaded {len(file_paths)} file(s) to file input"}
            
            # 策略2：没有 file input，使用 file chooser（会弹窗）
            if step.target:
                selector = step.target.to_selector()
                locator = smart_locate_element(self.page, selector)
                locator.wait_for(state="visible", timeout=10000)
                
                with self.page.expect_file_chooser(timeout=10000) as fc_info:
                    locator.click(timeout=10000)
                file_chooser = fc_info.value
                file_chooser.set_files(files_to_upload)
                _duration_ms = (_time.time() - _start) * 1000
                ui_log("info", "runner_action_done", step_id=step.id, action="upload", duration_ms=_duration_ms, file_count=len(file_paths), target=selector, method="file_chooser")
                return {"success": True, "message": f"Uploaded {len(file_paths)} file(s) via file chooser"}
            
            return {"success": False, "message": "No file input found and no target provided"}

        # go_back - 浏览器后退
        elif step.action == "go_back":
            self.page.go_back(wait_until="domcontentloaded", timeout=30000)
            # 优化：禁用动画
            disable_animations(self.page)
            # 优化：清空 accessibility 缓存
            clear_accessibility_cache()
            # 优化：移除固定的 500ms 等待
            return {"success": True, "message": f"Navigated back to {self.page.url}"}

        # switch_tab - 通过 page.context.pages 切换 tab
        elif step.action == "switch_tab":
            _start = _time.time()
            try:
                # 获取同上下文的所有 pages
                all_pages = self.page.context.pages
                if not all_pages:
                    return {"success": False, "message": "No tabs available in context"}
                
                target_page = None
                match_info = ""
                
                # 优先通过 URL 匹配（支持部分匹配）
                if step.tab_url:
                    for p in all_pages:
                        try:
                            if step.tab_url in p.url:
                                target_page = p
                                match_info = f"url contains '{step.tab_url}'"
                                break
                        except Exception:
                            continue
                    
                    if not target_page:
                        # 列出所有可用 tab 的 URL 帮助调试
                        available_urls = [p.url for p in all_pages]
                        return {"success": False, "message": f"No tab found matching URL '{step.tab_url}'. Available: {available_urls}"}
                else:
                    # 通过索引切换
                    tab_index = step.tab_index
                    
                    # 【增强】当 tab_index=0 且有 _initial_url 时，优先匹配初始页面
                    # 这避免了多个 chrome-extension:// sidepanel 时选错 tab 的问题
                    if tab_index == 0 and self._initial_url:
                        initial_ext_id = ""
                        if self._initial_url.startswith("chrome-extension://"):
                            parts = self._initial_url.split("/")
                            if len(parts) > 2:
                                initial_ext_id = parts[2]
                        
                        # 收集所有页面的 URL 用于调试
                        all_urls = []
                        for p in all_pages:
                            try:
                                p_url = p.url or ""
                                all_urls.append(p_url)
                                
                                # 精确匹配
                                if p_url == self._initial_url:
                                    target_page = p
                                    match_info = "initial_url exact match"
                                    break
                                
                                # extension ID 匹配（更宽松）
                                if initial_ext_id and p_url.startswith(f"chrome-extension://{initial_ext_id}/"):
                                    target_page = p
                                    match_info = f"initial_url extension match ({initial_ext_id})"
                                    break
                            except Exception as e:
                                all_urls.append(f"<error: {e}>")
                                continue
                        
                        # 如果没找到，记录警告
                        if not target_page:
                            ui_log(
                                "warning",
                                "switch_tab_initial_url_not_found",
                                step_id=step.id,
                                initial_url=self._initial_url,
                                initial_ext_id=initial_ext_id,
                                all_urls=all_urls,
                            )
                    
                    # 如果没有通过 _initial_url 匹配到，使用原来的 index 逻辑
                    if not target_page:
                        # 支持负数索引（-1 表示最后一个 tab）
                        if tab_index < 0:
                            tab_index = len(all_pages) + tab_index
                        
                        if tab_index < 0 or tab_index >= len(all_pages):
                            return {"success": False, "message": f"Invalid tab_index: {step.tab_index} (total tabs: {len(all_pages)})"}
                        
                        target_page = all_pages[tab_index]
                        match_info = f"index {tab_index}"
                
                target_page.bring_to_front()
                self.page = target_page  # 更新当前 page 引用
                # 优化：清空 accessibility 缓存（切换页面后需要重新获取）
                clear_accessibility_cache()
                # 日志记录
                _duration_ms = (_time.time() - _start) * 1000
                ui_log(
                    "info",
                    "runner_switch_tab",
                    step_id=step.id,
                    duration_ms=_duration_ms,
                    match_info=match_info,
                    target_url=target_page.url,
                    initial_url=self._initial_url,
                    available_tabs=len(all_pages),
                )
                return {"success": True, "message": f"Switched to tab ({match_info}): {target_page.url}"}
            except Exception as e:
                return {"success": False, "message": f"switch_tab failed: {str(e)}"}

        # close_tab - 关闭当前 tab，切换到剩余的 tab
        elif step.action == "close_tab":
            try:
                all_pages = self.page.context.pages
                current_url = self.page.url
                self.page.close()
                
                # 获取剩余的 pages
                remaining_pages = [p for p in all_pages if not p.is_closed()]
                
                if remaining_pages:
                    new_page = remaining_pages[0]
                    new_page.bring_to_front()
                    self.page = new_page
                    # 优化：清空 accessibility 缓存
                    clear_accessibility_cache()
                    # 优化：移除固定的 500ms 等待
                    return {"success": True, "message": f"Closed tab ({current_url}), switched to: {new_page.url}"}
                else:
                    return {"success": True, "message": f"Closed tab ({current_url}), no remaining tabs"}
            except Exception as e:
                return {"success": False, "message": f"close_tab failed: {str(e)}"}

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
            # 记录初始 URL，用于 switch_tab index=0 时优先匹配回初始页面
            try:
                self._initial_url = self.page.url
            except Exception:
                self._initial_url = plan.base_url

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
            script=s.get("script"),
            file_path=s.get("file_path"),
            tab_index=s.get("tab_index", 0),
            tab_url=s.get("tab_url")
        )
        steps.append(step)

    return Plan(
        name=data.get("name") or data.get("meta", {}).get("name", "Unnamed Plan"),
        base_url=data.get("baseUrl") or data.get("base_url") or data.get("meta", {}).get("baseUrl"),
        steps=steps
    )

