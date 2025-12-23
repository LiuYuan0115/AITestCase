"""
UI 自动化：浏览器辅助函数（元素定位、自愈、证据采集等）
"""

import json
import os
from datetime import datetime
from typing import Any, Optional, Dict, List


# ==================== 定位优先级（自愈的核心） ====================
# 1. data-testid / data-ext-* (最稳定)
# 2. role + name (语义化)
# 3. label / placeholder
# 4. text (谨慎使用)
# 5. CSS (最后手段)


def smart_locate_element(page: Any, selector_str: str):
    """
    智能元素定位：尝试多种定位策略

    支持：
    - "role:button,name:登录"
    - "text:登录"
    - "placeholder:请输入用户名"
    - "label:用户名"
    - "testid:xxx" (data-testid)
    - "extid:xxx" (data-ext-*)
    - "aria:xxx" (aria-label)
    - CSS 选择器
    """
    selector_str = (selector_str or "").strip()

    # 1. data-testid（最推荐）
    if selector_str.startswith("testid:"):
        testid = selector_str.replace("testid:", "").strip()
        return page.get_by_test_id(testid)

    # 2. data-ext-* (插件专用)
    if selector_str.startswith("extid:"):
        extid = selector_str.replace("extid:", "").strip()
        return page.locator(f"[data-ext-id='{extid}']")

    # 3. role + name（语义化，推荐）
    if selector_str.startswith("role:"):
        parts = selector_str.split(",")
        role = parts[0].replace("role:", "").strip()
        name = None
        exact = False
        for part in parts[1:]:
            p = part.strip()
            if p.startswith("name:"):
                name = p.replace("name:", "").strip()
            if p.startswith("exact:"):
                exact = p.replace("exact:", "").strip().lower() == "true"
        if name:
            return page.get_by_role(role, name=name, exact=exact)
        return page.get_by_role(role)

    # 4. aria-label
    if selector_str.startswith("aria:"):
        aria = selector_str.replace("aria:", "").strip()
        return page.locator(f"[aria-label='{aria}']")

    # 5. text 定位
    if selector_str.startswith("text:"):
        text = selector_str.replace("text:", "").strip()
        exact = False
        if text.endswith(",exact"):
            text = text.replace(",exact", "").strip()
            exact = True
        return page.get_by_text(text, exact=exact)

    # 6. placeholder
    if selector_str.startswith("placeholder:"):
        placeholder = selector_str.replace("placeholder:", "").strip()
        return page.get_by_placeholder(placeholder)

    # 7. label
    if selector_str.startswith("label:"):
        label = selector_str.replace("label:", "").strip()
        return page.get_by_label(label)

    # 8. 看起来像中文文本：优先文本定位
    if any("\u4e00" <= c <= "\u9fff" for c in selector_str) and not selector_str.startswith((".", "#", "[")):
        try:
            locator = page.get_by_text(selector_str)
            if locator.count() > 0:
                return locator.first
        except Exception:
            pass

    # 9. CSS 选择器（最后）
    return page.locator(selector_str)


def safe_action(page: Any, locator: Any, action: str, value: str = "", retries: int = 2, 
                step_name: str = "", screenshot_dir: str = "", headless: bool = False) -> Dict[str, Any]:
    """
    安全执行操作：带等待、滚动、重试、证据采集

    返回：{"success": bool, "message": str, "screenshot": str|None}
    """
    last_error = None
    screenshot_path = None

    for attempt in range(retries + 1):
        try:
            # 等待页面稳定
            try:
                page.wait_for_load_state("domcontentloaded", timeout=5000)
            except Exception:
                pass

            # 等待元素可见
            locator.wait_for(state="visible", timeout=10000)

            # 滚动到视图
            try:
                locator.scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass

            # 有头模式下高亮
            if not headless:
                try:
                    locator.highlight()
                    page.wait_for_timeout(300)
                except Exception:
                    pass

            # 执行操作
            if action == "click":
                locator.click(timeout=15000)
            elif action == "fill":
                locator.fill(value, timeout=15000)
            elif action == "hover":
                locator.hover(timeout=10000)
            elif action == "select":
                locator.select_option(value, timeout=10000)

            # 操作后等待
            if not headless:
                page.wait_for_timeout(500)

            return {"success": True, "message": f"OK: {action} completed", "screenshot": None}

        except Exception as e:
            last_error = e
            # 采集证据：截图
            if screenshot_dir:
                try:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    safe_step = str(step_name or action).replace(" ", "_").replace("/", "_")[:20]
                    filename = f"fail_{safe_step}_{attempt}_{timestamp}.png"
                    screenshot_path = os.path.join(screenshot_dir, filename)
                    page.screenshot(path=screenshot_path, full_page=True)
                except Exception:
                    pass
            
            # 等待后重试
            if attempt < retries:
                page.wait_for_timeout(500)

    # 所有重试都失败
    error_msg = f"Error after {retries + 1} attempts: {str(last_error)}"
    return {"success": False, "message": error_msg, "screenshot": screenshot_path}


def collect_evidence(page: Any, screenshot_dir: str = "", step_name: str = "") -> Dict[str, Any]:
    """
    采集失败证据：截图、URL、页面文本摘要
    """
    evidence = {
        "url": "",
        "title": "",
        "text_snippet": "",
        "screenshot": None,
    }

    try:
        evidence["url"] = page.url
        evidence["title"] = page.title()
    except Exception:
        pass

    try:
        # 获取页面关键文本（前2000字符）
        text = page.inner_text("body")[:2000]
        evidence["text_snippet"] = text
    except Exception:
        pass

    if screenshot_dir:
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_step = str(step_name or "evidence").replace(" ", "_")[:20]
            filename = f"evidence_{safe_step}_{timestamp}.png"
            filepath = os.path.join(screenshot_dir, filename)
            page.screenshot(path=filepath, full_page=True)
            evidence["screenshot"] = filename
        except Exception:
            pass

    return evidence


def assert_element(page: Any, assert_type: str, target: str = "", value: str = "", timeout: int = 10000) -> Dict[str, Any]:
    """
    断言操作

    支持的断言类型：
    - url_contains: URL 包含指定字符串
    - url_equals: URL 等于指定字符串
    - text_visible: 指定文本可见
    - element_visible: 指定元素可见
    - element_count: 元素数量等于指定值
    - element_hidden: 指定元素不可见
    """
    try:
        if assert_type == "url_contains":
            if value not in page.url:
                return {"success": False, "message": f"URL assert failed: '{page.url}' does not contain '{value}'"}
            return {"success": True, "message": f"OK: URL contains '{value}'"}

        elif assert_type == "url_equals":
            if page.url != value:
                return {"success": False, "message": f"URL assert failed: '{page.url}' != '{value}'"}
            return {"success": True, "message": f"OK: URL equals '{value}'"}

        elif assert_type == "text_visible":
            locator = page.get_by_text(value, exact=False)
            locator.wait_for(state="visible", timeout=timeout)
            return {"success": True, "message": f"OK: text '{value}' is visible"}

        elif assert_type == "element_visible":
            locator = smart_locate_element(page, target)
            locator.wait_for(state="visible", timeout=timeout)
            return {"success": True, "message": f"OK: element '{target}' is visible"}

        elif assert_type == "element_hidden":
            locator = smart_locate_element(page, target)
            locator.wait_for(state="hidden", timeout=timeout)
            return {"success": True, "message": f"OK: element '{target}' is hidden"}

        elif assert_type == "element_count":
            locator = smart_locate_element(page, target)
            count = locator.count()
            expected = int(value)
            if count != expected:
                return {"success": False, "message": f"Element count assert failed: got {count}, expected {expected}"}
            return {"success": True, "message": f"OK: element count = {count}"}

        else:
            return {"success": False, "message": f"Unknown assert type: {assert_type}"}

    except Exception as e:
        return {"success": False, "message": f"Assert failed: {str(e)}"}


def locate_target_page(browser: Any, target_url: Optional[str]):
    """定位目标页面"""
    if not target_url:
        return None

    target_clean = target_url.split("#")[0].split("?")[0]
    for context in browser.contexts:
        for page in context.pages:
            if target_clean in page.url:
                try:
                    page.bring_to_front()
                except Exception:
                    pass
                return page
    return None


def build_accessibility_snapshot(page: Any, max_chars: int = 6000) -> str:
    """
    获取 accessibility snapshot，便于模型定位元素（截断以防过长）
    """
    try:
        snapshot = page.accessibility.snapshot()
        if not snapshot:
            return ""
        return json.dumps(snapshot, ensure_ascii=False, indent=2)[:max_chars]
    except Exception:
        return ""


