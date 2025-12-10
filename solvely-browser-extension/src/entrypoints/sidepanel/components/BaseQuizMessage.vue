<template>
  <div class="flex flex-col gap-[24px]">
    <!-- 加载状态 -->
    <div
      v-if="status === MessageStatus.PENDING"
      class="flex flex-row items-center justify-start gap-[8px] text-s-text-brand dark:text-s-text-brand-dark text-[14px] leading-[150%] transition-colors duration-200"
    >
      <Vue3Lottie
        :animation-data="isDark ? loadingAnimationDark : loadingAnimation"
        :width="20"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{ margin: 0, height: '20px' }"
      />
      Uploading
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-s-function-erro dark:text-s-function-erro-dark transition-colors duration-200">
        {{ ErrorMessage[errorType as ErrorType] }}
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
        :href="quizUrl"
        target="_blank"
        @click="handleLinkClick"
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
      <br />
      <a
        :href="quizUrl"
        target="_blank"
        @click="handleLinkClick"
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
import { ref, onMounted, onUnmounted, inject, watch } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { ErrorMessage, ErrorType, MessageStatus, QuizMessage } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import defaultCache from '../utils/cache'
import SidepanelEventType from '../types/eventTypes'
import type { QuizConfig } from '../config/quizConfigs'
import { Vue3Lottie } from 'vue3-lottie'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import { createFlashcardsDeck } from '@/api'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'
import { useMessageScroll } from '../composables/useMessageScroll'

const { isDark } = useDarkMode()

const showOutLimit = inject<(show: boolean, from: string) => void>('showOutLimit')!

// 常量定义
const MIN_QUIZ_TEXT_LENGTH = 20 // 最小文本长度（与 useTextSelection 保持一致）

const props = withDefaults(
  defineProps<{
    message: QuizMessage
    config: QuizConfig
    showActions?: boolean
    useScroll?: boolean
  }>(),
  {
    useScroll: true,
  }
)

// 使用 inject 获取 cancelRegistry（可选，layer 环境可能没有）
const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'messageUpdate'): void
  // 新增：完成时传递数据
  (e: 'done', data: { quizUrl: string }): void
}>()

// 组件状态
const status = ref<MessageStatus>(MessageStatus.PENDING)
const errorType = ref<ErrorType | null>(null)
const quizUrl = ref<string>('')
const isStopped = ref<boolean>(false)

// 使用滚动管理（根据 props 决定）
const { smartScroll } = props.useScroll ? useMessageScroll(props.message.id) : { smartScroll: () => {} }

// 构建quiz链接
function buildQuizUrl(deckId: string): string {
  return `${import.meta.env.VITE_SOLVELY_URL}/quiz/info/${deckId}`
}

function handleDone(currentStatus: MessageStatus, error?: ErrorType) {
  // 🔒 最高优先级：如果已经是 STOP 状态，不允许被覆盖（除非是重试）
  if (isStopped.value && currentStatus !== MessageStatus.PENDING) {
    console.log('[BaseQuizMessage] 已停止，忽略状态更新:', currentStatus)
    return
  }

  if (error) {
    errorType.value = error
  }
  status.value = currentStatus

  // 🎯 新增：完成时传递数据
  if (currentStatus === MessageStatus.COMPLETED && quizUrl.value) {
    emit('done', { quizUrl: quizUrl.value })
  }

  // 发送tab消息（仅Quizlet类型）
  if (props.config.shouldSendTabMessage) {
    const attachment = getAttachment() as any
    const tabId = attachment?.tabId
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: error ? SidepanelEventType.GENERATE_QUIZ_FAIL : SidepanelEventType.GENERATE_QUIZ_SUCCESS,
      })
    }
  }

  emit('statusChange', currentStatus)
  emit('messageUpdate')
}

// 获取对应的attachment
function getAttachment() {
  return props.message.userContent.attachments?.[props.config.attachmentKey]
}

// 简单的哈希函数，用于缓存键生成
function simpleHash(str: string): string {
  if (str.length === 0) return '0'

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 转换为32位整数
  }
  return Math.abs(hash).toString(36) // 使用36进制，更短且可读
}

function getCacheKey(attachment: any, config: any): string {
  if (config.attachmentKey === 'selection' && attachment.content) {
    return simpleHash(attachment.content)
  }
  // page quiz场景下打印url
  if (config.attachmentKey === 'page') {
    console.log('[BaseQuizMessage] page quiz attachment.url:', attachment.url)
  }
  return attachment.url
}

// 超时定时器 ID
let timeoutId: number | null = null

/**
 * 检查文本内容是否太短
 * @returns true: 太短，false: 正常
 */
function checkIfTextTooShort(): boolean {
  const attachment = getAttachment()
  if (!attachment) {
    return false
  }

  // 只有 selection 和 text 类型有 content 字段
  if ('content' in attachment && typeof attachment.content === 'string') {
    return attachment.content.length < MIN_QUIZ_TEXT_LENGTH
  }

  // quizlet 和 youtube 类型没有 content，不需要检查
  return false
}

async function createQuiz() {
  try {
    // 检查是否已被停止
    if (isStopped.value) {
      return
    }

    const attachment = getAttachment()
    if (!attachment) {
      handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
      return
    }

    // 🔍 内部检查文本长度（替代外部传入的 isTooFewError）
    if (checkIfTextTooShort()) {
      trackEvent.track(`${props.config.eventPrefix}_error`, {
        errorType: ErrorType.WORDS_TOO_FEW,
      })
      handleDone(MessageStatus.ERROR, ErrorType.WORDS_TOO_FEW)
      return
    }

    trackEvent.track('Plugin_sidebar_BaseQuizMessage_create_quiz_start')

    // 🕐 启动 30 秒超时检测
    timeoutId = window.setTimeout(() => {
      // 30 秒后检查：如果还是 PENDING 状态且未停止，标记为网络错误
      if (status.value === MessageStatus.PENDING && !isStopped.value) {
        console.warn('[BaseQuizMessage] 请求超时 30 秒')
        handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
        trackEvent.track(`${props.config.eventPrefix}_error`, {
          errorType: 'TIMEOUT',
        })
      }
    }, 30000)

    try {
      const resource = props.config.resourceBuilder(attachment)

      // 使用 API（自动获取 idToken + 智能转发）
      const data = await createFlashcardsDeck({
        name: attachment.title?.slice(0, 64) || 'Untitled deck',
        style: '{"color":"#975EF9"}',
        resources: [resource],
      })

      // ✅ 请求成功，清除超时定时器
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // 检查是否被停止
      if (isStopped.value) {
        return
      }

      if (data?.errors?.[0]?.detail === 'EXCEED_LIMIT') {
        handleDone(MessageStatus.ERROR, ErrorType.QUIZ_EXCEED_LIMIT)
        trackEvent.track(`${props.config.eventPrefix}_error`, {
          errorType: ErrorType.QUIZ_EXCEED_LIMIT,
        })
        return
      }

      if (data?.message === ErrorType.NO_FC_SUBSCRIPTION_PLAN) {
        showOutLimit(true, ErrorType.NO_FC_SUBSCRIPTION_PLAN)
        handleDone(MessageStatus.ERROR, ErrorType.NO_FC_SUBSCRIPTION_PLAN)
        return
      }

      if (data.data.id) {
        quizUrl.value = buildQuizUrl(data.data.id)
        handleDone(MessageStatus.COMPLETED)
        // 设置缓存
        const cacheKey = getCacheKey(attachment, props.config)
        if (props.config.attachmentKey === 'page') {
          console.log('[BaseQuizMessage] page quiz set cacheKey:', cacheKey)
        }
        defaultCache.set(cacheKey, quizUrl.value)
        trackEvent.track(`${props.config.eventPrefix}_success`, {
          quizUrl: quizUrl.value,
        })
      } else {
        handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
        trackEvent.track(`${props.config.eventPrefix}_error`, {
          errorType: ErrorType.NETWORK_ERROR,
        })
      }
    } catch (error) {
      // ❌ 请求失败，清除超时定时器
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // 如果已经停止，忽略错误（不更新状态）
      if (isStopped.value) {
        console.log('[BaseQuizMessage] 已停止，忽略错误')
        return
      }

      console.error('BaseQuizMessage createQuiz error===:', error)
      handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
      trackEvent.track(`${props.config.eventPrefix}_error`, {
        errorType: ErrorType.NETWORK_ERROR,
      })
    }
  } catch (error) {
    // 如果已经停止，忽略错误
    if (isStopped.value) {
      return
    }
    handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
  }
}

// 处理链接点击
const handleLinkClick = () => {
  trackEvent.track('Plugin_Quiz_Link_Clicked')
}

const handleRetry = () => {
  // 清除旧的超时定时器
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
    timeoutId = null
  }

  // 重置状态
  status.value = MessageStatus.PENDING
  quizUrl.value = ''
  errorType.value = null
  isStopped.value = false // 🔓 重置停止标志，允许更新状态

  emit('statusChange', MessageStatus.PENDING)
  createQuiz()
  registerCancelHandler()
}

// 检查缓存并设置状态
function checkCacheAndSetStatus(): boolean {
  const attachment = getAttachment()
  if (!attachment) {
    return false
  }
  const cacheKey = getCacheKey(attachment, props.config)
  if (props.config.attachmentKey === 'page') {
    console.log('[BaseQuizMessage] page quiz cacheKey:', cacheKey)
  }
  const cachedQuizUrl = defaultCache.get(cacheKey)
  if (cachedQuizUrl && typeof cachedQuizUrl === 'string') {
    quizUrl.value = cachedQuizUrl
    status.value = MessageStatus.CACHED
    emit('statusChange', MessageStatus.COMPLETED)
    // 发送成功事件（仅Quizlet类型）
    if (props.config.shouldSendRuntimeMessage) {
      browser.runtime.sendMessage({
        type: SidepanelEventType.GENERATE_QUIZ_SUCCESS,
        data: {
          url: attachment.url,
        },
      })
    }

    return true
  }
  return false
}

// 注册取消句柄
const registerCancelHandler = () => {
  const cancel = async () => {
    // 🛑 设置停止状态（最高优先级）
    isStopped.value = true
    status.value = MessageStatus.STOP

    // 清除超时定时器
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    emit('statusChange', MessageStatus.STOP)
    emit('messageUpdate')

    // 注意：由于没有 AbortController，无法真正取消后台请求，但前端状态已更新
  }
  // 使用 inject 的 cancelRegistry，如果没有则忽略
  cancelRegistry?.registerCancelable(props.message.id, cancel)
}

// 监听状态变化，自动滚动（与 AnswerMessage 对齐）
watch(
  () => status.value,
  (newStatus) => {
    // 只在完成或缓存状态时滚动
    if (
      newStatus === MessageStatus.PENDING ||
      newStatus === MessageStatus.COMPLETED ||
      newStatus === MessageStatus.CACHED
    ) {
      smartScroll()
      emit('messageUpdate')
    }
  }
)

// 组件挂载时开始创建quiz
onMounted(() => {
  // 🎯 检查是否有预加载数据（直接渲染模式）
  const preloadedData = props.message.preloadedData
  if (preloadedData && 'quizUrl' in preloadedData) {
    quizUrl.value = preloadedData.quizUrl
    status.value = MessageStatus.COMPLETED
    emit('statusChange', MessageStatus.COMPLETED)
    return
  }

  // 🚀 正常请求模式
  // 🎯 立即发送 PENDING 状态
  emit('statusChange', MessageStatus.PENDING)

  const attachment = getAttachment()

  if (attachment) {
    // 先检查缓存
    if (!checkCacheAndSetStatus()) {
      // 缓存不存在，执行创建quiz（内部会检查文本长度）
      registerCancelHandler()
      createQuiz()
    }
  } else {
    trackEvent.track(`${props.config.eventPrefix}_error`, {
      errorType: ErrorType.NETWORK_ERROR,
    })
    handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
  }

  trackEvent.track(`${props.config.eventPrefix}_mounted`)
})

// 组件卸载时清理
onUnmounted(() => {
  // 标记为停止（避免后续异步操作更新已销毁的组件）
  isStopped.value = true

  // 清除超时定时器
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
    timeoutId = null
  }

  // 使用 inject 的 cancelRegistry，如果没有则忽略
  cancelRegistry?.unregisterCancelable(props.message.id)
})
</script>
