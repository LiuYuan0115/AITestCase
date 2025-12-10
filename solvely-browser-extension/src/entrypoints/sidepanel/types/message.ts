import { QuestionType } from './question'

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  PDF_SIZE_TOO_LARGE = 'PDF_SIZE_TOO_LARGE',
  PDF_PAGES_TOO_MANY = 'PDF_PAGES_TOO_MANY',
  SUMMARY_NO_OPEN = 'SUMMARY_NO_OPEN',
  QUIZ_EXCEED_LIMIT = 'QUIZ_EXCEED_LIMIT',
  WORDS_TOO_FEW = 'WORDS_TOO_FEW',
  PDF_EXCEED_MAX_LIMIT = 'PDF_EXCEED_MAX_LIMIT',
  NO_FC_SUBSCRIPTION_PLAN = 'NO_FC_SUBSCRIPTION_PLAN',
}

export const ErrorMessage = {
  [ErrorType.NETWORK_ERROR]: 'Network error. Please try again.',
  [ErrorType.PDF_SIZE_TOO_LARGE]:
    'The file size exceeds 50MB. Please try another file.',
  [ErrorType.PDF_PAGES_TOO_MANY]:
    'The file exceeds 50 pages. Please try another file.',
  [ErrorType.SUMMARY_NO_OPEN]:
    "Sorry, I can't open the file directly. Please paste the text or question here, and I'll be happy to help.",
  [ErrorType.QUIZ_EXCEED_LIMIT]:
    'Upload limit reached: You can only upload 20 decks within a 24-hour period.',
  [ErrorType.WORDS_TOO_FEW]:
    'Can not generate a quiz under 20 words, please select more.',
  [ErrorType.PDF_EXCEED_MAX_LIMIT]:
    'This file exceeded the maximum limit, only part of the content can be processed.',
  [ErrorType.NO_FC_SUBSCRIPTION_PLAN]:
    "You've used up all your free credits, please upgrade to continue.",
}

export enum MessageType {
  USER = 'user',
  SERVICE = 'service',
}

export enum MessageStatus {
  PENDING = 'pending',
  RESPONDING = 'responding',
  COMPLETED = 'completed',
  ERROR = 'error',
  CACHED = 'cached',
  NO_CONTEXT = 'no_context',
  PROBLEM_MISSING = 'problem_missing',
  STOP = 'stop',
}

export enum ServiceMessageType {
  ANSWER = 'answer',
  ASK = 'ask',
  QUIZ = 'quiz',
  SUMMARY = 'summary',
  PDF_SUMMARIZE = 'pdf_summarize',
  PDF_SUMMARIZE_ASK = 'pdf_summarize_ask',
  QUOTE = 'quote',
  EXPLAIN = 'explain',
  HIGHLIGHT_CHAT = 'highlight_chat',
}

// PDF 入库信息（极简版）
export interface StorageInfo {
  isStored: boolean // 是否已入库（调用过入库接口即为 true）
  pdfUrl?: string // PDF URL（用于追问时查找）
}

export interface BaseMessage {
  id: string
  type: MessageType
  timestamp: number
}

export interface UserContent {
  type: QuestionType
  value: string
  source?: string
  prompt?: string // 新增，所有类型都可用
  fileStackKey?: string
  attachments?: {
    pdf?: {
      tabId?: number
      pdfId?: string
      title: string
      arrayBuffer: ArrayBuffer
      url: string
      error?: ErrorType
      errorMessage?: string
      size?: number
      pages?: number
    }
    page?: {
      title: string
      url: string
      content: string
    }
    selection?: {
      content?: string
      url: string
      title?: string
      totalText?: string
      from?: string
    }
    quizlet?: {
      tabId: number
      title: string
      url: string
    }
    youtube?: {
      title: string
      url: string
    }
    chatWithPdf?: {
      fileUrl: string
      fileName: string
      sessionId?: string
      file?: any
      needHideDownload?: boolean
    }
    image?: {
      imageUrl?: string
      imageName?: string
      base64?: string
      cdnUrl_quiz?: string
      cdnUrl_imageToPdf?: string
    }
    imagesSlices?: {
      longImage: string
      slices: string[]
    }
    pageScreenshot?: {
      longImage: string
      slices?: string[]  // 兼容旧版本
      tileSize?: number
      cdnUrl?: string
      cdnUrls?: string[]  // 兼容旧版本
      uploadManager?: any  // ⭐ 新增：PageScreenshotUploadManager 实例
    }
    quote?: {
      highlighted_text: string
      context: string
      user_question: string
      from: string
    }
  }
}

export interface UserMessage extends BaseMessage {
  type: MessageType.USER
  content: UserContent
}

// 预加载数据类型定义（各消息类型的后端返回数据）
export interface AnswerPreloadedData {
  components: any[]
  status: 'done'
  questionId: string
  answerId: string
  feedback?: number  // 点赞点踩状态：0=点踩，1=点赞，-1或undefined=未操作
  imageUrl?: string  // 🔧 图片 CDN URL（用于侧栏重试）
  cdnUrl?: string    // 🔧 兼容字段
}

export interface QuizPreloadedData {
  quizUrl: string
}

export interface SummaryPreloadedData {
  content: string
  feedback?: number  // 点赞点踩状态：0=点踩，1=点赞，-1或undefined=未操作
  sessionId?: string  // 🔧 会话 ID（用于侧栏重试）
}

export interface PdfSummaryPreloadedData {
  content: string
  feedback?: number  // 点赞点踩状态：0=点踩，1=点赞，-1或undefined=未操作
  pdfUrl?: string    // 🔧 PDF CDN URL（用于侧栏重试）
}

export interface QuotePreloadedData {
  content: string
  feedback?: number  // 点赞点踩状态：0=点踩，1=点赞，-1或undefined=未操作
}

export type PreloadedData = 
  | AnswerPreloadedData 
  | QuizPreloadedData 
  | SummaryPreloadedData
  | PdfSummaryPreloadedData
  | QuotePreloadedData

export interface BaseServiceMessage extends BaseMessage {
  type: MessageType.SERVICE
  serviceType: ServiceMessageType
  status: MessageStatus
  userContent: UserContent
  // 入库信息（仅 PDF 相关消息使用）
  storageInfo?: StorageInfo
  // 预加载数据（从浮层推送到侧边栏时使用，跳过 API 请求）
  preloadedData?: PreloadedData
}

export interface AnswerMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.ANSWER
}

export interface AskMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.ASK
  askContext?: {
    parentMessageId: string // 关联的父消息ID（作为sessionId）
    parentMessageType: ServiceMessageType // 父消息类型
    apiEndpoint: string // API端点路径
  }
}

export interface SummaryMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.SUMMARY
}

export interface QuizMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.QUIZ
}

export interface PdfSummarizeMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.PDF_SUMMARIZE
}

export interface PdfSummarizeAskMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.PDF_SUMMARIZE_ASK
}

export interface QuoteMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.QUOTE
}

export interface ExplainMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.EXPLAIN
}

export interface HighlightChatMessage extends BaseServiceMessage {
  serviceType: ServiceMessageType.HIGHLIGHT_CHAT
}

export type ServiceMessage =
  | AnswerMessage
  | AskMessage
  | QuizMessage
  | SummaryMessage
  | PdfSummarizeMessage
  | PdfSummarizeAskMessage
  | QuoteMessage
  | ExplainMessage
  | HighlightChatMessage

export type MessageItem = UserMessage | ServiceMessage
