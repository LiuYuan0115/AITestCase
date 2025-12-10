<template>
  <div class="question-multiple flex flex-col gap-[16px]">
    <div class="flex flex-col gap-[12px]">
      <h3
        class="text-[16px] font-[700] leading-[150%] text-s-function-success dark:text-s-function-success-dark duration-200 transition-colors tracking-[0.32px] flex justify-between items-center"
      >
        <span>Final Answer</span>
      </h3>
      <ul
        v-if="componentJson?.data?.questions"
        class="flex flex-col gap-[12px]"
      >
        <li
          v-for="(question, index) in componentJson?.data?.questions"
          :key="index"
          class="flex items-center justify-start gap-[12px] text-[14px] font-[400] leading-[140%]"
        >
          <span
            class="flex items-center justify-center w-[36px] h-[36px] rounded-full text-[12px] bg-disabled-bg dark:bg-disabled-bg-dark text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors font-[700]"
          >
            Q{{ index + 1 }}
          </span>
          <div class="flex-1">
            <p
              v-for="(item, index) in question.answer"
              :key="index"
              class="answer text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark duration-200 transition-colors font-[400]"
            >
              <LatexFormat :text="item" />
            </p>
          </div>
        </li>
      </ul>
    </div>
    <ModelPopUp v-if="componentJson?.data?.questions && isMutipleModel" />
    <div v-if="componentJson?.data?.explanations">
      <div
        v-for="(explanation, index) in componentJson?.data?.explanations"
        :key="index"
        class="flex flex-col gap-[12px]"
        :class="{
          'mt-[18px] pt-[18px] border-t border-s-border dark:border-s-border-dark':
            index !== 0,
        }"
      >
        <h3
          class="text-[16px] font-[700] leading-[130%] text-s-text-brand dark:text-s-text-brand-dark duration-200 transition-colors tracking-[0.32px]"
        >
          Question {{ index + 1 }}
        </h3>
        <template v-if="promptIndex === -1 || index < promptIndex">
          <div class="flex flex-col gap-[8px]">
            <h4
              class="text-[14px] font-[700] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors"
            >
              Answer:
            </h4>
            <div
              class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors"
            >
              <p v-for="(item, idx) in explanation.answer" :key="idx">
                <LatexFormat :text="item" />
              </p>
            </div>
          </div>
          <div class="flex flex-col gap-[8px]">
            <h4
              class="text-[14px] font-[700] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors"
            >
              Explanation:
            </h4>
            <div
              class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors"
            >
              <LatexFormat :text="explanation.explanation" />
            </div>
          </div>
        </template>
        <template v-else-if="index === promptIndex">
          <NoBalanceSubscriptionPrompt />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject, type Ref } from 'vue'
import { InjectionTokens } from '@/entrypoints/sidepanel/types/token'
import LatexFormat from '@/components/common/LatexFormat.vue'
import trackEvent from '~/utils/trackEvent'
import subscription from '@/entrypoints/sidepanel/composables/useSubscription'
import NoBalanceSubscriptionPrompt from '../../NoBalanceSubscriptionPrompt.vue'
import ModelPopUp from '../../models/ModelPopUp.vue'
import useABTest from '@/composables/useABTest'

const { isMutipleModel } = useABTest()

const props = defineProps(['componentJson'])

// 订阅与余额：在组件实例内冻结一次可用额度（基于题目数），订阅状态保持实时
const isSubscribed = computed(() => subscription.isSubscribed.value)
const setDisabledStop = inject<(disabled: boolean) => void>('setDisabledStop')
// 注入余额不足通知方法
const onInsufficientBalance = inject<() => void>('on-insufficient-balance')
const snapshotAvailable = ref<number | null>(null)

const totalQuestions = computed(() => {
  return props.componentJson?.data?.questions?.length || 0
})

// 首次出现题目且未订阅时，记录快照；不自停止，写入一次即可
watch(
  [totalQuestions, () => isSubscribed.value],
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

// 用题目总数与可用额度计算解释区的拦截边界
const promptIndex = computed(() => {
  if (isSubscribed.value) return -1
  const bal = Number(pluginBalance.value) || 0
  return bal < totalQuestions.value ? bal : -1
})

onMounted(() => {
  trackEvent.track('Plugin_Sidebar_MultipleAnswer_Show', {
    apiType: 'json',
  })
})

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
      console.log(
        `🏁 [QuestionMultiple.vue] 初始化内部余额: ${internalBalance}`
      )
    }
  },
  { immediate: true }
)

// 监听题目生成，进行扣减（仅非订阅用户）
watch(
  () => totalQuestions.value,
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

<style scoped>
.answer {
  :deep(#setText ol) {
    @apply pl-[18px];
    li:last-child {
      @apply mb-0;
    }
  }
}
</style>
