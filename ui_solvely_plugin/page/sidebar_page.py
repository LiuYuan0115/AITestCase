from selenium.webdriver.common.by import By
from base.base_action import BaseAction
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class SidebarPage(BaseAction):
    # 头像
    account_button = By.CSS_SELECTOR, "button.inline-flex.items-center.relative"

    # 输入框
    question_input = By.CSS_SELECTOR, "textarea[placeholder='Ask me any questions']"

    # Send按钮（是 type="submit"，且类名包含 primary）
    send_button = By.CSS_SELECTOR, "button[type='submit']"

    # 回答区域：根据结构推测在滚动区域内
    answer_area = By.CSS_SELECTOR, "div[class*='overflow-y-auto']"

    # 文件上传按钮
    file_upload_button = By.CSS_SELECTOR, ".group button"
    
    # PDF图标
    pdf_icon = By.CSS_SELECTOR, "svg[data-icon='file-pdf'], img[alt*='pdf'], [class*='pdf-icon']"

    # solve按钮
    solve_button = By.XPATH, "//button[contains(text(), 'Solve')]"

    # summarize按钮
    summarize_button = By.XPATH, "//button[contains(text(), 'Summarize')]"

    # quiz按钮
    quiz_button = By.XPATH, "//button[contains(text(), 'Quiz')]"

    # 点击头像
    def click_account(self, timeout=10):
        WebDriverWait(self.driver, timeout).until(EC.element_to_be_clickable(self.account_button)).click()

    # 点击输入框
    def click_question_input(self):
        self.click(self.question_input)

    # 输入问题
    def input_question(self, text):
        self.input(self.question_input, text)

    # 点击 send 按钮
    def click_send(self):
        self.click(self.send_button)

    # 获取回答内容
    def get_answer_text(self):
        return self.find_el(self.answer_area).text

    # 拖动插件（向右移动 100px）
    def drag_plugin(self):
        from selenium.webdriver import ActionChains
        el = self.find_el(self.drag_bar)
        ActionChains(self.driver).click_and_hold(el).move_by_offset(100, 0).release().perform()


    # 点击文件上传按钮
    def click_file_upload_button(self):
        self.click(self.file_upload_button)
    
    # 检查PDF图标是否出现
    def is_pdf_icon_visible(self, timeout=2):
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located(self.pdf_icon)
            )
            return True
        except:
            return False

    # 点击solve按钮
    def click_solve_button(self):
        self.click(self.solve_button)

    # 点击summarize按钮
    def click_summarize_button(self):
        self.click(self.summarize_button)

    # 点击quiz按钮
    def click_quiz_button(self):
        self.click(self.quiz_button)