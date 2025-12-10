<script setup lang="ts">
import LatexFormat from '@/components/common/LatexFormat.vue'
import trackEvent from '~/utils/trackEvent'
import {
  ref,
  inject,
  computed,
} from 'vue'
import { useQuoteManager } from '@/composables/content/useQuoteManager'
import useABTest from '@/composables/useABTest'

// 定义组件属性
const props = defineProps<{
  answer: string | undefined
  steps: {
    stepTitle: string
    stepContent: string
  }[]
  totalData?: any // 外部传入的 visibleSolutions（数组）
  index: number // 当前题目的下标，由父组件传入
}>()

// 注入用户内容
const userContent = inject('user-content')

// AB 测试控制

const data = computed(() => {
  // 渲染用数据（保持原样，不变异 props）
  const arr = Array.isArray(props.steps) ? [...props.steps] : []
  if (props.answer) {
    arr.push({ stepTitle: 'Answer', stepContent: props.answer })
  }
  return arr
})

/**
 * 获取当前步骤的引用内容（适配AnswerInfoJson数据结构）
 */
const getStepQuote = (stepData: { stepTitle: string; stepContent: string }) => {
  const title = stepData.stepTitle || ''
  const content = stepData.stepContent || ''
  return `${title} ${content}`.trim()
}

const getStepQuoteContent = (stepData: {
  stepTitle: string
  stepContent: string
}) => {
  const content = stepData.stepContent || ''
  return `${content}`.trim()
}

/**
 * 获取当前题目的数据（从 visibleSolutions 与 index 推导）
 */
const getCurrentQuestion = () => {
  const arr = Array.isArray(props.totalData) ? props.totalData : []
  const q = arr[props.index]
  return q || null
}

/**
 * 从 totalData(visibleSolutions) 中获取完整答案文本（当前题）
 */
const getFullAnswerText = () => {
  const q = getCurrentQuestion()
  if (!q) return ''
  const stepsText = Array.isArray(q.steps)
    ? q.steps.map((s: any) => `${s.stepTitle}\n${s.stepContent}`).join('\n\n')
    : ''
  const finalAnswer = q.answer ? `\n${q.answer}` : ''
  const questionGoal = q.questionGoal ? `\n${q.questionGoal}` : ''
  return `${questionGoal}${stepsText}${finalAnswer}`.trim()
}

/**
 * 获取用户消息内容 */
const getUserMessage = () => {
  if (!userContent) return ''
  const { type, value, prompt } = userContent as any
  let messageContent = ''
  if (prompt && typeof prompt === 'string' && prompt.trim()) {
    messageContent += prompt.trim()
  }
  switch (type) {
    case 'text':
    case 'text_solve':
    case 'selection':
      if (value && typeof value === 'string' && value.trim()) {
        if (messageContent) messageContent += '\n'
        messageContent += value.trim()
      }
      break
    default:
      break
  }
  return messageContent.trim()
}

/**
 * 处理问号按钮点击事件
 */
const handleQuestionClick = (
  stepData: { stepTitle: string; stepContent: string },
  elementIndex: number
) => {
  
  // 埋点
  trackEvent.track('Plugin_Sidebar_Quote_Click', {
    from: 'step',
  })

  const stepQuote = getStepQuote(stepData)
  const stepQuoteContent = getStepQuoteContent(stepData)
  const fullAnswer = getFullAnswerText()
  const userMessage = getUserMessage()
  const allText = `${userMessage}\n${fullAnswer}`

  console.log('🟦 选取的步骤块（标题＋内容）：\n', stepQuote)
  console.log('🟩 选取的步骤块（内容）：\n', stepQuoteContent)
  console.log(
    `🟨 第 ${props.index + 1} 题的全部文字（排除Thinking）：\n`,
    allText
  )

  const stepQuoteManager = useQuoteManager()
  stepQuoteManager.updateContext({
    allText: allText,
    stepText: stepQuoteContent,
    stepTitleAndText: stepQuote,
    from: 'step',
  })
}

</script>

<template>
  <div class="flex flex-col gap-[10px]">
    <template v-for="(step, index) in data" :key="index">
      <div class="step-block" :data-index="index">
        <!-- 左侧指示器：包含数字角标和竖线 -->
        <div class="step-indicator">
          <div class="step-index">
            {{ index + 1 }}
          </div>
          <div class="vertical-line"></div>
        </div>

        <!-- 右侧内容区域 -->
        <div class="content-wrapper">
          <div class="content">
            <div class="content-inner">
              <h3 class="title flex quote_title" 
                  @click="handleQuestionClick(step, index)">
                <LatexFormat :text="step.stepTitle" :key="index" />
              </h3>
              <p class="text">
                <LatexFormat :text="step.stepContent" :key="index" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 基础布局 */
.step-block {
  @apply relative z-0 flex rounded-lg p-0;
}

.step-block.is-active {
  @apply z-10;
}

/* 左侧指示器样式 */
.step-indicator {
  @apply absolute left-0 top-0 bottom-0 w-5 flex flex-shrink-0 select-none flex-col items-center;
}

/* 竖线样式 */
.vertical-line {
  @apply relative mt-[5px] mb-[4px] w-[1px] flex-1 bg-s-border-secondary dark:bg-s-border-secondary-dark transition-colors duration-200;
}

/* 数字角标样式 */
.step-index {
  @apply flex h-[20px] w-[20px] items-center justify-center rounded-full bg-s-border-secondary dark:bg-s-border-secondary-dark font-sans text-xs font-medium leading-[130%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200;
}

/* 内容区域样式 */
.content-wrapper {
  @apply relative w-full ml-[28px] overflow-x-auto;
}

/* hover 和 active 状态样式 */
.step-block:hover .vertical-line,
.step-block.is-active .vertical-line,
.step-block.is-hover .vertical-line {
  @apply bg-s-text-brand dark:bg-s-text-brand-dark;
}

.step-block:hover .step-index,
.step-block.is-active .step-index,
.step-block.is-hover .step-index {
  @apply bg-s-text-brand dark:bg-s-text-brand-dark text-s-interface-bg dark:text-s-interface-bg-dark;
}

/* 内容容器样式 */
.content {
  @apply w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-[4px] transition-all duration-200;
}

.content.is-active {
  @apply bg-s-panel-bg dark:bg-s-panel-bg-dark;
}

.content-inner {
  @apply flex w-full min-w-0 flex-col gap-[6px];
}

/* 文本样式 */
.title {
  @apply text-[14px] font-[600] leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors;
}

:deep(.title mjx-container) {
  @apply m-0;
}

.text {
  @apply font-[400] text-[14px] leading-[160%];
  :deep(.math-inline) {
    @apply align-middle;
  }
  :deep(.math-inline mjx-container) {
    @apply my-0;
  }
}

.quote_title {
  position: relative;
  pointer-events: none;
}

:deep(.quote_title #setText > div::after) {
  content: '?';
  display: inline-block;
  width: 17.5px;
  height: 17.5px;
  margin-left: 6px;
  cursor: pointer;
  border-radius: 50%;
  font-size: 13px;
  line-height: 16px;
  font-weight: 900;
  text-align: center;
  pointer-events: auto;
  @apply text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark;
  @apply border border-s-text-high-emphasis dark:border-s-text-high-emphasis-dark;
  @apply hover:bg-[#ECF5FF] dark:hover:bg-[#324B69];
}
</style>
