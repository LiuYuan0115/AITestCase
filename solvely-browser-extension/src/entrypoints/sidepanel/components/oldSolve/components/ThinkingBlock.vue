<template>
  <div class="flex flex-col gap-[9px] mb-[6px]">
    <div
      class="text-[14px] font-[400] leading-[140%] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark duration-200 transition-colors flex items-center gap-[4px] cursor-pointer"
      @click="toggleExpanded"
    >
      <div class="w-[20px] h-[20px] overflow-hidden">
        <Vue3Lottie
          v-if="!shouldShowDone"
          :animation-data="isDark ? animationThinkingLoadingDark : animationThinkingLoading"
          :width="20"
          :height="20"
          :loop="true"
          :autoplay="true"
        />
        <Vue3Lottie
          v-if="shouldShowDone"
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
    <Transition
      enter-active-class="transition-all duration-300 ease-in-out overflow-hidden"
      leave-active-class="transition-all duration-300 ease-in-out overflow-hidden"
      enter-from-class="opacity-0 -translate-y-[10px] max-h-0"
      enter-to-class="opacity-100 translate-y-0 max-h-[1000px]"
      leave-from-class="opacity-100 translate-y-0 max-h-[1000px]"
      leave-to-class="opacity-0 -translate-y-[10px] max-h-0"
    >
      <div
        v-if="isExpanded"
        class="text-[14px] font-[400] leading-[160%] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark duration-200 transition-colors border-l-[1px] border-l-s-border-secondary dark:border-l-s-border-secondary-dark pl-[8px] ml-[9px]"
      >
        <LatexFormat :text="data.thinking" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject, type ComputedRef } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { Vue3Lottie } from 'vue3-lottie'
import LatexFormat from '@/components/common/LatexFormat.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import animationThinkingLoading from '@/assets/animations/thinking-loading.json'
import animationThinkingLoadingDark from '@/assets/animations/thinking-loading-dark.json'
import animationThinkingDone from '@/assets/animations/thinking-done.json'
import animationThinkingDoneDark from '@/assets/animations/thinking-done-dark.json'
import { InjectionTokens } from '@/entrypoints/sidepanel/types/token'
import type { ThinkingData } from '../composables/types'

const { isDark } = useDarkMode()
const props = defineProps<{
  data: ThinkingData
  componentId?: string
  shouldClose?: boolean
}>()

const injectedStopState = inject<ComputedRef<boolean> | undefined>(InjectionTokens.IS_STOPPED)

const isExpanded = ref(true)
const currentDuration = ref<number>(0)
let timer: ReturnType<typeof setInterval> | null = null

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

// 计算完成状态（如果 API 没有提供，默认为 false 表示未完成）
const isDoneState = computed(() => props.data.isDone ?? false)
const isStopState = computed(() => injectedStopState?.value ?? false)

const shouldShowDone = computed(() => {
  return isDoneState.value || !!props.shouldClose || isStopState.value
})

const formatDuration = computed(() => {
  // 如果已完成，使用数据层计算的精确 duration
  if (isDoneState.value && props.data.duration) {
    return Math.max(1, Math.round(Number(props.data.duration) / 1000))
  }

  // 如果未完成，使用数据层提供的 startTime 计算实时 duration
  if (props.data.startTime) {
    const elapsed = isDoneState.value ? props.data.duration || 0 : Date.now() - props.data.startTime
    return Math.max(1, Math.round(elapsed / 1000))
  }

  // 降级：使用组件内部计时
  return Math.max(1, Math.round(currentDuration.value / 1000))
})

// 启动组件内部计时（降级方案）
onMounted(() => {
  const startTime = Date.now()

  timer = setInterval(() => {
    if (!isDoneState.value) {
      currentDuration.value = Date.now() - startTime
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

// 监听 thinking 状态，当结束时自动收起
watch(
  () => isDoneState.value,
  (newIsDone) => {
    if (newIsDone) {
      isExpanded.value = false
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }
)

watch(
  () => props.shouldClose,
  (need) => {
    if (need) {
      isExpanded.value = false
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }
)

watch(
  () => isStopState.value,
  (stopped) => {
    if (stopped) {
      isExpanded.value = false
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }
)
</script>
