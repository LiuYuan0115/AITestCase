# AI Test Case Plugin

> 🤖 基于 AI 的智能测试用例生成工具 — Chrome 浏览器扩展

一款智能化 Chrome 插件，帮助测试工程师从需求文档快速生成 PRD 分析、测试点提取、测试用例，并支持 UI 自动化测试和 AI 质检评估。

---

## 📁 项目结构

```
AITestCase/
├── agent-server/              # 🐍 Python 后端服务 (FastAPI)
│   ├── agent_server.py         # 服务启动入口
│   ├── requirements.txt        # Python 依赖
│   ├── .env.example            # 环境变量模板
│   ├── run_agent.sh            # Agent 服务启动脚本
│   ├── run_chrome.sh           # 有头 Chrome 启动脚本
│   ├── run_chrome_headless.sh  # 无头 Chrome 启动脚本
│   │
│   ├── agent_app/              # 📦 核心业务模块
│   │   ├── app_factory.py      # FastAPI 路由与依赖装配
│   │   ├── schemas.py          # 请求/响应 Schema
│   │   ├── config.py           # SDK 客户端初始化 (OpenAI/Anthropic)
│   │   ├── config_manager.py   # 统一配置管理
│   │   ├── ask_config.py       # Ask 接口配置中心
│   │   ├── prompt_manager.py   # 统一 Prompt 管理器
│   │   ├── session_store.py    # 会话存储 (含 ChromaDB 向量检索)
│   │   ├── chroma_config.py    # ChromaDB 向量数据库配置
│   │   ├── cache_manager.py    # 三层缓存管理 (LLM/Embedding/PDF)
│   │   ├── evaluator.py        # AI 测试用例质检评估
│   │   ├── file_processor.py   # 多模态文件处理 (PDF/图片/OCR)
│   │   ├── multimodal_builder.py # 多模态消息构建器
│   │   ├── output_formatter.py # 输出格式转换 (MD/Table/YAML/JSON)
│   │   ├── pdf_composer.py     # PDF 合成器
│   │   ├── batch_upload.py     # 批量文件上传处理
│   │   ├── task_queue.py       # 异步任务队列 (SSE 流式输出)
│   │   ├── telemetry.py        # 可观测性数据收集
│   │   ├── tooling.py          # 工具 Schema 定义
│   │   │
│   │   ├── graphs/             # 🔗 LangGraph 智能体图
│   │   │   ├── ask_graph.py    # Ask 接口图
│   │   │   ├── prd_graph.py    # PRD 智能体图
│   │   │   ├── testcase_graph.py # 测试用例智能体图
│   │   │   ├── chat_graph.py   # 聊天智能体图
│   │   │   ├── ui_graph.py     # UI 自动化执行图
│   │   │   └── critic_graph.py # Critic 评估智能体图
│   │   │
│   │   ├── ui/                 # 🖥️ UI 自动化模块
│   │   │   ├── browser_helpers.py # 元素定位/无障碍快照
│   │   │   ├── runner.py       # Plan DSL 执行器 (自愈/证据采集)
│   │   │   └── screenshots.py  # 截图管理
│   │   │
│   │   └── assets/             # 📂 资产存储
│   │       └── storage.py      # 本地落盘 + URL 生成
│   │
│   ├── prompts/                # 📝 Prompt 模板文件
│   │   ├── system/             # 角色系统 Prompt
│   │   │   ├── testcase.md     # 测试用例助手
│   │   │   ├── testpoint.md    # 测试点生成
│   │   │   ├── prd_analysis.md # PRD 分析
│   │   │   ├── ui_agent.md     # UI 自动化 Agent
│   │   │   ├── critic.md       # Critic 评估专家
│   │   │   ├── pm_chat.md      # PM 聊天
│   │   │   └── dev_chat.md     # DEV 聊天
│   │   ├── templates/          # 任务模板 Prompt
│   │   │   ├── ask_testcase.md # 测试用例生成模板
│   │   │   ├── ask_testcase_table.md # 表格格式模板
│   │   │   ├── ask_testcase_yaml.md  # YAML 格式模板
│   │   │   ├── ask_testpoint.md # 测试点生成模板
│   │   │   ├── ask_testprd.md  # 测试 PRD 模板
│   │   │   ├── ask_figma.md    # Figma 解析模板
│   │   │   └── rag_filter.md   # RAG 过滤模板
│   │   └── skills/             # 技能增强 Prompt
│   │       ├── qa_engineer.md  # QA 工程师最佳实践
│   │       ├── evaluator.md    # 评估器技能
│   │       ├── playwright.md   # Playwright 自动化
│   │       └── webapp_testing.md # Web 应用测试
│   │
│   ├── scripts/                # 🧪 测试与迁移脚本
│   │   ├── migrate_to_chromadb.py    # 数据迁移 → ChromaDB
│   │   ├── test_chroma_setup.py      # ChromaDB 配置测试
│   │   ├── test_evaluator.py         # 评估器测试
│   │   ├── test_file_processor.py    # 文件处理器测试
│   │   ├── test_e2e_integration.py   # 端到端集成测试
│   │   └── verify_knowledge_base.py  # 知识库验证
│   │
│   ├── midscene-sidecar/       # 🎯 UI 自动化执行引擎 (Node.js + Midscene)
│   │   ├── src/
│   │   │   ├── server.ts       # Express 服务入口
│   │   │   ├── browser/        # Puppeteer 浏览器管理
│   │   │   ├── routes/         # API 路由
│   │   │   │   ├── run-testcase.ts        # 自由模式执行
│   │   │   │   ├── run-testcase-stream.ts # 自由模式 SSE 流
│   │   │   │   ├── run-instant.ts         # 混合模式执行 + SSE 流
│   │   │   │   ├── run-yaml.ts            # YAML 基线回放
│   │   │   │   ├── regression.ts          # 回归基线管理
│   │   │   │   └── run-steps.ts           # 直接步骤执行
│   │   │   ├── utils/          # 核心工具
│   │   │   │   ├── step-inference.ts      # 步骤意图推断 (正则, 零 AI)
│   │   │   │   ├── execution-engine.ts    # 三层降级执行引擎
│   │   │   │   ├── testcase-validator.ts  # 用例校验 + 格式规范
│   │   │   │   └── yaml-generator.ts      # 回归基线 YAML 生成
│   │   │   └── actions/        # 自定义动作 (文件上传等)
│   │   └── package.json
│   │
│   └── data/                   # 💾 运行时数据
│       ├── chroma_db/          # ChromaDB 持久化存储
│       └── cache/              # 缓存文件
│
├── solvely-mvp/               # 🖥️ Chrome 扩展前端 (Vue 3 + WXT)
│   ├── package.json            # Node 依赖
│   ├── wxt.config.ts           # WXT 构建配置
│   ├── tsconfig.json           # TypeScript 配置
│   ├── .env.example            # 环境变量模板
│   │
│   └── src/
│       ├── api.ts              # API 调用封装
│       ├── env.d.ts            # 环境变量类型声明
│       │
│       ├── entrypoints/        # 🚪 入口点
│       │   ├── sidepanel/      # 侧边栏 UI（主界面）
│       │   │   ├── App.vue     # 主组件
│       │   │   ├── index.html  # HTML 入口
│       │   │   └── main.ts     # 应用入口
│       │   ├── content.ts      # 内容脚本（页面注入）
│       │   └── background.ts   # 后台脚本
│       │
│       ├── components/         # 🧩 Vue 组件
│       │   ├── ChatInput.vue         # 聊天输入框
│       │   ├── ChatMessage.vue       # 消息渲染（流式/Markdown）
│       │   ├── InputToolbar.vue      # 输入工具栏
│       │   ├── RoleSelector.vue      # 角色选择器 (PM/DEV/QA)
│       │   ├── WorkflowProgress.vue  # QA 工作流进度
│       │   ├── MindMapPreview.vue    # 思维导图预览
│       │   ├── FormatPreview.vue     # 多格式预览/导出
│       │   ├── DocumentPanel.vue     # 文档管理面板
│       │   ├── DocumentCard.vue      # 文档卡片
│       │   ├── DocVersionList.vue    # 版本历史列表
│       │   ├── DocDiffViewer.vue     # 文档版本对比
│       │   ├── FilePreview.vue       # 文件预览
│       │   ├── BatchUploader.vue     # 批量文件上传
│       │   ├── KnowledgeBasePanel.vue # 知识库管理
│       │   ├── HistoryPanel.vue      # 历史记录面板
│       │   ├── QualityReportPanel.vue # 质量评估报告
│       │   ├── TaskProgressBar.vue   # 任务进度条
│       │   ├── TestCaseFormatSelector.vue # 格式选择器
│       │   ├── DebugDrawer.vue       # 调试面板
│       │   ├── common/               # 通用组件
│       │   │   └── NeoTooltip.vue    # Tooltip 组件
│       │   └── icons/                # 图标组件
│       │       ├── IconButton.vue
│       │       └── index.ts
│       │
│       ├── composables/        # 🔄 组合式函数 (状态管理)
│       │   ├── index.ts        # 统一导出
│       │   ├── useChat.ts      # 聊天消息管理
│       │   ├── useDocuments.ts # 文档 CRUD/版本管理
│       │   ├── useFileUpload.ts # 文件上传/进度追踪
│       │   ├── useRole.ts      # 角色切换管理
│       │   ├── useSession.ts   # 会话管理
│       │   ├── useTask.ts      # 异步任务管理
│       │   ├── useTaskProgress.ts # 任务进度 (SSE/轮询)
│       │   └── useWorkflow.ts  # 工作流步骤管理
│       │
│       ├── utils/              # 🛠️ 工具函数
│       │   ├── agentUrl.ts     # Agent 服务地址管理
│       │   ├── askApi.ts       # Ask API 封装
│       │   ├── connectionHelper.ts # Content Script 连接辅助
│       │   ├── docStoreApi.ts  # 文档存储 API
│       │   ├── formatConverter.ts # 格式转换 (MD→Table/YAML)
│       │   ├── imageExtractor.ts # 图片提取/上传
│       │   ├── imageProcessor.ts # 图片处理
│       │   ├── md5.ts          # 文件 MD5 计算
│       │   ├── messageAdapter.ts # 消息类型适配
│       │   ├── page.ts         # 页面内容提取
│       │   ├── preferences.ts  # 用户偏好管理
│       │   ├── refRegistry.ts  # 文档版本指针
│       │   ├── retry.ts        # 自动重试（指数退避）
│       │   └── textUtils.ts    # 文本处理工具
│       │
│       ├── types/              # 📋 TypeScript 类型定义
│       │   └── chat.ts         # 聊天相关类型
│       │
│       └── directives/         # 📌 自定义指令
│           └── tooltip.ts      # Tooltip 指令
│
├── deploy/                    # 🚀 部署配置 (Google Cloud Run)
│   ├── README.md              # 部署说明
│   ├── Makefile               # 部署主入口
│   ├── service.yaml           # Cloud Run 服务定义
│   ├── agent-server/          # Agent Server Docker 配置
│   │   ├── Dockerfile
│   │   └── Makefile
│   └── nginx/                 # Nginx 反向代理配置
│       ├── Dockerfile
│       ├── Makefile
│       └── nginx.conf
│
└── README.md                 # 本文件
```

---

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                     Chrome 浏览器扩展 (前端)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ PM 角色   │  │ DEV 角色  │  │ QA 角色   │  │ UI 自动化面板   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       └──────────────┴──────────────┴─────────────────┘           │
│                              ↕ HTTP/SSE                          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┴───────────────────────────────────┐
│                    Agent Server (后端)                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Ask 接口    │  │ Chat 接口  │  │ UI Agent   │  │ Evaluate  │  │
│  │ (PRD/测试点 │  │ (PM/DEV   │  │ (浏览器     │  │ (AI 质检  │  │
│  │  /测试用例) │  │  对话)     │  │  自动化)    │  │  评估)    │  │
│  └──────┬─────┘  └──────┬────┘  └──────┬─────┘  └─────┬─────┘  │
│         └───────────────┼──────────────┼───────────────┘         │
│                         ↓              ↓                         │
│  ┌────────────────────────────┐  ┌──────────────┐               │
│  │   LangGraph 智能体编排      │  │  Playwright  │               │
│  │ (ask/prd/testcase/critic)  │  │  浏览器控制   │               │
│  └────────────┬───────────────┘  └──────────────┘               │
│               ↓                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  基础设施层                                                │    │
│  │  ChromaDB向量检索 │ 三层缓存 │ 任务队列 │ Prompt管理 │ 遥测 │    │
│  └──────────────────────────────────────────────────────────┘    │
│               ↓                                                  │
│  ┌────────────────────┐                                          │
│  │  LLM (Claude/GPT)  │                                          │
│  └────────────────────┘                                          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┴───────────────────────────────────┐
│                  Midscene Sidecar (UI 自动化引擎)                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ 自由模式  │  │  混合模式     │  │  回归模式     │               │
│  │ aiAct    │  │  逐步执行     │  │  YAML 回放   │               │
│  │ 全场景   │  │  三层降级     │  │  基线对比     │               │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘               │
│       └───────────────┴─────────────────┘                        │
│                        ↓                                         │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Midscene SDK + Puppeteer (视觉定位 + 浏览器控制)          │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 环境要求

| 工具     | 版本要求   | 说明                    |
|----------|-----------|-------------------------|
| Node.js  | >= 18.0   | 前端构建                |
| Python   | >= 3.9    | 后端运行                |
| Chrome   | >= 88     | 扩展宿主浏览器          |
| Git      | 已安装     | 版本管理                |
| poppler  | 可选       | PDF 转图片 (brew install poppler) |

### 1️⃣ 启动后端服务（Agent Server）

```bash
# 进入后端目录
cd agent-server

# 创建虚拟环境（首次）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器（UI 自动化需要）
playwright install chromium

# 配置环境变量（从模板复制并修改）
cp .env.example .env
# 编辑 .env 填入你的 API Key

# 启动服务
python agent_server.py
# 或使用启动脚本（会自动检查依赖）
bash run_agent.sh
```

**服务地址**: http://localhost:8000
**API 文档**: http://localhost:8000/docs
**健康检查**: http://localhost:8000/health

### 2️⃣ 启动 Midscene Sidecar（UI 自动化引擎）

```bash
cd agent-server/midscene-sidecar

# 安装依赖（首次）
npm install

# 配置环境变量（Midscene SDK 从环境变量读取模型配置）
# 需要设置: OPENAI_API_KEY, OPENAI_BASE_URL

# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

**服务地址**: http://localhost:3000
**健康检查**: http://localhost:3000/health

### 3️⃣ 启动前端扩展（Chrome Extension）

```bash
# 进入前端目录
cd solvely-mvp

# 安装依赖（首次）
npm install

# 配置环境变量（从模板复制并修改）
cp .env.example .env
```

#### 运行模式

| 模式     | 命令            | 说明                                    |
|----------|----------------|-----------------------------------------|
| 开发模式 | `npm run dev`   | 热重载，连接本地 Agent (localhost:8000)  |
| 生产构建 | `npm run build` | 输出到 `.output/chrome-mv3`             |

### 4️⃣ 安装 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」（右上角开关）
3. 点击「加载已解压的扩展程序」
4. 选择目录：`solvely-mvp/.output/chrome-mv3`

---

## ✨ 功能特性

### 🧩 统一角色体验（PM / DEV / QA）

- **统一布局**：左侧聊天 + 底部固定输入区 + 右侧文档预览区
- **统一输入区**：输入框、`🔗 链接`、`📸 提取当前页`、`📎 参考`、`💡 提示`
- **右侧文档预览**：
  - PM/DEV：链接/页面提取内容进入文档列表，可编辑/预览
  - QA：PRD/优化 PRD/测试点/测试用例/UI 计划与报告统一管理
- **文档版本管理**：支持版本历史、版本对比、回滚

### 🔄 QA 工作流

```
1.分析 → 2.PRD → 3.测试点 → 4.用例 → 5.测试
```

| 步骤     | 功能              | 输出                  |
|----------|-------------------|-----------------------|
| **分析** | 全页截图 + DOM 提取 | 页面内容入库          |
| **PRD**  | AI 分析需求文档     | PRD 文档（Markdown）  |
| **测试点** | 提取测试要点      | 思维导图              |
| **用例** | 生成测试用例        | 思维导图/表格/YAML    |
| **测试** | UI 自动化测试       | 测试报告              |

### 📦 文档管理系统

- **多文档支持**：主文档、辅助文档、生成结果分类管理
- **批量上传**：支持 PDF/图片/文本批量上传，并发处理
- **版本管理**：文档版本历史、版本对比（Diff 高亮）、回滚
- **知识库**：文档归档到知识库，支持分类管理和搜索

### 🧠 思维导图（MindMap / Markmap）

- **测试点**与**测试用例**默认使用思维导图预览
- 支持节点选中高亮、`Cmd/Ctrl + C` 复制节点
- 支持"复制全部"一键复制整棵树

### 📊 多格式输出

- **Markdown**：默认格式，结构化文档
- **表格**：适合导入测试管理工具
- **YAML**：结构化数据，适合自动化
- **JSON**：机器可读格式
- **思维导图**：可视化展示

### 🔍 AI 质检评估

- **自动评估**：AI 自动发现漏测点、逻辑缺陷
- **覆盖度检测**：检查测试用例对需求的覆盖率
- **Critic 评估**：独立的 Critic Agent 进行验收评估
- **质量报告**：可视化质量评估报告面板

### 💡 智能提示词

点击 `💡 提示`，展示当前模块可用提示词：

- **PM**：需求分析 / 风险识别 / 文档优化
- **DEV**：技术分析 / 工时估算 / 接口设计
- **QA**：按工作流步骤展示对应提示词

### 📸 URL 一键生成

在任意步骤输入 URL：
```
请输出 https://example.com/requirement.html 的测试用例
```
插件自动：提取页面内容 → 上传截图 → 调用 AI → 渲染结果

### 🤖 UI 自动化测试（Midscene Sidecar）

- **三种执行模式**：自由/混合/回归，前端一键切换
- **智能步骤推断**：正则引擎零 AI 开销解析步骤意图
- **三层降级执行**：instant → aiAct → deepThink，确保稳定性
- **回归基线管理**：成功用例自动生成 YAML 基线，支持精确回放
- **文件上传支持**：拖拽模拟、点击上传、AI 坐标定位
- **Smart 缓存策略**：有缓存 read-only，无缓存 read-write，动态内容自动禁用
- **SSE 实时进度**：步骤级进度推送（step_start/step_done/assert_done）
- **有头/无头双模式**：CDP 连接已有浏览器或独立启动 Puppeteer

---

## 🛠️ 技术栈

### 后端 (agent-server)

| 技术                  | 用途                       |
|-----------------------|---------------------------|
| FastAPI               | Web 框架                   |
| LangGraph             | 智能体编排                 |
| OpenAI / Anthropic SDK | LLM 调用 (GPT/Claude)     |
| Playwright            | 浏览器自动化               |
| ChromaDB              | 向量数据库（会话检索）     |
| sentence-transformers | 多语言文本嵌入             |
| pdfplumber / PyPDF2   | PDF 文本提取               |
| pdf2image             | PDF 转图片                 |
| pytesseract           | OCR 文字识别               |
| Pillow                | 图像处理                   |

### UI 自动化引擎 (midscene-sidecar)

| 技术                | 用途                       |
|---------------------|---------------------------|
| Midscene SDK        | AI 视觉定位 + 浏览器操作   |
| Puppeteer           | Chrome 浏览器控制          |
| Express             | HTTP 服务框架              |
| TypeScript          | 类型安全                   |
| js-yaml             | YAML 基线解析/生成         |

### 前端 (solvely-mvp)

| 技术                | 用途                       |
|---------------------|---------------------------|
| Vue 3               | UI 框架（Composition API） |
| WXT                 | Chrome 扩展开发框架        |
| TypeScript          | 类型安全                   |
| Markmap             | 思维导图渲染               |
| Marked              | Markdown 解析              |
| D3.js               | 数据可视化                 |
| Axios               | HTTP 请求                  |
| Lucide              | 图标库                     |

---

## 🎯 UI 自动化执行引擎

### 三种执行模式

前端提供三个模式切换按钮（自由/混合/回归），每种模式适用不同场景：

| 模式 | 端点 | 执行方式 | 适用场景 | AI 开销 |
|------|------|---------|---------|---------|
| **自由模式** | `/run-testcase/stream` | 整个 scenario 丢给 AI 一次性规划执行 | 复杂端到端流程 | 高 |
| **混合模式** | `/run-instant/stream` | 逐步执行，每步三层降级 | 标准结构化用例 | 中 |
| **回归模式** | `/run-yaml` | 回放保存的 YAML 基线 | 回归测试 | 零 |

### 混合模式三层降级策略

```
步骤文本 → step-inference 正则推断（零 AI 开销）
    ↓
confidence ≥ 0.85?
    ├── Yes → Layer 1: instant（aiTap/aiInput/aiHover 直接调用）
    │           ↓ 失败?
    │           → Layer 2: aiAct 单步
    │               ↓ 失败?
    │               → Layer 3: aiAct + deepThink
    └── No → 直接 Layer 2 → Layer 3
```

### 步骤推断引擎 (step-inference.ts)

纯正则匹配，零 AI 开销，将自然语言步骤推断为即时操作：

| 步骤文本 | 推断结果 | 置信度 |
|---------|---------|--------|
| `在邮箱输入框中输入"user@example.com"` | `{type: 'input', target: '邮箱输入框', value: 'user@example.com'}` | 0.95 |
| `点击登录按钮` | `{type: 'tap', target: '登录按钮'}` | 0.85 |
| `向下滚动页面` | `{type: 'scroll', direction: 'down'}` | 0.85 |
| `按下回车` | `{type: 'keypress', value: 'Enter'}` | 0.85 |
| `验证:页面显示欢迎信息` | `{type: 'assert', target: '页面显示欢迎信息'}` | 1.0 |
| `等待3秒` | `{type: 'wait', value: '3000'}` | 1.0 |
| `复杂的多步骤场景描述` | `{type: 'aiAct'}` | 0 (回退 AI) |

支持的操作类型：`tap` `doubleTap` `rightClick` `hover` `input` `keypress` `scroll` `wait` `navigate` `assert` `aiAct`

### 测试用例 → UI 自动化数据管道

```
PRD 需求文档
    ↓ Agent Server (/api/ask)
AI 生成测试用例 (YAML / Table / XMind 格式)
    ↓ testcaseParser.ts
解析为 MidsceneTestCase[] = {
    id, name, scenario, steps[], expectedResults[], preconditions
}
    ↓ 前端选择执行模式
    ├── 自由模式 → scenario 整段发给 aiAct
    ├── 混合模式 → steps[] → step-inference → 逐步执行
    └── 回归模式 → 加载 YAML 基线 → 精确回放
```

### 步骤格式规范 (STEP_FORMAT_GUIDE)

AI 生成的步骤须遵循以下格式，确保 step-inference 正确推断：

```
- 点击操作: "点击[目标元素]"
- 输入操作: "在[目标输入框]中输入[具体值]"
- 滚动操作: "向[方向]滚动[目标区域]"
- 按键操作: "按下[按键名]"
- 悬停操作: "悬停在[目标元素]"
- 断言操作: "验证:[预期状态]"
- 等待操作: "等待[N]秒"
- 导航操作: "跳转到[URL]"
```

> 每步只包含一个操作，输入值用引号包裹，步骤 50 字以内。

---

## 📡 API 接口

### 核心接口

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/api/ask`                            | POST     | 统一 Ask 接口（PRD/测试点/用例） |
| `/api/ask/config`                     | GET      | Ask 接口配置概览             |
| `/api/chat`                           | POST     | PM/DEV 聊天接口              |
| `/api/v2/chat`                        | POST     | 统一聊天接口 (v2)           |
| `/api/ui_agent`                       | POST     | UI 自动化智能体              |
| `/health`                             | GET      | 健康检查                     |

### 文档管理

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/api/docs/upsert`                    | POST     | 上传/更新文档 (JSON)        |
| `/api/docs/upload`                    | POST     | 上传文件 (PDF/图片/文本)    |
| `/api/docs/batch-upload`              | POST     | 批量上传文件                 |
| `/api/docs/batch-delete`              | POST     | 批量删除文档                 |
| `/api/docs/{docId}`                   | GET      | 获取文档内容                 |
| `/api/docs/{docId}`                   | DELETE   | 删除文档                     |

### 会话管理

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/api/sessions/{sessionId}/docs`      | GET      | 列出会话文档                 |
| `/api/sessions/{sessionId}/doc_pointers` | GET/PATCH | 获取/更新文档指针         |
| `/api/session/{sessionId}`            | DELETE   | 清除会话                     |

### AI 质检评估

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/api/evaluate`                       | POST     | AI 质检评估                  |
| `/api/evaluate/simple`                | POST     | 简化评估（无需 PRD）        |
| `/api/evaluate/async`                 | POST     | 异步 AI 质检                 |
| `/api/evaluate/full`                  | POST     | 完整 Critic Agent 评估      |

### 知识库与历史

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/api/docs/{docId}/archive`           | POST     | 归档文档到历史库             |
| `/api/history/search`                 | GET      | 搜索历史用例                 |
| `/api/history/stats`                  | GET      | 历史库统计                   |
| `/api/knowledge/list`                 | GET      | 列出知识库文档               |
| `/api/knowledge/upload`              | POST     | 知识库文件上传               |

### 异步任务

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/api/tasks/{taskId}`                 | GET      | 查询任务状态                 |
| `/api/tasks/{taskId}/stream`          | GET      | SSE 任务进度推送             |
| `/api/tasks/{taskId}`                 | DELETE   | 取消任务                     |
| `/api/tasks`                          | GET      | 列出所有任务                 |
| `/api/jobs`                           | POST     | 创建异步任务                 |
| `/api/jobs/{task_id}`                 | GET      | 获取任务状态                 |
| `/api/jobs/{task_id}/stream`          | GET      | 流式获取任务输出             |

### 其他

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/api/ui_agent/screenshots`           | GET/DELETE | UI 截图列表/清空            |
| `/api/cache/stats`                    | GET      | 缓存统计                    |
| `/api/cache`                          | DELETE   | 清除缓存                    |
| `/api/telemetry/stats`                | GET      | 遥测统计                    |
| `/api/categories`                     | GET/POST | 分类管理                    |
| `/api/assets/{filename}`              | GET      | 获取资源文件                 |

### Midscene Sidecar (port 3000)

| 端点                                  | 方法     | 说明                        |
|---------------------------------------|----------|-----------------------------|
| `/run-testcase`                       | POST     | 自由模式执行                 |
| `/run-testcase/stream`                | POST     | 自由模式 SSE 流式执行        |
| `/run-instant`                        | POST     | 混合模式执行                 |
| `/run-instant/stream`                 | POST     | 混合模式 SSE 流式执行        |
| `/run-yaml`                           | POST     | YAML 基线回放                |
| `/run-steps`                          | POST     | 直接步骤执行                 |
| `/validate-testcase`                  | POST     | 用例校验 + 推荐执行模式      |
| `/regression/baselines`               | GET      | 列出回归基线                 |
| `/regression/baselines`               | POST     | 保存回归基线                 |
| `/regression/baselines/{id}`          | GET      | 获取基线详情                 |
| `/regression/baselines/{id}`          | DELETE   | 删除基线                     |
| `/health`                             | GET      | 健康检查                     |

### 请求示例

#### Ask 接口（生成测试用例）
```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "type": "testcase",
    "params": {
      "text": "用户登录功能需求：\n1. 邮箱密码登录\n2. 密码 8-16 位\n3. 失败 3 次锁定"
    },
    "instruction": "请生成测试用例"
  }'
```

#### AI 质检评估
```bash
curl -X POST http://localhost:8000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "eval-123",
    "testcases": "测试用例 Markdown 内容...",
    "prd": "PRD 文档内容..."
  }'
```

#### UI 自动化（旧版 Playwright Agent）
```bash
curl -X POST http://localhost:8000/api/ui_agent \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "ui-123",
    "instruction": "点击登录按钮",
    "params": {
      "url": "https://example.com",
      "plan": "",
      "report": "",
      "headless": false
    }
  }'
```

#### UI 自动化 — 混合模式（Midscene Sidecar）
```bash
curl -X POST http://localhost:3000/run-instant \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/login",
    "rawSteps": [
      "在邮箱输入框中输入\"user@example.com\"",
      "在密码输入框中输入\"Password123!\"",
      "点击登录按钮"
    ],
    "assertions": ["页面跳转到首页"],
    "caseId": "TC-001",
    "caseName": "登录测试",
    "options": {
      "headless": true,
      "cache": { "strategy": "smart", "id": "TC-001" }
    }
  }'
```

#### UI 自动化 — 自由模式（Midscene Sidecar）
```bash
curl -X POST http://localhost:3000/run-testcase \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/login",
    "testcase": {
      "name": "登录测试",
      "scenario": "输入邮箱 user@example.com 和密码 Password123!，点击登录按钮",
      "expectedResults": ["页面跳转到首页"],
      "steps": [
        "在邮箱输入框中输入\"user@example.com\"",
        "在密码输入框中输入\"Password123!\"",
        "点击登录按钮"
      ]
    },
    "options": { "headless": true }
  }'
```

#### 用例校验（推荐执行模式）
```bash
curl -X POST http://localhost:3000/validate-testcase \
  -H "Content-Type: application/json" \
  -d '{
    "testcase": {
      "scenario": "测试登录",
      "steps": ["在邮箱输入框中输入\"admin\"", "点击登录按钮"],
      "expectedResults": ["登录成功"]
    },
    "mode": "mixed"
  }'
```

---

## 👻 Chrome 调试模式（UI 自动化）

### 有头/无头模式切换

```
┌──────────────────────────┐     ┌──────────────────────────┐
│  有头模式 (调试与准备)     │     │  无头模式 (后台执行)      │
│                          │     │                          │
│  1. 启动有头 Chrome       │     │  1. 杀掉占用端口进程      │
│  2. 安装插件/登录账号     │ ──→ │  2. 启动无头 Chrome       │
│  3. 配置测试环境          │     │  3. 启动 Agent Server    │
│  4. 关闭 Chrome          │     │  4. 执行 UI 自动化        │
└──────────────────────────┘     └──────────────────────────┘
    共享数据目录: /tmp/chrome_dev_test（插件/登录状态复用）
```

#### 方式一：纯有头模式（可视化调试）

```bash
cd agent-server
./run_chrome.sh      # 启动有头 Chrome（能看到浏览器界面）
./run_agent.sh       # 启动 Agent 服务
```

#### 方式二：无头模式（后台运行，推荐）

```bash
# 步骤 1：先用有头模式准备环境（首次或需要更新时）
cd agent-server
./run_chrome.sh
# → 安装插件 → 登录账号 → 配置环境 → 关闭 Chrome (Cmd+Q)

# 步骤 2：切换到无头模式
lsof -t -i:9222 | xargs kill -9   # 确保端口释放
./run_chrome_headless.sh           # 后台启动
./run_agent.sh                     # 启动 Agent 服务

# 步骤 3：在日常浏览器中使用插件，UI 自动化在无头 Chrome 中执行
```

> ⚠️ **注意**：同一时间只能运行一个 Chrome 实例（共享数据目录），切换模式前必须关闭前一个。

---

## ⚙️ 环境变量配置

### 后端 (agent-server/.env)

```env
# ═══ API 配置（必需）═══
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://zenmux.ai/api/v1
ANTHROPIC_BASE_URL=https://zenmux.ai/api/anthropic

# ═══ 模型配置 ═══
DEFAULT_MODEL=anthropic/claude-sonnet-4
MODEL_PRD=anthropic/claude-sonnet-4
MODEL_TESTCASE=anthropic/claude-sonnet-4
MODEL_UI=anthropic/claude-sonnet-4
MODEL_CHAT=anthropic/claude-sonnet-4
MODEL_ASK=anthropic/claude-sonnet-4

# ═══ 功能开关 ═══
USE_CHROMADB=true              # 启用 ChromaDB 向量检索
USE_QA_SKILL=true              # 启用 QA 技能增强
USE_HISTORY_REFERENCE=true     # 启用历史用例参考

# ═══ Ask 接口优化 ═══
ASK_DEBUG=0                    # 1=详细日志
ASK_USE_LLM_SUMMARY=0         # 1=长对话 LLM 摘要
ASK_ENABLE_REPAIR=1            # 1=testprd 修复
ASK_TESTCASE_MAX_TOKENS=20000  # 最大输出长度
ASK_TESTCASE_THINKING_BUDGET=2000 # 思考预算

# ═══ 缓存配置 ═══
CACHE_DIR=data/cache
LLM_CACHE_TTL=86400            # LLM 缓存 TTL (秒)
EMBEDDING_CACHE_TTL=604800     # Embedding 缓存 TTL

# ═══ 服务配置 ═══
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=INFO
```

### Midscene Sidecar (agent-server/midscene-sidecar/.env)

```env
# ═══ Midscene SDK 模型配置（必需）═══
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://zenmux.ai/api/v1

# ═══ 多模型策略（可选）═══
# 为规划/定位分别使用不同模型
MIDSCENE_PLANNING_MODEL_NAME=gpt-4o
MIDSCENE_PLANNING_MODEL_BASE_URL=https://api.openai.com/v1
MIDSCENE_INSIGHT_MODEL_NAME=gpt-4o-mini

# ═══ 报告和缓存目录 ═══
MIDSCENE_REPORT_DIR=./midscene_run/report
MIDSCENE_CACHE_DIR=./midscene_run/cache
```

### 前端 (solvely-mvp/.env)

```env
# ═══ 开发模式 ═══
VITE_USE_REMOTE=false
VITE_LOCAL_AGENT_URL=http://localhost:8000

# ═══ 生产模式 (.env.production) ═══
# VITE_USE_REMOTE=true
# VITE_REMOTE_AGENT_URL=https://your-remote-api.com
# VITE_REMOTE_API_KEY=your_api_key_here
```

---

## 🚢 部署

### 架构

采用 Google Cloud Run 双容器架构：

```
外部请求 → Nginx (API 鉴权/代理) → Agent Server (FastAPI)
```

### 部署命令

```bash
cd deploy

# 构建并推送 Agent Server 镜像
cd agent-server && make build_push_docker

# 构建并推送 Nginx 镜像
cd ../nginx && make build_docker && make push_docker

# 部署到 Cloud Run
cd .. && make deploy
```

### 资源配置

| 组件          | CPU    | 内存    | 自动扩缩      |
|--------------|--------|---------|---------------|
| Nginx        | 200m   | 128Mi   | 0-2 实例      |
| Agent Server | 1000m  | 512Mi   | 0-2 实例      |

---

## 🔧 开发调试

### 后端调试

```bash
# 开启详细日志
export ASK_DEBUG=1
python agent_server.py

# 查看缓存状态
curl http://localhost:8000/api/cache/stats

# 查看遥测数据
curl http://localhost:8000/api/telemetry/stats
```

### Midscene Sidecar 调试

```bash
# 开发模式（热重载 + 详细日志）
cd agent-server/midscene-sidecar
npm run dev

# 查看 Midscene 报告（HTML）
open midscene_run/report/

# 校验用例步骤质量
curl -s -X POST http://localhost:3000/validate-testcase \
  -H "Content-Type: application/json" \
  -d '{"testcase":{"steps":["点击按钮"]}, "mode":"mixed"}' | jq .

# 查看缓存状态
curl http://localhost:3000/cache/stats
```

### 前端调试

```bash
# 开发模式（自动热重载）
cd solvely-mvp
npm run dev

# Chrome DevTools
# 右键点击扩展侧边栏 → 「检查」
```

---

## 🐛 常见问题

### 后端

| 问题 | 解决方案 |
|------|---------|
| `ModuleNotFoundError` | `pip install -r requirements.txt` |
| `OPENAI_API_KEY is not set` | 创建 `.env` 文件并填入 API Key |
| `address already in use` | `lsof -ti:8000 \| xargs kill` |
| ChromaDB SSL 错误 | 检查网络环境或使用离线 Embedding 模型 |
| PDF 转图片失败 | `brew install poppler` |

### 前端

| 问题 | 解决方案 |
|------|---------|
| `Cannot find module` | `npm install` |
| Sidepanel 加载失败 | 确认 `.output/chrome-mv3/sidepanel.html` 存在 |
| API 调用超时 | 降低 `THINKING_BUDGET`，设置 `ASK_USE_LLM_SUMMARY=0` |

### UI 自动化 (Midscene Sidecar)

| 问题 | 解决方案 |
|------|---------|
| Chrome 调试端口未开启 | 运行 `./run_chrome.sh` 或 `./run_chrome_headless.sh` |
| 端口 9222 被占用 | `lsof -t -i:9222 \| xargs kill -9` |
| 端口 3000 被占用 | `lsof -ti:3000 \| xargs kill` |
| 混合模式步骤全回退 aiAct | 检查步骤格式是否符合 STEP_FORMAT_GUIDE |
| 步骤推断置信度低 | 使用 `POST /validate-testcase` 检查步骤质量 |
| Midscene SDK 报错 | 检查 `OPENAI_API_KEY` 和 `OPENAI_BASE_URL` 环境变量 |
| 缓存导致执行不一致 | 清除 `midscene_run/cache/` 目录或使用 `strategy: false` |

---

## 📊 性能优化

### 降低响应时间

```env
# 关闭思考预算（最快）
ASK_TESTCASE_THINKING_BUDGET=0
ASK_TESTPOINT_THINKING_BUDGET=0

# 降低输出长度
ASK_TESTCASE_MAX_TOKENS=10000

# 关闭调试日志
ASK_DEBUG=0

# 关闭历史摘要
ASK_USE_LLM_SUMMARY=0
```

### 利用缓存

```env
# 启用 LLM 响应缓存（默认 24h TTL）
LLM_CACHE_TTL=86400

# 启用 Embedding 缓存（默认 7 天）
EMBEDDING_CACHE_TTL=604800
```

---

## 📝 更新日志

### v0.0.9 (2025-02)
- ✅ 修复 **混合模式步骤数据丢失**：YAML 解析器 `extractYamlSteps()` 现在同时提取 `action` + `data` 字段并智能合并
- ✅ 新增 `mergeActionAndData()` 向后兼容函数：旧格式 YAML（action+data 分离）自动合并为 step-inference 可识别的格式
- ✅ 优化 **YAML Prompt 模板**：移除 `data` 子字段，注入 STEP_FORMAT_GUIDE 步骤格式规范
- ✅ 优化 **Table Prompt 模板**：操作步骤字段注入格式约束，更新示例
- ✅ 所有 Prompt 示例统一为 `"在[目标]中输入[值]"` 格式，确保 step-inference 高置信度匹配

### v0.0.8 (2025-02)
- ✅ 新增 **Midscene Sidecar** UI 自动化引擎：独立 Node.js 进程，替代旧版 Playwright Agent
- ✅ 新增 **三种执行模式**：自由模式 / 混合模式 / 回归模式，前端一键切换
- ✅ 新增 **步骤推断引擎** (step-inference.ts)：纯正则匹配，零 AI 开销，11 种操作类型
- ✅ 新增 **三层降级执行引擎** (execution-engine.ts)：instant → aiAct → deepThink
- ✅ 新增 **用例校验器** (testcase-validator.ts)：自动推荐最优执行模式
- ✅ 新增 **回归基线管理**：成功用例自动生成 YAML 基线，支持精确回放
- ✅ 新增 **Smart 缓存策略**：自动检测缓存文件，动态内容禁用缓存
- ✅ 新增 **SSE 流式进度**：混合模式 step_start/step_done/step_fallback/assert_done 事件
- ✅ 新增 **文件上传动作**：拖拽模拟 (DataTransfer) + 点击上传 (fileChooserAccept) + AI 坐标定位 (aiLocate)
- ✅ 新增 **内联断言**：步骤间插入 `验证:` 断言，实时检查页面状态
- ✅ 新增 **多模型策略**：规划/定位/数据提取可分别配置不同 LLM
- ✅ 新增 **测试用例解析器** (testcaseParser.ts)：统一解析 YAML/Table/XMind/手写格式为 MidsceneTestCase[]
- ✅ 前端新增执行模式切换 UI（自由/混合/回归按钮）、实时 Timeline 面板
- ✅ 自由模式失败自动降级到混合模式（steps 存在时）

### v0.0.7 (2025-02)
- ✅ 新增 **AI 质检评估**模块：Evaluator + Critic Graph，自动发现漏测/逻辑缺陷
- ✅ 新增 **知识库管理**：文档归档、分类管理、历史用例搜索
- ✅ 新增 **文档版本管理**：版本历史、Diff 对比、回滚
- ✅ 新增 **批量文件上传**：PDF/图片/文本并发处理
- ✅ 新增 **多格式输出**：Markdown/表格/YAML/JSON 格式转换
- ✅ 新增 **异步任务队列**：长任务 SSE 流式输出、进度追踪
- ✅ 新增 **ChromaDB 向量检索**：基于语义的会话和知识库检索
- ✅ 新增 **三层缓存系统**：LLM 响应/Embedding/PDF 解析缓存
- ✅ 新增 **多模态支持**：PDF/图片直接上传，OCR 文字提取
- ✅ 新增 **Prompt 管理系统**：统一管理、动态组装、意图路由
- ✅ 新增 **可观测性**：遥测数据收集（Token/耗时/RAG）
- ✅ 前端新增 18 个组件、8 个 Composables、12 个工具函数
- ✅ 前端架构重构：Composables 状态管理、TypeScript 类型系统

### v0.0.6 (2025-01)
- ✅ 新增新无头模式 (`--headless=new`)，后台加载插件运行测试
- ✅ 优化 UI 自动化页面连接逻辑，支持 CDP 模式
- ✅ 统一 Chrome 启动脚本数据目录，有头/无头模式状态共享

### v0.0.5 (2025-01)
- ✅ Ask 接口升级：性能参数、思考预算、上下文管理
- ✅ 增强长对话管理：自动摘要机制
- ✅ 模型参数按任务类型独立配置

### v0.0.4 (2024-12)
- ✅ PM/DEV/QA 统一布局
- ✅ 提示词按模块展示
- ✅ 思维导图预览（Markmap）
- ✅ UI 自动化有头/无头模式切换

### v0.0.3 (2024-12)
- ✅ 新增测试用例智能体
- ✅ 新增 UI 自动化智能体
- ✅ URL 一键生成测试用例
- ✅ 玻璃态 UI 工作流导航

---
