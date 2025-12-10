<template>
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
    >
      <div
        class="text-[14px] font-[400] leading-[160%] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark duration-200 transition-colors border-l-[1px] border-l-s-border-secondary dark:border-l-s-border-secondary-dark pl-[8px] ml-[9px]"
      >
        <LatexFormat :text="data.thinking" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import type { ThinkingData } from '../composables/types'

const props = defineProps<{
  data: ThinkingData
  componentId?: string
  shouldClose?: boolean
}>()

/**
 * 初始展开/折叠状态
 * 优先级3：根据预加载数据决定初始状态
 * - 如果有 duration（完成/停止时保存的），说明是预加载数据，初始化为折叠
 * - 如果 isDone 为 true，说明已经完成，初始化为折叠
 * - 如果 isStopped 为 true，说明被停止，初始化为折叠
 * - 否则初始化为展开（正在进行中）
 */
const isExpanded = ref(!(props.data.duration || props.data.isDone || props.data.isStopped))
const currentDuration = ref<number>(0)
let timer: ReturnType<typeof setInterval> | null = null
const componentMountTime = Date.now() // 记录组件挂载时间（降级方案）

/**
 * 优先级1：用户手动控制（最高优先级）
 * 用户点击时切换展开/折叠状态，不会被自动收起覆盖
 */
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

/**
 * 状态计算（状态自包含，来自 props.data）
 * - isDoneState: thinking 是否完成
 * - isStopState: thinking 是否被用户停止
 */
const isDoneState = computed(() => props.data.isDone ?? false)
const isStopState = computed(() => props.data.isStopped ?? false)

/**
 * 格式化时长显示
 * 优化说明：
 * - 优先使用 props.data.duration（完成/停止时的精确值）
 * - 否则使用响应式的 currentDuration（进行中的实时值）
 * - 定时器会基于 API 的 startTime（如果有）计算 currentDuration，确保精确
 */
const formatDuration = computed(() => {
  // ✅ 修复：优先使用 props.data.duration（完成/停止时都有）
  if (props.data.duration) {
    return Math.max(1, Math.round(Number(props.data.duration) / 1000))
  }

  // 降级：使用组件内部计时（进行中的实时值）
  return Math.max(1, Math.round(currentDuration.value / 1000))
})

/**
 * thinking 状态文本（供父组件在 ModelHeader 的 slot 中显示）
 * 修复说明：
 * - 完成 或 停止 都显示 "thought for Xs"
 * - 只有进行中才显示 "is thinking (Xs)"
 */
const thinkingStatusText = computed(() => {
  // ✅ 修复：完成 或 停止 都显示 "thought for"
  const shouldShowDone = isDoneState.value || isStopState.value
  return shouldShowDone
    ? `thought for ${formatDuration.value}s`
    : `is thinking (${formatDuration.value}s)`
})

/**
 * 启动组件内部计时
 * 优化说明：
 * - 如果 API 提供了 startTime，基于它计算（更精确）
 * - 否则使用组件挂载时间（降级方案）
 * - currentDuration 每秒更新，触发 formatDuration 重新计算
 * - 立即执行第一次计算，避免从 1s 到 2s 的延迟
 * 修复说明：
 * - 如果已有 duration（完成/停止时保存的），停止更新
 */
onMounted(() => {
  // 定义更新函数（复用逻辑）
  const updateDuration = () => {
    // ✅ 修复：如果已有 duration（完成/停止时保存的），停止更新
    if (props.data.duration) {
      return
    }
    
    if (!isDoneState.value) {
      // ✅ 优先使用 API 的 startTime（更精确）
      if (props.data.startTime) {
        currentDuration.value = Date.now() - props.data.startTime
      } else {
        // 降级：使用组件挂载时间
        currentDuration.value = Date.now() - componentMountTime
      }
    }
  }

  // ✅ 立即执行第一次计算（不等待 1000ms）
  updateDuration()

  // 然后每秒执行一次
  timer = setInterval(updateDuration, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

/**
 * 优先级2：状态变化时自动收起
 * 关键：只在状态从 false → true 的瞬间触发，避免覆盖用户手动操作
 */
watch(
  () => isDoneState.value,
  (newVal, oldVal) => {
    // 只在从"未完成"变为"完成"时自动收起
    if (!oldVal && newVal) {
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
  (newVal, oldVal) => {
    // 只在从"未停止"变为"停止"时自动收起
    if (!oldVal && newVal) {
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
  (newVal, oldVal) => {
    // 只在从 false → true 时触发
    if (!oldVal && newVal) {
      isExpanded.value = false
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }
)

// 暴露状态和方法供父组件使用
defineExpose({
  isExpanded,
  toggleExpanded,
  thinkingStatusText,
  isDoneState,
})
</script>
