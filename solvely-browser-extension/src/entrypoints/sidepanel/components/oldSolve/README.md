# solve/ 模块

新版解题组件架构，用于 v9 接口迁移。

## 📁 目录结构

```
solve/
├── composables/              # 逻辑层
│   ├── types.ts             # 类型定义
│   ├── useSolveV9.ts        # 请求与状态管理
│   ├── useAnswerParser.ts   # 数据解析
│   ├── useAnswerFormatter.ts # 格式化工具
│   └── index.ts             # 统一导出
├── components/              # 渲染组件
│   ├── QuestionsStepStyle.vue    # 步骤式答案
│   ├── FinalAnswer.vue           # 最终答案
│   ├── QuestionSingle.vue        # 单选题
│   ├── QuestionMultiple.vue      # 多选题
│   ├── ThinkingBlock.vue         # 思考过程
│   ├── GMATBlock.vue            # GMAT 信息
│   ├── LoadingState.vue         # 加载状态
│   └── DefaultComponent.vue     # 默认组件
├── actions/                 # 操作组件
│   ├── AnswerActions.vue    # 操作按钮组
│   └── ActionButton.vue     # 单个按钮
├── AnswerMessage.vue        # 主容器
├── AnswerContent.vue        # 内容路由器
├── index.ts                 # 模块导出
└── README.md               # 本文档
```

## 🏗️ 架构设计

### 三层架构

```
┌─────────────────────────────────────┐
│     AnswerMessage.vue (主容器)       │  UI 容器 + 状态管理
│  - 管理整体状态                      │
│  - 处理生命周期                      │
│  - 提供 provide/inject               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    AnswerContent.vue (路由器)        │  内容路由
│  - 映射 componentType -> Component   │
│  - 遍历渲染 components               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   渲染组件 (QuestionsStepStyle, ...)│  数据渲染
│  - 直接消费 data                     │
│  - 最小化转换逻辑                    │
└───────────────────────────────────────┘
```

### 数据流

```
useSolveV9 (请求) 
  → useAnswerParser (解析)
    → AnswerContent (路由)
      → 渲染组件 (展示)
```

## 🧩 核心 Composables

### `useSolveV9`

**职责**：请求管理、状态管理

```typescript
const { answer, start, cancel, retry, like } = useSolveV9()

// 状态
answer.components  // Component[]
answer.status      // 'idle' | 'loading' | 'streaming' | 'done' | 'error'
answer.error       // Error | undefined

// 方法
await start(questionInfo, options)
cancel()
await retry()
await like(isLike)
```

### `useAnswerParser`

**职责**：JSON 解析、组件提取

```typescript
const { parseStreamJSON, extractComponents, isProblemMissing } = useAnswerParser()
```

### `useAnswerFormatter`

**职责**：格式化为纯文本（复制功能）

```typescript
const { formatForCopy, stripLatex } = useAnswerFormatter()
```

## 📦 组件使用

### `AnswerMessage`（主容器）

```vue
<AnswerMessage
  :message="serviceMessage"
  :show-actions="true"
  @statusChange="handleStatusChange"
  @solveDone="handleSolveDone"
  @outOfBalance="handleOutOfBalance"
/>
```

**Props**:
- `message: ServiceMessage` - 消息对象
- `showActions?: boolean` - 是否显示操作按钮

**Emits**:
- `statusChange(status)` - 状态变化
- `solveDone(data)` - 解题完成
- `outOfBalance(source)` - 余额不足
- `messageUpdate()` - 内容更新（流式输出）

**Expose**:
- `cancel()` - 取消当前请求
- `messageId` - 消息 ID

### 组件映射 (componentType → Component)

| componentType | 组件 | 说明 |
|--------------|------|------|
| `questions_step_style` | QuestionsStepStyle.vue | 步骤式答案 |
| `final_answer` | FinalAnswer.vue | 最终答案 |
| `question_single` | QuestionSingle.vue | 单选题 |
| `question_multiple` | QuestionMultiple.vue | 多选题 |
| `thinking` | ThinkingBlock.vue | 思考过程 |
| `gmat_information` | GMATBlock.vue | GMAT 信息 |
| (unknown) | DefaultComponent.vue | 兜底组件 |

## 🎯 设计原则

1. **单一职责**：每层只做自己的事
   - `useSolveV9`：请求和状态
   - `AnswerContent`：路由分发
   - 渲染组件：数据展示

2. **数据不可变**：保持 `data` 字段原始形态
   - 不做深度转换
   - 渲染组件直接消费

3. **单向数据流**：Props Down, Events Up
   - 通过 `provide/inject` 获取上层提供的能力（如取消注册），避免直接耦合 `messageStore`
   - 通过 `emit` 向上通信

4. **可扩展性**：新增组件类型
   - 在 `componentMap` 中添加映射
   - 创建对应的渲染组件
   - 定义 `types.ts` 中的数据结构

## 🔧 扩展示例

### 新增组件类型

1. **定义类型** (`types.ts`)
```typescript
export interface NewComponentData {
  // 定义数据结构
}
```

2. **创建渲染组件** (`components/NewComponent.vue`)
```vue
<template>
  <div>{{ data.xxx }}</div>
</template>

<script setup lang="ts">
import type { NewComponentData } from '../composables/types'

defineProps<{
  data: NewComponentData
  componentId?: string
}>()
</script>
```

3. **注册到 componentMap** (`AnswerContent.vue`)
```typescript
const componentMap: Record<string, any> = {
  // ...
  'new_component': NewComponent,
}
```

## 📊 性能优化

- 组件按需加载（已实现 `v-for` 动态加载）
- 流式渲染（边接收边显示）
- LaTeX 按需渲染（`LatexFormat` 组件）
- 余额管理优化（快照机制）

## 🧪 测试建议

1. 单元测试：`useSolveV9`、`useAnswerParser`、`useAnswerFormatter`
2. 组件测试：各个渲染组件的数据渲染
3. 集成测试：完整的解题流程
4. E2E 测试：用户交互（点赞、复制、ReAnswer）

## 🚀 部署说明

1. 确保 v9 接口已就绪（修改 `useSolveV9.ts` 中的 URL）
2. 在 `MessageList.vue` 中引入新组件
3. 根据 AB Test 标签切换新旧组件
4. 监控错误率和性能指标

## 📚 相关文档

- [类型定义](./composables/types.ts)
- [useSolveV9 实现](./composables/useSolveV9.ts)
- [组件映射表](./AnswerContent.vue)

---

**最后更新**: 2025-10-05
**维护者**: AI Agent
