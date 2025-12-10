<template>
  <div class="flex flex-col gap-[24px]">
    <!-- 加载状态 -->
    <div
      v-if="status === MessageStatus.PENDING"
      class="flex flex-row items-center justify-start gap-[8px] text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200 text-[14px] leading-[150%]"
    >
      <Vue3Lottie
        :animation-data="isDark ? loadingAnimationDark : loadingAnimation"
        :width="20"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{ margin: 0 }"
      />
      Uploading
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-[#F30A34]">
        {{ errorMessage || ErrorMessage[errorType as ErrorType] }}
      </div>
      <div
        v-if="errorType === ErrorType.NETWORK_ERROR"
        class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk transition-colors duration-200 cursor-pointer"
        @click="handleRetry"
      >
        <SvgIcon
          name="try-again"
          size="20"
        />
        <span>Try again</span>
      </div>
    </div>

    <!-- 缓存状态 -->
    <div
      class="text-[14px] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      v-else-if="status === MessageStatus.CACHED && quizUrl"
    >
      You have generated deck for this page,
      <a
        href="https://solvely.ai/quiz/home"
        target="_blank"
        @click="console.log('handleLinkClick')"
        class="text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200"
      >
        go to Solvely.ai to study instantly >>
      </a>
    </div>

    <!-- 成功状态 -->
    <div
      class="text-[14px] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      v-else-if="status === MessageStatus.COMPLETED && quizUrl"
    >
      Upload Successfully!
      <a
        :href="quizUrl"
        target="_blank"
        @click="console.log('handleLinkClick')"
        class="text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200"
      >
        Go to Solvely.ai to study instantly >>
      </a>
    </div>

    <!-- Stop状态 -->
    <div
      v-else-if="status === MessageStatus.STOP"
      class="text-[14px] leading-[140%] text-[#989B9E]"
    >
      You stopped this response
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ErrorMessage, ErrorType, MessageStatus, QuizMessage } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import useMessages from '../composables/useMessages'
import defaultCache from '../utils/cache'
import { Vue3Lottie } from 'vue3-lottie'
import { convertMultipleImagesToPdf } from '~/utils/imageToPdf'
import SvgIcon from '@/components/common/SvgIcon.vue'

import { getFlashcardsUploadUrl } from '@/api'
import globalUpload from '../composables/useGlobalUpload'
import { useDarkMode } from '@/composables/useDarkMode'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'

const { isDark } = useDarkMode()

// const { downloadAndCheckPdf, processUploadPDF } = useUploadStaging()

const props = defineProps<{
  message: QuizMessage
  showActions?: boolean
  messageStore: ReturnType<typeof useMessages>
}>()

const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'messageUpdate'): void
}>()

// 组件状态
const status = ref<MessageStatus>(MessageStatus.PENDING)
const errorType = ref<ErrorType | null>(null)
const errorMessage = ref<string>('')
const quizUrl = ref<string>('')
const isStopped = ref<boolean>(false)
// const cdnUrl = ref<string>('')

// 取消控制器
let abortController: AbortController | null = null

// 构建quiz链接
function buildQuizUrl(fileUrl: string, fileName?: string): string {
  const encodedUrl = encodeURIComponent(fileUrl)
  return `${import.meta.env.VITE_SOLVELY_URL}/quiz/home?pdfUrl=${encodedUrl}&pdfName=${fileName || 'document.pdf'}`
}

// 简单哈希函数
function simpleHash(str: string): string {
  if (!str) return ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

// 处理状态变化
function handleDone(
  currentStatus: MessageStatus,
  error?: ErrorType,
  message?: string
) {
  // 🔒 最高优先级：如果已经是 STOP 状态，不允许被覆盖（除非是重试）
  if (isStopped.value && currentStatus !== MessageStatus.PENDING) {
    console.log('[ChatWithPDFMessage] 已停止，忽略状态更新:', currentStatus)
    return
  }
  
  if (error) {
    errorType.value = error
    errorMessage.value = message || ''
  }
  status.value = currentStatus
  emit('statusChange', currentStatus)
  emit('messageUpdate')
}

const handleRetry = () => {
  status.value = MessageStatus.PENDING
  quizUrl.value = ''
  isStopped.value = false // 重置停止状态
  emit('statusChange', MessageStatus.PENDING)
  // 重新开始整个流程
  newProcess()

  // 重新注册取消处理器，确保暂停功能正常工作
  registerCancelHandler()
}

const waitForQuizCdnUrl = async (fileStackKey: string) => {
  return new Promise<string>((resolve, reject) => {
    // 设置超时时间（30秒）
    const timeout = setTimeout(() => {
      stop()
      reject(new Error('Waiting for quiz cdnUrl timeout'))
    }, 30000)

    const stop = watch(
      () => globalUpload.fileStack.value[fileStackKey]?.cdnUrl_To_Quiz,
      (val) => {
        if (val) {
          clearTimeout(timeout)
          stop()
          resolve(val)
        }
      }
    )

    // 检查是否已经被取消
    if (abortController?.signal.aborted) {
      clearTimeout(timeout)
      stop()
      reject(new Error('Operation cancelled'))
      return
    }

    // 监听取消信号
    abortController?.signal.addEventListener('abort', () => {
      clearTimeout(timeout)
      stop()
      reject(new Error('Operation cancelled'))
    })
  })
}

const uploadQuizPDF = async (pdfFile: File): Promise<string> => {
  const res = await getFlashcardsUploadUrl({
    files: [
      {
        fileName: pdfFile.name,
        fileType: 'pdf',
      },
    ],
  })
  const uploadInfo = res?.data?.urls?.[0]
  if (!uploadInfo?.uploadUrl || !uploadInfo?.fileUrl) {
    throw new Error('Failed to get presigned url for quiz upload')
  }
  const putResp = await fetch(uploadInfo.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'application/pdf' },
    body: pdfFile,
    signal: abortController?.signal,
  })
  if (!putResp.ok) {
    throw new Error('Failed to upload quiz PDF to presigned url')
  }
  return uploadInfo.fileUrl as string
}

const newProcess = async () => {
  // 检查是否已被停止
  if (isStopped.value) {
    return
  }

  // 创建新的AbortController
  abortController = new AbortController()

  const pageScreenshot = props.message.userContent.attachments?.pageScreenshot
  if (pageScreenshot) {
    try {
      let pdfFile: File

      // ⭐ 检查是否有 uploadManager（流式截图）
      const uploadManager = pageScreenshot.uploadManager
      if (uploadManager) {
        const sliceCount = uploadManager.progress.value.total

        console.log(`📸 [ChatWithPDFMessage] Quiz 使用流式截图，共 ${sliceCount} 个切片`)

        // ⭐ 从 uploadManager 获取所有切片的 base64 数据
        const sliceDataCache = uploadManager.getSliceDataCache()

        if (!sliceDataCache || sliceDataCache.length === 0) {
          throw new Error('No slice data available in uploadManager')
        }

        console.log(`📄 [ChatWithPDFMessage] 使用 ${sliceDataCache.length} 个切片生成多页 PDF for Quiz`)

        const result = await convertMultipleImagesToPdf(sliceDataCache, 'page-screenshot.pdf', {
          pageSize: pageScreenshot.tileSize,
          maxPageCount: 20,
        })
        pdfFile = result.pdfFile
      } else {
        // 原有逻辑：使用 slices 数组
        console.log('📄 [ChatWithPDFMessage] 使用 slices 数组生成 PDF for Quiz')
        if (!pageScreenshot.slices || pageScreenshot.slices.length === 0) {
          throw new Error('No image slices available for PDF conversion')
        }
        const result = await convertMultipleImagesToPdf(pageScreenshot.slices, 'page-screenshot.pdf', {
          pageSize: pageScreenshot.tileSize,
          maxPageCount: 20,
        })
        pdfFile = result.pdfFile
      }

      const cdnUrlQuiz = await uploadQuizPDF(pdfFile)
      quizUrl.value = buildQuizUrl(cdnUrlQuiz)

      status.value = MessageStatus.COMPLETED
      emit('statusChange', MessageStatus.COMPLETED)
    } catch (error) {
      // 检查是否是取消错误
      if (error instanceof Error && error.name === 'AbortError') {
        // 如果是用户主动取消，不显示错误
        if (status.value === MessageStatus.STOP || isStopped.value) {
          return
        }
      }
      console.error('❌ [ChatWithPDFMessage] Quiz PDF 生成失败:', error)
      handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR, 'Network error. Please try again.')
    }
    return
  }

  const chatWithPdf = props.message.userContent.attachments?.chatWithPdf
  if (!chatWithPdf) {
    console.error('No chatWithPdf attachment found')
    return
  }

  let cdnUrlQuiz = chatWithPdf?.fileUrl || ''
  const fileStackKey = props.message.userContent.fileStackKey
  if (!cdnUrlQuiz && fileStackKey) {
    // 再次检查是否已被停止
    if (isStopped.value) {
      return
    }

    // 等待 fileStack 里 quiz cdnUrl
    try {
      cdnUrlQuiz = await waitForQuizCdnUrl(fileStackKey)
    } catch (error) {
      // 检查是否是取消错误
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Operation cancelled')) {
        // 如果是用户主动取消，不显示错误
        if (status.value === MessageStatus.STOP || isStopped.value) {
          return
        }
      }
      console.error('Waiting for quiz cdnUrl failed:', error)
      handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR, 'Network error. Please try again.')
      return
    }
  }

  if (!cdnUrlQuiz) {
    console.error('No cdnUrl_quiz available')
    return
  }

  const cacheKey = simpleHash(cdnUrlQuiz)
  const cachedQuizUrl = defaultCache.get(cacheKey)
  if (cachedQuizUrl && typeof cachedQuizUrl === 'string') {
    quizUrl.value = cachedQuizUrl
    status.value = MessageStatus.CACHED
    emit('statusChange', MessageStatus.COMPLETED)
    return
  }

  quizUrl.value = buildQuizUrl(cdnUrlQuiz, chatWithPdf?.fileName)
  defaultCache.set(cacheKey, quizUrl.value)
  status.value = MessageStatus.COMPLETED
  emit('statusChange', MessageStatus.COMPLETED)
}

// 注册取消句柄
const registerCancelHandler = () => {
  const cancel = async () => {
    try {
      // 设置停止状态
      isStopped.value = true

      if (abortController) {
        abortController.abort()
      }
      
      // 更新状态为停止
      status.value = MessageStatus.STOP
      emit('statusChange', MessageStatus.STOP)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('ChatWithPDFMessage cancel error:', error)
      }
      throw error
    }
  }
  props.messageStore.registerCancelable(props.message.id, cancel)
}

// 监听消息状态变化
watch(
  () => props.message.status,
  (next) => {
    status.value = next
    if (next === MessageStatus.STOP) {
      // 当状态变为STOP时，取消当前请求
      if (abortController) {
        abortController.abort()
      }
    }
  }
)

// 组件挂载时开始处理
onMounted(async () => {
  emit('statusChange', MessageStatus.PENDING)
  registerCancelHandler()
  // 开始处理
  await newProcess()
  trackEvent.track('Plugin_sidebar_QuizPDFMessage_mounted')
})

// 组件卸载时清理
onUnmounted(() => {
  if (abortController) {
    abortController.abort()
  }
  props.messageStore.unregisterCancelable(props.message.id)
})
</script>
