#!/bin/bash

echo "🌐 启动 Chrome (调试模式)..."
echo ""
echo "如果 Chrome 已经打开，请先完全关闭它 (Cmd+Q)。"
echo ""

# 使用独立的 user-data-dir 避免冲突
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --remote-debugging-port=9222 \
    --user-data-dir="/tmp/chrome_dev_test" \
    --no-first-run \
    --no-default-browser-check &

echo "✅ Chrome 已启动，调试端口: 9222"
echo ""
echo "现在可以运行 ./run_agent.sh 启动 Agent 服务了。"
