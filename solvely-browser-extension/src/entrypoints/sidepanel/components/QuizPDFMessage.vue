<template>
  <div class="flex flex-col gap-[24px]">
    <!-- 加载状态 -->
    <div
      v-if="status === MessageStatus.PENDING"
      class="pb-[20px] flex flex-row items-center justify-start gap-2"
    >
      <Vue3Lottie
        :animation-data="isDark ? loadingAnimationDark : loadingAnimation"
        :width="20"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{ margin: 0 }"
      />

      <div class="text-primary text-sm font-normal leading-tight">
        Uploading
      </div>
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-s-function-erro dark:text-s-function-erro-dark transition-colors duration-200">
        {{ errorMessage || ErrorMessage[errorType as ErrorType] }}
      </div>
      <div
        v-if="errorType === ErrorType.NETWORK_ERROR"
        class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk cursor-pointer"
        @click="handleRetry"
      >
        <SvgIcon name="try-again" size="20" />
        <span>Try again</span>
      </div>
    </div>

    <!-- 缓存状态 -->
    <div
      class="text-[14px] leading-[150%] text-[#111]"
      v-else-if="status === MessageStatus.CACHED && quizUrl"
    >
      You have generated deck for this page,
      <a
        href="https://solvely.ai/quiz/home"
        target="_blank"
        @click="handleLinkClick"
        class="text-[#007AFF]"
      >
        go to Solvely.ai to study instantly >>
      </a>
    </div>

    <!-- 成功状态 -->
    <div
      class="text-[14px] leading-[150%] text-[#111]"
      v-else-if="status === MessageStatus.COMPLETED && quizUrl"
    >
      Upload Successfully!
      <a
        :href="quizUrl"
        target="_blank"
        @click="handleLinkClick"
        class="text-[#007AFF]"
      >
        Go to Solvely.ai to study instantly >>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PDFDocument } from 'pdf-lib'
import {
  ErrorMessage,
  ErrorType,
  MessageStatus,
  QuizMessage,
} from '../types/message'
import trackEvent from '~/utils/trackEvent'
import useMessages from '../composables/useMessages'
import SidepanelEventType from '../types/eventTypes'
import { getTrpc } from '~/lib/trpc/client'
import defaultCache from '../utils/cache'
import { pointError } from '~/entrypoints/background/service/point'
import { getConfigValue } from '~/utils/config'
import { Vue3Lottie } from 'vue3-lottie'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import { getFlashcardsUploadUrl } from '~/api'

const { isDark } = useDarkMode()

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
const pdfBlob = ref<Blob | null>(null)
const pdfTitle = ref<string | null>(null)
const pdfArrayBuffer = ref<ArrayBuffer | null>(null)

// PDF限制配置
let maxSize = 10 * 1024 * 1024 // 10MB
let maxPages = 20

// 构建quiz链接
function buildQuizUrl(fileUrl: string, fileName?: string): string {
  const encodedUrl = encodeURIComponent(fileUrl)
  return `${
    import.meta.env.VITE_SOLVELY_URL
  }/quiz/home?pdfUrl=${encodedUrl}&pdfName=${fileName || 'document.pdf'}`
}

// 检查缓存并设置状态
function checkCacheAndSetStatus(): boolean {
  const url = props.message.userContent.attachments?.pdf?.url
  if (!url) {
    return false
  }

  const cachedFileUrl = defaultCache.get(url)

  if (cachedFileUrl && typeof cachedFileUrl === 'string') {
    quizUrl.value = buildQuizUrl(
      cachedFileUrl,
      props.message.userContent.attachments?.pdf?.title
    )
    status.value = MessageStatus.CACHED
    emit('statusChange', MessageStatus.COMPLETED)

    // 发送成功事件
    browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_QUIZ_SUCCESS,
      data: {
        pdfId: props.message.userContent.attachments?.pdf?.pdfId,
      },
    })

    return true
  }

  return false
}

// 下载并检查PDF
async function downloadAndCheckPdf(): Promise<boolean> {
  try {
    const url = props.message.userContent.attachments?.pdf?.url
    if (!url) {
      throw new Error('No PDF URL provided')
    }

    trackEvent.track('Plugin_sidebar_QuizPDFMessage_download_start', { url })

    let size = 0
    let blob: Blob | null = null

    // 先尝试HEAD请求获取文件大小
    const headResp = await fetch(url, { method: 'HEAD' })
    const contentLength = headResp.headers.get('Content-Length')

    trackEvent.track('Plugin_sidebar_QuizPDFMessage_download_HEAD', {
      contentLength,
      url,
    })

    if (contentLength) {
      size = parseInt(contentLength, 10)
      if (isNaN(size) || size > maxSize) {
        errorType.value = ErrorType.PDF_SIZE_TOO_LARGE
        errorMessage.value = `The file size exceeds ${Math.round(
          maxSize / 1024 / 1024
        )}MB. Please try another file.`
        trackEvent.track('Plugin_sidebar_QuizPDFMessage_error', {
          errorType: 'PDF_SIZE_TOO_LARGE',
          size,
        })
        return false
      }
      const resp = await fetch(url)
      blob = await resp.blob()
    } else {
      const resp = await fetch(url)
      blob = await resp.blob()
      size = blob.size
      if (size > maxSize) {
        errorType.value = ErrorType.PDF_SIZE_TOO_LARGE
        errorMessage.value = `The file size exceeds ${Math.round(
          maxSize / 1024 / 1024
        )}MB. Please try another file.`
        trackEvent.track('Plugin_sidebar_QuizPDFMessage_error', {
          errorType: 'PDF_SIZE_TOO_LARGE',
          size,
        })
        return false
      }
    }

    if (!blob) {
      throw new Error('Failed to download PDF')
    }

    trackEvent.track('Plugin_sidebar_QuizPDFMessage_download_success', {
      url,
      size,
    })

    const arrBuf = await blob.arrayBuffer()
    
    let pdfDoc
    try {
      pdfDoc = await PDFDocument.load(arrBuf, { ignoreEncryption: true })
    } catch (pdfError) {
      console.error('PDF解析失败 - QuizPDFMessage:', {
        error: pdfError,
        url: props.message.userContent.attachments?.pdf?.url,
        fileSize: arrBuf.byteLength,
        fileName: props.message.userContent.attachments?.pdf?.title
      })
      errorType.value = ErrorType.NETWORK_ERROR
      errorMessage.value = 'PDF文件解析失败，请检查文件是否损坏或受密码保护'
      return false
    }
    
    const pageCount = pdfDoc.getPageCount()

    trackEvent.track('Plugin_sidebar_QuizPDFMessage_check_conditions', {
      pageCount,
      size,
    })

    if (pageCount > maxPages) {
      errorType.value = ErrorType.PDF_PAGES_TOO_MANY
      errorMessage.value = `The file exceeds ${maxPages} pages. Please try another file.`
      trackEvent.track('Plugin_sidebar_QuizPDFMessage_error', {
        errorType: 'PDF_PAGES_TOO_MANY',
        pages: pageCount,
      })
      return false
    }

    // 保存PDF数据
    pdfBlob.value = blob
    pdfArrayBuffer.value = arrBuf
    pdfTitle.value =
      pdfDoc.getTitle() ||
      props.message.userContent.attachments?.pdf?.title ||
      'document.pdf'

    return true
  } catch (e) {
    errorType.value = ErrorType.NETWORK_ERROR
    pointError('Plugin_sidebar_QuizPDFMessage_downloadAndCheckPdf_error', e, {
      url: props.message.userContent.attachments?.pdf?.url,
    })
    return false
  }
}

function handleDone(
  currentStatus: MessageStatus,
  error?: ErrorType,
  message?: string
) {
  if (error) {
    errorType.value = error
    errorMessage.value = message || ''
  }
  status.value = currentStatus
  const tabId = props.message.userContent.attachments?.pdf?.tabId
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: error
        ? SidepanelEventType.GENERATE_QUIZ_FAIL
        : SidepanelEventType.GENERATE_QUIZ_SUCCESS,
    })
  }
  emit('statusChange', currentStatus)
  emit('messageUpdate')
}

async function uploadPdfToS3() {
  try {
    if (!pdfArrayBuffer.value) {
      handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
      return
    }

    trackEvent.track('Plugin_sidebar_QuizPDFMessage_upload_pdf_start')

    const presignedResponse = await getFlashcardsUploadUrl({
      files: [
        {
          fileName: pdfTitle.value || 'document.pdf',
          fileType: 'pdf',
        },
      ],
    })

    const uploadInfo = presignedResponse.data.urls[0]
    const { uploadUrl, fileUrl } = uploadInfo

    // 上传PDF文件，添加30秒超时
    const pdfBlob = new Blob([pdfArrayBuffer.value], {
      type: 'application/pdf',
    })

    // 创建超时控制器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 30000)

    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type': 'application/pdf',
        },
        body: pdfBlob,
        signal: controller.signal,
      })

      // 清除超时定时器
      clearTimeout(timeoutId)

      if (!uploadResponse.ok) {
        handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
        trackEvent.track('Plugin_sidebar_QuizPDFMessage_upload_pdf_error', {
          errorType: 'UPLOAD_PDF_ERROR',
          uploadUrl,
        })
        return
      }

      trackEvent.track('Plugin_sidebar_QuizPDFMessage_upload_pdf_success')
    } catch (error) {
      // 清除超时定时器
      clearTimeout(timeoutId)

      handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)

      // 检查是否是超时错误
      if (error instanceof Error && error.name === 'AbortError') {
        trackEvent.track('Plugin_sidebar_QuizPDFMessage_upload_pdf_error', {
          errorType: 'TIMEOUT',
          uploadUrl,
        })
        return
      }

      trackEvent.track('Plugin_sidebar_QuizPDFMessage_upload_pdf_error', {
        errorType: 'UNKNOWN_ERROR',
        uploadUrl,
      })
    }

    // 上传成功后缓存 fileUrl
    const originalUrl = props.message.userContent.attachments?.pdf?.url
    if (originalUrl) {
      defaultCache.set(originalUrl, fileUrl)
    }

    // 生成最终的quiz链接
    quizUrl.value = buildQuizUrl(fileUrl, pdfTitle.value || undefined)

    handleDone(MessageStatus.COMPLETED)
  } catch (error) {
    handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
  }
}

// 处理链接点击
const handleLinkClick = () => {
  trackEvent.track('Plugin_Quiz_Link_Clicked')
}

const handleRetry = () => {
  status.value = MessageStatus.PENDING
  quizUrl.value = ''
  emit('statusChange', MessageStatus.PENDING)
  // 重新开始整个流程
  processQuizGeneration()
}

// 处理quiz生成的完整流程
async function processQuizGeneration() {
  try {
    // 先检查缓存
    if (checkCacheAndSetStatus()) {
      return
    }

    // 下载并检查PDF
    const downloadSuccess = await downloadAndCheckPdf()
    if (!downloadSuccess) {
      handleDone(
        MessageStatus.ERROR,
        errorType.value || ErrorType.NETWORK_ERROR,
        errorMessage.value
      )
      return
    }

    // 上传PDF
    await uploadPdfToS3()
  } catch (error) {
    handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
  }
}

// 组件挂载时开始处理
onMounted(async () => {
  emit('statusChange', MessageStatus.PENDING)

  // 获取配置限制
  try {
    const limits: any = await getConfigValue('limits')
    if (limits?.quizPdfMaxSize) {
      maxSize = limits.quizPdfMaxSize * 1024 * 1024
    }
    if (limits?.quizPdfMaxPages) {
      maxPages = limits.quizPdfMaxPages
    }
  } catch (error) {
    console.warn('Failed to get limits config:', error)
  }

  // 开始处理
  processQuizGeneration()

  trackEvent.track('Plugin_sidebar_QuizPDFMessage_mounted')
})
</script>
