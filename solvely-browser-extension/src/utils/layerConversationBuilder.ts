/**
 * 浮层对话数据构建工具
 * 负责将浮层数据转换为侧边栏兼容的消息格式
 */

import { 
  MessageType,
  ServiceMessageType,
  MessageStatus
} from '@/entrypoints/sidepanel/types/message'
import type { 
  UserMessage, 
  BaseServiceMessage, 
  PreloadedData,
  UserContent
} from '@/entrypoints/sidepanel/types/message'
import { QuestionType } from '@/entrypoints/sidepanel/types/question'

// ============================================
// 🎨 常量定义
// ============================================

export const LAYER_TYPE_MAP = [
  {
    type: 'Solve',
    icon: 'textSelection/select-solve',
  },
  {
    type: 'Explain',
    icon: 'textSelection/select-explain',
  },
  {
    type: 'Summarize',
    icon: 'textSelection/select-summarize',
  },
  {
    type: 'Quiz',
    icon: 'textSelection/select-quiz',
  },
  {
    type: 'Chat',
    icon: 'textSelection/select-chat',
  },
] as const

// ============================================
// 🏗️ 类型定义
// ============================================

export interface LayerData {
  userInput?: string
  selectionText?: string
  fullText?: string
  base64?: string
  pageUrl?: string
  uploadPromise?: any
}

/**
 * 浮层消息对象（构建时使用）
 */
export interface LayerMessage {
  id: string
  type: 'service'
  serviceType: string
  status: 'pending'
  timestamp: number
  userContent: UserContent
}

/**
 * 对话数据（推送到侧边栏）
 */
export interface ConversationData {
  userMessage: UserMessage
  serviceMessage: BaseServiceMessage
}

// ============================================
// 🏗️ UserContent 构建器（按功能分组）
// ============================================

// --- Solve 构建器 ---
const buildScreenshotSolve = (data: LayerData) => ({
  type: QuestionType.PHOTO,
  value: data.base64 || '',
  prompt: data.userInput || '',
  attachments: {
    image: {
      base64: data.base64 || '',
      imageName: 'Screenshot.webp',
    }
  }
})

const buildSelectionSolve = (data: LayerData) => ({
  type: QuestionType.TEXT_SOLVE,
  value: data.selectionText || '',
  prompt: data.userInput || '',
  attachments: {
    selection: {
      content: data.selectionText || '',
      totalText: data.fullText || '',
      url: data.pageUrl || '',
      from: 'layer'
    }
  }
})

// --- Chat 构建器 ---
const buildScreenshotChat = (data: LayerData) => ({
  type: QuestionType.PHOTO,
  value: data.base64 || '',
  prompt: data.userInput || '',
  attachments: {
    image: {
      base64: data.base64 || '',
      imageName: 'Screenshot.webp',
    }
  }
})

const buildSelectionChat = (data: LayerData) => ({
  type: QuestionType.HIGHLIGHT_CHAT,
  value: '',
  prompt: data.userInput || '',
  attachments: {
    quote: {
      highlighted_text: data.selectionText || '',
      user_question: data.userInput || '',
      context: data.fullText || '',
      from: 'page'
    }
  }
})

// --- Summarize 构建器 ---
const buildScreenshotSummarize = (data: LayerData) => ({
  type: QuestionType.PDF_SUMMARIZE,
  value: '',
  prompt: data.userInput,
  attachments: {
    image: {
      base64: data.base64 || '',
    }
  }
})

const buildSelectionSummarize = (data: LayerData) => ({
  type: QuestionType.SUMMARY,
  value: JSON.stringify({
    content: data.selectionText || data.fullText || '',
    pageUrl: data.pageUrl || '',
    instructions: data.userInput || ''
  }),
  prompt: data.userInput,
  attachments: data.selectionText ? {
    selection: {
      content: data.selectionText,
      url: data.pageUrl || '',
      from: 'layer'
    }
  } : undefined
})

// --- Quiz 构建器 ---
const buildScreenshotQuiz = (data: LayerData) => ({
  type: QuestionType.QUIZ,
  value: '',
  attachments: {
    image: {
      base64: data.base64,
      imageName: 'Screenshot.webp',
    }
  }
})

const buildSelectionQuiz = (data: LayerData) => ({
  type: QuestionType.QUIZ,
  value: '',
  attachments: {
    selection: {
      content: data.selectionText || '',
      url: data.pageUrl || '',
      title: 'Selection Quiz',
      from: 'layer'
    }
  }
})

// --- 其他构建器 ---
const buildExplain = (data: LayerData) => ({
  type: QuestionType.EXPLAIN,
  value: data.selectionText || '',
  attachments: {
    selection: {
      content: data.selectionText || '',
      url: data.pageUrl || '',
      totalText: data.fullText || '',
      from: 'page'
    }
  }
})

const buildQuote = (data: LayerData) => ({
  type: QuestionType.QUOTE,
  value: '',
  attachments: {
    quote: {
      highlighted_text: data.selectionText || '',
      user_question: data.userInput || '',
      context: data.fullText || '',
      from: 'page'
    }
  }
})

// ============================================
// 🎯 核心构建函数
// ============================================

/**
 * 根据 layerType 和数据类型获取 ServiceMessageType 和构建器
 */
function getServiceTypeAndBuilder(layerType: string, hasScreenshot: boolean) {
  // 🔵 Solve：解题（V9）
  if (layerType === 'Solve') {
    return {
      serviceType: 'answer',
      builder: hasScreenshot ? buildScreenshotSolve : buildSelectionSolve
    }
  }
  
  // 🔵 Chat：对话
  if (layerType === 'Chat') {
    return {
      serviceType: hasScreenshot ? 'answer' : 'highlight_chat',
      builder: hasScreenshot ? buildScreenshotChat : buildSelectionChat
    }
  }
  
  // 🟢 Summarize：总结
  if (layerType === 'Summarize') {
    return {
      serviceType: hasScreenshot ? 'pdf_summarize' : 'summary',
      builder: hasScreenshot ? buildScreenshotSummarize : buildSelectionSummarize
    }
  }
  
  // 🟡 Quiz：测验
  if (layerType === 'Quiz') {
    return {
      serviceType: 'quiz',
      builder: hasScreenshot ? buildScreenshotQuiz : buildSelectionQuiz
    }
  }
  
  // 🟣 Explain：解释
  if (layerType === 'Explain') {
    return {
      serviceType: 'explain',
      builder: buildExplain
    }
  }
  
  // ⚪ 默认：Quote
  return {
    serviceType: 'quote',
    builder: buildQuote
  }
}

/**
 * 构建浮层消息对象
 * @param layerType - 浮层类型
 * @param layerData - 浮层数据
 * @param messageId - 消息 ID
 * @returns 完整的 message 对象
 */
export function buildLayerMessage(
  layerType: string,
  layerData: LayerData,
  messageId: string
): LayerMessage {
  const hasScreenshot = !!layerData.base64
  const { serviceType, builder } = getServiceTypeAndBuilder(layerType, hasScreenshot)
  
  return {
    id: messageId,
    type: 'service',
    serviceType,
    status: 'pending',
    timestamp: Date.now(),
    userContent: builder(layerData)
  }
}

/**
 * 构建完整的对话数据（基于已构建的 message）
 * @param existingMessage - 已构建好的 message 对象（来自 layerServiceMessage.vue）
 * @param apiResponse - 后端返回的数据
 * @returns ConversationData 对象（包含完整的 userMessage 和 serviceMessage）
 */
export function buildConversationData(
  existingMessage: LayerMessage,
  apiResponse: Partial<PreloadedData>
): ConversationData {
  // 🔧 直接使用已构建好的 message，避免重复构建
  const { id, serviceType, userContent, timestamp } = existingMessage
  
  // 🔧 使用浮层原始的 timestamp，而不是重新生成
  // 这样可以保持浮层和侧边栏的时间一致性
  const userMessageId = crypto.randomUUID()
  
  // 🔧 处理 userContent：更新 URL、移除 base64
  let updatedUserContent = userContent
  
  // 如果有 imageUrl（截图 Chat/Solve），移除 base64 数据（避免请求体过大）
  if ('imageUrl' in apiResponse && apiResponse.imageUrl && userContent.attachments?.image) {
    updatedUserContent = {
      ...userContent,
      value: apiResponse.imageUrl,  // 🔧 更新 value 为 CDN URL
      attachments: {
        ...userContent.attachments,
        image: {
          ...userContent.attachments.image,
          base64: undefined,  // 🔧 移除 base64
          imageUrl: apiResponse.imageUrl,  // 🔧 使用 CDN URL
        }
      }
    }
  }
  
  // 如果有 pdfUrl（PDF Summary），更新 userContent
  if ('pdfUrl' in apiResponse && apiResponse.pdfUrl && updatedUserContent.attachments?.image) {
    updatedUserContent = {
      ...updatedUserContent,
      attachments: {
        ...updatedUserContent.attachments,
        image: {
          ...updatedUserContent.attachments.image,
          cdnUrl_imageToPdf: apiResponse.pdfUrl as string,
        }
      }
    }
  }
  
  // 构建用户消息
  const userMessage: UserMessage = {
    id: userMessageId,
    type: MessageType.USER,
    timestamp,
    content: updatedUserContent
  }
  
  // 构建服务消息（包含 preloadedData）
  const serviceMessage: BaseServiceMessage = {
    id,
    type: MessageType.SERVICE,
    serviceType: serviceType as ServiceMessageType,
    status: MessageStatus.COMPLETED,
    timestamp,
    userContent: updatedUserContent,
    preloadedData: {
      ...apiResponse,
      status: 'done',  // ✅ PreloadedData 使用 'done'
    } as PreloadedData
  }
  
  return {
    userMessage,
    serviceMessage
  }
}

