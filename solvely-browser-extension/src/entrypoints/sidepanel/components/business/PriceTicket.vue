<template>
  <!-- Header -->
  <div
    class="ticket-header relative text-t_iap dark:text-t_iap_dk text-[24px] font-bold font-['Inter'] leading-[31px] whitespace-normal w-[310px] text-center pt-8 pb-4 mx-auto"
  >
    Wait, We Have a Gift for You
  </div>
  <!-- Content -->
  <div class="ticket-content relative -mb-[6px]">
    <img
      src="@/assets/images/business/ticket.webp"
      alt=""
    />
    <div class="w-[276px] h-[141px] absolute top-[58px] left-1/2 -translate-x-1/2">
      <div class="flex justify-between items-center">
        <div class="ml-3 mt-2 text-white text-[13px] font-['Inter'] font-[700] leading-[16px] italic">
          Limited-time 81% off
        </div>
        <div class="flex justify-center items-center gap-0.5 mt-[8px]">
          <div
            class="w-5 h-[17px] bg-[#FFF6DF] rounded-[6px] text-[#461702] text-center text-[12px] font-[500] font-['Inter'] leading-[17px]"
          >
            {{ minutes }}
          </div>
          <div class="w-1 h-[17px] text-[#FFF6DF] text-center text-[13px] font-[900] font-['Inter'] leading-[17px]">
            :
          </div>
          <div
            class="mr-[10px] w-5 h-[17px] bg-[#FFF6DF] rounded-[6px] text-[#461702] text-center text-[12px] font-[500] font-['Inter'] leading-[17px]"
          >
            {{ seconds }}
          </div>
        </div>
      </div>
      <div class="mt-[18px] text-[#461702] text-[16px] font-['Inter'] font-[700] leading-[21px] text-center h-[21px]">
        Weekly
      </div>
      <div
        class="mt-1 text-[#461702] font-['Inter'] font-[700] text-center flex items-end justify-center gap-[6px] h-[39px]"
      >
        <div class="text-[32px] leading-[39px]">$1.99</div>
        <div class="text-[14px] leading-[26px]">1st week</div>
      </div>
      <div class="mt-[6px] h-[21px] text-[#9D928D] font-['Inter'] font-[500] leading-[21px] text-[16px] text-center line-through">
        $9.99/wk
      </div>
    </div>
    <div
      @click="handleClaimOffer"
      class="mt-[21px] mx-auto w-[294px] h-[55px] bg-b_iap_1 dark:bg-b_iap_1_dk text-t_iap_btn dark:text-t_iap_btn_dk cursor-pointer rounded-full py-2"
    >
      <div class="text-[18px] font-['Inter'] font-[700] leading-[23px] text-center">Claim the offer</div>
      <div class="text-[12px] font-['Inter'] font-[400] leading-[16px] text-center">
        $1.99 for 1st wk, then $6.99/wk
      </div>
    </div>
    <div
      class="mt-[10px] text-t_3 dark:text-t_3_dk text-[16px] font-['Inter'] font-[700] leading-[21px] h-[21px] text-center mx-auto cursor-pointer"
      @click="handleNoThanks"
    >
      No,thanks
    </div>
  </div>
</template>
<script setup lang="ts">
import { STORAGE_KEY } from '~/config'
import trackEvent from '@/utils/trackEvent'

const emit = defineEmits<{
  (e: 'claimOffer'): void
  (e: 'noThanks'): void
}>()

// 存储 key
const TIMESTAMP_KEY = STORAGE_KEY.PRICE_TICKET_TIMESTAMP
const COUNTDOWN_DURATION = 20 * 60 * 1000 // 20分钟，单位：毫秒
// const COUNTDOWN_DURATION = 5 * 60 * 1000 // 5分钟，单位：毫秒

// 倒计时状态
const timeRemaining = ref(0)
const minutes = computed(() => {
  const totalSeconds = Math.floor(timeRemaining.value / 1000)
  const mins = Math.floor(totalSeconds / 60)
  return mins.toString().padStart(2, '0')
})
const seconds = computed(() => {
  const totalSeconds = Math.floor(timeRemaining.value / 1000)
  const secs = totalSeconds % 60
  return secs.toString().padStart(2, '0')
})

let countdownTimer: number | null = null

// 开始倒计时
const startCountdown = (endTimestamp: number) => {
  const updateCountdown = () => {
    const now = Date.now()
    const remaining = Math.max(0, endTimestamp - now)
    timeRemaining.value = remaining

    if (remaining <= 0) {
      // 时间到了，停止倒计时并调用 handleNoThanks
      stopCountdown()
      handleNoThanks()
    }
  }

  // 立即更新一次
  updateCountdown()

  // 每秒更新
  countdownTimer = window.setInterval(updateCountdown, 1000)
}

// 停止倒计时
const stopCountdown = () => {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const handleClaimOffer = () => {
  trackEvent.track('Plugin_Coupon_Popup_Click')
  emit('claimOffer')
}

const handleNoThanks = () => {
  trackEvent.track('Plugin_Coupon_Popup_Close')
  emit('noThanks')
}

onMounted(async () => {
  trackEvent.track('Plugin_Coupon_Popup_Show')
  // 检查是否有时间戳（最小化容错）
  const result = (await browser.storage.local.get(TIMESTAMP_KEY).catch(() => ({} as any))) as Record<string, any>
  const existingTimestamp = result[TIMESTAMP_KEY]

  if (!existingTimestamp) {
    // 没有时间戳，存入新的时间戳（当前时间 + 20分钟）
    const endTimestamp = Date.now() + COUNTDOWN_DURATION
    await browser.storage.local.set({ [TIMESTAMP_KEY]: endTimestamp }).catch(() => {})
    // 开始倒计时
    startCountdown(endTimestamp)
  } else {
    // 有时间戳，直接开始倒计时
    startCountdown(existingTimestamp)
  }
})

onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped>
/* Header 向上渐渐显示 */
.ticket-header {
  animation: slideUp 0.3s ease-in-out;
}

/* Content 向上渐渐显示，延迟200ms */
.ticket-content {
  animation: slideUp 0.5s ease-in-out 0.6s both;
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
</style>
