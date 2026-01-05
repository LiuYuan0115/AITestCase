"""
FastAPI 应用工厂：集中初始化依赖，并挂载路由
"""

import os
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse

from agent_app.config import build_openai_client, build_anthropic_client, get_model_for
from agent_app.session_store import SessionStore
from agent_app.schemas import PrdAgentRequest, TestCaseAgentRequest, UIAgentRequest, ChatAgentRequest, AskRequest
from agent_app.graphs.prd_graph import build_prd_graph
from agent_app.graphs.testcase_graph import build_testcase_graph
from agent_app.graphs.ui_graph import build_ui_graph
from agent_app.graphs.chat_graph import build_chat_graph
from agent_app.graphs.ask_graph import build_ask_graph
from agent_app.ui.screenshots import list_screenshots, clear_screenshots
from agent_app.ask_config import get_all_configs_summary


def create_app() -> FastAPI:
    app = FastAPI(title="AI Test Case Agent Server", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ==============================
    # 应用内鉴权（X-Api-Key）
    #
    # 说明：
    # - 线上通常会有网关/平台层鉴权，但为了本地/线上行为一致，这里再加一层应用内校验
    # - 仅当环境变量配置了 AGENT_API_KEY 时才启用（避免影响本地开发）
    # - 覆盖范围：/api/* 以及 /health
    # ==============================
    @app.middleware("http")
    async def _api_key_guard(request: Request, call_next):
        expected_key = (os.getenv("AGENT_API_KEY") or "").strip()
        if expected_key:
            path = request.url.path or ""
            need_check = path.startswith("/api/") or path == "/health"
            if need_check:
                got_key = (request.headers.get("x-api-key") or "").strip()
                if got_key != expected_key:
                    # 保持与前置鉴权错误风格一致，便于前端统一处理
                    return JSONResponse(
                        status_code=401,
                        content={"error": "Unauthorized", "message": "Missing or Invalid X-Api-Key"},
                    )
        return await call_next(request)

    openai_client = build_openai_client()
    anthropic_client = build_anthropic_client()
    
    # 按接口配置不同模型（可在 .env 中配置 MODEL_PRD / MODEL_TESTCASE / MODEL_UI / MODEL_CHAT / MODEL_ASK）
    prd_model = get_model_for("PRD")
    testcase_model = get_model_for("TESTCASE")
    ui_model = get_model_for("UI")
    chat_model = get_model_for("CHAT")
    ask_model = get_model_for("ASK")
    session_store = SessionStore(max_rounds=10)

    prd_graph = build_prd_graph(openai_client=openai_client, model_name=prd_model, session_store=session_store, anthropic_client=anthropic_client)
    testcase_graph = build_testcase_graph(openai_client=openai_client, model_name=testcase_model, session_store=session_store, anthropic_client=anthropic_client)
    ui_graph = build_ui_graph(openai_client=openai_client, model_name=ui_model, session_store=session_store, anthropic_client=anthropic_client)
    chat_graph = build_chat_graph(openai_client=openai_client, model_name=chat_model, session_store=session_store, anthropic_client=anthropic_client)
    ask_graph = build_ask_graph(openai_client=openai_client, model_name=ask_model, session_store=session_store, anthropic_client=anthropic_client)

    @app.post("/api/prd")
    def prd_agent_v2(request: PrdAgentRequest):
        session_id = request.sessionId
        prd_text = request.params.get("text", "")
        instruction = request.instruction
        picture_list = request.params.get("pictureKeyList", [])
        additional_prds = [{"title": p.title, "content": p.content} for p in (request.additionalPrds or [])]

        if not prd_text:
            return {
                "status": "error",
                "sessionId": session_id,
                "type": "query",
                "response": "Error: PRD text is empty.",
            }

        try:
            state = {
                "sessionId": session_id,
                "prdText": prd_text,
                "instruction": instruction or "",
                "pictureKeyList": picture_list,
                "additionalPrds": additional_prds,
            }
            out = prd_graph.invoke(state)
            result = out["result"]

            # 更新会话上下文（只存用户 instruction 与最终响应）
            user_content = instruction if instruction else "请分析当前 PRD 文档"
            session_store.append(session_id, "user", user_content)
            session_store.append(session_id, "assistant", result.get("response", ""))

            payload = {
                "status": "success",
                "sessionId": session_id,
                "type": result.get("type", "query"),
                "response": result.get("response", ""),
            }
            if "newPrd" in result:
                payload["newPrd"] = result["newPrd"]
            return payload
        except Exception as e:
            return {
                "status": "error",
                "sessionId": session_id,
                "type": "query",
                "response": f"Error: {str(e)}",
            }

    @app.post("/api/testcase")
    def testcase_agent(request: TestCaseAgentRequest):
        session_id = request.sessionId
        testcase_text = request.params.get("text", "")
        instruction = request.instruction
        additional_prds = [{"title": p.title, "content": p.content} for p in (request.additionalPrds or [])]

        if not testcase_text:
            return {
                "status": "error",
                "sessionId": session_id,
                "type": "query",
                "response": "Error: Test case text is empty.",
            }

        try:
            state = {
                "sessionId": session_id,
                "testcaseText": testcase_text,
                "instruction": instruction or "",
                "additionalPrds": additional_prds,
            }
            out = testcase_graph.invoke(state)
            result = out["result"]

            user_content = instruction if instruction else "请分析当前测试用例"
            session_store.append(session_id, "user", user_content)
            session_store.append(session_id, "assistant", result.get("response", ""))

            payload = {
                "status": "success",
                "sessionId": session_id,
                "type": result.get("type", "query"),
                "response": result.get("response", ""),
            }
            if "newTestcase" in result:
                payload["newTestcase"] = result["newTestcase"]
            return payload
        except Exception as e:
            return {
                "status": "error",
                "sessionId": session_id,
                "type": "query",
                "response": f"Error: {str(e)}",
            }

    # 兼容旧接口：/api/prd_agent
    @app.post("/api/prd_agent")
    def prd_agent_legacy(payload: dict = Body(...)):
        user_prompt = payload.get("prompt", "")
        current_prd = payload.get("prd", "")
        session_id = payload.get("sessionId", f"legacy-{id(payload)}")

        if not user_prompt:
            return {"status": "error", "type": "query", "response": "Error: prompt is empty."}
        if not current_prd:
            return {"status": "error", "type": "query", "response": "Error: PRD is empty."}

        req = PrdAgentRequest(
            sessionId=session_id,
            params={"text": current_prd},
            instruction=user_prompt,
        )
        return prd_agent_v2(req)

    @app.delete("/api/session/{session_id}")
    def delete_session(session_id: str):
        session_store.clear(session_id)
        return {"status": "success", "message": f"Session {session_id} cleared"}

    @app.get("/health")
    def health_check():
        return {
            "status": "healthy",
            "service": "AI Test Case Agent Server",
            "version": "1.0.0",
            "endpoints": [
                "POST /api/prd - PRD 智能体（LangGraph）",
                "POST /api/testcase - Test Case 智能体（LangGraph）",
                "POST /api/ui_agent - UI 自动化智能体（LangGraph）",
                "GET /api/ui_agent/screenshots - 获取截图列表",
                "DELETE /api/ui_agent/screenshots - 清空截图",
                "POST /api/ask - 本地 Ask（LangGraph）",
                "POST /api/chat - PM/DEV Chat-only（LangGraph）",
                "POST /api/prd_agent - PRD 兼容接口",
                "DELETE /api/session/{session_id} - 清除会话",
                "GET /api/ask/config - Ask 接口配置概览",
            ],
            "ask_configs": get_all_configs_summary(),
        }

    @app.get("/api/ask/config")
    def ask_config_overview():
        """查看 Ask 接口的配置概览（模型/参数/prompt文件）"""
        return {
            "status": "success",
            "configs": get_all_configs_summary(),
        }

    @app.post("/api/ui_agent")
    def ui_agent(request: UIAgentRequest):
        session_id = request.sessionId
        instruction = request.instruction
        url = request.params.get("url", "")
        current_plan = request.params.get("plan", "")
        current_report = request.params.get("report", "")
        headless = request.params.get("headless", False)  # 获取headless参数，默认为False（有头模式）
        # workflow: direct（LLM 直接工具操控）| closed_loop（自然语言->Plan JSON->Runner->Report）
        workflow = (request.params.get("workflow") or request.params.get("mode") or "direct").strip().lower()
        auto_heal = bool(request.params.get("autoHeal", True))
        max_heal_rounds = int(request.params.get("maxHealRounds", 1) or 1)
        max_turns = int(request.params.get("maxTurns", 15) or 15)
        auto_continue = bool(request.params.get("autoContinue", False))
        additional_prds = [{"title": p.title, "content": p.content} for p in (request.additionalPrds or [])]

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

            session_store.append(session_id, "user", instruction)
            session_store.append(session_id, "assistant", out.get("finalResponse", ""))

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

    @app.post("/api/ask")
    def local_ask(request: AskRequest):
        session_id = request.sessionId
        ask_type = (request.type or "testprd").strip().lower()
        params = request.params or {}
        text = (params.get("text") or "").strip()
        instruction = (request.instruction or "").strip()
        
        # 处理辅助PRD列表
        additional_prds = []
        if request.additionalPrds:
            additional_prds = [{"title": p.title, "content": p.content} for p in request.additionalPrds]

        if not text:
            return {"status": "error", "sessionId": session_id, "answer": "", "error": "Error: params.text is empty."}

        try:
            out = ask_graph.invoke({
                "sessionId": session_id, 
                "type": ask_type, 
                "text": text, 
                "code": request.code,
                "additionalPrds": additional_prds,
                "instruction": instruction,
            })
            return {"status": "success", "sessionId": session_id, "answer": out.get("answer", "")}
        except Exception as e:
            return {"status": "error", "sessionId": session_id, "answer": "", "error": f"Error: {str(e)}"}

    @app.post("/api/chat")
    def chat_agent(request: ChatAgentRequest):
        session_id = request.sessionId
        role = (request.role or "").strip().lower()
        message = (request.message or "").strip()
        additional_prds = [{"title": p.title, "content": p.content} for p in (request.additionalPrds or [])]

        if role not in ("pm", "dev"):
            return {"status": "error", "sessionId": session_id, "reply": "Error: role must be 'pm' or 'dev'."}
        if not message:
            return {"status": "error", "sessionId": session_id, "reply": "Error: message is empty."}

        try:
            out = chat_graph.invoke({"sessionId": session_id, "role": role, "userMessage": message, "additionalPrds": additional_prds})
            reply = out["result"]["reply"]
            session_store.append(session_id, "user", message)
            session_store.append(session_id, "assistant", reply)
            return {"status": "success", "sessionId": session_id, "reply": reply}
        except Exception as e:
            return {"status": "error", "sessionId": session_id, "reply": f"Error: {str(e)}"}

    return app


