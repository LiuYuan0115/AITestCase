<template>
  <div>
    <ModelPopUp v-if="visibleSolutions && isMutipleModel" class="mb-2" />
    <template v-for="(solution, index) in visibleSolutions" :key="index">
      <div
        class="flex flex-col gap-[8px]"
        :class="[
          index > 0
            ? ' mt-[28px] pt-[18px] border-t border-s-border dark:border-s-border-dark duration-200 transition-colors'
            : '',
          index === promptIndex ? 'mb-[6px]' : ' mb-[21px]',
        ]"
      >
        <h3 class="title text-[16px] font-[700] leading-[140%] text-[#007AFF]">
          Question {{ index + 1 }}
        </h3>
        <p
          v-if="index !== promptIndex"
          class="body text-[14px] font-[600] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors"
        >
          <LatexFormat :text="solution.questionGoal" />
        </p>
      </div>
      <div v-if="index === promptIndex">
        <NoBalanceSubscriptionPrompt />
      </div>
      <div v-else-if="solution?.steps?.length > 0">
        <StepBlock
          :steps="solution.steps"
          :answer="solution.answer || ''"
          :total-data="visibleSolutions"
          :index="index"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import StepBlock from './StepBlock.vue'
import subscription from '@/entrypoints/sidepanel/composables/useSubscription'
import NoBalanceSubscriptionPrompt from '../../NoBalanceSubscriptionPrompt.vue'
import useABTest from '@/composables/useABTest'
import trackEvent from '@/utils/trackEvent'
import ModelPopUp from '../../models/ModelPopUp.vue'

const props = defineProps<{
  solutions: {
    answer: string
    questionGoal: string
    steps: {
      stepTitle: string
      stepContent: string
    }[]
  }[]
}>()

const isSubscribed = computed(() => subscription.isSubscribed.value)
const setDisabledStop = inject<(disabled: boolean) => void>('setDisabledStop')
// 注入余额不足通知方法
const onInsufficientBalance = inject<() => void>('on-insufficient-balance')

// AB 测试控制
const { isMutipleModel } = useABTest()

// 标记当前答案是否已经埋点过
const hasTrackedQuoteShow = ref(false)

// 在组件实例内冻结一次可用额度，避免后续全局余额变化影响已渲染的历史消息
const snapshotAvailable = ref<number | null>(null)

// 首次出现题目且未订阅时，记录快照；订阅升级仍应即时解锁，因此不冻结 isSubscribed
watch(
  [() => props.solutions?.length || 0, () => isSubscribed.value],
  ([len, sub]) => {
    if (!sub && len > 0 && snapshotAvailable.value === null) {
      const ub = subscription.userBalance.value
      const plugin = Number(ub?.plugin ?? 0)
      const accountBalance = Number(ub?.balance ?? 0)
      const walletCredits = Math.floor(accountBalance / 10)
      snapshotAvailable.value = Math.max(0, plugin + walletCredits)
    }
  },
  { immediate: true }
)

const pluginBalance = computed(() => {
  if (snapshotAvailable.value !== null) return snapshotAvailable.value
  const ub = subscription.userBalance.value
  const plugin = Number(ub?.plugin ?? 0)
  const accountBalance = Number(ub?.balance ?? 0)
  const walletCredits = Math.floor(accountBalance / 10)
  return Math.max(0, plugin + walletCredits)
})

const promptIndex = computed(() => {
  if (isSubscribed.value) return -1
  const bal = Number(pluginBalance.value) || 0
  return bal < (props.solutions?.length || 0) ? bal : -1
})

const visibleSolutions = computed(() => {
  return promptIndex.value === -1
    ? props.solutions
    : props.solutions.slice(0, promptIndex.value + 1)
})

/**
 * 处理问号按钮显示埋点
 */
const handleQuoteShow = () => {
  // 检查是否有步骤内容，且每个答案只埋点一次
  const hasSteps = visibleSolutions.value.some(
    (solution: any) => solution.steps && solution.steps.length > 0
  )
  if (!hasTrackedQuoteShow.value && hasSteps) {
    trackEvent.track('Plugin_Sidebar_Quote_Show', {
      from: 'step',
    })
    hasTrackedQuoteShow.value = true
  }
}

// 监听 visibleSolutions 变化，当 AB 测试数据加载完成且有步骤内容时触发埋点
watch(
  [visibleSolutions],
  () => {
    handleQuoteShow()
  },
  { immediate: true }
)

// 组件内部维护余额状态
let internalBalance = 0
let isInitialized = false
// 余额不足通知锁，防止重复通知
let hasNotifiedInsufficientBalance = false

// 初始化内部余额
watch(
  () => pluginBalance.value,
  (balance) => {
    if (!isInitialized && balance > 0) {
      internalBalance = balance
      isInitialized = true
      console.log(`🏁 [Questions.vue] 初始化内部余额: ${internalBalance}`)
    }
  },
  { immediate: true }
)

// 监听题目生成，进行扣减（仅非订阅用户）
watch(
  () => props.solutions.length,
  (newLength, oldLength) => {
    // 订阅用户不需要扣减逻辑
    if (isSubscribed.value) return
    if (newLength > oldLength && newLength > 0) {
      // 第一题略过，从第二题开始扣减
      if (newLength > 1) {
        if (internalBalance > 0) {
          // 扣减内部余额
          internalBalance--

          // 调用减扣队列（从第二题开始）
          subscription.addDeductionToQueue(1)
        } else {
          // 余额不足时通知父组件（只通知一次）
          if (onInsufficientBalance && !hasNotifiedInsufficientBalance) {
            hasNotifiedInsufficientBalance = true
            onInsufficientBalance()
          }
        }
      } else {
        internalBalance--
      }
    }
  }
)

// 监听 promptIndex 变化，控制暂停按钮状态（仅非订阅用户）
watch(
  () => promptIndex.value,
  (newPromptIndex) => {
    // 订阅用户不需要暂停按钮控制逻辑
    if (isSubscribed.value) return

    if (setDisabledStop) {
      if (newPromptIndex !== -1) {
        setDisabledStop(true)
      } else {
        setDisabledStop(false)
      }
    }
  }
)

onMounted(() => {
  if (!isSubscribed.value) {
    setDisabledStop?.(false)
  }
})
</script>
