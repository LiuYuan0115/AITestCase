"""
UI 自动化：浏览器辅助函数（元素定位、自愈、证据采集等）
"""

import json
import os
import re
import time
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Optional, Dict, List, Callable, Tuple
from urllib.parse import urlparse


# ==================== Accessibility Snapshot 缓存 ====================
# 用于减少重复获取 accessibility snapshot 的开销
_accessibility_cache: Dict[str, Tuple[str, float]] = {}
_ACCESSIBILITY_CACHE_TTL = 30.0  # 缓存过期时间（秒）


# ==================== 统一日志 ====================

_ui_logger = logging.getLogger("agent_app.ui")


def _truncate(value: Any, max_len: int = 240) -> Any:
    """截断过长字段，避免日志爆炸。"""
    try:
        s = str(value)
    except Exception:
        return value
    if len(s) <= max_len:
        return value
    return s[:max_len] + "...(truncated)"


def ui_log(level: str, event: str, **fields: Any) -> None:
    """
    统一日志输出（结构化字段）。
    - 添加时间戳，支持耗时显示
    - 更友好的可读格式
    - 若 logging 未配置 handler，则 fallback 到 print
    """
    from datetime import datetime
    
    # 时间戳
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]  # HH:MM:SS.mmm
    
    # 构建 payload
    payload: Dict[str, Any] = {"ts": timestamp, "event": event}
    
    # 耗时字段特殊处理（毫秒）
    duration_ms = fields.pop("duration_ms", None)
    if duration_ms is not None:
        payload["duration"] = f"{int(duration_ms)}ms"
    
    for k, v in (fields or {}).items():
        # 常见字段截断
        if k in {"url", "url_before", "url_after", "selector", "message", "text"}:
            payload[k] = _truncate(v, 200)
        elif k == "candidates":
            # candidates 体积大，限制
            try:
                payload[k] = v[:3]  # type: ignore[index]
            except Exception:
                payload[k] = _truncate(v, 150)
        else:
            payload[k] = _truncate(v, 150)

    # 构建可读格式
    # 格式: [ui_auto HH:MM:SS] EVENT | key=value key=value ...
    level_icon = {"info": "🎀", "warning": "❗️", "error": "❌", "debug": "🧸"}.get(level, "•")
    
    # 简化输出：只显示关键字段
    key_fields = []
    if "step_id" in payload:
        key_fields.append(f"step={payload['step_id']}")
    if "action" in payload:
        key_fields.append(f"action={payload['action']}")
    if "duration" in payload:
        key_fields.append(f"🕰️{payload['duration']}")
    if "selector" in payload:
        sel = payload["selector"]
        if len(sel) > 40:
            sel = sel[:37] + "..."
        key_fields.append(f"sel={sel}")
    if "count" in payload:
        key_fields.append(f"count={payload['count']}")
    if "navigation_occurred" in payload and payload["navigation_occurred"]:
        key_fields.append("🚦 nav")
    if "new_page" in payload and payload["new_page"]:
        key_fields.append("🔗 new_tab")
    if "match_info" in payload:
        key_fields.append(f"match={payload['match_info']}")
    
    # 简洁的可读行
    readable_line = f"[ui_auto {timestamp}] {level_icon} {event}"
    if key_fields:
        readable_line += " | " + " ".join(key_fields)
    
    # JSON 行（用于调试/过滤）
    try:
        json_line = json.dumps(payload, ensure_ascii=False, default=str)
    except Exception:
        json_line = str(payload)

    # 输出：可读行 + 完整 JSON（同一行，用 ║ 分隔，方便 grep）
    full_line = readable_line + " ║ " + json_line

    # 优先走 logging（如果 root 或本 logger 配置过 handler）
    has_handler = bool(_ui_logger.handlers) or bool(logging.getLogger().handlers)
    if has_handler:
        fn = getattr(_ui_logger, level, None)
        if callable(fn):
            fn(full_line)
            return
    # fallback：直接输出到 stdout
    try:
        print(full_line)
    except Exception:
        pass

# ==================== 数据结构定义 ====================

# 非业务 URL scheme 过滤名单
# 注意：chrome-extension:// 在“测试扩展 sidepanel”场景下属于业务页，
# 因此是否排除要由 target_url 的 scheme 决定（见 _is_excluded_url 的 allow_schemes）。
EXCLUDED_URL_SCHEMES = frozenset([
    "about", "chrome", "devtools", "data",
    "javascript", "blob", "file"
])


@dataclass
class ScreenshotInfo:
    """统一截图信息结构"""
    filepath: str  # 完整路径
    filename: str  # 文件名
    url: str  # 截图时的页面 URL
    timestamp: str
    # 关联信息
    step_id: Optional[str] = None
    action: Optional[str] = None
    selector: Optional[str] = None
    url_before: Optional[str] = None
    url_after: Optional[str] = None
    page_id: Optional[str] = None
    context_id: Optional[str] = None
    # 上传后的 URL
    screenshot_url: Optional[str] = None


@dataclass
class LocateResult:
    """元素定位结果"""
    locator: Any  # Playwright Locator
    count: int  # 匹配数量
    selected_index: int  # 选中的索引
    candidates_summary: List[Dict[str, Any]] = field(default_factory=list)  # 候选摘要
    warning: Optional[str] = None


@dataclass 
class ActionResult:
    """操作执行结果（用于导航接管）"""
    success: bool
    new_page: Any = None  # 接管的新页（如有）
    navigation_occurred: bool = False
    url_before: str = ""
    url_after: str = ""
    message: str = ""


@dataclass
class PageScore:
    """页面评分结果"""
    page: Any
    score: int
    match_type: str  # exact, prefix, contains, same_domain, fallback
    context_index: int
    page_index: int


# ==================== 定位优先级（自愈的核心） ====================
# 1. data-testid / data-ext-* (最稳定)
# 2. role + name (语义化)
# 3. label / placeholder
# 4. text (谨慎使用)
# 5. CSS (最后手段)


def _locate_by_prefix(page: Any, selector_str: str):
    """
    根据前缀定位元素（不处理 :nth 和链式筛选）
    """
    selector_str = (selector_str or "").strip()

    # 1. data-testid（最推荐）
    if selector_str.startswith("testid:"):
        testid = selector_str.replace("testid:", "").strip()
        return page.get_by_test_id(testid)

    # 2. 原生 id 属性（常见且稳定）
    if selector_str.startswith("id:"):
        element_id = selector_str.replace("id:", "").strip()
        return page.locator(f"#{element_id}")

    # 3. data-ext-id (插件专用，注意与原生 id 区分)
    if selector_str.startswith("extid:"):
        extid = selector_str.replace("extid:", "").strip()
        return page.locator(f"[data-ext-id='{extid}']")

    # 4. role + name（语义化，推荐）- 注意不要与 ,has: 冲突
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

    # 5. aria-label
    if selector_str.startswith("aria:"):
        aria = selector_str.replace("aria:", "").strip()
        return page.locator(f"[aria-label='{aria}']")

    # 6. text 定位
    if selector_str.startswith("text:"):
        text = selector_str.replace("text:", "").strip()
        exact = False
        if text.endswith(",exact"):
            text = text.replace(",exact", "").strip()
            exact = True
        return page.get_by_text(text, exact=exact)

    # 7. placeholder
    if selector_str.startswith("placeholder:"):
        placeholder = selector_str.replace("placeholder:", "").strip()
        return page.get_by_placeholder(placeholder)

    # 8. label
    if selector_str.startswith("label:"):
        label = selector_str.replace("label:", "").strip()
        return page.get_by_label(label)

    # 9. HTML name 属性（表单元素常用）
    if selector_str.startswith("name:"):
        name_value = selector_str.replace("name:", "").strip()
        return page.locator(f"[name='{name_value}']")

    # 10. title 属性
    if selector_str.startswith("title:"):
        title_value = selector_str.replace("title:", "").strip()
        return page.get_by_title(title_value)

    # 11. alt 属性（图片）
    if selector_str.startswith("alt:"):
        alt_value = selector_str.replace("alt:", "").strip()
        return page.get_by_alt_text(alt_value)

    # 12. href 属性（链接）
    if selector_str.startswith("href:"):
        href_value = selector_str.replace("href:", "").strip()
        return page.locator(f"a[href*='{href_value}']")

    # 13. value 属性（按钮、input 等）
    if selector_str.startswith("value:"):
        val = selector_str.replace("value:", "").strip()
        return page.locator(f"[value='{val}']")

    # 14. type 属性（input 类型）
    if selector_str.startswith("type:"):
        type_value = selector_str.replace("type:", "").strip()
        return page.locator(f"input[type='{type_value}']")

    # 15. class 属性
    if selector_str.startswith("class:"):
        class_value = selector_str.replace("class:", "").strip()
        return page.locator(f".{class_value}")

    # 16. 任意 data-* 属性（如 data:data-foo=bar）
    if selector_str.startswith("data:"):
        data_part = selector_str.replace("data:", "").strip()
        if "=" in data_part:
            attr, val = data_part.split("=", 1)
            return page.locator(f"[{attr}='{val}']")
        else:
            return page.locator(f"[{data_part}]")

    # 17. XPath 选择器
    if selector_str.startswith("xpath:"):
        xpath_value = selector_str.replace("xpath:", "").strip()
        return page.locator(f"xpath={xpath_value}")

    # 18. 看起来像中文文本：优先文本定位
    if any("\u4e00" <= c <= "\u9fff" for c in selector_str) and not selector_str.startswith((".", "#", "[")):
        try:
            locator = page.get_by_text(selector_str)
            if locator.count() > 0:
                return locator.first
        except Exception:
            pass

    # CSS 选择器（最后）
    return page.locator(selector_str)


def _apply_chain_filter(locator: Any, filter_part: str):
    """
    应用链式筛选
    - text:xxx -> filter(has_text=xxx)
    - role:button -> get_by_role
    - 其他 -> 当作 CSS 继续定位
    """
    filter_part = filter_part.strip()
    
    if filter_part.startswith("text:"):
        text_value = filter_part[5:].strip()
        return locator.filter(has_text=text_value)
    elif filter_part.startswith("role:"):
        role_value = filter_part[5:].strip()
        return locator.get_by_role(role_value)
    elif filter_part.startswith("has:"):
        # has:xxx 等价于 filter(has_text=xxx)
        has_text = filter_part[4:].strip()
        return locator.filter(has_text=has_text)
    else:
        # 当作 CSS/XPath 继续定位
        return locator.locator(filter_part)


def safe_locate_single(page: Any, selector: str, prefer_visible: bool = True,
                       max_candidates_check: int = 5) -> LocateResult:
    """
    安全元素定位：规范化 .first 使用，先检查匹配数量
    
    性能兜底策略:
    - 先尝试 strict 定位
    - 只在超时/失败时才执行 count
    - count 设上限（检查前 N 个元素），避免大 DOM 卡死
    
    多匹配排序策略:
    1. is_visible() = True
    2. is_enabled() = True  
    3. bounding_box() 存在（可点击）
    
    参数:
        page: Playwright Page 实例
        selector: 选择器字符串
        prefer_visible: 是否优先选择可见元素
        max_candidates_check: 最多检查的候选元素数量
    
    返回:
        LocateResult 包含选中的 locator、匹配数量、候选摘要等
    """
    locator = smart_locate_element(page, selector)
    
    # 快速路径：尝试直接使用（strict 模式）
    try:
        # 先检查 count，但设置短超时避免阻塞
        count = 0
        try:
            count = locator.count()
        except Exception:
            count = 1  # 无法获取 count 时假设只有一个
        
        if count == 0:
            return LocateResult(
                locator=locator.first,  # 返回空 locator 供后续报错
                count=0,
                selected_index=-1,
                warning="No elements found for selector"
            )
        
        if count == 1:
            return LocateResult(
                locator=locator.first,
                count=1,
                selected_index=0
            )
        
        # 多匹配情况：需要智能选择
        candidates_summary: List[Dict[str, Any]] = []
        best_index = 0
        best_score = -1
        
        # 只检查前 N 个候选，避免性能问题
        check_count = min(count, max_candidates_check)
        
        for i in range(check_count):
            try:
                elem = locator.nth(i)
                score = 0
                elem_info: Dict[str, Any] = {"index": i}
                
                # 检查可见性
                try:
                    is_visible = elem.is_visible()
                    elem_info["visible"] = is_visible
                    if is_visible and prefer_visible:
                        score += 50
                except Exception:
                    elem_info["visible"] = None
                
                # 检查是否启用
                try:
                    is_enabled = elem.is_enabled()
                    elem_info["enabled"] = is_enabled
                    if is_enabled:
                        score += 30
                except Exception:
                    elem_info["enabled"] = None
                
                # 检查是否有 bounding box（可点击）
                try:
                    box = elem.bounding_box()
                    has_box = box is not None
                    elem_info["has_bounding_box"] = has_box
                    if has_box:
                        score += 20
                except Exception:
                    elem_info["has_bounding_box"] = None
                
                # 获取文本内容（用于候选摘要）
                try:
                    text = elem.inner_text(timeout=1000)[:50]
                    elem_info["text"] = text
                except Exception:
                    elem_info["text"] = ""
                
                # 获取角色/标签
                try:
                    tag = elem.evaluate("el => el.tagName.toLowerCase()")
                    elem_info["tag"] = tag
                    # 【优化】当 selector 是 text:XXX 时，优先选择 button/a 等交互元素
                    # 例如：text:Solve 应该优先选择 <button>Solve</button>，而不是 <div>Solvely.ai</div>
                    if tag in ("button", "a", "input"):
                        score += 40  # 交互元素优先
                except Exception:
                    elem_info["tag"] = ""
                
                # 【优化】检查文本是否精确匹配 selector 的文本部分
                # 例如：selector="text:Solve" 时，精确匹配 "Solve" 的元素优先
                if selector.startswith("text:"):
                    target_text = selector.replace("text:", "").strip().lower()
                    try:
                        elem_text = (elem_info.get("text") or "").strip().lower()
                        if elem_text == target_text:
                            score += 60  # 精确文本匹配优先级最高
                        elif elem_text.startswith(target_text) and len(elem_text) < len(target_text) + 5:
                            score += 30  # 近似匹配（如 "Solve " vs "Solve"）
                    except Exception:
                        pass
                
                candidates_summary.append(elem_info)
                
                if score > best_score:
                    best_score = score
                    best_index = i
                    
            except Exception:
                continue
        
        # 生成警告信息
        warning = f"Multiple elements matched ({count}). Selected index {best_index}."
        if candidates_summary:
            warning += f" Candidates: {candidates_summary[:3]}"
        
        return LocateResult(
            locator=locator.nth(best_index),
            count=count,
            selected_index=best_index,
            candidates_summary=candidates_summary,
            warning=warning
        )
        
    except Exception as e:
        # 发生异常时返回 first 作为 fallback
        return LocateResult(
            locator=locator.first,
            count=-1,  # 未知数量
            selected_index=0,
            warning=f"Error during safe locate: {str(e)}"
        )


def execute_with_navigation_handling(
    page: Any,
    action_fn: Callable[[], None],
    context: Any = None,
    timeout_ms: int = 1000,
    wait_for_stable_ms: int = 200,  # 增加到 200ms，给新 tab 更多时间打开
    poll_interval_ms: int = 100,  # 轮询间隔
    max_polls: int = 2  # 最多轮询 2 次检查新 tab（共 300ms）
) -> ActionResult:
    """
    统一 Post-Action 处理器：监听并接管页面跳转/新 Tab
    
    【优化版】使用轮询检测替代阻塞等待：
    1. 记录执行前的页面数量和 URL
    2. 执行操作
    3. 轮询检查是否有新页面（最多 max_polls 次）
    4. 只在检测到变化时才等待稳定
    
    参数:
        page: 当前 Page 实例
        action_fn: 要执行的操作函数
        context: BrowserContext
        timeout_ms: URL 稳定的最大等待时间
        wait_for_stable_ms: 首次等待时间
        poll_interval_ms: 轮询间隔
        max_polls: 最大轮询次数
    
    返回:
        ActionResult 包含执行结果和可能的新页面
    """
    import time as _time
    
    if context is None:
        try:
            context = page.context
        except Exception:
            pass
    
    url_before = ""
    try:
        url_before = page.url
    except Exception:
        pass
    
    # 记录执行前的页面数量和 ID
    pages_before = set()
    if context is not None:
        try:
            for p in context.pages:
                try:
                    # 用页面的内存 ID 作为标识，比 URL 更可靠
                    pages_before.add(id(p))
                except Exception:
                    pass
        except Exception:
            pass
    
    new_page = None
    navigation_occurred = False
    
    try:
        # 执行操作
        action_fn()
        
        # 首次等待
        try:
            page.wait_for_timeout(wait_for_stable_ms)
        except Exception:
            pass
        
        # 轮询检查新页面（解决新 tab 打开延迟的问题）
        if context is not None:
            candidate = None
            for poll in range(max_polls):
                try:
                    pages_after = list(context.pages)
                    # 找出新增的页面（用 id 比较）
                    new_pages = [p for p in pages_after if id(p) not in pages_before]
                    
                    if new_pages:
                        candidate = new_pages[-1]
                        break
                    
                    # 没有新页面，等待后再检查
                    if poll < max_polls - 1:
                        page.wait_for_timeout(poll_interval_ms)
                except Exception:
                    break
            
            if candidate:
                # 等待新页 URL 稳定
                start_time = _time.time()
                last_url = ""
                while (_time.time() - start_time) * 1000 < timeout_ms:
                    try:
                        current_url = candidate.url
                        if current_url and current_url != "about:blank" and current_url == last_url:
                            break
                        last_url = current_url
                        candidate.wait_for_timeout(100)
                    except Exception:
                        break
                
                # 检查新页是否为有效业务页面
                new_url = candidate.url if candidate else ""
                if not _is_excluded_url(new_url, allow_schemes={"http", "https", "chrome-extension"}):
                    new_page = candidate
                    navigation_occurred = True
                    return ActionResult(
                        success=True,
                        new_page=new_page,
                        navigation_occurred=True,
                        url_before=url_before,
                        url_after=new_url,
                        message="New tab/popup opened and captured"
                    )
        
        # 检查 2：URL 是否发生变化（同 tab 导航 或 SPA）
        url_after = ""
        try:
            url_after = page.url
        except Exception:
            pass
        
        if url_after and url_before and url_after != url_before:
            navigation_occurred = True
        
        return ActionResult(
            success=True,
            new_page=None,
            navigation_occurred=navigation_occurred,
            url_before=url_before,
            url_after=url_after,
            message="Action completed" + (" (URL changed)" if navigation_occurred else "")
        )
        
    except Exception as e:
        return ActionResult(
            success=False,
            new_page=None,
            navigation_occurred=False,
            url_before=url_before,
            url_after="",
            message=f"Action failed: {type(e).__name__}: {str(e)}"
        )


def smart_locate_element(page: Any, selector_str: str):
    """
    智能元素定位：尝试多种定位策略

    基础语法：
    - "role:button,name:登录"
    - "text:登录"
    - "placeholder:请输入用户名"
    - "label:用户名"
    - "testid:xxx" (data-testid)
    - "extid:xxx" (data-ext-id，插件专用)
    - "id:xxx" (原生 id 属性)
    - "aria:xxx" (aria-label)
    - CSS 选择器

    多条件筛选（解决 strict mode violation）：
    - "testid:price-plan:nth(2)" - 选择第 3 个匹配元素（0-based）
    - "testid:price-plan >> text:$6.49" - 链式筛选，在结果中按文本过滤
    - "testid:price-plan,has:Yearly" - 筛选包含指定文本的元素
    """
    selector_str = (selector_str or "").strip()
    
    # ========== 1. 解析 :nth(n) 语法 ==========
    nth_match = re.search(r':nth\((\d+)\)$', selector_str)
    nth_index = None
    if nth_match:
        nth_index = int(nth_match.group(1))
        selector_str = selector_str[:nth_match.start()]
    
    # ========== 2. 解析 >> 链式选择器 ==========
    if ' >> ' in selector_str:
        parts = selector_str.split(' >> ')
        # 第一部分可能包含 ,has: 语法，需要先处理
        first_part = parts[0]
        
        # 处理第一部分的 ,has: 语法
        if ',has:' in first_part and not first_part.startswith('role:'):
            base, has_text = first_part.split(',has:', 1)
            locator = _locate_by_prefix(page, base).filter(has_text=has_text)
        else:
            locator = _locate_by_prefix(page, first_part)
        
        # 应用后续链式筛选
        for part in parts[1:]:
            locator = _apply_chain_filter(locator, part)
        
        # 应用 nth
        if nth_index is not None:
            locator = locator.nth(nth_index)
        
        return locator
    
    # ========== 3. 解析 ,has:xxx 筛选语法（非 role: 开头） ==========
    if ',has:' in selector_str and not selector_str.startswith('role:'):
        base, has_text = selector_str.split(',has:', 1)
        locator = _locate_by_prefix(page, base).filter(has_text=has_text)
        
        # 应用 nth
        if nth_index is not None:
            locator = locator.nth(nth_index)
        
        return locator
    
    # ========== 4. 普通选择器 ==========
    locator = _locate_by_prefix(page, selector_str)
    
    # 应用 nth
    if nth_index is not None:
        locator = locator.nth(nth_index)
    
    return locator


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

            # 优化：移除固定的 500ms 等待，仅在非 headless 模式下短暂等待
            if not headless:
                page.wait_for_timeout(100)

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
            
            # 优化：减少重试等待时间（从 500ms 减少到 200ms）
            if attempt < retries:
                page.wait_for_timeout(200)

    # 所有重试都失败
    error_msg = f"Error after {retries + 1} attempts: {str(last_error)}"
    return {"success": False, "message": error_msg, "screenshot": screenshot_path}


def disable_animations(page: Any) -> bool:
    """
    禁用页面动画以加速测试
    
    注入 CSS 禁用所有 transition 和 animation，避免等待动画完成
    对大多数站点（尤其是重前端）可显著提速
    
    返回: 是否成功注入
    """
    try:
        page.add_style_tag(content="""
            *, *::before, *::after {
                transition: none !important;
                animation: none !important;
                animation-duration: 0s !important;
                transition-duration: 0s !important;
                scroll-behavior: auto !important;
            }
        """)
        return True
    except Exception:
        return False


def wait_for_page_stable(
    page: Any, 
    timeout_ms: int = 5000,
    network_idle_timeout: int = 2000,
    dom_settle_ms: int = 300,
    critical_selector: Optional[str] = None
) -> bool:
    """
    等待页面稳定：支持 SPA 场景的可控等待策略
    
    等待优先级：
    1. 如果指定 critical_selector：等待该元素出现
    2. networkidle：最多等 2s，超时不报错，降级
    3. DOM 变化收敛：短时间内 DOM 不再变化
    4. 兜底：固定等待 dom_settle_ms
    
    关键约束：
    - 所有等待都有硬超时，不会无限阻塞
    - networkidle 失败不影响后续执行
    
    参数:
        page: Playwright Page 实例
        timeout_ms: 总超时时间
        network_idle_timeout: networkidle 等待超时（不宜过长，现代站点长连接会卡住）
        dom_settle_ms: DOM 稳定等待时间
        critical_selector: 关键元素选择器（等待出现后视为稳定）
    
    返回:
        是否成功等待到稳定状态
    """
    stable = False
    
    # 1. 如果指定了关键元素，优先等待它出现
    if critical_selector:
        try:
            locator = smart_locate_element(page, critical_selector)
            locator.wait_for(state="visible", timeout=timeout_ms)
            stable = True
            return True
        except Exception:
            # 关键元素未出现，继续其他等待策略
            pass
    
    # 2. 尝试等待网络空闲（设置短超时避免长连接卡死）
    try:
        page.wait_for_load_state("networkidle", timeout=network_idle_timeout)
        stable = True
    except Exception:
        # 网络不空闲（可能有长连接），不阻塞后续
        pass
    
    # 3. 确保 DOM 加载完成
    try:
        page.wait_for_load_state("domcontentloaded", timeout=3000)
        stable = True
    except Exception:
        pass
    
    # 4. DOM 变化收敛检测（使用 MutationObserver）
    try:
        # 使用 JavaScript 检测 DOM 是否在短时间内稳定
        is_dom_stable = page.evaluate("""
            () => {
                return new Promise((resolve) => {
                    let lastChangeTime = Date.now();
                    let checkCount = 0;
                    const maxChecks = 10;
                    const checkInterval = 50;
                    const stableThreshold = 200;
                    
                    const observer = new MutationObserver(() => {
                        lastChangeTime = Date.now();
                    });
                    
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true
                    });
                    
                    const checkStable = () => {
                        checkCount++;
                        const timeSinceLastChange = Date.now() - lastChangeTime;
                        
                        if (timeSinceLastChange >= stableThreshold) {
                            observer.disconnect();
                            resolve(true);
                            return;
                        }
                        
                        if (checkCount >= maxChecks) {
                            observer.disconnect();
                            resolve(false);
                            return;
                        }
                        
                        setTimeout(checkStable, checkInterval);
                    };
                    
                    setTimeout(checkStable, checkInterval);
                });
            }
        """)
        if is_dom_stable:
            stable = True
    except Exception:
        # DOM 检测失败，使用固定等待
        pass
    
    # 5. 兜底：固定等待让动画/渲染完成
    try:
        page.wait_for_timeout(dom_settle_ms)
    except Exception:
        pass
    
    return stable


def wait_for_spa_navigation(
    page: Any,
    expected_url_pattern: Optional[str] = None,
    timeout_ms: int = 5000
) -> bool:
    """
    等待 SPA 路由变更（URL hash/path 变更但不 reload）
    
    参数:
        page: Playwright Page 实例
        expected_url_pattern: 期望的 URL 模式（包含匹配）
        timeout_ms: 超时时间
    
    返回:
        是否检测到 URL 变化
    """
    initial_url = page.url
    check_interval = 100
    elapsed = 0
    
    while elapsed < timeout_ms:
        try:
            page.wait_for_timeout(check_interval)
            elapsed += check_interval
            
            current_url = page.url
            
            # 检查 URL 是否变化
            if current_url != initial_url:
                # 如果指定了期望模式，检查是否匹配
                if expected_url_pattern:
                    if expected_url_pattern in current_url:
                        return True
                else:
                    return True
                    
        except Exception:
            break
    
    return False


def take_screenshot(
    page: Any,
    screenshot_dir: str,
    step_info: Optional[Dict[str, Any]] = None,
    full_page: bool = True,
    prefix: str = "shot"
) -> ScreenshotInfo:
    """
    统一截图函数：所有截图出口都使用此函数
    
    参数:
        page: Playwright Page 实例
        screenshot_dir: 截图保存目录
        step_info: 步骤关联信息（step_id, action, selector, url_before, url_after）
        full_page: 是否全页截图
        prefix: 文件名前缀
    
    返回:
        ScreenshotInfo 包含完整路径、文件名、关联信息等
    """
    from agent_app.ui.screenshots import upload_screenshot
    
    os.makedirs(screenshot_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    step_info = step_info or {}
    
    # 构建文件名
    step_id = step_info.get("step_id", "")
    action = step_info.get("action", "")
    name_parts = [prefix]
    if step_id:
        safe_id = "".join([c for c in str(step_id) if c.isalnum() or c in ("-", "_")])[:20]
        name_parts.append(safe_id)
    if action:
        name_parts.append(action[:10])
    name_parts.append(timestamp)
    
    filename = "_".join(name_parts) + ".png"
    filepath = os.path.join(screenshot_dir, filename)
    
    # 获取页面信息
    url = ""
    page_id = ""
    context_id = ""
    try:
        url = page.url
    except Exception:
        pass
    
    # 截图
    try:
        page.screenshot(path=filepath, full_page=full_page)
    except Exception as e:
        print(f"[take_screenshot] Error: {e}")
    
    # 创建截图信息
    shot_info = ScreenshotInfo(
        filepath=filepath,
        filename=filename,
        url=url,
        timestamp=timestamp,
        step_id=step_info.get("step_id"),
        action=step_info.get("action"),
        selector=step_info.get("selector"),
        url_before=step_info.get("url_before"),
        url_after=step_info.get("url_after"),
        page_id=page_id,
        context_id=context_id
    )
    
    # 上传截图
    try:
        screenshot_url = upload_screenshot(filepath)
        if screenshot_url:
            shot_info.screenshot_url = screenshot_url
    except Exception:
        pass
    
    return shot_info


def collect_evidence(
    page: Any, 
    screenshot_dir: str = "", 
    step_name: str = "",
    step_info: Optional[Dict[str, Any]] = None,
    full_page: bool = False
) -> Dict[str, Any]:
    """
    采集失败证据：截图、URL、页面文本摘要
    截图会自动上传并获取可访问的 URL
    
    参数:
        page: Playwright Page 实例
        screenshot_dir: 截图保存目录
        step_name: 步骤名称（用于文件命名）
        step_info: 步骤关联信息（可选，用于更详细的追踪）
        full_page: 是否全页截图（默认 False，仅截 viewport，大页面更快）
    
    返回值包含:
        - screenshot: 文件名（向后兼容）
        - screenshot_path: 完整路径
        - screenshot_url: 上传后的 URL
        - screenshot_info: 完整的 ScreenshotInfo 字典
    """
    evidence = {
        "url": "",
        "title": "",
        "text_snippet": "",
        # 向后兼容
        "screenshot": None,
        "screenshot_url": None,
        # 新增：完整路径
        "screenshot_path": None,
        # 新增：完整信息
        "screenshot_info": None,
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
            # 优化：减少等待时间（从3000ms减少到1500ms）
            wait_for_page_stable(page, timeout_ms=1500, network_idle_timeout=1000)
            
            # 合并 step_info
            merged_info = step_info.copy() if step_info else {}
            if not merged_info.get("step_id"):
                merged_info["step_id"] = step_name
            
            shot_info = take_screenshot(
                page=page,
                screenshot_dir=screenshot_dir,
                step_info=merged_info,
                full_page=full_page,  # 使用传入的参数，默认 False（仅截 viewport，更快）
                prefix="evidence"
            )
            
            # 向后兼容
            evidence["screenshot"] = shot_info.filename
            evidence["screenshot_path"] = shot_info.filepath
            evidence["screenshot_url"] = shot_info.screenshot_url
            evidence["screenshot_info"] = asdict(shot_info)
            
        except Exception as e:
            print(f"[collect_evidence] Screenshot error: {e}")

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
            # 使用 safe_locate_single 替代 .first
            result = safe_locate_single(page, f"text:{value}")
            if result.warning:
                ui_log(
                    "warning",
                    "assert_locate_multiple",
                    assert_type=assert_type,
                    selector=f"text:{value}",
                    url=getattr(page, "url", ""),
                    count=result.count,
                    selected_index=result.selected_index,
                    candidates=result.candidates_summary,
                )
            result.locator.wait_for(state="visible", timeout=timeout)
            return {"success": True, "message": f"OK: text '{value}' is visible"}

        elif assert_type == "element_visible":
            result = safe_locate_single(page, target)
            if result.warning:
                ui_log(
                    "warning",
                    "assert_locate_multiple",
                    assert_type=assert_type,
                    selector=target,
                    url=getattr(page, "url", ""),
                    count=result.count,
                    selected_index=result.selected_index,
                    candidates=result.candidates_summary,
                )
            if result.count == 0:
                ui_log("warning", "assert_locate_none", assert_type=assert_type, selector=target, url=getattr(page, "url", ""))
            result.locator.wait_for(state="visible", timeout=timeout)
            return {"success": True, "message": f"OK: element '{target}' is visible"}

        elif assert_type == "element_hidden":
            result = safe_locate_single(page, target)
            if result.warning:
                ui_log(
                    "warning",
                    "assert_locate_multiple",
                    assert_type=assert_type,
                    selector=target,
                    url=getattr(page, "url", ""),
                    count=result.count,
                    selected_index=result.selected_index,
                    candidates=result.candidates_summary,
                )
            if result.count == 0:
                ui_log("warning", "assert_locate_none", assert_type=assert_type, selector=target, url=getattr(page, "url", ""))
            result.locator.wait_for(state="hidden", timeout=timeout)
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


def _is_excluded_url(url: str, allow_schemes: Optional[set] = None) -> bool:
    """检查 URL 是否应被排除（非业务页面）。allow_schemes 用于放行特定 scheme（如 chrome-extension）。"""
    if not url:
        return True
    url_lower = url.lower().strip()
    # 检查 about:blank 等
    if url_lower in ("about:blank", "", "about:srcdoc"):
        return True
    # 检查 scheme
    try:
        parsed = urlparse(url_lower)
        scheme = parsed.scheme.replace("-", "").replace("_", "")
        if allow_schemes and scheme in allow_schemes:
            return False
        if scheme in EXCLUDED_URL_SCHEMES:
            return True
    except Exception:
        pass
    return False


def _calculate_url_score(page_url: str, target_url: str) -> Tuple[int, str]:
    """
    计算页面 URL 与目标 URL 的匹配分数
    
    返回: (分数, 匹配类型)
    分数越高越匹配
    """
    if not page_url or not target_url:
        return (0, "none")
    
    try:
        # 解析 URL
        target_parsed = urlparse(target_url)
        page_parsed = urlparse(page_url)
        
        # 去除 query 和 hash 后的 URL
        target_clean = f"{target_parsed.scheme}://{target_parsed.netloc}{target_parsed.path}".rstrip("/")
        page_clean = f"{page_parsed.scheme}://{page_parsed.netloc}{page_parsed.path}".rstrip("/")
        
        # 精确匹配（去 query/hash）
        if page_clean.lower() == target_clean.lower():
            return (100, "exact")
        
        # 同域 + path 前缀匹配
        if page_parsed.netloc.lower() == target_parsed.netloc.lower():
            target_path = target_parsed.path.rstrip("/")
            page_path = page_parsed.path.rstrip("/")
            
            if page_path.startswith(target_path) or target_path.startswith(page_path):
                return (80, "prefix")
            
            # 同域 + path 包含匹配
            if target_path in page_path or page_path in target_path:
                return (60, "contains")
            
            # 同域任意页面
            return (40, "same_domain")
        
        # 包含目标 URL 的关键部分（path）
        target_path_clean = target_parsed.path.split("/")[-1] if target_parsed.path else ""
        if target_path_clean and target_path_clean in page_url:
            return (30, "path_token")
        
        return (0, "none")
    except Exception:
        # 简单包含匹配作为 fallback
        if target_url in page_url or page_url in target_url:
            return (20, "fallback_contains")
        return (0, "none")


def select_best_page(browser: Any, target_url: Optional[str] = None, 
                     prefer_context_index: int = 0) -> Tuple[Any, List[Dict[str, Any]]]:
    """
    确定性 Page 选择器：根据 URL 评分选择最佳页面
    
    评分规则:
    - 精确匹配（去 query/hash）: 100 分
    - 同域 + path 前缀匹配: 80 分
    - 同域 + path 包含匹配: 60 分
    - 同域任意页面: 40 分
    - visible + not closed: 20 分（无 URL 匹配时的 fallback）
    
    过滤规则:
    - 排除 page.is_closed() == True
    - 排除非业务 scheme: about:, chrome://, chrome-extension://, devtools://, data:
    
    参数:
        browser: Playwright Browser 实例
        target_url: 目标 URL（可选）
        prefer_context_index: 优先使用的 context 索引
    
    返回:
        (最佳页面或 None, 可选页面列表摘要)
    """
    if not browser or not browser.contexts:
        return (None, [])
    
    allow_schemes: set = set()
    if target_url:
        try:
            ts = urlparse(target_url.lower().strip()).scheme.replace("-", "").replace("_", "")
            if ts:
                allow_schemes.add(ts)
        except Exception:
            pass

    all_pages: List[PageScore] = []
    available_pages_summary: List[Dict[str, Any]] = []
    
    # 遍历所有 context 和 page
    for ctx_idx, context in enumerate(browser.contexts):
        for page_idx, page in enumerate(context.pages):
            try:
                # 检查页面是否已关闭
                if page.is_closed():
                    continue
                
                page_url = page.url
                
                # 检查是否为非业务页面
                if _is_excluded_url(page_url, allow_schemes=allow_schemes):
                    continue
                
                # 计算分数
                if target_url:
                    score, match_type = _calculate_url_score(page_url, target_url)
                else:
                    score = 20  # 无目标 URL 时的基础分
                    match_type = "fallback"
                
                # 优先使用指定的 context
                if ctx_idx == prefer_context_index:
                    score += 5
                
                page_score = PageScore(
                    page=page,
                    score=score,
                    match_type=match_type,
                    context_index=ctx_idx,
                    page_index=page_idx
                )
                all_pages.append(page_score)
                
                # 记录可选页面摘要
                available_pages_summary.append({
                    "url": page_url[:200],
                    "title": page.title()[:100] if hasattr(page, 'title') else "",
                    "context_index": ctx_idx,
                    "page_index": page_idx,
                    "score": score,
                    "match_type": match_type
                })
                
            except Exception as e:
                # 页面可能在遍历过程中关闭
                continue
    
    if not all_pages:
        return (None, available_pages_summary)
    
    # 按分数降序排序
    all_pages.sort(key=lambda x: x.score, reverse=True)
    
    best = all_pages[0]
    
    # 如果最高分 <= 0，说明没有合适的匹配
    if best.score <= 0:
        return (None, available_pages_summary)
    
    # 尝试激活页面
    try:
        best.page.bring_to_front()
    except Exception:
        pass
    
    return (best.page, available_pages_summary)


def locate_target_page(browser: Any, target_url: Optional[str]):
    """
    定位目标页面（兼容旧接口）
    
    内部调用 select_best_page，只返回页面对象
    """
    page, _ = select_best_page(browser, target_url)
    return page


def list_available_pages(browser: Any) -> List[Dict[str, Any]]:
    """
    列出所有可用页面（用于错误提示和 agent 选择）
    """
    _, available = select_best_page(browser, None)
    return available


def _get_accessibility_cache_key(page: Any) -> str:
    """
    生成 accessibility snapshot 的缓存 key
    使用 URL path（去除 query/hash）作为 key，因为同一路径的页面结构通常相同
    """
    try:
        url = page.url
        parsed = urlparse(url)
        # 只使用 scheme + netloc + path 作为 key（忽略 query 和 hash）
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    except Exception:
        return ""


def clear_accessibility_cache() -> None:
    """清空 accessibility snapshot 缓存"""
    global _accessibility_cache
    _accessibility_cache.clear()


def build_accessibility_snapshot(
    page: Any, 
    max_chars: int = 6000, 
    force_refresh: bool = False
) -> str:
    """
    获取 accessibility snapshot，便于模型定位元素（截断以防过长）
    
    优化：使用缓存减少重复获取的开销
    - 同一 URL path 在 30 秒内复用缓存
    - 导航后或 force_refresh=True 时强制刷新
    
    参数:
        page: Playwright Page 实例
        max_chars: 最大字符数（截断）
        force_refresh: 是否强制刷新缓存
    """
    global _accessibility_cache
    
    cache_key = _get_accessibility_cache_key(page)
    current_time = time.time()
    
    # 检查缓存是否有效
    if not force_refresh and cache_key and cache_key in _accessibility_cache:
        cached_snapshot, cached_time = _accessibility_cache[cache_key]
        if current_time - cached_time < _ACCESSIBILITY_CACHE_TTL:
            return cached_snapshot
    
    # 缓存未命中或已过期，重新获取
    try:
        snapshot = page.accessibility.snapshot()
        if not snapshot:
            return ""
        result = json.dumps(snapshot, ensure_ascii=False, indent=2)[:max_chars]
        
        # 更新缓存
        if cache_key:
            _accessibility_cache[cache_key] = (result, current_time)
            # 清理过期缓存（避免内存泄漏，最多保留 50 个）
            if len(_accessibility_cache) > 50:
                # 删除最老的缓存项
                oldest_key = min(_accessibility_cache, key=lambda k: _accessibility_cache[k][1])
                del _accessibility_cache[oldest_key]
        
        return result
    except Exception:
        return ""


