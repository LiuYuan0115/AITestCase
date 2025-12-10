<template>
  <div class="relative overflow-hidden">
    <div class="gift-top relative">
      <img
        src="@/assets/images/business/gift.webp"
        alt="price-gift"
        class="relative z-10"
      />
      <!-- tip -->
      <div class="gift-tip absolute top-[240px] left-[132px] w-[165px] h-[26px] flex items-center justify-end">
        <img
          src="@/assets/images/business/tip.webp"
          alt="price-gift-dark"
          class="absolute bottom-0 left-0"
        />
        <div class="relative text-[#994444] text-[14px] font-['Inter'] font-[700] leading-[18px] mr-[5px] flex items-center justify-end">
          Limited-time
          <div class="w-10 ml-0.5 flex items-center justify-center"> {{ minutes }}:{{ seconds }} </div>
        </div>
      </div>
    </div>

    <div
      class="gift-middle w-[310px] mx-auto text-t_iap dark:text-t_iap_dk text-[24px] font-['Inter'] font-[700] leading-[31px] text-center mb-1 mt-[26px]"
    >
      Free Trial, Cancel Anytime
    </div>

    <div class="gift-bottom">
      <div
        class="w-[310px] mx-auto text-t_iap dark:text-t_iap_dk text-[16px] font-['Inter'] font-[500] leading-[21px] text-center"
      >
        We will send you a reminder email before your free trial ends
      </div>
      <div
        @click="handleTryForFree"
        class="mt-[21px] mx-auto w-[294px] h-[51px] bg-b_iap_1 dark:bg-b_iap_1_dk text-t_iap_btn dark:text-t_iap_btn_dk cursor-pointer rounded-full py-[14px] text-[18px] font-['Inter'] font-[700] leading-[23px] text-center"
      >
        Try for $0.00
      </div>
      <div
        class="mt-[10px] text-t_3 dark:text-t_3_dk text-[16px] font-['Inter'] font-[700] leading-[21px] h-[21px] text-center mx-auto cursor-pointer"
        @click="handleNoThanks"
      >
        No,thanks
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
const COUNTDOWN_DURATION = 20 * 60 * 1000
// const COUNTDOWN_DURATION = 6 * 60 * 1000
let timer: number | null = null
const remainingMs = ref(0)
const minutes = computed(() => {
  const totalSeconds = Math.floor(remainingMs.value / 1000)
  const mins = Math.floor(totalSeconds / 60)
  return mins.toString().padStart(2, '0')
})
const seconds = computed(() => {
  const totalSeconds = Math.floor(remainingMs.value / 1000)
  const secs = totalSeconds % 60
  return secs.toString().padStart(2, '0')
})
const emit = defineEmits<{
  (e: 'tryForFree'): void
  (e: 'noThanks'): void
}>()

const handleTryForFree = () => {
  trackEvent.track('Plugin_Coupon_Freetrial_Popup_Click')
  emit('tryForFree')
}

const handleNoThanks = () => {
  trackEvent.track('Plugin_Coupon_Freetrial_Popup_Close')
  emit('noThanks')
}

const startCountdown = (endTs: number) => {
  const tick = () => {
    const now = Date.now()
    const left = Math.max(0, endTs - now)
    remainingMs.value = left
    if (left <= 0) {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      handleNoThanks()
    }
  }
  tick()
  timer = window.setInterval(tick, 1000)
}

onMounted(() => {
  const endTs = Date.now() + COUNTDOWN_DURATION
  startCountdown(endTs)
  trackEvent.track('Plugin_Coupon_Freetrial_Popup_Show')
})

onUnmounted(() => {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
/* 顶部：向下渐显 */
.gift-top {
  animation: slideDown 0.4s ease-in-out;
}

/* 中间：渐显 */
.gift-middle {
  animation: fadeIn 0.3s ease-in-out 1s both;
}

/* 底部：向上渐显 */
.gift-bottom {
  animation: slideUp 0.3s ease-in-out 1.4s both;
}

/* tip：顺时针旋转45度 */
.gift-tip {
  animation: rotateIn 0.4s ease-out 0.6s both;
  transform-origin: left center;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-60px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes rotateIn {
  from {
    opacity: 0;
    transform: rotate(-45deg);
  }
  to {
    opacity: 1;
    transform: rotate(0deg);
  }
}
</style>
