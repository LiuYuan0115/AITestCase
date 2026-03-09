"""
无代码 UI 自动化 - 流程执行引擎

核心功能：
1. FlowConfig -> Plan JSON 转换
2. 复用现有 UiRunner 执行
3. 插件上下文自动检测（chrome-extension 优先，回退 iframe）
4. 变量替换
5. 结果收集
"""

from __future__ import annotations

import json
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from agent_app.flow.schemas import (
    FlowConfig,
    FlowResult,
    FlowResultSummary,
    FlowStatus,
    StepResult,
    StepStatus,
    TestStep,
    ActionType,
    SelectorType,
    TargetType,
    Screenshot,
    ErrorInfo,
)
from agent_app.ui.runner import UiRunner, Plan, Step, Target, parse_plan_json
from agent_app.ui.screenshots import upload_screenshot, get_screenshot_dir


class FlowExecutor:
    """
    FlowConfig 执行器
    
    设计原则：
    - 复用现有 UiRunner，不重复造轮子
    - FlowConfig 转换为 Plan JSON 格式执行
    - 支持 page/plugin 上下文自动切换
    """
    
    def __init__(
        self,
        page: Any,
        flow_config: Dict[str, Any],
        variables: Dict[str, str],
        options: Optional[Dict[str, Any]] = None,
    ):
        self.page = page
        self.flow = flow_config
        self.variables = variables
        self.options = options or {}
        
        # 合并执行选项
        flow_options = self.flow.get("options", {})
        self.headless = self.options.get("headless", flow_options.get("headless", False))
        self.max_retries = self.options.get("maxRetries", flow_options.get("maxRetries", 2))
        self.auto_screenshot = self.options.get("autoScreenshot", flow_options.get("autoScreenshot", True))
        self.auto_heal = self.options.get("autoHeal", flow_options.get("autoHeal", True))
        self.step_timeout = self.options.get("stepTimeout", flow_options.get("stepTimeout", 10000))
        self.flow_timeout = self.options.get("flowTimeout", flow_options.get("flowTimeout", 120000))
        
        # 创建 UiRunner
        self.runner = UiRunner(
            page=page,
            headless=self.headless,
            max_retries=self.max_retries,
        )
        
        # 任务 ID
        self.task_id = f"flow_{uuid.uuid4().hex[:12]}"
        
        # 结果收集
        self.step_results: List[StepResult] = []
        self.screenshots: List[Screenshot] = []
        self.errors: List[ErrorInfo] = []
        
        # 插件上下文缓存：(page, frame_locator) 元组
        self._plugin_context_cache: Optional[Tuple[Any, Any]] = None
    
    def _replace_variables(self, text: str) -> str:
        """变量替换：{{varName}} -> 实际值"""
        if not text:
            return text
        
        def replacer(match):
            var_name = match.group(1)
            return str(self.variables.get(var_name, match.group(0)))
        
        return re.sub(r'\{\{(\w+)\}\}', replacer, text)
    
    def _ensure_sidebar_open(self, page: Any, max_wait_seconds: int = 5) -> bool:
        """
        确保 Solvely 侧栏已打开

        检测逻辑（基于开发提供的信息）：
        1. 检查 html 元素的 CSS 变量 --solvely-sidebar-width
           - 打开时：html.style 包含 "--solvely-sidebar-width: 376px"
           - 关闭时：CSS 变量不存在或为空
        2. 如果侧栏关闭，点击 [data-testid="home"] 浮动按钮
        3. 等待 CSS 变量出现，确认侧栏已打开

        返回: True 表示侧栏已打开，False 表示无法打开
        """
        try:
            # 方法1：通过 CSS 变量检测侧栏状态（最可靠）
            sidebar_width = page.evaluate("""
                () => {
                    const html = document.documentElement;
                    return html.style.getPropertyValue('--solvely-sidebar-width');
                }
            """)

            if sidebar_width:
                print(f"[FlowExecutor] Sidebar already open (CSS variable: {sidebar_width})")
                return True

            # 方法2：回退到检查 iframe（兼容性检测）
            frames = page.frames
            for frame in frames:
                frame_url = frame.url or ""
                if 'sidepanel.html' in frame_url and frame_url.startswith('chrome-extension://'):
                    print(f"[FlowExecutor] Sidebar already open (iframe detected)")
                    return True

            print(f"[FlowExecutor] Sidebar closed, attempting to open...")

            # 点击浮动 Home 按钮打开侧栏（使用 data-testid）
            # Playwright 的 get_by_test_id() 会自动穿透 open Shadow DOM
            try:
                home_button = page.get_by_test_id('home')
                if home_button.count() > 0:
                    print(f"[FlowExecutor] Found home button [data-testid='home'], clicking...")
                    home_button.first.click(timeout=2000)

                    # 点击后等待页面加载（侧栏动画 + iframe 加载）
                    print(f"[FlowExecutor] Waiting for page to load after click...")
                    time.sleep(1.0)  # 等待侧栏打开动画（0.3s）+ iframe 加载
                else:
                    print(f"[FlowExecutor] Home button not found, sidebar may need manual opening")
                    return False
            except Exception as e:
                print(f"[FlowExecutor] Failed to click home button: {e}")
                return False

            # 等待 CSS 变量出现（最多等待 max_wait_seconds 秒）
            print(f"[FlowExecutor] Checking if sidebar opened (CSS variable)...")
            start_time = time.time()
            while time.time() - start_time < max_wait_seconds:
                sidebar_width = page.evaluate("""
                    () => {
                        const html = document.documentElement;
                        return html.style.getPropertyValue('--solvely-sidebar-width');
                    }
                """)

                if sidebar_width:
                    print(f"[FlowExecutor] Sidebar opened successfully! (CSS variable: {sidebar_width})")
                    return True

                time.sleep(0.5)

            print(f"[FlowExecutor] Timeout waiting for sidebar to open")
            return False

        except Exception as e:
            print(f"[FlowExecutor] Error ensuring sidebar open: {e}")
            return False

    def _get_plugin_context(self) -> Tuple[Any, Any]:
        """
        获取插件上下文（自动检测）

        返回: (page, frame) 元组
        - page: 包含 sidepanel 的页面
        - frame: sidepanel 的 Frame 对象（如果是 iframe 嵌入模式）

        插件有两种展示方式：
        1. iframe 嵌入到网页中（通过 Shadow DOM + iframe）
           结构：<solvely-iframe-sidepanel> → #shadow-root → <iframe src="chrome-extension://xxx/sidepanel.html">
        2. chrome-extension:// sidepanel 独立页面

        注意：优先查找嵌入的 iframe（目标插件），而不是当前测试工具的 sidepanel

        新增：自动检测并打开关闭的侧栏
        """
        if self._plugin_context_cache is not None:
            return self._plugin_context_cache

        try:
            context = self.page.context
            pages = context.pages if hasattr(context, 'pages') else []

            # 获取当前页面的 extension ID（用于排除测试工具自身的 sidepanel）
            current_extension_id = None
            try:
                current_url = self.page.url or ""
                if current_url.startswith('chrome-extension://'):
                    current_extension_id = current_url.split('/')[2]
                    print(f"[FlowExecutor] Current extension ID: {current_extension_id}")
            except:
                pass

            # 查找目标页面（非 extension 页面）
            target_page = None
            for p in pages:
                url = p.url or ""
                if not url.startswith('chrome-extension://') and not url.startswith('chrome://'):
                    target_page = p
                    break

            # 如果找到目标页面，先确保侧栏打开
            if target_page:
                print(f"[FlowExecutor] Target page found: {target_page.url[:50]}...")
                self._ensure_sidebar_open(target_page)

            # 方法1（优先级最高）：在非 extension 页面中查找嵌入的 sidepanel iframe
            # 这是目标插件注入到网页中的 iframe
            for p in pages:
                try:
                    url = p.url or ""
                    # 只检查非 extension 页面（真实的网页）
                    if url.startswith('chrome-extension://') or url.startswith('chrome://'):
                        continue

                    frames = p.frames
                    print(f"[FlowExecutor] Checking page {url[:50]}... ({len(frames)} frames)")
                    for frame in frames:
                        frame_url = frame.url or ""
                        if frame_url:
                            print(f"[FlowExecutor]   Frame URL: {frame_url[:80]}")
                        # 查找嵌入的 sidepanel iframe（URL 包含 sidepanel.html）
                        if 'sidepanel.html' in frame_url and frame_url.startswith('chrome-extension://'):
                            print(f"[FlowExecutor] Found embedded sidepanel iframe: {frame_url[:60]}...")
                            self._plugin_context_cache = (p, frame)
                            return self._plugin_context_cache
                except Exception as e:
                    print(f"[FlowExecutor] Error checking frames: {e}")
                    continue

            # 方法2：查找包含 solvely-iframe-sidepanel 元素的页面，使用 frame_locator
            for p in pages:
                try:
                    url = p.url or ""
                    if url.startswith('chrome-extension://') or url.startswith('chrome://'):
                        continue

                    sidepanel = p.locator('solvely-iframe-sidepanel')
                    if sidepanel.count() > 0:
                        print(f"[FlowExecutor] Found embedded sidepanel element on page: {url[:50]}...")
                        # 尝试使用 frame_locator（作为备用方案）
                        frame = p.frame_locator('solvely-iframe-sidepanel iframe')
                        print(f"[FlowExecutor] Created frame_locator for sidepanel iframe (fallback)")
                        self._plugin_context_cache = (p, frame)
                        return self._plugin_context_cache
                except Exception as e:
                    print(f"[FlowExecutor] Error checking page for sidepanel element: {e}")
                    continue

            # 方法3（最低优先级）：查找 chrome-extension:// sidepanel 独立页面
            # 排除当前测试工具自身的 sidepanel
            for p in pages:
                try:
                    url = p.url or ""
                    if url.startswith('chrome-extension://') and 'sidepanel' in url.lower():
                        # 排除当前测试工具的 sidepanel
                        page_extension_id = url.split('/')[2]
                        if current_extension_id and page_extension_id == current_extension_id:
                            print(f"[FlowExecutor] Skipping test tool's own sidepanel: {url[:60]}...")
                            continue

                        print(f"[FlowExecutor] Found standalone sidepanel page: {url[:60]}...")
                        # 独立页面模式，直接在页面上操作，没有 iframe
                        self._plugin_context_cache = (p, None)
                        return self._plugin_context_cache
                except Exception:
                    continue

            # 最终回退到当前页面
            print(f"[FlowExecutor] No plugin context found, using current page")
            self._plugin_context_cache = (self.page, None)
            return self._plugin_context_cache

        except Exception as e:
            print(f"[FlowExecutor] Error detecting plugin context: {e}")
            return (self.page, None)
    
    def _map_action(self, action: str) -> str:
        """将 FlowConfig 的 action 映射到 Plan JSON 的 action"""
        mapping = {
            "navigate": "navigate",
            "click": "click",
            "input": "fill",      # FlowConfig 用 input，Plan JSON 用 fill
            "select": "select",
            "wait": "wait",
            "assert": "assert",
            "screenshot": "screenshot",
            "scroll": "scroll",   # 需要自定义处理
        }
        return mapping.get(action, action)
    
    def _run_step_on_frame(self, frame: Any, plan_step: Step, page: Any) -> Dict[str, Any]:
        """
        在 Frame 或 FrameLocator 上执行步骤
        
        参数:
        - frame: Playwright Frame 对象（通过 page.frames 获取）或 FrameLocator 对象
        - plan_step: 要执行的步骤
        - page: 所在页面（用于截图）
        
        返回: 包含 success, message, evidence 的字典
        
        注意：Frame 和 FrameLocator 都支持 get_by_test_id(), locator() 等方法
        """
        action = plan_step.action
        target = plan_step.target
        
        try:
            # 根据 target 获取 locator
            locator = None
            if target:
                by = target.by
                if by == "testid":
                    locator = frame.get_by_test_id(target.value)
                    print(f"[FlowExecutor] Frame locator: get_by_test_id('{target.value}')")
                elif by == "role":
                    role = target.role or "button"
                    name = target.name
                    if name:
                        locator = frame.get_by_role(role, name=name)
                    else:
                        locator = frame.get_by_role(role)
                    print(f"[FlowExecutor] Frame locator: get_by_role('{role}', name='{name}')")
                elif by == "text":
                    locator = frame.get_by_text(target.value)
                    print(f"[FlowExecutor] Frame locator: get_by_text('{target.value}')")
                elif by == "placeholder":
                    locator = frame.get_by_placeholder(target.value)
                    print(f"[FlowExecutor] Frame locator: get_by_placeholder('{target.value}')")
                elif by == "label":
                    locator = frame.get_by_label(target.value)
                    print(f"[FlowExecutor] Frame locator: get_by_label('{target.value}')")
                else:
                    # CSS 或其他选择器
                    selector_str = target.to_selector()
                    locator = frame.locator(selector_str)
                    print(f"[FlowExecutor] Frame locator: locator('{selector_str}')")
            
            # 执行动作
            if action == "click":
                if locator:
                    # 检查元素数量
                    count = locator.count()
                    print(f"[FlowExecutor] Frame element count: {count}")
                    if count == 0:
                        return {
                            "success": False,
                            "message": f"Element not found in iframe: {target.to_selector() if target else 'no target'}",
                            "evidence": {},
                        }
                    locator.first.click(timeout=self.step_timeout)
                    return {
                        "success": True,
                        "message": "Click successful",
                        "evidence": {},
                    }
            
            elif action == "fill":
                if locator:
                    value = plan_step.value or ""
                    locator.first.fill(value, timeout=self.step_timeout)
                    return {
                        "success": True,
                        "message": f"Fill successful: {value[:20]}...",
                        "evidence": {},
                    }
            
            elif action == "wait":
                wait_time = plan_step.wait_time or 1000
                time.sleep(wait_time / 1000)
                return {
                    "success": True,
                    "message": f"Wait {wait_time}ms",
                    "evidence": {},
                }
            
            elif action == "screenshot":
                # 对页面截图
                screenshot_dir = get_screenshot_dir()
                filename = f"step_{plan_step.id}_{int(time.time()*1000)}.png"
                filepath = f"{screenshot_dir}/{filename}"
                page.screenshot(path=filepath)
                # 上传截图
                screenshot_url = upload_screenshot(filepath)
                return {
                    "success": True,
                    "message": "Screenshot captured",
                    "evidence": {
                        "screenshot": filename,
                        "screenshot_url": screenshot_url,
                    },
                }
            
            else:
                return {
                    "success": False,
                    "message": f"Unsupported action on frame: {action}",
                    "evidence": {},
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": str(e),
                "evidence": {},
            }
    
    def _convert_selector(self, selector: Dict[str, Any]) -> Dict[str, Any]:
        """将 FlowConfig 的 selector 转换为 Plan JSON 的 target"""
        if not selector:
            return {}
        
        sel_type = selector.get("type", "css")
        sel_value = self._replace_variables(selector.get("value", ""))
        
        if sel_type == "ai":
            # AI 描述 -> 智能映射到 role/placeholder/text
            return self._convert_ai_selector(sel_value)
        elif sel_type == "css":
            # 检测 [data-testid="xxx"] 格式，转换为 testid 类型以支持 Shadow DOM 穿透
            testid_match = re.match(r'\[data-testid=["\']([^"\']+)["\']\]', sel_value)
            if testid_match:
                return {"by": "testid", "value": testid_match.group(1)}
            return {"by": "css", "value": sel_value}
        elif sel_type == "xpath":
            return {"by": "xpath", "value": sel_value}
        elif sel_type == "text":
            return {"by": "text", "value": sel_value}
        else:
            return {"by": "css", "value": sel_value}
    
    def _convert_ai_selector(self, description: str) -> Dict[str, Any]:
        """
        将 AI 自然语言描述转换为智能选择器
        
        使用基于规则的映射：
        - "输入框"、"搜索框" → role:textbox
        - "按钮"、"提交" → role:button
        - "链接" → role:link
        - 其他 → text:xxx（尝试按文本匹配）
        """
        if not description:
            return {}
        
        desc_lower = description.lower()
        
        # 输入框类
        if any(kw in description for kw in ["输入框", "输入", "搜索框", "文本框", "编辑框"]):
            # 如果有具体名称，添加 name 属性
            if "用户名" in description:
                return {"by": "role", "role": "textbox", "name": "用户名"}
            elif "密码" in description:
                return {"by": "role", "role": "textbox", "name": "密码"}
            elif "邮箱" in description or "email" in desc_lower:
                return {"by": "role", "role": "textbox", "name": "邮箱"}
            elif "搜索" in description:
                return {"by": "role", "role": "searchbox"}
            else:
                return {"by": "role", "role": "textbox"}
        
        # 按钮类
        if any(kw in description for kw in ["按钮", "提交", "确认", "登录", "注册", "搜索", "发送"]):
            # 提取按钮名称
            for name in ["登录", "注册", "提交", "确认", "搜索", "发送", "保存", "取消", "下一步", "开始"]:
                if name in description:
                    return {"by": "role", "role": "button", "name": name}
            return {"by": "role", "role": "button"}
        
        # 链接类
        if any(kw in description for kw in ["链接", "跳转", "点击进入"]):
            return {"by": "role", "role": "link"}
        
        # 复选框
        if any(kw in description for kw in ["复选框", "勾选", "多选"]):
            return {"by": "role", "role": "checkbox"}
        
        # 单选框
        if any(kw in description for kw in ["单选", "单选框"]):
            return {"by": "role", "role": "radio"}
        
        # 下拉框
        if any(kw in description for kw in ["下拉", "选择框", "下拉框", "选择"]):
            return {"by": "role", "role": "combobox"}
        
        # 标签页/选项卡
        if any(kw in description for kw in ["标签页", "选项卡", "tab"]):
            return {"by": "role", "role": "tab"}
        
        # 图片
        if any(kw in description for kw in ["图片", "图像", "图标"]):
            return {"by": "role", "role": "img"}
        
        # 默认：按文本匹配
        return {"by": "text", "value": description}
    
    def _convert_params(self, params: Dict[str, Any], action: str) -> Dict[str, Any]:
        """将 FlowConfig 的 params 转换为 Plan JSON 的参数"""
        result = {}
        
        if not params:
            return result
        
        # 输入值
        if "value" in params:
            value = self._replace_variables(params["value"])
            if action == "navigate":
                result["url"] = value
            elif action in ("input", "fill"):
                result["value"] = value
            elif action == "select":
                result["value"] = value
        
        # 等待时间
        if "timeout" in params:
            result["wait_time"] = params["timeout"]
        
        # 等待条件
        if "waitFor" in params:
            result["assert_type"] = f"element_{params['waitFor']}"
        
        # 滚动参数
        if "direction" in params:
            result["direction"] = params["direction"]
        if "distance" in params:
            result["distance"] = params["distance"]
        
        return result
    
    def convert_to_plan_json(self) -> Dict[str, Any]:
        """
        将 FlowConfig 转换为现有 Plan JSON 格式
        
        返回：可被 parse_plan_json() 解析的 JSON dict
        """
        steps = []
        
        for step_config in self.flow.get("steps", []):
            # 跳过禁用的步骤
            if not step_config.get("enabled", True):
                continue
            
            step_id = step_config.get("id", f"step_{len(steps)}")
            action = step_config.get("action", "click")
            
            plan_step: Dict[str, Any] = {
                "id": step_id,
                "action": self._map_action(action),
                "step_name": step_config.get("name", ""),
            }
            
            # 处理选择器
            selector = step_config.get("selector")
            if selector:
                plan_step["target"] = self._convert_selector(selector)
            
            # 处理参数
            params = step_config.get("params", {})
            plan_step.update(self._convert_params(params, action))
            
            # 处理 navigate 特殊情况
            if action == "navigate" and params.get("value"):
                plan_step["url"] = self._replace_variables(params["value"])
            
            # 标记插件上下文
            if step_config.get("target") == "plugin":
                plan_step["_plugin_context"] = True
            
            steps.append(plan_step)
        
        return {
            "name": self.flow.get("name", "Flow Test"),
            "baseUrl": None,  # FlowConfig 通过 navigate 步骤设置 URL
            "steps": steps,
        }
    
    def _execute_step_with_context(self, step_config: Dict[str, Any], plan_step: Step) -> StepResult:
        """
        执行单个步骤（处理上下文切换）

        插件侧边栏结构（Solvely Browser Extension）：
        <solvely-iframe-sidepanel>
          └─ #shadow-root (open)
               └─ <iframe src="...">  ← sidepanel 内容在 iframe 中
        
        需要使用 frame_locator 穿透 Shadow DOM 并进入 iframe
        """
        start_time = time.time()
        step_id = step_config.get("id", "unknown")
        step_name = step_config.get("name", "Unknown Step")

        try:
            # 检查是否需要切换到插件上下文
            target = step_config.get("target", "page")
            
            # 获取选择器信息用于日志
            selector_info = ""
            if plan_step.target:
                selector_info = plan_step.target.to_selector()

            if target == "plugin":
                # 获取插件上下文：(page, frame_locator) 元组
                plugin_page, frame = self._get_plugin_context()
                print(f"[FlowExecutor] Step {step_id}: using plugin context (page: {plugin_page.url[:60]}...), selector: {selector_info}, has_frame: {frame is not None}")

                if frame:
                    # iframe 嵌入模式：使用 frame_locator 在 iframe 内执行
                    print(f"[FlowExecutor] Step {step_id}: executing on iframe via frame_locator")
                    frame_result = self._run_step_on_frame(frame, plan_step, plugin_page)
                    
                    # 构造与 runner.run_step 兼容的结果对象
                    class FrameStepResult:
                        def __init__(self, data):
                            self.success = data.get("success", False)
                            self.message = data.get("message", "")
                            self.evidence = data.get("evidence", {})
                            self.screenshot = data.get("evidence", {}).get("screenshot_url", "")
                            self.retry_count = 0
                    
                    result = FrameStepResult(frame_result)
                else:
                    # 独立 sidepanel 页面模式：使用 runner
                    print(f"[FlowExecutor] Step {step_id}: executing on standalone sidepanel page")
                    
                    # 调试：查找元素实际位置
                    try:
                        # 等待 Vue 应用渲染完成
                        plugin_page.wait_for_selector('#app > *', timeout=5000)
                        print(f"[FlowExecutor] DEBUG: Vue app rendered")

                        # 打印完整 HTML（保存到文件）
                        body_html = plugin_page.locator('body').inner_html()
                        debug_file = "/tmp/sidepanel_debug.html"
                        with open(debug_file, 'w', encoding='utf-8') as f:
                            f.write(body_html)
                        print(f"[FlowExecutor] DEBUG: Full HTML saved to {debug_file}")

                        # 搜索所有 data-testid 属性
                        all_testids = plugin_page.locator('[data-testid]').all()
                        print(f"[FlowExecutor] DEBUG: Found {len(all_testids)} elements with data-testid")
                        testid_list = []
                        for elem in all_testids[:20]:  # 只打印前 20 个
                            try:
                                testid = elem.get_attribute('data-testid')
                                testid_list.append(testid)
                            except:
                                pass
                        print(f"[FlowExecutor] DEBUG: Available data-testid values: {testid_list}")

                        # 搜索包含 "account" 的元素
                        account_elements = plugin_page.get_by_text('account', exact=False).all()
                        print(f"[FlowExecutor] DEBUG: Elements containing 'account': {len(account_elements)}")

                        # 检查目标元素
                        css_count = plugin_page.locator('[data-testid="account"]').count()
                        print(f"[FlowExecutor] DEBUG: [data-testid='account'] count: {css_count}")
                    except Exception as debug_e:
                        print(f"[FlowExecutor] DEBUG error: {debug_e}")
                    
                    original_page = self.runner.page
                    self.runner.page = plugin_page
                    try:
                        result = self.runner.run_step(plan_step)
                    finally:
                        self.runner.page = original_page
            else:
                # 使用主页面
                print(f"[FlowExecutor] Step {step_id}: using main page, selector: {selector_info}")
                result = self.runner.run_step(plan_step)
            
            duration = int((time.time() - start_time) * 1000)
            
            # 提取截图 URL（优先使用 evidence 中的 screenshot_url）
            screenshot_url = None
            if result.evidence:
                screenshot_url = result.evidence.get("screenshot_url")
            if not screenshot_url and hasattr(result, 'screenshot') and result.screenshot and result.screenshot.startswith("http"):
                screenshot_url = result.screenshot
            
            # 如果有截图 URL，添加到 screenshots 列表
            if screenshot_url:
                # 从 evidence 中获取文件名，如果没有则使用默认值
                filename = ""
                if result.evidence:
                    filename = result.evidence.get("screenshot", "") or ""
                self.screenshots.append(Screenshot(
                    filename=filename,
                    stepId=step_id,
                    url=screenshot_url,
                    timestamp=int(time.time() * 1000),  # 毫秒时间戳
                ))
            
            # 转换结果
            retry_count = getattr(result, 'retry_count', 0)
            return StepResult(
                stepId=step_id,
                stepName=step_name,
                status=StepStatus.PASSED if result.success else StepStatus.FAILED,
                duration=duration,
                screenshotUrl=screenshot_url,
                error=result.message if not result.success else None,
                retryCount=retry_count,
            )
            
        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            # 记录错误
            self.errors.append(ErrorInfo(
                stepId=step_id,
                type=type(e).__name__,
                message=error_msg,
            ))
            
            return StepResult(
                stepId=step_id,
                stepName=step_name,
                status=StepStatus.FAILED,
                duration=duration,
                error=error_msg,
            )
    
    def execute(self) -> FlowResult:
        """
        执行完整流程
        
        返回：FlowResult
        """
        start_time = datetime.now()
        start_ts = time.time()
        
        try:
            # 转换为 Plan JSON
            plan_json = self.convert_to_plan_json()
            
            # 遍历执行每个步骤
            step_configs = self.flow.get("steps", [])
            plan_steps = plan_json.get("steps", [])
            
            # 创建 Step 对象列表
            parsed_plan = parse_plan_json(json.dumps(plan_json, ensure_ascii=False))
            
            for i, step_config in enumerate(step_configs):
                # 跳过禁用的步骤
                if not step_config.get("enabled", True):
                    self.step_results.append(StepResult(
                        stepId=step_config.get("id", f"step_{i}"),
                        stepName=step_config.get("name", ""),
                        status=StepStatus.SKIPPED,
                        duration=0,
                    ))
                    continue
                
                # 找到对应的 Plan Step
                plan_step = None
                for ps in parsed_plan.steps:
                    if ps.id == step_config.get("id"):
                        plan_step = ps
                        break
                
                if not plan_step:
                    # 如果找不到对应的 plan step，跳过
                    continue
                
                # 执行步骤
                result = self._execute_step_with_context(step_config, plan_step)
                self.step_results.append(result)
                
                # 检查是否需要终止
                on_error = step_config.get("onError", "fail")
                if result.status == StepStatus.FAILED and on_error == "fail":
                    break
            
            # 计算统计
            passed = sum(1 for r in self.step_results if r.status == StepStatus.PASSED)
            failed = sum(1 for r in self.step_results if r.status == StepStatus.FAILED)
            skipped = sum(1 for r in self.step_results if r.status == StepStatus.SKIPPED)
            total = len(self.step_results)
            
            # 确定最终状态
            if failed == 0:
                status = FlowStatus.SUCCESS
            elif passed > 0:
                status = FlowStatus.PARTIAL
            else:
                status = FlowStatus.FAILED
            
            end_time = datetime.now()
            duration = int((time.time() - start_ts) * 1000)
            
            return FlowResult(
                flowId=self.flow.get("id", "unknown"),
                taskId=self.task_id,
                status=status,
                startTime=start_time.isoformat(),
                endTime=end_time.isoformat(),
                duration=duration,
                steps=self.step_results,
                summary=FlowResultSummary(
                    total=total,
                    passed=passed,
                    failed=failed,
                    skipped=skipped,
                ),
                screenshots=self.screenshots,
                errors=self.errors,
            )
            
        except Exception as e:
            end_time = datetime.now()
            duration = int((time.time() - start_ts) * 1000)
            
            self.errors.append(ErrorInfo(
                stepId="executor",
                type=type(e).__name__,
                message=str(e),
            ))
            
            return FlowResult(
                flowId=self.flow.get("id", "unknown"),
                taskId=self.task_id,
                status=FlowStatus.FAILED,
                startTime=start_time.isoformat(),
                endTime=end_time.isoformat(),
                duration=duration,
                steps=self.step_results,
                summary=FlowResultSummary(
                    total=len(self.step_results),
                    passed=sum(1 for r in self.step_results if r.status == StepStatus.PASSED),
                    failed=sum(1 for r in self.step_results if r.status == StepStatus.FAILED) + 1,
                    skipped=sum(1 for r in self.step_results if r.status == StepStatus.SKIPPED),
                ),
                screenshots=self.screenshots,
                errors=self.errors,
            )


async def execute_flow_async(
    page: Any,
    flow_config: Dict[str, Any],
    variables: Dict[str, str],
    options: Optional[Dict[str, Any]] = None,
) -> FlowResult:
    """
    异步执行流程（便于 API 调用）
    """
    executor = FlowExecutor(page, flow_config, variables, options)
    return executor.execute()
