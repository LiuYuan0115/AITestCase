from __future__ import annotations

import io
from typing import Any, Dict, Optional, List

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware

from agent_app.graphs.ask_graph import DocRefMiss, build_ask_graph
from agent_app.graphs.chat_graph import build_chat_graph
from agent_app.graphs.ui_graph import build_ui_graph
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
)
from agent_app.session_store import SessionStore, ImprovedSessionStore, CHROMA_AVAILABLE
from agent_app.ui.screenshots import list_screenshots, clear_screenshots
from agent_app.ask_config import get_all_configs_summary
from agent_app.file_processor import FileProcessor
from agent_app.evaluator import Evaluator
from agent_app.config_manager import config
from agent_app.task_queue import task_queue
from agent_app.batch_upload import BatchUploadProcessor
import os
import json
import asyncio
import time


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
        return {
            "status": "success",
            "docId": doc_id,
            "docRef": {
                "docId": doc.get("docId"),
                "hash": doc.get("hash"),
                "title": doc.get("title"),
                "kind": doc.get("kind"),
                "logicalId": doc.get("logicalId"),
                "length": doc.get("length"),
                "contentType": doc.get("contentType"),
                "createdAt": doc.get("createdAt"),
            },
            "content": doc.get("content") or "",
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
        useOcr: bool = Form(True)
    ):
        """
        文件上传端点（支持 PDF/图片/文本）

        Week 2: 多模态文件解析功能
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

            # 处理文件
            result = FileProcessor.process_file(
                file_obj,
                file.filename,
                auto_detect=True,
                use_ocr=useOcr
            )

            if not result['success']:
                return {
                    "status": "error",
                    "code": "FILE_PROCESS_FAILED",
                    "message": f"文件处理失败: {result['error']}"
                }

            # 存储到 SessionStore/ChromaDB
            extracted_content = result['content']
            doc_title = title or f"{file.filename}"
            doc_kind = kind or file_type  # 使用文件类型作为 kind

            put_result = store.put_doc(
                content=extracted_content,
                title=doc_title,
                kind=doc_kind,
                session_id=sessionId,
                logical_id=logicalId,
                content_type=file.content_type or "application/octet-stream",
                tags=[file_type, "uploaded"]
            )

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
                }
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

            # 按 category/kind 分组
            grouped: Dict[str, List[Dict[str, Any]]] = {}
            for doc in docs:
                cat = doc.get("kind") or doc.get("category") or "未分类"
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

    # -----------------------------
    # AI Quality Evaluation
    # -----------------------------

    @app.post("/api/evaluate")
    def evaluate_testcases(
        prdText: str = Form(...),
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
        useOcr: bool = Form(True)
    ):
        """
        批量上传文件

        支持同时上传多个 PDF/图片/文本文件，并行处理。

        Args:
            files: 文件列表（最多 10 个）
            sessionId: 会话 ID
            kind: 文档类型（可选）
            useOcr: 是否使用 OCR（默认 true）
        """
        try:
            result = await batch_processor.process_batch_async(
                files=files,
                session_id=sessionId,
                kind=kind,
                use_ocr=useOcr
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
                "POST /api/docs/{docId}/archive - 归档文档到历史库 ⭐ NEW",
                "GET /api/history/search - 搜索历史用例 ⭐ NEW",
                "GET /api/history/stats - 获取历史库统计 ⭐ NEW",
                "GET /api/knowledge/list - 列出知识库文档 ⭐ Week8",
                "POST /api/evaluate - AI 质检评估测试用例 ⭐ NEW",
                "POST /api/evaluate/simple - 简化评估（无 PRD） ⭐ NEW",
                "POST /api/evaluate/async - 异步 AI 质检评估 ⭐ Week8",
                "GET /api/tasks/{taskId} - 查询任务状态 ⭐ Week8",
                "GET /api/tasks/{taskId}/stream - SSE 任务进度推送 ⭐ Week8",
                "DELETE /api/tasks/{taskId} - 取消任务 ⭐ Week8",
                "GET /api/tasks - 列出所有任务 ⭐ Week8",
                "DELETE /api/tasks - 清理已完成任务 ⭐ Week8",
                "POST /api/docs/batch-upload - 批量上传文件 ⭐ Week8",
                "GET /api/cache/stats - 获取缓存统计 ⭐ Week8",
                "DELETE /api/cache - 清除缓存 ⭐ Week8",
            ],
            "file_processor": FileProcessor.check_dependencies(),
            "ask_configs": get_all_configs_summary(),
        }

    return app
