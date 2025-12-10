from selenium.common import ElementClickInterceptedException
from selenium.webdriver import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

class BaseAction:

    def __init__(self, driver, wait_timeout=10):
        self.driver = driver
        self.wait = WebDriverWait(driver, wait_timeout)

    # ------- 传统封装 -------
    def find_el(self, feature):
        return self.driver.find_element(*feature)

    def find_els(self, feature):
        return self.driver.find_elements(*feature)

    def click(self, feature):
        return self.find_el(feature).click()

    def input(self, feature, content):
        return self.find_el(feature).send_keys(content)

    def clear(self, feature):
        return self.find_el(feature).clear()

    def switch_to(self, frame_feature):
        return self.driver.switch_to.frame(self.find_el(frame_feature))

    def switch_to_default(self):
        return self.driver.switch_to.default_content()

    def switch_window(self):
        handlers = self.driver.window_handles
        return self.driver.switch_to.window(handlers[-1])

    def enter_keys(self,feature):
        return self.find_el(feature).send_keys(Keys.ENTER)

    # ------- Shadow DOM 工具 -------
    def find_element_in_shadow_dom(self, host_css: str, target_css: str, timeout: int = 10):
        host = WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, host_css))
        )

        def _q(drv):
            return drv.execute_script(
                "return arguments[0].shadowRoot && arguments[0].shadowRoot.querySelector(arguments[1]);",
                host, target_css
            )

        return WebDriverWait(self.driver, timeout).until(lambda d: _q(d))

    def click_in_shadow(self, host_css: str, target_css: str, timeout: int = 10):
        el = self.find_element_in_shadow_dom(host_css, target_css, timeout)
        self.driver.execute_script("arguments[0].scrollIntoView({block:'center',inline:'center'});", el)
        el.click()

    def find_visible_in_shadow_dom(self, host_css: str, target_css: str, timeout: int = 10):
        """在 open shadowRoot 中返回【第一个可见且有尺寸】的元素"""
        host = WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, host_css))
        )

        def _query_visible(drv):
            return drv.execute_script("""
                   const host = arguments[0];
                   const sel = arguments[1];
                   const root = host.shadowRoot;
                   if (!root) return null;
                   const list = Array.from(root.querySelectorAll(sel));
                   // 过滤：有尺寸且未隐藏
                   return list.find(el => {
                       const r = el.getBoundingClientRect();
                       const style = getComputedStyle(el);
                       return r.width > 0 && r.height > 0 &&
                              style.visibility !== 'hidden' &&
                              style.display !== 'none';
                   }) || null;
               """, host, target_css)

        return WebDriverWait(self.driver, timeout).until(lambda d: _query_visible(d))

    def safe_click_in_shadow(self, host_css: str, target_css: str, timeout=10, hover=True, wait_slide=True):
        el = self.find_visible_in_shadow_dom(host_css, target_css, timeout)

        # 滚到视口中间
        self.driver.execute_script("arguments[0].scrollIntoView({block:'center',inline:'center'});", el)

        # 一些按钮需要 hover 才从右侧滑入
        if hover:
            ActionChains(self.driver).move_to_element(el).pause(0.15).perform()

        # 如果有从 -right-[50px] 滑到 right-[0px] 的动画，等它就位
        if wait_slide:
            WebDriverWait(self.driver, timeout).until(
                lambda d: "0px" in d.execute_script("return getComputedStyle(arguments[0]).right;", el)
                          or d.execute_script("""
                          const r = arguments[0].getBoundingClientRect();
                          return r.width > 0 && r.right <= window.innerWidth && r.left >= 0;
                      """, el)
            )

        try:
            el.click()
        except ElementClickInterceptedException:
            # 兜底：JS click
            self.driver.execute_script("arguments[0].click();", el)
        return el

    # ------- 拖拽：容器内偏移坐标（CSS 像素） -------
    # def drag_select_element(self, container_el, start, end, hold=0.05):
    #     x1, y1 = start
    #     x2, y2 = end
    #     dx, dy = x2 - x1, y2 - y1
    #
    #     self.driver.execute_script("arguments[0].scrollIntoView({block:'center',inline:'center'});", container_el)
    #     actions = ActionChains(self.driver)
    #     actions.move_to_element_with_offset(container_el, x1, y1).click_and_hold().pause(hold)
    #     actions.move_by_offset(dx, dy).pause(hold).release().perform()
    #
    # def drag_select_in_shadow(self, host_css: str, container_css: str, start, end, hold=0.05, timeout: int = 10):
    #     el = self.find_element_in_shadow_dom(host_css, container_css, timeout)
    #     self.drag_select_element(el, start, end, hold)

    def drag_select_element(self, start, end, hold=0.05):
        """
        在页面上从起点到终点执行拖拽选择
        :param start: 起点坐标 (x, y)，基于整个页面的绝对坐标
        :param end: 终点坐标 (x, y)，基于整个页面的绝对坐标
        :param hold: 按住鼠标的时间(秒)
        """
        x1, y1 = start
        x2, y2 = end
        dx, dy = x2 - x1, y2 - y1

        # 移除了滚动到视口中心的代码
        actions = ActionChains(self.driver)
        # 直接移动到页面上的绝对坐标点，而非相对于容器的偏移
        actions.move_by_offset(x1, y1).click_and_hold().pause(hold)
        actions.move_by_offset(dx, dy).pause(hold).release().perform()

    # 对应的Shadow DOM版本也做了相应调整
    def drag_select_in_shadow(self, start, end, hold=0.05):
        """
        在Shadow DOM相关区域执行拖拽选择（使用绝对坐标）
        :param start: 起点坐标 (x, y)，基于整个页面的绝对坐标
        :param end: 终点坐标 (x, y)，基于整个页面的绝对坐标
        :param hold: 按住鼠标的时间(秒)
        """
        # 直接调用修改后的拖拽方法，使用绝对坐标
        self.drag_select_element(start, end, hold)




