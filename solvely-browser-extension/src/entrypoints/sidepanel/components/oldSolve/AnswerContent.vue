<template>
  <div class="answer-content">
    <!-- 加载状态：loading 或 streaming 但没有有效组件 -->
    <LoadingState v-if="shouldShowLoading" />

    <!-- 流式输出：有有效组件时才显示 -->
    <template v-else-if="hasValidComponent">
      <component
        v-for="comp in sortedComponents"
        :key="comp.id"
        :is="getComponent(comp.type)"
        :data="comp.data"
        :component-id="comp.id"
        @quote="handleQuote"
      />
    </template>

    <!-- 错误状态（这里不渲染，由父组件处理） -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component, SolveStatus } from './composables/types'

// 导入渲染组件
import QuestionsStepStyle from './components/QuestionsStepStyle.vue'
import FinalAnswer from './components/FinalAnswer.vue'
import QuestionSingle from './components/QuestionSingle.vue'
import QuestionMultiple from './components/QuestionMultiple.vue'
import ThinkingBlock from './components/ThinkingBlock.vue'
import Markdown from './components/Markdown.vue'
import LoadingState from './components/LoadingState.vue'

const props = defineProps<{
  components: Component[]
  status: SolveStatus
  isUploading?: boolean // 图片上传状态
}>()

const emit = defineEmits<{
  (e: 'quote', content: any): void
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
  const comp = componentMap[type]
  return comp
}

const sortedComponents = computed(() => {
  // 按数据到达顺序渲染，不使用 sortId 排序
  return props.components
})

// 判断是否有有效组件（在 componentMap 中）
const hasValidComponent = computed(() => {
  return props.components.some((comp) => componentMap[comp.type])
})

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

const handleQuote = (content: any) => {
  emit('quote', content)
}
</script>

<style scoped>
.answer-content {
  @apply flex flex-col gap-[10px] w-full;
}
</style>
