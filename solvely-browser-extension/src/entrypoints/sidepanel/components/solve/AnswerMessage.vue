<template>
  <div
    class="solve-answer-message flex flex-col gap-[10px] relative"
    :data-message-id="props.message.id"
  >
    <!-- 上传错误提示 -->
    <div
      v-if="uploadError"
      class="px-[12px] flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-status-error dark:text-status-error-dark">Network error. Please try again.</div>
      <div
        class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk cursor-pointer hover:text-t_1 dark:hover:text-t_1_dk transition-colors"
        @click="handleUploadRetry"
      >
        <SvgIcon
          name="try-again"
          size="20"
        />
        <span>Try again</span>
      </div>
    </div>

    <!-- 原有内容（上传错误时隐藏） -->
    <template v-else>
      <!-- 模型结果导航器（仅在切换过模型后显示） -->
      <div
        v-if="showModelNavigator"
        class="absolute top-[0] right-[0] flex items-center justify-center"
      >
        <div
          class="flex items-center justify-between w-[66px] px-[5px] py-[4px] bg-b_panel dark:bg-b_panel_dk rounded-[20px] transition-colors duration-200"
        >
          <button
            @click="navigateModel(-1)"
            :disabled="currentModelIndex === 0"
            class="text-t_2 dark:text-t_2_dk"
            :class="[
              'flex items-center justify-center flex-shrink-0 transition-opacity duration-200',
              currentModelIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-100 cursor-pointer',
            ]"
          >
            <SvgIcon
              name="arrow-left"
              size="12"
            />
          </button>
          <div class="text-[12px] font-[500] leading-[130%] text-t_2 dark:text-t_2_dk transition-colors duration-200">
            {{ currentModelIndex + 1 }}/{{ requestedModelsCount }}
          </div>
          <button
            @click="navigateModel(1)"
            :disabled="currentModelIndex === requestedModelsCount - 1"
            class="text-t_2 dark:text-t_2_dk"
            :class="[
              'flex items-center justify-center flex-shrink-0 transition-opacity duration-200',
              currentModelIndex === requestedModelsCount - 1
                ? 'opacity-30 cursor-not-allowed'
                : 'opacity-100 cursor-pointer',
            ]"
          >
            <SvgIcon
              name="arrow-right2"
              size="12"
            />
          </button>
        </div>
      </div>

      <!-- 主内容区：多模型水平滚动 -->
      <div
        class="answer-contents-wrapper"
        :style="{ height: wrapperHeight != null ? `${wrapperHeight}px` : undefined }"
      >
        <div v-if="isUploading">
          <LoadingState />
        </div>
        <!-- 停止提示：仅在上传阶段被取消且没有任何模型结果时显示（避免与 AnswerContent 内部的停止提示重复） -->
        <div
          v-else-if="isStop && requestedModels.length === 0"
          class="text-[14px] leading-[140%] text-t_3 dark:text-t_3_dk"
        >
          You stopped this response
        </div>
        <!-- 有模型结果时，由 AnswerContent 内部处理停止提示显示 -->
        <div
          v-else-if="requestedModels.length > 0"
          ref="scrollContainerRef"
          class="answer-contents-scroll"
        >
          <div
            v-for="modelResult in requestedModels"
            :key="modelResult.modelId"
            class="answer-content-slide"
            :data-model-id="modelResult.modelId"
            :data-structured-answer="getFormattedAnswer(modelResult)"
            :ref="(el) => registerSlide(modelResult.modelId, el)"
          >
            <AnswerContent
              :model-id="modelResult.modelId"
              :model-result="modelResult"
              :components="modelResult.answer.components"
              :status="modelResult.answer.status"
              :is-uploading="isUploading && modelResult.modelId === currentModelId"
              :show-actions="showActionsComputed && !isStop"
              @quote="handleQuote"
              @switch-model="handleSwitchModel"
              @like="handleLike"
              @copy="handleCopy"
              @retry="handleRetry"
              @no-balance-ready="handleNoBalanceReady"
            />
          </div>
        </div>
      </div>
    </template>

    <Toast
      ref="toastRef"
      :duration="2000"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  provide,
  inject,
  nextTick,
  type ComponentPublicInstance,
} from 'vue'
import { useSolveV9, useAnswerFormatter } from './composables'
import AnswerContent from './AnswerContent.vue'
import Toast from '../Toast.vue'
import SvgIcon from '~/components/common/SvgIcon.vue'
import LoadingState from './components/LoadingState.vue'
import { MessageStatus } from '../../types/message'
import type { ServiceMessage } from '../../types/message'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'
import trackEvent from '@/utils/trackEvent'
import { uploadFileToS3 } from '@/utils/fileUpload'
import { QuestionType } from '~/entrypoints/sidepanel/types/question'
import { useMessageScroll } from '../../composables/useMessageScroll'
import { generateQuestionId } from '@/utils'
import { STORAGE_KEY } from '@/config/storage'

// ===== Props =====
const props = withDefaults(
  defineProps<{
    message: ServiceMessage
    useScroll?: boolean
    showActions?: boolean // 是否显示操作按钮（点赞、复制等）
  }>(),
  {
    useScroll: true,
    showActions: true,
  }
)

// ===== Emits（所有状态变化向上传递） =====
const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'solveDone', data: { questionId: string; answerId: string }): void
  (e: 'outOfBalance', source: string): void
  (e: 'messageUpdate'): void
  (
    e: 'done',
    data: {
      components: any[]
      questionId: string
      answerId: string
      feedback: number
      imageUrl?: string
      modelId?: string // 🎯 当前显示的模型 ID
      modelResults?: any[] // 🎯 所有模型的结果
    }
  ): void
  (e: 'feedbackChange', feedback: -1 | 0 | 1): void // 🎯 单独的反馈状态变化事件
  (e: 'retry', modelId: string): void
}>()

// ===== 核心逻辑 =====

const {
  answer,
  start,
  cancel: cancelSolve,
  switchModel,
  retry,
  like,
  getQuestionInfo,
  getImageUrl, // 🎯 获取图片 CDN URL
  currentModelId,
  requestedModels,
  getEffectiveDefaultModel,
  initFromPreloaded, // 🎯 从预加载数据初始化
  updateModelFeedback, // 🎯 更新点赞状态
} = useSolveV9()
const { formatForCopy } = useAnswerFormatter()

// 🎯 格式化答案（排除thinking，保留LaTeX，用于划词上下文）
const getFormattedAnswer = (modelResult: any): string => {
  if (!modelResult.answer.components || modelResult.answer.components.length === 0) {
    return ''
  }
  // 过滤掉 thinking 组件，使用修复后的 formatForCopy（已保留 LaTeX）
  const componentsWithoutThinking = modelResult.answer.components.filter((c: any) => c.type !== 'question_thinking')
  return formatForCopy(componentsWithoutThinking)
}

// 🎯 获取用户消息文本（用于划词上下文）
const getUserMessageText = (): string => {
  const userContent = props.message.userContent
  let text = ''

  // prompt 字段
  if (userContent.prompt && typeof userContent.prompt === 'string') {
    text += userContent.prompt.trim()
  }

  // value 字段（只处理文本类型，不包括图片）
  const textTypes = ['text', 'text_solve', 'selection']
  if (textTypes.includes(userContent.type) && userContent.value && typeof userContent.value === 'string') {
    if (text) text += '\n'
    text += userContent.value.trim()
  }

  return text.trim()
}

// 🎯 Provide 获取完整上下文的函数（给步骤块用）
provide('getQuoteContext', () => {
  const userMsg = getUserMessageText()
  const serviceMsg = getFormattedAnswer(
    requestedModels.value.find((r) => r.modelId === currentModelId.value) || { answer: { components: [] } }
  )

  const context = [userMsg, serviceMsg].filter(Boolean).join('\n\n').trim()
  return context.slice(0, 8000) // 8k限制
})

// ===== 订阅状态（用于判断余额不足时的显示逻辑） =====
const subscription = inject<any>('subscription')!
// 根据 useScroll prop 决定是否启用滚动
const { smartScroll } = props.useScroll ? useMessageScroll(props.message.id) : { smartScroll: () => {} }

// ===== 状态管理 =====
const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)
const wrapperHeight = ref<number | null>(null)
const isDone = ref(false)
const isInsufficientBalance = ref(false)
const isUploading = ref(false) // 图片上传状态
const pendingCancel = ref(false)
const uploadError = ref(false) // 图片上传错误状态
const isMultiModelDisabled = ref(false) // 多模型比较按钮是否禁用
const isCancelledLocally = ref(false) // 🛡️ 本地取消标志（用于快速检测，不依赖 props 更新）

const isStop = computed(() => isCancelledLocally.value || props.message.status === MessageStatus.STOP)

// 组合条件判断
const showActionsComputed = computed(() => {
  return props.showActions && isDone.value && !(isInsufficientBalance.value && !subscription.isSubscribed.value)
})

// 这样 provide 时就已经是正确的值，避免子组件 watch 时序问题
const isFromPreloaded = ref(!!props.message.preloadedData)

// ===== Provide 给子组件 =====
provide('user-content', props.message.userContent)
provide('on-insufficient-balance', () => {
  isInsufficientBalance.value = true
  emit('outOfBalance', 'MultiQuestion')
})
// 🎯 Provide 是否来自预加载数据（ThinkingBlock 需要判断默认展开/折叠）
provide('is-from-preloaded', isFromPreloaded)
provide(
  InjectionTokens.IS_STOPPED,
  computed(() => isStop.value)
)

// ⭐ 多模型支持：provide 给子组件
provide('currentModelId', currentModelId)
provide('requestedModels', requestedModels)

// ⭐ 提供 questionId 给子组件
const questionId = computed(() => getQuestionInfo().questionId)
provide('questionId', questionId)

// ⭐ 提供多模型禁用状态给子组件
provide(
  'isMultiModelDisabled',
  computed(() => !subscription.isSubscribed.value && isMultiModelDisabled.value)
)

// ⭐ 提供是否应该扣减余额的状态给子组件（只有一个模型时才扣减）
const shouldDeductBalance = computed(() => requestedModels.value.length <= 1)
provide('shouldDeductBalance', shouldDeductBalance)

// ===== Inject cancel registry（可选） =====
const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

// 在注册前 ensure 旧的 handler 移除
/**
 * 修复说明：
 * 之前这里会标记 currentModelId 对应的模型为 stopped，
 * 但用户可能切换到已完成的模型查看，导致错误地标记已完成的模型。
 * 现在移除重复逻辑，让 cancelSolve() 来统一处理停止逻辑。
 * cancelSolve() 会找到真正在运行的模型并标记为 stopped。
 *
 * 🐛 修复时序问题：
 * 1. 只在真正有请求被取消时才更新状态和 emit 事件
 * 2. 如果还在上传阶段，只标记上传状态，不设置 isDone
 */
const cancelSafely = async (): Promise<void> => {
  // 🛡️ 立即设置本地取消标志（不依赖 props 更新）
  isCancelledLocally.value = true
  
  // 🎯 如果正在上传，先停止上传
  isUploading.value = false

  // ✅ 调用 cancelSolve()，保存 thinking 的 duration 和 isStopped
  const cancelled = cancelSolve()

  // 🎯 如果有正在运行的请求被取消，emit done 事件
  if (cancelled) {
    isDone.value = true
    // 🎯 关键：立即 emit done 事件，带上完整的 modelResults
    // 这样 layerServiceMessage 就能拿到包含 isStopped 的完整数据
    emit('done', buildDoneEventData())
  }
  emit('statusChange', MessageStatus.STOP)
}

/**
 * 注册取消处理器
 *
 * 🐛 修复竞态条件：
 * 1. 先注销旧的处理器，避免重复注册
 * 2. 确保每次注册的都是最新的 cancelSafely 函数
 */
const registerCancelHandler = () => {
  // 🛡️ 先注销旧的处理器（避免重复注册导致的问题）
  cancelRegistry?.unregisterCancelable(props.message.id)

  // 🎯 使用 nextTick 确保在下一个 tick 注册，避免时序问题
  nextTick(() => {
    cancelRegistry?.registerCancelable(props.message.id, cancelSafely)
  })
}

// 显示操作按钮标记
provide(
  InjectionTokens.SHOW_ACTIONS,
  computed(() => showActionsComputed.value)
)
provide(
  InjectionTokens.SHOW_MODEL_NAVIGATOR,
  computed(() => props.showActions)
)

// 提供加载状态（检查所有模型是否有正在加载的）
const isAnswerLoading = computed(() => {
  // 1. 图片上传中
  if (isUploading.value) return true

  // 2. 检查是否有任何模型正在加载或流式输出
  const hasLoadingModel = requestedModels.value.some((result) => {
    const status = result.answer.status
    return status === 'loading' || status === 'streaming'
  })

  return hasLoadingModel
})
provide('isAnswerLoading', isAnswerLoading)

// ===== 多模型导航器相关 =====
const showModelNavigator = computed(() => requestedModels.value.length > 1)

const currentModelIndex = computed(() => {
  return requestedModels.value.findIndex((r) => r.modelId === currentModelId.value)
})

const requestedModelsCount = computed(() => requestedModels.value.length)

const currentModelName = computed(() => {
  const result = requestedModels.value.find((r) => r.modelId === currentModelId.value)
  return result?.modelName || ''
})

const slideRefs = new Map<string, HTMLElement>()
const resizeObservers = new Map<string, ResizeObserver>()

function updateWrapperHeight(modelId: string, immediate = false) {
  const el = slideRefs.get(modelId)
  if (!el) return

  const applyHeight = () => {
    const contentEl = el.firstElementChild as HTMLElement | null
    const height = contentEl?.offsetHeight ?? el.scrollHeight

    wrapperHeight.value = height
  }

  if (immediate) {
    applyHeight()
    return
  }

  requestAnimationFrame(applyHeight)
}

async function ensureHeightForCurrent(immediate = false) {
  await nextTick()
  updateWrapperHeight(currentModelId.value, immediate)
}

function registerSlide(modelId: string, el: Element | ComponentPublicInstance | null) {
  // 清理旧的观察器
  const existingObserver = resizeObservers.get(modelId)
  if (existingObserver) {
    existingObserver.disconnect()
    resizeObservers.delete(modelId)
  }

  if (!el) {
    slideRefs.delete(modelId)
    return
  }

  const element = el as HTMLElement
  slideRefs.set(modelId, element)

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    if (modelId === currentModelId.value) {
      updateWrapperHeight(modelId)
    }
  })

  observer.observe(element)
  resizeObservers.set(modelId, observer)

  if (modelId === currentModelId.value) {
    updateWrapperHeight(modelId, true)
  }
}

function navigateModel(delta: number) {
  const currentIndex = currentModelIndex.value
  const nextIndex = currentIndex + delta
  const nextModel = requestedModels.value[nextIndex]

  if (nextModel) {
    currentModelId.value = nextModel.modelId
    trackEvent.track('Plugin_Answer_SwitchModel_Tab_Click')
  }
}

async function handleSwitchModel(modelId: string) {
  try {
    // ⭐ 新增：检查是否是已存在且被 stopped 的模型
    const existingModel = requestedModels.value.find((r) => r.modelId === modelId)

    if (existingModel && existingModel.isStopped) {
      // 被停止的模型需要 retry（重新请求）
      // 🛡️ 重置本地取消标志（重试被停止的模型前还原状态）
      isCancelledLocally.value = false
      registerCancelHandler()
      await retry(modelId)
      await ensureHeightForCurrent(true)
      return // 提前返回，不执行后续逻辑
    }

    // 原有逻辑：检查是否是新模型（需要发起新请求）
    const isNewModel = !requestedModels.value.some((r) => r.modelId === modelId)

    if (isNewModel) {
      // 新模型需要发起请求，更新状态
      emit('statusChange', MessageStatus.PENDING) // 设置 isResponding = true
      registerCancelHandler() // 让停止按钮可用

      // 重置状态（参考 handleRetry）
      isInsufficientBalance.value = false
      isDone.value = false
      pendingCancel.value = false
      isCancelledLocally.value = false // 🛡️ 重置本地取消标志（切换新模型前还原状态）
    }

    await switchModel(modelId)

    // 如果是新模型，确保高度正确
    if (isNewModel) {
      await ensureHeightForCurrent(true)
    }
  } catch (error) {
    console.error('Failed to switch model:', error)
    // 错误会在 AnswerContent 中显示
    emit('statusChange', MessageStatus.ERROR)
  }
}

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

/**
 * 核心解题流程：上传图片 + 开始解题
 *
 * 🐛 修复时序问题：
 * 只在关键节点检查取消状态：上传完成后、发起流式请求前
 */
async function startSolving() {
  try {
    // 🛡️ 重置本地取消标志（开始新的解题）
    isCancelledLocally.value = false
    
    // 🎯 新增：ChatGPT 来源埋点
    if (props.message.userContent.source === 'chatgpt') {
      handleChatGPTSolve()
    }

    // 重置错误状态
    uploadError.value = false
    pendingCancel.value = false
    isUploading.value = true

    // 预处理问题信息（图片上传等）
    const processedQuestionInfo = await preprocessQuestionInfo(props.message.userContent)

    // 上传完成
    isUploading.value = false

    // 如果在上传过程中被取消，停止后续操作
    if (isStop.value) return

    // 获取默认模型
    const defaultModel = await getEffectiveDefaultModel()

    // 🛡️ 关键节点：发起流式请求前检查取消状态（所有预处理完成后）
    if (isStop.value) return

    // 开始解题（发起流式请求）
    await start(processedQuestionInfo, {}, defaultModel)

    await ensureHeightForCurrent(true)
  } catch (error) {
    // 🛡️ 如果是因为取消导致的错误，不更新错误状态
    if (isStop.value)return

    isUploading.value = false
    uploadError.value = true // 标记上传错误
    emit('statusChange', MessageStatus.ERROR)
    console.error('❌ Start solving failed:', error)
  }
}

/**
 * 处理上传重试
 */
const handleUploadRetry = async () => {
  console.log('🔄 Retrying upload and solving...')
  trackEvent.track('Plugin_SolveV9_UploadRetry', {
    messageId: props.message.id,
  })
  await startSolving()
}

/**
 * 处理 ChatGPT 来源埋点（简化版）
 */
async function handleChatGPTSolve() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY.CHATGPT_SOLVE_DATA)
    const chatgptData = result[STORAGE_KEY.CHATGPT_SOLVE_DATA]

    if (chatgptData?.model) {
      // 生成 questionId（与 useSolveV9.start 保持一致）
      const questionId = generateQuestionId()

      trackEvent.track('Plugin_ChatGPT_Solve', {
        questionId,
        model: chatgptData.model,
      })

      console.log('✅ ChatGPT 埋点上报:', { questionId, model: chatgptData.model })

      // 清理已使用的数据
      await browser.storage.local.remove(STORAGE_KEY.CHATGPT_SOLVE_DATA)
    }
  } catch (error) {
    console.error('❌ ChatGPT 埋点上报失败:', error)
  }
}

// ===== 生命周期 =====
onMounted(async () => {
  try {
    // 🎯 检查是否有预加载数据（直接渲染模式）
    const preloadedData = props.message.preloadedData
    if (preloadedData && 'components' in preloadedData) {
      // ✅ isFromPreloaded 已在 setup 阶段设置为 true
      // 🎯 初始化 useSolveV9 状态（使用原始 userContent 支持重试）
      initFromPreloaded(props.message.userContent, preloadedData)

      isDone.value = true
      emit('statusChange', MessageStatus.COMPLETED)

      // 🎯 等待 DOM 更新并滚动到正确的模型位置
      await nextTick()
      const currentIndex = requestedModels.value.findIndex((r) => r.modelId === currentModelId.value)
      if (currentIndex !== -1 && scrollContainerRef.value) {
        const containerWidth = scrollContainerRef.value.clientWidth
        // 使用 instant 行为，避免初始化时的动画
        scrollContainerRef.value.scrollTo({
          left: currentIndex * containerWidth,
          behavior: 'instant',
        })
      }

      // 🎯 传递完整数据（包括预加载的 feedback 和 imageUrl）
      emit(
        'done',
        buildDoneEventData({
          feedback: preloadedData.feedback ?? -1,
        })
      )

      return
    }

    // 🚀 正常请求模式（新解题，ThinkingBlock 会默认展开）
    // ✅ isFromPreloaded 已在 setup 阶段设置为 false
    emit('statusChange', MessageStatus.PENDING)

    // 注册取消函数
    registerCancelHandler()

    // 调用解题函数
    await startSolving()
  } catch (error) {
    console.error('❌ onMounted error:', error)
  }
})

onUnmounted(() => {
  // 清理工作
  cancelSafely()
  cancelRegistry?.unregisterCancelable(props.message.id)

  // 清理 ResizeObserver
  resizeObservers.forEach((observer) => observer.disconnect())
  resizeObservers.clear()

  slideRefs.clear()
})

// ===== 监听答案状态变化（同时监听当前模型状态和整体加载状态） =====
/**
 * 修复说明：
 * 之前只监听 answer.value.status（当前显示模型的状态），导致切换到已完成的模型时，
 * 会错误地 emit COMPLETED，导致父组件清除 cancelHandler，禁用暂停按钮。
 *
 * 现在同时监听：
 * 1. answer.value.status - 当前显示模型的状态
 * 2. isAnswerLoading - 是否有任何模型正在加载（检查所有模型）
 *
 * 只有当 status === 'done' 且 !isAnswerLoading 时，才 emit COMPLETED
 * 这确保了只有所有模型都完成时，才会禁用暂停按钮
 */
watch([() => answer.value.status, isAnswerLoading], ([status, loading]) => {
  if (status === 'done' && !loading) {
    // 当前模型已完成 且 所有模型都不在加载中
    isDone.value = true
    emit('statusChange', MessageStatus.COMPLETED)

    const info = getQuestionInfo()
    emit('solveDone', {
      questionId: info.questionId,
      answerId: info.answerId,
    })

    // 🎯 新增：传递完整数据（用于浮层存储）
    emit('done', buildDoneEventData())

    trackEvent.track('Plugin_Solve_Done', {
      messageId: props.message.id,
      componentCount: answer.value.components.length,
      modelId: info.modelId,
    })
  } else if (status === 'error') {
    emit('statusChange', MessageStatus.ERROR)
  } else if (status === 'streaming') {
    // 🎯 流式输出中，发送 RESPONDING 状态
    emit('statusChange', MessageStatus.RESPONDING)
    emit('messageUpdate')
  }
  // 注意：loading 状态不需要在 watch 中处理，因为 onMounted 已经立即发送了 PENDING
})

// 监听内容变化，自动滚动并触发尺寸更新
watch(
  () => answer.value.components,
  () => {
    // 只在流式输出或完成时滚动
    if (answer.value.status === 'streaming' || answer.value.status === 'done') {
      smartScroll()
      // 🎯 触发消息更新事件，确保浮层约束逻辑被执行（特别是在 solve layer 中）
      emit('messageUpdate')
      updateWrapperHeight(currentModelId.value)
    }
  },
  { deep: true }
)

// 监听模型切换，触发水平滚动
watch(
  currentModelId,
  async (newModelId) => {
    const index = requestedModels.value.findIndex((r) => r.modelId === newModelId)
    if (index !== -1 && scrollContainerRef.value) {
      const containerWidth = scrollContainerRef.value.clientWidth
      scrollContainerRef.value.scrollTo({
        left: index * containerWidth,
        behavior: 'smooth',
      })
    }

    await ensureHeightForCurrent(true)
  },
  { flush: 'post' } // 确保 DOM 更新后执行
)

// ===== 事件处理 =====
// 🎯 重试方法（从 AnswerContent 触发，重试当前模型）
const handleRetry = async (modelId: string) => {
  if (isAnswerLoading.value) {
    toastRef.value?.show('Let me finish first')
    return
  }
  emit('retry', modelId)
  // 如果是当前模型，清理全局 UI 状态
  if (modelId === currentModelId.value) {
    isInsufficientBalance.value = false
    isDone.value = false
    pendingCancel.value = false
    isCancelledLocally.value = false // 🛡️ 重置本地取消标志（重试前还原状态）
    emit('statusChange', MessageStatus.PENDING)
  }

  try {
    registerCancelHandler()

    // ⭐ 调用 composable 的 retry 方法（会清除旧结果并复用 switchModel 逻辑）
    await retry(modelId)

    if (modelId === currentModelId.value) {
      ensureHeightForCurrent(true)
    }
  } catch (error) {
    console.error('Retry failed:', error)
    if (modelId === currentModelId.value) {
      emit('statusChange', MessageStatus.ERROR)
    }
  }
}

const handleQuote = (content: any) => {
  // 处理引用逻辑
  // 可能需要与 useQuoteManager 交互
  trackEvent.track('Plugin_SolveV9_Quote', {
    from: content.from || 'step',
  })
}

const handleLike = async (modelId: string, isLike: boolean) => {
  const success = await like(isLike)
  if (success) {
    // 🎯 更新 modelResults Map 中的点赞状态（触发响应式更新）
    updateModelFeedback(modelId, isLike)

    trackEvent.track(isLike ? 'Plugin_Solve_panel_like' : 'Plugin_Solve_panel_dislike', {
      modelId,
    })

    // 🎯 通知反馈状态变化（触发外层缓存更新）
    if (modelId === currentModelId.value) {
      emit('feedbackChange', isLike ? 1 : 0)
    }

    // 🎯 触发 done 事件，更新浮层 messageData（包含最新状态）
    emit(
      'done',
      buildDoneEventData({
        feedback: isLike ? 1 : 0,
      })
    )
  }
}

const handleCopy = (modelId: string) => {
  const result = requestedModels.value.find((r) => r.modelId === modelId)
  if (!result) return

  const text = formatForCopy(result.answer.components)

  if (!text) return

  navigator.clipboard
    .writeText(text)
    .then(() => {
      toastRef.value?.show('Copied')
      trackEvent.track('Plugin_Solve_panel_copied', { modelId })
    })
    .catch((err) => {
      console.error('Copy failed:', err)
    })
}

const handleNoBalanceReady = () => {
  isMultiModelDisabled.value = true
}

// ===== 🎯 统一的数据构建函数 =====
/**
 * 构建完整的 done 事件数据
 * @param overrides 可选的覆盖字段
 */
function buildDoneEventData(
  overrides: Partial<{
    feedback: number
    components: any[]
  }> = {}
): any {
  const info = getQuestionInfo()

  // 统一的图片 URL 获取逻辑
  const isPhotoQuestion =
    props.message.userContent.type === QuestionType.PHOTO ||
    props.message.userContent.type === QuestionType.PAGE_SCREENSHOT_SOLVE

  // 🔧 优先从 useSolveV9 获取（包含上传后的 CDN URL）
  const imageUrl = isPhotoQuestion
    ? getImageUrl() ||
      props.message.userContent.attachments?.image?.imageUrl ||
      props.message.userContent.attachments?.pageScreenshot?.longImage ||
      props.message.userContent.value
    : undefined

  // 统一的 feedback 获取逻辑
  const currentResult = requestedModels.value.find((r) => r.modelId === currentModelId.value)
  const defaultFeedback = currentResult?.isLiked ? 1 : currentResult?.isDisliked ? 0 : -1

  // 🎯 统一的模型序列化逻辑（只序列化一次）
  const serializedModelResults = serializeModelResults()

  return {
    components: overrides.components || answer.value.components,
    questionId: info.questionId,
    answerId: info.answerId,
    feedback: overrides.feedback !== undefined ? overrides.feedback : defaultFeedback,
    imageUrl,
    modelId: currentModelId.value,
    modelResults: serializedModelResults,
  }
}

/**
 * 序列化所有模型的结果
 */
function serializeModelResults() {
  return requestedModels.value.map((r) => ({
    modelId: r.modelId,
    modelName: r.modelName,
    answerId: r.answerId,
    components: r.answer.components,
    status: r.answer.status,
    isLiked: r.isLiked || false,
    isDisliked: r.isDisliked || false,
    isStopped: r.isStopped || false,
  }))
}

// ===== 暴露给父组件的方法 =====
defineExpose({
  cancel: cancelSafely,
  retry: handleRetry,
  messageId: props.message.id,
  // 🎯 暴露多模型数据（用于浮层实时收集）
  get requestedModels() {
    return requestedModels.value
  },
  get currentModelId() {
    return currentModelId.value
  },
  getCurrentModelResult: () => requestedModels.value.find((r) => r.modelId === currentModelId.value) || null,
})
</script>

<style scoped>
.answer-contents-wrapper {
  width: 100%;
  overflow: hidden;
  transition: height 200ms ease;
}

.answer-contents-scroll {
  display: flex;
  overflow-x: hidden;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  align-items: flex-start;
}

.answer-content-slide {
  min-width: 100%;
  width: 100%;
  flex-shrink: 0;
  scroll-snap-align: start;
}
</style>
