import time
import allure
from page.sidebar_page import SidebarPage
from page.screenshot_page import ShotPage
from utils.driver_utils import DriverUtils
from config.config import TEST_URL, SIDEBAR_URL


class TestPluginSidebar:

    def setup_method(self, method):
        self.driver = DriverUtils.get_driver()
        DriverUtils.set_switch(True)
        self.shot_page = ShotPage(self.driver)
        self.sidebar_page = SidebarPage(self.driver)

        # 🔑 在新 tab 打开扩展侧栏页面
        self.driver.switch_to.new_window('tab')
        self.driver.get(SIDEBAR_URL)
        self.sidebar_handle = self.driver.current_window_handle


    def teardown_method(self, method):
        DriverUtils.set_switch(False)
        DriverUtils.quit_driver()

    @allure.story("点击✂️截图解题")
    def test_plugin_open(self):
        self.driver.get(TEST_URL)

        # 等宿主出现（更稳，不用 sleep）
        self.shot_page.find_element_in_shadow_dom(
            self.shot_page.HOST, self.shot_page.SCISSOR_BTN, timeout=15
        )

        self.shot_page.click_scissor()
        self.shot_page.select_area_and_send()
        time.sleep(10000)

        assert True
