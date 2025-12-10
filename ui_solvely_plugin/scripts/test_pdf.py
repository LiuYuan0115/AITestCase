import time
import os
import subprocess
import allure
from selenium.webdriver.common.keys import Keys
from page.sidebar_page import SidebarPage
from page.login_page import LoginPage
from utils.driver_utils import DriverUtils
from config.config import TEST_URL, SIDEBAR_URL


class TestPluginSidebar:

    def setup_method(self, method):
        self.driver = DriverUtils.get_driver()
        DriverUtils.set_switch(True)
        self.sidebar_page = SidebarPage(self.driver)

        # 🔑 在新 tab 打开扩展侧栏页面
        self.driver.switch_to.new_window('tab')
        self.driver.get(SIDEBAR_URL)
        self.sidebar_handle = self.driver.current_window_handle

    def teardown_method(self, method):
        DriverUtils.set_switch(False)
        DriverUtils.quit_driver()



    @allure.story("pdf解题")
    def test_plugin_pdf_solve(self):


        # 获取PDF文件的绝对路径
        pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "file", "pdf_solve_01.pdf"))
        
        # 在Mac上使用osascript将文件复制到剪贴板
        applescript = f'''
        set the clipboard to (POSIX file "{pdf_path}")
        '''
        subprocess.run(['osascript', '-e', applescript], check=True)
        
        # 获取当前所有标签页句柄（粘贴前）
        original_handles = set(self.driver.window_handles)
        
        # 点击输入框并粘贴文件
        self.sidebar_page.click_question_input()
        
        # 在Mac上使用Command+V粘贴
        question_input_element = self.sidebar_page.find_el(self.sidebar_page.question_input)
        question_input_element.send_keys(Keys.COMMAND, 'v')
        
        # 检测PDF查看页面
        max_wait_time = 20
        start_time = time.time()
        pdf_view_handle = None
        
        while (time.time() - start_time) < max_wait_time:
            # 先检测是否有新标签页（不切换）
            current_handles = set(self.driver.window_handles)
            new_handles = current_handles - original_handles
            if new_handles:
                pdf_view_handle = new_handles.pop()
                break
            
            # 每1秒检测一次URL
            time.sleep(1)
            for handle in self.driver.window_handles:
                self.driver.switch_to.window(handle)
                if 'pdfView.html' in self.driver.current_url:
                    pdf_view_handle = handle
                    break
            
            # if pdf_view_handle:
            #     break
                
            # 切换回插件页面
            self.driver.switch_to.window(self.sidebar_handle)
            
            # # 检测PDF图标是否出现，如果出现则停止循环
            # if self.sidebar_page.is_pdf_icon_visible():
            #     break
        
        # # 切换回插件标签页
        # if pdf_view_handle:
        #     self.driver.switch_to.window(self.sidebar_handle)
        
        self.sidebar_page.click_solve_button()

        time.sleep(40)

    @allure.story("pdf总结")
    def test_plugin_pdf_summarize(self):

        # 获取PDF文件的绝对路径
        pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "file", "pdf_solve_01.pdf"))
        
        # 在Mac上使用osascript将文件复制到剪贴板
        applescript = f'''
        set the clipboard to (POSIX file "{pdf_path}")
        '''
        subprocess.run(['osascript', '-e', applescript], check=True)
        
        # 获取当前所有标签页句柄（粘贴前）
        original_handles = set(self.driver.window_handles)
        
        # 点击输入框并粘贴文件
        self.sidebar_page.click_question_input()
        
        # 在Mac上使用Command+V粘贴
        question_input_element = self.sidebar_page.find_el(self.sidebar_page.question_input)
        question_input_element.send_keys(Keys.COMMAND, 'v')
        
        # 检测PDF查看页面
        max_wait_time = 20
        start_time = time.time()
        pdf_view_handle = None
        
        while (time.time() - start_time) < max_wait_time:
            # 先检测是否有新标签页（不切换）
            current_handles = set(self.driver.window_handles)
            new_handles = current_handles - original_handles
            if new_handles:
                pdf_view_handle = new_handles.pop()
                break
            
            # 每1秒检测一次URL
            time.sleep(1)
            for handle in self.driver.window_handles:
                self.driver.switch_to.window(handle)
                if 'pdfView.html' in self.driver.current_url:
                    pdf_view_handle = handle
                    break
            
            # if pdf_view_handle:
            #     break
                
            # 切换回插件页面
            self.driver.switch_to.window(self.sidebar_handle)
            
            # # 检测PDF图标是否出现，如果出现则停止循环
            # if self.sidebar_page.is_pdf_icon_visible():
            #     break
        
        # # 切换回插件标签页
        # if pdf_view_handle:
        #     self.driver.switch_to.window(self.sidebar_handle)
        
        self.sidebar_page.click_summarize_button()

        time.sleep(40)

    @allure.story("pdf quiz")
    def test_plugin_pdf_quiz(self):
                # 获取PDF文件的绝对路径
        pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "file", "pdf_solve_01.pdf"))
        
        # 在Mac上使用osascript将文件复制到剪贴板
        applescript = f'''
        set the clipboard to (POSIX file "{pdf_path}")
        '''
        subprocess.run(['osascript', '-e', applescript], check=True)
        
        # 获取当前所有标签页句柄（粘贴前）
        original_handles = set(self.driver.window_handles)
        
        # 点击输入框并粘贴文件
        self.sidebar_page.click_question_input()
        
        # 在Mac上使用Command+V粘贴
        question_input_element = self.sidebar_page.find_el(self.sidebar_page.question_input)
        question_input_element.send_keys(Keys.COMMAND, 'v')
        
        # 检测PDF查看页面
        max_wait_time = 20
        start_time = time.time()
        pdf_view_handle = None
        
        while (time.time() - start_time) < max_wait_time:
            # 先检测是否有新标签页（不切换）
            current_handles = set(self.driver.window_handles)
            new_handles = current_handles - original_handles
            if new_handles:
                pdf_view_handle = new_handles.pop()
                break
            
            # 每1秒检测一次URL
            time.sleep(1)
            for handle in self.driver.window_handles:
                self.driver.switch_to.window(handle)
                if 'pdfView.html' in self.driver.current_url:
                    pdf_view_handle = handle
                    break
            
            # if pdf_view_handle:
            #     break
                
            # 切换回插件页面
            self.driver.switch_to.window(self.sidebar_handle)
            
            # # 检测PDF图标是否出现，如果出现则停止循环
            # if self.sidebar_page.is_pdf_icon_visible():
            #     break
        
        # # 切换回插件标签页
        # if pdf_view_handle:
        #     self.driver.switch_to.window(self.sidebar_handle)
        
        self.sidebar_page.click_quiz_button()

        time.sleep(40)
        


