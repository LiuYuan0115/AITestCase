import time
import allure
from page.sidebar_page import SidebarPage
from page.login_page import LoginPage
from utils.driver_utils import DriverUtils
from config.config import TEST_URL, SIDEBAR_URL


class TestPluginSidebar:

    def setup_method(self, method):
        self.driver = DriverUtils.get_driver()
        DriverUtils.set_switch(True)
        self.login_page = LoginPage(self.driver)
        self.sidebar_page = SidebarPage(self.driver)

        # 🔑 在新 tab 打开扩展侧栏页面
        self.driver.switch_to.new_window('tab')
        self.driver.get(SIDEBAR_URL)
        self.sidebar_handle = self.driver.current_window_handle

    def teardown_method(self, method):
        DriverUtils.set_switch(False)
        DriverUtils.quit_driver()



    @allure.story("登录")
    def test_plugin_open(self):
        self.sidebar_page.click_account()
        time.sleep(10)
        self.login_page.input_email("ly-test-61@solvely.ai")
        time.sleep(10)
        self.login_page.input_password("111111")
        time.sleep(1000)
        assert 1 in 1
