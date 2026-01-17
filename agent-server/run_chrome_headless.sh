#!/bin/bash

echo "👻 启动 Chrome (新无头模式 + 调试)..."
echo ""
echo "如果 Chrome 已经打开，请先完全关闭它 (Cmd+Q)。"
echo ""

# ============================================
# 配置区域
# ============================================

# Chrome 扩展路径（可选，多个扩展用逗号分隔）
# 示例：EXTENSION_PATH="/path/to/extension1,/path/to/extension2"
EXTENSION_PATH=""

# 调试端口
DEBUG_PORT=9222

# 用户数据目录（与 run_chrome.sh 共享，这样插件和登录状态可以复用）
USER_DATA_DIR="/tmp/chrome_dev_test"

# ============================================
# 启动 Chrome
# ============================================

CHROME_CMD="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 基础参数
CHROME_ARGS=(
    "--headless=new"                    # 新无头模式（Chrome 112+，支持扩展）
    "--remote-debugging-port=${DEBUG_PORT}"
    "--user-data-dir=${USER_DATA_DIR}"
    "--no-first-run"
    "--no-default-browser-check"
    "--disable-gpu"                     # 无头模式下推荐
    "--disable-software-rasterizer"     # 避免某些渲染问题
)

# 如果配置了扩展路径，添加扩展参数
if [ -n "$EXTENSION_PATH" ]; then
    CHROME_ARGS+=("--load-extension=${EXTENSION_PATH}")
    echo "📦 加载扩展: ${EXTENSION_PATH}"
fi

# 启动 Chrome（后台运行）
"${CHROME_CMD}" "${CHROME_ARGS[@]}" &

echo ""
echo "✅ Chrome 新无头模式已启动"
echo "   调试端口: ${DEBUG_PORT}"
echo "   数据目录: ${USER_DATA_DIR}"
echo ""
echo "💡 提示："
echo "   - 新无头模式支持 Chrome 扩展和 chrome-extension:// 页面"
echo "   - 浏览器在后台运行，不会显示窗口"
echo "   - 可通过 http://localhost:${DEBUG_PORT} 查看调试信息"
echo ""
echo "现在可以运行 ./run_agent.sh 启动 Agent 服务了。"

