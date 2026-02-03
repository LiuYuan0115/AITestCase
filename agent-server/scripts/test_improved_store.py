#!/usr/bin/env python3
"""
测试 ImprovedSessionStore 功能
验证向量检索、归档等新功能
"""
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent_app.session_store import ImprovedSessionStore


def test_initialization():
    """测试初始化"""
    print("=== 测试 ImprovedSessionStore 初始化 ===")

    try:
        store = ImprovedSessionStore()
        print("✅ ImprovedSessionStore 初始化成功")

        # 检查集合状态
        stats = store.get_collection_stats()
        print(f"   集合统计: {stats}")

        return True, store
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def test_put_doc(store):
    """测试文档存储"""
    print("\n=== 测试文档存储（双存储：内存+ChromaDB）===")

    try:
        # 存储测试文档
        doc1 = store.put_doc(
            content="用户登录功能需要支持邮箱和密码登录。登录失败3次后锁定账户。",
            title="登录功能PRD",
            kind="prd",
            session_id="test_session_1",
            logical_id="prd_login",
            tags=["登录", "认证"]
        )

        doc2 = store.put_doc(
            content="测试用例应该包含正常流程、异常流程和边界值测试。需要覆盖所有功能点。",
            title="测试用例编写规范",
            kind="guideline",
            session_id="test_session_1",
            logical_id="guideline_testcase",
            tags=["测试", "规范"]
        )

        doc3 = store.put_doc(
            content="注册功能需要验证邮箱格式、密码强度。注册成功后自动发送欢迎邮件。",
            title="注册功能PRD",
            kind="prd",
            session_id="test_session_1",
            logical_id="prd_register",
            tags=["注册", "邮箱"]
        )

        print(f"✅ 文档存储成功")
        print(f"   文档1: {doc1['docId'][:20]}... (isNew={doc1['isNew']})")
        print(f"   文档2: {doc2['docId'][:20]}... (isNew={doc2['isNew']})")
        print(f"   文档3: {doc3['docId'][:20]}... (isNew={doc3['isNew']})")

        # 检查 ChromaDB 存储
        stats = store.get_collection_stats()
        print(f"   ChromaDB 文档数: {stats['session_docs']}")

        return True, [doc1['docId'], doc2['docId'], doc3['docId']]
    except Exception as e:
        print(f"❌ 文档存储失败: {e}")
        import traceback
        traceback.print_exc()
        return False, []


def test_vector_retrieve(store, doc_ids):
    """测试向量检索"""
    print("\n=== 测试向量相似度检索 ===")

    try:
        # 测试查询1: 登录相关
        query1 = "如何测试登录功能的安全性？"
        results1 = store.retrieve(doc_ids, query1, top_k=2)

        print(f"\n查询: '{query1}'")
        print(f"返回结果数: {len(results1)}")
        for i, (doc_id, content, score) in enumerate(results1):
            print(f"\n结果 {i+1}:")
            print(f"  - DocID: {doc_id[:20]}...")
            print(f"  - 相似度: {score:.4f}")
            print(f"  - 内容: {content[:80]}...")

        # 测试查询2: 邮箱相关
        query2 = "邮箱验证的测试用例"
        results2 = store.retrieve(doc_ids, query2, top_k=2)

        print(f"\n查询: '{query2}'")
        print(f"返回结果数: {len(results2)}")
        for i, (doc_id, content, score) in enumerate(results2):
            print(f"\n结果 {i+1}:")
            print(f"  - DocID: {doc_id[:20]}...")
            print(f"  - 相似度: {score:.4f}")
            print(f"  - 内容: {content[:80]}...")

        print(f"\n✅ 向量检索成功")
        return True
    except Exception as e:
        print(f"❌ 向量检索失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_archive_and_search(store, doc_ids):
    """测试归档和历史搜索"""
    print("\n=== 测试文档归档与历史搜索 ===")

    try:
        # 归档第一个文档（登录功能PRD）
        success = store.archive_to_history(
            doc_id=doc_ids[0],
            session_id="test_session_1",
            metadata={"tags": ["已确认", "登录模块"]}
        )

        if success:
            print("✅ 文档归档成功")
        else:
            print("❌ 文档归档失败")
            return False

        # 搜索历史
        query = "登录功能的安全测试"
        history = store.search_history(query, top_k=2)

        print(f"\n历史搜索: '{query}'")
        print(f"返回结果数: {len(history)}")

        for i, record in enumerate(history):
            print(f"\n历史记录 {i+1}:")
            print(f"  - ID: {record['id']}")
            print(f"  - 相似度: {record['similarity']:.4f}")
            print(f"  - 归档时间: {record['metadata'].get('archived_at', 'N/A')}")
            print(f"  - 标签: {record['metadata'].get('tags', '[]')}")
            print(f"  - 内容: {record['content'][:80]}...")

        print(f"\n✅ 归档和历史搜索成功")
        return True
    except Exception as e:
        print(f"❌ 归档/搜索失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_backward_compatibility(store):
    """测试向后兼容性"""
    print("\n=== 测试向后兼容性（SessionStore 接口）===")

    try:
        # 测试基础 SessionStore 方法
        session_id = "compat_test"

        # 1. 消息存储
        store.append(session_id, "user", "测试消息1")
        store.append(session_id, "assistant", "回复消息1")

        messages = store.get(session_id)
        assert len(messages) == 2, "消息存储失败"
        print("✅ 消息存储/读取正常")

        # 2. 缓存
        cache_key = store.make_cache_key({"test": "data"})
        store.cache_set(cache_key, {"result": "cached"})
        cached = store.cache_get(cache_key)
        assert cached == {"result": "cached"}, "缓存失败"
        print("✅ 缓存功能正常")

        # 3. 指针系统
        doc = store.put_doc(
            content="测试内容",
            session_id=session_id,
            logical_id="test_pointer"
        )
        pointer = store.get_pointer(session_id, "test_pointer")
        assert pointer == doc['docId'], "指针系统失败"
        print("✅ 指针系统正常")

        # 4. 文档列表
        docs = store.list_session_docs(session_id)
        assert len(docs) > 0, "文档列表失败"
        print("✅ 文档列表正常")

        print("\n✅ 所有向后兼容性测试通过")
        return True
    except Exception as e:
        print(f"❌ 向后兼容性测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主测试流程"""
    print("=" * 60)
    print(" ImprovedSessionStore 功能测试")
    print("=" * 60)

    results = []

    # 1. 初始化
    success, store = test_initialization()
    results.append(("初始化测试", success))
    if not success or not store:
        print("\n⚠️ 初始化失败，终止测试")
        return 1

    # 2. 文档存储
    success, doc_ids = test_put_doc(store)
    results.append(("文档存储测试", success))
    if not success or not doc_ids:
        print("\n⚠️ 文档存储失败，终止后续测试")
        return 1

    # 3. 向量检索
    success = test_vector_retrieve(store, doc_ids)
    results.append(("向量检索测试", success))

    # 4. 归档和历史搜索
    success = test_archive_and_search(store, doc_ids)
    results.append(("归档/历史搜索测试", success))

    # 5. 向后兼容性
    success = test_backward_compatibility(store)
    results.append(("向后兼容性测试", success))

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
        print("\n🎉 所有测试通过！ImprovedSessionStore 功能正常。")
        return 0
    else:
        print("\n⚠️ 部分测试失败，请检查实现。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
