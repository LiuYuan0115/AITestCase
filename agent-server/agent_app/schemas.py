from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# -----------------------------
# Doc refs / DocStore API
# -----------------------------

DocKind = Literal["main", "aux", "output"]


class DocRefItem(BaseModel):
    docId: str
    logicalId: Optional[str] = None
    title: Optional[str] = None
    hash: Optional[str] = None
    kind: Optional[DocKind] = None
    length: Optional[int] = None
    contentType: Optional[str] = None
    createdAt: Optional[int] = None


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


class DocGetResponse(BaseModel):
    status: Literal["success", "error"]
    docId: Optional[str] = None
    docRef: Optional[DocRefItem] = None
    content: Optional[str] = None
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
