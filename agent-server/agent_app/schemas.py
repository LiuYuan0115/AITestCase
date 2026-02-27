from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# -----------------------------
# Doc refs / DocStore API
# -----------------------------

DocKind = Literal["main", "aux", "output"]

# 文档分类（用户可见的分类，不是内部 kind）
DocCategory = Literal["prd", "测试用例", "测试点", "其他"]


class DocRefItem(BaseModel):
    docId: str
    logicalId: Optional[str] = None
    title: Optional[str] = None
    hash: Optional[str] = None
    kind: Optional[DocKind] = None
    length: Optional[int] = None
    contentType: Optional[str] = None
    createdAt: Optional[int] = None
    multimodal: Optional[bool] = None  # 是否为多模态文档（包含图片）
    category: Optional[str] = None  # 文档分类: prd/测试用例/测试点/其他


class DocUpsertItem(BaseModel):
    kind: DocKind
    title: str = ""
    content: str = ""
    logicalId: Optional[str] = None
    tags: Optional[List[str]] = None
    clientDocId: Optional[str] = None
    contentType: Optional[str] = None


class DocUpsertRequest(BaseModel):
    sessionId: str
    docs: List[DocUpsertItem]


class DocUpsertStoredItem(BaseModel):
    clientDocId: Optional[str] = None
    docRef: Optional[DocRefItem] = None
    isNew: Optional[bool] = None
    createdAt: Optional[int] = None
    error: Optional[str] = None


class DocUpsertResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    stored: List[DocUpsertStoredItem]


class ImageItem(BaseModel):
    """多模态文档中的图片项"""
    base64: str
    media_type: Optional[str] = "image/png"
    page_num: Optional[int] = 1
    width: Optional[int] = None
    height: Optional[int] = None


class DocGetResponse(BaseModel):
    status: Literal["success", "error"]
    docId: Optional[str] = None
    docRef: Optional[DocRefItem] = None
    content: Optional[str] = None
    images: Optional[List[Dict[str, Any]]] = None  # 多模态图片数据
    code: Optional[str] = None
    message: Optional[str] = None


class DocPointersResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    pointers: Dict[str, str] = Field(default_factory=dict)


class DocPointersUpdateRequest(BaseModel):
    set: Dict[str, str] = Field(default_factory=dict)


class DocListItem(BaseModel):
    docId: str
    logicalId: Optional[str] = None
    title: Optional[str] = None
    hash: Optional[str] = None
    kind: Optional[DocKind] = None
    length: Optional[int] = None
    contentType: Optional[str] = None
    createdAt: Optional[int] = None


class DocListResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    docs: List[DocListItem] = Field(default_factory=list)


# -----------------------------
# Ask API
# -----------------------------

class AskParams(BaseModel):
    text: str = ""
    pictureKeyList: Optional[List[str]] = None
    isImageSolve: Optional[bool] = None
    isImageByte64: Optional[bool] = None

    class Config:
        extra = "allow"


class AdditionalPrdItem(BaseModel):
    title: str = ""
    content: str = ""


# 测试用例输出格式类型
TestCaseOutputFormat = Literal["xmind", "table", "yaml"]


class AskRequest(BaseModel):
    sessionId: str
    code: str = ""
    # 支持生成类(testprd/testpoint/testcase) + 聊天协作类(prd_chat/testpoint_chat/testcase_chat) + 未来扩展
    type: str = "testprd"
    params: AskParams
    instruction: Optional[str] = None
    additionalPrds: Optional[List[AdditionalPrdItem]] = None
    docRefs: Optional[List[DocRefItem]] = None

    # ✅ 聊天编辑类：明确目标右侧文档（logicalId）
    targetLogicalId: Optional[str] = None

    # ✅ 测试用例输出格式：xmind（H1-H6层级）、table（Markdown表格）、yaml（结构化YAML）
    outputFormat: Optional[TestCaseOutputFormat] = None



class AskResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    answer: str = ""
    code: Optional[str] = None
    message: Optional[str] = None

    # new fields
    docRefs: Optional[List[DocRefItem]] = None        # newly stored docs in this call (optional)
    usedDocRefs: Optional[List[DocRefItem]] = None    # docs actually used to build prompt
    generatedDocRef: Optional[DocRefItem] = None      # output docRef (stored + pointer updated)


# -----------------------------
# Chat Agent (PM/DEV)
# -----------------------------

class AdditionalPrdItem(BaseModel):
    title: str
    content: str


class ChatAgentRequest(BaseModel):
    sessionId: str
    role: Literal["pm", "dev"]
    message: str
    additionalPrds: Optional[List[AdditionalPrdItem]] = None
    # ✅ 新增：支持 docRefs（与 Ask 对齐，为未来知识库/RAG 做准备）
    docRefs: Optional[List[DocRefItem]] = None


class ChatAgentResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    reply: str = ""
    message: Optional[str] = None
    # ✅ 新增：返回实际使用的文档引用（便于调试）
    usedDocRefs: Optional[List[DocRefItem]] = None
    # ✅ 新增：如果模型决定了目标文档，返回 targetLogicalId
    targetLogicalId: Optional[str] = None


# -----------------------------
# UI Agent
# -----------------------------

class UIAgentRequest(BaseModel):
    sessionId: str
    code: Optional[str] = None
    type: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    instruction: str = ""
    additionalPrds: Optional[List[AdditionalPrdItem]] = None


class UIAgentResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    type: Literal["query", "plan_generated", "report_generated", "closed_loop_done"] = "query"
    response: str = ""
    plan: Optional[str] = None
    planJson: Optional[str] = None
    report: Optional[str] = None
    screenshotCount: Optional[int] = None
    message: Optional[str] = None


# -----------------------------
# Unified Chat API (v2)
# Phase 3: 统一前后端消息协议
# -----------------------------

AttachmentType = Literal["pdf", "image", "text", "office", "url", "extracted"]
UserRole = Literal["pm", "dev", "qa"]
OutputFormatType = Literal["markdown", "table", "yaml", "json", "mindmap"]


class Attachment(BaseModel):
    """附件信息"""
    id: str
    type: AttachmentType
    name: str
    size: int = 0
    mimeType: Optional[str] = None
    docRef: Optional[DocRefItem] = None
    contentPreview: Optional[str] = None


class ToolConfig(BaseModel):
    """工具配置"""
    enableRAG: bool = True
    ragTopK: int = 5
    enableCritic: bool = False
    generatePDF: bool = False
    streamOutput: bool = True
    # Phase 6: 输出格式配置
    outputFormat: OutputFormatType = "mindmap"
    enableInlineEdit: bool = False


class HistoryMessage(BaseModel):
    """历史消息"""
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: Optional[int] = None


class UnifiedChatRequest(BaseModel):
    """统一聊天请求 (v2)"""
    sessionId: str
    activeRole: UserRole
    message: str
    attachments: List[Attachment] = Field(default_factory=list)
    refDocs: List[DocRefItem] = Field(default_factory=list)
    toolConfig: ToolConfig = Field(default_factory=ToolConfig)
    targetLogicalId: Optional[str] = None
    history: Optional[List[HistoryMessage]] = None


class LogicIssue(BaseModel):
    """逻辑问题"""
    id: str
    issue: str
    severity: Literal["high", "medium", "low"] = "medium"


class RiskPoint(BaseModel):
    """风险点"""
    area: str
    description: str
    impact: str = ""
    mitigation: str = ""


class EvaluationReport(BaseModel):
    """评估报告 (Critic Agent 输出)"""
    score: int = Field(ge=0, le=100)
    summary: str = ""
    coverage_gap: List[str] = Field(default_factory=list)
    logic_issues: List[LogicIssue] = Field(default_factory=list)
    duplicates: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    risk_points: List[RiskPoint] = Field(default_factory=list)
    supplementary_cases: List[str] = Field(default_factory=list)


class TelemetryData(BaseModel):
    """遥测数据"""
    request_id: str
    duration_ms: int = 0
    phases: Dict[str, int] = Field(default_factory=dict)
    attachments_processed: int = 0
    prompt_length: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    rag_chunks_used: int = 0


class StructuredData(BaseModel):
    """结构化数据输出"""
    type: Literal["testcase", "testpoint", "prd", "evaluation"]
    data: Any


class UnifiedChatResponse(BaseModel):
    """统一聊天响应 (v2)"""
    status: Literal["success", "error"]
    sessionId: str
    reply: str = ""
    structuredData: Optional[StructuredData] = None
    mode: Optional[Literal["analysis", "edit"]] = None
    updatedDocument: Optional[str] = None
    editSummary: Optional[str] = None
    usedDocRefs: List[DocRefItem] = Field(default_factory=list)
    generatedDocRef: Optional[DocRefItem] = None
    evaluationReport: Optional[EvaluationReport] = None
    telemetry: Optional[TelemetryData] = None
    error: Optional[Dict[str, str]] = None


# -----------------------------
# PDF Compose API
# Phase 2: PDF 合成
# -----------------------------

class ImagePlaceholder(BaseModel):
    """图片占位符"""
    placeholder: str  # e.g. "[IMAGE_001]"
    cdnUrl: str


class ComposePdfOptions(BaseModel):
    """PDF 合成选项"""
    pageSize: Literal["A4", "Letter"] = "A4"
    includeHeader: bool = True
    includeFooter: bool = True


class ComposePdfRequest(BaseModel):
    """PDF 合成请求"""
    sessionId: str
    markdown: str
    images: List[ImagePlaceholder] = Field(default_factory=list)
    title: Optional[str] = "提取文档"
    options: Optional[ComposePdfOptions] = None


class ComposePdfResponse(BaseModel):
    """PDF 合成响应"""
    status: Literal["success", "error"]
    docRef: Optional[DocRefItem] = None
    size: Optional[int] = None
    pageCount: Optional[int] = None
    error: Optional[str] = None


# -----------------------------
# Critic/Evaluator API
# Phase 5: Critic Agent
# -----------------------------

class FullEvaluateRequest(BaseModel):
    """完整评估请求"""
    sessionId: str
    prdDocRef: DocRefItem
    testcaseDocRef: DocRefItem
    goldenCasesDocRef: Optional[DocRefItem] = None
    ragContext: Optional[str] = None
    includeRiskAnalysis: bool = True
    generateSupplementaryCases: bool = True


class FullEvaluateResponse(BaseModel):
    """完整评估响应"""
    status: Literal["success", "error"]
    report: Optional[EvaluationReport] = None
    telemetry: Optional[TelemetryData] = None
    error: Optional[str] = None


# -----------------------------
# Midscene Agent
# -----------------------------

class MidsceneTestCaseItem(BaseModel):
    """单条测试用例（从前端 Step 4 解析后传入）"""
    id: str = ""
    name: str
    scenario: str                        # 操作步骤（自然语言，交给 aiAct）
    expectedResults: List[str] = Field(default_factory=list)  # 预期结果（交给 aiAssert）
    preconditions: str = ""
    testData: Dict[str, Any] = Field(default_factory=dict)
    priority: str = ""                   # P0/P1/P2/P3
    extractSchema: Optional[str] = None  # 可选：aiQuery schema


class MidsceneAgentRequest(BaseModel):
    sessionId: str
    instruction: str = ""                # 自由输入模式
    url: str = ""
    headless: bool = True
    useCDP: bool = False                 # CDP 模式（连接用户浏览器）
    cdpEndpoint: str = "http://localhost:9222"
    testCases: Optional[List[MidsceneTestCaseItem]] = None  # 结构化测试用例（用例执行模式）
    additionalPrds: Optional[List[AdditionalPrdItem]] = None
    deepThink: bool = False
    cacheStrategy: str = "read-write"
    aiContext: str = ""


class MidsceneAgentResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    type: str = "error"                  # plan_generated / report_generated / error
    response: str = ""
    report: Optional[Dict[str, Any]] = None
    reportLogContent: Optional[Any] = None
    midsceneResult: Optional[Dict[str, Any]] = None
    testcase: Optional[Dict[str, Any]] = None


class MidsceneBatchRequest(BaseModel):
    sessionId: str
    url: str = ""
    headless: bool = True
    useCDP: bool = False
    cdpEndpoint: str = "http://localhost:9222"
    testCases: List[MidsceneTestCaseItem]
    deepThink: bool = False
    cacheStrategy: str = "read-write"
    aiContext: str = ""


class MidsceneBatchResultItem(BaseModel):
    testcaseId: str = ""
    testcaseName: str = ""
    status: str = "error"                # passed / failed / error
    durationMs: Optional[int] = None
    assertions: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None


class MidsceneBatchResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    results: List[MidsceneBatchResultItem] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)


# -----------------------------
# Midscene Smart Router
# -----------------------------

class MidsceneSmartRequest(BaseModel):
    sessionId: str
    instruction: str
    url: str = ""
    screenshot: Optional[str] = None     # base64 encoded (from chrome.tabs.captureVisibleTab)
    outputFormat: str = "yaml"           # xmind / table / yaml
    useCDP: bool = False
    cdpEndpoint: str = "http://localhost:9222"


class MidsceneSmartResponse(BaseModel):
    status: Literal["success", "error"]
    sessionId: str
    intent: str = ""                     # generate_cases / execute_cases / analyze / free_action / passthrough
    type: str = ""                       # cases_generated / report_generated / analysis / error
    response: str = ""
    cases: Optional[List[Dict[str, Any]]] = None
    formattedCases: Optional[str] = None  # 格式化后的用例文本（按 outputFormat）
    midsceneResult: Optional[Dict[str, Any]] = None
    step: Optional[str] = None           # 前端应跳转的步骤
