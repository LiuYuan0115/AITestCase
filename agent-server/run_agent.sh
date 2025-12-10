#!/bin/bash

echo "=============================================="
echo "🤖 AI Test Agent - 启动脚本"
echo "=============================================="

# 1. 检查 Chrome 调试端口是否开启
PORT=9222
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Chrome 调试端口 (9222) 已开启。"
else
    echo ""
    echo "⚠️  Chrome 调试端口 (9222) 未检测到！"
    echo ""
    echo "请先关闭所有 Chrome 窗口，然后运行以下命令启动 Chrome："
    echo ""
    echo '  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_test"'
    echo ""
    echo "启动后，再次运行此脚本。"
    echo "=============================================="
    exit 1
fi

# 2. 进入脚本所在目录
cd "$(dirname "$0")"
echo "📂 工作目录: $(pwd)"

# 3. 激活虚拟环境 (如果存在)
if [ -d "venv" ]; then
    echo "🐍 激活虚拟环境..."
    source venv/bin/activate
else
    echo "ℹ️  未找到 venv 目录，使用系统 Python。"
fi

# 4. 检查并安装依赖
echo "📦 检查依赖..."
pip3 install -q fastapi uvicorn playwright openai

# 5. 启动 Agent Server
echo ""
echo "🚀 启动 Agent Server..."
echo "   地址: http://localhost:8000"
echo "   API:  POST /api/run_test"
echo "=============================================="
python3 agent_server.py
