#!/usr/bin/env python3
"""
测试 ChromaDB 配置
验证向量化流程是否正常工作
"""
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent_app.chroma_config import (
    get_chroma_client,
    get_embedding_function,
    COLLECTION_CONFIGS
)


def test_chroma_connection():
    """测试 ChromaDB 连接"""
    print("=== 测试 ChromaDB 连接 ===")

    try:
        client = get_chroma_client()
        print("✅ ChromaDB 客户端创建成功")
        # chromadb 0.4.x PersistentClient 没有 _settings 属性
        # 直接使用配置中的路径
        from agent_app.chroma_config import CHROMA_DB_PATH
        print(f"   数据库路径: {CHROMA_DB_PATH}")
        # 验证客户端可用性
        _ = client.list_collections()
        print("   客户端验证: 正常")
        return True
    except Exception as e:
        print(f"❌ ChromaDB 客户端创建失败: {e}")
        return False


def test_embedding_function():
    """测试 Embedding 函数"""
    print("\n=== 测试 Embedding 函数 ===")

    try:
        embedding_fn = get_embedding_function()
        print("✅ Embedding 函数加载成功")

        # 测试向量化
        test_texts = [
            "用户登录功能需要支持邮箱和密码",
            "测试用例需要覆盖边界值和异常场景"
        ]

        print(f"\n   测试文本数量: {len(test_texts)}")
        embeddings = embedding_fn(test_texts)

        print(f"✅ 向量化成功")
        print(f"   返回向量数量: {len(embeddings)}")
        print(f"   向量维度: {len(embeddings[0])}")
        print(f"   第一个向量前5维: {embeddings[0][:5]}")

        return True

    except Exception as e:
        print(f"❌ Embedding 函数测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_create_collections():
    """测试创建 Collection"""
    print("\n=== 测试创建 Collection ===")

    try:
        client = get_chroma_client()
        embedding_fn = get_embedding_function()

        for collection_name, config in COLLECTION_CONFIGS.items():
            # 创建或获取 Collection
            collection = client.get_or_create_collection(
                name=config['name'],
                embedding_function=embedding_fn,
                metadata=config['metadata']
            )

            print(f"✅ Collection '{collection_name}' 创建成功")
            print(f"   描述: {config['description']}")
            print(f"   当前文档数: {collection.count()}")

        return True

    except Exception as e:
        print(f"❌ Collection 创建失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_basic_operations():
    """测试基础的增删改查"""
    print("\n=== 测试基础操作 ===")

    try:
        client = get_chroma_client()
        embedding_fn = get_embedding_function()

        # 先删除可能存在的旧测试 Collection，确保干净环境
        try:
            client.delete_collection("test_collection")
        except Exception:
            pass  # Collection 不存在时忽略错误

        # 创建新的测试 Collection
        test_collection = client.get_or_create_collection(
            name="test_collection",
            embedding_function=embedding_fn
        )

        # 1. 添加文档
        test_docs = [
            "这是一个关于登录功能的PRD文档",
            "测试用例应该包含正常流程和异常流程",
            "边界值测试非常重要"
        ]

        test_collection.add(
            documents=test_docs,
            ids=["doc1", "doc2", "doc3"],
            metadatas=[
                {"type": "prd", "module": "login"},
                {"type": "testcase", "module": "login"},
                {"type": "testcase", "module": "general"}
            ]
        )

        print(f"✅ 添加了 {len(test_docs)} 个文档")

        # 2. 查询文档
        query = "登录功能的测试用例"
        results = test_collection.query(
            query_texts=[query],
            n_results=2
        )

        print(f"✅ 查询成功")
        print(f"   查询语句: '{query}'")
        print(f"   返回结果数: {len(results['ids'][0])}")

        for i, (doc_id, doc, distance) in enumerate(zip(
            results['ids'][0],
            results['documents'][0],
            results['distances'][0]
        )):
            print(f"\n   结果 {i+1}:")
            print(f"   - ID: {doc_id}")
            print(f"   - 内容: {doc}")
            print(f"   - 距离: {distance:.4f}")

        # 3. 删除测试 Collection
        client.delete_collection("test_collection")
        print(f"\n✅ 清理测试数据完成")

        return True

    except Exception as e:
        print(f"❌ 基础操作测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主测试流程"""
    print("=" * 60)
    print(" ChromaDB 配置测试")
    print("=" * 60)

    results = []

    # 运行所有测试
    results.append(("连接测试", test_chroma_connection()))
    results.append(("Embedding测试", test_embedding_function()))
    results.append(("Collection创建", test_create_collections()))
    results.append(("基础操作测试", test_basic_operations()))

    # 总结
    print("\n" + "=" * 60)
    print(" 测试总结")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{name}: {status}")

    print(f"\n总计: {passed}/{total} 测试通过")

    if passed == total:
        print("\n🎉 所有测试通过！ChromaDB 配置正常。")
        return 0
    else:
        print("\n⚠️ 部分测试失败，请检查配置。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
