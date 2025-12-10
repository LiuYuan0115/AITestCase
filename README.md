# AI Test Case Plugin

> 🤖 基于 AI 的智能测试用例生成工具 - Chrome 浏览器扩展

一款智能化的 Chrome 插件，帮助测试工程师快速从需求文档生成 PRD 分析、测试点提取和测试用例。

---

## 📁 项目结构

```
PluginCode/
├── agent-server/          # 🐍 Python 后端服务 (FastAPI)
│   ├── agent_server.py    # 主服务文件
│   ├── requirements.txt   # Python 依赖
│   ├── run_agent.sh       # 启动脚本
│   └── .env              # 环境变量配置（需自行创建）
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

### 1️⃣ 配置后端服务

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
# 服务运行在 http://localhost:8765
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
VITE_API_BASE=https://your-api-base.com
VITE_AUTH_TOKEN=your_auth_token
VITE_DEVICE_ID=your_device_id
VITE_PLUGIN_UUID=your_plugin_uuid
```

### 3️⃣ 安装 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `solvely-mvp/.output/chrome-mv3` 目录

---

## ✨ 功能特性

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

### 后端接口 (localhost:8765)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/prd_agent` | POST | PRD 智能体 |
| `/api/testcase_agent` | POST | 测试用例智能体 |
| `/api/ui_agent` | POST | UI 自动化智能体 |
| `/health` | GET | 健康检查 |

### 请求示例

```bash
curl -X POST http://localhost:8765/api/prd_agent \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-123",
    "text": "需求文档内容...",
    "instruction": "分析这个需求"
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

### 调试技巧

1. **后端日志**：查看 `agent-server/agent.log`
2. **前端调试**：Chrome DevTools → 扩展 → 检查侧边栏
3. **网络请求**：DevTools Network 面板

---

## ⚠️ 注意事项

1. **环境变量**：`.env` 文件包含敏感信息，已在 `.gitignore` 中排除
2. **API 密钥**：请勿将密钥提交到代码仓库
3. **Playwright**：首次运行需执行 `playwright install chromium`

---

## 📝 更新日志

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

