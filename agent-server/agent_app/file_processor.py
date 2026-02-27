"""
文件处理器：PDF/图片多模态解析
Week 2: 支持 PDF 和图片文件上传分析
Week 7: 集成 PDF 解析缓存，避免重复解析
Week 8: 支持 PDF 转图片，用于多模态 AI 处理
"""
import io
import os
import base64
from typing import Dict, Any, Optional, Union, BinaryIO, List, Tuple
from pathlib import Path
from agent_app.cache_manager import pdf_cache

# PDF 解析
try:
    import pdfplumber
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

# PDF 转图片
try:
    import pdf2image
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

# 图片处理
try:
    from PIL import Image
    IMAGE_AVAILABLE = True
except ImportError:
    IMAGE_AVAILABLE = False

# OCR
try:
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


class FileProcessor:
    """
    多模态文件处理器

    支持的文件类型：
    - PDF: 纯文本PDF、扫描件PDF（OCR）
    - 图片: PNG、JPG、JPEG、WebP、GIF
    - 文本: TXT、MD、Markdown
    """

    # 支持的文件类型
    SUPPORTED_PDF_TYPES = ['.pdf']
    SUPPORTED_IMAGE_TYPES = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']
    SUPPORTED_TEXT_TYPES = ['.txt', '.md', '.markdown']

    @staticmethod
    def check_dependencies() -> Dict[str, bool]:
        """
        检查依赖是否安装

        Returns:
            依赖状态字典
        """
        return {
            'pdf': PDF_AVAILABLE,
            'pdf2image': PDF2IMAGE_AVAILABLE,
            'image': IMAGE_AVAILABLE,
            'ocr': OCR_AVAILABLE,
        }

    @staticmethod
    def get_file_type(filename: str) -> str:
        """
        根据文件名获取文件类型

        Args:
            filename: 文件名

        Returns:
            文件类型: 'pdf', 'image', 'text', 'unknown'
        """
        ext = Path(filename).suffix.lower()

        if ext in FileProcessor.SUPPORTED_PDF_TYPES:
            return 'pdf'
        elif ext in FileProcessor.SUPPORTED_IMAGE_TYPES:
            return 'image'
        elif ext in FileProcessor.SUPPORTED_TEXT_TYPES:
            return 'text'
        else:
            return 'unknown'

    @staticmethod
    @pdf_cache(ttl=2592000)  # 缓存30天
    def extract_pdf_text(file_obj: Union[str, BinaryIO], use_ocr: bool = False) -> str:
        """
        提取 PDF 文本

        Args:
            file_obj: 文件路径或文件对象
            use_ocr: 是否使用 OCR（针对扫描件）

        Returns:
            提取的文本内容
        """
        if not PDF_AVAILABLE:
            raise RuntimeError("PDF dependencies not installed. Run: pip install pdfplumber PyPDF2")

        text_parts = []

        try:
            # 方法 1: 使用 pdfplumber（推荐，效果最好）
            with pdfplumber.open(file_obj) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        page_text = page.extract_text()

                        if page_text and page_text.strip():
                            text_parts.append(f"=== 第 {page_num} 页 ===\n{page_text.strip()}")
                        elif use_ocr and OCR_AVAILABLE:
                            # 如果提取不到文本且启用 OCR，尝试 OCR
                            ocr_text = FileProcessor._ocr_pdf_page(page)
                            if ocr_text:
                                text_parts.append(f"=== 第 {page_num} 页 (OCR) ===\n{ocr_text.strip()}")
                    except Exception as e:
                        print(f"⚠️  第 {page_num} 页处理失败: {e}")
                        continue

        except Exception as e:
            print(f"⚠️  pdfplumber 解析失败，尝试 PyPDF2: {e}")

            # 方法 2: 回退到 PyPDF2
            try:
                if isinstance(file_obj, str):
                    with open(file_obj, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        for page_num, page in enumerate(reader.pages, 1):
                            page_text = page.extract_text()
                            if page_text and page_text.strip():
                                text_parts.append(f"=== 第 {page_num} 页 ===\n{page_text.strip()}")
                else:
                    reader = PyPDF2.PdfReader(file_obj)
                    for page_num, page in enumerate(reader.pages, 1):
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            text_parts.append(f"=== 第 {page_num} 页 ===\n{page_text.strip()}")
            except Exception as e2:
                raise RuntimeError(f"PDF 解析失败 (pdfplumber 和 PyPDF2 都失败): {e2}")

        if not text_parts:
            if use_ocr and not OCR_AVAILABLE:
                return "⚠️  PDF 无法提取文本（可能是扫描件），但 OCR 功能未安装。请安装: pip install pytesseract"
            elif not use_ocr:
                return "⚠️  PDF 无法提取文本（可能是扫描件）。提示：可以启用 OCR 功能处理扫描件。"
            else:
                return "⚠️  PDF 处理失败，无法提取任何文本内容。"

        return "\n\n".join(text_parts)

    @staticmethod
    def pdf_to_images(
        file_obj: Union[str, BinaryIO],
        dpi: int = 150,
        max_pages: int = 20,
        image_format: str = "PNG"
    ) -> List[Dict[str, Any]]:
        """
        将 PDF 转换为图片列表（用于多模态 AI 处理）

        Args:
            file_obj: 文件路径或文件对象
            dpi: 图片分辨率，默认 150（平衡质量和大小）
            max_pages: 最大处理页数，默认 20 页
            image_format: 图片格式，支持 PNG/JPEG

        Returns:
            图片列表，每项包含:
            - page_num: 页码
            - base64: base64 编码的图片数据
            - media_type: MIME 类型
            - width: 图片宽度
            - height: 图片高度
        """
        if not PDF2IMAGE_AVAILABLE:
            raise RuntimeError(
                "pdf2image 未安装。请安装: pip install pdf2image\n"
                "注意: pdf2image 依赖 poppler，需要单独安装:\n"
                "  - macOS: brew install poppler\n"
                "  - Ubuntu: apt-get install poppler-utils\n"
                "  - Windows: 下载 poppler for Windows"
            )

        images_data = []
        media_type = "image/png" if image_format.upper() == "PNG" else "image/jpeg"

        try:
            # 使用 pdf2image 转换
            if isinstance(file_obj, str):
                # 文件路径
                images = pdf2image.convert_from_path(
                    file_obj,
                    dpi=dpi,
                    first_page=1,
                    last_page=max_pages,
                    fmt=image_format.lower()
                )
            else:
                # 文件对象
                file_obj.seek(0)
                pdf_bytes = file_obj.read()
                images = pdf2image.convert_from_bytes(
                    pdf_bytes,
                    dpi=dpi,
                    first_page=1,
                    last_page=max_pages,
                    fmt=image_format.lower()
                )

            for page_num, img in enumerate(images, 1):
                # 转为 base64
                buffer = io.BytesIO()
                img.save(buffer, format=image_format.upper())
                img_base64 = base64.standard_b64encode(buffer.getvalue()).decode('utf-8')

                images_data.append({
                    "page_num": page_num,
                    "base64": img_base64,
                    "media_type": media_type,
                    "width": img.width,
                    "height": img.height,
                })

            print(f"✅ PDF 转图片完成: {len(images_data)} 页")
            return images_data

        except Exception as e:
            print(f"⚠️ PDF 转图片失败: {e}")
            raise RuntimeError(f"PDF 转图片失败: {e}")

    @staticmethod
    def pdf_to_images_with_text(
        file_obj: Union[str, BinaryIO],
        dpi: int = 150,
        max_pages: int = 20,
        extract_text: bool = True
    ) -> Dict[str, Any]:
        """
        将 PDF 转换为图片，同时提取文本（混合模式）

        适用于需要同时使用图片和文本的场景

        Args:
            file_obj: 文件路径或文件对象
            dpi: 图片分辨率
            max_pages: 最大处理页数
            extract_text: 是否同时提取文本

        Returns:
            {
                'images': [...],      # 图片列表
                'text': str,          # 提取的文本
                'page_count': int,    # 总页数
                'mode': 'multimodal'  # 处理模式
            }
        """
        result = {
            'images': [],
            'text': '',
            'page_count': 0,
            'mode': 'multimodal'
        }

        # 提取图片
        try:
            result['images'] = FileProcessor.pdf_to_images(
                file_obj, dpi=dpi, max_pages=max_pages
            )
            result['page_count'] = len(result['images'])
        except Exception as e:
            print(f"⚠️ PDF 图片提取失败，回退到纯文本模式: {e}")
            result['mode'] = 'text_only'

        # 提取文本
        if extract_text:
            try:
                # 重置文件指针
                if hasattr(file_obj, 'seek'):
                    file_obj.seek(0)
                result['text'] = FileProcessor.extract_pdf_text(file_obj, use_ocr=False)
            except Exception as e:
                print(f"⚠️ PDF 文本提取失败: {e}")

        return result

    @staticmethod
    def image_to_base64(
        file_obj: Union[str, BinaryIO],
        max_size: Tuple[int, int] = (1568, 1568),
        quality: int = 85
    ) -> Dict[str, Any]:
        """
        将图片转换为 base64（用于多模态 AI 处理）

        Args:
            file_obj: 文件路径或文件对象
            max_size: 最大尺寸，超过会等比缩放
            quality: JPEG 质量

        Returns:
            {
                'base64': str,
                'media_type': str,
                'width': int,
                'height': int
            }
        """
        if not IMAGE_AVAILABLE:
            raise RuntimeError("Pillow 未安装。请安装: pip install Pillow")

        try:
            if isinstance(file_obj, str):
                img = Image.open(file_obj)
            else:
                file_obj.seek(0)
                img = Image.open(file_obj)

            # 转换模式
            if img.mode in ('RGBA', 'LA', 'P'):
                # 有透明通道，使用 PNG
                output_format = 'PNG'
                media_type = 'image/png'
            else:
                # 无透明通道，使用 JPEG
                output_format = 'JPEG'
                media_type = 'image/jpeg'
                if img.mode != 'RGB':
                    img = img.convert('RGB')

            # 缩放（如果超过最大尺寸）
            if img.width > max_size[0] or img.height > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)

            # 转为 base64
            buffer = io.BytesIO()
            if output_format == 'JPEG':
                img.save(buffer, format=output_format, quality=quality)
            else:
                img.save(buffer, format=output_format)

            img_base64 = base64.standard_b64encode(buffer.getvalue()).decode('utf-8')

            return {
                'base64': img_base64,
                'media_type': media_type,
                'width': img.width,
                'height': img.height
            }

        except Exception as e:
            raise RuntimeError(f"图片处理失败: {e}")

    @staticmethod
    def _ocr_pdf_page(page) -> str:
        """
        对 PDF 页面进行 OCR 识别

        Args:
            page: pdfplumber Page 对象

        Returns:
            OCR 识别的文本
        """
        if not OCR_AVAILABLE or not IMAGE_AVAILABLE:
            return ""

        try:
            # 将 PDF 页面转换为图片
            img = page.to_image(resolution=300)  # 300 DPI 高清晰度
            pil_img = img.original

            # OCR 识别（支持中英文）
            text = pytesseract.image_to_string(pil_img, lang='chi_sim+eng')
            return text
        except Exception as e:
            print(f"⚠️  OCR 识别失败: {e}")
            return ""

    @staticmethod
    def extract_image_text(file_obj: Union[str, BinaryIO], preprocess: bool = True) -> str:
        """
        从图片中提取文本（OCR）

        Args:
            file_obj: 文件路径或文件对象
            preprocess: 是否预处理图片（提升识别率）

        Returns:
            OCR 识别的文本
        """
        if not IMAGE_AVAILABLE:
            raise RuntimeError("Image dependencies not installed. Run: pip install Pillow")

        if not OCR_AVAILABLE:
            raise RuntimeError("OCR dependencies not installed. Run: pip install pytesseract")

        try:
            # 打开图片
            if isinstance(file_obj, str):
                img = Image.open(file_obj)
            else:
                img = Image.open(file_obj)

            # 预处理（可选，提升识别率）
            if preprocess:
                img = FileProcessor._preprocess_image(img)

            # OCR 识别（中英文混合）
            text = pytesseract.image_to_string(img, lang='chi_sim+eng')

            if not text or not text.strip():
                return "⚠️  图片中未识别到文本内容。"

            return text.strip()

        except Exception as e:
            raise RuntimeError(f"图片 OCR 识别失败: {e}")

    @staticmethod
    def _preprocess_image(img: Image.Image) -> Image.Image:
        """
        图片预处理（提升 OCR 识别率）

        处理步骤：
        1. 转为灰度图
        2. 调整对比度
        3. 二值化（可选）

        Args:
            img: PIL Image 对象

        Returns:
            处理后的图片
        """
        from PIL import ImageEnhance

        # 1. 转为灰度图
        if img.mode != 'L':
            img = img.convert('L')

        # 2. 增强对比度
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)  # 对比度提升 2 倍

        # 3. 调整亮度
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.2)  # 亮度提升 20%

        return img

    @staticmethod
    def extract_text(file_obj: Union[str, BinaryIO]) -> str:
        """
        从纯文本文件提取内容

        Args:
            file_obj: 文件路径或文件对象

        Returns:
            文本内容
        """
        try:
            if isinstance(file_obj, str):
                with open(file_obj, 'r', encoding='utf-8') as f:
                    return f.read()
            else:
                content = file_obj.read()
                if isinstance(content, bytes):
                    return content.decode('utf-8')
                return content
        except UnicodeDecodeError:
            # 尝试其他编码
            try:
                if isinstance(file_obj, str):
                    with open(file_obj, 'r', encoding='gbk') as f:
                        return f.read()
                else:
                    file_obj.seek(0)
                    return file_obj.read().decode('gbk')
            except Exception:
                raise RuntimeError("文本文件编码识别失败，请确保文件为 UTF-8 或 GBK 编码")

    @staticmethod
    def process_file(
        file_obj: Union[str, BinaryIO],
        filename: str,
        auto_detect: bool = True,
        use_ocr: bool = True,
        multimodal: bool = False,
        dpi: int = 150,
        max_pages: int = 20,
        skip_image_conversion: bool = False,  # Gemini: 跳过图片转换，PDF 直传
    ) -> Dict[str, Any]:
        """
        智能处理文件（自动识别类型）

        Args:
            file_obj: 文件路径或文件对象
            filename: 文件名（用于类型判断）
            auto_detect: 是否自动检测文件类型
            use_ocr: 是否对扫描件 PDF 和图片使用 OCR
            multimodal: 是否启用多模态模式（将 PDF/图片转为 base64）
            dpi: 多模态模式下 PDF 转图片的分辨率
            max_pages: 多模态模式下最大处理页数
            skip_image_conversion: 是否跳过图片转换（Gemini 模型支持 PDF 直传）

        Returns:
            处理结果字典
            {
                'success': bool,
                'file_type': str,
                'content': str,
                'images': list (if multimodal),
                'pdf_base64': str or None (raw PDF for Gemini),
                'metadata': dict,
                'error': str (if failed)
            }
        """
        file_type = FileProcessor.get_file_type(filename)

        result = {
            'success': False,
            'file_type': file_type,
            'content': '',
            'images': [],
            'pdf_base64': None,  # Gemini: PDF 原始 base64 数据
            'metadata': {
                'filename': filename,
                'ocr_used': False,
                'multimodal': multimodal,
            },
            'error': None
        }

        try:
            if file_type == 'pdf':
                if not PDF_AVAILABLE:
                    raise RuntimeError("PDF 解析功能未安装。请安装: pip install pdfplumber PyPDF2")

                # 始终保存 PDF 原始 base64（供 Gemini 模型直传使用）
                if hasattr(file_obj, 'seek'):
                    file_obj.seek(0)
                if hasattr(file_obj, 'read'):
                    raw_bytes = file_obj.read()
                else:
                    with open(file_obj, 'rb') as f:
                        raw_bytes = f.read()
                result['pdf_base64'] = base64.standard_b64encode(raw_bytes).decode('utf-8')
                if hasattr(file_obj, 'seek'):
                    file_obj.seek(0)

                if multimodal and not skip_image_conversion:
                    # 现有路径：提取文本 + 转图片（Claude 等模型）
                    multimodal_result = FileProcessor.pdf_to_images_with_text(
                        file_obj, dpi=dpi, max_pages=max_pages, extract_text=True
                    )
                    result['content'] = multimodal_result['text']
                    result['images'] = multimodal_result['images']
                    result['metadata']['page_count'] = multimodal_result['page_count']
                    result['metadata']['mode'] = multimodal_result['mode']
                elif multimodal and skip_image_conversion:
                    # Gemini 路径：仅提取文本，跳过图片转换（PDF 原始数据已保存）
                    result['content'] = FileProcessor.extract_pdf_text(file_obj, use_ocr=False)
                    result['metadata']['mode'] = 'gemini_pdf_direct'
                    print(f"⚡ [Gemini直传] {filename}: 跳过图片转换，使用 PDF 直传模式")
                else:
                    # 传统模式：仅提取文本
                    content = FileProcessor.extract_pdf_text(file_obj, use_ocr=use_ocr)
                    result['content'] = content
                    result['metadata']['ocr_used'] = use_ocr and OCR_AVAILABLE

                result['success'] = True

            elif file_type == 'image':
                if not IMAGE_AVAILABLE:
                    raise RuntimeError("图片处理功能未安装。请安装: pip install Pillow")

                if multimodal:
                    # 多模态模式：转为 base64
                    img_data = FileProcessor.image_to_base64(file_obj)
                    result['images'] = [{
                        'page_num': 1,
                        **img_data
                    }]
                    result['metadata']['mode'] = 'multimodal'
                else:
                    # 传统模式：OCR 提取文本
                    if not OCR_AVAILABLE:
                        raise RuntimeError("OCR 功能未安装。请安装: pip install pytesseract")
                    content = FileProcessor.extract_image_text(file_obj, preprocess=True)
                    result['content'] = content
                    result['metadata']['ocr_used'] = True

                result['success'] = True

            elif file_type == 'text':
                content = FileProcessor.extract_text(file_obj)
                result['content'] = content
                result['success'] = True

            else:
                raise RuntimeError(f"不支持的文件类型: {filename}。支持的类型: PDF、图片(PNG/JPG/WebP)、文本(TXT/MD)")

        except Exception as e:
            result['error'] = str(e)
            result['success'] = False

        return result

    @staticmethod
    def get_file_info(file_obj: Union[str, BinaryIO], filename: str) -> Dict[str, Any]:
        """
        获取文件基本信息

        Args:
            file_obj: 文件路径或文件对象
            filename: 文件名

        Returns:
            文件信息字典
        """
        info = {
            'filename': filename,
            'file_type': FileProcessor.get_file_type(filename),
            'size': 0,
            'extension': Path(filename).suffix.lower(),
        }

        try:
            if isinstance(file_obj, str):
                info['size'] = os.path.getsize(file_obj)
            else:
                # 对于文件对象，尝试获取大小
                current_pos = file_obj.tell()
                file_obj.seek(0, 2)  # 移动到文件末尾
                info['size'] = file_obj.tell()
                file_obj.seek(current_pos)  # 恢复原位置
        except Exception:
            pass

        # 添加文件类型可读性描述
        type_desc = {
            'pdf': 'PDF 文档',
            'image': '图片文件',
            'text': '文本文件',
            'unknown': '未知类型'
        }
        info['type_description'] = type_desc.get(info['file_type'], '未知')

        return info
