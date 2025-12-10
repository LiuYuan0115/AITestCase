<template>
  <div class="summary-message">
    <!-- 状态展示区 -->
    <div
      v-if="status === MessageStatus.PENDING && !isLoadingShowPrompt"
      class="pb-[20px] flex flex-row items-center justify-start gap-2"
    >
      <Vue3Lottie
        :animation-data="isDark ? loadingAnimationDark : loadingAnimation"
        :width="20"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{
          margin: 0,
          height: '20px',
        }"
      />

      <div class="text-primary text-sm font-normal leading-tight">
        Summarizing
      </div>
    </div>
    <div
      v-else-if="status === MessageStatus.PENDING && isLoadingShowPrompt"
      class="pb-[20px] flex flex-row items-center justify-start gap-2"
    >
      <Vue3Lottie
        :animation-data="isDark ? loadingPromptDark : loadingPrompt"
        :width="32"
        :height="32"
        :loop="true"
        :autoplay="true"
        :style="{ margin: '-4px', height: '32px' }"
      />
    </div>

    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-[#F30A34]">
        {{ ErrorMessage[errorType as ErrorType] }}
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

 

    <!-- 内容展示区 -->
    <div
      v-else-if="
        status === MessageStatus.RESPONDING ||
        status === MessageStatus.COMPLETED ||
        status === MessageStatus.STOP
      "
    >
      <div
        class="text-sm leading-[160%] font-[400] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject, computed } from 'vue'
import { useSummary } from '../composables/useSummary'
import { useMessageScroll } from '../composables/useMessageScroll'
import LatexFormat from '@/components/common/LatexFormat.vue'
import {
  MessageStatus,
  SummaryMessage,
  PdfSummarizeMessage,
} from '../types/message'
import trackEvent from '~/utils/trackEvent'
import { throttle } from 'lodash-es'
import { Vue3Lottie } from 'vue3-lottie'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'
import { ErrorType, ErrorMessage } from '../types/message'
import loadingPrompt from '@/assets/animations/loading-prompt.json'
import loadingPromptDark from '@/assets/animations/loading-prompt-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'

const props = withDefaults(defineProps<{
  message: SummaryMessage | PdfSummarizeMessage
  useScroll?: boolean
}>(), {
  useScroll: true
})

const { isDark } = useDarkMode()

// 使用 inject 获取 cancelRegistry
const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'contentUpdate', content: string): void
  (e: 'messageUpdate'): void
  // 新增：完成时传递数据
  (e: 'done', data: { content: string; feedback: number; sessionId?: string }): void
}>()

// 组件状态
const status = ref<MessageStatus>(MessageStatus.PENDING)
const content = ref('')
const errorType = ref<ErrorType | null>(null)
const isLoadingShowPrompt = ref<boolean>(false)
const isStopped = ref(false)

// 使用滚动管理（根据 props 决定）
const { smartScroll } = props.useScroll 
  ? useMessageScroll(props.message.id)
  : { smartScroll: () => {} }

// 使用 useSummary
const {
  currentSummary,
  isSummarizing,
  startSummary,
  cancelSummary,
  likeSummary,
  retrySummary,
  initFromPreloaded,
} = useSummary()

const registerCancelHandler = () => {
  const cancel = async () => {
    try {
      isStopped.value = true
      status.value = MessageStatus.STOP
      emit('statusChange', MessageStatus.STOP)
      cancelSummary()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('SummaryMessage cancel error:', error)
      }
      throw error
    }
  }
  // 使用 inject 的 cancelRegistry，如果没有则忽略
  cancelRegistry?.registerCancelable(props.message.id, cancel)
}

// 🎯 提取开始摘要的逻辑（用于重试时重新发起新请求）
const startSummaryProcess = () => {
  let contentText = ''
  let pageUrl = ''
  let instructions = ''
  // 优先支持划词 explain
  if (props.message.userContent.attachments?.selection) {
    contentText = props.message.userContent.attachments.selection.content || ''
    pageUrl = props.message.userContent.attachments.selection.url || ''
  } else {
    // 兼容原有 summary 结构
    const parsed = JSON.parse(props.message.userContent.value)
    contentText = parsed.content || ''
    pageUrl = parsed.pageUrl || ''
    instructions = parsed.instructions || ''
  }

  // 如果有 instructions 字段，设置为显示 prompt 动画
  if (instructions && instructions.trim()) {
    isLoadingShowPrompt.value = true
  }

  // 如果内容为空, 则设置为错误状态, 并设置错误类型
  if (!contentText || contentText === '') {
    emit('statusChange', MessageStatus.ERROR)
    status.value = MessageStatus.ERROR
    errorType.value = ErrorType.SUMMARY_NO_OPEN
    trackEvent.track('Plugin_Solve_summary_no_content', {
      pageUrl,
    })
    return
  }

  startSummary(
    {
      content: contentText,
      pageUrl,
      instructions,
      sessionId: props.message.id,
    },
    {
      errorCallback: () => {
        if (isStopped.value) {
          status.value = MessageStatus.STOP
          emit('statusChange', MessageStatus.STOP)
          isStopped.value = false
          return
        }
        emit('statusChange', MessageStatus.ERROR)
        status.value = MessageStatus.ERROR
        errorType.value = ErrorType.NETWORK_ERROR
        trackEvent.track('Plugin_Solve_summary_network_error')
      },
    }
  )
}

// 开始生成摘要
onMounted(() => {
  // 🎯 检查是否有预加载数据（直接渲染模式）
  const preloadedData = props.message.preloadedData
  if (preloadedData && 'content' in preloadedData) {
    content.value = preloadedData.content
    status.value = MessageStatus.COMPLETED
    
    // 🔧 初始化重试所需的 summaryInfo（从 userContent 提取）
    let contentText = ''
    let pageUrl = ''
    let instructions = ''
    if (props.message.userContent.attachments?.selection) {
      contentText = props.message.userContent.attachments.selection.content || ''
      pageUrl = props.message.userContent.attachments.selection.url || ''
    } else {
      const parsed = JSON.parse(props.message.userContent.value)
      contentText = parsed.content || ''
      pageUrl = parsed.pageUrl || ''
      instructions = parsed.instructions || ''
    }
    
    // 初始化 useSummary 的状态以支持重试
    initFromPreloaded({
      sessionId: 'sessionId' in preloadedData ? (preloadedData.sessionId || props.message.id) : props.message.id,
      content: contentText,
      pageUrl: pageUrl,
      instructions: instructions,
    })
    
    emit('statusChange', MessageStatus.COMPLETED)
    
    // 🎯 传递完整数据（包括预加载的 feedback 和 sessionId）
    emit('done', {
      content: content.value,
      feedback: preloadedData.feedback ?? -1,
      sessionId: 'sessionId' in preloadedData ? (preloadedData.sessionId || props.message.id) : props.message.id,  // 🔧 传递 sessionId
    })
    
    return
  }

  // 🚀 正常请求模式
  // 🎯 立即发送 PENDING 状态
  emit('statusChange', MessageStatus.PENDING)
  registerCancelHandler()
  
  // 使用统一的开始摘要逻辑
  startSummaryProcess()
})

// 监听摘要内容
watch(currentSummary, (newValue) => {
  if (newValue.command) {
    let newStatus = MessageStatus.PENDING
    switch (newValue.command) {
      case 'done':
        newStatus = MessageStatus.COMPLETED
        // 🎯 新增：传递完整数据（用于浮层存储）
        emit('done', { 
          content: content.value,
          feedback: -1,  // 默认未操作，后续由 UnifiedMessageActions 更新
          sessionId: props.message.id,  // 🔧 传递 sessionId 以支持侧栏重试
        })
        break
      case 'pending':
        newStatus = MessageStatus.RESPONDING
        break
    }
    status.value = newStatus
    emit('statusChange', newStatus)
  }
  if (newValue.content) {
    content.value = newValue.content
    emit('contentUpdate', newValue.content)
  }
})

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

watch(
  () => props.message.status,
  (next) => {
    status.value = next
  }
)

// 🎯 重试处理（保留，通过 defineExpose 暴露给父组件）
const handleRetry = async () => {
  // 🔑 保存重试前的状态
  const previousStatus = status.value
  
  // 重置状态
  content.value = ''
  status.value = MessageStatus.PENDING
  emit('statusChange', MessageStatus.PENDING)
  
  // 重新注册取消处理器，确保暂停功能正常工作
  registerCancelHandler()
  
  // 🔑 只有 COMPLETED 状态的重试才调用 retrySummary，其他状态相当于新请求
  if (previousStatus === MessageStatus.COMPLETED) {
    // 使用重试接口（不扣余额）
    retrySummary()
  } else {
    // 其他状态（ERROR、STOP、PENDING、RESPONDING 等）相当于发起新的解题
    startSummaryProcess()
  }
}

// 🎯 点赞、点踩、复制已移至 UnifiedMessageActions 统一管理

// 组件卸载时取消摘要生成
onUnmounted(() => {
  cancelSummary()
  // 使用 inject 的 cancelRegistry，如果没有则忽略
  cancelRegistry?.unregisterCancelable(props.message.id)
})

// 🎯 暴露重试方法
defineExpose({
  retry: handleRetry
})
</script>

<style scoped>
:deep(.markdown-body) {
  font-size: 14px;
  line-height: 20px;
}
</style>
