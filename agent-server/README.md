# AI Test Case — Agent Server

> Python FastAPI 后端 + Node.js Midscene Sidecar，提供 AI 测试用例生成、智能体编排和 UI 自动化执行引擎。

本服务包含两个独立进程：

| 进程 | 技术 | 端口 | 职责 |
|------|------|------|------|
| **Agent Server** | Python FastAPI | 8000 | AI 对话、测试用例生成、文档管理、质检评估 |
| **Midscene Sidecar** | Node.js Express | 3000 | UI 自动化执行（浏览器控制、步骤执行、回归基线） |

## 快速开始

### 1. Agent Server (Python)

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器（可选，旧版 UI Agent 需要）
playwright install chromium

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API Key

# 启动服务
python agent_server.py
# 或
bash run_agent.sh
```

**服务地址**: http://localhost:8000
**API 文档**: http://localhost:8000/docs

### 2. Midscene Sidecar (Node.js)

```bash
cd midscene-sidecar

# 安装依赖
npm install

# 配置环境变量（Midscene SDK 从环境变量读取模型配置）
# 需要设置: OPENAI_API_KEY, OPENAI_BASE_URL 等

# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

**服务地址**: http://localhost:3000

### 3. Chrome 调试浏览器（UI 自动化需要）

```bash
# 有头模式（可视化调试）
./run_chrome.sh

# 无头模式（后台运行）
./run_chrome_headless.sh
```

## 项目结构

```
agent-server/
├── agent_server.py             # FastAPI 服务入口
├── requirements.txt            # Python 依赖
├── .env.example                # 环境变量模板
├── run_agent.sh                # Agent 服务启动脚本
├── run_chrome.sh               # 有头 Chrome 启动脚本
├── run_chrome_headless.sh      # 无头 Chrome 启动脚本
│
├── agent_app/                  # 核心业务模块
│   ├── app_factory.py          # FastAPI 路由装配
│   ├── schemas.py              # 请求/响应 Schema
│   ├── config.py               # SDK 客户端初始化
│   ├── config_manager.py       # 统一配置管理
│   ├── ask_config.py           # Ask 接口配置中心
│   ├── prompt_manager.py       # Prompt 模板管理器
│   ├── session_store.py        # 会话存储 (ChromaDB 向量检索)
│   ├── chroma_config.py        # ChromaDB 配置
│   ├── cache_manager.py        # 三层缓存 (LLM/Embedding/PDF)
│   ├── evaluator.py            # AI 质检评估
│   ├── file_processor.py       # 多模态文件处理 (PDF/OCR)
│   ├── multimodal_builder.py   # 多模态消息构建
│   ├── output_formatter.py     # 输出格式转换
│   ├── batch_upload.py         # 批量文件上传
│   ├── task_queue.py           # 异步任务队列 (SSE)
│   ├── telemetry.py            # 可观测性数据收集
│   │
│   ├── graphs/                 # LangGraph 智能体图
│   │   ├── ask_graph.py        # Ask 接口 (PRD/测试点/测试用例生成)
│   │   ├── prd_graph.py        # PRD 分析
│   │   ├── testcase_graph.py   # 测试用例生成
│   │   ├── chat_graph.py       # PM/DEV 对话
│   │   ├── ui_graph.py         # UI 自动化 (旧版 Playwright)
│   │   └── critic_graph.py     # Critic 评估
│   │
│   └── ui/                     # UI 自动化模块 (旧版)
│       ├── browser_helpers.py
│       ├── runner.py
│       └── screenshots.py
│
├── prompts/                    # Prompt 模板
│   ├── system/                 # 角色系统 Prompt
│   │   ├── testcase.md         # 测试用例助手
│   │   ├── testpoint.md        # 测试点生成
│   │   ├── prd_analysis.md     # PRD 分析
│   │   ├── ui_agent.md         # UI 自动化 Agent
│   │   ├── critic.md           # Critic 评估专家
│   │   ├── pm_chat.md          # PM 聊天
│   │   └── dev_chat.md         # DEV 聊天
│   ├── templates/              # 任务模板
│   │   ├── ask_testcase.md     # 测试用例 (XMind H1-H6 格式)
│   │   ├── ask_testcase_yaml.md # 测试用例 (YAML 格式)
│   │   ├── ask_testcase_table.md # 测试用例 (表格格式)
│   │   ├── ask_testpoint.md    # 测试点
│   │   ├── ask_testprd.md      # 测试 PRD
│   │   ├── ask_figma.md        # Figma 解析
│   │   └── rag_filter.md       # RAG 过滤
│   └── skills/                 # 技能增强
│       ├── qa_engineer.md
│       ├── evaluator.md
│       ├── playwright.md
│       └── webapp_testing.md
│
├── midscene-sidecar/           # UI 自动化执行引擎 (Node.js)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts           # Express 服务入口
│       ├── browser/
│       │   └── manager.ts      # Puppeteer 浏览器管理 (launch/connect/close)
│       ├── routes/
│       │   ├── run-testcase.ts         # POST /run-testcase (自由模式)
│       │   ├── run-testcase-stream.ts  # POST /run-testcase/stream (自由模式 SSE)
│       │   ├── run-instant.ts          # POST /run-instant[/stream] (混合模式)
│       │   ├── run-yaml.ts             # POST /run-yaml (YAML 回放)
│       │   ├── run-steps.ts            # POST /run-steps (直接步骤执行)
│       │   ├── regression.ts           # 回归基线 CRUD
│       │   ├── report.ts              # 报告查询
│       │   ├── screenshot.ts          # 截图管理
│       │   ├── cache.ts               # 缓存管理
│       │   └── health.ts              # 健康检查
│       ├── utils/
│       │   ├── step-inference.ts       # 步骤意图推断 (正则, 零 AI 开销)
│       │   ├── execution-engine.ts     # 三层降级执行引擎
│       │   ├── testcase-validator.ts   # 用例校验 + STEP_FORMAT_GUIDE
│       │   └── yaml-generator.ts       # 回归基线 YAML 生成
│       └── actions/
│           └── file-upload-action.ts   # 文件上传自定义动作
│
├── scripts/                    # 测试与迁移脚本
│   ├── migrate_to_chromadb.py
│   ├── test_chroma_setup.py
│   ├── test_evaluator.py
│   ├── test_file_processor.py
│   └── test_e2e_integration.py
│
└── data/                       # 运行时数据
    ├── chroma_db/              # ChromaDB 持久化
    └── cache/                  # 缓存文件
```

## 核心架构

### Agent Server — AI 生成管道

```
前端请求 → FastAPI 路由
    ↓
Ask 接口 (/api/ask)
    ├── type=testprd   → ask_testprd.md prompt → AI 生成优化 PRD
    ├── type=testpoint  → ask_testpoint.md prompt → AI 提取测试点
    ├── type=testcase   → ask_testcase[_yaml|_table].md → AI 生成用例
    └── type=figma      → ask_figma.md → Figma 交互提取
    ↓
LangGraph 编排 (ask_graph.py)
    ├── Prompt 组装 (prompt_manager.py)
    ├── RAG 增强 (ChromaDB 向量检索)
    ├── 技能注入 (qa_engineer.md)
    └── 流式输出 (SSE)
    ↓
LLM (Claude/GPT via OpenAI SDK)
```

### Midscene Sidecar — UI 自动化引擎

三种执行模式：

```
┌─────────────────────────────────────────────────────────────────┐
│                    执行模式选择                                    │
├────────────────┬────────────────────┬───────────────────────────┤
│   自由模式      │   混合模式           │   回归模式                │
│   /run-testcase │   /run-instant      │   /run-yaml              │
├────────────────┼────────────────────┼───────────────────────────┤
│ agent.aiAct    │ 逐步执行            │ YAML 基线回放             │
│ (整段 scenario)│ (三层降级/步)       │ (read-only 缓存)          │
│                │                    │                           │
│ AI 全权规划     │ Layer 1: instant   │ 零 AI 开销                │
│ 一次性执行      │ Layer 2: aiAct     │ 精确复现                  │
│                │ Layer 3: deepThink │                           │
├────────────────┼────────────────────┼───────────────────────────┤
│ 慢, 灵活       │ 中速, 可靠          │ 快, 精确                  │
│ 复杂流程适用    │ 标准用例适用        │ 回归测试适用               │
└────────────────┴────────────────────┴───────────────────────────┘
```

### 步骤推断引擎 (step-inference.ts)

将自然语言步骤文本推断为即时操作类型，纯正则匹配，零 AI 开销：

```
"在邮箱输入框中输入\"user@example.com\""
    → { type: 'input', target: '邮箱输入框', value: 'user@example.com', confidence: 0.95 }

"点击登录按钮"
    → { type: 'tap', target: '登录按钮', confidence: 0.85 }

"向下滚动页面"
    → { type: 'scroll', direction: 'down', confidence: 0.85 }

"复杂的多步骤场景描述"
    → { type: 'aiAct', confidence: 0 }  // 回退到 AI 规划
```

支持的操作类型：tap, doubleTap, rightClick, hover, input, keypress, scroll, wait, navigate, assert, aiAct

### 三层降级执行 (execution-engine.ts)

每个步骤的执行策略：

```
步骤文本 → step-inference 推断
    ↓ confidence ≥ 0.85?
    ├── Yes → Layer 1: instant (aiTap/aiInput/aiHover 直接调用)
    │           ↓ 失败?
    │           → Layer 2: aiAct 单步
    │               ↓ 失败?
    │               → Layer 3: aiAct + deepThink
    │
    └── No → 直接 Layer 2: aiAct 单步
                ↓ 失败?
                → Layer 3: aiAct + deepThink
```

## API 端点

### Agent Server (port 8000)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ask` | POST | 统一 Ask 接口（PRD/测试点/用例） |
| `/api/chat` | POST | PM/DEV 聊天 |
| `/api/evaluate` | POST | AI 质检评估 |
| `/api/evaluate/full` | POST | Critic Agent 评估 |
| `/api/docs/upload` | POST | 文件上传 (PDF/图片/文本) |
| `/api/docs/batch-upload` | POST | 批量上传 |
| `/api/history/search` | GET | 搜索历史用例 |
| `/api/knowledge/list` | GET | 知识库列表 |
| `/health` | GET | 健康检查 |
| `/docs` | GET | Swagger 文档 |

### Midscene Sidecar (port 3000)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/run-testcase` | POST | 自由模式执行 |
| `/run-testcase/stream` | POST | 自由模式 SSE 流 |
| `/run-instant` | POST | 混合模式执行 |
| `/run-instant/stream` | POST | 混合模式 SSE 流 |
| `/run-yaml` | POST | YAML 基线回放 |
| `/run-steps` | POST | 直接步骤执行 |
| `/validate-testcase` | POST | 用例校验（推荐执行模式） |
| `/regression/baselines` | GET | 列出回归基线 |
| `/regression/baselines` | POST | 保存回归基线 |
| `/health` | GET | 健康检查 |

## 环境变量

### Agent Server (.env)

```env
# === API 配置（必需）===
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://zenmux.ai/api/v1

# === 模型配置 ===
DEFAULT_MODEL=anthropic/claude-haiku-4.5
ASK_TESTCASE_MODEL=anthropic/claude-haiku-4.5

# === 功能开关 ===
USE_CHROMADB=true
USE_QA_SKILL=true
USE_LLM_CACHE=true

# === 服务 ===
PORT=8000
LOG_LEVEL=INFO
```

### Midscene Sidecar (.env)

```env
# Midscene SDK 通过环境变量读取模型配置
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://your-api-endpoint

# 可选：为规划/定位分别配置不同模型
MIDSCENE_PLANNING_MODEL_NAME=gpt-4o
MIDSCENE_INSIGHT_MODEL_NAME=gpt-4o-mini

# 报告和缓存目录
MIDSCENE_REPORT_DIR=./midscene_run/report
MIDSCENE_CACHE_DIR=./midscene_run/cache
```

## 开发调试

```bash
# Agent Server 详细日志
ASK_DEBUG=1 python agent_server.py

# Midscene Sidecar 开发模式（热重载）
cd midscene-sidecar && npm run dev

# 查看缓存状态
curl http://localhost:8000/api/cache/stats

# 查看遥测数据
curl http://localhost:8000/api/telemetry/stats

# 校验用例结构
curl -X POST http://localhost:3000/validate-testcase \
  -H "Content-Type: application/json" \
  -d '{"testcase": {"scenario": "测试登录", "steps": ["点击登录按钮"]}, "mode": "mixed"}'
```
