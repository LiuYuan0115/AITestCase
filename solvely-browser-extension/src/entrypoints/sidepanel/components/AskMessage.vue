<template>
  <div>
    <!-- 状态展示区 -->
    <div
      v-if="status === MessageStatus.PENDING"
      class="pb-[20px]"
    >
      <Vue3Lottie
        v-if="isDark"
        :animation-data="loadingPromptDark"
        :width="32"
        :height="32"
        :loop="true"
        :autoplay="true"
        :style="{ margin: '-4px' }"
      />
      <Vue3Lottie
        v-else
        :animation-data="loadingPrompt"
        :width="32"
        :height="32"
        :loop="true"
        :autoplay="true"
        :style="{ margin: '-4px' }"
      />
    </div>

    <!-- 内容展示区 -->
    <template v-else>
      <div
        class="text-[14px] leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      >
        <LatexFormat
          v-if="content"
          :text="content"
        />
      </div>

      <!-- 🎯 操作按钮已移至 UnifiedMessageActions 统一管理 -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAsk } from '../composables/useAsk'
import { useMessageScroll } from '../composables/useMessageScroll'
import useMessages from '../composables/useMessages'
import LatexFormat from '@/components/common/LatexFormat.vue'
import { MessageStatus, AskMessage, ServiceMessageType } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import { throttle } from 'lodash-es'
import { Vue3Lottie } from 'vue3-lottie'
import loadingPrompt from '@/assets/animations/loading-prompt.json'
import loadingPromptDark from '@/assets/animations/loading-prompt-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
const { isDark } = useDarkMode()
// Props 定义
interface Props {
  message: AskMessage
  questionId: string
  answerId: string
  messageStore: ReturnType<typeof useMessages>
}

const props = defineProps<Props>()

// Emits 定义
const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'contentUpdate', content: string): void
  (e: 'messageUpdate'): void
  (e: 'done', data: { content: string; feedback: number }): void
}>()

// 组件状态
const status = ref<MessageStatus>(MessageStatus.PENDING)
const content = ref('')

// 使用滚动管理
const { smartScroll } = useMessageScroll(props.message.id)

// 使用 useAsk
const { currentAnswer, isAnswering, isConnect, startAsk, cancelAsk, retryAsk } = useAsk()

const registerCancelHandler = () => {
  const cancel = async () => {
    try {
      cancelAsk()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('AskMessage cancel error:', error)
      }
      throw error
    }
  }
  props.messageStore.registerCancelable(props.message.id, cancel)
}

// 获取追问参数
const getAskParameters = () => {
  const { askContext } = props.message

  if (askContext) {
    // 新的通用追问逻辑
    return {
      sessionId: askContext.parentMessageId,
      apiEndpoint: askContext.apiEndpoint,
      parentType: askContext.parentMessageType,
      content: props.message.userContent.value,
    }
  } else {
    // 兼容现有解题追问逻辑 - 保持使用 questionId 和 answerId
    return {
      sessionId: props.answerId, // sessionId 用于流式路径
      apiEndpoint: '/question/follow',
      parentType: ServiceMessageType.ANSWER,
      content: props.message.userContent.value,
      questionId: props.questionId, // 保留 questionId 用于初始请求路径
      answerId: props.answerId, // 保留 answerId 用于请求体和流式路径
      isFirstAsk: false,
    }
  }
}

// 开始追问
onMounted(() => {
  emit('statusChange', MessageStatus.PENDING)
  registerCancelHandler()
  const askParams = getAskParameters()
  startAsk(askParams)
})

// 创建节流函数
const throttledEmitUpdate = throttle(() => {
  emit('messageUpdate')
  // 调用智能滚动
  smartScroll()
}, 300)

// 监听回答内容
watch(currentAnswer, (newValue) => {
  throttledEmitUpdate()
  if (newValue.command) {
    const newStatus = newValue.command === 'done' ? MessageStatus.COMPLETED : MessageStatus.RESPONDING
    status.value = newStatus
    emit('statusChange', newStatus)

    // 🎯 传递完整数据
    if (newValue.command === 'done') {
      emit('done', {
        content: content.value,
        feedback: -1, // 默认未操作，后续由 UnifiedMessageActions 更新
      })
    }
  }
  if (newValue.content) {
    content.value = newValue.content
    emit('contentUpdate', newValue.content)
  }
})

watch(isConnect, (newValue) => {
  if (!newValue) {
    emit('statusChange', MessageStatus.NO_CONTEXT)
  }
})

watch(
  () => props.message.status,
  (next) => {
    status.value = next
  }
)

// 🎯 重试处理（保留，通过 defineExpose 暴露给父组件）
const handleRetry = () => {
  content.value = ''
  status.value = MessageStatus.PENDING
  emit('statusChange', MessageStatus.PENDING)
  retryAsk()

  // 重新注册取消处理器，确保暂停功能正常工作
  registerCancelHandler()
}

// 组件卸载时取消追问
onUnmounted(() => {
  cancelAsk()
  props.messageStore.unregisterCancelable(props.message.id)
})

// 🎯 暴露重试方法
defineExpose({
  retry: handleRetry,
})
</script>
