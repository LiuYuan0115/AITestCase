#!/usr/bin/env python3
"""
端到端集成测试：API → ImprovedSessionStore → ChromaDB
验证完整工作流程
"""
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent_app.session_store import ImprovedSessionStore


def test_e2e_workflow():
    """
    测试完整工作流程：
    1. 上传PRD文档
    2. 存储到ChromaDB
    3. 语义检索
    4. 生成测试用例（模拟）
    5. 归档到历史库
    6. 搜索历史用例
    """
    print("=" * 60)
    print(" 端到端集成测试")
    print("=" * 60)

    # 初始化
    print("\n=== 步骤 1: 初始化 ImprovedSessionStore ===")
    try:
        store = ImprovedSessionStore()
        print("✅ ImprovedSessionStore 初始化成功")
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        return False

    session_id = "test_e2e_session"

    # 步骤 2: 上传 PRD 文档
    print("\n=== 步骤 2: 上传 PRD 文档 ===")
    prd_content = """
# 用户登录功能 PRD

## 功能概述
用户可以通过邮箱和密码进行登录。

## 功能需求
1. 支持邮箱+密码登录
2. 登录失败3次后锁定账户15分钟
3. 支持"记住我"功能（7天免登录）
4. 密码必须包含大小写字母、数字、特殊字符，长度8-20位

## 异常处理
- 邮箱格式错误：提示"请输入正确的邮箱格式"
- 密码错误：提示"密码错误，剩余X次机会"
- 账户锁定：提示"账户已锁定，请15分钟后重试"
"""

    try:
        result = store.put_doc(
            content=prd_content,
            title="用户登录功能PRD",
            kind="prd",
            session_id=session_id,
            logical_id="prd_login",
            tags=["登录", "认证", "安全"]
        )
        doc_id = result["docId"]
        print(f"✅ PRD 文档上传成功")
        print(f"   DocID: {doc_id[:30]}...")
        print(f"   是否新文档: {result['isNew']}")
    except Exception as e:
        print(f"❌ PRD 上传失败: {e}")
        return False

    # 步骤 3: 语义检索（模拟用户查询）
    print("\n=== 步骤 3: 语义检索测试 ===")
    test_queries = [
        "如何测试登录的安全性？",
        "密码验证规则是什么？",
        "账户锁定机制如何实现？",
    ]

    for query in test_queries:
        try:
            results = store.retrieve([doc_id], query, top_k=3)
            print(f"\n查询: '{query}'")
            print(f"  返回 {len(results)} 条结果")
            if results:
                top_result = results[0]
                print(f"  最佳匹配相似度: {top_result[2]:.4f}")
                print(f"  内容片段: {top_result[1][:100]}...")
        except Exception as e:
            print(f"❌ 检索失败: {e}")
            return False

    # 步骤 4: 模拟生成测试用例
    print("\n=== 步骤 4: 模拟生成测试用例 ===")
    testcase_content = """
# 用户登录功能测试用例

## TC_LOGIN_001: 正常登录
**前置条件**: 用户已注册且未被锁定
**测试步骤**:
1. 输入正确的邮箱和密码
2. 点击"登录"按钮
**预期结果**: 登录成功，跳转到首页

## TC_LOGIN_002: 密码错误
**前置条件**: 用户已注册
**测试步骤**:
1. 输入正确的邮箱和错误的密码
2. 点击"登录"按钮
**预期结果**: 提示"密码错误，剩余2次机会"

## TC_LOGIN_003: 账户锁定（边界值）
**前置条件**: 用户已连续输错2次密码
**测试步骤**:
1. 第3次输入错误密码
2. 点击"登录"按钮
**预期结果**: 提示"账户已锁定，请15分钟后重试"

## TC_LOGIN_004: 密码强度验证
**测试数据**:
- 弱密码: "12345678" (仅数字)
- 强密码: "Abc@1234" (符合规则)
**预期结果**: 弱密码拒绝，强密码通过
"""

    try:
        testcase_result = store.put_doc(
            content=testcase_content,
            title="用户登录功能测试用例",
            kind="testcase",
            session_id=session_id,
            logical_id="testcase_login",
            tags=["测试用例", "登录", "已确认"]
        )
        testcase_doc_id = testcase_result["docId"]
        print(f"✅ 测试用例生成成功")
        print(f"   DocID: {testcase_doc_id[:30]}...")
    except Exception as e:
        print(f"❌ 测试用例生成失败: {e}")
        return False

    # 步骤 5: 归档到历史库
    print("\n=== 步骤 5: 归档测试用例到历史库 ===")
    try:
        success = store.archive_to_history(
            doc_id=testcase_doc_id,
            session_id=session_id,
            metadata={"tags": ["已确认", "登录模块", "V1.0"]}
        )
        if success:
            print("✅ 测试用例归档成功")
        else:
            print("❌ 归档失败")
            return False
    except Exception as e:
        print(f"❌ 归档失败: {e}")
        return False

    # 步骤 6: 搜索历史用例
    print("\n=== 步骤 6: 搜索历史用例 ===")
    history_queries = [
        "登录功能的边界值测试",
        "密码验证测试用例",
        "账户锁定测试",
    ]

    for query in history_queries:
        try:
            history = store.search_history(query, top_k=2)
            print(f"\n历史搜索: '{query}'")
            print(f"  返回 {len(history)} 条历史记录")
            if history:
                top = history[0]
                print(f"  最佳匹配相似度: {top['similarity']:.4f}")
                print(f"  归档时间: {top['metadata'].get('archived_at', 'N/A')}")
                print(f"  内容: {top['content'][:80]}...")
        except Exception as e:
            print(f"❌ 历史搜索失败: {e}")
            return False

    # 步骤 7: 验证 ChromaDB 统计
    print("\n=== 步骤 7: ChromaDB 统计信息 ===")
    try:
        stats = store.get_collection_stats()
        print(f"session_docs 集合: {stats['session_docs']} 个文档")
        print(f"history_cases 集合: {stats['history_cases']} 个文档")
        print(f"company_knowledge 集合: {stats['company_knowledge']} 个文档")
        print(f"总计: {sum(stats.values())} 个文档")
    except Exception as e:
        print(f"❌ 统计失败: {e}")
        return False

    # 步骤 8: 测试向后兼容性
    print("\n=== 步骤 8: 向后兼容性测试 ===")
    try:
        # 测试消息存储
        store.append(session_id, "user", "生成注册功能测试用例")
        store.append(session_id, "assistant", "已生成注册功能测试用例")
        messages = store.get(session_id)
        assert len(messages) >= 2, "消息存储失败"
        print("✅ 消息存储兼容")

        # 测试指针系统
        pointers = store.get_pointers(session_id)
        assert "prd_login" in pointers, "指针系统失败"
        assert "testcase_login" in pointers, "指针系统失败"
        print("✅ 指针系统兼容")

        # 测试文档列表
        docs = store.list_session_docs(session_id)
        assert len(docs) >= 2, "文档列表失败"
        print("✅ 文档列表兼容")
    except Exception as e:
        print(f"❌ 兼容性测试失败: {e}")
        return False

    print("\n" + "=" * 60)
    print(" 🎉 端到端集成测试全部通过！")
    print("=" * 60)

    return True


def test_performance_benchmark():
    """
    性能基准测试
    """
    print("\n" + "=" * 60)
    print(" 性能基准测试")
    print("=" * 60)

    import time

    store = ImprovedSessionStore()
    session_id = "perf_test"

    # 1. 批量插入性能
    print("\n=== 测试 1: 批量文档插入 ===")
    doc_count = 50
    start = time.time()

    for i in range(doc_count):
        content = f"这是第 {i+1} 个测试文档。内容包含登录、注册、权限管理等功能的需求描述。"
        store.put_doc(
            content=content,
            title=f"测试文档 {i+1}",
            kind="test",
            session_id=session_id,
            tags=["性能测试"]
        )

    elapsed = time.time() - start
    print(f"✅ 插入 {doc_count} 个文档耗时: {elapsed:.2f}s")
    print(f"   平均每个文档: {elapsed/doc_count*1000:.2f}ms")

    # 2. 批量检索性能
    print("\n=== 测试 2: 批量语义检索 ===")
    queries = [
        "登录功能测试",
        "注册流程验证",
        "权限管理规则",
        "密码安全策略",
        "用户数据保护",
    ]

    all_doc_ids = list(store._docs.keys())[:20]  # 取前20个文档

    total_time = 0
    for query in queries:
        start = time.time()
        results = store.retrieve(all_doc_ids, query, top_k=5)
        elapsed = time.time() - start
        total_time += elapsed

    avg_time = total_time / len(queries)
    print(f"✅ {len(queries)} 次检索总耗时: {total_time:.2f}s")
    print(f"   平均每次检索: {avg_time*1000:.2f}ms")

    if avg_time < 0.5:
        print("   🏆 性能优秀: <500ms")
    elif avg_time < 1.0:
        print("   ✅ 性能良好: <1s")
    else:
        print("   ⚠️  性能一般: >1s")

    # 3. 历史搜索性能
    print("\n=== 测试 3: 历史用例检索 ===")
    # 先归档几个测试用例
    for i in range(5):
        doc_id = list(store._docs.keys())[i]
        store.archive_to_history(doc_id, session_id)

    start = time.time()
    for query in queries:
        store.search_history(query, top_k=3)
    elapsed = time.time() - start

    avg_time = elapsed / len(queries)
    print(f"✅ {len(queries)} 次历史搜索耗时: {elapsed:.2f}s")
    print(f"   平均每次搜索: {avg_time*1000:.2f}ms")

    print("\n性能测试完成！")


def main():
    """主函数"""
    results = []

    # 1. 端到端测试
    print("\n开始执行端到端集成测试...")
    success = test_e2e_workflow()
    results.append(("端到端集成测试", success))

    # 2. 性能测试
    print("\n开始执行性能基准测试...")
    try:
        test_performance_benchmark()
        results.append(("性能基准测试", True))
    except Exception as e:
        print(f"❌ 性能测试失败: {e}")
        results.append(("性能基准测试", False))

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
        print("\n🎉 所有测试通过！系统可以投入使用。")
        return 0
    else:
        print("\n⚠️ 部分测试失败，请检查问题。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
