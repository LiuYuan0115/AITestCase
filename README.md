# AI Test Case Plugin（本地模式）

> 🤖 基于 AI 的智能测试用例生成工具 - Chrome 浏览器扩展（仅本地服务）

一款智能化的 Chrome 插件，帮助测试工程师快速从需求文档生成 PRD 分析、测试点提取和测试用例。

---

## 📁 项目结构

```
PluginCode/
├── agent-server/          # 🐍 Python 后端服务 (FastAPI)
│   ├── agent_server.py     # 启动入口（FastAPI）
│   ├── requirements.txt    # Python 依赖
│   ├── run_agent.sh        # 启动脚本（可选）
│   ├── .env                # 环境变量配置（需自行创建）
│   └── agent_app/          # 主要后端代码
│       ├── app_factory.py  # FastAPI 路由与依赖装配
│       ├── prompts.py      # 系统提示词
│       ├── schemas.py      # 请求/响应 Schema
│       ├── session_store.py# 会话存储（本地）
│       ├── tooling.py      # 工具（Tool）Schema 定义
│       ├── graphs/         # LangGraph 图编排
│       │   └── ui_graph.py # UI 自动化图（含浏览器操作工具）
│       └── ui/             # UI 自动化辅助模块
│           ├── browser_helpers.py # 元素定位/无障碍快照等
│           └── screenshots.py     # 截图存储/读取/清理
│
├── solvely-mvp/           # 🖥️ Chrome 扩展前端 (Vue.js + WXT)
│   ├── src/              # 源代码
│   │   ├── entrypoints/  # 入口点（sidepanel, content, background）
│   │   ├── components/   # Vue 组件
│   │   ├── utils/        # 工具函数
│   │   └── api.ts        # API 调用
│   ├── package.json      # Node 依赖
│   └── .env              # 环境变量配置（需自行创建）
│
├── 方案/                   # 📋 设计文档
│   ├── 智能体方案.md       # 智能体架构设计
│   ├── 新增方案细节.md     # 功能细节说明
│   ├── 插件自动化测试.md   # 自动化测试方案
│   └── 生成示例            # 输出格式示例
│
└── README.md             # 本文件
```

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本要求 |
|------|----------|
| Node.js | >= 18.0 |
| Python | >= 3.9 |
| Chrome | >= 88 |
| Git | 已配置 |

### 1️⃣ 启动后端服务（Agent Server）

```bash
# 进入后端目录
cd agent-server

# 创建虚拟环境（首次）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器（UI 自动化需要）
playwright install chromium

# 配置环境变量
# 如果 .env 不存在，创建并填入以下内容：
cat > .env << EOF
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://zenmux.ai/api/v1
ANTHROPIC_BASE_URL=https://zenmux.ai/api/anthropic
DEFAULT_MODEL=anthropic/claude-sonnet-4
EOF

# 启动服务
python agent_server.py
# 或使用启动脚本
bash run_agent.sh
```

**服务地址**: http://localhost:8000  
**API 文档**: http://localhost:8000/docs  
**健康检查**: http://localhost:8000/health

### 2️⃣ 启动前端扩展（Chrome Extension）

```bash
# 进入前端目录
cd solvely-mvp

# 安装依赖（首次）
npm install

# 开发模式（自动构建并监听文件变化）
npm run dev

# 或生产构建
npm run build
```

**构建输出目录**: `solvely-mvp/.output/chrome-mv3`

### 3️⃣ 安装 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」（右上角开关）
3. 点击「加载已解压的扩展程序」
4. 选择目录：`solvely-mvp/.output/chrome-mv3`

---

## ✨ 功能特性

### 🧩 统一角色体验（PM / DEV / QA）

- **统一布局**：PM、DEV、QA 均使用同一套布局（左侧聊天 + 底部固定输入区 + 右侧文档预览区）。
- **统一输入区**：所有角色/步骤都固定显示：输入框、`🔗 链接`、`📸 提取当前页`、`📎 参考`、`💡 提示`。
- **右侧文档预览**：
  - PM/DEV：链接/页面提取的内容会进入右侧「文档列表」并可编辑/预览。
  - QA：PRD/优化 PRD/测试点/测试用例/UI 计划与报告在右侧统一管理。
- **编辑/预览切换**：右侧预览区使用单一切换按钮（一个按钮在"编辑/预览"之间切换）。

### 🔄 需求 Workflow

```
1.分析 → 2.PRD → 3.测试点 → 4.用例 → 5.测试
```

| 步骤 | 功能 | 输出 |
|------|------|------|
| **分析** | 全页截图 + DOM 提取 | 页面内容入库 |
| **PRD** | AI 分析需求文档 | PRD 文档（Markdown） |
| **测试点** | 提取测试要点 | 思维导图 |
| **用例** | 生成测试用例 | 思维导图 |
| **测试** | UI 自动化测试 | 测试报告 |

### 💡 提示词（按当前模块可选）

点击输入区的 **`💡 提示`**，会展示**当前模块可用提示词**，点击即可自动填入输入框：

- **PM**：需求分析 / 风险识别 / 文档优化
- **DEV**：技术分析 / 工时估算 / 接口设计
- **QA**：按步骤展示
  - 分析（内容分析 / 深度分析）
  - 优化（PRD 评审 / 优化建议）
  - 测试点（测试点分析 / 测试点优化）
  - 测试用例（用例评审 / 用例补充）
  - 测试（自动化）（页面分析 / 测试计划 / 操作指令）

### 🤖 智能体模块

- **PRD 智能体**：分析需求文档，支持对话式修改
- **测试用例智能体**：生成/修改测试用例，思维导图可视化
- **UI 自动化智能体**：自然语言驱动的浏览器自动化

### 📸 URL 一键生成

在任意步骤输入 URL：
```
请输出 https://example.com/requirement.html 的测试用例
```
插件会自动：提取页面内容 → 上传截图 → 调用 AI → 渲染思维导图

### 🧠 思维导图（MindMap / Markmap）

- **测试点**与**测试用例**默认使用思维导图预览（`Markmap`），支持：
  - 点击节点选中高亮
  - `Cmd/Ctrl + C` 复制选中节点
  - "复制全部"一键复制整棵树（包含富文本与纯文本）

---

## 🛠️ 技术栈

### 后端 (agent-server)
- **FastAPI** - Web 框架
- **OpenAI API** - LLM 调用（GPT-4o / Claude）
- **Playwright** - 浏览器自动化
- **LangGraph** - 智能体编排
- **Python 3.9+**

### 前端 (solvely-mvp)
- **Vue 3** - UI 框架（Composition API）
- **WXT** - Chrome 扩展开发框架
- **TypeScript** - 类型安全
- **Markmap** - 思维导图渲染
- **Marked** - Markdown 解析

---

## 📡 API 接口

### 后端接口 (localhost:8000)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/prd` | POST | PRD 智能体（LangGraph） |
| `/api/testcase` | POST | 测试用例智能体（LangGraph） |
| `/api/ui_agent` | POST | UI 自动化智能体（LangGraph） |
| `/api/chat` | POST | PM/DEV 纯聊天（LangGraph） |
| `/api/ask` | POST | 本地 Ask（生成 PRD/测试点/用例等） |
| `/api/ui_agent/screenshots` | GET/DELETE | UI 自动化截图列表/清空 |
| `/api/ask/config` | GET | Ask 接口配置概览 |
| `/health` | GET | 健康检查 |

### 请求示例

#### 1. PRD 智能体
```bash
curl -X POST http://localhost:8000/api/prd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-123",
    "params": { "text": "需求文档内容..." },
    "instruction": "分析这个需求"
  }'
```

#### 2. Ask 接口（testcase 类型）
```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "type": "testcase",
    "params": {
      "text": "用户登录功能需求：\n1. 用户可以通过邮箱和密码登录\n2. 密码长度8-16位\n3. 登录失败3次后锁定账户"
    },
    "instruction": "请生成测试用例"
  }'
```

#### 3. Ask 接口（带辅助PRD）
```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-456",
    "type": "testcase",
    "params": {
      "text": "优化后的PRD内容..."
    },
    "instruction": "请生成测试用例",
    "additionalPrds": [
      {
        "title": "[测试点]登录模块测试点",
        "content": "测试点内容..."
      }
    ]
  }'
```

#### 4. UI 自动化（有头/无头模式）
```bash
curl -X POST http://localhost:8000/api/ui_agent \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "ui-session-123",
    "instruction": "点击登录按钮",
    "params": {
      "url": "https://example.com",
      "plan": "",
      "report": "",
      "headless": false
    }
  }'
```

---

## 🔧 开发调试

### 后端调试

#### 开启详细日志
```bash
# 设置环境变量
export ASK_DEBUG=1
export ASK_USE_LLM_SUMMARY=1

# 启动服务
python agent_server.py
```

#### 查看日志
- 控制台输出（如果设置了 `ASK_DEBUG=1`）
- 检查是否有错误信息

#### 性能监控
```bash
# 查看接口响应时间
time curl -X POST http://localhost:8000/api/ask ...
```

### 前端调试

#### Chrome DevTools
1. 打开扩展侧边栏
2. 右键点击侧边栏 → 「检查」
3. 在 DevTools 中查看：
   - Console：JavaScript 错误
   - Network：API 请求
   - Application：Local Storage

#### 热重载
```bash
# 开发模式会自动监听文件变化
npm run dev
```

#### 查看构建输出
```bash
# 查看构建后的文件
ls -la solvely-mvp/.output/chrome-mv3/
```

### 目录说明

**前端核心目录：**
```
solvely-mvp/src/
├── entrypoints/
│   ├── sidepanel/        # 侧边栏 UI（主界面）
│   │   ├── App.vue       # 主组件
│   │   ├── index.html    # Entrypoint
│   │   └── main.ts       # 入口文件
│   ├── content.ts        # 内容脚本（页面注入）
│   └── background.ts     # 后台脚本
├── components/
│   └── MindMapPreview.vue # 思维导图组件
├── utils/
│   ├── page.ts           # 页面内容提取
│   └── imageProcessor.ts # 图片处理
└── api.ts                # API 调用封装
```

**后端核心目录：**
```
agent-server/agent_app/
├── app_factory.py         # FastAPI 路由装配（/api/ui_agent 等）
├── graphs/
│   ├── ask_graph.py       # Ask 接口图
│   ├── prd_graph.py       # PRD 智能体图
│   ├── testcase_graph.py  # 测试用例智能体图
│   ├── chat_graph.py      # 聊天智能体图
│   └── ui_graph.py        # UI 自动化执行图
└── ui/
    ├── browser_helpers.py # 元素定位与页面快照
    └── screenshots.py     # UI 自动化截图管理
```

---

## ⚙️ 环境变量配置

### 后端 (.env)

```env
# API 密钥（必需）
OPENAI_API_KEY=your_api_key_here

# API 端点（可选，有默认值）
OPENAI_BASE_URL=https://zenmux.ai/api/v1
ANTHROPIC_BASE_URL=https://zenmux.ai/api/anthropic

# 默认模型（可选）
DEFAULT_MODEL=anthropic/claude-sonnet-4

# 各接口模型配置（可选）
MODEL_PRD=anthropic/claude-sonnet-4
MODEL_TESTCASE=anthropic/claude-sonnet-4
MODEL_UI=anthropic/claude-sonnet-4
MODEL_CHAT=anthropic/claude-sonnet-4
MODEL_ASK=anthropic/claude-sonnet-4

# Ask 接口性能优化开关
ASK_DEBUG=0                    # 1=开启详细日志（会变慢）
ASK_USE_LLM_SUMMARY=0          # 1=历史超长时用LLM摘要（会多一次调用）
ASK_ENABLE_REPAIR=1            # 1=允许testprd修复（默认开启）

# Ask 接口各类型配置（可选）
ASK_TESTCASE_MAX_TOKENS=20000
ASK_TESTCASE_THINKING_BUDGET=2000
ASK_TESTCASE_TEMPERATURE=0
```

### 前端 (.env)

```env
# 本地 Agent 服务地址（可选，默认 http://localhost:8000）
VITE_LOCAL_AGENT_URL=http://localhost:8000
```

---

## 🐛 常见问题

### 1. 后端启动失败

**问题**: `ModuleNotFoundError: No module named 'xxx'`  
**解决**: 
```bash
pip install -r requirements.txt
```

**问题**: `ValueError: OPENAI_API_KEY is not set`  
**解决**: 创建 `.env` 文件并填入 `OPENAI_API_KEY`

**问题**: `[Errno 48] address already in use`  
**解决**: 
```bash
# 查找并停止占用 8000 端口的进程
lsof -ti:8000 | xargs kill
```

### 2. 前端构建失败

**问题**: `Cannot find module 'xxx'`  
**解决**: 
```bash
npm install
```

**问题**: Sidepanel 加载失败  
**解决**: 
```bash
# 确保 sidepanel entrypoint 存在
ls solvely-mvp/src/entrypoints/sidepanel/
# 如果不存在，检查 entrypoint 配置
```

### 3. 扩展加载失败

**问题**: "无法加载清单" 或 "Side panel file path must exist"  
**解决**: 
1. 确保已运行 `npm run build`
2. 检查 `.output/chrome-mv3/manifest.json` 是否存在
3. 检查 `sidepanel.html` 是否存在

### 4. API 调用超时

**问题**: 接口响应很慢（2-3分钟）  
**解决**: 
1. 检查 `thinking_budget` 是否设置过高（建议设为 0 或 2000）
2. 检查 `max_tokens` 是否设置过大（建议 10000-20000）
3. 检查输入内容是否过长（已优化为自动截断）
4. 设置 `ASK_USE_LLM_SUMMARY=0` 关闭历史摘要（默认已关闭）

### 5. UI 自动化无法连接

**问题**: "Chrome 调试端口未开启"  
**解决**: 
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome_dev_test"

# 或使用脚本
bash agent-server/run_chrome.sh
```

说明：
- 有头模式会连接到 `localhost:9222` 的 Chrome 实例并在真实页面上执行点击/输入等操作
- 若未开启调试端口，UI 自动化会无法连接浏览器（请先启动上述命令）

---

## 📊 性能优化建议

### 1. 降低响应时间

在 `.env` 中设置：
```env
# 关闭思考预算（最快）
ASK_TESTCASE_THINKING_BUDGET=0
ASK_TESTPOINT_THINKING_BUDGET=0
ASK_TESTPRD_THINKING_BUDGET=0

# 降低输出长度
ASK_TESTCASE_MAX_TOKENS=10000
ASK_TESTPOINT_MAX_TOKENS=10000
ASK_TESTPRD_MAX_TOKENS=10000
```

### 2. 关闭调试日志

```env
ASK_DEBUG=0  # 默认已关闭
```

### 3. 关闭历史摘要

```env
ASK_USE_LLM_SUMMARY=0  # 默认已关闭
```

---

## 🔄 开发工作流

### 1. 修改后端代码
```bash
cd agent-server
# 修改代码后，重启服务
python agent_server.py
```

### 2. 修改前端代码
```bash
cd solvely-mvp
# 开发模式会自动重载
npm run dev
# 在 Chrome 中刷新扩展
```

### 3. 测试完整流程
1. 启动后端服务
2. 启动前端开发模式
3. 在 Chrome 中加载扩展
4. 测试各个功能模块

---

## 📝 提交代码

```bash
# 检查变更
git status

# 添加文件
git add <文件>

# 提交
git commit -m "feat: 描述变更"

# 推送
git push origin develop
```

---

## ⚠️ 注意事项

1. **环境变量**：`.env` 文件包含敏感信息，已在 `.gitignore` 中排除
2. **API 密钥**：请勿将密钥提交到代码仓库
3. **Playwright**：首次运行需执行 `playwright install chromium`
4. **UI 自动化（有头模式）**：需要 Chrome 以调试模式启动（CDP）

---

## 📝 更新日志

### v0.0.4 (2025-12)
- ✅ PM/DEV/QA 统一布局（含右侧文档预览区）
- ✅ 提示词按钮按当前模块展示可用提示词（PM/DEV/QA 分步骤）
- ✅ 测试点/测试用例默认使用 MindMap（Markmap）预览与复制
- ✅ "优化/生成用例"支持参考确认弹窗（可跳过）
- ✅ UI 自动化支持"有头/无头"模式切换并透传 `params.headless`
- ✅ Ask 接口性能优化（降低响应时间）

### v0.0.3 (2024-12)
- ✅ 新增测试用例智能体
- ✅ 新增 UI 自动化智能体
- ✅ 支持 URL 一键生成测试用例
- ✅ 优化飞书文档内容提取
- ✅ 玻璃态 UI 工作流导航

---

## 👥 贡献者

- QA Team

## 📄 License

Private - Internal Use Only
