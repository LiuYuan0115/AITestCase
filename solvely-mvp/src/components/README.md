# 组件集成指南

本文档说明如何将新组件集成到 App.vue 中。

## 组件列表

| 组件 | 功能 | 引入方式 |
|------|------|----------|
| RoleSelector | 角色切换（PM/DEV/QA）| 替换顶部角色菜单 |
| WorkflowProgress | QA 工作流进度条 | 添加到主体区域底部 |
| ChatMessage | 聊天消息渲染 | 替换 v-for 消息渲染 |
| DocumentPanel | 文档管理面板 | 替换右侧文档列表 |
| KnowledgeBasePanel | 知识库面板 | 新增 Tab |
| BatchUploader | 批量上传 | 替换提取弹窗 |
| TaskProgressBar | 任务进度 | AI 处理时显示 |
| DocumentCard | 文档卡片 | DocumentPanel 子组件 |

---

## 1. 基础导入

在 `App.vue` 的 `<script setup>` 中添加：

```typescript
// 导入 Composables
import {
  useSession,
  useRole,
  useWorkflow,
  useChat,
  useDocuments,
  useTaskProgress
} from '@/composables';

// 导入组件
import RoleSelector from '@/components/RoleSelector.vue';
import WorkflowProgress from '@/components/WorkflowProgress.vue';
import ChatMessage from '@/components/ChatMessage.vue';
import DocumentPanel from '@/components/DocumentPanel.vue';
import KnowledgeBasePanel from '@/components/KnowledgeBasePanel.vue';
import BatchUploader from '@/components/BatchUploader.vue';
import TaskProgressBar from '@/components/TaskProgressBar.vue';

// 使用 Composables
const { sessionId, initSession, getSessionId } = useSession();
const { currentRole, switchRole } = useRole();
const { currentStep, nextStep, prevStep } = useWorkflow();
const { messages, isLoading, sendMessage } = useChat();
const { documents, uploadDocument, selectedDocuments } = useDocuments();
const { taskState, startTracking, isRunning } = useTaskProgress();
```

---

## 2. 替换角色选择器

### 原代码（App.vue 第 3-25 行）：
```html
<div v-if="!userRole" class="role-select-container">
  <div class="role-select-box">
    <h1>请选择你的角色</h1>
    ...
  </div>
</div>
```

### 新代码：
```html
<div v-if="!currentRole" class="role-select-container">
  <div class="role-select-box">
    <h1 class="role-select-title">请选择你的角色</h1>
    <p class="role-select-desc">选择后会自动进入聊天区域</p>
    <RoleSelector @change="handleRoleChange" />
  </div>
</div>
```

---

## 3. 替换顶部角色菜单

### 原代码（App.vue 第 32-71 行）：
```html
<div class="role-area" @click.stop>
  <button class="role-avatar-btn" @click="toggleRoleMenu">
    ...
  </button>
  <div v-if="isRoleMenuOpen" class="role-menu">
    ...
  </div>
</div>
```

### 新代码：
```html
<div class="role-area">
  <RoleSelector @change="handleRoleChange" class="compact" />
</div>
```

---

## 4. 添加工作流进度条

### 在主体区域底部添加（仅 QA 角色显示）：
```html
<!-- 主体区域 -->
<div class="unified-body">
  <div class="left-panel">
    <!-- 聊天区域 -->
  </div>
  <div class="right-panel">
    <!-- 文档面板 -->
  </div>
</div>

<!-- QA 工作流进度条 -->
<WorkflowProgress
  v-if="currentRole === 'qa'"
  :task-progress="taskState.progress"
  :task-label="statusText"
  :is-processing="isLoading"
  @step-click="handleStepClick"
/>
```

---

## 5. 替换聊天消息渲染

### 原代码（App.vue 第 80-96 行）：
```html
<div v-for="(msg, idx) in messages" :key="idx" :class="['msg', msg.role]">
  <div class="msg-content" v-html="renderMarkdown(msg.content)"></div>
  ...
</div>
```

### 新代码：
```html
<div class="chat-container" ref="chatContainer">
  <ChatMessage
    v-for="msg in messages"
    :key="msg.id"
    :message="msg"
    @retry="handleRetry(msg)"
    @attachment-click="handleAttachmentClick"
    @ref-click="handleRefClick"
  />

  <!-- 加载状态 -->
  <TaskProgressBar
    v-if="isLoading"
    :status="taskState.status"
    :progress="taskState.progress"
    :label="statusText"
  />
</div>
```

---

## 6. 替换右侧文档面板

### 原代码（App.vue 第 355-463 行）：
```html
<div class="doc-list-sidebar" v-if="showDocList">
  ...
</div>
```

### 新代码 - 添加 Tab 切换：
```html
<div class="right-panel" :style="{ flex: rightPanelFlex }">
  <!-- Tab 栏 -->
  <div class="right-panel-tabs">
    <button
      class="panel-tab"
      :class="{ active: rightTab === 'docs' }"
      @click="rightTab = 'docs'"
    >
      文档
    </button>
    <button
      class="panel-tab"
      :class="{ active: rightTab === 'history' }"
      @click="rightTab = 'history'"
    >
      历史
    </button>
    <button
      class="panel-tab"
      :class="{ active: rightTab === 'knowledge' }"
      @click="rightTab = 'knowledge'"
    >
      知识库
    </button>
  </div>

  <!-- Tab 内容 -->
  <div class="right-panel-content">
    <DocumentPanel
      v-if="rightTab === 'docs'"
      :session-id="sessionId"
      @upload="showUploader = true"
      @doc-click="handleDocClick"
      @doc-edit="handleDocEdit"
    />

    <KnowledgeBasePanel
      v-else-if="rightTab === 'knowledge'"
      :session-id="sessionId"
      @upload="showUploader = true"
      @select="handleKnowledgeSelect"
    />

    <!-- 历史 Tab 保持原有逻辑 -->
    <div v-else-if="rightTab === 'history'">
      <!-- 原有历史记录代码 -->
    </div>
  </div>
</div>

<!-- 批量上传弹窗 -->
<BatchUploader
  ref="uploaderRef"
  @close="showUploader = false"
  @uploaded="handleUploaded"
/>
```

---

## 7. 状态迁移映射

| 原有状态 | 新 Composable | 说明 |
|----------|---------------|------|
| `userRole` | `currentRole` | 从 useRole 获取 |
| `projectState.assets.sessionId` | `sessionId` | 从 useSession 获取 |
| `projectState.currentStep` | `currentStep` | 从 useWorkflow 获取 |
| `messages` | `messages` | 从 useChat 获取 |
| `isProcessing` | `isLoading` | 从 useChat 获取 |

---

## 8. 事件处理示例

```typescript
// 角色切换
function handleRoleChange(role: UserRole) {
  // 原有逻辑：清理状态、切换视图等
}

// 步骤点击
function handleStepClick(stepIndex: number) {
  goToStep(stepIndex);
}

// 消息重试
function handleRetry(msg: ChatMessage) {
  retryLastMessage();
}

// 文档上传完成
function handleUploaded(docIds: string[]) {
  showUploader = false;
  // 刷新文档列表
  loadSessionDocuments();
}

// 知识库选择
function handleKnowledgeSelect(docs: KnowledgeDoc[]) {
  // 将选中的知识库文档添加到上下文
}
```

---

## 迁移建议

1. **渐进式迁移**：先集成 RoleSelector 和 WorkflowProgress，验证无问题后再继续
2. **保持兼容**：新组件与原有逻辑并行运行，逐步替换
3. **测试验证**：每集成一个组件后运行测试，确保功能正常
4. **样式统一**：新组件使用相同的设计变量（如 `#5D6AB4` 主色）

---

## 样式变量

组件使用以下设计变量：

```css
:root {
  --primary-color: #5D6AB4;
  --primary-hover: #4a5591;
  --success-color: #16a34a;
  --error-color: #dc2626;
  --border-color: #e5e7eb;
  --bg-secondary: #f9fafb;
  --text-primary: #374151;
  --text-secondary: #6b7280;
}
```
