<template>
  <div
    class="h-[218px] flex items-center justify-center bg-cover bg-center bg-no-repeat [background-image:var(--bg)] dark:[background-image:var(--bg-dark)]"
    :style="{
      '--bg': `url(${bgImageUrl})`,
      '--bg-dark': `url(${bgImageUrlDark})`,
    }"
  >
    <div
      class="w-[300px] p-[16px] flex flex-col items-center gap-[12px] rounded-[12px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] duration-200 transition-colors leading-[130%] font-[500] bg-[linear-gradient(180deg,_#FFF_35.94%,_#FFF8E6_100%)] dark:bg-[linear-gradient(180deg,_#191705_36%,_#382D11_100%)] shadow-[0_2px_10px_0_rgba(110,107,168,0.25)]"
    >
      <div>You've used all your free solves today.<br />Upgrade or wait until tomorrow's reset.</div>
      <button
        v-if="auth.userFrom.value === 'web' || auth.userFrom.value === 'SEM'"
        class="bg-[#FFCE4F]  w-full h-[38px] rounded-[6px] text-[#461702] text-[14px] font-[700]"
        @click="handleClick"
        :disabled="loading"
      >
        {{ !pricingProducts?.weekDiscountUsed ? ' Get your first week for just $1.99' : 'Upgrade Now' }}
      </button>
      <button
      v-else
        class="bg-[#FFCE4F] w-full h-[38px] rounded-[66px] text-[#461702] text-[14px] font-[700]"
        @click="handleClick"
        :disabled="loading"
      >
        {{ useSubscription.purchasedFreeTrial.value ? 'Click to continue' : 'Start 3-Day free trial to continue' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, inject } from 'vue'
import useSubscription from '../composables/useSubscription'
import useCheckout, { CheckoutType } from '../composables/useCheckout'
import trackEvent from '@/utils/trackEvent'
import bgImageUrl from '@/assets/images/sidepanel/bg-subscription-prompt.webp'
import bgImageUrlDark from '@/assets/images/sidepanel/bg-subscription-prompt-dark.webp'
import { AuthState } from '../types/auth'
import usePricingProducts from '../composables/usePricingProducts'
const auth = inject<AuthState>('auth')!
const { pricingProducts } = usePricingProducts()
const { getCheckoutLink } = useCheckout()
const setNoAskFollowup = inject<(show: boolean) => void>('setNoAskFollowup', () => {})!
const showOutLimit = inject<(show: boolean, from: string) => void>('showOutLimit')!
const isLayer = inject<boolean>('isLayer', false)

const emit = defineEmits<{
  (e: 'ready'): void
}>()

const loading = ref(false)

const handleClick = async () => {
  if (isLayer) {
    showOutLimit(true, 'MultipleQuestion')
    return
  }
  loading.value = true
  if (auth.userFrom.value === 'web' || auth.userFrom.value === 'SEM') {
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
    from: 'MultipleQuestion',
  })
}

onMounted(() => {
  if (!auth.isAuthenticated.value) {
    return
  }
  if (isLayer) {
    setNoAskFollowup(true)
    return
  }
  showOutLimit(true, 'MultipleQuestion')
  trackEvent.track('Plugin_Sidebar_Chatupgrade_Show', {
    from: 'MultipleQuestion',
  })
  emit('ready')
})

// 🎯 组件销毁时恢复 footer 按钮显示
onUnmounted(() => {
  if (isLayer) {
    // 浮层环境：告诉父组件可以显示 ask follow-up 和 next question 了
    showOutLimit(false, 'MultipleQuestion')
    setNoAskFollowup(false)
  }
})
</script>
