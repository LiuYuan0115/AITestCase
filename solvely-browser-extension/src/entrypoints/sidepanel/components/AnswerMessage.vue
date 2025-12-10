<template>
  <div
    class="flex flex-col gap-[10px]"
    :data-message-index="props.messageIndex"
  >
    <div class="flex justify-start w-full" ref="solveCoreWrap">
      <SolveCore
        v-if="!isProblemMissing && !isNetworkError"
        ref="solveCoreRef"
        :is-stop="isStop"
        @solveDone="handleSolveDone"
        @solveRetryDone="handleSolveRetryDone"
        @answerUpdate="handleMessageUpdate"
        @network-error="handleNetworkError"
        @problem-missing="handleProblemMissing"
      />
      <div
        v-if="isNetworkError"
        class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
      >
        <div class="text-[#F30A34]">Network error. Please try again.</div>
        <div
          class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk cursor-pointer"
          @click="handleNetworkRetry"
        >
          <SvgIcon name="try-again" size="20" />
          <span>Try again</span>
        </div>
      </div>
      <div
        v-if="isProblemMissing"
        class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
      >
        <div class="text-[#F30A34]">No valid questions found</div>
      </div>
    </div>
    <MessageActions
      v-if="
        (showActions &&
          isDone &&
          !isProblemMissing &&
          !isNetworkError &&
          !(isInsufficientBalance && !subscription.isSubscribed.value)) ||
        isStop
      "
      :is-liked="isLiked"
      :is-disliked="isDisliked"
      :is-stop="isStop"
      @like="handleLike"
      @dislike="handleDislike"
      @copy="handleCopy"
      @retry="handleRetry"
    />
    <!-- Solve All 渲染 iframe -->
    <iframe
      v-if="props.message.userContent.type === QuestionType.PAGE_SOLVE_ALL"
      ref="renderIframeRef"
      :src="renderIframeUrl"
      class="absolute -top-[9999px] -left-[9999px] w-[768px] h-auto opacity-0 pointer-events-none"
    />
    <Toast ref="toastRef" :duration="2000" />
  </div>
</template>

<script setup lang="ts">
// ===== 导入区域 =====
import {
  onMounted,
  onUnmounted,
  ref,
  computed,
  provide,
  watch,
} from 'vue'
import { PDFDocument } from 'pdf-lib'
import { ServiceMessage, MessageStatus } from '../types/message'
import { useMessageScroll } from '../composables/useMessageScroll'
import SolveCore from './solvingMessage/core/SolveCore.vue'
import MessageActions from './MessageActions.vue'
import Toast from './Toast.vue'
import trackEvent from '~/utils/trackEvent'
import html2canvas from 'html2canvas'
import { uploadFileToS3 } from '~/utils/fileUpload'
import { PageDataUploader } from '~/utils/pageDataUploader'
import SidepanelEventType from '../types/eventTypes'
import { QuestionType } from '~/entrypoints/sidepanel/types/question'
import { SOLVE_ALL_EVENTS } from '~/types/events'
import useUploadStaging from '../composables/useUploadStaging'
import { convertMultipleImagesToPdf } from '~/utils/imageToPdf'
import { getTrpc } from '~/lib/trpc/client'
import SvgIcon from '~/components/common/SvgIcon.vue'
import subscription from '../composables/useSubscription'
import { InjectionTokens } from '@/entrypoints/sidepanel/types/token'

// ===== 类型和常量定义区域 =====
import useMessages from '../composables/useMessages'
import { ABTestState } from '@/composables/useABTest'

const props = defineProps<{
  message: ServiceMessage
  messageIndex: number
  showActions: boolean
  // 外部传入的额度检查与重试替换（由 MessageList 注入）
  limitCheck?: () => Promise<boolean>
  retryLastMessage?: () => Promise<boolean>
  messageStore: ReturnType<typeof useMessages>
}>()

const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (
    e: 'solveDone',
    event: { questionId: string; answerId: string }
  ): void
  (e: 'messageUpdate'): void
}>()

provide('user-content', props.message.userContent)
const messageStore = props.messageStore

// Provide setDisabledStop to child components
provide('setDisabledStop', messageStore.setDisabledStop)

const abTest = inject<ABTestState>('abTest')!

// ===== 状态定义区域（按模块分组） =====

// 核心状态组
const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const isDone = ref(false)
const isLiked = ref(false)
const isDisliked = ref(false)
const solveCoreRef = ref<InstanceType<typeof SolveCore> | null>(null)
const solveCoreWrap = ref<HTMLElement>()
// 网络错误状态（仅 PAGE_SCREENSHOT_SOLVE 使用）
const isNetworkError = ref(false)
// 余额不足事件标记
const isInsufficientBalance = ref(false)
const isStop = computed(() => props.message.status === MessageStatus.STOP)

const handleInsufficientBalance = () => {
  isInsufficientBalance.value = true
}

// 提供给子组件的余额不足通知方法
provide('on-insufficient-balance', handleInsufficientBalance)

const registerCancelHandler = () => {
  if (!solveCoreRef.value) return
  const cancel = async () => {
    try {
      solveCoreRef.value?.cancel()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('AnswerMessage cancel error:', error)
      }
      throw error
    }
  }
  messageStore.registerCancelable(props.message.id, cancel)
}

watch(
  () => props.message.status,
  (status) => {
    if (status === MessageStatus.STOP) {
      isDone.value = true
    }
  },
  { immediate: true }
)

// 使用滚动管理
const { smartScroll } = useMessageScroll(props.message.id)

// PAGE_SOLVE_ALL 状态组
const renderIframeRef = ref<HTMLIFrameElement | null>(null)
const iframeReady = ref(false)
const extractionTaskId = ref<string | null>(null)
const isRendering = ref(false)
const isProblemMissing = ref(false)

// 计算属性
const renderIframeUrl = computed(() =>
  browser.runtime.getURL('/render-capture.html')
)

// PDF_SOLVE_ALL 状态组
// 目前没有专门状态，预留扩展

// 页面数据状态组
const pageData = ref<{
  html: string
  imageUrls: string[]
} | null>(null)
const pageUrl = ref('')

const uploadStatus = ref<{
  isUploading: boolean
  isCompleted: boolean
  hasFailed: boolean
}>({
  isUploading: false,
  isCompleted: false,
  hasFailed: false,
})

const currentRequestId = ref<string | null>(null)

// 将动作显隐的组合条件下发到子树
const canShowActions = computed(
  () =>
    props.showActions &&
    isDone.value &&
    !isProblemMissing.value &&
    !isNetworkError.value &&
    !(isInsufficientBalance.value && !subscription.isSubscribed.value)
)
provide(InjectionTokens.SHOW_ACTIONS, canShowActions)

// ===== 通用逻辑函数区域 =====

// 辅助函数：移除LaTeX格式
const stripLatex = (text: string): string => {
  if (!text) return ''
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '') // 移除块级LaTeX
    .replace(/\$[^$]*\$/g, '') // 移除行内LaTeX
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '') // 移除LaTeX命令
    .trim()
}

// 格式化单选题答案
const formatSingleChoiceAnswer = (data: any): string => {
  let result = 'Final Answer:\n'

  // 找到正确答案并显示
  if (data.options) {
    const correctOption = data.options.find(
      (option: any) => option.isCorrect === 'yes'
    )
    if (correctOption) {
      result += `${correctOption.label}. ${stripLatex(correctOption.text)}\n`
    }
  }

  // 处理解释
  if (data.explanation) {
    result += '\nExplanation:\n'
    result += stripLatex(data.explanation)
  }

  return result
}

// 格式化多选题答案
const formatMultipleAnswer = (data: any): string => {
  let result = 'Final Answer:\n'

  // 处理多个问题的答案
  if (data.questions) {
    data.questions.forEach((question: any, index: number) => {
      result += `Q${index + 1}: `
      if (question.answer && Array.isArray(question.answer)) {
        result += question.answer.map(stripLatex).join(', ')
      }
      result += '\n'
    })
  }

  // 处理解释
  if (data.explanations) {
    data.explanations.forEach((explanation: any, index: number) => {
      result += `\nQuestion ${index + 1}:\n`
      result += `Answer: ${
        explanation.answer?.map(stripLatex).join(', ') || ''
      }\n`
      result += `Explanation: ${stripLatex(explanation.explanation) || ''}\n`
    })
  }

  return result
}

// 基于 solutions 结构的 JSON 答案格式化（按 Questions.vue 展示结构输出 Markdown）
const formatSolutions = (solutions: any[]): string => {
  if (!Array.isArray(solutions) || solutions.length === 0) return ''

  const questionBlocks: string[] = []

  solutions.forEach((solution, index) => {
    const lines: string[] = []
    const questionIndex = index + 1

    // 标题：Question n
    lines.push(`Question ${questionIndex}`)

    // 题目目标：questionGoal（原样输出，不做 Markdown/LaTeX 处理）
    if (solution?.questionGoal) {
      lines.push('')
      lines.push(String(solution.questionGoal))
    }

    // 步骤：steps（原样输出，不做 Markdown/LaTeX 处理）
    if (Array.isArray(solution?.steps) && solution.steps.length > 0) {
      solution.steps.forEach((step: any, stepIndex: number) => {
        const stepTitle = step?.stepTitle
        const stepContent = step?.stepContent

        // 编号列表步标题
        if (stepTitle) {
          lines.push('')
          lines.push(`${stepIndex + 1}. ${String(stepTitle)}`)
        } else {
          lines.push('')
          lines.push(`${stepIndex + 1}.`)
        }

        // 步内容作为独立段落紧随其后
        if (stepContent) {
          lines.push('')
          lines.push(String(stepContent))
        }
      })
    }

    // 汇总本题块
    questionBlocks.push(lines.join('\n'))
  })

  // 题与题之间空行分隔
  return questionBlocks.join('\n\n')
}

// 格式化JSON答案
const formatJsonAnswer = (jsonFormatObject: any): string => {
  // 新结构：solutions（按 Questions.vue 的 solutions 结构）
  if (
    Array.isArray(jsonFormatObject?.solutions) &&
    jsonFormatObject.solutions.length > 0
  ) {
    return formatSolutions(jsonFormatObject.solutions)
  }

  const component = jsonFormatObject.components?.[0]
  if (!component) return ''

  switch (component.componentType) {
    case 'question_single':
      return formatSingleChoiceAnswer(component.data)
    case 'question_multiple':
      return formatMultipleAnswer(component.data)
    default:
      return ''
  }
}

// DOM截图上传
async function captureDomAndUpload(element: HTMLElement): Promise<string> {
  try {
    // 使用html2canvas生成截图
    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      logging: false,
    })
    // 转换为base64
    const base64Data = canvas.toDataURL('image/webp', 0.9)
    // 上传到S3并返回地址
    let cdnUrl = await uploadFileToS3(base64Data)
    return cdnUrl
  } catch (error) {
    console.error('DOM截图上传失败:', error)
    return ''
  }
}

// 处理消息更新事件
const handleMessageUpdate = () => {
  emit('messageUpdate')
  // 调用智能滚动
  smartScroll()
}

const handleProblemMissing = () => {
  isProblemMissing.value = true
  emit('statusChange', MessageStatus.PROBLEM_MISSING)
}

const handleNetworkError = () => {
  isNetworkError.value = true
  emit('statusChange', MessageStatus.ERROR)
}

const handleLike = async () => {
  const success = await solveCoreRef.value?.like()
  if (success) {
    isLiked.value = true
    trackEvent.track('Plugin_Solve_panel_like')
  }
}

const handleDislike = async () => {
  const success = await solveCoreRef.value?.dislike()
  if (success) {
    isDisliked.value = true
    trackEvent.track('Plugin_Solve_panel_dislike')
  }
}

const handleCopy = () => {
  const answerData = solveCoreRef.value?.getCurrentAnswerData()

  if (!answerData) return

  let text = ''

  // 判断是否为JSON格式
  if (answerData.isJsonFormat && answerData.jsonFormatObject) {
    text = formatJsonAnswer(answerData.jsonFormatObject)
  } else {
    // 原有的文本格式处理逻辑
    text = answerData.answer || ''
    text = text
      .replace(/<graph>.*?<\/graph>/gs, '')
      .replace(/\n{4,}/g, '\n\n')
      .replace(/```[\s\S]*?```/g, '')
  }

  navigator.clipboard
    .writeText(text)  
    .then(() => {
      toastRef.value?.show('Copied')
      trackEvent.track('Plugin_Solve_panel_copied')
    })
    .catch((err) => {
      console.error('Failed to copy text: ', err)
    })
}

// ===== 页面数据处理区域 =====

// 页面数据获取逻辑
const fetchPageData = async () => {
  // 检查今日执行次数限制
  const canExecute = await PageDataUploader.canFetchToday()
  if (!canExecute) {
    console.log('今日页面数据获取次数已达上限(3次)，跳过执行')
    return
  }

  try {
    const requestId = crypto.randomUUID()
    currentRequestId.value = requestId

    // 设置响应监听
    const messageHandler = (message: any) => {
      if (
        message.type === SidepanelEventType.PAGE_HTML_AND_IMAGES_RESPONSE &&
        message.requestId === requestId
      ) {
        if (message.success) {
          pageData.value = message.data
          console.log(
            '页面数据获取成功:',
            message.data.imageUrls?.length || 0,
            '张图片'
          )

          // 成功获取后增加计数
          PageDataUploader.incrementTodayCount()
        } else {
          console.error('页面数据获取失败:', message.error)
        }

        // 清理监听器
        browser.runtime.onMessage.removeListener(messageHandler)
        currentRequestId.value = null
      }
    }

    browser.runtime.onMessage.addListener(messageHandler)

    // 发送请求
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, {
        type: SidepanelEventType.GET_PAGE_HTML_AND_IMAGES,
        requestId,
      })
      pageUrl.value = tab.url || ''
    }

    // 设置超时清理
    setTimeout(() => {
      if (currentRequestId.value === requestId) {
        browser.runtime.onMessage.removeListener(messageHandler)
        currentRequestId.value = null
        console.warn('页面数据获取超时')
      }
    }, 10000) // 10秒超时
  } catch (error) {
    console.error('发送页面数据请求失败:', error)
  }
}

// 页面数据上传逻辑
const uploadPageDataIfNeeded = async () => {
  // 防重复执行检查
  if (uploadStatus.value.isUploading || uploadStatus.value.isCompleted) {
    console.log('页面数据上传已在进行中或已完成，跳过')
    return
  }

  // 条件检查：只有ChatGPT来源且有页面数据时才上传
  if (!pageData.value) {
    console.log('不满足页面数据上传条件，跳过')
    return
  }

  // 设置上传状态
  uploadStatus.value.isUploading = true
  console.log('开始页面数据上传...')

  try {
    const uploader = new PageDataUploader()
    const result = await uploader.uploadPageData(pageData.value)

    if (result.success) {
      uploadStatus.value.isCompleted = true
      console.log('页面数据上传完成:', result.urls)

      // 埋点记录
      trackEvent.track('Plugin_Solve_Page_Snapshots', {
        quesiontId: solveCoreRef.value?.getQuestionInfo()?.questionId,
        url: pageUrl.value,
        htmlUrl: result.urls.html,
        imageCount: result.urls.images.length,
        jsonUrl: result.urls.json,
      })
    } else {
      throw new Error(result.error || '上传失败')
    }
  } catch (error) {
    uploadStatus.value.hasFailed = true
    console.error('页面数据上传失败:', error)
  } finally {
    uploadStatus.value.isUploading = false
  }
}

// ===== 主要事件处理函数 =====

const handleSolveDone = async ({
  questionId,
  answerId,
}: {
  questionId: string
  answerId: string
}) => {
  // 通用逻辑
  isDone.value = true
  isLiked.value = false
  isDisliked.value = false
  emit('statusChange', MessageStatus.COMPLETED)
  emit('solveDone', {
    questionId,
    answerId,
  })

  // 执行分支特定逻辑
  await executeHandler('onSolveDone', { questionId, answerId })

  // 原有的截图逻辑保持不变
  if (props.message.userContent?.source === 'chatgpt') {
    let answerUrl
    if (solveCoreWrap.value) {
      answerUrl = await captureDomAndUpload(solveCoreWrap.value)
    }
    console.log('侧边栏答案截图上传完成，URL:', answerUrl)
    trackEvent.track('Plugin_ChatGPT_Solve_Finish', {
      questionId,
      answerUrl,
    })
  }

  // 执行页面数据上传逻辑
  await uploadPageDataIfNeeded()
}

const handleSolveRetryDone = () => {
  isDone.value = true
  const questionInfo = solveCoreRef.value?.getQuestionInfo()
  if (questionInfo) {
    emit('statusChange', MessageStatus.COMPLETED)
    emit('solveDone', {
      questionId: questionInfo.questionId,
      answerId: questionInfo.answerId,
    })

    // 执行分支特定逻辑
    executeHandler('onSolveRetryDone')
  }
}

const handleRetry = async () => {
  // 重试时复位余额不足标记
  isInsufficientBalance.value = false
  // 额度检查：若无余额，则复用全局 pending/OutLimit UI 流程
  if (props.limitCheck && props.retryLastMessage) {
    try {
      const ok = await props.limitCheck()
      if (!ok) {
        await props.retryLastMessage()
        return
      }
    } catch (e) {
      // 检查异常时，按无余额处理以保证体验一致
      try {
        await props.retryLastMessage()
        return
      } catch {}
    }
  }
  // 执行分支特定的重试前处理
  executeHandler('onRetry')

  // 通用重试逻辑
  isDone.value = false
  isLiked.value = false
  isDisliked.value = false

  // 重置上传状态，允许重新上传
  uploadStatus.value = {
    isUploading: false,
    isCompleted: false,
    hasFailed: false,
  }

  solveCoreRef.value?.retry()
  emit('statusChange', MessageStatus.PENDING)

  // 重新注册取消处理器，确保暂停功能正常工作
  registerCancelHandler()
}

// 网络错误重试：点击 NoNetwork 刷新重新执行 PAGE_SCREENSHOT_SOLVE 流程
const handleNetworkRetry = () => {
  // 立即隐藏错误组件，显示 SolveCore（SolveCore 内有 loading 态）
  isNetworkError.value = false
  solveCoreRef.value?.waitSolve()
  setTimeout(() => {
    executeHandler('onMounted')
  }, 10)
}

// ===== 分支处理器区域 =====

// PAGE_SOLVE_ALL 专属方法定义
const pageSolveAllMethods = {
  cleanupSolveAllResources() {
    // 移除事件监听器
    window.removeEventListener('message', handleIframeMessage)
    browser.runtime.onMessage.removeListener(handleRuntimeMessage)

    // 重置状态
    iframeReady.value = false
    extractionTaskId.value = null
    isRendering.value = false

    // 清理 iframe 引用（Vue 会自动处理 DOM 移除，因为是条件渲染）
    renderIframeRef.value = null
  },

  handleIframeMessage(event: MessageEvent) {
    // 验证消息来源
    if (event.origin !== chrome.runtime.getURL('').slice(0, -1)) {
      return
    }

    if (!event.data || event.data.source !== 'solvely-render-capture') {
      return
    }

    switch (event.data.type) {
      case 'ready':
        pageSolveAllMethods.handleIframeReady()
        break
      case 'render_complete':
        pageSolveAllMethods.handleRenderComplete(event.data.data)
        break
      default:
        console.warn('Unknown iframe message type:', event.data.type)
    }
  },

  async handleIframeReady() {
    iframeReady.value = true

    // 直接向当前 tab 发送内容提取请求
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (tabs[0]?.id) {
        const response = await browser.tabs.sendMessage(tabs[0].id, {
          type: SOLVE_ALL_EVENTS.EXTRACT_CONTENT,
          tabId: tabs[0].id,
        })
        if (renderIframeRef.value?.contentWindow) {
          renderIframeRef.value.contentWindow.postMessage(
            {
              source: 'solvely-answer-message',
              type: 'render_start',
              data: response,
            },
            '*'
          )
        }
      }
    } catch (error) {
      console.error('Failed to send extraction request:', error)
    }
  },

  sendMessageToIframe(type: string, data?: any) {
    if (!renderIframeRef.value?.contentWindow || !iframeReady.value) {
      console.warn('Iframe not ready for message:', type)
      return
    }

    const message = {
      source: 'solvely-answer-message',
      type,
      data,
    }

    renderIframeRef.value.contentWindow.postMessage(message, '*')
  },

  handleRenderComplete(data: any) {
    isRendering.value = false

    if (data.success && data.result) {
      // 开始解题流程
      solveCoreRef.value?.solveInExtension({
        type: QuestionType.PAGE_SOLVE_ALL,
        value: data.result,
      })
    } else {
      console.error('Render failed:', data.error)
      // 渲染失败时清理资源
      pageSolveAllMethods.cleanupSolveAllResources()
    }
  },

  handleRuntimeMessage(message: any) {
    if (!extractionTaskId.value) return

    switch (message.type) {
      case SOLVE_ALL_EVENTS.RENDER_START:
        if (message.taskId === extractionTaskId.value) {
          isRendering.value = true
          pageSolveAllMethods.sendMessageToIframe('render_start', {
            taskId: message.taskId,
            markdown: message.markdown,
            images: message.images,
          })
        }
        break
    }
  },
}

// PDF_SOLVE_ALL 专属方法定义
const pdfSolveAllMethods = {
  async processPdfSolveAll() {
    solveCoreRef.value?.waitSolve()
    const pdfInfo = props.message.userContent.attachments?.chatWithPdf
    if (!pdfInfo) {
      return
    }
    const { processUploadPDF } = useUploadStaging()
    let blob = null
    if (!pdfInfo.file) {
      const res = await fetch(pdfInfo.fileUrl)
      pdfInfo.file = blob = await res.blob()
    }
    let pdfUrl = pdfInfo.fileUrl

    let pdfDoc
    try {
      pdfDoc = await PDFDocument.load(await pdfInfo.file.arrayBuffer(), {
        ignoreEncryption: true,
      })
    } catch (pdfError) {
      console.error('PDF解析失败 - AnswerMessage:', {
        error: pdfError,
        fileName: pdfInfo.fileName,
        fileUrl: pdfInfo.fileUrl,
        fileSize: pdfInfo.file?.size,
      })
      // 如果PDF解析失败，继续使用原始URL
      pdfUrl = pdfInfo.fileUrl
      pdfDoc = null
    }

    const pageCount = pdfDoc?.getPageCount() || 0
    if (pageCount > 20 && pdfDoc) {
      const newPdfDoc = await PDFDocument.create()
      const pages = await newPdfDoc.copyPages(
        pdfDoc,
        Array.from({ length: 20 }, (_, i) => i)
      )
      pages.forEach((page) => newPdfDoc.addPage(page))
      const newPdfBytes = await newPdfDoc.save()
      const buffer = newPdfBytes.buffer
      const finalBuffer =
        buffer instanceof ArrayBuffer
          ? buffer
          : new ArrayBuffer(buffer.byteLength)
      const truncatedFile = new File([finalBuffer], pdfInfo.fileName, {
        type: 'application/pdf',
      })
      pdfUrl = await processUploadPDF(truncatedFile)
    } else if (blob) {
      pdfUrl = await processUploadPDF(
        new File([blob], pdfInfo.fileName, {
          type: 'application/pdf',
        })
      )
    }
    solveCoreRef.value?.solveInExtension({
      ...props.message.userContent,
      attachments: {
        ...props.message.userContent.attachments,
        chatWithPdf: {
          ...pdfInfo,
          fileUrl: pdfUrl,
        },
      },
    })
  },
}

// PAGE_SCREENSHOT_SOLVE 专属方法定义
const pageScreenshotSolveMethods = {
  async processPageScreenshotSolve() {
    try {
      solveCoreRef.value?.waitSolve()

      const uploadManager = 
        props.message.userContent.attachments?.pageScreenshot?.uploadManager
      
      // ⭐ 新逻辑：使用上传管理器
      if (uploadManager) {
        const sliceCount = uploadManager.progress.value.total
        
        // ⭐ 小页面：直接使用 longImage
        if (sliceCount <= 2) {
          solveCoreRef.value?.solveInExtension({
            type: QuestionType.PHOTO,
            value: props.message.userContent.attachments?.pageScreenshot?.longImage,
            source: QuestionType.PAGE_SCREENSHOT_SOLVE,
          })
          trackEvent.track('Plugin_Sidebar_processPageScreenshotSolve_smallPage', {
            slices: sliceCount,
          })
          isNetworkError.value = false
          return
        }
        
        // ⭐ 大页面：等待上传完成
        // 显示上传进度
        const unwatchProgress = watch(
          () => uploadManager.progress.value,
          (prog) => {
            if (prog.uploaded < prog.total) {
              console.log(`📊 上传进度: ${prog.uploaded}/${prog.total} (${prog.percentage}%)`)
            }
          },
          { immediate: true }
        )
        
        try {
          const cdnUrls = await uploadManager.waitForCompletion()
          
          unwatchProgress()
          
          console.log(`✅ 所有切片上传完成，共 ${cdnUrls.length} 个`)
          
          trackEvent.track('Plugin_Sidebar_processPageScreenshotSolve_streamingUpload', {
            slices: cdnUrls.length,
            totalSlices: uploadManager.progress.value.total,
          })
          
          if (cdnUrls.length > 20) {
            nextTick(() => {
              toastRef.value?.show(
                'This page exceeded the maximum limit, only part of the content can be processed.'
              )
            })
          }
          
          // 开始解题
          solveCoreRef.value?.solveInExtension({
            type: QuestionType.PAGE_SCREENSHOT_SOLVE,
            value: { cdnUrls },
            source: QuestionType.PAGE_SCREENSHOT_SOLVE,
          })
          
          isNetworkError.value = false
        } catch (error) {
          unwatchProgress()
          console.error('❌ 切片上传失败:', error)
          isNetworkError.value = true
          trackEvent.trackError(
            'Plugin_Sidebar_processPageScreenshotSolve_uploadError',
            error,
            { message: String(error) }
          )
        }
        
        return
      }
      
      // ⭐ 兼容旧逻辑：直接处理 slices（向后兼容）
      const slices =
        props.message.userContent.attachments?.pageScreenshot?.slices ?? []

      if (slices.length === 0) {
        console.warn('⚠️ 没有 uploadManager 也没有 slices，无法处理')
        isNetworkError.value = true
        return
      }
      
      console.log('📦 使用传统方式处理 slices（兼容模式）')

      trackEvent.track('Plugin_Sidebar_processPageScreenshotSolve_legacy', {
        slices: slices.length,
      })

      if (slices.length <= 2) {
        solveCoreRef.value?.solveInExtension({
          type: QuestionType.PHOTO,
          value:
            props.message.userContent.attachments?.pageScreenshot?.longImage,
          source: QuestionType.PAGE_SCREENSHOT_SOLVE,
        })
        return
      }

      // 原有的上传逻辑（保持不变，作为兼容方案）
      let cdnUrls: string[] = []
      try {
        const s = Date.now()
        const tasks = slices.map((base64: string, i: number) => {
          const name = `page-slice-${i + 1}-${Date.now()}.webp`
          return async () => await uploadFileToS3(base64, name)
        })

        const results: (string | undefined)[] = new Array(tasks.length)
        let nextIndex = 0
        const limit = 3

        const workers = Array.from(
          { length: Math.min(limit, tasks.length) },
          async () => {
            while (true) {
              const current = nextIndex++
              if (current >= tasks.length) break
              try {
                results[current] = await tasks[current]()
              } catch (err) {
                console.error('[slice upload failed]', current, err)
                results[current] = undefined
              }
            }
          }
        )

        await Promise.all(workers)
        cdnUrls = results.filter((u): u is string => Boolean(u))
        trackEvent.track('Plugin_Sidebar_processPageScreenshotSolve_pictures', {
          duration: Date.now() - s,
          slices: slices.length,
        })
        console.log('page slices cdnUrls', cdnUrls)
      } catch (e) {
        console.error('page slices upload error', e)
      }

      if (slices.length > 20) {
        nextTick(() => {
          toastRef.value?.show(
            'This page exceeded the maximum limit, only part of the content can be processed.'
          )
        })
      }

      solveCoreRef.value?.solveInExtension({
        type: QuestionType.PAGE_SCREENSHOT_SOLVE,
        value: { cdnUrls },
        source: QuestionType.PAGE_SCREENSHOT_SOLVE,
      })
      
      isNetworkError.value = false
    } catch (error) {
      isNetworkError.value = true
      trackEvent.trackError(
        'Plugin_Sidebar_processPageScreenshotSolve',
        error,
        {
          message: String(error),
        }
      )
    }
  },

  async captureFullPageScreenshots(tabId: number): Promise<string[]> {
    const screenshots: string[] = []
    let originalScrollY = 0

    try {
      // 获取页面信息
      const pageInfo = await browser.tabs.sendMessage(tabId, {
        type: SidepanelEventType.GET_PAGE_SCROLL_INFO,
      })

      const { totalHeight, viewportHeight, currentScrollY } = pageInfo
      originalScrollY = currentScrollY

      // 计算需要滚动的次数
      const scrollSteps = Math.ceil(totalHeight / viewportHeight)
      console.log(
        `页面总高度: ${totalHeight}px, 视口高度: ${viewportHeight}px, 需要 ${scrollSteps} 次截图`
      )

      // 逐步滚动并截图
      for (let i = 0; i < scrollSteps; i++) {
        const scrollPosition = i * viewportHeight

        // 滚动到指定位置
        await browser.tabs.sendMessage(tabId, {
          type: SidepanelEventType.SCROLL_TO_POSITION,
          position: scrollPosition,
        })

        // 等待页面稳定
        await new Promise((resolve) => setTimeout(resolve, 500))

        // 进行截图
        const screenshot = await getTrpc().screenShot.query()
        screenshots.push(screenshot)

        console.log(`完成第 ${i + 1}/${scrollSteps} 张截图`)

        // 添加截图间隔，避免超过API速率限制
        if (i < scrollSteps - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      return screenshots
    } catch (error) {
      console.error('截图过程失败:', error)
      throw error
    } finally {
      // 恢复原始滚动位置
      try {
        await browser.tabs.sendMessage(tabId, {
          type: SidepanelEventType.RESTORE_SCROLL_POSITION,
          originalPosition: originalScrollY,
        })
      } catch (error) {
        console.warn('恢复滚动位置失败:', error)
      }
    }
  },

  async createMultiPagePdf(
    imageSlices: string[],
    tileSize?: number
  ): Promise<string> {
    try {
      // 生成多页PDF
      const s = Date.now()
      const { pdfFile } = await convertMultipleImagesToPdf(
        imageSlices,
        'page-screenshot.pdf',
        {
          pageSize: tileSize,
          maxPageCount: 20,
        }
      )
      console.log('完成生成 PDF 的耗时', Date.now() - s)
      console.log('pdf 文件', pdfFile)
      trackEvent.track('Plugin_sidebar_createMultiPagePdf', {
        duration: Date.now() - s,
        slices: imageSlices.length,
        pdfSize: pdfFile.size,
      })
      // 使用专门的PDF上传方法
      const uploadStart = Date.now()
      const { processUploadPDF } = useUploadStaging()
      const pdfUrl = await processUploadPDF(pdfFile)
      trackEvent.track('Plugin_sidebar_createMultiPagePdf_upload', {
        duration: Date.now() - uploadStart,
        slices: imageSlices.length,
        pdfSize: pdfFile.size,
        pdfUrl,
      })
      return pdfUrl
    } catch (error) {
      console.error('PDF生成和上传失败:', error)
      throw new Error(
        `PDF Failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  },
}

const branchHandlers: Record<string, any> = {
  [QuestionType.PAGE_SOLVE_ALL]: {
    // 专属方法集合
    methods: pageSolveAllMethods,

    // 生命周期钩子
    async onMounted() {
      window.addEventListener('message', handleIframeMessage)
      browser.runtime.onMessage.addListener(handleRuntimeMessage)
      solveCoreRef.value?.waitSolve()
    },

    onSolveDone() {
      pageSolveAllMethods.cleanupSolveAllResources()
    },

    onSolveRetryDone() {
      pageSolveAllMethods.cleanupSolveAllResources()
    },

    onRetry() {
      pageSolveAllMethods.cleanupSolveAllResources()
      // 重新注册取消处理器，确保暂停功能正常工作
      registerCancelHandler()
    },

    onUnmounted() {
      pageSolveAllMethods.cleanupSolveAllResources()
    },
  },

  [QuestionType.PDF_SOLVE_ALL]: {
    // 专属方法集合
    methods: pdfSolveAllMethods,

    // 生命周期钩子
    async onMounted() {
      await pdfSolveAllMethods.processPdfSolveAll()
    },
  },

  [QuestionType.PAGE_SCREENSHOT_SOLVE]: {
    // 专属方法集合
    methods: pageScreenshotSolveMethods,

    // 生命周期钩子
    async onMounted() {
      await pageScreenshotSolveMethods.processPageScreenshotSolve()
    },
    onRetry() {
      // 全局重试时，若此前出现网络错误，先隐藏错误组件
      isNetworkError.value = false
      // 重新注册取消处理器，确保暂停功能正常工作
      registerCancelHandler()
    },
  },

  default: {
    // 生命周期钩子
    async onMounted() {
      solveCoreRef.value?.solveInExtension(props.message.userContent)
    },
  },
}

// 为需要在模板或事件监听器中使用的方法创建代理
const handleIframeMessage = (event: MessageEvent) => {
  pageSolveAllMethods.handleIframeMessage(event)
}

const handleRuntimeMessage = (message: any) => {
  pageSolveAllMethods.handleRuntimeMessage(message)
}

const executeHandler = async (methodName: string, ...args: any[]) => {
  const questionType = props.message.userContent.type
  const handler = branchHandlers[questionType] || branchHandlers.default
  const method = handler?.[methodName]

  if (method && typeof method === 'function') {
    try {
      await method(...args)
    } catch (error) {
      console.error(`Error executing ${methodName}:`, error)
    }
  }
}

// ===== 生命周期钩子区域 =====

onMounted(async () => {
  registerCancelHandler()
  // 执行分支特定的挂载逻辑
  await executeHandler('onMounted')

  // 获取页面数据
  fetchPageData()
})

onUnmounted(() => {
  // 执行分支特定的卸载逻辑
  executeHandler('onUnmounted')

  // 通用清理逻辑
  if (currentRequestId.value) {
    // 注意：这里无法访问到messageHandler，实际会在超时时自动清理
    currentRequestId.value = null
  }
  // 重置网络错误相关状态，避免泄漏到其他消息实例
  isNetworkError.value = false

  messageStore.unregisterCancelable(props.message.id)
})
</script>
