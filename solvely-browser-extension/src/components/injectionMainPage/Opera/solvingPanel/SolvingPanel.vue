<template>
  <div
    v-if="isShow"
    ref="dragElement"
    :class="[
      'main-panel-container fixed select-none',
      'w-[420px] max-h-[660px] min-h-[308px]',
      'px-[16px] pt-[24px] pb-[16px]',
      'shadow-[0px_10px_40px_0px_rgba(120,118,128,0.12)]',
      'border-2 border-white rounded-[24px]',
      'inline-flex justify-center items-start overflow-hidden',
    ]"
    :style="{
      right: `${position.x}px`,
      top: `${position.y}px`,
      zIndex: position.z,
    }"
  >
    <!-- 拖拽手柄 -->
    <SvgIcon
      name="solvingPanel/grab-handle"
      size="40"
      class="left-1/2 -translate-x-1/2 top-0 absolute overflow-hidden active:cursor-grabbing"
    />
    <div
      class="absolute top-0 left-[16px] right-[50px] h-[60px] cursor-grab"
      @mousedown="dargPanel"
    ></div>

    <!-- 解题面板主体 -->
    <div
      class="flex-1 inline-flex flex-col justify-start items-start gap-[20px]"
    >
      <!-- header -->
      <div
        class="self-stretch inline-flex justify-between items-center rounded-[12px]"
      >
        <!-- title -->
        <img
          src="@/assets/images/logo-title.webp"
          alt="solvely-ai"
          class="w-[104px] h-[24px]"
        />

        <!-- close button -->
        <button @click.stop="handleCloseClick">
          <SvgIcon name="solvingPanel/panel-close" size="24" />
        </button>
      </div>

      <div
        class="self-stretch flex flex-col justify-start items-start gap-[16px]"
      >
        <!-- question -->
        <Question
          :image-url="questionImageUrl"
          :is-login="!isNoLogin"
          ref="questionRef"
          @updateQuestionExpanded="handleUpdateQuestionExpanded"
        />

        <ExampleSolution v-if="isExample" />

        <NoLoginSolution v-else-if="isNoLogin" />

        <template v-else>
          <!-- solution -->
          <Solution
            ref="solutionRef"
            :is-loading="props.isLoading"
            :is-out-limit="props.isOutLimit"
            :is-network-error="props.isNetworkError"
            :is-answering="props.isAnswering"
            :current-answer="props.currentAnswer"
            :is-question-expanded="isQuestionExpanded"
            @retry="emit('retry')"
            @refresh="emit('refresh')"
          />

          <div v-if="props.currentAnswer.answer" class="w-full flex gap-[12px]">
            <Button
              icon="cut"
              type="submit"
              class="flex-1"
              @click="handleToNextQuestionClick"
              >Next question</Button
            >
            <Button icon="ask" class="flex-1" @click="handleAskFollowupClick"
              >Ask Follow-up</Button
            >
            <Button
              icon="history"
              type="icon-only"
              @click="handleToHistoryClick"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, nextTick, provide, type Ref } from 'vue'
import Question from './question/Question.vue'
import Solution from './solution/Solution.vue'
import Button from '@/components/common/Button.vue'
import { useDrag } from '@/composables/content/useDrag'
import type { PanelControls } from './types'
import trackEvent from '@/utils/trackEvent'
import ExampleSolution from './solution/ExampleSolution.vue'
import NoLoginSolution from './solution/NoLoginSolution.vue'
import exampleQuestionImg from '@/assets/images/onboarding/example-question.webp'

const props = defineProps<{
  isLoading: boolean
  isOutLimit: boolean
  isNetworkError: boolean
  isAnswering: boolean
  currentAnswer: any
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

const handleCloseClick = () => {
  if (
    window.location.href.split('?')[0] ===
    import.meta.env.VITE_ONBOARDING_PAGE_URL
  ) {
    trackEvent.track('Plugin_onboarding_panel_close')
  }
  closePanel('click-button')
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

const dargPanel = (e: MouseEvent) => {
  startDrag(e)
  trackEvent.track('Plugin_Solve_panel_drag')
}

const handleToNextQuestionClick = () => {
  // 答案面板，用户点击问新问题
  trackEvent.track('Plugin_Solve_asknew')
  emit('toCut')
}

const handleAskFollowupClick = () => {
  // 答案面板，用户点击followup
  trackEvent.track('Plugin_Solve_followup')
  window.open(
    `${import.meta.env.VITE_SOLVELY_URL}/history/${
      props.currentAnswer.questionId
    }`,
    '_blank',
    'noreferrer'
  )
}

const handleToHistoryClick = () => {
  // 答案面板，用户点击历史
  trackEvent.track('Plugin_Solve_history')
  window.open(
    `${import.meta.env.VITE_SOLVELY_URL}/history`,
    '_blank',
    'noreferrer'
  )
}

const handleUpdateQuestionExpanded = (isExpanded: boolean) => {
  isQuestionExpanded.value = isExpanded
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
