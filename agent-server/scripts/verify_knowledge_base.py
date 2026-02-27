#!/usr/bin/env python3
"""
快速验证知识库是否正常工作
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def main():
    print("=" * 60)
    print("📚 知识库状态验证")
    print("=" * 60)

    # 1. 检查 Health
    print("\n1️⃣  检查服务状态...")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        data = resp.json()
        store_type = data.get("store_type", "未知")
        chroma_stats = data.get("chroma_stats")

        print(f"   Store 类型: {store_type}")

        if "ChromaDB" in store_type:
            print("   ✅ ChromaDB 已启用")
            if chroma_stats:
                print(f"   📊 统计信息:")
                print(f"      - history_cases: {chroma_stats.get('history_cases', 0)}")
                print(f"      - session_docs: {chroma_stats.get('session_docs', 0)}")
                print(f"      - company_knowledge: {chroma_stats.get('company_knowledge', 0)}")
        else:
            print("   ❌ ChromaDB 未启用！请设置 USE_CHROMADB=true")
            return

    except Exception as e:
        print(f"   ❌ 服务连接失败: {e}")
        print("   请确保服务正在运行: python agent_server.py")
        return

    # 2. 检查历史库
    print("\n2️⃣  检查历史库...")
    try:
        resp = requests.get(f"{BASE_URL}/api/history/stats", timeout=5)
        data = resp.json()

        if data.get("status") == "success":
            stats = data.get("stats", {})
            total = stats.get("total_history_cases", 0)
            print(f"   历史用例数: {total}")

            if total > 0:
                print("   ✅ 历史库有数据，生成时会参考")
            else:
                print("   ⚠️  历史库为空，需要先生成一些测试用例")
        else:
            print(f"   ❌ 错误: {data.get('message')}")

    except Exception as e:
        print(f"   ❌ 请求失败: {e}")

    # 3. 测试历史搜索
    print("\n3️⃣  测试历史搜索...")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/history/search",
            params={"query": "测试用例", "top_k": 3},
            timeout=10
        )
        data = resp.json()

        if data.get("status") == "success":
            results = data.get("results", [])
            print(f"   搜索结果: {len(results)} 条")

            for i, r in enumerate(results[:3], 1):
                similarity = r.get("similarity", 0)
                content = r.get("content", "")[:50]
                print(f"   {i}. 相似度={similarity:.2f} | {content}...")

            if results:
                print("   ✅ 历史搜索正常工作")
            else:
                print("   ⚠️  未检索到结果（可能历史库为空）")
        else:
            print(f"   ❌ 错误: {data.get('message')}")

    except Exception as e:
        print(f"   ❌ 请求失败: {e}")

    # 4. 环境变量检查
    print("\n4️⃣  环境变量检查...")
    import os
    use_chromadb = os.getenv("USE_CHROMADB", "未设置")
    use_history = os.getenv("USE_HISTORY_REFERENCE", "true（默认）")

    print(f"   USE_CHROMADB: {use_chromadb}")
    print(f"   USE_HISTORY_REFERENCE: {use_history}")

    print("\n" + "=" * 60)
    print("验证完成")
    print("=" * 60)

    print("\n💡 提示：")
    print("   1. 生成测试用例时查看控制台日志")
    print("   2. 搜索 '📚 [知识库]' 关键词查看检索状态")
    print("   3. 确保 USE_CHROMADB=true 和 USE_HISTORY_REFERENCE=true")

if __name__ == "__main__":
    main()
