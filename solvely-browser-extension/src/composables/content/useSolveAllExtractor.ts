import { ref, readonly, computed } from 'vue'
import { convertDOMToMarkdown, convertImageToDataURL, convertDOMToMarkdownByVisual } from '~/utils/page'
import type { ImageInfo, ConvertResult } from '~/utils/page'
import trackEvent from '~/utils/trackEvent'
import { SOLVE_ALL_EVENTS } from '@/types/events'

// === 类型定义 ===
interface SolveAllExtractRequest {
  type: typeof SOLVE_ALL_EVENTS.EXTRACT_CONTENT
  taskId: string
}

interface RenderStartMessage {
  type: typeof SOLVE_ALL_EVENTS.RENDER_START
  taskId: string
  markdown: string
  images: ImageInfo[]
}

interface ImageDataMessage {
  type: typeof SOLVE_ALL_EVENTS.IMAGE_DATA
  taskId: string
  imageUrl: string
  imageData: string
  imageIndex: number
}

interface ExtractCompleteMessage {
  type: typeof SOLVE_ALL_EVENTS.EXTRACT_COMPLETE
  taskId: string
  success: boolean
  error?: string
}

export enum ProcessingStage {
  IDLE = 'idle',
  EXTRACTING = 'extracting',
  PROCESSING_IMAGES = 'processing_images',
  COMPLETED = 'completed',
}

// === 主要组合式函数 ===
export function useSolveAllExtractor() {
  // === 状态管理 ===
  const currentTaskId = ref<string | null>(null)
  const isProcessing = ref(false)
  const processingStage = ref<ProcessingStage>(ProcessingStage.IDLE)
  const processedImageCount = ref(0)
  const totalImageCount = ref(0)
  const startTime = ref(0)

  // === 计算属性 ===
  const progress = computed(() => ({
    current: processedImageCount.value,
    total: totalImageCount.value,
    percentage:
      totalImageCount.value > 0
        ? Math.round((processedImageCount.value / totalImageCount.value) * 100)
        : 0,
  }))

  // === 页面内容抓取 ===
  const extractPageContent = async (): Promise<ConvertResult> => {
    try {
      // processingStage.value = ProcessingStage.EXTRACTING

      // 使用 page.ts 的工具函数抓取页面内容
      const result = convertDOMToMarkdown(
        document.querySelector(
          '#main, .main-content, .primary-content, .content, .article, main, article, #content'
        ) || document.body
      )

      const resultByVisual = convertDOMToMarkdownByVisual(
        document.querySelector(
          '#main, .main-content, .primary-content, .content, .article, main, article, #content'
        ) || document.body
      )

      console.log('result', result)
      console.log('resultByVisual', resultByVisual)

      // 更新状态
      // totalImageCount.value = result.images.length
      // processingStage.value =
      //   result.images.length > 0
      //     ? ProcessingStage.PROCESSING_IMAGES
      //     : ProcessingStage.COMPLETED

      return result
    } catch (error) {
      throw new Error(
        `Page content extraction failed: ${(error as Error).message}`
      )
    }
  }

  // === 消息发送服务 ===
  const sendMessages = {
    renderStart: async (
      taskId: string,
      markdown: string,
      images: ImageInfo[]
    ): Promise<void> => {
      const message: RenderStartMessage = {
        type: SOLVE_ALL_EVENTS.RENDER_START,
        taskId,
        markdown,
        images,
      }
      await browser.runtime.sendMessage(message)
    },

    imageData: async (
      taskId: string,
      imageUrl: string,
      imageData: string,
      index: number
    ): Promise<void> => {
      const message: ImageDataMessage = {
        type: SOLVE_ALL_EVENTS.IMAGE_DATA,
        taskId,
        imageUrl,
        imageData,
        imageIndex: index,
      }
      await browser.runtime.sendMessage(message)
    },

    extractComplete: async (
      taskId: string,
      success: boolean,
      error?: string
    ): Promise<void> => {
      const message: ExtractCompleteMessage = {
        type: SOLVE_ALL_EVENTS.EXTRACT_COMPLETE,
        taskId,
        success,
        error,
      }
      await browser.runtime.sendMessage(message)
    },
  }

  // === 图片处理 ===
  const processImage = async (
    taskId: string,
    image: ImageInfo,
    index: number
  ): Promise<void> => {
    const imageStartTime = performance.now()

    try {
      // 转换图片为 base64
      const base64Data = await convertImageToDataURL(
        image.url,
        { width: 720, height: 500 }, // 目标尺寸适配 offscreen 容器
        0.8 // 压缩质量
      )

      // 发送图片数据
      await sendMessages.imageData(taskId, image.url, base64Data, index)

      // 更新进度
      processedImageCount.value++

      const processingTime = performance.now() - imageStartTime
    } catch (error) {
      console.warn(`Failed to process image ${index + 1}: ${image.url}`, error)
      // 图片失败不中断流程，但仍计入进度
      processedImageCount.value++
    }
  }

  const processBatch = async (
    taskId: string,
    batch: ImageInfo[],
    startIndex: number
  ): Promise<void> => {
    const promises = batch.map((image, batchIndex) =>
      processImage(taskId, image, startIndex + batchIndex)
    )

    await Promise.allSettled(promises)
  }

  const processImagesSequentially = async (
    taskId: string,
    images: ImageInfo[]
  ): Promise<void> => {
    const BATCH_SIZE = 3
    const DELAY_BETWEEN_BATCHES = 200

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE)
      await processBatch(taskId, batch, i)

      // 批次间延迟，让垃圾回收器工作
      if (i + BATCH_SIZE < images.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        )
      }
    }
  }

  // === 错误处理 ===
  const determineErrorType = (error: Error): string => {
    if (error.message.includes('Page content extraction'))
      return 'CONTENT_EXTRACTION_FAILED'
    if (error.message.includes('convertImageToDataURL'))
      return 'IMAGE_PROCESSING_FAILED'
    if (error.message.includes('sendMessage')) return 'MESSAGE_SEND_FAILED'
    if (error.message.includes('in progress')) return 'CONCURRENT_EXTRACTION'
    return 'UNKNOWN_ERROR'
  }

  const handleExtractionError = async (
    error: Error,
    taskId: string
  ): Promise<void> => {
    console.error('Solve All extraction error:', error)

    // 确定错误类型
    const errorType = determineErrorType(error)

    // 发送错误消息
    try {
      await sendMessages.extractComplete(
        taskId,
        false,
        `${errorType}: ${error.message}`
      )
    } catch (sendError) {
      console.error('Failed to send error message:', sendError)
    }

    // 记录错误用于调试
    trackEvent.trackError('Plugin_SolveAll_extraction_error', {
      errorType,
      message: error.message,
      taskId,
    })
  }

  // === 初始化和清理 ===
  const initializeExtraction = (taskId: string): void => {
    isProcessing.value = true
    processingStage.value = ProcessingStage.EXTRACTING
    currentTaskId.value = taskId
    processedImageCount.value = 0
    totalImageCount.value = 0
    startTime.value = Date.now()
  }

  const cleanup = (): void => {
    isProcessing.value = false
    currentTaskId.value = null
    processedImageCount.value = 0
    totalImageCount.value = 0
    startTime.value = 0
    processingStage.value = ProcessingStage.IDLE
  }

  // === 主处理函数 ===
  const handleSolveAllExtraction = async (
    message: SolveAllExtractRequest,
    sendResponse: Function
  ): Promise<void> => {
    try {
      trackEvent.track('Plugin_SolveAll_extraction_start', {
        taskId: message.taskId,
        url: window.location.href,
      })

      const { markdown, images } = await extractPageContent()

      sendResponse({ success: true, markdown, images })

      const totalTime = performance.now() - startTime.value
      trackEvent.track('Plugin_SolveAll_extraction_success', {
        taskId: message.taskId,
        totalImages: images.length,
        totalTime: Math.round(totalTime),
      })
    } catch (error) {
      console.error(
        `Solve All extraction failed for task ${message.taskId}:`,
        error
      )
      await handleExtractionError(error as Error, message.taskId)
      sendResponse({ success: false, error: (error as Error).message })
    } finally {
      // 延迟清理，确保所有异步操作完成
      setTimeout(cleanup, 1000)
    }
  }

  // === 返回公共 API ===
  return {
    // 主要API
    handleSolveAllExtraction,

    // 只读状态
    isProcessing: readonly(isProcessing),
    processingStage: readonly(processingStage),
    progress: readonly(progress),
    currentTaskId: readonly(currentTaskId),
  }
}
