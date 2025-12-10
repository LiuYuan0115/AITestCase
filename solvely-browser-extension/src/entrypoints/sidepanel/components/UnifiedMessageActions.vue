<template>
  <template v-if="shouldShow">
    <div class="flex justify-start gap-3 mt-3">
      <!-- 点赞/点踩 -->
      <template v-if="feedback !== 0">
        <div
          v-if="feedback === 1"
          class="px-[6px] text-t_brand dark:text-t_brand_dk w-8 h-8 flex items-center justify-center color-transition"
        >
          <SvgIcon name="liked" size="20" />
        </div>
        <CustomTooltip v-else text="Like" position="top" :offset="{ x: 6, y: 0 }">
          <Button
            type="icon-only"
            icon="like"
            @click="handleLike"
          />
        </CustomTooltip>
      </template>

      <template v-if="feedback !== 1">
        <div
          v-if="feedback === 0"
          class="px-[6px] text-t_3 dark:text-t_3_dk w-8 h-8 flex items-center justify-center color-transition"
        >
          <SvgIcon name="disliked" size="20" />
        </div>
        <CustomTooltip v-else text="Dislike" position="top">
          <Button
            type="icon-only"
            icon="dislike"
            @click="handleDislike"
          />
        </CustomTooltip>
      </template>

      <!-- 复制 -->
      <CustomTooltip v-if="config.showCopy" text="Copy" position="top">
        <Button
          type="icon-only"
          icon="copy"
          @click="handleCopy"
        />
      </CustomTooltip>

      <!-- 重试 -->
      <CustomTooltip v-if="config.showRetry" text="Regenerate" position="top">
        <Button
          type="icon-only"
          icon="retry"
          @click="handleRetry"
        />
      </CustomTooltip>
    </div>

    <!-- Toast 组件 -->
    <Toast ref="toastRef" :duration="2000" />
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Button from '@/components/common/Button.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import CustomTooltip from '@/components/common/CustomTooltip.vue'
import Toast from './Toast.vue'
import { MessageStatus, ServiceMessageType } from '../types/message'
import trackEvent from '@/utils/trackEvent'
import { feedbackAnswer, feedbackAsk, feedbackSummary } from '@/api'
import { useAnswerFormatter } from './solve/composables/useAnswerFormatter'

// 反馈类型定义
type FeedbackType = -1 | 0 | 1  // -1: 未操作, 0: 点踩, 1: 点赞

// 消息信息（聚合所有必要数据）
interface MessageInfo {
  id: string
  type: ServiceMessageType
  status: MessageStatus
  // API 参数（根据消息类型使用）
  questionId?: string
  answerId?: string
  sessionId?: string
  // 消息内容（用于复制）
  content?: string | any[]  // string: 纯文本, any[]: AnswerMessage 的 components
  components?: any[]  // AnswerMessage 专用
  // 初始反馈状态
  feedback?: FeedbackType
}

interface Props {
  messageInfo: MessageInfo
}

const props = defineProps<Props>()

const { formatForCopy } = useAnswerFormatter()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'feedbackChange', feedback: FeedbackType): void
}>()

// 反馈状态（messageId 变化时重置）
const feedback = ref<FeedbackType>(props.messageInfo.feedback ?? -1)

watch(() => props.messageInfo.id, () => {
  feedback.value = props.messageInfo.feedback ?? -1
})

watch(() => props.messageInfo.feedback, (newVal) => {
  feedback.value = newVal ?? -1
})

// 配置映射（根据消息类型）
const config = computed(() => {
  switch (props.messageInfo.type) {
    case ServiceMessageType.ANSWER:
      return { showRetry: true, showCopy: true }
    case ServiceMessageType.ASK:
    case ServiceMessageType.PDF_SUMMARIZE_ASK:
      return { showRetry: false, showCopy: true }
    case ServiceMessageType.QUOTE:
    case ServiceMessageType.EXPLAIN:
    case ServiceMessageType.HIGHLIGHT_CHAT:
    case ServiceMessageType.SUMMARY:
    case ServiceMessageType.PDF_SUMMARIZE:
      return { showRetry: true, showCopy: true }
    default:
      return { showRetry: false, showCopy: true }
  }
})

// 显示条件
const shouldShow = computed(() => {
  return props.messageInfo.status === MessageStatus.COMPLETED
})

// Toast 组件引用
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

// 🎯 反馈 API 映射配置
type FeedbackHandler = (feedbackValue: 0 | 1) => Promise<void>

const feedbackHandlers: Record<ServiceMessageType, FeedbackHandler | null> = {
  [ServiceMessageType.ANSWER]: async (feedbackValue) => {
    const { questionId, answerId } = props.messageInfo
    if (!questionId || !answerId) {
      throw new Error('Missing questionId or answerId for ANSWER')
    }
    await feedbackAnswer(questionId, answerId, feedbackValue)
  },
  
  [ServiceMessageType.ASK]: async (feedbackValue) => {
    const { questionId, answerId, id } = props.messageInfo
    if (!questionId || !answerId) {
      throw new Error('Missing questionId or answerId for ASK')
    }
    await feedbackAsk(questionId, answerId, id, feedbackValue)
  },
  
  [ServiceMessageType.SUMMARY]: async (feedbackValue) => {
    const sessionId = props.messageInfo.sessionId || props.messageInfo.id
    await feedbackSummary(sessionId, feedbackValue)
  },
  
  [ServiceMessageType.PDF_SUMMARIZE]: async (feedbackValue) => {
    const sessionId = props.messageInfo.sessionId || props.messageInfo.id
    await feedbackSummary(sessionId, feedbackValue)
  },
  
  [ServiceMessageType.PDF_SUMMARIZE_ASK]: async (feedbackValue) => {
    const sessionId = props.messageInfo.sessionId || props.messageInfo.id
    await feedbackSummary(sessionId, feedbackValue)
  },
  
  // TODO: 暂无 API 实现
  [ServiceMessageType.QUOTE]: null,
  [ServiceMessageType.EXPLAIN]: null,
  [ServiceMessageType.HIGHLIGHT_CHAT]: null,
  [ServiceMessageType.QUIZ]: null,
}

// 🎯 通用反馈处理函数
const handleFeedback = async (feedbackValue: 0 | 1) => {
  feedback.value = feedbackValue
  emit('feedbackChange', feedbackValue)
  
  try {
    const handler = feedbackHandlers[props.messageInfo.type]
    
    if (handler) {
      await handler(feedbackValue)
      trackEvent.track(feedbackValue === 1 ? 'Plugin_Solve_panel_like' : 'Plugin_Solve_panel_dislike')
    } else {
      console.log(`Feedback for ${props.messageInfo.type} - API not implemented`)
    }
  } catch (error) {
    console.error('Feedback failed:', error)
  }
}

// 🎯 点赞/点踩
const handleLike = () => handleFeedback(1)
const handleDislike = () => handleFeedback(0)

// 🎯 复制（组件内部完成）

const handleCopy = () => {
  let content = ''
  
  // 两种情况：
  // 1. AnswerMessage - 有 components 数组，需要格式化
  if (Array.isArray(props.messageInfo.components)) {
    content = formatForCopy(props.messageInfo.components)
  }
  // 2. 其他消息 - content 是纯文本
  else if (typeof props.messageInfo.content === 'string') {
    content = props.messageInfo.content
  }
  
  if (!content) return
  
  // 统一的文本清理逻辑
  const cleanedText = content
    .replace(/<graph>.*?<\/graph>/gs, '')
    .replace(/\n{4,}/g, '\n\n')
    .replace(/```[\s\S]*?```/g, '')
  
  navigator.clipboard.writeText(cleanedText)
    .then(() => {
      toastRef.value?.show('Copied')
      trackEvent.track('Plugin_Solve_panel_copied')
    })
    .catch((err) => {
      console.error('Copy failed:', err)
    })
}

// 🎯 重试（通知外部协调）
const handleRetry = () => {
  trackEvent.track('Plugin_Solve_panel_retry')
  emit('retry')
}

// 暴露状态（供外部读取）
defineExpose({
  feedback
})
</script>

