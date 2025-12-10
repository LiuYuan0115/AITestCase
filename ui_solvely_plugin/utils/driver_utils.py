import os, logging
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from config.config import PLUGIN_PATH, USER_DATA_DIR, CHROME_EXE


class DriverUtils:
    __driver = None           # 单例
    __keep_alive = False


    @classmethod
    def get_driver(cls) -> webdriver.Chrome:
        if cls.__driver is None:

            # 确保用户目录存在（如果误删，可把备份再拷回来）
            if not os.path.exists(USER_DATA_DIR):
                raise RuntimeError(f"User-data-dir {USER_DATA_DIR} 不存在，请先按步骤1手动登录一次")

            opts = Options()
            opts.binary_location = CHROME_EXE
            opts.add_argument(f'--user-data-dir={USER_DATA_DIR}')
            opts.add_argument("--profile-directory=Default")

            # 关闭常见自动化标记
            opts.add_experimental_option("excludeSwitches", ["enable-automation"])
            opts.add_experimental_option('useAutomationExtension', False)
            opts.add_argument("--disable-blink-features=AutomationControlled")
            opts.add_argument("--remote-debugging-port=9222")  # 固定端口

            # 如需加载插件
            if os.path.exists(PLUGIN_PATH):
                opts.add_argument(f'--load-extension={PLUGIN_PATH}')


            # 指明 chromedriver 可执行文件（版本必须与 Chrome 主版本一致）
            service = Service("/usr/local/bin/chromedriver")
            cls.__driver = webdriver.Chrome(service=service, options=opts)

            cls.__driver.implicitly_wait(10)
            cls.__driver.maximize_window()

        return cls.__driver

# 关闭浏览器驱动
    @classmethod
    def quit_driver(cls):
        if cls.__driver is not None and cls.__switch is False:
            logging.info("quit chrome driver")
            cls.__driver.quit()
            cls.__driver = None
        else:
            logging.info("chrome driver is still alive")

    @classmethod
    def set_switch(cls, switch):
        cls.__switch = switch

# if __name__ == '__main__':
#     driver=DriverUtils.get_driver()
#     if driver is not None:
#         driver.get("https://www.baidu.com")
#         time.sleep(1000)
#
#         driver.quit()