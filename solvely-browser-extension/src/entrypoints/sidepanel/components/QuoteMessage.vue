<template>
  <div>
    <!-- 状态展示区 -->
    <div v-if="status === MessageStatus.PENDING" class="pb-[20px] w-8">
      <Vue3Lottie
        :animation-data="isDark ? loadingPromptDark : loadingPrompt"
        :width="32"
        :height="32"
        :loop="true"
        :autoplay="true"
        :style="{ margin: '-4px', height: '32px' }"
      />
    </div>

    <!-- 内容展示区 -->
    <div
      v-else-if="
        status === MessageStatus.RESPONDING ||
        status === MessageStatus.COMPLETED ||
        status === MessageStatus.STOP
      "
    >
      <div
        class="text-[14px] leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      >
        <LatexFormat v-if="content" :text="content" />
      </div>

    </div>

    <!-- Stop 状态 -->
    <div
      v-if="status === MessageStatus.STOP"
      class="text-[14px] leading-[140%] text-[#989B9E]"
    >
      You stopped this response
    </div>

    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-[#F30A34]">
        {{ errorMessage }}
      </div>
      <div
        class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk cursor-pointer"
        @click="handleRetry"
      >
        <SvgIcon name="try-again" size="20" />
        <span>Try again</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue'
import { useMessageScroll } from '../composables/useMessageScroll'
import LatexFormat from '@/components/common/LatexFormat.vue'
import { MessageStatus } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import { Vue3Lottie } from 'vue3-lottie'
import { ServiceMessageType } from '../types/message'
import loadingPrompt from '@/assets/animations/loading-prompt.json'
import loadingPromptDark from '@/assets/animations/loading-prompt-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import { fetchStream } from '@/utils/fetchStream'
import { getTrpc } from '@/lib/trpc/client'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'
import { getPluginUuid } from '~/utils/pluginUuid'
import { useLanguage } from '@/composables/useLanguage'


const { isDark } = useDarkMode()
const { currentLanguage } = useLanguage()

const errorMessage = ref('')

// Props 定义
interface Props {
  message: any
  useScroll?: boolean // 是否使用滚动管理，默认 true
}

const props = withDefaults(defineProps<Props>(), {
  useScroll: true
})

// Emits 定义
const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'contentUpdate', content: string): void
  (e: 'messageUpdate'): void
  // 新增：完成时传递数据
  (e: 'done', data: { content: string; feedback: number }): void
}>()

const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

// 组件状态
const status = ref<MessageStatus>(MessageStatus.PENDING)
const content = ref('')
const hasTrackedSuccess = ref(false) // 防止重复埋点

// 使用滚动管理（根据 props 决定）
const { smartScroll } = props.useScroll 
  ? useMessageScroll(props.message.id) 
  : { smartScroll: () => {} }

// 保存当前流取消函数
let cancelStream: null | (() => void) = null

// 注册取消处理器的函数
const registerCancelHandler = () => {
  const cancel = async () => {
    try {
      cancelStream && cancelStream()
      status.value = MessageStatus.STOP
      emit('statusChange', MessageStatus.STOP)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('QuoteMessage cancel error:', error)
      }
      throw error
    }
  }
  cancelRegistry?.registerCancelable(props.message.id, cancel)
}

// 统一的解题成功埋点函数
const trackSolveSuccess = (body: any) => {
  if (hasTrackedSuccess.value) return // 防止重复埋点

  hasTrackedSuccess.value = true

  // 获取 from 字段
  const from =
    props.message.userContent?.attachments?.quote?.from ||
    props.message.userContent?.attachments?.selection?.from ||
    'unknown'

  // 根据 from 字段判断使用哪个埋点
  const isHighlightChat = from === 'page' || from === 'pdf'
  const eventName = isHighlightChat
    ? 'Plugin_Highlight_Chat_Success'
    : 'Plugin_Quote_Solve_Success'

  // 映射 type 字段
  const typeMapping: Record<string, string> = {
    askForChat: 'chat',
    explain: 'explain',
    highlightChat: 'highlightChat',
  }
  const mappedType = typeMapping[body.type] || body.type

  trackEvent.track(eventName, {
    messageId: props.message.id,
    type: mappedType,
    from,
  })
}

// 统一的解题失败埋点函数
const trackSolveError = (body: any, errorMessage: string) => {
  if (hasTrackedSuccess.value) return // 如果已经成功埋点，不再埋点错误

  // 获取 from 字段，优先使用 body 中传入的，否则从 message 中获取
  const from =
    body.from ||
    props.message.userContent?.attachments?.quote?.from ||
    props.message.userContent?.attachments?.selection?.from ||
    'unknown'

  // 根据 from 字段判断使用哪个埋点
  const isHighlightChat = from === 'page' || from === 'pdf'
  const eventName = isHighlightChat
    ? 'Plugin_Highlight_Chat_Error'
    : 'Plugin_Quote_Solve_Error'

  // 映射 type 字段
  const typeMapping: Record<string, string> = {
    askForChat: 'chat',
    explain: 'explain',
    highlightChat: 'highlightChat',
  }
  const mappedType = typeMapping[body.type] || body.type

  trackEvent.track(eventName, {
    messageId: props.message.id,
    type: mappedType,
    errorMessage,
    from,
  })
}

// 解析流事件的统一方法（最小改动）：取 event.data；字符串则 JSON.parse，否则原样
const parseEvent = (evt: any): any => {
  const raw =
    evt && typeof evt === 'object' && 'data' in evt ? (evt as any).data : evt
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return { content: raw }
    }
  }
  return raw || {}
}

// 🎯 根据 serviceType 获取 code 和 type 的映射
const getCodeAndType = () => {
  const serviceType = props.message.serviceType
  if (serviceType === ServiceMessageType.QUOTE) {
    return {
      code: 'plugin-quote-ask-chat',
      type: 'askForChat',
    }
  } else if (serviceType === ServiceMessageType.EXPLAIN) {
    return {
      code: 'plugin-text-highlighting-explain',
      type: 'explain',
    }
  } else {
    // HIGHLIGHT_CHAT 或其他情况
    return {
      code: 'plugin-text-highlight-chat',
      type: 'highlightChat',
    }
  }
}

// 🎯 统一的状态重置函数
const resetState = () => {
  status.value = MessageStatus.PENDING
  content.value = ''
  errorMessage.value = ''
}

// 🎯 统一的错误处理函数
const handleError = (type: string, errorMsg: string = 'Failed. Please try again.') => {
  errorMessage.value = errorMsg
  status.value = MessageStatus.ERROR
  emit('statusChange', MessageStatus.ERROR)
  trackSolveError({ type, from: 'unknown' }, errorMsg)
}

// 🎯 统一的构建请求 body 函数
const buildRequestBody = (mode: 'solve' | 'retry' = 'solve') => {
  const { code, type } = getCodeAndType()
  
  if (mode === 'retry') {
    // 重试模式：只传必要字段
    return {
      sessionId: props.message.id,
      platform: 'plugin',
      code,
    }
  }
  
  // 解题模式：根据 serviceType 构建完整 body
  const baseBody = {
    deviceId: '', // 将在 startStreamRequest 中获取
    platform: 'plugin',
    sessionId: props.message.id,
    code,
    type,
  }
  
  // 根据不同的 serviceType 添加 params
  if (props.message.serviceType === ServiceMessageType.EXPLAIN) {
    const { content: selectedText, totalText } = props.message.userContent.attachments.selection
    return {
      ...baseBody,
      params: {
        highlighted_text: selectedText,
        context: totalText,
      },
    }
  } else {
    // QUOTE 或 HIGHLIGHT_CHAT
    const quoteInfo = props.message.userContent?.attachments?.quote
    if (!quoteInfo) {
      return null // 表示缺少必要信息
    }
    
    const { highlighted_text, user_question, context } = quoteInfo
    return {
      ...baseBody,
      params: {
        user_question,
        context,
        highlighted_text,
      },
    }
  }
}

// 🎯 统一的开始处理函数
const startProgress = (mode: 'solve' | 'retry' = 'solve') => {
  // 重置状态
  resetState()
  
  // 构建请求 body
  const body = buildRequestBody(mode)
  
  if (!body) {
    // 缺少必要信息，报错
    const { type } = getCodeAndType()
    handleError(type, 'Missing required information. Please try again.')
    return
  }
  
  // 调用通用流式请求函数
  startStreamRequest(body, mode)
}

// 通用流式请求函数
const startStreamRequest = async (body: any, mode: 'solve' | 'retry' = 'solve') => {
  const isRetry = mode === 'retry'
  
  try {
    // 若已有进行中的流，先取消
    if (cancelStream) {
      try {
        cancelStream()
      } catch {}
      cancelStream = null
    }

    // 获取 token
    const authToken = await getTrpc().getAuthToken.query()

    // 根据模式决定 URL 和 body
    let url: string
    let requestBody: any

    if (isRetry) {
      // 重试模式：只传必要字段
      url = '/context/ask/retry'
      requestBody = {
        sessionId: body.sessionId || props.message.id,
        platform: body.platform || 'plugin',
        code: body.code, // 必须传递 code
      }
    } else {
      // 解题模式：传完整参数
      // 获取 deviceId（用户ID）
      const deviceId = await getTrpc().getUserId.query()
      body.deviceId = deviceId
      // 添加语言参数到 params 内部
      if (!body.params) {
        body.params = {}
      }
      body.params.language = currentLanguage.value
      
      url = '/context/ask'
      requestBody = body
    }

    // 发起流式请求（记录取消函数）
    cancelStream = fetchStream({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
        'x-plugin-uuid': await getPluginUuid() || '',
      },
      body: requestBody,
      onOpen: () => {
        console.log('🚀 流式请求已开始:', requestBody.code || body.code)
      },
      onMessage: (event: any) => {
        const payload = parseEvent(event)
        const { content: messageContent = '', command = '' } = payload || {}
        if (command === 'pending') {
          if (typeof messageContent === 'string') {
            // 当开始接收内容时，设置状态为 RESPONDING
            if (status.value === MessageStatus.PENDING) {
              status.value = MessageStatus.RESPONDING
              emit('statusChange', MessageStatus.RESPONDING)
            }
            content.value += messageContent
            console.log('🚀 流式请求已开始======:', content.value)
            emit('messageUpdate')
          }
        } else if (command === 'done') {
          if (typeof messageContent === 'string') {
            content.value = messageContent
          }
          status.value = MessageStatus.COMPLETED
          emit('statusChange', MessageStatus.COMPLETED)
          // 🎯 在这里发送 done 事件（主要完成路径）
          emit('done', { 
            content: content.value,
            feedback: -1,  // 默认未操作，后续由 UnifiedMessageActions 更新
          })
          
          // 解题成功埋点（使用原始 body 或从 message 获取信息）
          const { type } = getCodeAndType()
          trackSolveSuccess({ ...body, type })
        } else if (command === 'error') {
          errorMessage.value = 'Failed. Please try again.'
          status.value = MessageStatus.ERROR
          emit('statusChange', MessageStatus.ERROR)

          // 解题失败埋点（服务器错误）
          const { type } = getCodeAndType()
          trackSolveError({ ...body, type }, 'Server error: Failed. Please try again.')
        }
      },
      onError: (err: any) => {
        errorMessage.value = 'Network error. Please try again.'
        status.value = MessageStatus.ERROR
        emit('statusChange', MessageStatus.ERROR)

        // 解题失败埋点（网络错误）
        const { type } = getCodeAndType()
        trackSolveError({ ...body, type }, 'Network error. Please try again.')
      },
      onClose: () => {
        // 连接关闭处理
      },
      onDone: (finalContent: any) => {
        // 🎯 兜底逻辑：如果 onMessage 中没有收到 done 命令，在这里处理
        if (status.value !== MessageStatus.COMPLETED) {
          const payload = parseEvent(finalContent)
          const finalText =
            typeof payload?.content === 'string'
              ? payload.content
              : typeof finalContent === 'string'
              ? finalContent
              : ''
          if (finalText) {
            content.value = finalText
          }
          status.value = MessageStatus.COMPLETED
          emit('statusChange', MessageStatus.COMPLETED)
          emit('done', { 
            content: content.value,
            feedback: -1,  // 默认未操作，后续由 UnifiedMessageActions 更新
          })
          const { type } = getCodeAndType()
          trackSolveSuccess({ ...body, type })
        }
        // 如果已经 COMPLETED，onDone 只做清理工作
      },
    })

    // 注意：取消处理器的注册现在在组件级别的 registerCancelHandler 函数中处理
  } catch (error) {
    console.error('流式请求失败:', error)
    errorMessage.value = 'Failed. Please try again.'
    status.value = MessageStatus.ERROR
    emit('statusChange', MessageStatus.ERROR)

    // 解题失败埋点（未知错误）
    const { type } = getCodeAndType()
    trackSolveError(
      { ...body, type },
      `Unknown error: ${
        error instanceof Error ? error.message : 'Failed. Please try again.'
      }`
    )
  }
}

// 🎯 重试处理（保留，通过 defineExpose 暴露给父组件）
const handleRetry = async () => {
  // 🔑 保存重试前的状态
  const previousStatus = status.value
  
  // 重置状态
  hasTrackedSuccess.value = false // 重置埋点标记
  emit('statusChange', MessageStatus.PENDING)
  registerCancelHandler()
  
  // 🔑 只有 COMPLETED 状态的重试才调用 retry 接口，其他状态相当于新请求
  if (previousStatus === MessageStatus.COMPLETED) {
    // 使用重试接口（不扣余额）
    startProgress('retry')
  } else {
    // 其他状态（ERROR、STOP、PENDING、RESPONDING 等）相当于发起新的解题
    startProgress('solve')
  }
}

// 监听内容变化，自动滚动并触发尺寸更新（与 AnswerMessage 对齐）
watch(
  () => content.value,
  () => {
    // 只在流式输出或完成时滚动
    if (status.value === MessageStatus.RESPONDING || status.value === MessageStatus.COMPLETED) {
      smartScroll()
      // 🎯 触发消息更新事件，确保浮层约束逻辑被执行
      emit('messageUpdate')
    }
  }
)

// 开始进度
onMounted(() => {
  // 🎯 检查是否有预加载数据（直接渲染模式）
  const preloadedData = props.message.preloadedData
  if (preloadedData && 'content' in preloadedData) {
    content.value = preloadedData.content
    status.value = MessageStatus.COMPLETED
    
    emit('statusChange', MessageStatus.COMPLETED)
    
    // 🎯 传递完整数据（包括预加载的 feedback）
    emit('done', {
      content: content.value,
      feedback: preloadedData.feedback ?? -1
    })
    
    return
  }

  // 🚀 正常请求模式
  // 🎯 立即发送 PENDING 状态
  emit('statusChange', MessageStatus.PENDING)
  registerCancelHandler()
  // 开始进度
  startProgress()
})

// 组件卸载时，取消进行中的流式请求
onUnmounted(() => {
  if (cancelStream) {
    try {
      cancelStream()
    } catch {}
    cancelStream = null
  }
  cancelRegistry?.unregisterCancelable(props.message.id)
})

// 🎯 暴露重试方法
defineExpose({
  retry: handleRetry
})

// 🎯 点赞、点踩、复制已移至 UnifiedMessageActions 统一管理
</script>
