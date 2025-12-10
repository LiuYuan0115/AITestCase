<template>
  <SolvingMessage
    ref="solvingMessageRef"
    :is-loading="isLoading"
    :is-out-limit="isOutLimit"
    :is-answering="isAnswering"
    :is-network-error="isNetworkError"
    :current-answer="currentAnswerData"
    :is-stop="props.isStop"
    @retry="userActions.retry"
    @refresh="userActions.refresh"
    @close="userActions.close"
    @toCut="emit('toCut')"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { uploadFileToS3 } from '@/utils/fileUpload'
import { getTrpc } from '@/lib/trpc/client'
import trackEvent from '@/utils/trackEvent'
import emitter from '@/utils/eventBus'
import { generateQuestionId } from '@/utils/common'
import SolvingMessage from '../SolvingMessage.vue'
import { useSolve } from '../../../composables/useSolve'
import { QuestionType } from '../../../types/question'
import { QuestionInfo } from '@/types'
import { throttle } from 'lodash-es'
import { STORAGE_KEY } from '@/config/storage'
import useSubscription from '../../../composables/useSubscription'

const props = defineProps<{
  isStop: boolean
}>()

const emit = defineEmits([
  'toCut',
  'solveDone',
  'solveRetryDone',
  'answerUpdate',
  'problemMissing',
  // 新增：网络错误事件，上抛给父组件 AnswerMessage.vue
  'network-error',
])

// ================= 状态管理 =================
const solvingMessageRef = ref<InstanceType<typeof SolvingMessage> | null>(null)
const imgDataRef = ref()
const totalStartTime = ref()

// 解题 loading 状态, 现在的 loading 状态是包含图片上传的
const isLoading = ref(false)
const isOutLimit = ref(false)
const isNetworkError = ref(false)

const canSendExtensionUniversitySolveSuccess = ref(false)

// ================= 解题核心逻辑 =================
const {
  currentAnswer,
  isAnswering,
  lastQuestionInfo,
  isProblemMissing,
  startAnswer,
  retryAnswer,
  closeAnswer,
  likeAnswer,
  cancelAnswer,
} = useSolve()
const questionIdRef = ref('')

const currentAnswerData = computed(() => {
  return {
    language: 'en',
    questionId: questionIdRef.value,
    answer: currentAnswer.content,
    answerJsonObject: currentAnswer.answerJsonObject,
    isJsonFormat: currentAnswer.isJsonFormat,
    jsonFormatObject: currentAnswer.jsonFormatObject,
  }
})

// 创建节流函数
const throttledEmitUpdate = throttle((newVal) => {
  emit('answerUpdate')
}, 300)

// 监听 currentAnswer 变化
watch(currentAnswer, (newVal) => {
  throttledEmitUpdate(newVal)
})

watch(isProblemMissing, (newValue) => {
  if (newValue) {
    emit('problemMissing')
  }
})

onMounted(async () => {
  // 获取示例题目显示
  const res = await browser.storage.local.get(STORAGE_KEY.SHOW_EXAMPLE_QUESTION)
  if (
    res[STORAGE_KEY.SHOW_EXAMPLE_QUESTION] 
  ) {
    if(res[STORAGE_KEY.SHOW_EXAMPLE_QUESTION] === 'question2'){
      canSendExtensionUniversitySolveSuccess.value = true
    }
    //删除这个key
    browser.storage.local.remove(STORAGE_KEY.SHOW_EXAMPLE_QUESTION)
  }
})

// 组件卸载时清理节流函数
onUnmounted(() => {
  throttledEmitUpdate.cancel()
})

// ================= 业务逻辑聚合 =================
// 图片处理相关
const imageProcessor = {
  async upload(imgData: { cutDataUrl: string }) {
    try {
      return await uploadFileToS3(imgData.cutDataUrl)
    } catch (error) {
      // sendToast(
      //   'We encountered an issue with uploading your screenshot. Please try again.'
      // )
      throw error
    }
  },
}

// ================= 用户操作响应 =================
const userActions = {
  // 等待解题
  waitSolve() {
    isLoading.value = true
  },

  // 解题
  async solve({
    type,
    value,
    attachments,
    prompt,
    source,
  }: {
    type: QuestionType
    value: any
    attachments?: any
    prompt?: string
    source?: string
  }) {
    try {
      switch (type) {
        // 图片题
        case QuestionType.PHOTO: {
          isNetworkError.value = false
          totalStartTime.value = Date.now()
          isLoading.value = true

          // 优先用已存在的 cdnUrl
          const cdnUrl =
            attachments?.image?.imageUrl ||
            (await imageProcessor.upload({ cutDataUrl: value }))

          // 新增：chatgpt 来源图片题埋点
          if (source === 'chatgpt') {
            handleChatGPTSolveData({
              type: prompt ? 'image-text' : 'image',
              value: cdnUrl,
              prompt: prompt,
            })
          }

          // 打点 上传时长
          trackEvent.track('Plugin_Solve_loading_upload', {
            duration: (Date.now() - totalStartTime.value) / 1000,
            durationMS: Date.now() - totalStartTime.value,
            cdnUrl: cdnUrl,
          })
          // 开启算法解题流程
          await solvingFlow.start({
            type: QuestionType.PHOTO,
            content: cdnUrl,
            prompt: prompt || '',
            source: source,
          })
          break
        }
        // 网页一键解题
        case QuestionType.PAGE_SOLVE_ALL: {
          isLoading.value = true
          if (value.cdnUrl) {
            await solvingFlow.start({
              type: QuestionType.PHOTO,
              content: value.cdnUrl,
            })
            return
          }
          await solvingFlow.start({
            type: QuestionType.PAGE_SOLVE_ALL,
            content: '',
            markdown: value.markdown,
          })
          break
        }
        // 整页截图解题
        case QuestionType.PAGE_SCREENSHOT_SOLVE: {
          isLoading.value = true
          await solvingFlow.start({
            type: QuestionType.PAGE_SCREENSHOT_SOLVE,
            content: '',
            cdnUrls: value.cdnUrls,
          })
          break
        }
        // PDF 一键解题
        case QuestionType.PDF_SOLVE_ALL: {
          isLoading.value = true
          await solvingFlow.start({
            type: QuestionType.PDF_SOLVE_ALL,
            content: '',
            pdfUrl: attachments.chatWithPdf.fileUrl,
          })
          break
        }
        // 文字题
        default: {
          isLoading.value = true
          // 新增：chatgpt 来源文字题埋点
          if (source === 'chatgpt') {
            handleChatGPTSolveData({
              type: 'text',
              value: value,
            })
          }
          await solvingFlow.start({
            type: QuestionType.TEXT,
            content: value,
            prompt: '',
          })
          break
        }
      }
    } catch (error) {
      // 打点 网络错误
      trackEvent.track('Plugin_Solve_connect_fail')
      isNetworkError.value = true
    }
  },

  // 网络错误刷新
  refresh: () => {
    if (!imgDataRef.value) {
      // sendToast('缺少解题数据，请重新截图')
      return
    }
    userActions.solve(imgDataRef.value)
  },

  // 重试
  async retry() {
    try {
      isLoading.value = true
      isNetworkError.value = false
      const retryStartTime = Date.now()
      await retryAnswer({
        onStartOutput: () => {
          isLoading.value = false
          if (canSendExtensionUniversitySolveSuccess.value) {
            trackEvent.track('Extension_University_Solve_Success', {
              questionId: questionIdRef.value,
            })
            canSendExtensionUniversitySolveSuccess.value = false
          }
          trackEvent.track('Plugin_Solve_Success', {
            isRetry: true,
          })
        },
        successCallback: () => {
          trackEvent.track('Plugin_Solve_loading_retry', {
            duration: (Date.now() - retryStartTime) / 1000,
            durationMS: Date.now() - retryStartTime,
            isRetry: true,
          })
          emit('solveRetryDone')
        },
        errorCallback: () => {
          isLoading.value = false
          // SolveCore 内部标记网络错误，并上抛给父组件
          isNetworkError.value = true
          emit('network-error')
        },
      })
    } catch (error) {
      isNetworkError.value = true
      // 打点 网络错误
      trackEvent.track('Plugin_Solve_connect_fail')
    }
  },

  // 关闭
  close() {
    closeAnswer()
  },

  // 点赞
  async like() {
    try {
      const success = await likeAnswer(true)
      if (success) {
        trackEvent.track('Plugin_Solve_panel_like')
      }
      return success
    } catch (error) {
      console.error('Failed to like:', error)
      return false
    }
  },

  // 取消点赞
  async dislike() {
    try {
      const success = await likeAnswer(false)
      if (success) {
        trackEvent.track('Plugin_Solve_panel_dislike')
      }
      return success
    } catch (error) {
      console.error('Failed to dislike:', error)
      return false
    }
  },
}

// ================= ChatGPT数据处理 =================
async function handleChatGPTSolveData(
  data: {
    type: 'image' | 'text' | 'image-text'
    value: any
    prompt?: string
  },
  retryCount = 0
) {
  try {
    const MAX_RETRY_COUNT = 5 // 最大重试次数
    const RETRY_DELAY = 800 // 重试延迟时间

    // 获取存储的ChatGPT解题数据
    const result = await browser.storage.local.get(
      STORAGE_KEY.CHATGPT_SOLVE_DATA
    )
    const chatgptData = result[STORAGE_KEY.CHATGPT_SOLVE_DATA]
    console.log('解题的GPT数据：', chatgptData)

    if (!chatgptData) {
      // 文本解题走到这里，可能图片还没上传完毕；为了保证解题速度，用递归+最大限度重试，保证埋点可以获取到GPT答案截图
      if (retryCount >= MAX_RETRY_COUNT) {
        console.warn('ChatGPT解题数据获取超时，已达到最大重试次数')
        return
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
      return handleChatGPTSolveData(data, retryCount + 1)
    }

    let payload: any = {
      type: data.type,
      questionId: questionIdRef.value,
      model: chatgptData?.model,
      answerUrl: chatgptData?.answerUrl,
    }
    switch (data.type) {
      case 'image':
        payload.imageUrl = data.value
        break
      case 'text':
        payload.content = data.value
        break
      case 'image-text':
        payload.imageUrl = data.value
        payload.content = data.prompt
        break
    }
    trackEvent.track('Plugin_ChatGPT_Solve', payload)
    if (chatgptData) {
      // 清理已使用的数据
      await browser.storage.local.remove(STORAGE_KEY.CHATGPT_SOLVE_DATA)
    }
  } catch (error) {
    console.error('处理ChatGPT解题数据失败:', error)
  }
}

// ================= 解题流程控制 =================
const solvingFlow = {
  async start({
    type,
    content,
    markdown,
    pdfUrl,
    cdnUrls = [],
    prompt = '',
    source = '',
  }: {
    type: QuestionType
    content: string
    markdown?: string
    pdfUrl?: string
    cdnUrls?: string[]
    prompt?: string
    source?: string
  }) {
    const questionId = (questionIdRef.value = generateQuestionId())
    let questionInfo: QuestionInfo = {
      mode: 'plugin', // 插件解题专门的模式
      language: 'en',
      subject: 'math',
      instructions: prompt,
      type,
      time: Date.now(),
      questionId: questionId,
      answerId: `${questionId}#${Date.now()}`,
      answerStyle: 'standard',
      answerLanguage: 'en-us',
      answerType: 'generation',
    }

    if (type === QuestionType.PHOTO) {
      questionInfo.files = [{ processed: content }]
    } else if (type === QuestionType.PAGE_SOLVE_ALL) {
      questionInfo.questionText = markdown
    } else if (type === QuestionType.PDF_SOLVE_ALL) {
      questionInfo.pdfUrl = pdfUrl
    } else if (type === QuestionType.PAGE_SCREENSHOT_SOLVE) {
      questionInfo.pictures = cdnUrls
    } else {
      questionInfo.isImageSolve = false
      questionInfo.questionText = content
    }

    // 开启算法解题

    const startAnswerTime = Date.now()

    let pageUrl = ''
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      pageUrl = tab?.url || ''
    } catch (error) {}

    await startAnswer(questionInfo, {
      onStartOutput: () => {
        isLoading.value = false
        if (canSendExtensionUniversitySolveSuccess.value) {
          trackEvent.track('Extension_University_Solve_Success', {
            questionId: questionIdRef.value,
          })
          canSendExtensionUniversitySolveSuccess.value = false
        }
        trackEvent.track('Plugin_Solve_Success', {
          questionId: questionId,
          type,
          source,
          pageUrl,
          cdnUrl: questionInfo.files?.[0]?.processed || '',
          pdfUrl:
            type === QuestionType.PDF_SOLVE_ALL ||
            type === QuestionType.PAGE_SCREENSHOT_SOLVE
              ? pdfUrl
              : '',
        })
        trackEvent.track('Plugin_Solve_loading_solve', {
          duration: (Date.now() - startAnswerTime) / 1000,
          durationMS: Date.now() - startAnswerTime,
          questionId: questionId,
          type,
          source,
          pageUrl,
          cdnUrl: questionInfo.files?.[0]?.processed || '',
          pdfUrl:
            type === QuestionType.PDF_SOLVE_ALL ||
            type === QuestionType.PAGE_SCREENSHOT_SOLVE
              ? pdfUrl
              : '',
        })
      },
      successCallback: async () => {
        trackEvent.track('Plugin_Solve_loading_total', {
          duration: (Date.now() - totalStartTime.value) / 1000,
          durationMS: Date.now() - totalStartTime.value,
          questionId: questionId,
          type,
          source,
          pageUrl,
          cdnUrl: questionInfo.files?.[0]?.processed || '',
          pdfUrl:
            type === QuestionType.PDF_SOLVE_ALL ||
            type === QuestionType.PAGE_SCREENSHOT_SOLVE
              ? pdfUrl
              : '',
        })

        emit('solveDone', {
          questionId,
          answerId: questionInfo.answerId,
        })
        emitter.emit('solve:done', {
          questionId: questionId,
          cdnUrl: type === QuestionType.PHOTO ? '' : content,
        })
      },
      errorCallback: () => {
        trackEvent.track('Plugin_Solve_Error', {
          questionId: questionId,
          type,
          source,
          pageUrl,
          pdfUrl:
            type === QuestionType.PDF_SOLVE_ALL ||
            type === QuestionType.PAGE_SCREENSHOT_SOLVE
              ? pdfUrl
              : '',
          cdnUrl: type === QuestionType.PHOTO ? '' : content,
        })
        isLoading.value = false
        // SolveCore 内部标记网络错误，并上抛给父组件
        isNetworkError.value = true
        emit('network-error')
      },
    })
  },
}

defineExpose({
  solveInExtension: userActions.solve,
  waitSolve: userActions.waitSolve,
  retry: userActions.retry,
  getCurrentAnswer: () => currentAnswer.content,
  getCurrentAnswerData: () => currentAnswerData.value,
  getQuestionInfo: () => lastQuestionInfo.value,
  like: userActions.like,
  dislike: userActions.dislike,
  cancel: () => cancelAnswer(),
})
</script>
