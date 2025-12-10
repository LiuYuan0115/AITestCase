<template>
  <div
    ref="messageContainerRef"
    class="mt-4 w-full relative"
  >
    <!-- 🔴 未登录状态：显示假的解题背景和登录按钮 -->
    <NoLoginLayerSolution
      v-if="showNoLogin"
      @login-click="handleLoginClick"
    />

    <!-- 🔵 ANSWER：Solve/截图Chat（V9） -->
    <Answer
      v-else-if="message.serviceType === ServiceMessageType.ANSWER"
      ref="messageComponentRef"
      :message="message"
      :use-scroll="false"
      :show-actions="true"
      @status-change="handleStatusChange"
      @out-of-balance="handleOutOfBalance"
      @message-update="handleMessageUpdate"
      @done="handleMessageDone"
      @feedback-change="handleFeedbackChange"
      @retry="handleAnswerRetry"
    />

    <!-- 🟡 QUIZ：截图 -->
    <ImageQuiz
      v-else-if="message.serviceType === ServiceMessageType.QUIZ && isScreenshot"
      ref="messageComponentRef"
      :message="message"
      :upload-promise="uploadPromise"
      :use-scroll="false"
      @status-change="handleStatusChange"
      @message-update="handleMessageUpdate"
      @done="handleMessageDone"
    />

    <!-- 🟡 QUIZ：划词 -->
    <BaseQuiz
      v-else-if="message.serviceType === ServiceMessageType.QUIZ"
      ref="messageComponentRef"
      :message="message"
      :config="quizConfig"
      :use-scroll="false"
      @status-change="handleStatusChange"
      @message-update="handleMessageUpdate"
      @done="handleMessageDone"
    />

    <!-- 🟢 PDF_SUMMARIZE：截图总结 -->
    <PdfSummary
      v-else-if="message.serviceType === ServiceMessageType.PDF_SUMMARIZE"
      ref="messageComponentRef"
      :message="message"
      :upload-promise="uploadPromise"
      :use-scroll="false"
      @status-change="handleStatusChange"
      @message-update="handleMessageUpdate"
      @done="handleMessageDone"
    />

    <!-- 🟢 SUMMARY：划词总结 -->
    <Summary
      v-else-if="message.serviceType === ServiceMessageType.SUMMARY"
      ref="messageComponentRef"
      :message="message"
      :use-scroll="false"
      @status-change="handleStatusChange"
      @message-update="handleMessageUpdate"
      @done="handleMessageDone"
    />

    <!-- 🟣 EXPLAIN/HIGHLIGHT_CHAT：划词对话/解释 -->
    <Quote
      v-else
      ref="messageComponentRef"
      :message="message"
      :use-scroll="false"
      @status-change="handleStatusChange"
      @message-update="handleMessageUpdate"
      @done="handleMessageDone"
    />

    <!-- 🎯 统一的反馈组件 -->
    <!-- 只在成功完成时显示，排除错误状态、Quiz 类型和 Answer 类型（Answer 内部自己管理） -->
    <Actions
      v-if="
        messageData &&
        messageData.status === MessageStatus.COMPLETED &&
        message.serviceType !== ServiceMessageType.QUIZ &&
        message.serviceType !== ServiceMessageType.ANSWER
      "
      :message-info="{
        id: messageId,
        type: message.serviceType,
        status: messageData.status,
        questionId: messageData.questionId,
        answerId: messageData.answerId,
        sessionId: messageData.sessionId || messageId,
        content: messageData.content,
        components: messageData.components,
        feedback: messageData.feedback,
      }"
      @retry="handleRetry"
      @feedback-change="handleFeedbackChange"
    />

    <!-- 🎯 Quote Selection 组件（支持划词引用） -->
    <QuoteSelection
      v-if="isSidePanelSupported()"
      ref="quoteSelectionRef"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { AnswerMessage as Answer } from '@/entrypoints/sidepanel/components/solve'
import Quote from '@/entrypoints/sidepanel/components/QuoteMessage.vue'
import Summary from '@/entrypoints/sidepanel/components/SummaryMessage.vue'
import PdfSummary from '@/entrypoints/sidepanel/components/PdfSummaryMessage.vue'
import BaseQuiz from '@/entrypoints/sidepanel/components/BaseQuizMessage.vue'
import ImageQuiz from '@/entrypoints/sidepanel/components/ImageQuizMessage.vue'
import Actions from '@/entrypoints/sidepanel/components/UnifiedMessageActions.vue'
import QuoteSelection from '@/components/quoteSelection/index.vue'
import NoLoginLayerSolution from './NoLoginLayerSolution.vue'
import { ServiceMessageType, MessageStatus } from '@/entrypoints/sidepanel/types/message'
import type { LayerUploadResult } from '@/utils/layerImageUploader'
import {
  buildLayerMessage,
  buildConversationData,
  type ConversationData,
  type LayerData,
} from '@/utils/layerConversationBuilder'
import { useQuoteSelection } from '@/composables/content/useQuoteSelection'
import { getTrpc } from '@/lib/trpc/client'
import EVENT from '@/utils/event'
import { isSidePanelSupported } from '@/utils/common'

interface Props {
  layerType: string
  layerData: {
    userInput?: string
    selectionText?: string
    fullText?: string
    base64?: string
    pageUrl?: string
    uploadPromise?: Promise<LayerUploadResult> // 新增
  }
}

const subscription = inject<any>('subscription')
const unlockHeightLock = inject<() => void>('unlockHeightLock', () => {})
const showOutLimit = inject<any>('showOutLimit')
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'messageUpdate'): void
  // 新增：消息数据就绪（直接传递完整的 conversationData）
  (e: 'conversationDataReady', conversationData: ConversationData): void
}>()

// 🎯 消息数据缓存（存储 done 事件的数据）
interface MessageDataCache {
  content?: string | any[]
  components?: any[]
  questionId?: string
  answerId?: string
  sessionId?: string
  feedback: -1 | 0 | 1
  status: MessageStatus
  modelId?: string // 🎯 当前显示的模型 ID
  modelResults?: any[] // 🎯 所有模型的结果（用于多模型恢复）
  [key: string]: any
}

const messageData = ref<MessageDataCache | null>(null)

// 🎯 子组件 ref（用于调用 retry 方法）
const messageComponentRef = ref<any>(null)

// 🎯 Quote 功能相关
const messageContainerRef = ref<HTMLElement | null>(null)
const quoteSelectionRef = ref<any>(null)
const { registerQuoteSelectionArea, unregisterQuoteSelectionArea, setAnchorContainer } = useQuoteSelection()

// 🎯 登录状态管理
const showNoLogin = ref(false)
const subscriptionLoaded = ref(false)
const userLoaded = ref(false)

// 判断是否为截图数据（有 base64）
const isScreenshot = computed(() => !!props.layerData.base64)

// 🔧 生成唯一且稳定的 messageId（只生成一次）
const messageId = ref(crypto.randomUUID())

// 构建完整的 message 对象（只构建一次，固定 timestamp）
const message = ref(buildLayerMessage(props.layerType, props.layerData as LayerData, messageId.value)) as any

// 🎨 组件辅助数据 uploadPromise（ImageQuizMessage 和 PdfSummaryMessage 需要）
const uploadPromise = computed(() => props.layerData.uploadPromise)

// BaseQuizMessage 配置
const quizConfig = {
  type: 'TXT' as const,
  attachmentKey: 'selection' as const,
  shouldSendTabMessage: false,
  shouldSendRuntimeMessage: false,
  eventPrefix: 'Plugin_Layer_Quiz',
  resourceBuilder: (attachment: any) => ({
    type: 'TXT',
    name: '',
    url: '',
    contentText: attachment.content || '',
  }),
}

// 🎬 事件处理
const handleStatusChange = (status: MessageStatus) => {
  // 更新缓存中的状态
  if (messageData.value) {
    messageData.value.status = status
  }
  emit('statusChange', status)
}

const handleMessageUpdate = () => {
  emit('messageUpdate')
}

const handleOutOfBalance = (source: string) => {
  console.log('[Layer] Out of balance:', source)
}

// 🎯 处理子组件的 done 事件
const handleMessageDone = (apiResponse: any) => {
  // 🎯 全量更新消息数据（V9 组件每次 done 都会传递完整的 modelResults）
  messageData.value = {
    ...apiResponse,
    feedback: apiResponse.feedback ?? -1,
    status: MessageStatus.COMPLETED,
    // 🔧 保存图片 CDN URL（用于侧栏重试，只在有值时才传递）
    ...(apiResponse.imageUrl || apiResponse.cdnUrl ? { imageUrl: apiResponse.imageUrl || apiResponse.cdnUrl } : {}),
    // 🔧 保存 PDF URL（用于 PDF Summary 侧栏重试，只在有值时才传递）
    ...(apiResponse.pdfUrl ? { pdfUrl: apiResponse.pdfUrl } : {}),
    // 🎯 保存多模型数据（V9 组件会传递完整的 modelResults 数组）
    ...(apiResponse.modelId ? { modelId: apiResponse.modelId } : {}),
    ...(apiResponse.modelResults ? { modelResults: apiResponse.modelResults } : {}),
  }
  subscription.refreshBalance()
}

// 🎯 获取对话数据（流转到侧边栏时调用）
const getConversationData = (): ConversationData | null => {
  if (!messageData.value) return null

  // ✅ 直接使用 messageData（done 事件已经传递了完整数据）
  // 注意：需要剔除 status 字段，buildConversationData 会自己设置
  const { status, ...apiData } = messageData.value
  const conversationData = buildConversationData(message.value, apiData)
  return conversationData
}

// 🎯 暴露给父组件（暴露整个 ref，让父组件能拿到最新值）
defineExpose({
  getConversationData,
  get messageData() {
    return messageData.value
  },
  get showNoLogin() {
    return showNoLogin.value
  },
})

// 🎯 处理反馈状态变化
const handleFeedbackChange = (feedback: -1 | 0 | 1) => {
  if (!messageData.value) return

  // 更新顶层 feedback
  messageData.value.feedback = feedback

  // 🎯 如果有多模型数据，同步更新当前模型的点赞状态
  if (messageData.value.modelResults && messageData.value.modelId) {
    const currentModel = messageData.value.modelResults.find((r: any) => r.modelId === messageData.value!.modelId)
    if (currentModel) {
      currentModel.isLiked = feedback === 1
      currentModel.isDisliked = feedback === 0
    }
  }
}

// 🎯 检查登录状态
const checkLoginStatus = async () => {
  try {
    const loginStatus = await getTrpc().isLogin.query()
    // 如果未登录且是 ANSWER 类型，显示未登录界面
    showNoLogin.value = !loginStatus && message.value.serviceType === ServiceMessageType.ANSWER
  } catch (error) {
    console.error('[Layer] Failed to check login status:', error)
    showNoLogin.value = false
  }
}

// 🎯 处理登录按钮点击
const handleLoginClick = async () => await getTrpc().goToLogin.query()

// 🎯 监听登录状态变化，继续执行未完成的解题流程
const handleLoginStatusChange = (message: any) => {
  if (message.type !== EVENT.SOLVELY_DATA_SYNC || !showNoLogin.value) {
    return
  }

  // 解题流程依赖从主站同步过来的两个请求数据
  if (message.api === '/user') {
    userLoaded.value = true
    if (subscriptionLoaded.value) {
      continueSolving()
    }
  } else if (message.api === '/pricing/subscription') {
    subscriptionLoaded.value = true
    if (userLoaded.value) {
      continueSolving()
    }
  }
}

// 🎯 登录成功后继续解题
const continueSolving = async () => {
  try {
    // 重新检查登录状态
    const loginStatus = await getTrpc().isLogin.query()
    if (loginStatus) {
      showNoLogin.value = false
      // 重置状态
      userLoaded.value = false
      subscriptionLoaded.value = false
      // Answer 组件会自动开始解题
    }
  } catch (error) {
    console.error('[Layer] Failed to continue solving:', error)
  }
}

// 🎯 注册划词区域
onMounted(async () => {
  try {
    // 检查登录状态
    await checkLoginStatus()

    // 添加消息监听器（监听登录回调）
    browser.runtime.onMessage.addListener(handleLoginStatusChange)

    // 等待 DOM 完全渲染
    await nextTick()

    if (messageContainerRef.value && isSidePanelSupported()) {
      // 传入伪 message 对象（只需要 type 字段）
      registerQuoteSelectionArea(messageContainerRef.value, 0, { type: 'service' })
      setAnchorContainer(messageContainerRef.value)
    }
  } catch (error) {
    console.error('[Layer] Failed to register quote selection area:', error)
  }
})

// 🎯 注销划词区域
onUnmounted(() => {
  try {
    // 移除消息监听器
    browser.runtime.onMessage.removeListener(handleLoginStatusChange)

    if (messageContainerRef.value && isSidePanelSupported()) {
      unregisterQuoteSelectionArea(messageContainerRef.value)
      setAnchorContainer(null)
    }
  } catch (error) {
    console.error('[Layer] Failed to unregister quote selection area:', error)
  }
})

// 🎯 处理重试（调用子组件的 retry 方法）
const handleRetry = async () => {
  // 非 V9 组件重试时解除高度锁（解锁条件 2）
  try {
    unlockHeightLock()
  } catch {}
  // 🎯 强制刷新余额，确保数据最新
  await subscription.refreshBalance()

  // 检查余额，如果没有余额，则不重试
  if (!(await subscription.limitCheck())) {
    showOutLimit(true, 'Retry')
    return
  }

  // 🔧 完全重置 messageData，确保子组件完成时传递的是全新数据
  messageData.value = null

  // 调用子组件的 retry 方法
  if (messageComponentRef.value?.retry) {
    messageComponentRef.value.retry()
  }
}

const handleAnswerRetry = (modelId: string) => {
  console.log('[Layer] handleAnswerRetry', modelId)
  try {
    unlockHeightLock()
  } catch {}
}
</script>
