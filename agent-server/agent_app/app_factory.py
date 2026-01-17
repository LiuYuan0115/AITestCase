from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
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
from agent_app.session_store import SessionStore
from agent_app.ui.screenshots import list_screenshots, clear_screenshots
from agent_app.ask_config import get_all_configs_summary


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

    store = session_store or SessionStore(max_rounds=10)
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

    # health
    @app.get("/health")
    def health_check():
        return {
            "status": "healthy",
            "service": "PluginCode Agent Server",
            "version": "1.0.0",
            "endpoints": [
                "POST /api/docs/upsert - 上传/更新文档",
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
            ],
            "ask_configs": get_all_configs_summary(),
        }

    return app
