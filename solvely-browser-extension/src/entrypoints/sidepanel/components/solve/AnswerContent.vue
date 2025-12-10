<template>
  <div class="answer-content">
    <!-- 统一的模型头部：在有有效组件且非 loading 状态时显示 -->
    <ModelHeader :model-id="modelId">
      <!-- 如果第一个有效组件是 ThinkingBlock，将其状态插入这里 -->
      <template v-if="firstThinkingComponent && thinkingBlockRef">
        <span
          class="cursor-pointer"
          @click="thinkingBlockRef?.toggleExpanded()"
        >
          {{ thinkingBlockRef.thinkingStatusText }}
        </span>
        <SvgIcon
          name="arrow-down2"
          class="transition-transform duration-300 ease-in-out cursor-pointer"
          :class="[{ 'rotate-180': thinkingBlockRef.isExpanded }]"
          @click="thinkingBlockRef?.toggleExpanded()"
        />
      </template>
    </ModelHeader>

    <!-- 加载状态：loading 或 streaming 但没有有效组件 -->
    <LoadingState v-if="shouldShowLoading" />

    <!-- 流式输出：有有效组件时才显示 -->
    <template v-else-if="hasValidComponent">
      <component
        v-for="(comp, idx) in sortedComponents"
        :key="comp.id"
        :is="getComponent(comp.type)"
        :ref="setThinkingRef(comp, idx)"
        :data="comp.data"
        :component-id="comp.id"
        :model-id="modelId"
        @quote="handleQuote"
        @switch-model="handleSwitchModel"
        @no-balance-ready="handleNoBalanceReady"
      />
    </template>

    <!-- 网络错误状态（针对当前模型） -->
    <div
      v-if="status === 'error' && !modelResult.isStopped"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-status-error dark:text-status-error-dark">Network error. Please try again.</div>
      <div
        class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk cursor-pointer"
        @click="handleRetry"
      >
        <SvgIcon
          name="try-again"
          size="20"
        />
        <span>Try again</span>
      </div>
    </div>

    <!-- 停止提示（针对当前模型） -->
    <div
      v-if="modelResult.isStopped"
      class="text-[14px] leading-[140%] text-t_3 dark:text-t_3_dk"
    >
      You stopped this response
    </div>

    <!-- 操作按钮：显示在答案内部 -->
    <AnswerActions
      v-if="showActions"
      :is-liked="modelResult.isLiked || false"
      :is-disliked="modelResult.isDisliked || false"
      :show-retry="true"
      :is-stop="modelResult.isStopped || false"
      @like="handleLike"
      @dislike="handleDislike"
      @copy="handleCopy"
      @retry="handleRetry"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Component, SolveStatus, ModelResult } from './composables/types'
import AnswerActions from './actions/AnswerActions.vue'
import SvgIcon from '~/components/common/SvgIcon.vue'

// 导入渲染组件
import QuestionsStepStyle from './components/QuestionsStepStyle.vue'
import FinalAnswer from './components/FinalAnswer.vue'
import QuestionSingle from './components/QuestionSingle.vue'
import QuestionMultiple from './components/QuestionMultiple.vue'
import ThinkingBlock from './components/ThinkingBlock.vue'
import Markdown from './components/Markdown.vue'
import LoadingState from './components/LoadingState.vue'
import ModelHeader from './components/ModelHeader.vue'

const props = defineProps<{
  modelId: string // 当前模型 ID
  modelResult: ModelResult // 完整的模型结果
  components: Component[]
  status: SolveStatus
  isUploading?: boolean // 图片上传状态
  showActions?: boolean // 是否显示操作按钮
}>()

const emit = defineEmits<{
  (e: 'quote', content: any): void
  (e: 'switchModel', modelId: string): void
  (e: 'like', modelId: string, isLike: boolean): void
  (e: 'copy', modelId: string): void
  (e: 'retry', modelId: string): void
  (e: 'noBalanceReady'): void
}>()

// 组件映射表（根据 componentType）
const componentMap: Record<string, any> = {
  questions_step_style: QuestionsStepStyle,
  final_answer: FinalAnswer,
  question_single: QuestionSingle,
  question_multiple: QuestionMultiple,
  question_thinking: ThinkingBlock,
  markdown: Markdown,
}

const getComponent = (type: string) => {
  return componentMap[type]
}

const sortedComponents = computed(() => {
  // 按数据到达顺序渲染，不使用 sortId 排序
  return props.components
})

// 判断是否有有效组件（在 componentMap 中）
const hasValidComponent = computed(() => {
  return props.components.some((comp) => componentMap[comp.type])
})

// ThinkingBlock 组件的引用
const thinkingBlockRef = ref<InstanceType<typeof ThinkingBlock> | null>(null)

// 获取第一个 ThinkingBlock 组件
const firstThinkingComponent = computed(() => {
  return props.components.find((comp) => comp.type === 'question_thinking')
})

// 设置 ThinkingBlock 的 ref（只获取第一个）
function setThinkingRef(comp: Component, idx: number) {
  if (comp.type === 'question_thinking' && idx === 0) {
    return (el: any) => {
      thinkingBlockRef.value = el
    }
  }
  return undefined
}

// 判断是否应该显示 loading
const shouldShowLoading = computed(() => {
  // 1. 正在上传图片，显示 loading
  if (props.isUploading) {
    return true
  }

  // 2. answer 处于 loading 状态，显示 loading
  if (props.status === 'loading') {
    return true
  }

  // 3. 已经进入 streaming/done，但还没有有效组件，继续显示 loading
  if ((props.status === 'streaming' || props.status === 'done') && !hasValidComponent.value) {
    return true
  }

  // 4. 其他情况不显示 loading
  return false
})

// 判断是否显示操作按钮
const showActions = computed(() => {
  // 1. 必须开启显示
  if (!props.showActions) return false

  // 2. 已停止的不显示
  if (props.modelResult.isStopped) return false

  // 3. 状态为 done 时显示
  if (props.status === 'done') return true

  // 4. 错误状态不显示（已有重试按钮）
  if (props.status === 'error') return false

  return false
})

const handleQuote = (content: any) => {
  emit('quote', content)
}

const handleSwitchModel = (modelId: string) => {
  emit('switchModel', modelId)
}

const handleLike = () => {
  emit('like', props.modelId, true)
}

const handleDislike = () => {
  emit('like', props.modelId, false)
}

const handleCopy = () => {
  emit('copy', props.modelId)
}

const handleRetry = () => {
  emit('retry', props.modelId)
}

const handleNoBalanceReady = () => {
  emit('noBalanceReady')
}
</script>

<style scoped>
.answer-content {
  @apply flex flex-col gap-[10px] w-full;
}
</style>
