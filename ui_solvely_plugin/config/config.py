import os

# PLUGIN_PATH = "/Users/mac/Library/Application Support/Google/Chrome/Default/Extensions/aedglnfjjccpifohekdeoogffomjcikm"
CHROME_EXE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
USER_DATA_DIR = os.path.expanduser("~/.chrome_selenium_profile")
# EXT_ID = "aedglnfjjccpifohekdeoogffomjcikm"
EXT_ID = "aedglnfjjccpifohekdeoogffomjcikm"
PLUGIN_PATH = f"{USER_DATA_DIR}/Default/Extensions/{EXT_ID}"
SIDEBAR_URL=f"chrome-extension://{EXT_ID}/sidepanel.html"
TEST_URL = "https://static.justsolvely.com/questionImage/1752495412929-solvely-plugin-image.webp"
WEB_PATH = "https://www.collegetools.io/quiz-sample?from=onboarding"