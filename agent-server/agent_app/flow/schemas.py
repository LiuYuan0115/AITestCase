"""
无代码 UI 自动化 - 数据结构定义

与前端 flow.ts 保持一致的 Python 数据结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ==================== 枚举类型 ====================

class FlowCategory(str, Enum):
    """流程分类"""
    LOGIN = "login"
    SOLVE = "solve"
    PAYMENT = "payment"
    CUSTOM = "custom"


class TargetType(str, Enum):
    """操作区域"""
    PAGE = "page"      # 网页
    PLUGIN = "plugin"  # 插件侧栏


class ActionType(str, Enum):
    """操作类型"""
    NAVIGATE = "navigate"
    CLICK = "click"
    INPUT = "input"
    SELECT = "select"
    WAIT = "wait"
    ASSERT = "assert"
    SCREENSHOT = "screenshot"
    SCROLL = "scroll"


class SelectorType(str, Enum):
    """选择器类型"""
    CSS = "css"
    XPATH = "xpath"
    TEXT = "text"
    AI = "ai"


class OnErrorAction(str, Enum):
    """错误处理方式"""
    FAIL = "fail"
    SKIP = "skip"
    RETRY = "retry"


class VariableType(str, Enum):
    """变量类型"""
    STRING = "string"
    SECRET = "secret"
    URL = "url"
    NUMBER = "number"
    SELECT = "select"


class WaitForCondition(str, Enum):
    """等待条件"""
    VISIBLE = "visible"
    HIDDEN = "hidden"
    ENABLED = "enabled"
    DISABLED = "disabled"


class ScrollDirection(str, Enum):
    """滚动方向"""
    UP = "up"
    DOWN = "down"


class StepStatus(str, Enum):
    """步骤执行状态"""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class FlowStatus(str, Enum):
    """流程执行状态"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


# ==================== Pydantic 模型（API 使用） ====================

class VariableDefinition(BaseModel):
    """变量定义"""
    name: str = Field(..., description="变量名")
    label: str = Field(..., description="显示名称")
    type: VariableType = Field(default=VariableType.STRING, description="变量类型")
    required: bool = Field(default=True, description="是否必填")
    defaultValue: Optional[str] = Field(default=None, description="默认值")
    options: Optional[List[str]] = Field(default=None, description="选项列表（type=select）")
    placeholder: Optional[str] = Field(default=None, description="输入提示")


class ElementSelector(BaseModel):
    """元素选择器"""
    type: SelectorType = Field(default=SelectorType.AI, description="选择器类型")
    value: str = Field(..., description="选择器值")


class ActionParams(BaseModel):
    """操作参数"""
    value: Optional[str] = Field(default=None, description="输入值/URL")
    timeout: Optional[int] = Field(default=None, description="超时时间（毫秒）")
    waitFor: Optional[WaitForCondition] = Field(default=None, description="等待条件")
    direction: Optional[ScrollDirection] = Field(default=None, description="滚动方向")
    distance: Optional[int] = Field(default=None, description="滚动距离")


class TestStep(BaseModel):
    """测试步骤"""
    id: str = Field(..., description="步骤 ID")
    name: str = Field(..., description="步骤名称")
    target: TargetType = Field(default=TargetType.PAGE, description="操作区域")
    action: ActionType = Field(..., description="操作类型")
    selector: Optional[ElementSelector] = Field(default=None, description="元素选择器")
    params: Optional[ActionParams] = Field(default=None, description="操作参数")
    onError: OnErrorAction = Field(default=OnErrorAction.FAIL, description="错误处理")
    enabled: bool = Field(default=True, description="是否启用")


class FlowOptions(BaseModel):
    """执行选项"""
    headless: bool = Field(default=False, description="无头模式")
    autoScreenshot: bool = Field(default=True, description="自动截图")
    autoHeal: bool = Field(default=True, description="失败自愈")
    maxRetries: int = Field(default=2, description="最大重试次数")
    stepTimeout: int = Field(default=10000, description="单步超时（毫秒）")
    flowTimeout: int = Field(default=120000, description="流程超时（毫秒）")


class FlowConfig(BaseModel):
    """流程配置"""
    id: str = Field(..., description="流程 ID")
    name: str = Field(..., description="流程名称")
    description: Optional[str] = Field(default=None, description="流程描述")
    category: FlowCategory = Field(default=FlowCategory.CUSTOM, description="流程分类")
    variables: List[VariableDefinition] = Field(default_factory=list, description="变量定义")
    steps: List[TestStep] = Field(default_factory=list, description="测试步骤")
    options: FlowOptions = Field(default_factory=FlowOptions, description="执行选项")
    isPreset: bool = Field(default=False, description="是否为预置模板")
    createdAt: Optional[str] = Field(default=None, description="创建时间")
    updatedAt: Optional[str] = Field(default=None, description="更新时间")


# ==================== 执行结果 ====================

class StepResult(BaseModel):
    """步骤执行结果"""
    stepId: str = Field(..., description="步骤 ID")
    stepName: str = Field(..., description="步骤名称")
    status: StepStatus = Field(..., description="执行状态")
    duration: int = Field(default=0, description="耗时（毫秒）")
    screenshotUrl: Optional[str] = Field(default=None, description="截图 URL")
    error: Optional[str] = Field(default=None, description="错误信息")
    retryCount: int = Field(default=0, description="重试次数")


class Screenshot(BaseModel):
    """截图信息"""
    filename: str
    stepId: str
    url: str
    timestamp: int


class ErrorInfo(BaseModel):
    """错误信息"""
    stepId: str
    type: str
    message: str
    stack: Optional[str] = None


class FlowResultSummary(BaseModel):
    """执行摘要"""
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0


class FlowResult(BaseModel):
    """流程执行结果"""
    flowId: str = Field(..., description="流程 ID")
    taskId: str = Field(..., description="任务 ID")
    status: FlowStatus = Field(..., description="执行状态")
    startTime: str = Field(..., description="开始时间")
    endTime: Optional[str] = Field(default=None, description="结束时间")
    duration: Optional[int] = Field(default=None, description="总耗时（毫秒）")
    steps: List[StepResult] = Field(default_factory=list, description="步骤结果")
    summary: FlowResultSummary = Field(default_factory=FlowResultSummary, description="执行摘要")
    screenshots: List[Screenshot] = Field(default_factory=list, description="截图列表")
    errors: List[ErrorInfo] = Field(default_factory=list, description="错误列表")

    def to_markdown(self) -> str:
        """转换为 Markdown 格式报告"""
        status_icon = "✅" if self.status == FlowStatus.SUCCESS else "❌"
        md = f"""# 可视化测试报告

## 概要
- **状态**: {status_icon} {self.status.value}
- **开始时间**: {self.startTime}
- **结束时间**: {self.endTime or 'N/A'}
- **总耗时**: {self.duration or 0}ms
- **通过/失败/跳过**: {self.summary.passed}/{self.summary.failed}/{self.summary.skipped}

## 步骤详情

| 步骤 | 状态 | 耗时 | 错误 |
|------|------|------|------|
"""
        for step in self.steps:
            icon = {"passed": "✅", "failed": "❌", "skipped": "⏭️", "pending": "⏳", "running": "🔄"}.get(step.status.value, "?")
            error = (step.error or "")[:50] + "..." if step.error and len(step.error) > 50 else (step.error or "-")
            md += f"| {step.stepName} | {icon} | {step.duration}ms | {error} |\n"

        return md


# ==================== API 请求/响应模型 ====================

class ExecuteFlowRequest(BaseModel):
    """执行流程请求"""
    flow: FlowConfig = Field(..., description="流程配置")
    variables: Dict[str, str] = Field(default_factory=dict, description="变量值")
    options: Optional[FlowOptions] = Field(default=None, description="执行选项覆盖")
    sessionId: Optional[str] = Field(default=None, description="会话 ID")


class ExecuteFlowResponse(BaseModel):
    """执行流程响应"""
    status: Literal["success", "error"] = "success"
    taskId: str = Field(..., description="任务 ID")
    message: Optional[str] = None


class TemplateListResponse(BaseModel):
    """模板列表响应"""
    status: Literal["success", "error"] = "success"
    templates: List[FlowConfig] = Field(default_factory=list)


class SaveTemplateRequest(BaseModel):
    """保存模板请求"""
    template: FlowConfig
    sessionId: Optional[str] = None


class SaveTemplateResponse(BaseModel):
    """保存模板响应"""
    status: Literal["success", "error"] = "success"
    templateId: str = ""
    message: Optional[str] = None


class FlowStatusResponse(BaseModel):
    """流程状态响应（SSE 使用）"""
    taskId: str
    status: FlowStatus
    currentStep: Optional[str] = None
    progress: int = 0  # 0-100
    stepResult: Optional[StepResult] = None


class FlowResultResponse(BaseModel):
    """流程结果响应"""
    status: Literal["success", "error"] = "success"
    result: Optional[FlowResult] = None
    message: Optional[str] = None
