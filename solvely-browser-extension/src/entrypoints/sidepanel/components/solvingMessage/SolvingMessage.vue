<template>
    <Solution
      ref="solutionRef"
      :is-loading="props.isLoading"
      :is-out-limit="props.isOutLimit"
      :is-network-error="props.isNetworkError"
      :is-answering="props.isAnswering"
      :current-answer="props.currentAnswer"
      :is-question-expanded="isQuestionExpanded"
      :is-stop="props.isStop"
      @retry="emit('retry')"
      @refresh="emit('refresh')"
    />
</template>

<script lang="ts" setup>
import { ref, nextTick, provide, type Ref } from 'vue'
import { useDrag } from '@/composables/content/useDrag'
import trackEvent from '@/utils/trackEvent'
import Solution from './solution/Solution.vue'
import type { PanelControls } from './types'
import exampleQuestionImg from '@/assets/images/onboarding/example-question.webp'

const props = defineProps<{
  isLoading: boolean
  isOutLimit: boolean
  isNetworkError: boolean
  isAnswering: boolean
  currentAnswer: any
  isStop: boolean
}>()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'toCut'): void
}>()

// ==================== 状态变量 ====================
const dragElement = ref<HTMLElement | null>(null)
const questionImageUrl = ref<string>('')
const isShow = ref(false)
const isExample = ref(false)
const isNoLogin = ref(false)
const isQuestionExpanded = ref(false)

// ==================== 拖拽控制 ====================
const { position, startDrag, checkAndUpdatePosition } = useDrag(dragElement, {
  boundToWindow: true,
})

// ==================== 面板控制 ====================
const openPanel = (imgData: {
  canvas: HTMLCanvasElement
  cutDataUrl: string
}) => {
  const { canvas, cutDataUrl } = imgData

  questionImageUrl.value = cutDataUrl
  isShow.value = true
  isExample.value = false
  isNoLogin.value = false

  // 确保面板打开时位置合理（在DOM更新后）
  nextTick(() => checkAndUpdatePosition())
}

const openExamplePanel = () => {
  isShow.value = true
  isExample.value = true
  questionImageUrl.value = exampleQuestionImg
}

const openNoLoginPanel = (imgData: {
  canvas: HTMLCanvasElement
  cutDataUrl: string
}) => {
  isShow.value = true
  isNoLogin.value = true
  questionImageUrl.value = imgData.cutDataUrl
}

// source: 关闭来源, 默认是其他, 为了区分点击关闭和其他关闭
const closePanel = (source: string = 'other') => {
  isShow.value = false
  questionImageUrl.value = ''
  console.log('[closePanel] 关闭面板 emit close', source)
  trackEvent.track('Plugin_Solve_panel_close', {
    source,
  })
  emit('close')
}

// ==================== 生命周期钩子 ====================
defineExpose({
  openPanel,
  openExamplePanel,
  openNoLoginPanel,
  closePanel,
  updatePanelPosition: checkAndUpdatePosition,
})

provide('panelControls', {
  openPanel,
  openExamplePanel,
  openNoLoginPanel,
  closePanel,
  updatePanelPosition: checkAndUpdatePosition,
} as PanelControls)
</script>
<style lang="less">
.main-panel-container {
  background-image: url('@/assets/images/panel-bg.webp');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
