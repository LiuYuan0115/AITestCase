<script setup>
import LatexFormat from '@/components/common/LatexFormat.vue'
import { ref, inject } from 'vue'
import { useQuoteManager } from '@/composables/content/useQuoteManager'
import useABTest from '@/composables/useABTest'

// 定义组件属性
const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  stepIndex: {
    type: Number,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isHover: {
    type: Boolean,
    default: false,
  },
  totalData: {
    type: Object,
    default: {},
  },
})

// 注入用户内容
const userContent = inject('user-content')

// AB 测试控制
/**
 * 获取当前步骤的引用内容（包括标题）
 */
const getStepQuote = (stepData) => {
  if (stepData.contents && stepData.contents.length > 0) {
    const titleContent = stepData.contents.find((content) => content.type === 'title')
    const bodyContent = stepData.contents.find((content) => content.type === 'body')

    const title = titleContent?.text || ''
    const body = bodyContent?.text || ''

    return `${title} ${body}`.trim()
  }

  return ''
}

/**
 * 从 totalData.answer 中剔除 thinking.content
 */
const getFullAnswerText = () => {
  const originalAnswer = props.totalData?.answer || ''
  const thingkingContent = props.totalData?.answerJsonObject?.thinking?.content || ''
  const fullAnswer = originalAnswer.replace(thingkingContent, '').trim()
  console.log('========排除了thingking的全量fullAnswer=======\n', fullAnswer)
  return fullAnswer
}

/**
 * 获取用户消息内容 */
const getUserMessage = () => {
  if (!userContent) return ''
  const { type, value, prompt } = userContent
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

const getStepTextContent = (stepData) => {
  const title = stepData.contents.find((content) => content.type === 'title')
  const body = stepData.contents.find((content) => content.type === 'body')
  return `${title.text}${body.text}`
}

const getStepText = (stepData) => {
  const body = stepData.contents.find((content) => content.type === 'body')
  return `${body.text}`
}

/**
 * 处理问号按钮点击事件
 */
const handleQuestionClick = (event) => {
  // 阻止事件冒泡
  event.stopPropagation()

  // 埋点
  trackEvent.track('Plugin_Sidebar_Quote_Click', {
    from: 'step',
  })

  // 使用 StepQuote 管理器处理上下文
  const stepQuoteManager = useQuoteManager()

  // 构建全量文本（已过滤掉Thinking内容）
  const fullAnswer = getFullAnswerText()
  const userMessage = getUserMessage()
  const allText = `${userMessage}\n${fullAnswer}`
  const stepTitleAndText = getStepTextContent(props.data)
  const stepText = getStepText(props.data)

  // 更新上下文（日志会在 useQuoteManager 中输出）
  stepQuoteManager.updateContext({
    allText,
    stepText,
    stepTitleAndText,
    from: 'step',
  })
}
</script>

<template>
  <div
    class="step-block"
    :class="{ 'is-active': isActive, 'is-hover': isHover }"
  >
    <!-- 左侧指示器：包含数字角标和竖线 -->
    <div class="step-indicator">
      <div class="step-index">
        <slot name="index">1</slot>
      </div>
      <div class="vertical-line"></div>
    </div>

    <!-- 右侧内容区域 -->
    <div class="content-wrapper">
      <div
        class="content"
        :class="{ 'is-active': isActive }"
      >
        <div class="content-inner">
          <template
            v-for="(content, index) in data.contents"
            :key="index"
          >
            <h3
              v-if="content.type === 'title'"
              class="title flex"
              :class="{ quote_title: isSidePanelSupported() }"
              @click="handleQuestionClick"
            >
              <LatexFormat
                :text="content.text"
                :key="index"
              />
            </h3>
            <p
              v-else-if="content.type === 'body'"
              class="text"
            >
              <LatexFormat
                :text="content.text"
                :key="index"
              />
            </p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.step-block {
  @apply relative z-0 flex rounded-lg p-0 w-full;
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
  @apply bg-s-text-brand dark:bg-s-text-brand-dark text-s-interface-bg;
}

/* 内容容器样式 */
.content {
  @apply w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-[4px] transition-all duration-200;
}

.content.is-active {
  @apply bg-s-panel-bg dark:bg-s-panel-bg-dark;
}

.content-inner {
  @apply flex w-full min-w-0 flex-col gap-[6px] overflow-x-auto;
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
