# AITestCase 插件本地测试使用指南

## 概述

AITestCase 是一款基于 AI 的智能测试用例生成 Chrome 浏览器扩展。本文档介绍如何在本地环境搭建、启动和测试该插件。

本地运行需要启动 **三个服务**：

| 服务 | 技术栈 | 端口 | 职责 |
|------|--------|------|------|
| Agent Server | Python FastAPI | 8000 | AI 对话、测试用例生成、文档管理、质检评估 |
| Midscene Sidecar | Node.js Express | 3100 | UI 自动化执行（浏览器控制、步骤执行、回归基线） |
| Chrome Extension | Vue 3 + WXT | — | Chrome 侧边栏 UI（前端插件界面） |

---

## 环境要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18.0 | 前端构建 + Midscene Sidecar |
| Python | >= 3.9 | 后端 Agent Server 运行环境 |
| Chrome | >= 112 | 扩展宿主浏览器（新无头模式需要 112+） |
| Git | 已安装 | 版本管理 |
| poppler（可选） | — | PDF 转图片功能所需：`brew install poppler` |

---

## 第一步：启动 Agent Server（Python 后端）

### 1.1 创建虚拟环境并安装依赖

```bash
cd AITestCase/agent-server

# 创建虚拟环境（首次）
python3 -m venv venv
source venv/bin/activate

# 安装 Python 依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器（旧版 UI Agent 需要，可选）
playwright install chromium
```

### 1.2 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，**必须填写**以下核心配置：

```env
# API 配置（必填）
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://zenmux.ai/api/v1
ANTHROPIC_BASE_URL=https://zenmux.ai/api/anthropic

# 模型配置（可按需修改）
DEFAULT_MODEL=anthropic/claude-haiku-4.5

# 功能开关
USE_CHROMADB=true
USE_QA_SKILL=true
```

> **提示**：如果没有 API Key，请联系团队获取。所有 AI 功能（PRD 分析、测试用例生成、质检评估）都依赖 LLM 调用。

### 1.3 启动服务

**方式一：直接启动**

```bash
python agent_server.py
```

**方式二：使用启动脚本**（会自动检查 Chrome 调试端口和依赖）

```bash
bash run_agent.sh
```

> **注意**：`run_agent.sh` 会检查 Chrome 调试端口 9222 是否开启。如果只使用 AI 生成功能（不使用 UI 自动化），可以直接用 `python agent_server.py` 启动。

### 1.4 验证服务

- 服务地址：http://localhost:8000
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

```bash
curl http://localhost:8000/health
# 期望返回：{"status": "ok", ...}
```

---

## 第二步：启动 Midscene Sidecar（UI 自动化引擎）

> **提示**：如果你暂时不需要 UI 自动化测试功能（第 5 步「测试」），可以跳过此步骤。插件的 AI 生成功能（PRD/测试点/测试用例）不依赖 Midscene。

### 2.1 安装依赖

```bash
cd AITestCase/agent-server/midscene-sidecar

# 安装 Node 依赖
npm install
```

### 2.2 配置环境变量

编辑 `midscene-sidecar/.env` 文件，核心配置：

```env
# Midscene SDK 模型配置（必填）
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
MIDSCENE_MODEL_NAME=gemini-3-flash-preview

# 国内环境可能需要代理
MIDSCENE_OPENAI_HTTP_PROXY=http://127.0.0.1:1087

# 服务端口
PORT=3100
```

### 2.3 启动服务

**开发模式**（热重载，推荐本地调试）：

```bash
npm run dev
```

**生产模式**：

```bash
npm start
```

### 2.4 验证服务

```bash
curl http://localhost:3100/health
```

---

## 第三步：构建并安装 Chrome 扩展

### 3.1 安装依赖

```bash
cd AITestCase/solvely-mvp

npm install
```

### 3.2 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 确保指向本地服务：

```env
# 使用本地模式
VITE_USE_REMOTE=false

# 指向本地 Agent Server
VITE_LOCAL_AGENT_URL=http://localhost:8000
```

### 3.3 构建扩展

**开发模式**（热重载，修改代码自动刷新）：

```bash
npm run dev
```

**生产构建**：

```bash
npm run build
```

构建产物输出到 `.output/chrome-mv3/` 目录。

### 3.4 安装到 Chrome

1. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
2. 开启右上角的 **「开发者模式」** 开关
3. 点击 **「加载已解压的扩展程序」**
4. 选择目录：`AITestCase/solvely-mvp/.output/chrome-mv3`

> **安装成功**后，Chrome 工具栏会出现 AITestCase 插件图标。点击图标即可打开侧边栏。

> **注意**：使用 `npm run dev` 开发模式时，WXT 会自动热重载扩展。但某些改动（如 `background.ts`）可能需要在 `chrome://extensions/` 页面手动点击刷新按钮。

---

## 第四步：使用插件功能

### 4.1 打开插件

1. 在 Chrome 中打开你要测试的网页
2. 点击工具栏的 AITestCase 图标，打开侧边栏
3. 选择角色：**PM** / **DEV** / **QA**

### 4.2 QA 工作流（核心功能）

选择 **QA 角色** 后，按五步工作流操作：

```
1.分析 → 2.PRD → 3.测试点 → 4.用例 → 5.测试
```

| 步骤 | 操作 | 输出 |
|------|------|------|
| 1. 分析 | 点击「📸 提取当前页」提取页面内容 | 页面 DOM 内容 + 截图入库 |
| 2. PRD | 输入需求或点击提示词，AI 分析生成 | 优化后的 PRD 文档（Markdown） |
| 3. 测试点 | 基于 PRD 自动提取测试要点 | 测试点思维导图 |
| 4. 用例 | 基于测试点生成测试用例 | 测试用例（思维导图/表格/YAML） |
| 5. 测试 | 选择执行模式运行 UI 自动化测试 | 测试报告 |

### 4.3 快速测试：URL 一键生成

在输入框直接输入 URL，插件会自动提取页面内容并生成测试用例：

```
请输出 https://example.com/requirement.html 的测试用例
```

### 4.4 PM / DEV 角色

- **PM 角色**：需求分析、风险识别、文档优化
- **DEV 角色**：技术分析、工时估算、接口设计

---

## 第五步：UI 自动化测试（可选）

> **注意**：UI 自动化测试需要额外启动 Chrome 调试浏览器和 Midscene Sidecar 服务。

### 5.1 启动 Chrome 调试浏览器

先关闭所有 Chrome 窗口，然后：

**有头模式**（可视化调试，能看到浏览器界面）：

```bash
cd AITestCase/agent-server
./run_chrome.sh
```

**无头模式**（后台运行，推荐日常使用）：

```bash
cd AITestCase/agent-server
./run_chrome_headless.sh
```

> **提示**：有头/无头模式共享数据目录 `/tmp/chrome_dev_test`，首次建议用有头模式登录需要的网站账号，之后切换到无头模式复用登录状态。

### 5.2 推荐工作流

**首次准备：**

1. 运行 `./run_chrome.sh` 启动有头 Chrome
2. 在浏览器中安装需要的插件
3. 登录测试所需的网站账号
4. 配置完成后关闭 Chrome（Cmd+Q）

**日常使用：**

1. `lsof -t -i:9222 | xargs kill -9`（确保端口释放）
2. `./run_chrome_headless.sh`（后台启动）
3. `npm run dev`（启动 Midscene Sidecar）
4. 在日常 Chrome 中使用插件，UI 测试在无头 Chrome 中执行

### 5.3 三种执行模式

| 模式 | 执行方式 | AI 开销 | 适用场景 |
|------|----------|---------|----------|
| 自由模式 | 整个 scenario 丢给 AI 一次性规划执行 | 高 | 复杂端到端流程 |
| 混合模式 | 逐步执行，每步三层降级（instant → aiAct → deepThink） | 中 | 标准结构化用例 |
| 回归模式 | 回放保存的 YAML 基线 | 零 | 回归测试 |

---

## 完整启动命令汇总

按以下顺序在 **四个终端** 中分别启动服务：

```bash
# ===== 终端 1：Agent Server =====
cd AITestCase/agent-server
source venv/bin/activate
python agent_server.py

# ===== 终端 2：Midscene Sidecar（可选，UI 自动化需要） =====
cd AITestCase/agent-server/midscene-sidecar
npm run dev

# ===== 终端 3：Chrome 扩展开发 =====
cd AITestCase/solvely-mvp
npm run dev

# ===== 终端 4：Chrome 调试浏览器（可选，UI 自动化需要） =====
cd AITestCase/agent-server
./run_chrome_headless.sh
```

---

## 验证清单

- [ ] Agent Server 健康检查通过：`curl http://localhost:8000/health`
- [ ] Midscene Sidecar 健康检查通过：`curl http://localhost:3100/health`
- [ ] Chrome 扩展已加载（`chrome://extensions/` 中可见）
- [ ] 打开任意网页，能看到侧边栏插件界面
- [ ] 选择 QA 角色，发送消息能收到 AI 响应

---

## 常见问题排查

### 后端问题

| 问题 | 解决方案 |
|------|----------|
| `ModuleNotFoundError` | 确认已激活虚拟环境：`source venv/bin/activate`，重新安装：`pip install -r requirements.txt` |
| `OPENAI_API_KEY is not set` | 创建 `.env` 文件并填入有效的 API Key |
| `address already in use :8000` | `lsof -ti:8000 \| xargs kill` 杀掉占用端口的进程 |
| ChromaDB SSL 错误 | 检查网络环境，或设置 `HF_ENDPOINT=https://hf-mirror.com` |
| PDF 转图片失败 | 安装 poppler：`brew install poppler` |

### 前端问题

| 问题 | 解决方案 |
|------|----------|
| `Cannot find module` | 重新安装依赖：`npm install` |
| 侧边栏空白或加载失败 | 确认 `.output/chrome-mv3/sidepanel.html` 存在，在 `chrome://extensions/` 刷新扩展 |
| API 调用超时 | 检查 Agent Server 是否已启动，确认 `.env` 中 `VITE_USE_REMOTE=false` |
| 扩展更新后不生效 | `chrome://extensions/` 页面点击扩展的刷新按钮 |

### UI 自动化问题

| 问题 | 解决方案 |
|------|----------|
| Chrome 调试端口未开启 | 运行 `./run_chrome.sh` 或 `./run_chrome_headless.sh` |
| 端口 9222 被占用 | `lsof -t -i:9222 \| xargs kill -9` |
| 端口 3100 被占用 | `lsof -ti:3100 \| xargs kill` |
| Midscene SDK 报错 | 检查 `midscene-sidecar/.env` 中的 API Key 和 Base URL |
| 国内网络访问 Gemini API 失败 | 配置 HTTP 代理：`MIDSCENE_OPENAI_HTTP_PROXY=http://127.0.0.1:1087` |

---

## 开发调试技巧

### 后端调试

```bash
# 开启详细日志
ASK_DEBUG=1 python agent_server.py

# 查看缓存状态
curl http://localhost:8000/api/cache/stats

# 查看遥测数据
curl http://localhost:8000/api/telemetry/stats

# 测试 Ask 接口
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "type": "testcase",
    "params": {"text": "用户登录功能"},
    "instruction": "请生成测试用例"
  }'
```

### 前端调试

```bash
# 开发模式（热重载）
cd solvely-mvp && npm run dev

# 在 Chrome 中右键点击扩展侧边栏 → 「检查」 → 打开 DevTools
```

### Midscene Sidecar 调试

```bash
# 开发模式（热重载 + 详细日志）
cd agent-server/midscene-sidecar && npm run dev

# 校验测试用例步骤质量
curl -X POST http://localhost:3100/validate-testcase \
  -H "Content-Type: application/json" \
  -d '{"testcase":{"steps":["点击登录按钮"]}, "mode":"mixed"}'

# 查看 Midscene 报告（HTML）
open midscene_run/report/
```

---

## 项目架构概览

```
┌──────────────────────────────────────────────────────────┐
│                Chrome Extension (Vue 3 + WXT)            │
│                    侧边栏 UI 主界面                        │
└──────────────┬──────────────────────┬────────────────────┘
               │ HTTP/SSE             │ HTTP/SSE
               ▼                      ▼
┌──────────────────────┐  ┌───────────────────────────────┐
│   Agent Server       │  │   Midscene Sidecar            │
│   Python FastAPI     │  │   Node.js Express             │
│   :8000              │  │   :3100                       │
│                      │  │                               │
│  • AI 对话           │  │  • 自由模式 (aiAct)            │
│  • PRD/测试点/用例    │  │  • 混合模式 (三层降级)         │
│  • 文档管理          │  │  • 回归模式 (YAML 回放)        │
│  • AI 质检评估       │  │  • 步骤推断引擎                │
│  • 知识库/历史       │  │  • 回归基线管理                │
└──────────┬───────────┘  └──────────────┬────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐  ┌───────────────────────────────┐
│   LLM API            │  │   Chrome 调试浏览器            │
│   Claude / GPT       │  │   Puppeteer CDP :9222         │
└──────────────────────┘  └───────────────────────────────┘
```
