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
