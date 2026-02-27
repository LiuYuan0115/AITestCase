"""
PDF Composer - Markdown + 图片合成 PDF
Phase 2: 将提取的页面内容（文本+图片）合成为 PDF 供 AI 读取
"""

import io
import re
import base64
import asyncio
import aiohttp
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

# 可选依赖检查
try:
    import markdown
    HAS_MARKDOWN = True
except ImportError:
    HAS_MARKDOWN = False
    logger.warning("markdown library not installed, using fallback conversion")

try:
    from weasyprint import HTML, CSS
    HAS_WEASYPRINT = True
except ImportError:
    HAS_WEASYPRINT = False
    logger.warning("weasyprint not installed, PDF generation will be limited")

try:
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.units import inch, cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False
    logger.warning("reportlab not installed, fallback PDF generation will fail")


@dataclass
class ImagePlaceholder:
    """图片占位符信息"""
    placeholder: str  # 例如 "[IMAGE_001]"
    cdn_url: str      # CDN URL


@dataclass
class ComposePdfOptions:
    """PDF 合成选项"""
    page_size: str = "A4"       # A4 或 Letter
    include_header: bool = True
    include_footer: bool = True
    title: str = "提取文档"
    margin_top: float = 2.0     # cm
    margin_bottom: float = 2.0  # cm
    margin_left: float = 2.5    # cm
    margin_right: float = 2.5   # cm


class PDFComposer:
    """将 Markdown + 图片合成 PDF"""

    def __init__(self, options: Optional[ComposePdfOptions] = None):
        self.options = options or ComposePdfOptions()
        self._image_cache: Dict[str, bytes] = {}

    async def download_image(
        self,
        url: str,
        timeout: int = 30
    ) -> Optional[bytes]:
        """下载图片并返回二进制数据"""
        if url in self._image_cache:
            return self._image_cache[url]

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                    if resp.status == 200:
                        data = await resp.read()
                        self._image_cache[url] = data
                        return data
                    else:
                        logger.warning(f"Failed to download image {url}: HTTP {resp.status}")
                        return None
        except Exception as e:
            logger.error(f"Error downloading image {url}: {e}")
            return None

    async def download_all_images(
        self,
        images: List[ImagePlaceholder],
        concurrency: int = 5
    ) -> Dict[str, bytes]:
        """并发下载所有图片"""
        semaphore = asyncio.Semaphore(concurrency)

        async def download_with_limit(img: ImagePlaceholder) -> Tuple[str, Optional[bytes]]:
            async with semaphore:
                data = await self.download_image(img.cdn_url)
                return (img.placeholder, data)

        tasks = [download_with_limit(img) for img in images]
        results = await asyncio.gather(*tasks)

        return {placeholder: data for placeholder, data in results if data is not None}

    def markdown_to_html(self, md_text: str) -> str:
        """将 Markdown 转为 HTML"""
        if HAS_MARKDOWN:
            html = markdown.markdown(
                md_text,
                extensions=['tables', 'fenced_code', 'nl2br']
            )
        else:
            # 简单的回退转换
            html = md_text
            # 标题
            html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
            html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
            html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
            # 粗体
            html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
            # 换行
            html = html.replace('\n\n', '</p><p>')
            html = f'<p>{html}</p>'

        return html

    def replace_placeholders_with_images(
        self,
        html: str,
        image_data: Dict[str, bytes]
    ) -> str:
        """将占位符替换为 base64 内嵌图片"""
        for placeholder, data in image_data.items():
            # 检测图片类型
            if data[:8] == b'\x89PNG\r\n\x1a\n':
                mime_type = 'image/png'
            elif data[:2] == b'\xff\xd8':
                mime_type = 'image/jpeg'
            elif data[:6] in (b'GIF87a', b'GIF89a'):
                mime_type = 'image/gif'
            elif data[:4] == b'RIFF' and data[8:12] == b'WEBP':
                mime_type = 'image/webp'
            else:
                mime_type = 'image/png'  # 默认

            b64_data = base64.b64encode(data).decode('utf-8')
            img_tag = f'<img src="data:{mime_type};base64,{b64_data}" style="max-width: 100%; height: auto;" />'

            # 替换占位符
            html = html.replace(placeholder, img_tag)

        # 清理未替换的占位符
        html = re.sub(r'\[IMAGE_\d{3}\]', '[图片加载失败]', html)

        return html

    def build_full_html(self, content_html: str) -> str:
        """构建完整的 HTML 文档"""
        page_size = self.options.page_size.lower()

        css = f"""
        @page {{
            size: {page_size};
            margin-top: {self.options.margin_top}cm;
            margin-bottom: {self.options.margin_bottom}cm;
            margin-left: {self.options.margin_left}cm;
            margin-right: {self.options.margin_right}cm;
        }}
        body {{
            font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #333;
        }}
        h1 {{ font-size: 24pt; margin-top: 24pt; margin-bottom: 12pt; color: #1a1a1a; }}
        h2 {{ font-size: 18pt; margin-top: 18pt; margin-bottom: 9pt; color: #333; }}
        h3 {{ font-size: 14pt; margin-top: 14pt; margin-bottom: 7pt; color: #444; }}
        p {{ margin-bottom: 10pt; }}
        img {{ max-width: 100%; height: auto; margin: 10pt 0; }}
        pre, code {{
            background: #f5f5f5;
            padding: 2pt 4pt;
            border-radius: 3pt;
            font-family: "SF Mono", Monaco, monospace;
            font-size: 10pt;
        }}
        pre {{
            padding: 10pt;
            overflow-x: auto;
        }}
        blockquote {{
            border-left: 3pt solid #ddd;
            padding-left: 10pt;
            margin-left: 0;
            color: #666;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 10pt 0;
        }}
        th, td {{
            border: 1pt solid #ddd;
            padding: 8pt;
            text-align: left;
        }}
        th {{
            background: #f5f5f5;
        }}
        .header {{
            text-align: center;
            border-bottom: 1pt solid #eee;
            padding-bottom: 10pt;
            margin-bottom: 20pt;
        }}
        .footer {{
            text-align: center;
            border-top: 1pt solid #eee;
            padding-top: 10pt;
            margin-top: 20pt;
            font-size: 10pt;
            color: #999;
        }}
        """

        header_html = ""
        if self.options.include_header:
            header_html = f'<div class="header"><h1>{self.options.title}</h1></div>'

        footer_html = ""
        if self.options.include_footer:
            footer_html = '<div class="footer">Generated by AITestCase</div>'

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{self.options.title}</title>
            <style>{css}</style>
        </head>
        <body>
            {header_html}
            {content_html}
            {footer_html}
        </body>
        </html>
        """

    async def compose(
        self,
        markdown_text: str,
        images: List[ImagePlaceholder]
    ) -> bytes:
        """
        合成 PDF

        Args:
            markdown_text: Markdown 内容（图片位置用占位符表示）
            images: 图片占位符和 CDN URL 列表

        Returns:
            PDF 二进制数据
        """
        logger.info(f"Composing PDF with {len(images)} images")

        # 1. 下载所有图片
        image_data = await self.download_all_images(images)
        logger.info(f"Downloaded {len(image_data)} images successfully")

        # 2. 转换 Markdown 为 HTML
        content_html = self.markdown_to_html(markdown_text)

        # 3. 替换占位符为内嵌图片
        content_html = self.replace_placeholders_with_images(content_html, image_data)

        # 4. 构建完整 HTML
        full_html = self.build_full_html(content_html)

        # 5. 生成 PDF
        if HAS_WEASYPRINT:
            return self._generate_pdf_weasyprint(full_html)
        elif HAS_REPORTLAB:
            return self._generate_pdf_reportlab(markdown_text, image_data)
        else:
            raise RuntimeError("No PDF generation library available. Install weasyprint or reportlab.")

    def _generate_pdf_weasyprint(self, html: str) -> bytes:
        """使用 WeasyPrint 生成 PDF"""
        html_doc = HTML(string=html)
        pdf_buffer = io.BytesIO()
        html_doc.write_pdf(pdf_buffer)
        return pdf_buffer.getvalue()

    def _generate_pdf_reportlab(
        self,
        markdown_text: str,
        image_data: Dict[str, bytes]
    ) -> bytes:
        """使用 ReportLab 生成 PDF（回退方案）"""
        buffer = io.BytesIO()

        page_size = A4 if self.options.page_size.upper() == "A4" else letter

        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            topMargin=self.options.margin_top * cm,
            bottomMargin=self.options.margin_bottom * cm,
            leftMargin=self.options.margin_left * cm,
            rightMargin=self.options.margin_right * cm,
        )

        styles = getSampleStyleSheet()
        story = []

        # 标题
        if self.options.include_header:
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                alignment=TA_CENTER,
                spaceAfter=20,
            )
            story.append(Paragraph(self.options.title, title_style))
            story.append(Spacer(1, 20))

        # 处理内容
        lines = markdown_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                story.append(Spacer(1, 6))
                continue

            # 检查是否是图片占位符
            img_match = re.match(r'\[IMAGE_(\d{3})\]', line)
            if img_match:
                placeholder = f"[IMAGE_{img_match.group(1)}]"
                if placeholder in image_data:
                    img_bytes = image_data[placeholder]
                    img_buffer = io.BytesIO(img_bytes)
                    try:
                        img = RLImage(img_buffer)
                        # 限制图片宽度
                        max_width = page_size[0] - (self.options.margin_left + self.options.margin_right) * cm
                        if img.drawWidth > max_width:
                            ratio = max_width / img.drawWidth
                            img.drawWidth = max_width
                            img.drawHeight *= ratio
                        story.append(img)
                        story.append(Spacer(1, 10))
                    except Exception as e:
                        logger.error(f"Failed to add image: {e}")
                        story.append(Paragraph("[图片加载失败]", styles['Normal']))
                continue

            # 标题处理
            if line.startswith('### '):
                story.append(Paragraph(line[4:], styles['Heading3']))
            elif line.startswith('## '):
                story.append(Paragraph(line[3:], styles['Heading2']))
            elif line.startswith('# '):
                story.append(Paragraph(line[2:], styles['Heading1']))
            else:
                # 普通段落
                story.append(Paragraph(line, styles['Normal']))

        # 页脚
        if self.options.include_footer:
            story.append(Spacer(1, 30))
            footer_style = ParagraphStyle(
                'Footer',
                parent=styles['Normal'],
                fontSize=10,
                textColor='#999999',
                alignment=TA_CENTER,
            )
            story.append(Paragraph("Generated by AITestCase", footer_style))

        doc.build(story)
        return buffer.getvalue()

    def compose_sync(
        self,
        markdown_text: str,
        images: List[ImagePlaceholder]
    ) -> bytes:
        """同步版本的合成方法"""
        return asyncio.run(self.compose(markdown_text, images))


# 便捷函数
async def compose_pdf(
    markdown: str,
    images: List[Dict[str, str]],
    title: str = "提取文档",
    page_size: str = "A4"
) -> bytes:
    """
    合成 PDF 的便捷函数

    Args:
        markdown: Markdown 内容
        images: 图片列表 [{"placeholder": "[IMAGE_001]", "cdnUrl": "https://..."}]
        title: 文档标题
        page_size: 页面大小 (A4 或 Letter)

    Returns:
        PDF 二进制数据
    """
    options = ComposePdfOptions(title=title, page_size=page_size)
    composer = PDFComposer(options)

    image_placeholders = [
        ImagePlaceholder(placeholder=img["placeholder"], cdn_url=img["cdnUrl"])
        for img in images
    ]

    return await composer.compose(markdown, image_placeholders)


def compose_pdf_sync(
    markdown: str,
    images: List[Dict[str, str]],
    title: str = "提取文档",
    page_size: str = "A4"
) -> bytes:
    """同步版本"""
    return asyncio.run(compose_pdf(markdown, images, title, page_size))
