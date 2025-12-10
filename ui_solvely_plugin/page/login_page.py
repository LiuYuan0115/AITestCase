from selenium.webdriver import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from base.base_action import BaseAction

class LoginPage(BaseAction):
    # 邮箱输入框
    email_input = By.CSS_SELECTOR, "input[type='text']"

    # 密码输入框
    password_input = By.CSS_SELECTOR, "input[type='password']"

    # next按钮
    next_button = By.CSS_SELECTOR, "button[type='submit']"

    # 输入邮箱
    def input_email(self, email):
        self.input(self.email_input, email)
        self.enter_keys(self.email_input)

    # 输入密码
    def input_password(self, password):
        self.input(self.password_input, password)
        self.enter_keys(self.password_input)

    # 点击 next 按钮
    def click_next(self):
        self.click(self.next_button)

    def input_email_enter(self, locator, text, by=By.CSS_SELECTOR, timeout=10):
        """
        输入文本后自动按回车键
        :param locator: 元素定位符
        :param text: 要输入的文本
        """
        element = WebDriverWait(self.driver, timeout).until(
            EC.element_to_be_clickable((by, locator))
        )
        element.clear()  # 清空现有内容
        element.send_keys(text)
        element.send_keys(Keys.ENTER)
        return element

