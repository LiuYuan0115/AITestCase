#!/bin/bash
# Week 1: 安装 ChromaDB 相关依赖

set -e  # 遇到错误立即退出

echo "==================================="
echo "  安装 ChromaDB 向量数据库依赖"
echo "==================================="

# 获取脚本所在目录的父目录（agent-server）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "当前目录: $(pwd)"
echo ""

# 检查 Python 版本
echo "检查 Python 版本..."
python3 --version

echo ""
echo "检查 pip 版本..."
pip3 --version

echo ""
echo "==================================="
echo "  开始安装依赖"
echo "==================================="

# 安装 requirements.txt 中的所有依赖
echo ""
echo "安装 requirements.txt 中的依赖..."

# 检测是否在虚拟环境中
if [ -n "$VIRTUAL_ENV" ] || [ -n "$CONDA_PREFIX" ]; then
    echo "检测到虚拟环境，直接安装..."
    pip3 install -r requirements.txt
else
    echo "使用 --user 标志安装到用户目录..."
    pip3 install --user -r requirements.txt
fi

echo ""
echo "==================================="
echo "  依赖安装完成！"
echo "==================================="

echo ""
echo "已安装的关键包："
pip3 list | grep -E "(chromadb|sentence-transformers|pdfplumber|pytesseract)"

echo ""
echo "下一步: 运行测试脚本验证配置"
echo "  python3 scripts/test_chroma_setup.py"
