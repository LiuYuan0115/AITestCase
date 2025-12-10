<template>
  <div
    class="mr-[18px] flex flex-col items-start gap-[12px] p-[12px] rounded-[16px] border border-s-border dark:border-s-border-dark text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] duration-200 transition-colors leading-[140%] font-[400]"
  >
    <div>You've used all your free solves today. Upgrade or wait until tomorrow's free solves reset.</div>
    <button
      v-if="auth.userFrom.value === 'web' || auth.userFrom.value === 'SEM'"
      class="bg-[#FFCE4F] px-[10px] h-[32px] rounded-[6px] text-[#461702] text-[14px] font-[600]"
      @click="handleClick"
      :disabled="loading"
    >
      {{ !pricingProducts?.weekDiscountUsed ? ' Get your first week for just $1.99' : 'Upgrade Now' }}
    </button>
    <button
      v-else
      class="bg-[#FFCE4F] px-[10px] h-[32px] rounded-[6px] text-[#461702] text-[14px] font-[600]"
      @click="handleClick"
      :disabled="loading"
    >
      {{ useSubscription.purchasedFreeTrial.value ? 'Upgrade Now' : 'Start 3-Day free trial' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import useSubscription from '../composables/useSubscription'
import useCheckout, { CheckoutType } from '../composables/useCheckout'
import trackEvent from '@/utils/trackEvent'
import { QuestionType } from '../types/question'
import usePricingProducts from '../composables/usePricingProducts'

const { pricingProducts } = usePricingProducts()
const props = defineProps<{
  message: any
  auth: any
}>()

const { getCheckoutLink } = useCheckout()

const emit = defineEmits<{
  (e: 'ready'): void
}>()

const loading = ref(false)

const handleClick = async () => {
  loading.value = true
  if (props.auth.userFrom.value === 'web' || props.auth.userFrom.value === 'SEM') {
    if (!pricingProducts.value?.weekDiscountUsed) {
      const checkoutLink = await getCheckoutLink(CheckoutType.WEEKLY, false, { discount: 'discount_5_usd' })
      window.open(checkoutLink, '_blank')
      loading.value = false
      return
    }else{
      const checkoutLink = await getCheckoutLink(CheckoutType.WEEKLY, false)
      window.open(checkoutLink, '_blank')
      loading.value = false
      return
    }
  }
  const checkoutLink = await getCheckoutLink(CheckoutType.YEARLY, false)
  window.open(checkoutLink, '_blank')
  loading.value = false
  trackEvent.track('Plugin_Sidebar_Chatupgrade_Click', {
    from: 'SingleQuestion',
  })
}

onMounted(() => {
  emit('ready')
  let from = 'SingleQuestion'
  try {
    const content = props.message.content
    from =
      content.source === 'chatgpt'
        ? 'ChatGPT'
        : content.type === QuestionType.PHOTO || content.type === QuestionType.TEXT_SOLVE
        ? 'SingleQuestion'
        : content.type === QuestionType.TEXT
        ? 'Chat'
        : content.type === QuestionType.SUMMARY
        ? 'Summarize'
        : content.type
  } catch (error) {}
  trackEvent.track('Plugin_Sidebar_Chatupgrade_Show', {
    from,
  })
})
</script>
