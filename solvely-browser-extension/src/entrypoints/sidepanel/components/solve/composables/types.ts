/**
 * solve/ 模块类型定义
 *
 * 用于新版 v9 接口的 AnswerMessage 组件
 */

import type { QuestionType } from '~/entrypoints/sidepanel/types/question'

// ===== v9 接口相关类型 =====

/**
 * 组件数据结构（从 v9 接口解析出来的）
 */
export interface Component {
  id: string // componentId
  type: string // componentType: questions_step_style | final_answer | ...
  sortId: number // 排序 ID
  data: any // 保持原始数据结构，不做转换
}

/**
 * 解题答案状态
 */
export interface SolveAnswer {
  components: Component[]
  rawContent: string
  contentType: 'json' | 'text'
  questionType?: {
    isDifficult?: boolean
  }
  status: SolveStatus
  error?: Error
  sections: Record<
    string,
    {
      content: string
      type: 'json' | 'markdown'
    }
  > // 存储各个 contentSection 的数据
  currentSection: string // 当前活跃的 section
}

/**
 * 解题状态
 */
export type SolveStatus =
  | 'idle' // 空闲
  | 'loading' // 加载中
  | 'streaming' // 流式输出中
  | 'done' // 完成
  | 'error' // 错误

// ===== Question Info =====

/**
 * 问题信息
 */
export interface QuestionInfo {
  questionId?: string
  answerId?: string
  type: QuestionType
  value: string
  prompt?: string
  attachments?: any
  source?: string
  fileStackKey?: string
  [key: string]: any
}

/**
 * 解题选项
 */
export interface StartAnswerOptions {
  onStartOutput?: () => void
  onMessage?: (event: MessageEvent) => void
  successCallback?: () => void
  errorCallback?: () => void
  answerInfo?: any
}

// ===== 组件数据结构（v9 接口返回的具体格式） =====

/**
 * questions_step_style 组件数据
 */
export interface QuestionsStepStyleData {
  questions: Array<{
    number: string
    title?: string
    steps: Array<{
      number: string
      title: string
      overview?: string
      content: string
    }>
    answer?: string
  }>
}

/**
 * final_answer 组件数据
 */
export interface FinalAnswerData {
  questions: Array<{
    number: string
    answer: string
  }>
}

/**
 * question_single 组件数据（单选题）
 */
export interface QuestionSingleData {
  options: Array<{
    label: string
    text: string
    isCorrect: 'yes' | 'no'
  }>
  explanation?: string
}

/**
 * question_multiple 组件数据（多选题）
 */
export interface QuestionMultipleData {
  questions: Array<{
    question: string
    answer: string[]
  }>
  explanations?: Array<{
    answer: string[]
    explanation: string
  }>
}

/**
 * thinking 组件数据
 */
export interface ThinkingData {
  thinking: string // 内容字段（匹配 API）
  startTime?: number // 可选：开始时间戳（毫秒）
  duration?: number // 可选：持续时间（毫秒）
  isDone?: boolean // 可选：是否完成
  isStopped?: boolean // 🆕 可选：是否被用户停止
}

/**
 * gmat_information 组件数据
 */
export interface GmatInfoData {
  examName: string
  sourceReference: string
  targetUrl: string
}

/**
 * markdown 组件数据
 */
export interface MarkdownData {
  content: string
}

// ===== 多模型支持相关类型 =====

/**
 * 模型结果
 */
export interface ModelResult {
  modelId: string // 'gpt5' | 'claude-4.1' | 'gemini2.5'
  modelName: string // 显示名称，如 'GPT-5'
  answerId: string // 该模型的 answerId
  answer: SolveAnswer // 该模型的答案状态（components、status 等）
  requestedAt: number // 请求时间戳
  cancelRequest: (() => void) | null // 该模型的取消函数
  // 新增字段：针对每个模型的操作状态
  isLiked?: boolean // 点赞状态
  isDisliked?: boolean // 点踩状态
  isStopped?: boolean // 停止状态
}

/**
 * 模型模式配置（用于分组模型）
 */
export interface ModelMode {
  id: string // 模式 ID，如 'Auto', 'Fast', 'MultiModel'
  name: string // 显示名称，如 'Auto', 'Fast'
  description?: string // 描述信息
  icon: string // 图标名称
  iconDark?: string // 深色模式图标名称
  iconActive?: string // 激活状态图标名称
  iconActiveDark?: string // 深色模式激活状态图标名称
}

/**
 * 分组模型配置
 */
export interface GroupModelConfig {
  name: string // 显示名称，如 'Solvely AI'
  type: 'group' // 标识为分组类型
  defaultMode: string // 默认模式，如 'Auto'
  modes: ModelMode[] // 可用模式列表
  totalName?: string // 可选：完整名称
}

/**
 * 单个模型配置
 */
export interface SingleModelConfig {
  id: string // API 字段，直接作为 modelId，如 'gpt5'
  name: string // 显示名称，如 'GPT-5'
  icon: string // 图标名称，如 'models/gpt'
  iconDark?: string // 深色模式图标名称
  totalName?: string // 可选：完整名称，如 'OpenAI GPT-5'
  url?: string // 可选：图标 URL
  'url-dark'?: string // 可选：深色模式图标 URL
}

/**
 * 模型配置（从 plugin-config.json 读取）
 * 支持分组模型和单个模型两种类型
 */
export type ModelConfig = GroupModelConfig | SingleModelConfig

// ===== V2 模型配置类型（新版平铺结构） =====

/**
 * 模型项配置（V2 版本）
 */
export interface ModelItemV2 {
  id: string // 模型 ID，如 'Fast', 'MultiModel', 'GPT5Pro'
  name: string // 显示名称，如 'Fast', 'Multi-model', 'GPT-5 Pro'
  description: string // 描述信息
  icon: string // 图标名称
  iconDark?: string // 深色模式图标（可选）
  isPro?: boolean // 是否为付费模型
}

/**
 * 模型分组配置（V2 版本）
 */
export interface ModelGroupV2 {
  name: string // 分组名称，如 'Solvely AI', 'Third-Party Model'
  showGroupNameInButton?: boolean // 可选：按钮是否显示分组名称而不是模型名称
  models: ModelItemV2[] // 模型列表
}

/**
 * 模型配置容器（V2 版本）
 */
export interface ModelsConfigV2 {
  defaultModel: string // 默认模型 ID
  data: ModelGroupV2[] // 分组数据
}
