# AI Test Case — Chrome Extension Frontend

> Vue 3 + WXT Chrome 浏览器扩展，提供 QA 工作流 UI、AI 对话、文档管理和 UI 自动化测试面板。

## 技术栈

| 技术 | 用途 |
|------|------|
| Vue 3 (Composition API) | UI 框架 |
| WXT | Chrome 扩展开发框架 |
| TypeScript | 类型安全 |
| Markmap | 思维导图渲染 |
| Marked | Markdown 解析 |
| D3.js | 数据可视化 |
| Lucide | 图标库 |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# 打包 zip
npm run zip
```

### 安装到 Chrome

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `.output/chrome-mv3` 目录

## 项目结构

```
src/
├── entrypoints/                # 扩展入口点
│   ├── sidepanel/              # 侧边栏主界面
│   │   ├── App.vue             # 主组件（QA 工作流 + UI 自动化）
│   │   ├── index.html
│   │   └── main.ts
│   ├── content.ts              # 内容脚本（页面 DOM 提取）
│   └── background.ts           # 后台脚本（消息路由）
│
├── api.ts                      # API 调用封装（Agent Server + Midscene Sidecar）
│
├── components/                 # Vue 组件
│   ├── ChatInput.vue           # 聊天输入框
│   ├── ChatMessage.vue         # 消息渲染（流式/Markdown）
│   ├── InputToolbar.vue        # 输入工具栏
│   ├── RoleSelector.vue        # 角色选择器 (PM/DEV/QA)
│   ├── WorkflowProgress.vue    # QA 工作流进度条
│   ├── MindMapPreview.vue      # 思维导图预览
│   ├── FormatPreview.vue       # 多格式预览/导出
│   ├── DocumentPanel.vue       # 文档管理面板
│   ├── DocumentCard.vue        # 文档卡片
│   ├── DocVersionList.vue      # 版本历史列表
│   ├── DocDiffViewer.vue       # 文档版本对比
│   ├── FilePreview.vue         # 文件预览
│   ├── BatchUploader.vue       # 批量文件上传
│   ├── KnowledgeBasePanel.vue  # 知识库管理
│   ├── HistoryPanel.vue        # 历史记录面板
│   ├── QualityReportPanel.vue  # 质量评估报告
│   ├── TaskProgressBar.vue     # 任务进度条
│   ├── TestCaseFormatSelector.vue  # 格式选择器（XMind/Table/YAML）
│   └── DebugDrawer.vue         # 调试面板
│
├── composables/                # 组合式函数（状态管理）
│   ├── useChat.ts              # 聊天消息管理
│   ├── useDocuments.ts         # 文档 CRUD/版本管理
│   ├── useFileUpload.ts        # 文件上传/进度
│   ├── useRole.ts              # 角色切换
│   ├── useSession.ts           # 会话管理
│   ├── useTask.ts              # 异步任务管理
│   ├── useTaskProgress.ts      # 任务进度（SSE/轮询）
│   └── useWorkflow.ts          # 工作流步骤管理
│
├── utils/                      # 工具函数
│   ├── testcaseParser.ts       # 测试用例解析器（YAML/Table/XMind → MidsceneTestCase）
│   ├── formatConverter.ts      # 格式转换（MD → Table/YAML）
│   ├── askApi.ts               # Ask API 封装
│   ├── agentUrl.ts             # Agent 服务地址管理
│   ├── page.ts                 # 页面内容提取
│   ├── imageExtractor.ts       # 图片提取/上传
│   └── retry.ts                # 自动重试（指数退避）
│
└── types/                      # TypeScript 类型定义
    └── chat.ts
```

## 核心架构

### QA 五步工作流

```
1.分析 → 2.PRD → 3.测试点 → 4.用例 → 5.UI测试
```

| 步骤 | 功能 | API 端点 | 输出 |
|------|------|---------|------|
| 分析 | 全页截图 + DOM 提取 | Content Script | 页面内容 |
| PRD | AI 分析需求文档 | `/api/ask` (type=testprd) | PRD Markdown |
| 测试点 | 提取测试要点 | `/api/ask` (type=testpoint) | 思维导图 |
| 用例 | 生成测试用例 | `/api/ask` (type=testcase) | XMind/Table/YAML |
| UI测试 | UI 自动化测试 | Midscene Sidecar | 测试报告 |

### UI 自动化执行模式

在 Step 5 中，用户可选择三种执行模式：

| 模式 | 说明 | API 端点 |
|------|------|---------|
| 自由模式 | 整个用例一次性丢给 AI 规划执行 | `/run-testcase/stream` |
| 混合模式 | 逐步执行，每步三层降级（instant → aiAct → deepThink） | `/run-instant/stream` |
| 回归模式 | 回放保存的 YAML 基线 | `/run-yaml` |

### 测试用例解析管道

```
AI 生成原始文本 (YAML/Table/XMind Markdown)
    ↓
testcaseParser.ts → parseTestCases()
    ↓
MidsceneTestCase[] = {
    id, name, scenario, steps[], expectedResults[], preconditions, priority
}
    ↓
scenario → 自由模式 (agent.aiAct)
steps[] → 混合模式 (step-inference → instant/aiAct)
```

## 环境变量

```env
# 切换远程/本地模式
VITE_USE_REMOTE=false

# 本地 Agent 服务地址
VITE_LOCAL_AGENT_URL=http://localhost:8000

# 远程服务（VITE_USE_REMOTE=true 时生效）
VITE_REMOTE_AGENT_URL=https://your-remote-api.com
VITE_REMOTE_API_KEY=your_api_key_here
```

## 开发调试

```bash
# 开发模式
npm run dev

# 在 Chrome 中右键点击扩展侧边栏 → 「检查」打开 DevTools

# 类型检查
npm run compile
```

## 构建产物

```
.output/chrome-mv3/
├── manifest.json
├── sidepanel.html        # 侧边栏主界面
├── content-scripts/      # 页面注入脚本
├── background.js         # 后台 Service Worker
└── icons/
```
