<template>
  <div class="flex flex-col gap-[9px] mb-[6px]">
    <div
      class="text-[14px] font-[400] leading-[140%] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark duration-200 transition-colors flex items-center gap-[4px] cursor-pointer"
      @click="toggleExpanded"
    >
      <div class="w-[20px] h-[20px] overflow-hidden">
        <Vue3Lottie
          v-if="!data.contents[0].isDone && !shouldClose"
          :animation-data="isDark ? animationThinkingLoadingDark : animationThinkingLoading"
          :width="20"
          :height="20"
          :loop="true"
          :autoplay="true"
        />
        <Vue3Lottie
          :animation-data="isDark ? animationThinkingDoneDark : animationThinkingDone"
          :width="20"
          :height="20"
          :loop="false"
          :autoplay="true"
        />
      </div>
      Thinking for {{ formatDuration }}s
      <SvgIcon
        name="arrow-down2"
        class="transition-transform duration-300 ease-in-out"
        :class="[{ 'rotate-180': isExpanded }]"
      />
    </div>
    <Transition name="thinking-expand">
      <div
        v-if="isExpanded"
        class="thinking-content text-[14px] font-[400] leading-[160%] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark duration-200 transition-colors border-l-[1px] border-l-s-border-secondary dark:border-l-s-border-secondary-dark pl-[8px] ml-[9px]"
      >
        <LatexFormat :text="data.contents[0].content" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { Vue3Lottie } from 'vue3-lottie'
import LatexFormat from '@/components/common/LatexFormat.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import animationThinkingLoading from '@/assets/animations/thinking-loading.json'
import animationThinkingLoadingDark from '@/assets/animations/thinking-loading-dark.json'
import animationThinkingDone from '@/assets/animations/thinking-done.json'
import animationThinkingDoneDark from '@/assets/animations/thinking-done-dark.json'
import trackEvent from '~/utils/trackEvent'

const { isDark } = useDarkMode()
const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  // 默认不关闭
  shouldClose: {
    type: Boolean,
    default: false,
  },
})

const isExpanded = ref(true)

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const formatDuration = computed(() => {
  return Math.max(1, Math.round(Number(props.data.contents[0].duration) / 1000))
})

// 监听 thinking 状态，当结束时自动收起
watch(
  () => props.data.contents[0].isDone,
  (newIsDone) => {
    if (newIsDone) {
      isExpanded.value = false
    }
  }
)

watch(
  () => props.shouldClose,
  (need) => {
    if (need) {
      isExpanded.value = false
    }
  }
)
</script>

<style scoped>
.thinking-content {
  :deep(.math-inline) {
    @apply align-middle;
  }
  :deep(.math-inline mjx-container) {
    @apply my-0;
  }
}
/* Transition 动画样式 */
.thinking-expand-enter-active,
.thinking-expand-leave-active {
  transition: all 0.3s ease-in-out;
  overflow: hidden;
}
.thinking-expand-enter-from,
.thinking-expand-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}
.thinking-expand-enter-to,
.thinking-expand-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 1000px;
}
</style>
