#!/usr/bin/env python3
"""
测试 AI 质检评估模块
验证 Evaluator 的逻辑和 API 集成
"""
import sys
import os
import json

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_evaluator_module_loading():
    """测试 Evaluator 模块加载"""
    print("=== 测试 Evaluator 模块加载 ===")

    try:
        from agent_app.evaluator import Evaluator

        print("✅ Evaluator 模块加载成功")

        # 检查方法是否存在
        methods = [
            "evaluate_testcases",
            "evaluate_simple",
            "_build_user_prompt",
            "_parse_json_report",
        ]

        missing_methods = []
        for method_name in methods:
            if not hasattr(Evaluator, method_name):
                missing_methods.append(method_name)

        if missing_methods:
            print(f"❌ 缺少方法: {', '.join(missing_methods)}")
            return False
        else:
            print("✅ 所有必需方法已实现")
            return True

    except Exception as e:
        print(f"❌ 模块加载失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_evaluator_prompt_loading():
    """测试评估 Prompt 加载"""
    print("\n=== 测试评估 Prompt 加载 ===")

    try:
        from pathlib import Path

        prompt_path = Path(__file__).parent.parent / "agent_app" / "prompts" / "evaluator_system.md"

        if not prompt_path.exists():
            print(f"❌ Prompt 文件不存在: {prompt_path}")
            return False

        prompt_content = prompt_path.read_text(encoding="utf-8")

        if len(prompt_content) < 100:
            print("❌ Prompt 内容过短")
            return False

        print(f"✅ Prompt 文件加载成功")
        print(f"   文件长度: {len(prompt_content)} 字符")

        # 检查关键内容
        keywords = [
            "覆盖率评估",
            "测试用例质量",
            "逻辑正确性",
            "安全性测试",
            "JSON",
        ]

        found_keywords = [kw for kw in keywords if kw in prompt_content]
        print(f"   关键内容: {len(found_keywords)}/{len(keywords)}")

        if len(found_keywords) >= 4:
            print("✅ Prompt 内容完整")
            return True
        else:
            print("⚠️  Prompt 内容可能不完整")
            return False

    except Exception as e:
        print(f"❌ Prompt 加载失败: {e}")
        return False


def test_json_parsing():
    """测试 JSON 解析功能"""
    print("\n=== 测试 JSON 解析功能 ===")

    try:
        from agent_app.evaluator import Evaluator

        evaluator = Evaluator()

        # 测试用例 1: 纯 JSON
        json_text1 = '{"score": 75, "summary": "测试通过"}'
        result1 = evaluator._parse_json_report(json_text1)

        if result1 and result1.get("score") == 75:
            print("✅ 纯 JSON 解析成功")
        else:
            print("❌ 纯 JSON 解析失败")
            return False

        # 测试用例 2: Markdown 代码块
        json_text2 = """
这是一些说明文字

```json
{
  "score": 85,
  "summary": "质量良好"
}
```

更多说明
"""
        result2 = evaluator._parse_json_report(json_text2)

        if result2 and result2.get("score") == 85:
            print("✅ Markdown 代码块解析成功")
        else:
            print("❌ Markdown 代码块解析失败")
            return False

        # 测试用例 3: 混合文本
        json_text3 = """
评估结果如下：

{
  "score": 60,
  "summary": "需要改进",
  "coverage_gap": ["缺少边界值测试"]
}

以上是评估报告。
"""
        result3 = evaluator._parse_json_report(json_text3)

        if result3 and result3.get("score") == 60:
            print("✅ 混合文本解析成功")
        else:
            print("❌ 混合文本解析失败")
            return False

        print("✅ 所有 JSON 解析测试通过")
        return True

    except Exception as e:
        print(f"❌ JSON 解析测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_user_prompt_building():
    """测试用户 Prompt 构建"""
    print("\n=== 测试用户 Prompt 构建 ===")

    try:
        from agent_app.evaluator import Evaluator

        evaluator = Evaluator()

        prd_text = "用户登录功能：支持邮箱+密码登录"
        testcases_text = "TC_001: 正常登录\nTC_002: 密码错误"
        rag_context = "参考：测试规范要求覆盖边界值"

        user_prompt = evaluator._build_user_prompt(
            prd_text=prd_text,
            testcases_text=testcases_text,
            rag_context=rag_context
        )

        # 验证 Prompt 包含必要内容
        checks = [
            ("原始 PRD", "【原始 PRD】" in user_prompt),
            ("测试用例", "【待评审测试用例】" in user_prompt),
            ("RAG 上下文", "【参考规范和历史用例】" in user_prompt),
            ("PRD 内容", prd_text in user_prompt),
            ("测试用例内容", testcases_text in user_prompt),
            ("RAG 内容", rag_context in user_prompt),
        ]

        failed_checks = [name for name, passed in checks if not passed]

        if failed_checks:
            print(f"❌ Prompt 缺少内容: {', '.join(failed_checks)}")
            return False
        else:
            print("✅ Prompt 构建正确")
            print(f"   Prompt 长度: {len(user_prompt)} 字符")
            return True

    except Exception as e:
        print(f"❌ Prompt 构建测试失败: {e}")
        return False


def test_api_endpoints_defined():
    """测试 API 端点是否定义"""
    print("\n=== 测试 API 端点定义 ===")

    try:
        app_factory_path = os.path.join(
            os.path.dirname(__file__),
            "..", "agent_app", "app_factory.py"
        )

        with open(app_factory_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 检查端点是否定义
        endpoints = [
            ("/api/evaluate", "POST"),
            ("/api/evaluate/simple", "POST"),
        ]

        found_endpoints = []
        missing_endpoints = []

        for endpoint, method in endpoints:
            pattern = f'@app.{method.lower()}("{endpoint}")'
            if pattern in content:
                found_endpoints.append(f"{method} {endpoint}")
            else:
                missing_endpoints.append(f"{method} {endpoint}")

        if missing_endpoints:
            print(f"❌ 缺少端点: {', '.join(missing_endpoints)}")
            return False
        else:
            print("✅ 所有评估 API 端点已定义:")
            for endpoint in found_endpoints:
                print(f"   - {endpoint}")
            return True

    except Exception as e:
        print(f"❌ 检查失败: {e}")
        return False


def test_evaluator_imports():
    """测试 app_factory 中的 Evaluator 导入"""
    print("\n=== 测试 Evaluator 导入 ===")

    try:
        app_factory_path = os.path.join(
            os.path.dirname(__file__),
            "..", "agent_app", "app_factory.py"
        )

        with open(app_factory_path, "r", encoding="utf-8") as f:
            content = f.read()

        if "from agent_app.evaluator import Evaluator" in content:
            print("✅ Evaluator 已导入")
            return True
        else:
            print("❌ Evaluator 未导入")
            return False

    except Exception as e:
        print(f"❌ 检查失败: {e}")
        return False


def test_code_quality():
    """测试代码质量"""
    print("\n=== 测试代码质量 ===")

    try:
        files_to_check = [
            "agent_app/evaluator.py",
            "agent_app/app_factory.py",
        ]

        all_valid = True
        for file_path in files_to_check:
            full_path = os.path.join(
                os.path.dirname(__file__),
                "..", file_path
            )

            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    code = f.read()

                compile(code, full_path, "exec")
                print(f"✅ {file_path} - 语法正确")

            except SyntaxError as e:
                print(f"❌ {file_path} - 语法错误: {e}")
                all_valid = False

        return all_valid

    except Exception as e:
        print(f"❌ 代码质量检查失败: {e}")
        return False


def main():
    """主测试流程"""
    print("=" * 60)
    print(" Week 5: AI 质检评估模块测试")
    print("=" * 60)
    print("\nℹ️  此测试验证 Evaluator 模块集成是否正确")
    print("   完整功能测试需要实际调用 LLM API")

    results = []

    # 1. 模块加载
    results.append(("Evaluator 模块加载", test_evaluator_module_loading()))

    # 2. Prompt 加载
    results.append(("评估 Prompt 加载", test_evaluator_prompt_loading()))

    # 3. JSON 解析
    results.append(("JSON 解析功能", test_json_parsing()))

    # 4. Prompt 构建
    results.append(("用户 Prompt 构建", test_user_prompt_building()))

    # 5. API 端点
    results.append(("API 端点定义", test_api_endpoints_defined()))

    # 6. Evaluator 导入
    results.append(("Evaluator 导入", test_evaluator_imports()))

    # 7. 代码质量
    results.append(("代码质量检查", test_code_quality()))

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
        print("\n🎉 所有集成测试通过！AI 质检评估模块集成正确。")
        print("\n✅ 已完成的集成:")
        print("  1. Evaluator 模块")
        print("     - evaluate_testcases()")
        print("     - evaluate_simple()")
        print("     - JSON 报告解析")
        print("\n  2. 评估系统 Prompt")
        print("     - 覆盖率评估（功能/边界/异常/安全）")
        print("     - 逻辑正确性检查")
        print("     - 漏测点识别")
        print("     - 改进建议生成")
        print("\n  3. API 端点")
        print("     - POST /api/evaluate")
        print("     - POST /api/evaluate/simple")
        print("\n📚 下一步：")
        print("  - 配置 API 密钥测试实际评估")
        print("  - 对比评估结果与人工审查")
        print("  - 优化评估 Prompt 减少误报")
        return 0
    else:
        print("\n⚠️  部分测试失败，请检查代码集成。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
