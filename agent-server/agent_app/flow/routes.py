"""
无代码 UI 自动化 - API 路由

提供以下接口：
- POST /api/flow/execute - 执行流程
- GET  /api/flow/status/{taskId} - 获取执行状态（SSE）
- GET  /api/flow/result/{taskId} - 获取执行结果
- GET  /api/flow/templates - 获取模板列表
- GET  /api/flow/templates/{id} - 获取模板详情
- POST /api/flow/templates - 保存模板
- DELETE /api/flow/templates/{id} - 删除模板
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import traceback
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from agent_app.flow.schemas import (
    ExecuteFlowRequest,
    ExecuteFlowResponse,
    FlowConfig,
    FlowResult,
    FlowResultResponse,
    FlowStatus,
    FlowStatusResponse,
    SaveTemplateRequest,
    SaveTemplateResponse,
    TemplateListResponse,
)
from agent_app.flow.template_store import get_template_store
from agent_app.flow.executor import FlowExecutor


# 创建路由
router = APIRouter(prefix="/api/flow", tags=["flow"])

# 任务存储（内存，生产环境应使用 Redis）
_tasks: Dict[str, Dict[str, Any]] = {}

# 线程池（用于执行同步的 Playwright 代码）
_thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=3)


def _execute_flow_sync(task: Dict[str, Any]) -> Dict[str, Any]:
    """
    同步执行流程（在线程池中运行）
    
    由于 Playwright sync API 不能在异步上下文中使用，
    需要在单独的线程中执行。
    """
    pw = None
    browser = None
    result_dict: Dict[str, Any] = {"success": False, "error": "Unknown error"}
    
    try:
        print("[flow/routes] Starting flow execution in thread...")
        from playwright.sync_api import sync_playwright
        
        pw = sync_playwright().start()
        
        # 尝试连接 CDP（已启动的 Chrome）
        try:
            browser = pw.chromium.connect_over_cdp("http://127.0.0.1:9222")
            contexts = browser.contexts
            if contexts:
                pages = contexts[0].pages
                if pages:
                    page = pages[0]
                    print(f"[flow/routes] Connected to CDP, page: {page.url}")
                else:
                    raise Exception("No pages in context")
            else:
                raise Exception("No contexts in browser")
        except Exception as e:
            print(f"[flow/routes] CDP connection failed: {e}, launching new browser")
            browser = pw.chromium.launch(headless=False)
            context = browser.new_context()
            page = context.new_page()
        
        # 创建执行器并执行
        print("[flow/routes] Creating FlowExecutor...")
        executor = FlowExecutor(
            page=page,
            flow_config=task["flow"],
            variables=task["variables"],
            options=task["options"],
        )
        
        print("[flow/routes] Executing flow...")
        result = executor.execute()
        print(f"[flow/routes] Flow execution completed, status: {result.status}")
        
        result_dict = {
            "success": True,
            "result": result.model_dump(),
        }
        
    except Exception as e:
        print(f"[flow/routes] Flow execution error: {e}")
        traceback.print_exc()
        result_dict = {
            "success": False,
            "error": str(e),
        }
    
    finally:
        # 注意：CDP 连接不需要关闭浏览器
        # 如果是新启动的浏览器，可能需要保持打开状态以便查看
        print("[flow/routes] Cleaning up playwright...")
        if pw:
            try:
                pw.stop()
                print("[flow/routes] Playwright stopped")
            except Exception as e:
                print(f"[flow/routes] Error stopping playwright: {e}")
    
    print(f"[flow/routes] Returning result: success={result_dict.get('success')}")
    return result_dict


# ==================== 流程执行 ====================

@router.post("/execute", response_model=ExecuteFlowResponse)
async def execute_flow(req: ExecuteFlowRequest):
    """
    执行可视化测试流程
    
    - 接收 FlowConfig 配置
    - 转换为 Plan JSON 并执行
    - 返回任务 ID
    """
    task_id = f"flow_{uuid.uuid4().hex[:12]}"
    
    try:
        # 存储任务信息
        _tasks[task_id] = {
            "status": "pending",
            "flow": req.flow.model_dump(),
            "variables": req.variables,
            "options": req.options.model_dump() if req.options else None,
            "sessionId": req.sessionId,
            "createdAt": datetime.now().isoformat(),
            "result": None,
        }
        
        # 异步执行（不阻塞响应）
        asyncio.create_task(_execute_flow_task(task_id))
        
        return ExecuteFlowResponse(
            status="success",
            taskId=task_id,
            message="Flow execution started",
        )
        
    except Exception as e:
        traceback.print_exc()
        return ExecuteFlowResponse(
            status="error",
            taskId=task_id,
            message=str(e),
        )


async def _execute_flow_task(task_id: str):
    """
    异步执行流程任务
    
    由于 Playwright sync API 不能在 asyncio 事件循环中直接使用，
    使用 run_in_executor 将同步代码放到线程池中执行。
    """
    task = _tasks.get(task_id)
    if not task:
        print(f"[flow/routes] Task {task_id} not found")
        return
    
    try:
        # 更新状态
        print(f"[flow/routes] Starting task {task_id}")
        task["status"] = "running"
        task["startedAt"] = datetime.now().isoformat()
        
        # 在线程池中执行同步代码
        loop = asyncio.get_running_loop()
        print(f"[flow/routes] Submitting to thread pool...")
        sync_result = await loop.run_in_executor(
            _thread_pool,
            _execute_flow_sync,
            task,
        )
        
        print(f"[flow/routes] Thread pool returned: success={sync_result.get('success')}")
        
        # 处理结果
        if sync_result.get("success"):
            task["status"] = "completed"
            task["result"] = sync_result["result"]
            print(f"[flow/routes] Task {task_id} completed successfully")
        else:
            task["status"] = "error"
            task["error"] = sync_result.get("error", "Unknown error")
            print(f"[flow/routes] Task {task_id} failed: {task['error']}")
        
        task["completedAt"] = datetime.now().isoformat()
        
    except Exception as e:
        print(f"[flow/routes] Task {task_id} exception: {e}")
        traceback.print_exc()
        task["status"] = "error"
        task["error"] = str(e)
        task["completedAt"] = datetime.now().isoformat()


@router.get("/status/{task_id}")
async def get_flow_status(task_id: str):
    """
    获取流程执行状态（SSE 流式）
    
    用于实时显示执行进度
    """
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    async def event_generator():
        while True:
            task = _tasks.get(task_id)
            if not task:
                break
            
            status = task.get("status", "unknown")
            result = task.get("result")
            
            # 构建状态响应
            response = {
                "taskId": task_id,
                "status": status,
                "progress": 0,
            }
            
            if result:
                response["progress"] = 100
                steps = result.get("steps", [])
                if steps:
                    response["currentStep"] = steps[-1].get("stepName", "")
            
            yield f"data: {json.dumps(response, ensure_ascii=False)}\n\n"
            
            # 如果完成或出错，停止推送
            if status in ("completed", "error"):
                break
            
            await asyncio.sleep(0.5)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.get("/result/{task_id}", response_model=FlowResultResponse)
async def get_flow_result(task_id: str):
    """获取流程执行结果"""
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = task.get("result")
    if not result:
        return FlowResultResponse(
            status="error",
            result=None,
            message=f"Task is {task.get('status', 'unknown')}: {task.get('error', 'No result yet')}",
        )
    
    return FlowResultResponse(
        status="success",
        result=FlowResult(**result),
    )


# ==================== 模板管理 ====================

@router.get("/templates", response_model=TemplateListResponse)
async def list_templates(session_id: Optional[str] = Query(default=None)):
    """获取所有模板（预置 + 用户）"""
    store = get_template_store()
    templates = store.list_all(session_id)
    
    return TemplateListResponse(
        status="success",
        templates=[FlowConfig(**t) for t in templates],
    )


@router.get("/templates/{template_id}")
async def get_template(template_id: str, session_id: Optional[str] = Query(default=None)):
    """获取模板详情"""
    store = get_template_store()
    template = store.get(template_id, session_id)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {
        "status": "success",
        "template": template,
    }


@router.post("/templates", response_model=SaveTemplateResponse)
async def save_template(req: SaveTemplateRequest):
    """保存用户模板"""
    store = get_template_store()
    
    try:
        saved = store.save(req.template.model_dump(), req.sessionId)
        return SaveTemplateResponse(
            status="success",
            templateId=saved["id"],
        )
    except Exception as e:
        return SaveTemplateResponse(
            status="error",
            templateId="",
            message=str(e),
        )


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, session_id: Optional[str] = Query(default=None)):
    """删除用户模板（预置模板不可删除）"""
    store = get_template_store()
    
    if store.is_preset(template_id):
        raise HTTPException(status_code=403, detail="Cannot delete preset template")
    
    success = store.delete(template_id, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"status": "success", "message": f"Template {template_id} deleted"}


# ==================== 调试接口 ====================

@router.get("/tasks")
async def list_tasks():
    """列出所有任务（调试用）"""
    return {
        "status": "success",
        "tasks": [
            {
                "taskId": task_id,
                "status": task.get("status"),
                "createdAt": task.get("createdAt"),
                "completedAt": task.get("completedAt"),
            }
            for task_id, task in _tasks.items()
        ],
    }


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """删除任务（调试用）"""
    if task_id in _tasks:
        del _tasks[task_id]
        return {"status": "success", "message": f"Task {task_id} deleted"}
    raise HTTPException(status_code=404, detail="Task not found")
