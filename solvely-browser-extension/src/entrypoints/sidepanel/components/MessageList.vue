<template>
  <div class="relative flex-1 w-full">
    <div
      class="absolute top-0 left-0 bottom-0 right-0 overflow-y-auto p-[16px_16px_0] overflow-x-hidden text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200 scrollbar-gutter"
      ref="messageListRef"
    >
      <div
        ref="messageListInnerRef"
        class="relative"
      >
        <ExampleMessage v-if="isShowExample" />
        <Empty
          v-if="!isShowExample && messages.length === 0 && !isShowSubscriptionMessage"
          :message-store="messageStore"
        />
        <div
          v-if="messages.length > 0 || isShowSubscriptionMessage"
          class="flex flex-col gap-[20px]"
        >
          <div
            v-for="(message, index) in messages"
            :key="message.id"
            :data-message-id="message.id"
            :ref="(el) => addQuoteSelectionRef(el, index, message)"
          >
            <!-- 用户消息 -->
            <UserMessage
              v-if="message.type === MessageType.USER"
              :message="message"
            />
            <!-- 服务消息 -->
            <template v-else>
              <template v-if="message.serviceType === ServiceMessageType.ANSWER">
                <V9AnswerMessage
                  v-if="
                    !((message.userContent.attachments?.pageScreenshot?.slices?.length ?? 0) > 2) &&
                    message.userContent.type !== QuestionType.PDF_SOLVE_ALL
                  "
                  :ref="(el) => setMessageRef(el, message.id)"
                  :message="message"
                  :show-actions="index === messages.length - 1"
                  @status-change="handleStatusChange($event)(message)"
                  @solve-done="(e) => handleSolveDone(e, message)"
                  @out-of-balance="handleOutOfBalance(message)"
                  @done="(data: any) => handleMessageDone(data, message)"
                  @feedback-change="(feedback: -1 | 0 | 1) => handleFeedbackChange(message.id, feedback)"
                />
                <AnswerMessage
                  v-else
                  :message="message"
                  :message-index="index"
                  :show-actions="index === messages.length - 1"
                  :limit-check="props.messageStore.limitCheck"
                  :retry-last-message="props.messageStore.retryLastMessage"
                  :message-store="props.messageStore"
                  @status-change="handleStatusChange($event)(message)"
                  @solve-done="(e) => handleSolveDone(e, message)"
                />
              </template>
              <AskMessage
                v-else-if="message.serviceType === ServiceMessageType.ASK"
                :ref="(el) => setMessageRef(el, message.id)"
                :message="message"
                :question-id="currentQuestionInfo.questionId"
                :answer-id="currentQuestionInfo.answerId"
                :message-store="props.messageStore"
                @status-change="handleStatusChange($event)(message)"
                @done="(data) => handleMessageDone(data, message)"
              />
              <PDFSummaryAskMessage
                v-else-if="message.serviceType === ServiceMessageType.PDF_SUMMARIZE_ASK"
                :message="message"
                :message-store="messageStore"
                :session-id="message.userContent.attachments?.chatWithPdf?.sessionId"
                @status-change="handleStatusChange($event)(message)"
                @done="(data) => handleMessageDone(data, message)"
              />
              <!-- 新增对引用消息的支持 -->
              <QuoteMessage
                v-else-if="
                  message.serviceType === ServiceMessageType.QUOTE ||
                  message.serviceType === ServiceMessageType.EXPLAIN ||
                  message.serviceType === ServiceMessageType.HIGHLIGHT_CHAT
                "
                :ref="(el) => setMessageRef(el, message.id)"
                :message="message"
                :message-store="messageStore"
                @status-change="handleStatusChange($event)(message)"
                @done="(data) => handleMessageDone(data, message)"
              />
              <!-- 新增对 Summary 类型的支持 -->
              <SummaryMessage
                v-else-if="message.serviceType === ServiceMessageType.SUMMARY"
                :ref="(el) => setMessageRef(el, message.id)"
                :message="message"
                @status-change="handleStatusChange($event)(message)"
                @done="(data) => handleMessageDone(data, message)"
              />
              <PdfSummaryMessage
                v-else-if="message.serviceType === ServiceMessageType.PDF_SUMMARIZE"
                :ref="(el) => setMessageRef(el, message.id)"
                :message="message"
                @status-change="handleStatusChange($event)(message)"
                @done="(data) => handleMessageDone(data, message)"
              />
              <!-- 0.2.9版本从文件暂存框生成 Quiz 请求 -->
              <PDFQuizMessage
                v-else-if="
                  message.serviceType === ServiceMessageType.QUIZ &&
                  (message.userContent.attachments?.chatWithPdf || message.userContent.attachments?.pageScreenshot)
                "
                :message="message"
                :message-store="messageStore"
                @status-change="handleStatusChange($event)(message)"
              />
              <!-- 0.2.9版本从图片暂存框生成 Quiz 请求 -->
              <ImageQuizMessage
                v-else-if="message.serviceType === ServiceMessageType.QUIZ && message.userContent.attachments?.image"
                :message="message"
                :message-store="messageStore"
                @status-change="handleStatusChange($event)(message)"
              />

              <!-- 新增对 Selection 类型的支持 -->
              <BaseQuizMessage
                v-else-if="
                  message.serviceType === ServiceMessageType.QUIZ &&
                  (message.userContent.attachments?.page ||
                    message.userContent.attachments?.quizlet ||
                    message.userContent.attachments?.youtube ||
                    message.userContent.attachments?.selection)
                "
                :message="message"
                :config="getQuizConfig(message)"
                @status-change="handleStatusChange($event)(message)"
              />
            </template>
          </div>
          <template v-if="isShowSubscriptionMessage">
            <UserMessage :message="pendingUserMessage" />
            <SubscriptionMessage
              @ready="scrollToBottom"
              :message="pendingUserMessage"
              :auth="props.auth"
            />
          </template>
        </div>
        
        <!-- 🎯 统一的反馈组件（只绑定最后一条消息） -->
        <UnifiedMessageActions
          v-if="lastMessageInfo"
          :message-info="lastMessageInfo"
          @retry="handleRetry"
          @feedback-change="(feedback: -1 | 0 | 1) => lastMessageInfo && handleFeedbackChange(lastMessageInfo.id, feedback)"
        />
        
        <div class="h-[96px]"></div>
        <LatexSandbox />
        <!-- 将 QuoteSelection 挂在内容层容器内，绝对定位相对该容器，随内容滚动自然移动 -->
        <QuoteSelection ref="quoteSelectionRef" />
      </div>
    </div>
    <!-- to-bottom 按钮现在在滚动容器外部，固定定位 -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-200 ease-in"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <span
        v-if="showToBottom"
        @click="handleToBottomClick"
        class="to-bottom absolute bottom-[4px] left-[50%] z-[10] translate-x-[-50%] w-[32px] h-[32px] flex items-center justify-center border border-s-border dark:border-s-border-dark rounded-[12px] cursor-pointer bg-s-interface-bg dark:bg-s-interface-bg-dark text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      >
        <SvgIcon name="arrow-down3" />
      </span>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick, watch, ref, computed, inject, provide } from 'vue'
import { debounce } from 'lodash-es'
import LatexSandbox from '~/components/common/LatexSandbox.vue'
import { useQuoteSelection } from '@/composables/content/useQuoteSelection'
import UserMessage from './UserMessageBlock.vue'
import AnswerMessage from './AnswerMessage.vue'
import OldAnswerMessageV9 from './oldSolve/AnswerMessage.vue'
import AnswerMessageV9 from './solve/AnswerMessage.vue'
import AskMessage from './AskMessage.vue'
import SummaryMessage from './SummaryMessage.vue'
import BaseQuizMessage from './BaseQuizMessage.vue'
import ImageQuizMessage from './ImageQuizMessage.vue'
import PDFQuizMessage from './ChatWithPDFMessage.vue'
import UnifiedMessageActions from './UnifiedMessageActions.vue'
import { QUIZ_CONFIGS } from '../config/quizConfigs'
import useMessages from '../composables/useMessages'
import Empty from './Empty.vue'
import ExampleMessage from './ExampleMessage.vue'
import {
  UserMessage as UserMessageType,
  MessageItem,
  MessageStatus,
  MessageType,
  ServiceMessageType,
} from '../types/message'
import useAuth from '../composables/useAuth'
import useSubscription from '../composables/useSubscription'
import SubscriptionMessage from './SubscriptionMessage.vue'
import SvgIcon from '~/components/common/SvgIcon.vue'
import trackEvent from '~/utils/trackEvent'
import PdfSummaryMessage from './PdfSummaryMessage.vue'
import PDFSummaryAskMessage from './PDFSummaryAskMessage.vue'
import QuoteMessage from './QuoteMessage.vue'
import QuoteSelection from '@/components/quoteSelection/index.vue'
import { ABTestState } from '@/composables/useABTest'
import { InjectionTokens } from '@/entrypoints/sidepanel/types/token'
import { QuestionType } from '../types/question'
const abTest = inject<ABTestState>('abTest')!

const V9AnswerMessage = computed(() => {
  return abTest.isMutiModel.value ? AnswerMessageV9 : OldAnswerMessageV9
})

const messageListRef = ref<HTMLDivElement | null>(null)
const messageListInnerRef = ref<HTMLDivElement | null>(null)
const quoteSelectionRef = ref<HTMLDivElement | null>(null)

// 引用划词功能
const { registerQuoteSelectionArea, unregisterQuoteSelectionArea, setAnchorContainer } = useQuoteSelection()

// 存储所有的 quoteSelectionRef 引用
const quoteSelectionRefs = ref<Map<number, HTMLDivElement>>(new Map())
// 存储每个消息项的 rawAnswer 监听器
const rawAnswerObservers = ref<Map<number, MutationObserver>>(new Map())
// 🎯 存储消息组件的 ref（用于重试）
const messageRefs = ref<Map<string, any>>(new Map())

const props = defineProps<{
  messageStore: ReturnType<typeof useMessages>
  auth: ReturnType<typeof useAuth>
}>()

// ===== Provide cancel registry to child components =====
provide(InjectionTokens.CANCEL_REGISTRY, {
  registerCancelable: props.messageStore.registerCancelable,
  unregisterCancelable: props.messageStore.unregisterCancelable,
})

const { messages, updateServiceMessageStatus, isShowExample } = props.messageStore

// 🎯 消息数据缓存（用于 UnifiedMessageActions）TODO:以后的分页加载可能需要拓展这个缓存，目前先简单这么实现
interface MessageDataCache {
  content?: string | any[]
  components?: any[]
  questionId?: string
  answerId?: string
  sessionId?: string
  feedback: -1 | 0 | 1
  isInsufficientBalance?: boolean  // 余额不足标记
  [key: string]: any
}

const messageDataCache = ref<Map<string, MessageDataCache>>(new Map())

// 当前问题ID
const currentQuestionInfo = ref({
  questionId: '',
  answerId: '',
})

// 是否需要显示订阅消息
const isShowSubscriptionMessage = computed(() => {
  return (
    props.auth.isAuthenticated.value &&
    props.messageStore.pendingUserMessage.value &&
    !useSubscription.isSubscribed.value
  )
})

const pendingUserMessage = computed(() => {
  return props.messageStore.pendingUserMessage.value as unknown as UserMessageType
})

// 🎯 最后一条消息信息（传递给 UnifiedMessageActions）
const lastMessageInfo = computed(() => {
  if (messages.value.length === 0) return null
  const lastMsg = messages.value[messages.value.length - 1]
  if (lastMsg.type !== MessageType.SERVICE) return null
  
  const cachedData = messageDataCache.value.get(lastMsg.id)
  const serviceMsg = lastMsg as any
  
  // 🎯 排除不支持反馈的消息类型（Quiz 类型不显示反馈按钮）
  if (serviceMsg.serviceType === ServiceMessageType.QUIZ) {
    return null
  }
  
  // ⭐ 排除 V9 ANSWER 消息（V9 组件内部自己管理所有操作）
  // 判断是否是使用 V9 组件的 ANSWER 类型
  if (serviceMsg.serviceType === ServiceMessageType.ANSWER) {
    return null
  }
  
  // 🎯 只在 COMPLETED 状态时显示 UnifiedMessageActions
  // 排除 ERROR、PROBLEM_MISSING、STOP 等状态
  if (lastMsg.status !== MessageStatus.COMPLETED) {
    return null
  }
  
  // 🎯 排除余额不足且未订阅的情况
  if (cachedData?.isInsufficientBalance && !useSubscription.isSubscribed.value) {
    return null
  }
  
  // 🎯 特殊处理：ASK 类型使用 currentQuestionInfo
  let questionId = cachedData?.questionId
  let answerId = cachedData?.answerId
  
  if (serviceMsg.serviceType === ServiceMessageType.ASK) {
    questionId = currentQuestionInfo.value.questionId || cachedData?.questionId
    answerId = currentQuestionInfo.value.answerId || cachedData?.answerId
  }
  
  return {
    id: lastMsg.id,
    type: serviceMsg.serviceType,
    status: lastMsg.status,
    // 传递给 UnifiedMessageActions 的数据
    questionId,
    answerId,
    sessionId: cachedData?.sessionId || lastMsg.id,
    feedback: cachedData?.feedback ?? -1,
    // 传递消息内容（用于复制）
    content: cachedData?.content,
    components: cachedData?.components
  }
})

const handleStatusChange = (status: MessageStatus) => (message: MessageItem) => {
  if (status === MessageStatus.NO_CONTEXT) {
    props.messageStore.retryLastMessage()
    return
  }
  // if (status === MessageStatus.PROBLEM_MISSING) {
  //   props.messageStore.retryWithScreenshot()
  //   return
  // }
  updateServiceMessageStatus(message.id, status)
}

// 处理解题完成事件
const handleSolveDone = (
  event: { questionId: string; answerId: string },
  message: MessageItem
) => {
  currentQuestionInfo.value.questionId = event.questionId
  currentQuestionInfo.value.answerId = event.answerId
  props.messageStore.setDisabledStop(false)
  
  // 🎯 解题完成后刷新余额（确保缓存数据最新）
  useSubscription.refreshBalance()
}

// 🎯 处理余额不足事件
const handleOutOfBalance = (message: MessageItem) => {
  const data = messageDataCache.value.get(message.id)
  if (data) {
    data.isInsufficientBalance = true
    messageDataCache.value.set(message.id, data)
  } else {
    messageDataCache.value.set(message.id, {
      feedback: -1,
      isInsufficientBalance: true
    })
  }
}

// 🎯 处理消息 done 事件（缓存数据）
const handleMessageDone = (data: any, message: MessageItem) => {
  const messageId = message.id
  if (!messageId) return
  
  // 🎯 如果是预加载消息，保留已缓存的 feedback（可能用户已点赞点踩）
  const existingData = messageDataCache.value.get(messageId)
  const finalFeedback = existingData?.feedback ?? data.feedback ?? -1
  
  messageDataCache.value.set(messageId, {
    ...data,
    feedback: finalFeedback  // ✅ 优先使用已有的 feedback
  })
}

// 🎯 处理反馈状态变化（UnifiedMessageActions 通知）
const handleFeedbackChange = (messageId: string, feedback: -1 | 0 | 1) => {
  const data = messageDataCache.value.get(messageId)
  if (data) {
    data.feedback = feedback
    messageDataCache.value.set(messageId, data)
  }
}

// 🎯 设置消息组件 ref
const setMessageRef = (el: any, messageId: string) => {
  if (el) {
    messageRefs.value.set(messageId, el)
  } else {
    messageRefs.value.delete(messageId)
  }
}

// 🎯 处理重试事件（UnifiedMessageActions 触发）
const handleRetry = async () => {
  if (!lastMessageInfo.value) return

  // 🎯 强制刷新余额，确保数据最新
  await useSubscription.refreshBalance()
  
  // 检查余额
  if (!(await useSubscription.limitCheck())) {
    props.messageStore.showOutLimit(true, 'Retry')
    return
  }
  
  // 🔧 重置反馈状态，确保重试后显示未操作状态
  messageDataCache.value.delete(lastMessageInfo.value.id)
  
  // 调用组件的 retry 方法
  const componentRef = messageRefs.value.get(lastMessageInfo.value.id)
  if (componentRef?.retry) componentRef.retry()
}

// 🎯 添加预加载消息（浮层流转时使用）
// ⚠️ 关键：必须在 push 之后立即缓存，因为 Vue 渲染是异步的
// 如果不提前缓存，lastMessageInfo computed 会读取不到数据，导致 UnifiedMessageActions 不显示
const addPreloadedMessage = (serviceMessage: any) => {
  if (!serviceMessage.preloadedData) return
  
  const preloadedData = serviceMessage.preloadedData
  
  messageDataCache.value.set(serviceMessage.id, {
    content: preloadedData.content,
    components: preloadedData.components,
    questionId: preloadedData.questionId,
    answerId: preloadedData.answerId,
    sessionId: preloadedData.sessionId || serviceMessage.id,
    feedback: preloadedData.feedback ?? -1,  // ✅ 恢复点赞点踩状态
  })
}

// 🎯 暴露给外部（App.vue 调用）
defineExpose({
  addPreloadedMessage
})

// 同步 aa 容器上的 data-raw-answer（从子树复制上来）
const syncRawAnswerAttribute = (el: HTMLDivElement) => {
  // 优先使用 message 元数据聚合答案，剔除 thinking（与 StepBlock 一致）
  const idxAttr = el.getAttribute('data-message-id')
  let raw = ''
  try {
    // 从子树尝试读取
    const node = (el.matches('[data-raw-answer]') ? el : el.querySelector('[data-raw-answer]')) as HTMLElement | null
    raw = node?.getAttribute('data-raw-answer') || ''
  } catch {}
  // 若子树无，则保持空，由 useQuoteSelection 在 meta 中二次兜底
  if (raw && raw.trim()) {
    el.setAttribute('data-raw-answer', raw.trim())
  } else {
    el.removeAttribute('data-raw-answer')
  }
}

// 计算并写入用户文本到容器属性（与 StepBlock 规则一致）
const writeUserTextAttribute = (el: HTMLDivElement, message: MessageItem) => {
  if (message.type !== MessageType.USER) {
    el.removeAttribute('data-user-text')
    return
  }
  try {
    const prompt = (message as any)?.content?.prompt
    const type = (message as any)?.content?.type
    const value = (message as any)?.content?.value
    let text = ''
    if (typeof prompt === 'string' && prompt.trim()) text += prompt.trim()
    if (
      (type === 'text' || type === 'text_solve' || type === 'selection') &&
      typeof value === 'string' &&
      value.trim()
    ) {
      if (text) text += '\n'
      text += value.trim()
    }
    text = text.trim()
    if (text) el.setAttribute('data-user-text', text)
    else el.removeAttribute('data-user-text')
  } catch {
    el.removeAttribute('data-user-text')
  }
}

// 添加引用管理方法
const addQuoteSelectionRef = (el: any, index: number, message: MessageItem) => {
  if (el && el instanceof HTMLDivElement) {
    // 如果已经存在相同索引的引用，先注销旧的
    const oldEl = quoteSelectionRefs.value.get(index)
    if (oldEl && oldEl !== el) {
      unregisterQuoteSelectionArea(oldEl)
      console.log(`注销旧划词区域 ${index}:`, oldEl)
      // 断开旧的 rawAnswer 监听器
      const oldObs = rawAnswerObservers.value.get(index)
      if (oldObs) {
        oldObs.disconnect()
        rawAnswerObservers.value.delete(index)
      }
    }

    quoteSelectionRefs.value.set(index, el)
    // 注册时传入 aa 元信息：index 与 message
    registerQuoteSelectionArea(el, index, message)

    // 写入用户文本属性
    writeUserTextAttribute(el, message)

    // 初次同步 data-raw-answer
    syncRawAnswerAttribute(el)

    // 建立 child -> container 的 data-raw-answer 监听
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-raw-answer') {
          syncRawAnswerAttribute(el)
        }
      }
    })
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['data-raw-answer'],
      subtree: true,
    })
    rawAnswerObservers.value.set(index, observer)
  }
}

// 根据消息类型动态获取quiz配置
const getQuizConfig = (message: MessageItem) => {
  const quizMessage = message as any
  if (quizMessage.userContent.attachments?.page) {
    return QUIZ_CONFIGS.text
  }
  if (quizMessage.userContent.attachments?.selection) {
    return QUIZ_CONFIGS.selection
  }
  if (quizMessage.userContent.attachments?.quizlet) {
    return QUIZ_CONFIGS.quizlet
  }
  if (quizMessage.userContent.attachments?.youtube) {
    return QUIZ_CONFIGS.youtube
  }
  return QUIZ_CONFIGS.text
}

// 优化后的滚动函数
// messageId 参数：如果提供，滚动到指定消息顶部；如果不提供，滚动到底部
const scrollToBottom = async (messageId?: string) => {
  await nextTick()
  if (!messageListRef.value) return

  if (messageId) {
    // 滚动到指定消息顶部，保留 20px gap
    const messageElement = messageListRef.value.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement

    if (messageElement) {
      messageListRef.value.scrollTo({
        top: Math.max(0, messageElement.offsetTop - 20),
        behavior: 'smooth',
      })
    } else {
      // 如果找不到指定消息，降级到滚动底部
      messageListRef.value.scrollTo({
        top: messageListRef.value.scrollHeight,
        behavior: 'smooth',
      })
    }
  } else {
    // 滚动到底部（新消息、组件挂载等场景）
    messageListRef.value.scrollTo({
      top: messageListRef.value.scrollHeight,
      behavior: 'smooth',
    })
  }
}

// 控制 to-bottom 按钮显示状态
const showToBottom = ref(false)

// 检测滚动位置
const checkScrollPosition = () => {
  if (!messageListRef.value || !messageListInnerRef.value) return

  const { scrollTop, clientHeight } = messageListRef.value
  const distanceFromBottom = messageListInnerRef.value.clientHeight - clientHeight - scrollTop

  // 当距离底部超过 80px 时显示按钮
  showToBottom.value = clientHeight > 100 && distanceFromBottom > 80
}

// 防抖的滚动检测
const debouncedCheckScrollPosition = debounce(checkScrollPosition, 300)

// 处理点击 to-bottom 按钮
const handleToBottomClick = () => {
  if (!messageListRef.value) return

  messageListRef.value.scrollTo({
    top: messageListRef.value.scrollHeight,
    behavior: 'smooth',
  })

  trackEvent.track('Plugin_Sidebar_Scrolldown_Click')
}

watch(
  () => messages.value.length,
  () => {
    // 新消息添加时滚动到底部
    scrollToBottom()
  }
)

onMounted(() => {
  // 组件挂载时滚动到底部
  scrollToBottom()

  // 设置静态锚点容器为内容层容器，使工具条相对其定位并随内容自然滚动
  if (messageListInnerRef.value) {
    setAnchorContainer(messageListInnerRef.value)
  }

  // 添加滚动事件监听器
  if (messageListRef.value) {
    messageListRef.value.addEventListener('scroll', debouncedCheckScrollPosition)
    // 初始检查滚动位置
    checkScrollPosition()
  }
})

onUnmounted(() => {
  // 清理锚点容器
  setAnchorContainer(null as unknown as HTMLElement)
  // 移除滚动事件监听器
  if (messageListRef.value) {
    messageListRef.value.removeEventListener('scroll', debouncedCheckScrollPosition)
  }
  // 断开所有 rawAnswer 监听器
  rawAnswerObservers.value.forEach((obs) => obs.disconnect())
  rawAnswerObservers.value.clear()
})
</script>

<style scoped>
.scrollbar-gutter {
  scrollbar-gutter: stable;
}
</style>
