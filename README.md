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

### 1️⃣ 配置后端服务（本地）

```bash
# 进入后端目录
cd agent-server

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器（UI 自动化需要）
playwright install chromium

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 API 密钥
```

**.env 配置示例：**
```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://your-api-endpoint.com/v1
```

**启动服务：**
```bash
python agent_server.py
# 服务运行在 http://localhost:8000
```

### 2️⃣ 配置前端扩展

```bash
# 进入前端目录
cd solvely-mvp

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入配置

# 开发模式
npm run dev

# 生产构建
npm run build
```

**.env 配置示例：**
```env
# 仅本地服务地址（不配置则默认 http://localhost:8000）
VITE_LOCAL_AGENT_URL=http://localhost:8000
```

### 3️⃣ 安装 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `solvely-mvp/.output/chrome-mv3` 目录

---

## ✨ 功能特性

### 🧩 统一角色体验（PM / DEV / QA）

- **统一布局**：PM、DEV、QA 均使用同一套布局（左侧聊天 + 底部固定输入区 + 右侧文档预览区）。
- **统一输入区**：所有角色/步骤都固定显示：输入框、`🔗 链接`、`📸 提取当前页`、`📎 参考`、`💡 提示`。
- **右侧文档预览**：
  - PM/DEV：链接/页面提取的内容会进入右侧「文档列表」并可编辑/预览。
  - QA：PRD/优化 PRD/测试点/测试用例/UI 计划与报告在右侧统一管理。
- **编辑/预览切换**：右侧预览区使用单一切换按钮（一个按钮在“编辑/预览”之间切换）。

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
  - “复制全部”一键复制整棵树（包含富文本与纯文本）

---

## 🛠️ 技术栈

### 后端 (agent-server)
- **FastAPI** - Web 框架
- **OpenAI API** - LLM 调用（GPT-4o）
- **Playwright** - 浏览器自动化
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
| `/health` | GET | 健康检查 |

### 请求示例

```bash
curl -X POST http://localhost:8000/api/prd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-123",
    "params": { "text": "需求文档内容..." },
    "instruction": "分析这个需求"
  }'
```

### UI 自动化接口补充（有头/无头）

前端会在 UI 自动化步骤提供 **“🖥️ 有头 / 👻 无头”** 模式切换，并通过 `params.headless` 透传到后端：

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

## 🔧 开发指南

### 目录说明

```
solvely-mvp/src/
├── entrypoints/
│   ├── sidepanel/        # 侧边栏 UI（主界面）
│   │   └── App.vue       # 主组件
│   ├── content.ts        # 内容脚本（页面注入）
│   └── background.ts     # 后台脚本
├── components/
│   └── MindMapPreview.vue # 思维导图组件
├── utils/
│   ├── page.ts           # 页面内容提取
│   └── imageProcessor.ts # 图片处理
└── api.ts                # API 调用封装
```

后端核心目录：

```
agent-server/agent_app/
├── app_factory.py         # FastAPI 路由装配（/api/ui_agent 等）
├── graphs/
│   └── ui_graph.py        # LangGraph：UI 自动化执行图
└── ui/
    ├── browser_helpers.py # 元素定位与页面快照
    └── screenshots.py     # UI 自动化截图管理
```

### 调试技巧

1. **后端日志**：查看 `agent-server/agent.log`
2. **前端调试**：Chrome DevTools → 扩展 → 检查侧边栏
3. **网络请求**：DevTools Network 面板

---

## ⚠️ 注意事项

1. **环境变量**：`.env` 文件包含敏感信息，已在 `.gitignore` 中排除
2. **API 密钥**：请勿将密钥提交到代码仓库
3. **Playwright**：首次运行需执行 `playwright install chromium`
4. **UI 自动化（有头模式）**：需要 Chrome 以调试模式启动（CDP）

**macOS：**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

说明：
- 有头模式会连接到 `localhost:9222` 的 Chrome 实例并在真实页面上执行点击/输入等操作
- 若未开启调试端口，UI 自动化会无法连接浏览器（请先启动上述命令）

---

## 📝 更新日志

### v0.0.3 (2024-12)
- ✅ 新增测试用例智能体
- ✅ 新增 UI 自动化智能体
- ✅ 支持 URL 一键生成测试用例
- ✅ 优化飞书文档内容提取
- ✅ 玻璃态 UI 工作流导航

### v0.0.4 (2025-12)
- ✅ PM/DEV/QA 统一布局（含右侧文档预览区）
- ✅ 提示词按钮按当前模块展示可用提示词（PM/DEV/QA 分步骤）
- ✅ 测试点/测试用例默认使用 MindMap（Markmap）预览与复制
- ✅ “优化/生成用例”支持参考确认弹窗（可跳过）
- ✅ UI 自动化支持“有头/无头”模式切换并透传 `params.headless`

---

## 👥 贡献者

- QA Team

## 📄 License

Private - Internal Use Only

