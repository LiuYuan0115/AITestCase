"""
兼容入口：保留原文件名，内部切换到 LangGraph 重构后的应用工厂。

说明：
- 旧版所有逻辑都在本文件中，维护成本高
- 新版将 PRD / TestCase 迁到 LangGraph
- API 路径保持不变，前端无需改
"""

from agent_app.app_factory import create_app
from agent_app.config import build_openai_client, build_anthropic_client, get_default_model


# 初始化客户端
openai_client = build_openai_client()
anthropic_client = build_anthropic_client()
model_name = get_default_model()

app = create_app(openai_client, model_name=model_name, anthropic_client=anthropic_client)

if __name__ == "__main__":
    import uvicorn
    print("🚀 AI Test Case Agent Server")
    print("=" * 50)
    print("📍 服务地址: http://localhost:8000")
    print("📖 API 文档: http://localhost:8000/docs")
    print("=" * 50)
    print("📝 PRD 智能体（LangGraph）: POST /api/prd")
    print("🧪 Test Case 智能体（LangGraph）: POST /api/testcase")
    print("🧩 PRD 兼容接口: POST /api/prd_agent")
    print("🗑️ 清除会话: DELETE /api/session/{session_id}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
