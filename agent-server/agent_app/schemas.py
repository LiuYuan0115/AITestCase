"""
请求/响应 Schema
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class AdditionalPrdItem(BaseModel):
    """辅助PRD项"""
    title: str  # PRD标题
    content: str  # PRD内容


class PrdAgentRequest(BaseModel):
    """PRD 智能体请求模型 - 符合方案接口规范"""
    sessionId: str
    code: str = "plugin_test_testprd"
    type: str = "testprd"
    params: Dict[str, Any]
    instruction: Optional[str] = None
    additionalPrds: Optional[List[AdditionalPrdItem]] = None  # 辅助PRD列表


class TestCaseAgentRequest(BaseModel):
    """Test Case 智能体请求模型"""
    sessionId: str
    code: str = "plugin_test_testcase"
    type: str = "testcase"
    params: Dict[str, Any]
    instruction: Optional[str] = None
    additionalPrds: Optional[List[AdditionalPrdItem]] = None  # 辅助PRD列表


class UIAgentRequest(BaseModel):
    """UI 智能体请求模型"""
    sessionId: str
    code: str = "plugin_test_uinocode"
    type: str = "uinocode"
    params: Dict[str, Any]
    instruction: str
    additionalPrds: Optional[List[AdditionalPrdItem]] = None  # 辅助参考文档列表（可多选）


class ChatAgentRequest(BaseModel):
    """通用聊天请求（PM/DEV chat-only）"""
    sessionId: str
    role: str  # pm | dev
    message: str
    additionalPrds: Optional[List[AdditionalPrdItem]] = None  # 辅助参考文档列表（可多选）


class AskRequest(BaseModel):
    """本地 Ask（替代远程 ask），用于生成 PRD/测试点/测试用例等文本产物"""
    sessionId: str
    code: str = "plugin_test_testprd"
    type: str = "testprd"  # testprd | testpoint | testcase | prdagent
    params: Dict[str, Any]
    instruction: Optional[str] = None  # 用户输入的补充说明（用于 [补充说明] 标签）
    additionalPrds: Optional[List[AdditionalPrdItem]] = None  # 辅助PRD列表


