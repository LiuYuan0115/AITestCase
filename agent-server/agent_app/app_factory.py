from __future__ import annotations

import io
from typing import Any, Dict, Optional, List

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware

from agent_app.graphs.ask_graph import DocRefMiss, build_ask_graph
from agent_app.graphs.chat_graph import build_chat_graph
from agent_app.graphs.ui_graph import build_ui_graph
from agent_app.graphs.midscene_ui_graph import build_midscene_ui_graph
from agent_app.graphs.midscene_smart_router import build_midscene_smart_graph
from agent_app.schemas import (
    AskRequest,
    ChatAgentRequest,
    ChatAgentResponse,
    DocGetResponse,
    DocListResponse,
    DocPointersResponse,
    DocPointersUpdateRequest,
    DocUpsertRequest,
    DocUpsertResponse,
    UIAgentRequest,
    UIAgentResponse,
    MidsceneAgentRequest,
    MidsceneAgentResponse,
    MidsceneBatchRequest,
    MidsceneBatchResponse,
    MidsceneBatchResultItem,
    MidsceneSmartRequest,
    MidsceneSmartResponse,
)
from agent_app.session_store import SessionStore, ImprovedSessionStore, CHROMA_AVAILABLE
from agent_app.ui.screenshots import list_screenshots, clear_screenshots
from agent_app.ask_config import get_all_configs_summary
from agent_app.file_processor import FileProcessor
from agent_app.evaluator import Evaluator
from agent_app.config import is_gemini_model
from agent_app.config_manager import config
from agent_app.task_queue import task_queue
from agent_app.batch_upload import BatchUploadProcessor
import os
import json
import asyncio
import time
import logging

logger = logging.getLogger(__name__)


def create_app(
    openai_client: Any,
    *,
    model_name: str,
    anthropic_client: Any = None,
    session_store: Optional[SessionStore] = None,
) -> FastAPI:
    """
    Minimal PRD/Test workflow API:
    - POST /api/docs/upsert
    - GET  /api/docs/{docId}
    - GET  /api/sessions/{session_id}/docs
    - GET  /api/sessions/{session_id}/doc_pointers
    - PATCH /api/sessions/{session_id}/doc_pointers
    - POST /api/ask (type=testprd/testpoint/testcase)

    Notes:
    - docId is immutable (sha256(content))
    - logicalId is a per-session pointer (mutable -> current version)
    """
    app = FastAPI(title="PluginCode Agent Server")

    # CORS: allow extension + local dev
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 选择 SessionStore 实现（支持 ChromaDB 向量检索）
    if session_store:
        store = session_store
    else:
        # 环境变量控制：USE_CHROMADB=true 启用向量数据库
        use_chromadb = config.USE_CHROMADB

        if use_chromadb and CHROMA_AVAILABLE:
            print("🔍 使用 ImprovedSessionStore (ChromaDB 向量检索)")
            try:
                store = ImprovedSessionStore(max_rounds=10)
            except Exception as e:
                print(f"⚠️  ImprovedSessionStore 初始化失败，回退到 SessionStore: {e}")
                store = SessionStore(max_rounds=10)
        else:
            if use_chromadb and not CHROMA_AVAILABLE:
                print("⚠️  USE_CHROMADB=true 但 ChromaDB 未安装，使用普通 SessionStore")
            store = SessionStore(max_rounds=10)

    ask_graph = build_ask_graph(openai_client, model_name, session_store=store, anthropic_client=anthropic_client)
    chat_graph = build_chat_graph(openai_client, model_name, session_store=store, anthropic_client=anthropic_client)
    ui_graph = build_ui_graph(openai_client, model_name, session_store=store, anthropic_client=anthropic_client)
    midscene_graph = build_midscene_ui_graph(openai_client, model_name, session_store=store, anthropic_client=anthropic_client)
    midscene_smart_graph = build_midscene_smart_graph(openai_client, model_name, session_store=store, anthropic_client=anthropic_client)

    # -----------------------------
    # Docs
    # -----------------------------

    @app.post("/api/docs/upsert", response_model=DocUpsertResponse)
    async def docs_upsert(req: DocUpsertRequest):
        stored = []
        for d in req.docs:
            try:
                put = store.put_doc(
                    content=d.content,
                    title=d.title,
                    kind=d.kind,
                    session_id=req.sessionId,
                    logical_id=d.logicalId,
                    content_type=d.contentType or "text/markdown",
                    tags=d.tags or [],
                )
                stored.append(
                    {
                        "clientDocId": d.clientDocId,
                        "docRef": {
                            "docId": put.get("docId"),
                            "hash": put.get("hash"),
                            "title": put.get("title"),
                            "kind": d.kind,
                            "logicalId": put.get("logicalId") or d.logicalId,
                            "length": put.get("length"),
                            "contentType": put.get("contentType"),
                            "createdAt": put.get("createdAt"),
                        },
                        "isNew": put.get("isNew"),
                        "createdAt": put.get("createdAt"),
                    }
                )
            except Exception as e:
                stored.append({"clientDocId": d.clientDocId, "error": str(e)})

        return {"status": "success", "sessionId": req.sessionId, "stored": stored}

    @app.get("/api/docs/{doc_id}", response_model=DocGetResponse)
    async def docs_get(doc_id: str):
        doc = store.get_doc(doc_id)
        if not doc:
            return {"status": "error", "code": "DOC_NOT_FOUND", "message": f"docId not found: {doc_id}"}

        # 获取图片数据（用于多模态预览）
        images = doc.get("images") or []

        return {
            "status": "success",
            "docId": doc_id,
            "docRef": {
                "docId": doc.get("docId"),
                "hash": doc.get("hash"),
                "title": doc.get("title"),
                "kind": doc.get("kind"),
                "category": doc.get("category"),  # 文档分类
                "logicalId": doc.get("logicalId"),
                "length": doc.get("length"),
                "contentType": doc.get("contentType"),
                "createdAt": doc.get("createdAt"),
                "multimodal": doc.get("multimodal", False),
            },
            "content": doc.get("content") or "",
            "images": images,  # 返回图片数据用于预览
        }

    @app.delete("/api/docs/{doc_id}")
    async def docs_delete(doc_id: str, session_id: Optional[str] = None):
        """
        删除文档

        从知识库/会话文档中删除指定文档。
        支持从 ChromaDB 的所有 collection 中删除。

        Args:
            doc_id: 文档 ID (sha256:...)
            session_id: 可选会话 ID（用于清理会话关联）

        Returns:
            删除结果
        """
        try:
            deleted = store.delete_doc(doc_id, session_id=session_id)
            if deleted:
                return {
                    "status": "success",
                    "docId": doc_id,
                    "message": "文档已删除"
                }
            else:
                return {
                    "status": "error",
                    "code": "DOC_NOT_FOUND",
                    "docId": doc_id,
                    "message": f"文档不存在: {doc_id}"
                }
        except Exception as e:
            return {
                "status": "error",
                "code": "DELETE_FAILED",
                "docId": doc_id,
                "message": f"删除失败: {str(e)}"
            }

    @app.post("/api/docs/upload")
    async def docs_upload_file(
        file: UploadFile = File(...),
        sessionId: str = Form(...),
        title: Optional[str] = Form(None),
        kind: Optional[str] = Form(None),
        logicalId: Optional[str] = Form(None),
        useOcr: bool = Form(True),
        multimodal: bool = Form(True),  # Week 8: 默认启用多模态处理
        dpi: int = Form(150),           # PDF 转图片分辨率
        maxPages: int = Form(20),       # 最大处理页数
    ):
        """
        文件上传端点（支持 PDF/图片/文本）

        Week 2: 多模态文件解析功能
        Week 8: 多模态支持（PDF/图片转 base64 供 AI 处理）

        Args:
            file: 上传的文件
            sessionId: 会话 ID
            title: 文档标题
            kind: 文档类型 (main/aux)
            logicalId: 逻辑 ID
            useOcr: 是否使用 OCR
            multimodal: 是否启用多模态处理（将 PDF/图片转为 base64）
            dpi: PDF 转图片分辨率（默认 150）
            maxPages: 最大处理页数（默认 20）
        """
        try:
            # 检查文件类型
            file_type = FileProcessor.get_file_type(file.filename)
            if file_type == 'unknown':
                return {
                    "status": "error",
                    "code": "UNSUPPORTED_FILE_TYPE",
                    "message": f"不支持的文件类型: {file.filename}。支持: PDF、图片(PNG/JPG/WebP)、文本(TXT/MD)"
                }

            # 读取文件内容
            file_content = await file.read()
            file_obj = io.BytesIO(file_content)

            # 判断当前模型是否支持 PDF 直传（Gemini 模型跳过图片转换）
            skip_images = is_gemini_model(model_name) and file_type == 'pdf'

            # 处理文件（Week 8: 支持多模态）
            result = FileProcessor.process_file(
                file_obj,
                file.filename,
                auto_detect=True,
                use_ocr=useOcr,
                multimodal=multimodal,  # Week 8: 多模态开关
                dpi=dpi,
                max_pages=maxPages,
                skip_image_conversion=skip_images,  # Gemini: 跳过图片转换
            )

            if not result['success']:
                return {
                    "status": "error",
                    "code": "FILE_PROCESS_FAILED",
                    "message": f"文件处理失败: {result['error']}"
                }

            # 存储到 SessionStore/ChromaDB
            extracted_content = result['content']
            extracted_images = result.get('images') or []  # Week 8: 多模态图片
            extracted_pdf_base64 = result.get('pdf_base64')  # Gemini: PDF 原始数据
            doc_title = title or f"{file.filename}"
            doc_kind = kind or file_type  # 使用文件类型作为 kind

            put_result = store.put_doc(
                content=extracted_content,
                title=doc_title,
                kind=doc_kind,
                session_id=sessionId,
                logical_id=logicalId,
                content_type=file.content_type or "application/octet-stream",
                tags=[file_type, "uploaded"] + (["multimodal"] if (extracted_images or extracted_pdf_base64) else []),
                images=extracted_images,  # Week 8: 存储图片数据
                pdf_base64=extracted_pdf_base64,  # Gemini: 存储 PDF 原始数据
            )

            # 多模态响应信息
            multimodal_info = {}
            if extracted_images:
                multimodal_info = {
                    "enabled": True,
                    "pageCount": len(extracted_images),
                    "mode": result['metadata'].get('mode', 'multimodal'),
                }
                print(f"📸 [多模态上传] {file.filename}: {len(extracted_images)} 页图片已保存")
            elif extracted_pdf_base64:
                multimodal_info = {
                    "enabled": True,
                    "pageCount": result['metadata'].get('page_count', 0),
                    "mode": "gemini_pdf_direct",
                }
                print(f"⚡ [Gemini直传] {file.filename}: PDF 原始数据已保存，跳过图片转换")

            return {
                "status": "success",
                "sessionId": sessionId,
                "fileInfo": {
                    "filename": file.filename,
                    "size": len(file_content),
                    "type": file_type,
                    "contentType": file.content_type,
                },
                "docRef": {
                    "docId": put_result.get("docId"),
                    "hash": put_result.get("hash"),
                    "title": doc_title,
                    "kind": doc_kind,
                    "logicalId": put_result.get("logicalId") or logicalId,
                    "length": put_result.get("length"),
                    "contentType": put_result.get("contentType"),
                    "createdAt": put_result.get("createdAt"),
                },
                "isNew": put_result.get("isNew"),
                "extracted": {
                    "contentLength": len(extracted_content),
                    "ocrUsed": result['metadata'].get('ocr_used', False),
                },
                "multimodal": multimodal_info,  # Week 8: 多模态信息
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "code": "UPLOAD_FAILED",
                "message": f"文件上传失败: {str(e)}"
            }

    # -----------------------------
    # Session doc listing + pointers
    # -----------------------------

    @app.get("/api/sessions/{session_id}/docs", response_model=DocListResponse)
    async def list_session_docs(session_id: str):
        docs = store.list_session_docs(session_id)
        return {"status": "success", "sessionId": session_id, "docs": docs}

    @app.get("/api/sessions/{session_id}/doc_pointers", response_model=DocPointersResponse)
    async def get_pointers(session_id: str):
        return {"status": "success", "sessionId": session_id, "pointers": store.get_pointers(session_id)}

    @app.patch("/api/sessions/{session_id}/doc_pointers", response_model=DocPointersResponse)
    async def patch_pointers(session_id: str, req: DocPointersUpdateRequest):
        pointers = store.update_pointers(session_id, req.set or {})
        return {"status": "success", "sessionId": session_id, "pointers": pointers}

    @app.delete("/api/session/{session_id}")
    def delete_session(session_id: str):
        store.clear(session_id)
        return {"status": "success", "message": f"Session {session_id} cleared"}

    # -----------------------------
    # Ask
    # -----------------------------

    @app.post("/api/ask")
    async def ask(req: AskRequest):
        # IMPORTANT: docRefs-only is allowed; params.text can be empty.
        state: Dict[str, Any] = {
            "sessionId": req.sessionId,
            "code": req.code or "",
            "type": req.type,
            "text": req.params.text or "",
            "instruction": (req.instruction or "").strip(),
            "additionalPrds": [x.model_dump() for x in (req.additionalPrds or [])],
            "docRefs": [x.model_dump() for x in (req.docRefs or [])],
            "targetLogicalId": (req.targetLogicalId or "").strip() or None,
            "outputFormat": (req.outputFormat or "").strip() or None,
        }

        try:
            out = await ask_graph.ainvoke(state)
        except DocRefMiss as e:
            return {
                "status": "error",
                "sessionId": req.sessionId,
                "code": e.code,
                "message": f"Referenced docId missing in DocStore: {e.docId}. You can call GET /api/docs/{e.docId} to debug.",
                "answer": "",
                "docRefs": [],
                "usedDocRefs": [],
                "generatedDocRef": None,
            }
        except Exception as e:
            return {
                "status": "error",
                "sessionId": req.sessionId,
                "code": "ASK_FAILED",
                "message": str(e),
                "answer": "",
                "docRefs": [],
                "usedDocRefs": [],
                "generatedDocRef": None,
            }

        payload = {
            "status": "success",
            "sessionId": req.sessionId,
            "answer": out.get("answer", ""),
            # Newly stored docs in this call (usually from additionalPrds/text in old protocol)
            "docRefs": out.get("storedDocRefs", []) or [],
            # Always return the docs used to build prompt (for UI/debug)
            "usedDocRefs": out.get("usedDocRefs", []) or [],
            # Output docRef (stored and pointer updated in finalize, or chat edit stored in call_llm)
            "generatedDocRef": out.get("generatedDocRef"),
        }

        # ✅ chat intent 结果（analysis/edit）
        if (req.type or "").endswith("_chat"):
            payload["mode"] = out.get("chatIntent", "analysis")
            # ✅ 始终返回 targetLogicalId（即使是 analysis 模式，前端也需要知道模型选择了哪个文档）
            payload["targetLogicalId"] = out.get("targetLogicalId") or ""
            if out.get("chatIntent") == "edit":
                payload["updatedDocument"] = out.get("updatedDocument")
                payload["editSummary"] = out.get("editSummary")

        return payload

    @app.get("/api/ask/config")
    def ask_config_overview():
        """查看 Ask 接口的配置概览（模型/参数/prompt文件）"""
        return {
            "status": "success",
            "configs": get_all_configs_summary(),
        }

    # -----------------------------
    # Chat (PM/DEV)
    # -----------------------------

    @app.post("/api/chat", response_model=ChatAgentResponse)
    def chat_agent(req: ChatAgentRequest):
        """PM/DEV 聊天接口（支持 docRefs 检索上下文，为知识库做准备）"""
        session_id = req.sessionId
        role = (req.role or "").strip().lower()
        message = (req.message or "").strip()
        additional_prds = [{"title": p.title, "content": p.content} for p in (req.additionalPrds or [])]
        # ✅ 新增：支持 docRefs
        doc_refs = [x.model_dump() for x in (req.docRefs or [])]

        if role not in ("pm", "dev"):
            return {"status": "error", "sessionId": session_id, "reply": "Error: role must be 'pm' or 'dev'."}
        if not message:
            return {"status": "error", "sessionId": session_id, "reply": "Error: message is empty."}

        try:
            state = {
                "sessionId": session_id,
                "role": role,
                "userMessage": message,
                "additionalPrds": additional_prds,
                "docRefs": doc_refs,  # ✅ 透传 docRefs
            }
            out = chat_graph.invoke(state)
            result = out.get("result") or {}
            reply = result.get("reply") or ""
            used_doc_refs = result.get("usedDocRefs") or []
            
            store.append(session_id, "user", message)
            store.append(session_id, "assistant", reply)
            
            return {
                "status": "success",
                "sessionId": session_id,
                "reply": reply,
                "usedDocRefs": used_doc_refs,  # ✅ 返回实际使用的文档引用
            }
        except Exception as e:
            return {"status": "error", "sessionId": session_id, "reply": f"Error: {str(e)}"}

    # -----------------------------
    # UI Agent
    # -----------------------------

    @app.post("/api/ui_agent", response_model=UIAgentResponse)
    def ui_agent(req: UIAgentRequest):
        """UI 自动化智能体接口"""
        session_id = req.sessionId
        instruction = req.instruction
        url = req.params.get("url", "") if req.params else ""
        current_plan = req.params.get("plan", "") if req.params else ""
        current_report = req.params.get("report", "") if req.params else ""
        headless = req.params.get("headless", False) if req.params else False
        # workflow: direct（LLM 直接工具操控）| closed_loop（自然语言->Plan JSON->Runner->Report）
        workflow = (req.params.get("workflow") or req.params.get("mode") or "direct").strip().lower() if req.params else "direct"
        auto_heal = bool(req.params.get("autoHeal", True)) if req.params else True
        max_heal_rounds = int(req.params.get("maxHealRounds", 1) or 1) if req.params else 1
        max_turns = int(req.params.get("maxTurns", 15) or 15) if req.params else 15
        auto_continue = bool(req.params.get("autoContinue", False)) if req.params else False
        additional_prds = [{"title": p.title, "content": p.content} for p in (req.additionalPrds or [])]

        try:
            state = {
                "sessionId": session_id,
                "instruction": instruction,
                "url": url,
                "plan": current_plan,
                "report": current_report,
                "headless": headless,
                "maxTurns": max_turns,
                "workflow": workflow,
                "autoHeal": auto_heal,
                "maxHealRounds": max_heal_rounds,
                "autoContinue": auto_continue,
                "additionalPrds": additional_prds,
            }
            out = ui_graph.invoke(state)

            store.append(session_id, "user", instruction)
            store.append(session_id, "assistant", out.get("finalResponse", ""))

            return {
                "status": "success",
                "sessionId": session_id,
                "type": out.get("finalType", "query"),
                "response": out.get("finalResponse", ""),
                "plan": out.get("finalPlan"),
                "report": out.get("finalReport"),
                # 可选：返回可执行 Plan JSON，便于前端展示/导出/回放
                "planJson": out.get("planJson"),
                "screenshotCount": int(out.get("screenshotCount", 0)),
            }
        except Exception as e:
            return {"status": "error", "sessionId": session_id, "type": "query", "response": f"Error: {str(e)}"}

    @app.get("/api/ui_agent/screenshots")
    def get_ui_screenshots():
        try:
            return list_screenshots(limit=50)
        except Exception as e:
            return {"status": "error", "message": f"Error: {str(e)}", "screenshots": [], "total": 0}

    @app.delete("/api/ui_agent/screenshots")
    def delete_ui_screenshots():
        try:
            return clear_screenshots()
        except Exception as e:
            return {"status": "error", "message": f"Error: {str(e)}"}

    # -----------------------------
    # Midscene Agent (全新 Midscene 路径)
    # -----------------------------

    @app.post("/api/midscene_agent", response_model=MidsceneAgentResponse)
    async def midscene_agent(req: MidsceneAgentRequest):
        """
        Midscene UI 自动化接口 — 基于 VLM 视觉引擎。

        支持两种模式：
        1. 自由输入模式: 传 instruction，LLM 解析为结构化用例
        2. 用例执行模式: 传 testCases[]，跳过 LLM 直接执行

        与 /api/ui_agent 完全独立。
        """
        import traceback as tb

        try:
            additional_prds = []
            if req.additionalPrds:
                additional_prds = [{"title": p.title, "content": p.content} for p in req.additionalPrds]

            state: dict = {
                "sessionId": req.sessionId,
                "instruction": req.instruction,
                "url": req.url,
                "headless": req.headless,
                "useCDP": req.useCDP,
                "cdpEndpoint": req.cdpEndpoint,
                "additionalPrds": additional_prds,
                "deepThink": req.deepThink,
                "cacheStrategy": req.cacheStrategy,
                "aiContext": req.aiContext,
            }

            # Pass structured testCases if provided (skip LLM parsing)
            if req.testCases:
                state["testCases"] = [tc.model_dump() for tc in req.testCases]

            out = await asyncio.to_thread(midscene_graph.invoke, state)

            return MidsceneAgentResponse(
                status="success" if out.get("finalType") != "error" else "error",
                sessionId=req.sessionId,
                type=out.get("finalType", "error"),
                response=out.get("finalResponse", ""),
                report=out.get("finalReport"),
                reportLogContent=out.get("reportLogContent"),
                midsceneResult=out.get("midsceneResult"),
                testcase=out.get("testcase"),
            )

        except Exception as e:
            tb.print_exc()
            return MidsceneAgentResponse(
                status="error",
                sessionId=req.sessionId,
                type="error",
                response=f"Error: {str(e)}",
            )

    @app.post("/api/midscene_agent/batch", response_model=MidsceneBatchResponse)
    async def midscene_agent_batch(req: MidsceneBatchRequest):
        """
        批量执行多条 Midscene 测试用例。

        逐条执行，返回每条用例的结果和汇总。
        """
        import traceback as tb

        results: list = []
        for tc in req.testCases:
            try:
                state: dict = {
                    "sessionId": req.sessionId,
                    "url": req.url,
                    "headless": req.headless,
                    "useCDP": req.useCDP,
                    "cdpEndpoint": req.cdpEndpoint,
                    "testCases": [tc.model_dump()],
                    "deepThink": req.deepThink,
                    "cacheStrategy": req.cacheStrategy,
                    "aiContext": req.aiContext,
                }

                out = await asyncio.to_thread(midscene_graph.invoke, state)
                mr = out.get("midsceneResult", {})
                mr_results = mr.get("results", {})

                results.append(MidsceneBatchResultItem(
                    testcaseId=tc.id,
                    testcaseName=tc.name,
                    status=mr.get("status", "error") if out.get("finalType") != "error" else "error",
                    durationMs=mr.get("durationMs"),
                    assertions=mr_results.get("assertions"),
                    error=out.get("finalResponse") if out.get("finalType") == "error" else None,
                ))
            except Exception as e:
                tb.print_exc()
                results.append(MidsceneBatchResultItem(
                    testcaseId=tc.id,
                    testcaseName=tc.name,
                    status="error",
                    error=str(e),
                ))

        passed = sum(1 for r in results if r.status == "passed")
        failed = sum(1 for r in results if r.status == "failed")
        errors = sum(1 for r in results if r.status == "error")

        return MidsceneBatchResponse(
            status="success",
            sessionId=req.sessionId,
            results=results,
            summary={
                "total": len(results),
                "passed": passed,
                "failed": failed,
                "errors": errors,
            },
        )

    # -----------------------------
    # Midscene Smart Router (意图路由)
    # -----------------------------

    @app.post("/api/midscene_agent/smart", response_model=MidsceneSmartResponse)
    async def midscene_agent_smart(req: MidsceneSmartRequest):
        """
        智能路由端点 — LLM 判断用户意图，自动分发。

        支持任意 Step 调用。根据意图：
        - generate_cases: 截图→VLM→生成用例→返回 step=test_case
        - execute_cases: 返回 step=auto_test（前端触发执行）
        - analyze: VLM 分析页面→回复
        - free_action: 返回指令（前端 CDP 执行 aiAct）
        - passthrough: 非 Midscene 命令（前端走原有 agent）
        """
        import traceback as tb

        try:
            state = {
                "sessionId": req.sessionId,
                "instruction": req.instruction,
                "url": req.url,
                "screenshot": req.screenshot,
                "outputFormat": req.outputFormat,
            }

            out = await asyncio.to_thread(midscene_smart_graph.invoke, state)

            return MidsceneSmartResponse(
                status="success" if out.get("finalType") != "error" else "error",
                sessionId=req.sessionId,
                intent=out.get("intent", "passthrough"),
                type=out.get("finalType", "passthrough"),
                response=out.get("finalResponse", ""),
                cases=out.get("cases"),
                formattedCases=out.get("formattedCases"),
                step=out.get("finalStep"),
            )

        except Exception as e:
            tb.print_exc()
            return MidsceneSmartResponse(
                status="error",
                sessionId=req.sessionId,
                intent="error",
                type="error",
                response=f"Smart router error: {str(e)}",
            )

    # -----------------------------
    # Assets 静态资源服务
    # -----------------------------
    from fastapi.responses import FileResponse
    from agent_app.assets.storage import find_asset_file, get_assets_dir
    import os

    @app.get("/api/assets/{filename}")
    def get_asset(filename: str):
        """获取上传的资源文件（截图等）"""
        # 安全：只允许访问文件名，防止路径穿越
        safe_filename = os.path.basename(filename)
        assets_dir = get_assets_dir()
        filepath = os.path.join(assets_dir, safe_filename)
        
        if not os.path.exists(filepath) or not os.path.isfile(filepath):
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # 根据扩展名设置 MIME 类型
        ext = os.path.splitext(safe_filename)[1].lower()
        media_types = {
            ".webp": "image/webp",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
        }
        media_type = media_types.get(ext, "application/octet-stream")
        
        return FileResponse(filepath, media_type=media_type)

    # -----------------------------
    # Flow（可视化测试）
    # -----------------------------
    from agent_app.flow.routes import router as flow_router
    from agent_app.flow.template_store import init_template_store
    
    # 初始化模板存储
    init_template_store(session_store=store)
    
    # 注册 Flow 路由
    app.include_router(flow_router)

    # -----------------------------
    # Knowledge Archive & History
    # -----------------------------

    @app.post("/api/docs/{docId}/archive")
    def archive_document(
        docId: str,
        sessionId: str = Body(...),
        tags: Optional[List[str]] = Body(None)
    ):
        """
        归档确认的测试用例到历史库

        Args:
            docId: 文档 ID
            sessionId: 会话 ID
            tags: 可选标签列表

        Returns:
            归档结果
        """
        if not isinstance(store, ImprovedSessionStore):
            return {
                "status": "error",
                "message": "Archive feature requires ChromaDB (USE_CHROMADB=true)"
            }

        try:
            metadata = {"tags": tags or []}
            success = store.archive_to_history(
                doc_id=docId,
                session_id=sessionId,
                metadata=metadata
            )

            if success:
                return {
                    "status": "success",
                    "docId": docId,
                    "message": "Document archived successfully"
                }
            else:
                return {
                    "status": "error",
                    "docId": docId,
                    "message": "Archive failed (document not found or empty)"
                }

        except Exception as e:
            return {
                "status": "error",
                "docId": docId,
                "message": f"Archive error: {str(e)}"
            }

    @app.get("/api/history/search")
    def search_history(query: str, top_k: int = 3):
        """
        搜索历史测试用例

        Args:
            query: 搜索查询
            top_k: 返回结果数量（默认3）

        Returns:
            历史用例列表
        """
        if not isinstance(store, ImprovedSessionStore):
            return {
                "status": "error",
                "message": "History search requires ChromaDB (USE_CHROMADB=true)",
                "results": []
            }

        if not query or not query.strip():
            return {
                "status": "error",
                "message": "Query is empty",
                "results": []
            }

        try:
            results = store.search_history(query, top_k=min(top_k, 10))

            return {
                "status": "success",
                "query": query,
                "count": len(results),
                "results": results
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Search error: {str(e)}",
                "results": []
            }

    @app.get("/api/history/stats")
    def get_history_stats():
        """
        获取历史库统计信息

        Returns:
            历史库统计数据
        """
        if not isinstance(store, ImprovedSessionStore):
            return {
                "status": "error",
                "message": "History stats requires ChromaDB (USE_CHROMADB=true)"
            }

        try:
            stats = store.get_collection_stats()

            return {
                "status": "success",
                "stats": {
                    "total_history_cases": stats.get("history_cases", 0),
                    "total_session_docs": stats.get("session_docs", 0),
                    "total_company_knowledge": stats.get("company_knowledge", 0),
                }
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Stats error: {str(e)}"
            }

    # -----------------------------
    # Knowledge Base API (Week 8)
    # -----------------------------

    @app.get("/api/knowledge/list")
    def list_knowledge_docs(
        session_id: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 100
    ):
        """
        列出知识库文档

        支持全局知识库查询或按会话筛选。

        Args:
            session_id: 可选会话 ID，若提供则只返回该会话的文档
            category: 可选分类筛选（如 'prd', 'testcase', 'knowledge'）
            limit: 返回数量限制（默认 100）

        Returns:
            文档列表，按创建时间倒序
        """
        try:
            if session_id:
                # 返回指定会话的文档
                docs = store.list_session_docs(session_id)
                # 按 category 筛选
                if category:
                    docs = [d for d in docs if d.get("kind") == category]
            else:
                # 返回全局知识库（所有文档）
                include_knowledge = isinstance(store, ImprovedSessionStore)
                docs = store.list_all_docs(
                    limit=limit,
                    category=category
                )

            # 按 category 分组（优先使用 category，kind 仅作后备映射）
            KIND_TO_CATEGORY = {
                "main": "prd",
                "aux": "prd",
                "output": "测试用例",
                "knowledge": "其他",
            }
            grouped: Dict[str, List[Dict[str, Any]]] = {}
            for doc in docs:
                # 优先使用 category 字段
                cat = doc.get("category")
                # 如果 category 无效或是 kind 值，则根据 kind 映射
                if not cat or cat in KIND_TO_CATEGORY:
                    kind = doc.get("kind", "")
                    cat = KIND_TO_CATEGORY.get(kind, cat or "其他")
                if cat not in grouped:
                    grouped[cat] = []
                grouped[cat].append(doc)

            # 获取统计信息
            total_chunks = len(docs)
            if isinstance(store, ImprovedSessionStore):
                try:
                    stats = store.get_collection_stats()
                    total_chunks = (
                        stats.get("session_docs", 0) +
                        stats.get("company_knowledge", 0)
                    )
                except Exception:
                    pass

            return {
                "status": "success",
                "docs": docs[:limit],
                "grouped": grouped,
                "totalChunks": total_chunks,
                "lastUpdated": int(time.time())
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Knowledge list error: {str(e)}",
                "docs": [],
                "grouped": {},
                "totalChunks": 0
            }

    @app.post("/api/knowledge/upload")
    async def knowledge_upload_file(
        file: UploadFile = File(...),
        title: Optional[str] = Form(None),
        category: Optional[str] = Form(None),
        useOcr: bool = Form(True),
        multimodal: bool = Form(True),
        dpi: int = Form(150),
        maxPages: int = Form(20),
    ):
        """
        知识库文件上传端点（直接存入 company_knowledge collection）

        Args:
            file: 上传的文件
            title: 文档标题
            category: 文档分类（可选，不提供则自动分类）
            useOcr: 是否使用 OCR
            multimodal: 是否启用多模态处理
            dpi: PDF 转图片分辨率
            maxPages: 最大处理页数
        """
        if not isinstance(store, ImprovedSessionStore):
            return {
                "status": "error",
                "code": "CHROMADB_REQUIRED",
                "message": "知识库功能需要启用 ChromaDB (USE_CHROMADB=true)"
            }

        try:
            # 检查文件类型
            file_type = FileProcessor.get_file_type(file.filename)
            if file_type == 'unknown':
                return {
                    "status": "error",
                    "code": "UNSUPPORTED_FILE_TYPE",
                    "message": f"不支持的文件类型: {file.filename}"
                }

            # 读取并处理文件
            file_content = await file.read()
            file_obj = io.BytesIO(file_content)

            result = FileProcessor.process_file(
                file_obj,
                file.filename,
                auto_detect=True,
                use_ocr=useOcr,
                multimodal=multimodal,
                dpi=dpi,
                max_pages=maxPages,
            )

            if not result['success']:
                return {
                    "status": "error",
                    "code": "FILE_PROCESS_FAILED",
                    "message": f"文件处理失败: {result['error']}"
                }

            # 存储到知识库
            extracted_content = result['content']
            extracted_images = result.get('images') or []
            doc_title = title or file.filename

            put_result = store.put_knowledge_doc(
                content=extracted_content,
                title=doc_title,
                category=category,
                content_type=file.content_type or "application/octet-stream",
                tags=[file_type, "knowledge", "uploaded"],
                images=extracted_images,
            )

            return {
                "status": "success",
                "fileInfo": {
                    "filename": file.filename,
                    "size": len(file_content),
                    "type": file_type,
                },
                "docRef": {
                    "docId": put_result.get("docId"),
                    "hash": put_result.get("hash"),
                    "title": doc_title,
                    "kind": "knowledge",
                    "category": put_result.get("category"),
                    "length": put_result.get("length"),
                    "createdAt": put_result.get("createdAt"),
                    "source": "company_knowledge",
                },
                "isNew": put_result.get("isNew"),
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "code": "UPLOAD_FAILED",
                "message": f"知识库上传失败: {str(e)}"
            }

    # -----------------------------
    # 分类管理 API
    # -----------------------------

    @app.get("/api/categories")
    def list_categories():
        """获取所有分类列表"""
        if isinstance(store, ImprovedSessionStore):
            categories = store.get_all_categories()
            default_cats = store.DEFAULT_CATEGORIES
        else:
            categories = ['prd', '测试用例', '测试点', '其他']
            default_cats = categories

        return {
            "status": "success",
            "categories": categories,
            "defaultCategories": default_cats,
            "customCategories": [c for c in categories if c not in default_cats]
        }

    @app.post("/api/categories")
    def add_category(name: str = Body(..., embed=True)):
        """添加自定义分类"""
        if not isinstance(store, ImprovedSessionStore):
            return {"status": "error", "message": "需要启用 ChromaDB"}

        if store.add_category(name):
            return {"status": "success", "message": f"分类 '{name}' 已添加"}
        else:
            return {"status": "error", "message": "分类已存在或名称无效"}

    @app.put("/api/categories/{category_name}")
    def update_category(category_name: str, new_name: str = Body(..., embed=True)):
        """更新分类名称"""
        if not isinstance(store, ImprovedSessionStore):
            return {"status": "error", "message": "需要启用 ChromaDB"}

        if store.update_category(category_name, new_name):
            return {"status": "success", "message": f"分类已更新为 '{new_name}'"}
        else:
            return {"status": "error", "message": "无法更新（默认分类或不存在）"}

    @app.delete("/api/categories/{category_name}")
    def delete_category(category_name: str, move_to: str = "其他"):
        """删除分类（文档移动到指定分类）"""
        if not isinstance(store, ImprovedSessionStore):
            return {"status": "error", "message": "需要启用 ChromaDB"}

        if store.delete_category(category_name, move_to):
            return {"status": "success", "message": f"分类已删除，文档已移动到 '{move_to}'"}
        else:
            return {"status": "error", "message": "无法删除（默认分类或不存在）"}

    # -----------------------------
    # 批量删除 API
    # -----------------------------

    @app.post("/api/docs/batch-delete")
    async def batch_delete_docs(
        doc_ids: List[str] = Body(...),
        session_id: Optional[str] = Body(None)
    ):
        """
        批量删除文档

        Args:
            doc_ids: 文档 ID 列表
            session_id: 可选会话 ID

        Returns:
            删除结果统计
        """
        if not doc_ids:
            return {
                "status": "error",
                "message": "未提供文档 ID"
            }

        if len(doc_ids) > 100:
            return {
                "status": "error",
                "message": "单次最多删除 100 个文档"
            }

        try:
            if isinstance(store, ImprovedSessionStore):
                results = store.batch_delete_docs(doc_ids, session_id)
            else:
                # 普通 SessionStore 的批量删除
                results = {"total": len(doc_ids), "deleted": 0, "failed": 0, "errors": []}
                for doc_id in doc_ids:
                    if store.delete_doc(doc_id, session_id):
                        results["deleted"] += 1
                    else:
                        results["failed"] += 1

            return {
                "status": "success" if results["failed"] == 0 else "partial",
                "results": results
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"批量删除失败: {str(e)}"
            }

    # -----------------------------
    # AI Quality Evaluation
    # -----------------------------

    @app.post("/api/evaluate")
    def evaluate_testcases(
        prdText: str = Form(""),
        testcasesText: str = Form(...),
        ragContext: Optional[str] = Form(None)
    ):
        """
        AI 质检评估测试用例

        Args:
            prdText: 原始 PRD 文本
            testcasesText: 待评估的测试用例（Markdown 格式）
            ragContext: 可选的 RAG 上下文（测试规范、历史用例等）

        Returns:
            评估报告，包含漏测点、逻辑问题、改进建议等
        """
        try:
            # 初始化 Evaluator
            evaluator = Evaluator(
                openai_client=openai_client,
                anthropic_client=anthropic_client,
                model_name=model_name
            )

            # 执行评估
            report = evaluator.evaluate_testcases(
                prd_text=prdText,
                testcases_text=testcasesText,
                rag_context=ragContext
            )

            return report

        except Exception as e:
            return {
                "status": "error",
                "message": f"Evaluation failed: {str(e)}"
            }

    @app.post("/api/evaluate/simple")
    def evaluate_testcases_simple(
        testcasesText: str = Form(...),
        referenceText: Optional[str] = Form(None)
    ):
        """
        简化评估（不需要 PRD）

        仅检查测试用例结构和质量

        Args:
            testcasesText: 待评估的测试用例
            referenceText: 可选的参考文本（测试规范等）

        Returns:
            简化的评估报告
        """
        try:
            evaluator = Evaluator(
                openai_client=openai_client,
                anthropic_client=anthropic_client,
                model_name=model_name
            )

            report = evaluator.evaluate_simple(
                testcases_text=testcasesText,
                reference_text=referenceText
            )

            return report

        except Exception as e:
            return {
                "status": "error",
                "message": f"Evaluation failed: {str(e)}"
            }

    # -----------------------------
    # Async Task & SSE Progress (Week 8)
    # -----------------------------

    @app.post("/api/evaluate/async")
    async def evaluate_async(
        prdText: str = Form(...),
        testcasesText: str = Form(...),
        ragContext: Optional[str] = Form(None)
    ):
        """
        异步 AI 质检评估

        立即返回任务 ID，评估在后台执行。
        使用 /api/tasks/{taskId} 查询状态，
        或 /api/tasks/{taskId}/stream 接收 SSE 推送。
        """
        def run_evaluation():
            evaluator = Evaluator(
                openai_client=openai_client,
                anthropic_client=anthropic_client,
                model_name=model_name
            )
            return evaluator.evaluate_testcases(
                prd_text=prdText,
                testcases_text=testcasesText,
                rag_context=ragContext
            )

        task_id = task_queue.submit(
            run_evaluation,
            task_name="AI质检评估"
        )

        return {
            "status": "submitted",
            "taskId": task_id,
            "message": "评估任务已提交，请使用 /api/tasks/{taskId} 查询结果"
        }

    @app.get("/api/tasks/{taskId}")
    async def get_task_status(taskId: str):
        """
        查询任务状态

        返回任务的当前状态、进度和结果（如果已完成）
        """
        status = task_queue.get_status(taskId)
        return status

    @app.get("/api/tasks/{taskId}/stream")
    async def stream_task_progress(taskId: str):
        """
        SSE 流式返回任务进度

        客户端可通过 EventSource 订阅，实时接收任务状态更新。
        事件类型: progress, completed, failed
        """
        from fastapi.responses import StreamingResponse

        async def event_generator():
            last_status = None
            while True:
                task = task_queue.get_status(taskId)

                # 仅在状态变化时发送事件
                current_status = task.get("status")
                if current_status != last_status:
                    event_data = json.dumps(task, ensure_ascii=False)
                    yield f"event: {current_status}\ndata: {event_data}\n\n"
                    last_status = current_status

                # 任务结束，发送最终事件并关闭
                if current_status in ["completed", "failed", "cancelled", "not_found"]:
                    break

                await asyncio.sleep(0.5)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    @app.delete("/api/tasks/{taskId}")
    async def cancel_task(taskId: str):
        """取消任务"""
        success = task_queue.cancel(taskId)
        return {
            "status": "success" if success else "failed",
            "taskId": taskId,
            "message": "任务已取消" if success else "无法取消任务（可能已完成或不存在）"
        }

    @app.get("/api/tasks")
    async def list_tasks(status: Optional[str] = None):
        """
        列出所有任务

        可选过滤：status=pending/running/completed/failed/cancelled
        """
        tasks = task_queue.get_all_tasks(status=status)
        stats = task_queue.get_stats()
        return {
            "status": "success",
            "tasks": tasks,
            "stats": stats
        }

    @app.delete("/api/tasks")
    async def clear_completed_tasks():
        """清理已完成的任务"""
        count = task_queue.clear_completed_tasks()
        return {
            "status": "success",
            "cleared": count,
            "message": f"已清理 {count} 个完成的任务"
        }

    # -----------------------------
    # Batch Upload (Week 7-8)
    # -----------------------------

    batch_processor = BatchUploadProcessor(session_store=store)

    @app.post("/api/docs/batch-upload")
    async def batch_upload(
        files: List[UploadFile] = File(...),
        sessionId: str = Form(...),
        kind: Optional[str] = Form(None),
        useOcr: bool = Form(True),
        multimodal: bool = Form(True),  # 默认启用多模态处理
        dpi: int = Form(150),           # PDF 转图片分辨率
        maxPages: int = Form(20),       # 最大处理页数
    ):
        """
        批量上传文件

        支持同时上传多个 PDF/图片/文本文件，并行处理。

        Args:
            files: 文件列表（最多 10 个）
            sessionId: 会话 ID
            kind: 文档类型（可选）
            useOcr: 是否使用 OCR（默认 true）
            multimodal: 是否启用多模态处理（将 PDF/图片转为 base64）
            dpi: PDF 转图片分辨率（默认 150）
            maxPages: 最大处理页数（默认 20）
        """
        try:
            result = await batch_processor.process_batch_async(
                files=files,
                session_id=sessionId,
                kind=kind,
                use_ocr=useOcr,
                multimodal=multimodal,
                dpi=dpi,
                max_pages=maxPages
            )
            return result
        except Exception as e:
            return {
                "status": "error",
                "message": f"批量上传失败: {str(e)}"
            }

    # -----------------------------
    # Cache Management (Week 7-8)
    # -----------------------------

    @app.get("/api/cache/stats")
    async def get_cache_stats():
        """获取缓存统计信息"""
        try:
            from agent_app.cache_manager import cache_manager
            stats = cache_manager.get_cache_stats()
            return {
                "status": "success",
                "stats": stats
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"获取缓存统计失败: {str(e)}"
            }

    @app.delete("/api/cache")
    async def clear_cache(cache_type: Optional[str] = None):
        """
        清除缓存

        Args:
            cache_type: 缓存类型（llm/embedding/pdf），不指定则清除全部
        """
        try:
            from agent_app.cache_manager import cache_manager
            cache_manager.clear(cache_type)
            return {
                "status": "success",
                "message": f"缓存已清除: {cache_type or '全部'}"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"清除缓存失败: {str(e)}"
            }

    # -----------------------------
    # v2 API: Unified Chat (Phase 3)
    # -----------------------------
    from .schemas import (
        UnifiedChatRequest, UnifiedChatResponse, ToolConfig,
        ComposePdfRequest, ComposePdfResponse, ImagePlaceholder,
        FullEvaluateRequest, FullEvaluateResponse, EvaluationReport, TelemetryData
    )

    @app.post("/api/v2/chat", response_model=UnifiedChatResponse)
    async def unified_chat(request: UnifiedChatRequest):
        """
        统一聊天接口 (v2)
        - 支持 PM/DEV/QA 三种角色
        - 支持附件和文档引用
        - 支持工具配置 (RAG/Critic/PDF)
        """
        import time
        import uuid
        start_time = time.time()
        request_id = str(uuid.uuid4())[:8]

        try:
            session_id = request.sessionId
            role = request.activeRole
            message = request.message

            # 构建 docRefs 列表
            doc_refs = []
            # 从附件中提取 docRef
            for att in request.attachments:
                if att.docRef:
                    doc_refs.append(att.docRef)
            # 添加显式引用的文档
            doc_refs.extend(request.refDocs)

            # 根据角色路由到不同的处理逻辑
            if role in ("pm", "dev"):
                # 使用现有的 chat_graph
                from .graphs.chat_graph import chat_graph
                result = chat_graph.invoke({
                    "sessionId": session_id,
                    "role": role,
                    "message": message,
                    "docRefs": [ref.model_dump() for ref in doc_refs] if doc_refs else None,
                })
                reply = result.get("reply", "")
                used_refs = result.get("usedDocRefs", [])

            else:
                # QA 角色: 使用 ask_graph
                from .graphs.ask_graph import ask_graph
                result = ask_graph.invoke({
                    "sessionId": session_id,
                    "code": "plugin_test_chat",
                    "type": "prd_chat",
                    "text": message,
                    "docRefs": [ref.model_dump() for ref in doc_refs] if doc_refs else None,
                    "targetLogicalId": request.targetLogicalId,
                })
                reply = result.get("answer", "")
                used_refs = result.get("usedDocRefs", [])

            # 计算遥测数据
            duration_ms = int((time.time() - start_time) * 1000)
            telemetry = TelemetryData(
                request_id=request_id,
                duration_ms=duration_ms,
                attachments_processed=len(request.attachments),
                prompt_length=len(message),
            )

            return UnifiedChatResponse(
                status="success",
                sessionId=session_id,
                reply=reply,
                usedDocRefs=used_refs,
                telemetry=telemetry,
            )

        except Exception as e:
            logger.exception(f"[v2/chat] Error: {e}")
            return UnifiedChatResponse(
                status="error",
                sessionId=request.sessionId,
                error={"code": "INTERNAL_ERROR", "message": str(e)},
            )

    # -----------------------------
    # PDF Compose API (Phase 2)
    # -----------------------------
    @app.post("/api/docs/compose-pdf", response_model=ComposePdfResponse)
    async def compose_pdf_endpoint(request: ComposePdfRequest):
        """
        将 Markdown + 图片合成 PDF
        - 下载 CDN 图片
        - 替换占位符
        - 生成 PDF 并存储
        """
        try:
            from .pdf_composer import PDFComposer, ComposePdfOptions as PDFOptions, ImagePlaceholder as PDFImagePlaceholder

            # 构建选项
            opts = PDFOptions(
                title=request.title or "提取文档",
                page_size=request.options.pageSize if request.options else "A4",
                include_header=request.options.includeHeader if request.options else True,
                include_footer=request.options.includeFooter if request.options else True,
            )

            # 构建图片列表
            images = [
                PDFImagePlaceholder(placeholder=img.placeholder, cdn_url=img.cdnUrl)
                for img in request.images
            ]

            # 合成 PDF
            composer = PDFComposer(opts)
            pdf_bytes = await composer.compose(request.markdown, images)

            # 存储 PDF
            import hashlib
            import time
            content_hash = hashlib.md5(pdf_bytes).hexdigest()[:12]
            doc_id = f"pdf_{int(time.time())}_{content_hash}"

            # 使用 session store 存储
            store.store_pdf(request.sessionId, doc_id, pdf_bytes, request.title or "提取文档")

            # 返回 DocRef
            from .schemas import DocRefItem
            doc_ref = DocRefItem(
                docId=doc_id,
                logicalId=f"composed_pdf_{int(time.time())}",
                title=request.title or "提取文档",
                kind="output",
                length=len(pdf_bytes),
                contentType="application/pdf",
            )

            return ComposePdfResponse(
                status="success",
                docRef=doc_ref,
                size=len(pdf_bytes),
            )

        except Exception as e:
            logger.exception(f"[compose-pdf] Error: {e}")
            return ComposePdfResponse(
                status="error",
                error=str(e),
            )

    # -----------------------------
    # Full Evaluate API (Phase 5)
    # -----------------------------
    @app.post("/api/evaluate/full", response_model=FullEvaluateResponse)
    async def full_evaluate_endpoint(request: FullEvaluateRequest):
        """
        完整的 Critic 评估
        - 覆盖度检测
        - 逻辑一致性检查
        - 去重分析
        - 风险点识别
        - 补充用例生成
        """
        import time
        import uuid
        start_time = time.time()
        request_id = str(uuid.uuid4())[:8]

        try:
            # 获取文档内容
            prd_content = store.get_doc_content(request.prdDocRef.docId)
            testcase_content = store.get_doc_content(request.testcaseDocRef.docId)

            golden_content = None
            if request.goldenCasesDocRef:
                golden_content = store.get_doc_content(request.goldenCasesDocRef.docId)

            if not prd_content or not testcase_content:
                return FullEvaluateResponse(
                    status="error",
                    error="无法获取 PRD 或测试用例内容",
                )

            # 调用评估器
            from .evaluator import evaluate_testcases_full
            report = await evaluate_testcases_full(
                prd_text=prd_content,
                testcase_text=testcase_content,
                golden_cases=golden_content,
                rag_context=request.ragContext,
                include_risk_analysis=request.includeRiskAnalysis,
                generate_supplementary=request.generateSupplementaryCases,
            )

            # 计算遥测数据
            duration_ms = int((time.time() - start_time) * 1000)
            telemetry = TelemetryData(
                request_id=request_id,
                duration_ms=duration_ms,
            )

            return FullEvaluateResponse(
                status="success",
                report=report,
                telemetry=telemetry,
            )

        except Exception as e:
            logger.exception(f"[evaluate/full] Error: {e}")
            return FullEvaluateResponse(
                status="error",
                error=str(e),
            )

    # ==========================================
    # Phase 6: 异步任务 API
    # ==========================================

    from pydantic import BaseModel
    from typing import Optional, List, Any

    class CreateJobRequest(BaseModel):
        """创建任务请求"""
        type: str
        params: dict = {}
        session_id: Optional[str] = None
        timeout: int = 300

    class JobResponse(BaseModel):
        """任务响应"""
        task_id: str
        type: str
        status: str
        params: dict = {}
        session_id: Optional[str] = None
        created_at: float
        started_at: Optional[float] = None
        completed_at: Optional[float] = None
        result: Optional[Any] = None
        error: Optional[str] = None
        progress: dict = {}

    @app.post("/api/jobs", response_model=JobResponse)
    async def create_job(request: CreateJobRequest):
        """
        创建异步任务

        任务类型：
        - chat: 聊天生成
        - parse_pdf: PDF 解析
        - parse_image: 图片 OCR
        - compose_pdf: PDF 合成
        - evaluate: Critic 评估
        - generate: 通用生成
        """
        from .task_queue import get_async_queue, TaskType

        queue = get_async_queue()

        try:
            task_type = TaskType(request.type)
        except ValueError:
            # 默认为通用生成
            task_type = TaskType.GENERATE

        task_id = await queue.create_async_task(
            task_type=task_type,
            params=request.params,
            session_id=request.session_id,
            timeout=request.timeout,
        )

        task = await queue.get_task_status(task_id)
        return task

    @app.get("/api/jobs/{task_id}", response_model=JobResponse)
    async def get_job_status(task_id: str):
        """获取任务状态"""
        from .task_queue import get_async_queue

        queue = get_async_queue()
        task = await queue.get_task_status(task_id)

        if not task:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Task not found")

        return task

    @app.delete("/api/jobs/{task_id}")
    async def cancel_job(task_id: str):
        """取消任务"""
        from .task_queue import get_async_queue

        queue = get_async_queue()
        success = await queue.cancel_task(task_id)

        return {"success": success, "task_id": task_id}

    @app.get("/api/jobs/{task_id}/stream")
    async def stream_job_output(task_id: str):
        """流式获取任务输出（SSE）"""
        from fastapi.responses import StreamingResponse
        from .task_queue import get_async_queue

        queue = get_async_queue()

        return StreamingResponse(
            queue.stream_task_output(task_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.get("/api/jobs")
    async def list_jobs(session_id: Optional[str] = None, limit: int = 50):
        """获取任务列表"""
        from .task_queue import get_async_queue

        queue = get_async_queue()
        tasks = queue.list_tasks(session_id=session_id, limit=limit)

        return {"tasks": tasks, "total": len(tasks)}

    # ==========================================
    # Phase 7: 遥测 API
    # ==========================================

    @app.get("/api/telemetry/stats")
    async def get_telemetry_stats():
        """获取遥测统计信息"""
        from .telemetry import get_telemetry_collector

        collector = get_telemetry_collector()
        return collector.get_stats()

    @app.get("/api/telemetry/history")
    async def get_telemetry_history(
        limit: int = 100,
        session_id: Optional[str] = None,
        endpoint: Optional[str] = None,
    ):
        """获取遥测历史"""
        from .telemetry import get_telemetry_collector

        collector = get_telemetry_collector()
        history = collector.get_history(
            limit=limit,
            session_id=session_id,
            endpoint=endpoint,
        )
        return {"history": history, "total": len(history)}

    @app.get("/api/telemetry/{request_id}")
    async def get_telemetry_by_id(request_id: str):
        """获取单个请求的遥测数据"""
        from .telemetry import get_telemetry_collector

        collector = get_telemetry_collector()
        data = collector.get_request(request_id)

        if not data:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Request not found")

        return data

    # health
    @app.get("/health")
    def health_check():
        # 检查是否使用 ChromaDB
        store_type = "ImprovedSessionStore (ChromaDB)" if isinstance(store, ImprovedSessionStore) else "SessionStore (Memory)"
        chroma_stats = None
        if isinstance(store, ImprovedSessionStore):
            try:
                chroma_stats = store.get_collection_stats()
            except Exception:
                pass

        return {
            "status": "healthy",
            "service": "PluginCode Agent Server",
            "version": "2026.1.9",
            "store_type": store_type,
            "chroma_stats": chroma_stats,
            "endpoints": [
                "POST /api/docs/upsert - 上传/更新文档（JSON）",
                "POST /api/docs/upload - 上传文件（PDF/图片/文本）⭐ NEW",
                "GET /api/docs/{docId} - 获取文档内容",
                "GET /api/sessions/{sessionId}/docs - 列出会话文档",
                "GET /api/sessions/{sessionId}/doc_pointers - 获取文档指针",
                "PATCH /api/sessions/{sessionId}/doc_pointers - 更新文档指针",
                "POST /api/ask - Ask 接口（支持 docRefs）",
                "GET /api/ask/config - Ask 接口配置概览",
                "POST /api/chat - PM/DEV 聊天接口",
                "POST /api/ui_agent - UI 自动化智能体",
                "GET /api/ui_agent/screenshots - 获取截图列表",
                "DELETE /api/ui_agent/screenshots - 清空截图",
                "GET /api/assets/{filename} - 获取资源文件（截图等）",
                "DELETE /api/session/{sessionId} - 清除会话",
                "POST /api/flow/execute - 执行可视化测试流程",
                "GET /api/flow/status/{taskId} - 获取执行状态（SSE）",
                "GET /api/flow/result/{taskId} - 获取执行结果",
                "GET /api/flow/templates - 获取模板列表",
                "POST /api/flow/templates - 保存模板",
                "DELETE /api/flow/templates/{id} - 删除模板",
                "POST /api/docs/{docId}/archive - 归档文档到历史库",
                "GET /api/history/search - 搜索历史用例",
                "GET /api/history/stats - 获取历史库统计",
                "GET /api/knowledge/list - 列出知识库文档",
                "POST /api/evaluate - AI 质检评估测试用例",
                "POST /api/evaluate/simple - 简化评估（无 PRD）",
                "POST /api/evaluate/async - 异步 AI 质检评估",
                "GET /api/tasks/{taskId} - 查询任务状态",
                "GET /api/tasks/{taskId}/stream - SSE 任务进度推送",
                "DELETE /api/tasks/{taskId} - 取消任务",
                "GET /api/tasks - 列出所有任务",
                "DELETE /api/tasks - 清理已完成任务",
                "POST /api/docs/batch-upload - 批量上传文件",
                "GET /api/cache/stats - 获取缓存统计",
                "DELETE /api/cache - 清除缓存",
                "POST /api/v2/chat - 统一聊天接口 (v2)",
                "POST /api/docs/compose-pdf - PDF 合成",
                "POST /api/evaluate/full - 完整 Critic 评估",
            ],
            "file_processor": FileProcessor.check_dependencies(),
            "ask_configs": get_all_configs_summary(),
        }

    return app
