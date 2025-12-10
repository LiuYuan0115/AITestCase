<template>
  <div
    class="self-stretch pt-[8px] bg-[#F3F6FF] rounded-[16px] border-[1px] border-white flex flex-col justify-start items-start gap-[8px] overflow-hidden"
  >
    <!-- copy success modal -->
    <div
      v-if="showCopied"
      class="px-5 py-3 pointer-events-none left-1/2 -translate-x-1/2 top-[12px] absolute bg-[#191919] bg-opacity-70 rounded-xl inline-flex justify-center items-center overflow-hidden"
    >
      <div
        class="text-center justify-start text-white text-sm font-normal font-['Inter'] leading-tight"
      >
        Copied
      </div>
    </div>

    <!-- solution 区域 -->
    <div
      class="self-stretch px-[16px] inline-flex justify-between items-center"
    >
      <span
        class="justify-center text-[#474A7E] text-[16px] font-bold font-['Inter'] leading-[20px]"
      >
        Solution
      </span>

      <div
        v-if="props.currentAnswer.answer"
        class="flex items-center gap-[14px]"
      >
        <!-- copy button 复制按钮 -->
        <button @click="copyClick()" :disabled="copyButtonDisabled" class="mx-[5px]">
          <SvgIcon
            name="copy"
            size="18"
            :fill="copyButtonDisabled ? '#cccccc' : '#535688'"
          />
        </button>

        <!-- retry button 重试按钮 -->
        <button @click="retryClick()" :disabled="retryButtonDisabled" class="mx-[5px]">
          <SvgIcon
            name="retry"
            size="18"
            :fill="retryButtonDisabled ? '#cccccc' : '#535688'"
          />
        </button>

        <!-- view more button -->
        <button @click="viewMoreClick()" :disabled="retryButtonDisabled">
          <SvgIcon
            name="arrow-right"
            size="28"
            :fill="retryButtonDisabled ? '#cccccc' : '#535688'"
          />
        </button>
      </div>
    </div>

    <!-- 1.loading 动画 -->
    <div
      v-if="props.isLoading"
      ref="lottieContainer"
      class="w-full bg-white rounded-[16px] transition-all duration-300"
      :class="props.isQuestionExpanded ? 'h-[320px]' : 'h-[416px]'"
    ></div>

    <!-- 2.超出限制 -->
    <OutLimit v-else-if="props.isOutLimit" />

    <!-- 3.无网络 or 错误 -->
    <NoNetwork
      v-else-if="props.isNetworkError"
      :refreshDisabled="refreshDisabled"
      @refresh="refreshClick"
    />

    <!-- 4.解题详情 -->
    <div
      v-else
      :class="[
        'relative overflow-hidden',
        'max-w-[388px] min-h-[112px]',
        'inline-flex justify-center items-start gap-[10px]',
        'self-stretch  bg-white rounded-[16px]',
        'transition-all duration-300',
        props.isQuestionExpanded ? 'max-h-[320px]' : 'max-h-[416px]',
      ]"
    >
      <div
        class="answer-info-wrapper w-full p-[16px] self-stretch justify-start text-emph-1 text-[16px] font-normal font-['Inter'] leading-[24px] overflow-auto"
      >
        <AnswerInfo :data="props.currentAnswer" />
        <div ref="scrollAnchor"></div>
      </div>
      <div
        class="absolute bottom-0 w-full h-[32px] bg-gradient-to-t from-white/80 to-transparent pointer-events-none"
      ></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onUnmounted, watchEffect, computed, watch, nextTick } from 'vue'
import lottie from 'lottie-web/build/player/lottie_light.js'
import loadingAnimation from '~/assets/animations/loading-animation.json'
import OutLimit from './OutLimit.vue'
import AnswerInfo from '../AnswerInfo/index.vue'
import NoNetwork from './NoNetwork.vue'
import trackEvent from '@/utils/trackEvent'

const props = defineProps<{
  isLoading: boolean
  isOutLimit: boolean
  isNetworkError: boolean
  isAnswering: boolean
  currentAnswer: any
  isQuestionExpanded: boolean
}>()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'refresh'): void
}>()

const showCopied = ref(false)

const copyButtonDisabled = computed(() => {
  return props.isLoading || props.isAnswering || showCopied.value
})

const retryButtonDisabled = computed(() => {
  return props.isLoading || props.isAnswering
})

const refreshDisabled = computed(() => {
  return props.isLoading || props.isAnswering
})

// copy 答案内容到剪切板
const copyToClipboard = () => {
  if (showCopied.value) return

  const answer = props.currentAnswer.answer

  if (!answer) return

  const text = answer
    .replace(/<graph>.*?<\/graph>/gs, '')
    .replace(/\n{4,}/g, '\n\n')
    .replace(/```[\s\S]*?```/g, '')

  // Copy to clipboard
  navigator.clipboard
    .writeText(text)
    .then(() => {
      // Show the copied notification
      showCopied.value = true

      trackEvent.track('Plugin_Solve_panel_copied')

      // Hide the notification after 2 seconds
      setTimeout(() => {
        showCopied.value = false
      }, 2000)
    })
    .catch((err) => {
      console.error('Failed to copy text: ', err)
    })
}

// 复制按钮点击事件
const copyClick = () => {
  trackEvent.track('Plugin_Solve_panel_copy')
  copyToClipboard()
}

// 重试按钮点击事件
const retryClick = () => {
  // 触发重试事件
  trackEvent.track('Plugin_Solve_tryagain')
  emit('retry')
}

// 查看更多按钮点击事件
const viewMoreClick = () => {
  // 触发查看更多事件
  trackEvent.track('Plugin_Solve_view_larger')
  window.open(
    `${import.meta.env.VITE_SOLVELY_URL}/history/${
      props.currentAnswer.questionId
    }`,
    '_blank',
    'noreferrer'
  )
}

const refreshClick = () => {
  // 触发刷新事件
  emit('refresh')
}

const lottieContainer = ref<HTMLElement | null>(null)
let animationInstance: ReturnType<typeof lottie.loadAnimation> | null = null

const clearAnimation = () => {
  // 清理旧的动画实例
  if (animationInstance) {
    animationInstance.destroy()
    animationInstance = null
  }
}

// 使用 watchEffect 监控 lottieContainer 的变化
watchEffect(() => {
  // 清理旧的动画实例
  clearAnimation()
  // 当元素存在时初始化动画
  if (lottieContainer.value && loadingAnimation) {
    animationInstance = lottie.loadAnimation({
      container: lottieContainer.value,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: loadingAnimation,
    })
  }
})

// 组件卸载时清理动画资源
onUnmounted(() => {
  clearAnimation()
})

const scrollAnchor = ref<HTMLElement | null>(null)

// 滚动到底部的方法
const scrollToBottom = async () => {
  await nextTick()
  if (scrollAnchor.value) {
    scrollAnchor.value.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }
}
</script>

<style lang="less" scoped>
:deep(.answer-info-wrapper) {
  &::-webkit-scrollbar-track {
    margin: 12px 0;
  }

  overscroll-behavior: contain;
}
</style>
