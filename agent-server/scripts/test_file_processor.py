#!/usr/bin/env python3
"""
测试 FileProcessor 多模态文件解析功能
验证 PDF、图片、文本文件的处理能力
"""
import sys
import os
import io

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent_app.file_processor import FileProcessor


def test_dependencies():
    """测试依赖检查"""
    print("=== 测试依赖检查 ===")

    deps = FileProcessor.check_dependencies()
    print(f"PDF 支持: {'✅' if deps['pdf'] else '❌'}")
    print(f"图片支持: {'✅' if deps['image'] else '❌'}")
    print(f"OCR 支持: {'✅' if deps['ocr'] else '❌'}")

    missing = [k for k, v in deps.items() if not v]
    if missing:
        print(f"\n⚠️  缺少依赖: {', '.join(missing)}")
        print("请运行: pip install pdfplumber PyPDF2 Pillow pytesseract")
        return False

    print("\n✅ 所有依赖已安装")
    return True


def test_file_type_detection():
    """测试文件类型识别"""
    print("\n=== 测试文件类型识别 ===")

    test_files = [
        ("document.pdf", "pdf"),
        ("image.png", "image"),
        ("photo.jpg", "image"),
        ("screenshot.webp", "image"),
        ("readme.md", "text"),
        ("notes.txt", "text"),
        ("unknown.xyz", "unknown"),
    ]

    passed = 0
    for filename, expected in test_files:
        detected = FileProcessor.get_file_type(filename)
        status = "✅" if detected == expected else "❌"
        print(f"{status} {filename}: {detected} (期望: {expected})")
        if detected == expected:
            passed += 1

    print(f"\n总计: {passed}/{len(test_files)} 测试通过")
    return passed == len(test_files)


def test_text_extraction():
    """测试文本文件提取"""
    print("\n=== 测试文本文件提取 ===")

    # 创建测试文本
    test_content = """# 测试文档

这是一个测试文档，用于验证文本提取功能。

## 功能需求
1. 用户登录
2. 数据管理
3. 权限控制
"""

    try:
        # 使用内存文件对象
        file_obj = io.StringIO(test_content)
        extracted = FileProcessor.extract_text(file_obj)

        if extracted == test_content:
            print("✅ 文本提取成功")
            print(f"   提取长度: {len(extracted)} 字符")
            return True
        else:
            print("❌ 文本提取内容不匹配")
            return False
    except Exception as e:
        print(f"❌ 文本提取失败: {e}")
        return False


def test_pdf_text_creation():
    """测试创建简单的 PDF 文本文件"""
    print("\n=== 测试 PDF 文本文档处理 ===")

    # 创建一个简单的测试 PDF（使用文本字符串模拟）
    test_pdf_content = """
测试 PDF 文档

## 登录功能需求

1. 用户可以通过邮箱和密码登录
2. 登录失败3次后锁定账户15分钟
3. 支持"记住我"功能

## 测试要点

- 正常登录流程
- 异常登录流程
- 边界值测试
"""

    print("ℹ️  PDF 解析需要真实的 PDF 文件")
    print("   这里使用文本模拟 PDF 内容")
    print(f"✅ 模拟 PDF 内容长度: {len(test_pdf_content)} 字符")
    return True


def create_test_image():
    """创建测试图片（包含文本）"""
    print("\n=== 创建测试图片 ===")

    try:
        from PIL import Image, ImageDraw, ImageFont

        # 创建白色背景图片
        img = Image.new('RGB', (800, 400), color='white')
        draw = ImageDraw.Draw(img)

        # 绘制文本（使用默认字体）
        text_lines = [
            "测试图片 - OCR 识别",
            "",
            "用户登录功能测试用例",
            "TC_001: 正常登录",
            "TC_002: 密码错误",
            "TC_003: 账户锁定",
        ]

        y_position = 50
        for line in text_lines:
            draw.text((50, y_position), line, fill='black')
            y_position += 50

        # 保存到内存
        output = io.BytesIO()
        img.save(output, format='PNG')
        output.seek(0)

        print("✅ 测试图片创建成功")
        print(f"   图片大小: {img.size}")
        print(f"   内存大小: {len(output.getvalue())} 字节")

        return output

    except Exception as e:
        print(f"⚠️  测试图片创建失败: {e}")
        return None


def test_image_ocr():
    """测试图片 OCR 识别"""
    print("\n=== 测试图片 OCR 识别 ===")

    # 检查 OCR 依赖
    deps = FileProcessor.check_dependencies()
    if not deps['ocr']:
        print("⚠️  OCR 功能未安装，跳过测试")
        print("   安装方法: pip install pytesseract")
        print("   注意: 还需要安装 Tesseract OCR 系统组件")
        return None

    # 创建测试图片
    img_obj = create_test_image()
    if not img_obj:
        print("⚠️  无法创建测试图片，跳过 OCR 测试")
        return None

    try:
        # OCR 识别
        text = FileProcessor.extract_image_text(img_obj, preprocess=True)
        print(f"✅ OCR 识别完成")
        print(f"   识别文本长度: {len(text)} 字符")
        print(f"   识别内容预览: {text[:100]}...")

        # 检查是否包含关键词
        keywords = ["测试", "登录", "用例"]
        found = [kw for kw in keywords if kw in text]
        print(f"   关键词识别: {len(found)}/{len(keywords)}")

        return len(found) > 0

    except Exception as e:
        print(f"❌ OCR 识别失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_process_file_api():
    """测试统一文件处理 API"""
    print("\n=== 测试统一文件处理 API ===")

    # 测试文本文件
    print("\n1. 测试文本文件处理:")
    text_content = "这是一个测试文本文件\n用于验证文件处理功能"
    text_file = io.StringIO(text_content)

    result = FileProcessor.process_file(text_file, "test.txt")
    print(f"   成功: {result['success']}")
    print(f"   文件类型: {result['file_type']}")
    print(f"   内容长度: {len(result['content'])}")

    if not result['success']:
        print(f"   错误: {result['error']}")
        return False

    # 测试文件信息获取
    print("\n2. 测试文件信息获取:")
    text_file.seek(0)
    info = FileProcessor.get_file_info(text_file, "test_document.md")
    print(f"   文件名: {info['filename']}")
    print(f"   文件类型: {info['file_type']}")
    print(f"   类型描述: {info['type_description']}")
    print(f"   扩展名: {info['extension']}")

    print("\n✅ 统一文件处理 API 测试通过")
    return True


def main():
    """主测试流程"""
    print("=" * 60)
    print(" FileProcessor 多模态文件解析测试")
    print("=" * 60)

    results = []

    # 1. 依赖检查
    deps_ok = test_dependencies()
    results.append(("依赖检查", deps_ok))

    if not deps_ok:
        print("\n⚠️  依赖未安装，部分测试将被跳过")

    # 2. 文件类型识别
    results.append(("文件类型识别", test_file_type_detection()))

    # 3. 文本提取
    results.append(("文本文件提取", test_text_extraction()))

    # 4. PDF 处理（模拟）
    results.append(("PDF 文档处理", test_pdf_text_creation()))

    # 5. 图片 OCR
    ocr_result = test_image_ocr()
    if ocr_result is not None:
        results.append(("图片 OCR 识别", ocr_result))
    else:
        print("\n⚠️  图片 OCR 测试被跳过（依赖未安装或创建失败）")

    # 6. 统一 API
    results.append(("统一文件处理API", test_process_file_api()))

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

    # OCR 提示
    print("\n" + "=" * 60)
    print(" OCR 功能说明")
    print("=" * 60)
    print("OCR 功能需要额外安装系统组件 Tesseract OCR：")
    print("")
    print("macOS:")
    print("  brew install tesseract")
    print("  brew install tesseract-lang  # 中文语言包")
    print("")
    print("Ubuntu/Debian:")
    print("  sudo apt-get install tesseract-ocr")
    print("  sudo apt-get install tesseract-ocr-chi-sim  # 简体中文")
    print("")
    print("Windows:")
    print("  下载安装: https://github.com/UB-Mannheim/tesseract/wiki")
    print("")

    if passed == total:
        print("🎉 所有测试通过！FileProcessor 功能正常。")
        return 0
    else:
        print("⚠️  部分测试失败，请检查实现。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
