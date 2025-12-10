<template>
  <div class="questions-step-style">
    <template
      v-for="(question, qIndex) in props.data.questions"
      :key="qIndex"
    >
      <div
        v-if="promptIndex === -1 || qIndex <= promptIndex"
        :class="[
          'flex flex-col gap-[8px] w-full',
          qIndex > 0
            ? 'mt-[18px] pt-[18px] border-t border-s-border dark:border-s-border-dark color-transition'
            : '',
        ]"
      >
        <div class="flex flex-col gap-[8px] w-full">
          <h3
            class="text-[16px] font-[700] leading-[130%] text-s-text-brand dark:text-s-text-brand-dark color-transition"
          >
            <span v-if="shouldShowNumbered">Question {{ question.number || qIndex + 1 }}</span>
            <span v-else>Explanation</span>
          </h3>
          <p
            v-if="getQuestionText(question) && qIndex !== promptIndex"
            class="text-[14px] font-[400] leading-[130%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark color-transition w-full overflow-x-auto"
          >
            <LatexFormat :text="getQuestionText(question)" />
          </p>
        </div>

        <template v-if="promptIndex === -1 || qIndex < promptIndex">
          <div class="flex flex-col gap-[4px]">
            <div
              v-for="(step, sIndex) in renderedSteps[qIndex] || []"
              :key="`${qIndex}-${sIndex}-${step.title || step.content}`"
              class="flex flex-col items-start gap-[8px] self-stretch rounded-[12px] p-[16px] bg-b_step dark:bg-b_step_dk border border-b_step dark:border-b_step_dk hover:!border-b_brand w-full color-transition"
            >
              <!-- 序号容器 -->
              <div class="flex justify-between items-center self-stretch">
                <span
                  class="flex items-center gap-[4px] text-[12px] font-[700] leading-[130%] tracking-[0.24px] uppercase text-b_brand dark:text-t_brand_dk color-transition"
                >
                  <span class="w-[4px] h-[4px] rounded-full bg-b_brand dark:bg-t_brand_dk"></span>STEP {{ sIndex + 1 }}
                </span>
                <CustomTooltip
                  text="Quote & ask"
                  position="top"
                  :offset="{ x: -30, y: 0 }"
                  v-if="isSidePanelSupported()"
                >
                  <span
                    class="cursor-pointer text-t_2 dark:text-t_2_dk"
                    @click="(event: Event) => handleQuestionClick(event, qIndex, sIndex, step)"
                  >
                    <SvgIcon
                      name="quote"
                      size="17"
                    />
                  </span>
                </CustomTooltip>
              </div>

              <!-- 标题 -->
              <h4
                v-if="step.title"
                class="text-[14px] font-[600] leading-[130%] text-t_1 dark:text-s-text-high-emphasis-dark color-transition w-full"
              >
                <LatexFormat :text="step.title" />
              </h4>

              <!-- 内容 -->
              <div
                class="text-[14px] font-[500] leading-[140%] text-t_2 dark:text-s-text-medium-emphasis-dark color-transition w-full overflow-x-auto"
              >
                <LatexFormat :text="step.content" />
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="qIndex === promptIndex">
          <NoBalancePrompt
            class="mt-4"
            @ready="handleNoBalanceReady"
          />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, type Ref } from 'vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import NoBalancePrompt from '../../NoBalanceSubscriptionPrompt.vue'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import trackEvent from '@/utils/trackEvent'
import type { QuestionsStepStyleData } from '../composables/types'
import { useQuoteManager } from '@/composables/content/useQuoteManager'
import CustomTooltip from '@/components/common/CustomTooltip.vue'

const props = defineProps<{
  data: QuestionsStepStyleData
  componentId?: string
}>()

const emit = defineEmits<{
  (e: 'noBalanceReady'): void
}>()

const subscription = useSubscription
const onInsufficientBalance = inject<() => void>('on-insufficient-balance')

// 🎯 检查是否来自预加载数据（浮层流转）
const isFromPreloadedRef = inject<Ref<boolean>>('is-from-preloaded', ref(false))
const userContent = inject<any>('user-content')
const shouldDeductBalance = inject<Ref<boolean>>('shouldDeductBalance', ref(true))

// 🎯 注入浮层Quote回调（统一入口）
const handleLayerQuote = inject<((highlightedText: string) => void) | null>('handleLayerQuote', null)

const isSubscribed = computed(() => subscription.isSubscribed.value)

// ===== 引用功能逻辑 =====

// 🎯 Inject 从父组件获取上下文的函数（Answer组件provide）
const getQuoteContext = inject<(() => string) | null>('getQuoteContext', null)

/**
 * 获取用户消息内容（降级用，如果没有 inject）
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
 * 获取完整答案文本（从当前组件的数据构建，降级用）
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
 * 处理余额不足提示准备完成
 */
const handleNoBalanceReady = () => {
  emit('noBalanceReady')
}

/**
 * 处理问号按钮点击事件
 */
const handleQuestionClick = (event: Event, questionIndex: number, stepIndex: number, step: any) => {
  // 阻止事件冒泡
  event.stopPropagation()

  // 1. 获取高亮文本
  const stepTitleAndText = getStepTextContent(step)

  // 2. 🎯 判断环境：如果能 inject 到浮层回调，说明在浮层中
  if (handleLayerQuote) {
    // 浮层模式：只传高亮文本，上下文由浮层统一获取

    handleLayerQuote(stepTitleAndText)
    return
  }

  // 3. 🎯 侧边栏模式：走原逻辑（需要构建完整上下文）
  trackEvent.track('Plugin_SolveV9_Quote_Click', {
    from: 'step',
    questionIndex,
    stepIndex,
  })

  // 使用引用管理器处理上下文
  const stepQuoteManager = useQuoteManager()

  // 🎯 优先从 provide 获取上下文（Answer组件提供，包含用户消息+服务消息，已排除thinking）
  let allText = ''
  if (getQuoteContext) {
    allText = getQuoteContext()
  } else {
    // 降级：自己构建（老逻辑）
    const fullAnswer = getFullAnswerText()
    const userMessage = getUserMessage()
    allText = `${userMessage}\n${fullAnswer}`.trim()
  }

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

  // 🎯 关键修复：如果是预加载数据（浮层流转），不显示遮罩
  // 原因：侧边栏余额充足，浮层已经处理过余额逻辑
  if (isFromPreloadedRef.value) return -1

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

    // 🎯 如果是预加载数据（浮层流转），不拍摄快照，使用实时余额
    if (isFromPreloadedRef.value) {
      console.log('[QuestionsStepStyle] Skipped snapshot (preloaded), using real-time balance')
      return
    }

    if (len > 0) {
      const ub = subscription.userBalance.value
      const plugin = Number(ub?.plugin ?? 0)
      const accountBalance = Number(ub?.balance ?? 0)
      const walletCredits = Math.floor(accountBalance / 10)
      snapshotAvailable.value = Math.max(0, plugin + walletCredits)
      console.log('[QuestionsStepStyle] Snapshot balance:', snapshotAvailable.value)
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

    // 🎯 如果是预加载数据（浮层流转），跳过余额扣减逻辑
    if (isFromPreloadedRef.value) {
      console.log('[QuestionsStepStyle] Skipped balance deduction (preloaded)')
      lastQuestionLength = newLength // 只更新记录，不扣减
      return
    }

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
          // ⭐ 只有在允许扣减的情况下才执行（避免多模型重复扣次数）
          if (shouldDeductBalance.value) {
            subscription.addDeductionToQueue(1)
          }
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
</style>
