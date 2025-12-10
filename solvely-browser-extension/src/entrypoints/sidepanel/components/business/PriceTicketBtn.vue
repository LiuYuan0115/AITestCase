<template>
  <div
    v-if="
      showBtn &&
      !pricingProducts?.weekDiscountUsed &&
      isQuaterPackageRecall 
    "
    class="flex w-[165px] items-center gap-[4px] pl-[6px] pr-[8px] py-[3px] rounded-[100px] bg-b_panel dark:bg-b_panel_dk hover:bg-b_card_hov dark:hover:bg-b_card_hov_dk text-t_3 dark:text-t_3_dk color-transition whitespace-nowrap cursor-pointer"
  >
    <GiftIcon :class="['w-[18px] h-[18px] shrink-0', { 'gift-icon-shake': shouldShake }]" />
    <span class="text-[12px] font-medium leading-none">Claim 81% off in {{ countdown }}</span>
  </div>
</template>

<script setup lang="ts">
import GiftIcon from '@/assets/icons/business/gift.svg'
import { STORAGE_KEY } from '~/config'
import usePricingProducts from '@/entrypoints/sidepanel/composables/usePricingProducts'
import useABTest from '@/composables/useABTest'

defineProps<{
  auth: any
}>()

const { isQuaterPackageRecall } = useABTest()

// 订阅状态（从 App.vue provide 获取）
const subscription = inject<any>('subscription')
const isSubscribed = computed(() => subscription?.isSubscribed?.value ?? false)

// 动画控制
const shouldShake = ref(true)
const ANIMATION_DURATION = 2 * 60 * 1000 // 2分钟
// const ANIMATION_DURATION = 1 * 60 * 1000 // 1分钟

// 使用全局定价信息状态管理
const { pricingProducts } = usePricingProducts()

// 存储 key（和 PriceTicket.vue 中相同）
const TIMESTAMP_KEY = STORAGE_KEY.PRICE_TICKET_TIMESTAMP

// 显示状态
const showBtn = ref(false)

// 倒计时状态
const timeRemaining = ref(0)
const countdown = computed(() => {
  const totalSeconds = Math.floor(timeRemaining.value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

let countdownTimer: number | null = null
let storageListener: ((changes: any, areaName: string) => void) | null = null
let animationStartTime: number | null = null

// 开始倒计时
const startCountdown = (endTimestamp: number) => {
  // 记录动画开始时间
  animationStartTime = Date.now()
  shouldShake.value = true

  const updateCountdown = () => {
    const now = Date.now()
    const remaining = Math.max(0, endTimestamp - now)
    timeRemaining.value = remaining

    // 检查是否已经过了2分钟，如果是则停止动画
    if (animationStartTime && now - animationStartTime >= ANIMATION_DURATION) {
      shouldShake.value = false
    }

    if (remaining <= 0) {
      // 时间到了，停止倒计时并隐藏按钮
      stopCountdown()
      showBtn.value = false
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
  animationStartTime = null
  shouldShake.value = false
}

// 检查时间戳并更新状态
const checkTimestamp = async () => {
  try {
    const result = await browser.storage.local.get(TIMESTAMP_KEY)
    const existingTimestamp = result[TIMESTAMP_KEY]

    if (existingTimestamp) {
      const now = Date.now()
      const remaining = existingTimestamp - now

      if (remaining > 0) {
        // 有时间戳且未过期，显示按钮并开始倒计时
        showBtn.value = true
        startCountdown(existingTimestamp)
      } else {
        // 时间戳已过期，隐藏按钮
        showBtn.value = false
        stopCountdown()
      }
    } else {
      // 没有时间戳，隐藏按钮
      showBtn.value = false
      stopCountdown()
    }
  } catch (error) {
    console.error('检查时间戳失败:', error)
    showBtn.value = false
    stopCountdown()
  }
}

onMounted(async () => {
  // 初始检查
  await checkTimestamp()

  // 监听 storage 变化
  storageListener = (changes: any, areaName: string) => {
    if (areaName === 'local' && TIMESTAMP_KEY in changes) {
      // 时间戳变化了，重新检查
      checkTimestamp()
    }
  }

  browser.storage.onChanged.addListener(storageListener)
})

onUnmounted(() => {
  stopCountdown()
  if (storageListener) {
    browser.storage.onChanged.removeListener(storageListener)
  }
})
</script>

<style scoped>
.gift-icon-shake {
  animation: shake 4s ease-in-out 0s infinite;
}

@keyframes shake {
  0%,
  84% {
    transform: rotate(0deg);
  }
  86% {
    transform: rotate(-8deg);
  }
  88% {
    transform: rotate(8deg);
  }
  90% {
    transform: rotate(-8deg);
  }
  92% {
    transform: rotate(8deg);
  }
  94% {
    transform: rotate(-8deg);
  }
  96% {
    transform: rotate(8deg);
  }
  98% {
    transform: rotate(-8deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
</style>
