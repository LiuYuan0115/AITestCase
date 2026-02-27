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

mkdir -p "${USER_DATA_DIR}"

# 如果已经有 Chrome 实例在使用该 profile，直接退出避免损坏 profile
if pgrep -f "Google Chrome.*--user-data-dir=${USER_DATA_DIR}" >/dev/null 2>&1; then
    echo "❌ 检测到已有 Chrome 正在使用 ${USER_DATA_DIR}"
    echo "   请先完全退出 Chrome (Cmd+Q)，或修改脚本使用不同的 USER_DATA_DIR"
    exit 1
fi

# 清理可能残留的锁文件（常见于异常退出导致的 stale lock）
for f in SingletonLock SingletonCookie SingletonSocket; do
    if [ -e "${USER_DATA_DIR}/${f}" ]; then
        rm -f "${USER_DATA_DIR}/${f}"
    fi
done

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
CHROME_PID=$!

# 等待调试端口真正可用，避免“启动成功”但实际已退出
READY=0
for i in {1..25}; do
    if curl -fsS "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 0.2
done

if [ "${READY}" -ne 1 ]; then
    echo ""
    echo "❌ Chrome 启动失败（调试端口 ${DEBUG_PORT} 未就绪）。"
    echo "   可能原因：端口被占用 / 仍有 Chrome 未退出 / profile 锁冲突。"
    kill "${CHROME_PID}" >/dev/null 2>&1 || true
    exit 1
fi

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

