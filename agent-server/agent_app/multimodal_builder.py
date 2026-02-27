"""
多模态消息构建器
Week 8: 支持将文档图片嵌入 Claude API 消息

Anthropic Claude API 多模态格式：
{
    "role": "user",
    "content": [
        {"type": "text", "text": "请分析这个文档"},
        {"type": "image", "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": "base64_encoded_data..."
        }}
    ]
}
"""

from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field


@dataclass
class ImageContent:
    """图片内容"""
    base64: str
    media_type: str = "image/png"
    page_num: int = 1
    width: Optional[int] = None
    height: Optional[int] = None

    def to_claude_format(self) -> Dict[str, Any]:
        """转换为 Claude API 格式"""
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": self.media_type,
                "data": self.base64
            }
        }


@dataclass
class MultimodalMessage:
    """多模态消息"""
    role: str = "user"
    text_parts: List[str] = field(default_factory=list)
    images: List[ImageContent] = field(default_factory=list)

    def add_text(self, text: str):
        """添加文本"""
        if text and text.strip():
            self.text_parts.append(text.strip())

    def add_image(self, image: ImageContent):
        """添加图片"""
        self.images.append(image)

    def add_image_from_dict(self, image_dict: Dict[str, Any]):
        """从字典添加图片"""
        self.images.append(ImageContent(
            base64=image_dict['base64'],
            media_type=image_dict.get('media_type', 'image/png'),
            page_num=image_dict.get('page_num', 1),
            width=image_dict.get('width'),
            height=image_dict.get('height'),
        ))

    def to_claude_format(self) -> Dict[str, Any]:
        """
        转换为 Claude API 消息格式

        Returns:
            Claude API 兼容的消息字典
        """
        content = []

        # 先添加文本（如果有）
        if self.text_parts:
            combined_text = "\n\n".join(self.text_parts)
            content.append({
                "type": "text",
                "text": combined_text
            })

        # 再添加图片
        for img in self.images:
            content.append(img.to_claude_format())

        # 如果只有一个文本且没有图片，简化格式
        if len(content) == 1 and content[0]["type"] == "text":
            return {
                "role": self.role,
                "content": content[0]["text"]
            }

        return {
            "role": self.role,
            "content": content
        }


class MultimodalMessageBuilder:
    """
    多模态消息构建器

    用于构建包含文本和图片的 Claude API 消息

    Example:
        builder = MultimodalMessageBuilder()

        # 添加用户消息（文本 + PDF 图片）
        builder.add_user_message(
            text="请分析这个 PRD 文档并生成测试用例",
            images=pdf_images  # 来自 FileProcessor.pdf_to_images()
        )

        # 获取 Claude API 格式的消息
        messages = builder.build()
    """

    def __init__(self):
        self.messages: List[MultimodalMessage] = []
        self._current_message: Optional[MultimodalMessage] = None

    def add_system_message(self, text: str) -> "MultimodalMessageBuilder":
        """
        添加系统消息（Claude API 的 system 参数，不是 messages 的一部分）

        注意：系统消息在 Claude API 中单独传递，不在 messages 数组中
        """
        self._system_text = text
        return self

    def add_user_message(
        self,
        text: str = "",
        images: Optional[List[Dict[str, Any]]] = None,
        image_caption: str = ""
    ) -> "MultimodalMessageBuilder":
        """
        添加用户消息

        Args:
            text: 文本内容
            images: 图片列表（来自 FileProcessor 的输出）
            image_caption: 图片说明（插入在图片前）

        Returns:
            self（支持链式调用）
        """
        msg = MultimodalMessage(role="user")

        # 添加文本
        if text:
            msg.add_text(text)

        # 添加图片说明和图片
        if images:
            if image_caption:
                msg.add_text(image_caption)
            elif len(images) > 1:
                msg.add_text(f"以下是文档的 {len(images)} 页内容：")

            for img_dict in images:
                msg.add_image_from_dict(img_dict)

        self.messages.append(msg)
        return self

    def add_assistant_message(self, text: str) -> "MultimodalMessageBuilder":
        """
        添加助手消息

        Args:
            text: 助手回复文本

        Returns:
            self
        """
        msg = MultimodalMessage(role="assistant")
        msg.add_text(text)
        self.messages.append(msg)
        return self

    def add_document_context(
        self,
        text_content: str = "",
        images: Optional[List[Dict[str, Any]]] = None,
        doc_title: str = "文档"
    ) -> "MultimodalMessageBuilder":
        """
        添加文档上下文（作为用户消息的一部分）

        Args:
            text_content: 文档文本内容
            images: 文档图片（PDF 页面）
            doc_title: 文档标题

        Returns:
            self
        """
        msg = MultimodalMessage(role="user")

        # 构建文档引用前缀
        prefix = f"=== {doc_title} ===\n"

        if images and len(images) > 0:
            # 多模态模式：图片 + 可选文本
            msg.add_text(prefix + f"（共 {len(images)} 页，以下是每页的扫描图片）")

            for img_dict in images:
                page_num = img_dict.get('page_num', 1)
                # 添加页码标注
                msg.add_text(f"--- 第 {page_num} 页 ---")
                msg.add_image_from_dict(img_dict)

            # 如果同时有文本，追加
            if text_content and text_content.strip():
                msg.add_text(f"\n=== 文档 OCR 文本 ===\n{text_content}")

        elif text_content:
            # 纯文本模式
            msg.add_text(prefix + text_content)

        self.messages.append(msg)
        return self

    def build(self) -> List[Dict[str, Any]]:
        """
        构建 Claude API 格式的消息列表

        Returns:
            消息列表，可直接用于 Claude API 调用
        """
        return [msg.to_claude_format() for msg in self.messages]

    def get_system(self) -> Optional[str]:
        """获取系统消息"""
        return getattr(self, '_system_text', None)

    def clear(self):
        """清空所有消息"""
        self.messages = []
        self._system_text = None


def build_multimodal_request(
    user_message: str,
    documents: List[Dict[str, Any]],
    system_prompt: str = "",
    history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    构建完整的多模态请求

    Args:
        user_message: 用户消息
        documents: 文档列表，每个文档包含 {title, content, images}
        system_prompt: 系统提示词
        history: 历史对话

    Returns:
        {
            'system': str,
            'messages': List[Dict]
        }
    """
    builder = MultimodalMessageBuilder()

    if system_prompt:
        builder.add_system_message(system_prompt)

    # 添加历史对话
    if history:
        for msg in history:
            if msg.get('role') == 'user':
                builder.add_user_message(text=msg.get('content', ''))
            elif msg.get('role') == 'assistant':
                builder.add_assistant_message(text=msg.get('content', ''))

    # 添加文档上下文
    for doc in documents:
        builder.add_document_context(
            text_content=doc.get('content', ''),
            images=doc.get('images', []),
            doc_title=doc.get('title', '文档')
        )

    # 添加用户消息
    if user_message:
        builder.add_user_message(text=user_message)

    return {
        'system': builder.get_system() or system_prompt,
        'messages': builder.build()
    }


def estimate_image_tokens(images: List[Dict[str, Any]]) -> int:
    """
    估算图片 token 消耗

    Claude 对图片的 token 计算规则（近似）：
    - 每个图片约消耗 (width * height) / 750 tokens
    - 最小 85 tokens

    Args:
        images: 图片列表

    Returns:
        估算的 token 数
    """
    total = 0
    for img in images:
        width = img.get('width', 800)
        height = img.get('height', 600)
        tokens = max(85, (width * height) // 750)
        total += tokens
    return total
