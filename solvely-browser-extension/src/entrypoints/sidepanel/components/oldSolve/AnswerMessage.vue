<template>
  <div
    class="solve-answer-message flex flex-col gap-[10px]"
    :data-message-id="props.message.id"
  >
    <!-- 主内容区 -->
    <AnswerContent
      v-if="!isNetworkError && !isProblemMissing"
      :components="answer.components"
      :status="answer.status"
      :is-uploading="isUploading"
      @quote="handleQuote"
    />

    <!-- 停止提示 -->
    <div
      v-if="isStop"
      class="text-[14px] leading-[140%] text-[#989B9E]"
    >
      You stopped this response
    </div>

    <!-- 网络错误状态 -->
    <div
      v-if="isNetworkError"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-[#F30A34]">Network error. Please try again.</div>
      <div
        class="flex items-center justify-start gap-[4px] text-[#555] cursor-pointer"
        @click="handleNetworkRetry"
      >
        <SvgIcon
          name="try-again"
          size="20"
        />
        <span>Try again</span>
      </div>
    </div>

    <!-- 无效问题状态 -->
    <div
      v-if="isProblemMissing"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-[#F30A34]">No valid questions found</div>
    </div>

    <!-- 操作按钮 -->
    <AnswerActions
      v-if="showActionsComputed && !isStop"
      :is-liked="isLiked"
      :is-disliked="isDisliked"
      :show-retry="true"
      :is-stop="isStop"
      @like="handleLike"
      @dislike="handleDislike"
      @copy="handleCopy"
      @retry="handleRetry"
    />

    <Toast
      ref="toastRef"
      :duration="2000"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide, inject } from 'vue'
import { useSolveV9, useAnswerFormatter } from './composables'
import AnswerContent from './AnswerContent.vue'
import AnswerActions from './actions/AnswerActions.vue'
import Toast from '../Toast.vue'
import SvgIcon from '~/components/common/SvgIcon.vue'
import { MessageStatus } from '../../types/message'
import type { ServiceMessage } from '../../types/message'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'
import trackEvent from '@/utils/trackEvent'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import { uploadFileToS3 } from '@/utils/fileUpload'
import { QuestionType } from '~/entrypoints/sidepanel/types/question'
import { useMessageScroll } from '../../composables/useMessageScroll'
import { generateQuestionId } from '@/utils'
import { STORAGE_KEY } from '@/config/storage'

// ===== Props（精简，移除 messageStore） =====
const props = defineProps<{
  message: ServiceMessage
  showActions?: boolean
}>()

// ===== Emits（所有状态变化向上传递） =====
const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'solveDone', data: { questionId: string; answerId: string }): void
  (e: 'outOfBalance', source: string): void
  (e: 'messageUpdate'): void
}>()

// ===== 核心逻辑 =====
const { answer, start, cancel: cancelSolve, retry, like, getQuestionInfo } = useSolveV9()
const { formatForCopy } = useAnswerFormatter()
const { smartScroll } = useMessageScroll(props.message.id)

// ===== 状态管理 =====
const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const isDone = ref(false)
const isLiked = ref(false)
const isDisliked = ref(false)
const isNetworkError = ref(false)
const isProblemMissing = ref(false)
const isInsufficientBalance = ref(false)
const isUploading = ref(false) // 图片上传状态
const pendingCancel = ref(false)

const isStop = computed(() => props.message.status === MessageStatus.STOP)

// 组合条件判断
const showActionsComputed = computed(() => {
  return (
    (props.showActions &&
      isDone.value &&
      !isProblemMissing.value &&
      !isNetworkError.value &&
      !(isInsufficientBalance.value && !useSubscription.isSubscribed.value)) ||
    isStop.value
  )
})

// ===== Provide 给子组件 =====
provide('user-content', props.message.userContent)
provide('on-insufficient-balance', () => {
  isInsufficientBalance.value = true
  emit('outOfBalance', 'MultiQuestion')
})

provide(InjectionTokens.IS_STOPPED, isStop)

// ===== Inject cancel registry（可选） =====
const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

// 在注册前 ensure 旧的 handler 移除
const cancelSafely = () => {
  pendingCancel.value = true
  isUploading.value = false
  return cancelSolve()
}

const registerCancelHandler = () => {
  cancelRegistry?.unregisterCancelable(props.message.id)
  cancelRegistry?.registerCancelable(props.message.id, cancelSafely)
}

// 显示操作按钮标记
provide(
  InjectionTokens.SHOW_ACTIONS,
  computed(() => showActionsComputed.value)
)

// ===== 暴露给父组件的方法 =====
defineExpose({
  cancel: cancelSafely,
  messageId: props.message.id,
})

// ===== 图片预处理 =====
/**
 * 预处理问题信息：对于图片类型，上传到 CDN
 */
async function preprocessQuestionInfo(questionInfo: any) {
  // 只处理 PHOTO 类型且包含 base64 数据的情况
  if (questionInfo.type === QuestionType.PHOTO || questionInfo.type === QuestionType.PAGE_SCREENSHOT_SOLVE) {
    // 检查是否已经有 CDN URL
    const existingUrl = questionInfo.files?.[0]?.processed || questionInfo.attachments?.image?.imageUrl

    if (!existingUrl && typeof questionInfo.value === 'string') {
      // 埋点：开始上传
      const uploadStartTime = Date.now()

      try {
        // 上传图片到 CDN
        const cdnUrl = await uploadFileToS3(
          questionInfo.type === QuestionType.PHOTO
            ? questionInfo.value
            : questionInfo.attachments?.pageScreenshot?.longImage
        )

        // 埋点：上传完成
        trackEvent.track('Plugin_SolveV9_ImageUpload', {
          duration: (Date.now() - uploadStartTime) / 1000,
          durationMS: Date.now() - uploadStartTime,
          cdnUrl,
        })

        // 返回更新后的 questionInfo
        return {
          ...questionInfo,
          value: cdnUrl, // 更新 value 为 CDN URL
          files: [{ processed: cdnUrl }],
          attachments: {
            ...questionInfo.attachments,
            image: { imageUrl: cdnUrl },
          },
        }
      } catch (error) {
        // 上传失败，抛出错误
        trackEvent.trackError('Plugin_SolveV9_ImageUpload_Failed', error, {
          duration: Date.now() - uploadStartTime,
        })
        throw error
      }
    }
  }

  // 非图片类型或已有 URL，直接返回
  return questionInfo
}

// ===== 生命周期 =====
onMounted(async () => {
  try {
    // 🎯 新增：ChatGPT 来源埋点
    if (props.message.userContent.source === 'chatgpt') {
      handleChatGPTSolve()
    }

    // 注册取消函数
    registerCancelHandler()

    // 开始上传，设置状态
    pendingCancel.value = false
    isUploading.value = true

    // 预处理问题信息（图片上传等）
    const processedQuestionInfo = await preprocessQuestionInfo(props.message.userContent)

    // 上传完成
    isUploading.value = false

    if (pendingCancel.value) {
      return
    }

    // 开始解题（start 内部会设置 answer.status = 'loading'）
    await start(processedQuestionInfo)
    // 等待答案完成，在 watch 中处理
  } catch (error) {
    isUploading.value = false // 确保错误时也清除上传状态
    isNetworkError.value = true
    emit('statusChange', MessageStatus.ERROR)
  }
})

onUnmounted(() => {
  // 清理工作
  cancelSafely()
  cancelRegistry?.unregisterCancelable(props.message.id)
})

// ===== 监听答案状态变化 =====
watch(
  () => answer.status,
  (status) => {
    if (status === 'done') {
      isDone.value = true
      emit('statusChange', MessageStatus.COMPLETED)

      const info = getQuestionInfo()
      emit('solveDone', {
        questionId: info.questionId,
        answerId: info.answerId,
      })

      trackEvent.track('Plugin_Solve_Done', {
        messageId: props.message.id,
        componentCount: answer.components.length,
      })
    } else if (status === 'error') {
      // 检查是否是 PROBLEM MISSING
      if (answer.error?.message === 'PROBLEM_MISSING') {
        isProblemMissing.value = true
        emit('statusChange', MessageStatus.PROBLEM_MISSING)
      } else {
        isNetworkError.value = true
        emit('statusChange', MessageStatus.ERROR)
      }
    } else if (status === 'streaming') {
      emit('messageUpdate')
    }
  }
)

// 监听 STOP 状态
watch(isStop, (stopped) => {
  if (stopped) {
    isDone.value = true
    cancelSafely()
  }
})

// 监听内容变化，自动滚动
watch(
  () => answer.components,
  () => {
    // 只在流式输出或完成时滚动
    if (answer.status === 'streaming' || answer.status === 'done') {
      smartScroll()
    }
  },
  { deep: true }
)

// ===== 事件处理 =====
const handleLike = async () => {
  const success = await like(true)
  if (success) {
    isLiked.value = true
    isDisliked.value = false
    trackEvent.track('Plugin_Solve_panel_like')
  }
}

const handleDislike = async () => {
  const success = await like(false)
  if (success) {
    isDisliked.value = true
    isLiked.value = false
    trackEvent.track('Plugin_Solve_panel_dislike')
  }
}

const handleCopy = () => {
  const text = formatForCopy(answer.components)

  if (!text) {
    console.warn('No content to copy')
    return
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      toastRef.value?.show('Copied')
      trackEvent.track('Plugin_Solve_panel_copied')
    })
    .catch((err) => {
      console.error('Copy failed:', err)
    })
}

const handleRetry = async () => {
  isInsufficientBalance.value = false
  isDone.value = false
  isLiked.value = false
  isDisliked.value = false
  isNetworkError.value = false
  isProblemMissing.value = false
  pendingCancel.value = false

  emit('statusChange', MessageStatus.PENDING)

  try {
    registerCancelHandler()
    await retry()
  } catch (error) {
    isNetworkError.value = true
    emit('statusChange', MessageStatus.ERROR)
  }
}

const handleNetworkRetry = () => {
  isNetworkError.value = false
  handleRetry()
}

const handleQuote = (content: any) => {
  // 处理引用逻辑
  // 可能需要与 useQuoteManager 交互
  trackEvent.track('Plugin_SolveV9_Quote', {
    from: content.from || 'step',
  })
}

/**
 * 处理 ChatGPT 来源埋点（简化版）
 */
async function handleChatGPTSolve() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY.CHATGPT_SOLVE_DATA)
    const chatgptData = result[STORAGE_KEY.CHATGPT_SOLVE_DATA]

    // 生成 questionId（与 useSolveV9.start 保持一致）
    const questionId = generateQuestionId()

    trackEvent.track('Plugin_ChatGPT_Solve', {
      questionId,
      model: chatgptData.model,
    })

    console.log('✅ ChatGPT 埋点上报:', { questionId, model: chatgptData.model })
    if (chatgptData?.model) {
      // 清理已使用的数据
      await browser.storage.local.remove(STORAGE_KEY.CHATGPT_SOLVE_DATA)
    }
  } catch (error) {
    console.error('❌ ChatGPT 埋点上报失败:', error)
  }
}
</script>
