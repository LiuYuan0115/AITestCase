<template>
  <div class="questions-step-style">
    <template
      v-for="(question, qIndex) in props.data.questions"
      :key="qIndex"
    >
      <div
        v-if="promptIndex === -1 || qIndex <= promptIndex"
        :class="[
          'flex flex-col gap-[12px] w-full',
          qIndex > 0
            ? 'mt-[18px] pt-[18px] border-t border-s-border dark:border-s-border-dark transition-colors duration-200'
            : '',
        ]"
      >
        <div class="flex flex-col gap-[8px] w-full">
          <h3
            class="text-[16px] font-[700] leading-[140%] text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200"
          >
            <span v-if="shouldShowNumbered">Question {{ question.number || qIndex + 1 }}</span>
            <span v-else>Explanation</span>
          </h3>
          <p
            v-if="getQuestionText(question) && qIndex !== promptIndex"
            class="text-[14px] font-[600] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200 w-full overflow-x-auto"
          >
            <LatexFormat :text="getQuestionText(question)" />
          </p>
        </div>

        <template v-if="promptIndex === -1 || qIndex < promptIndex">
          <div class="flex flex-col gap-[12px]">
            <div
              v-for="(step, sIndex) in renderedSteps[qIndex] || []"
              :key="`${qIndex}-${sIndex}-${step.title || step.content}`"
              class="relative z-0 flex rounded-lg p-0 w-full"
            >
              <div class="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center select-none">
                <div
                  class="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-s-border-secondary dark:bg-s-border-secondary-dark text-xs font-medium leading-[130%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
                >
                  {{ sIndex + 1 }}
                </div>
                <div
                  v-if="sIndex < (renderedSteps[qIndex]?.length || 0) - 1"
                  class="relative mt-[5px] mb-[4px] w-[1px] flex-1 bg-s-border-secondary dark:bg-s-border-secondary-dark transition-colors duration-200"
                />
              </div>

              <div class="relative w-full ml-[28px] overflow-x-auto">
                <div class="flex w-full min-w-0 flex-col gap-[6px] overflow-x-auto rounded-[4px]">
                  <h4
                    v-if="step.title"
                    class="text-[14px] font-[600] leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200 quote_title"
                    @click="handleQuestionClick($event, qIndex, sIndex, step)"
                  >
                    <LatexFormat :text="step.title" />
                  </h4>
                  <div
                    class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
                  >
                    <LatexFormat :text="step.content" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="qIndex === promptIndex">
          <NoBalancePrompt class="mt-4" />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted } from 'vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import NoBalancePrompt from '../../NoBalanceSubscriptionPrompt.vue'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import trackEvent from '@/utils/trackEvent'
import type { QuestionsStepStyleData } from '../composables/types'
import { useQuoteManager } from '@/composables/content/useQuoteManager'

const props = defineProps<{
  data: QuestionsStepStyleData
  componentId?: string
}>()

const subscription = useSubscription
const onInsufficientBalance = inject<() => void>('on-insufficient-balance')
const userContent = inject<any>('user-content')

const isSubscribed = computed(() => subscription.isSubscribed.value)

// ===== 引用功能逻辑 =====

/**
 * 获取用户消息内容
 */
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

/**
 * 获取完整答案文本（从当前组件的数据构建）
 */
const getFullAnswerText = () => {
  const questions = props.data.questions || []
  return questions
    .map((q, index) => {
      const questionTitle = q.title || ''
      const steps = q.steps || []
      const stepsText = steps.map((s: any) => `${s.title || ''} ${s.content || ''}`).join('\n')
      const answer = q.answer || ''
      return `Question ${index + 1}:\n${questionTitle}\n${stepsText}\n${answer}`
    })
    .join('\n\n')
    .trim()
}

/**
 * 获取步骤文本（标题+内容）
 */
const getStepTextContent = (step: any) => {
  const title = step.title || ''
  const content = step.content || ''
  return `${title}${content}`.trim()
}

/**
 * 获取步骤文本（仅内容）
 */
const getStepText = (step: any) => {
  return step.content || ''
}

/**
 * 处理问号按钮点击事件
 */
const handleQuestionClick = (event: Event, questionIndex: number, stepIndex: number, step: any) => {
  // 阻止事件冒泡
  event.stopPropagation()

  // 埋点
  trackEvent.track('Plugin_SolveV9_Quote_Click', {
    from: 'step',
    questionIndex,
    stepIndex,
  })

  // 使用引用管理器处理上下文
  const stepQuoteManager = useQuoteManager()

  // 构建全量文本
  const fullAnswer = getFullAnswerText()
  const userMessage = getUserMessage()
  const allText = `${userMessage}\n${fullAnswer}`.trim()
  const stepTitleAndText = getStepTextContent(step)
  const stepText = getStepText(step)

  // 更新上下文（日志会在 useQuoteManager 中输出）
  stepQuoteManager.updateContext({
    allText,
    stepText,
    stepTitleAndText,
    from: 'step',
  })
}

// ===== 余额管理逻辑（复用自 Questions.vue） =====
const snapshotAvailable = ref<number | null>(null)

// 计算可用余额
const pluginBalance = computed(() => {
  if (snapshotAvailable.value !== null) return snapshotAvailable.value
  const ub = subscription.userBalance.value
  const plugin = Number(ub?.plugin ?? 0)
  const accountBalance = Number(ub?.balance ?? 0)
  const walletCredits = Math.floor(accountBalance / 10)
  return Math.max(0, plugin + walletCredits)
})

// 计算需要显示订阅提示的题目索引
const promptIndex = computed(() => {
  if (isSubscribed.value) return -1
  const bal = Number(pluginBalance.value) || 0
  const questionCount = props.data.questions?.length || 0
  return bal < questionCount ? bal : -1
})

const shouldShowNumbered = computed(() => {
  return (props.data.questions?.length || 0) > 1
})

const getQuestionText = (question: any) => {
  return question?.title || question?.question || ''
}

const renderedSteps = computed(() => {
  const questions = props.data.questions || []
  const pausedIndex = promptIndex.value

  return questions.map((question, qIndex) => {
    const steps = (question.steps || []).map((step: any) => ({
      title: step.title || '',
      content: step.content || '',
      overview: step.overview || '',
    }))

    // 只有在有余额时才追加 answer
    const shouldAppendAnswer = question.answer && question.answer !== '' && (pausedIndex === -1 || qIndex < pausedIndex)

    if (shouldAppendAnswer) {
      steps.push({
        title: 'Answer',
        content: question.answer,
        overview: '',
      })
    }

    return steps
  })
})

// 冻结余额快照（首次显示题目时）
watch(
  () => props.data.questions?.length || 0,
  (len) => {
    if (snapshotAvailable.value !== null) return
    if (isSubscribed.value) return
    if (len > 0) {
      const ub = subscription.userBalance.value
      const plugin = Number(ub?.plugin ?? 0)
      const accountBalance = Number(ub?.balance ?? 0)
      const walletCredits = Math.floor(accountBalance / 10)
      snapshotAvailable.value = Math.max(0, plugin + walletCredits)
    }
  },
  { immediate: true }
)

// 题目增加时扣减余额
let internalBalance = 0
let isInitialized = false
let hasNotifiedInsufficientBalance = false

watch(
  () => pluginBalance.value,
  (balance) => {
    if (!isInitialized && balance > 0) {
      internalBalance = balance
      isInitialized = true
    }
  },
  { immediate: true }
)

// 手动维护上一次的长度
let lastQuestionLength = 0

watch(
  () => props.data.questions?.length || 0,
  (newLength) => {
    if (isSubscribed.value) return
    if (newLength > lastQuestionLength && newLength > 0) {
      const prevLength = lastQuestionLength
      const increment = newLength - prevLength

      // 首次出现题目时，第1题免费（只减内部余额，不扣减队列）
      if (prevLength === 0) {
        internalBalance--
      }

      // 计算需要扣减队列的次数
      // 首次：第2-N题需要扣减（newLength - 1 次）
      // 追加：所有新增题目都扣减（increment 次）
      const deductCount = prevLength === 0 ? newLength - 1 : increment

      // 执行扣减
      for (let i = 0; i < deductCount; i++) {
        if (internalBalance > 0) {
          internalBalance--
          subscription.addDeductionToQueue(1)
        } else if (onInsufficientBalance && !hasNotifiedInsufficientBalance) {
          hasNotifiedInsufficientBalance = true
          onInsufficientBalance()
          break
        }
      }

      // 更新记录的长度
      lastQuestionLength = newLength
    }
  },
  { flush: 'sync' }
)

// ===== 事件处理 =====
// 埋点（移除 isQuote 判断，全量开启）
onMounted(() => {
  if (props.data.questions?.some((q) => q.steps?.length > 0)) {
    trackEvent.track('Plugin_SolveV9_Quote_Show', {
      from: 'questions_step_style',
    })
  }
})
</script>

<style scoped>
.questions-step-style {
  @apply w-full;
}

/* 引用功能样式 */
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
