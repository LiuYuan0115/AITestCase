from selenium.webdriver.common.by import By
from base.base_action import BaseAction

class ShotPage(BaseAction):
    # Shadow 宿主（确保和页面一致）
    HOST = "solvely-screen-shot[data-wxt-shadow-root]"

    # —— 以下选择器都是“在 shadowRoot 内”的 CSS 选择器 ——
    SCISSOR_BTN = "div.relative"  # ✂️按钮
    LOGO_BTN = "div.absolute.justify-between.transition-all"  # logo按钮
    CANVAS_LAYER = "div.solvely-coverbg"  # 截图遮罩/画布容器
    Solve_BTN = "button[type='button'].font-bold"  # Solve 按钮

    # 点击剪刀
    def click_scissor(self):
        self.click_in_shadow(self.HOST, self.SCISSOR_BTN)

    # 点击logo
    def click_logo(self):
        # 先 hover 触发滑入动画，再等动画到位，再点
        self.safe_click_in_shadow(self.HOST, self.LOGO_BTN, timeout=4, hover=True)

    # 框选区域
    def select_area(self, start: tuple[int, int], end: tuple[int, int]):
        self.drag_select_in_shadow(start, end)

    def click_send(self):
        # 如果 Send 文本更稳，也可以换 XPath：//button[normalize-space()='Solve' and @type='button']
        self.click_in_shadow(self.HOST, self.Solve_BTN)

    def select_area_and_send(self, start=(200, 100), end=(1000, 600)):
        self.select_area(start, end)
        self.click_send()

