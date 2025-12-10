<template>
  <div class="flex flex-col gap-[16px] w-full">
    <div class="flex items-center justify-between gap-[12px]">
      <h3
        class="text-[16px] font-[700] leading-[150%] tracking-[0.32px] text-s-function-success dark:text-s-function-success-dark transition-colors duration-200"
      >
        Final Answer
      </h3>
    </div>

    <ul
      v-if="data.questions?.length"
      class="flex flex-col gap-[12px]"
    >
      <li
        v-for="(question, index) in data.questions"
        :key="index"
        class="flex items-start gap-[12px] text-[14px] font-[400] leading-[140%]"
      >
        <span
          class="flex items-center justify-center w-[36px] h-[36px] rounded-full text-[12px] bg-disabled-bg dark:bg-disabled-bg-dark text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200 font-[700]"
        >
          Q{{ index + 1 }}
        </span>
        <div
          class="flex-1 overflow-x-auto text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark transition-colors duration-200"
        >
          <LatexFormat :text="question.question" />
          <div
            class="mt-[8px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
          >
            <template v-if="Array.isArray(question.answer)">
              <p
                v-for="(ans, idx) in question.answer"
                :key="idx"
              >
                <LatexFormat :text="ans" />
              </p>
            </template>
            <template v-else>
              <LatexFormat :text="question.answer" />
            </template>
          </div>
        </div>
      </li>
    </ul>

    <div
      v-if="data.explanations?.length"
      class="flex flex-col gap-[18px]"
    >
      <template
        v-for="(explanation, index) in data.explanations"
        :key="index"
      >
        <div
          v-if="promptIndex === -1 || index <= promptIndex"
          :class="
            index !== 0
              ? 'pt-[18px] border-t border-s-border dark:border-s-border-dark transition-colors duration-200'
              : ''
          "
          class="flex flex-col gap-[12px]"
        >
          <h4
            class="text-[16px] font-[700] leading-[130%] text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200"
          >
            Question {{ index + 1 }}
          </h4>
          <template v-if="promptIndex === -1 || index < promptIndex">
            <div class="flex flex-col gap-[8px] text-[14px]">
              <h5
                class="text-[14px] font-[700] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
              >
                Answer:
              </h5>
              <div
                class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
              >
                <template v-if="Array.isArray(explanation.answer)">
                  <p
                    v-for="(ans, idx) in explanation.answer"
                    :key="idx"
                  >
                    <LatexFormat :text="ans" />
                  </p>
                </template>
                <template v-else>
                  <LatexFormat :text="explanation.answer" />
                </template>
              </div>
            </div>
            <div class="flex flex-col gap-[8px] text-[14px]">
              <h5
                class="text-[14px] font-[700] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
              >
                Explanation:
              </h5>
              <div
                class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
              >
                <LatexFormat :text="explanation.explanation" />
              </div>
            </div>
          </template>
          <template v-else-if="index === promptIndex">
            <NoBalancePrompt />
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, inject } from 'vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import NoBalancePrompt from '../../NoBalanceSubscriptionPrompt.vue'
import type { QuestionMultipleData } from '../composables/types'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'

const props = defineProps<{
  data: QuestionMultipleData
  componentId?: string
}>()

const subscription = useSubscription
const isSubscribed = computed(() => subscription.isSubscribed.value)
const onInsufficientBalance = inject<() => void>('on-insufficient-balance')

const snapshotAvailable = ref<number | null>(null)

const pluginBalance = computed(() => {
  if (snapshotAvailable.value !== null) return snapshotAvailable.value
  const userBalance = subscription.userBalance.value
  const plugin = Number(userBalance?.plugin ?? 0)
  const accountBalance = Number(userBalance?.balance ?? 0)
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

watch(
  () => props.data.questions?.length || 0,
  (len) => {
    if (snapshotAvailable.value !== null) return
    if (isSubscribed.value) return
    if (len > 0) {
      const userBalance = subscription.userBalance.value
      const plugin = Number(userBalance?.plugin ?? 0)
      const accountBalance = Number(userBalance?.balance ?? 0)
      const walletCredits = Math.floor(accountBalance / 10)
      snapshotAvailable.value = Math.max(0, plugin + walletCredits)
    }
  },
  { immediate: true }
)

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
</script>
