<template>
  <div
    class="w-[344px] relative rounded-xl border border-d_2 dark:border-d_1_dk bg-b_1 dark:bg-b_1_dk shadow-lg pb-[30px] transition-all duration-[600ms]"
    :style="{ height: shouldShowTicket ? '520px' : showGift ? '500px' : '560px' }"
  >
    <!-- 背景 -->
    <Transition
      name="fade"
      mode="out-in"
    >
      <img
        v-if="!showBenefits && !isDark && !shouldShowTicket && !showGift"
        key="header-bg"
        src="@/assets/images/business/modle-header.webp"
        alt=""
        class="absolute inset-0 w-full object-cover pointer-events-none select-none rounded-t-xl"
      />
      <img
        v-else-if="!showBenefits && isDark && !shouldShowTicket && !showGift"
        key="header-bg-dark"
        src="@/assets/images/business/modle-header-dark.webp"
        alt=""
        class="absolute inset-0 w-full object-cover pointer-events-none select-none rounded-t-xl"
      />
      <div
        v-else
        key="benefits-bg"
        class="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent to-[#FFF8E6] dark:to-transparent rounded-b-xl"
      ></div>
    </Transition>

    <Transition
      name="pricing-fade-up"
      mode="out-in"
    >
      <div
        v-if="!shouldShowTicket && !showGift"
        key="pricing"
        class="flex flex-col justify-start items-center relative w-full"
      >
        <!-- 关闭按钮 -->
        <button
          v-if="showModel === 'modal'"
          class="absolute right-4 top-4 w-6 h-6 flex items-center justify-center cursor-pointer z-10 rounded-full hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200"
          @click="handleClose"
        >
          <SvgIcon
            name="close"
            :size="10"
            fill="#555"
          />
        </button>

        <!-- 头部 -->
        <div class="relative w-full h-[318px] overflow-hidden">
          <Transition
            :name="showBenefits ? 'slide-down' : 'slide-up'"
            mode="out-in"
          >
            <!-- 主要内容 -->
            <div
              v-if="!showBenefits"
              key="main"
              class="relative flex flex-col items-center w-full pt-[38px] mb-2"
            >
              <!-- 图标 -->
              <div class="w-[203px] h-[109px] mb-[21px]">
                <img
                  src="@/assets/images/business/modle-icons.webp"
                  alt=""
                  class="w-full h-full object-cover"
                />
              </div>
              <!-- 标题 -->
              <div
                class="text-center text-[#461702] dark:text-[#FFF1C6] text-[24px] font-[700] font-['Inter'] w-full whitespace-nowrap h-[29px] leading-[29px] mb-[2px]"
              >
                Your All-in-one AI Solver
              </div>
              <!-- 副标题 -->
              <div
                class="text-center text-[#461702] dark:text-[#FFF1C6] text-[16px] font-[600] font-['Inter'] w-full whitespace-nowrap h-[24px] leading-[24px]"
              >
                Unlimited access to top models
              </div>
              <!-- 对比 -->
              <div class="relative mt-[27px] w-[325px] h-9 mb-2">
                <img
                  v-if="!isDark"
                  src="@/assets/images/business/red.webp"
                  alt=""
                  class="w-[173px] absolute top-0 left-0 h-full object-cover"
                />
                <img
                  v-else
                  src="@/assets/images/business/red-dark.webp"
                  alt=""
                  class="w-[173px] absolute top-0 left-0 h-full object-cover"
                />
                <img
                  v-if="!isDark"
                  src="@/assets/images/business/blue.webp"
                  alt=""
                  class="w-[173px] absolute top-0 right-0 h-full object-cover"
                />
                <img
                  v-else
                  src="@/assets/images/business/blue-dark.webp"
                  alt=""
                  class="w-[173px] absolute top-0 right-0 h-full object-cover"
                />

                <!-- 内容覆盖层 -->
                <div class="absolute inset-0 flex items-center justify-between px-[10px]">
                  <!-- 左侧：其他工具 -->
                  <div class="flex items-center relative flex-1">
                    <div
                      class="element absolute left-0 w-5 h-5 bg-b_1 dark:bg-b_card_dk rounded-full flex items-center justify-center"
                    >
                      <SvgIcon
                        name="models/gpt"
                        :size="16"
                        :fill="!isDark ? '#111111' : '#FFFFFF'"
                      />
                    </div>
                    <div
                      class="element absolute left-[12.75px] w-5 h-5 bg-b_1 dark:bg-b_card_dk rounded-full flex items-center justify-center"
                    >
                      <SvgIcon
                        name="models/gemini"
                        :size="16"
                      />
                    </div>
                    <div
                      class="element absolute left-[25.5px] w-5 h-5 bg-b_1 dark:bg-b_card_dk rounded-full flex items-center justify-center"
                    >
                      <SvgIcon
                        name="models/claude"
                        :size="16"
                      />
                    </div>
                    <div class="w-[45.5px] mr-2"></div>
                    <div class="text-t_1 dark:text-t_1_dk text-[14px] font-['Inter'] font-[700] leading-[1.3]">
                      $60/month
                    </div>
                  </div>

                  <!-- VS 标签 -->
                  <div
                    class="bg-b_1 dark:bg-b_1_dk rounded-full shadow-[0_1px_10px_rgba(153,153,153,0.1)] h-[24px] w-[24px] flex items-center justify-center"
                  >
                    <span class="text-[#461702] dark:text-[#FFF1C6] text-[12px] font-['Inter'] font-bold">VS</span>
                  </div>

                  <!-- 右侧：我们的价格 -->
                  <div class="flex items-center flex-1">
                    <div class="w-[14px]"></div>
                    <SvgIcon
                      name="logo"
                      :size="19"
                    />
                    <div class="ml-2 text-t_1 dark:text-t_1_dk text-[14px] font-['Inter'] font-[700] leading-[1.3]">
                      ${{ yearlyPrice }}/month
                    </div>
                  </div>
                </div>

                <!-- SAVE 徽章 -->
                <div
                  class="absolute -top-[18px] right-[2px] bg-[#FFCE4F] text-[#461702] rounded-[8px] h-[24px] px-[10px] flex items-center justify-center"
                >
                  <span class="font-['Inter'] font-bold italic text-[12px] leading-[1.5]">SAVE 90%</span>
                </div>
              </div>

              <div
                class="flex items-center justify-center gap-[1px] text-t_3 dark:text-t_3-dk cursor-pointer"
                @click="handleViewFullBenefits()"
              >
                <div class="text-[12px] font-[500] font-['Inter'] leading-[1.3]">View full benefits</div>
                <SvgIcon
                  name="business/arrow-slide"
                  size="12"
                />
              </div>
            </div>

            <!-- 权益内容 -->
            <div
              v-else
              key="benefits"
              class="relative w-full flex justify-center items-center mb-[24px]"
            >
              <div
                class="absolute left-1/2 -translate-x-1/2 top-4 w-5 h-5 text-[#989B9E] dark:text-[#A4A6AB] bg-s-interface-bg dark:bg-s-interface-bg-dark border border-[#fff] dark:border-[#2C3649] rounded-full cursor-pointer flex justify-center items-center"
                @click="handleViewFullBenefits()"
              >
                <SvgIcon
                  name="business/arrow-slide"
                  size="12"
                  class="transform rotate-180"
                />
              </div>

              <div class="pt-[52px] w-[313px] h-[293px]">
                <div
                  class="text-[#461702] dark:text-[#FFF1C6] text-[20px] font-[700] leading-[1.3] font-['Inter'] mb-1 text-center"
                >
                  Unlimited access to all features
                </div>
                <div
                  class="text-[#461702] dark:text-[#FFF1C6] text-[14px] font-[600] leading-[1.3] font-['Inter'] mb-[14px] text-center"
                >
                  Replace GPT+Claude+Gemini with 90% off
                </div>
                <div
                  class="font-[700] text-[14px] leading-[1.3] font-['Inter'] text-t_3 dark:text-t_3-dk flex items-center justify-between mb-4"
                >
                  <div class="flex-1">Benefits</div>
                  <div class="w-[40px] mr-1 text-center">Free</div>
                  <div class="h-[22px] w-[40px] flex items-center justify-center">
                    <SvgIcon
                      name="business/infinite"
                      :size="27"
                    />
                  </div>
                </div>
                <div
                  class="flex flex-col gap-[18px] text-[14px] font-[400] leading-[1.4] font-['Inter'] text-[#111111] dark:text-[#F1F3F5]"
                >
                  <div class="h-[22px] flex items-center justify-between">
                    <div class="flex-1">Unlimited solve & chat</div>
                    <div class="flex justify-center items-center w-10 mr-1">
                      <i class="w-[11px] h-[3px] bg-[#CCCCCC] dark:bg-[#485162] rounded-full"></i>
                    </div>
                    <div class="w-10 flex justify-center items-center">
                      <SvgIcon
                        name="business/check"
                        :size="24"
                      />
                    </div>
                  </div>
                  <div class="h-[22px] flex items-center justify-between">
                    <div class="flex-1">Step-by-step Solution</div>
                    <div class="flex justify-center items-center w-10 mr-1">
                      <i class="w-[11px] h-[3px] bg-[#CCCCCC] dark:bg-[#485162] rounded-full"></i>
                    </div>
                    <div class="w-10 flex justify-center items-center">
                      <SvgIcon
                        name="business/check"
                        :size="24"
                      />
                    </div>
                  </div>
                  <div class="h-[22px] flex items-center justify-between">
                    <div class="flex-1 flex items-center gap-[6px]">
                      Optimal speed & accuracy
                      <div class="w-[41px] h-[22px] relative">
                        <div
                          class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-0 w-[22px] h-[22px] shadow-md flex items-center justify-center"
                        >
                          <SolvelyFast />
                        </div>
                        <div
                          class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-[19px] w-[22px] h-[22px] shadow-md flex items-center justify-center"
                        >
                          <SolvelyMulti />
                        </div>
                      </div>
                    </div>
                    <div class="flex justify-center items-center w-10 mr-1">
                      <i class="w-[11px] h-[3px] bg-[#CCCCCC] dark:bg-[#485162] rounded-full"></i>
                    </div>
                    <div class="w-10 flex justify-center items-center">
                      <SvgIcon
                        name="business/check"
                        :size="24"
                      />
                    </div>
                  </div>
                  <div class="h-[22px] flex items-center justify-between">
                    <div class="flex-1 flex items-center gap-[6px]">
                      Unlimited access to
                      <div class="w-[60px] h-[22px] relative">
                        <div
                          class="bg-b_card dark:bg-b_card_dk text-black dark:text-white border border-white dark:border-d_1_dk rounded-full absolute top-0 left-0 w-[22px] h-[22px] shadow-md flex items-center justify-center"
                        >
                          <GPT />
                        </div>
                        <div
                          class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-[19px] w-[22px] h-[22px] shadow-md flex items-center justify-center"
                        >
                          <Gemini />
                        </div>
                        <div
                          class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-[38px] w-[22px] h-[22px] shadow-md flex items-center justify-center"
                        >
                          <Claude />
                        </div>
                      </div>
                    </div>
                    <div class="flex justify-center items-center w-10 mr-1">
                      <i class="w-[11px] h-[3px] bg-[#CCCCCC] dark:bg-[#485162] rounded-full"></i>
                    </div>
                    <div class="w-10 flex justify-center items-center">
                      <SvgIcon
                        name="business/check"
                        :size="24"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 价格计划部分 -->
        <div class="relative flex flex-col items-center self-stretch gap-[24px]">
          <!-- 价格卡片容器 -->
          <div class="flex flex-row justify-center items-end self-stretch gap-[3px]">
            <div
              v-for="plan in plansConfig"
              :key="plan.key"
              class="w-[110px] bg-b_1 dark:bg-b_1_dk rounded-xl flex flex-col cursor-pointer transition-all duration-200 overflow-hidden"
              :class="{
                'border-2 border-b_iap_1': selectedPlan === plan.key,
                'border-2 border-d_1 dark:border-d_1_dk': selectedPlan !== plan.key,
              }"
              @click="handleSelectPlan(plan.key as 'yearly' | 'weekly' | 'monthly' | 'quarterly')"
            >
              <!-- 折扣徽章 -->
              <div
                v-if="selectedPlan === plan.key"
                class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
              >
                <span
                  v-if="plan.key === 'monthly' && plan.showFirstMonth"
                  class="text-white text-[14px] font-bold font-['Inter'] leading-[1] text-right italic text-nowrap"
                >
                  {{ plan.giftCountdown }}
                </span>
                <span
                  v-else
                  class="text-white text-[14px] font-bold font-['Inter'] leading-[1] text-right italic text-nowrap"
                >
                  SAVE {{ plan.discount }}
                </span>
                <SvgIcon
                  name="business/save-flash"
                  size="12"
                  fill="#FFD725"
                />
              </div>

              <!-- 计划内容 -->
              <div class="flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
                <div class="text-t_1 dark:text-t_1_dk text-[14px] font-[400] leading-[1em] text-center">
                  {{ plan.label }}
                </div>
                <div class="text-t_1 dark:text-t_1_dk font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
                  <div class="text-[22px] font-[700] leading-[1em]">${{ plan.price }}</div>
                  <div class="text-t_3 dark:text-t_3_dk text-[12px] font-[400] leading-[1em]">
                    {{ plan.priceUnit }}
                  </div>
                </div>
                <div
                  class="text-t_3 dark:text-t_3_dk text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
                >
                  {{ plan.originalPrice }}
                </div>
              </div>
            </div>
          </div>

          <!-- 确认按钮 -->
          <div class="flex flex-col items-center self-stretch gap-[16px] px-[24px]">
            <button
              class="bg-[#ffce4f] hover:bg-[#FFC52F] dark:bg-[#FFCE4F] dark:hover:bg-[#FACA4E] rounded-[90px] flex justify-center items-center self-stretch gap-[10px] transition-all duration-100"
              :class="
                selectedPlan === 'monthly' && !pricingProducts?.monthDiscountUsed && hasFirstDayMonthlyDiscount
                  ? 'h-[55px] -my-0.5'
                  : 'h-[51px]'
              "
              @click="checkOutClick(selectedPlan)"
            >
              <div
                class="text-[#461702] text-[18px] font-bold font-['Inter'] leading-[1.3] text-center flex flex-col items-center"
                v-if="!loading"
              >
                {{ getButtonText() }}
                <span
                  v-if="selectedPlan === 'monthly' && !pricingProducts?.monthDiscountUsed && hasFirstDayMonthlyDiscount"
                  class="text-[#934A2A] text-[12px] font-[400] leading-[1.3] font-['Inter'] text-center"
                  >${{ monthlyPrice }} 1st month, then $12.99/mo</span
                >
              </div>
              <SpinnerIcon
                v-else
                class="mt-[2px] inline-block h-7 w-7 animate-spin text-white"
              />
            </button>
          </div>
        </div>
      </div>

      <div
        v-else-if="shouldShowTicket"
        key="ticket"
        class="w-full"
      >
        <PriceTicket
          @claimOffer="handleClaimOffer"
          @noThanks="handleNoThanks"
        />
      </div>
      <div
        v-else-if="showGift"
        key="gift"
        class="w-full"
      >
        <PriceGift
          @tryForFree="handleTryForFree"
          @noThanks="handleNoThanks"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import useCheckout, { CheckoutType } from '@/entrypoints/sidepanel/composables/useCheckout'
import trackEvent from '~/utils/trackEvent'
import usePricingProducts from '@/entrypoints/sidepanel/composables/usePricingProducts'
import useABTest from '@/composables/useABTest'
import { useDarkMode } from '@/composables/useDarkMode'
import PriceTicket from './PriceTicket.vue'
import PriceGift from './PriceGift.vue'
import { STORAGE_KEY } from '~/config'
import SpinnerIcon from '@/assets/icons/spinner.svg'

import SolvelyFast from '@/assets/icons/business/solvely-fast.svg'
import SolvelyMulti from '@/assets/icons/business/solvely-multi.svg'
import GPT from '@/assets/icons/business/gpt.svg'
import Gemini from '@/assets/icons/business/gemini.svg'
import Claude from '@/assets/icons/business/claude.svg'

const { isDark } = useDarkMode()

// 使用全局定价信息状态管理
const { pricingProducts, isLoading, initPricingProducts } = usePricingProducts()

const showBenefits = ref(false)
const showTicketInternal = ref(false)
const showGift = ref(false)

// 存储 key 使用全局配置

// 首天月包优惠标志位：默认 true，超出 24h 后自动变为 false
const hasFirstDayMonthlyDiscount = ref(true)

let giftExpireTimer: number | null = null
const GIFT_DURATION = 24 * 60 * 60 * 1000
// const GIFT_DURATION = 1 * 2 * 60 * 1000

// 倒计时（24 小时制显示 HH:MM:SS），与首天优惠同生命周期
const giftRemainingMs = ref(0)
let giftCountdownTimer: number | null = null

const formatTwo = (n: number) => n.toString().padStart(2, '0')
const giftCountdown = computed(() => {
  const total = Math.max(0, giftRemainingMs.value)
  const totalSeconds = Math.floor(total / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${formatTwo(hours)}:${formatTwo(minutes)}:${formatTwo(seconds)}`
})

const clearGiftCountdown = () => {
  if (giftCountdownTimer !== null) {
    clearInterval(giftCountdownTimer)
    giftCountdownTimer = null
  }
}

const startGiftCountdown = (startTs: number) => {
  clearGiftCountdown()
  const endTs = startTs + GIFT_DURATION
  const tick = () => {
    const now = Date.now()
    const remaining = Math.max(0, endTs - now)
    giftRemainingMs.value = remaining
    if (remaining <= 0) {
      clearGiftCountdown()
    }
  }
  tick()
  giftCountdownTimer = window.setInterval(tick, 1000)
}

const clearGiftTimer = () => {
  if (giftExpireTimer !== null) {
    clearTimeout(giftExpireTimer)
    giftExpireTimer = null
  }
}

const scheduleGiftExpiry = (startTs: number) => {
  clearGiftTimer()
  const now = Date.now()
  const endTs = startTs + GIFT_DURATION
  if (now >= endTs) {
    hasFirstDayMonthlyDiscount.value = false
    return
  }
  const remaining = endTs - now
  giftExpireTimer = window.setTimeout(() => {
    hasFirstDayMonthlyDiscount.value = false
    giftExpireTimer = null
  }, remaining)
}

// 合并外部 prop 和内部状态，任意一个为 true 就显示
const shouldShowTicket = computed(() => props.showTicket || showTicketInternal.value)

// 原始价格=======================================================================
const yearlyOriginPrice = 179.88
const monthlyOriginPrice = 14.99
const quarterlyOriginPrice = 44.99

// 实际价格=======================================================================
// 年包实际价格
const yearlyPrice = computed(() => {
  const basePrice = Number(pricingProducts.value?.subscription['12']?.price || 0)
  if (!basePrice) return 0
  return Math.floor((basePrice / 12) * 100) / 100
})
// 月包实际价格
const monthlyPrice = computed(() => {
  const basePrice = Number(pricingProducts.value?.subscription['1']?.price || 0)
  if (!basePrice) return 0
  if (!pricingProducts.value?.monthDiscountUsed && hasFirstDayMonthlyDiscount.value) {
    return Math.max(basePrice - 6, 0)
  }
  return basePrice
})
// 季包实际价格，要除以3，两位数取整
const quarterlyPrice = computed(() => {
  const basePrice = Number(pricingProducts.value?.subscription['3']?.price || 0)
  if (!basePrice) return 0
  return Math.floor((basePrice / 3) * 100) / 100
})
// 折扣=======================================================================
// 年包折扣
const yearlyDiscount = computed(() => {
  return Math.floor((1 - yearlyPrice.value / (yearlyOriginPrice / 12)) * 100) + '%'
})
// 月包折扣
const monthlyDiscount = computed(() => {
  return Math.floor((1 - monthlyPrice.value / monthlyOriginPrice) * 100) + '%'
})
// 季包折扣,原始价格要/3，两位数取整
const quarterlyDiscount = computed(() => {
  return Math.floor((1 - quarterlyPrice.value / (quarterlyOriginPrice / 3)) * 100) + '%'
})

interface PricePanelProps {
  // PricePanel 有两种显示模式 一种是作为 modal 显示，一种是作为 popup 显示
  showModel?: 'modal' | 'popup'
  from?: string
  showTicket?: boolean
}

const props = withDefaults(defineProps<PricePanelProps>(), {
  showModel: 'popup',
  showTicket: false,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

// 当前选中的
const selectedPlan = ref<'yearly' | 'weekly' | 'monthly' | 'quarterly'>('yearly')
const loading = ref(false)

const { createCheckoutOrder } = useCheckout()

// 判断是否是免费试用用户
const isFreeTrailUser = computed(() => {
  return !useSubscription.purchasedFreeTrial.value
})

// 定义一个映射对象，将 plan 的值映射到 trackEvent 所需的 package 值
const planPackageMap = {
  yearly: 'annual',
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
}

// 计划配置映射表 - 统一包含价格和折扣
const plansConfig = computed(() => [
  {
    key: 'yearly',
    label: 'Yearly',
    price: yearlyPrice.value,
    discount: yearlyDiscount.value,
    priceUnit: '/mo',
    originalPrice: '$179.88/yr',
  },
  {
    key: 'quarterly',
    label: 'Quarterly',
    price: quarterlyPrice.value,
    discount: quarterlyDiscount.value,
    priceUnit: '/mo',
    originalPrice: '$44.99/qtr',
  },
  {
    key: 'monthly',
    label: 'Monthly',
    price: monthlyPrice.value,
    discount: monthlyDiscount.value,
    priceUnit: !pricingProducts.value?.monthDiscountUsed && hasFirstDayMonthlyDiscount.value ? '1st mo' : '/mo',
    originalPrice: '$14.99/mo',
    showFirstMonth: !pricingProducts.value?.monthDiscountUsed && hasFirstDayMonthlyDiscount.value,
    giftCountdown: giftCountdown.value,
  },
])

// 获取按钮文本
const getButtonText = () => {
  if (selectedPlan.value === 'yearly' && isFreeTrailUser.value) {
    return 'Start 3-Day Free Trial'
  }
  return 'Continue'
}

const handleSelectPlan = (plan: 'yearly' | 'weekly' | 'monthly' | 'quarterly') => {
  const packageName = planPackageMap[plan as keyof typeof planPackageMap]
  if (props.showModel === 'modal') {
    trackEvent.track('Plugin_Sidebar_Paywall_Package', {
      package: packageName,
      from: props.from,
    })
  } else {
    trackEvent.track('Plugin_Sidebar_Upgrade_Package', {
      package: packageName,
      from: props.from,
    })
  }
  selectedPlan.value = plan
}

const handleViewFullBenefits = () => {
  showBenefits.value = !showBenefits.value
}

// 点击 checkout 按钮
const checkOutClick = async (mode: 'weekly' | 'yearly' | 'monthly' | 'quarterly') => {
  loading.value = true
  switch (mode) {
    case 'weekly':
      if (!pricingProducts.value?.weekDiscountUsed) {
        await createCheckoutOrder(CheckoutType.WEEKLY, undefined, { discount: 'discount_5_usd' })
      } else {
        await createCheckoutOrder(CheckoutType.WEEKLY)
      }
      break
    case 'yearly':
      await createCheckoutOrder(CheckoutType.YEARLY)
      break
    case 'monthly':
      if (!pricingProducts.value?.monthDiscountUsed && hasFirstDayMonthlyDiscount.value) {
        await createCheckoutOrder(CheckoutType.MONTHLY, undefined, { discount: 'discount_6_usd' })
      } else {
        await createCheckoutOrder(CheckoutType.MONTHLY)
      }
      break
    case 'quarterly':
      await createCheckoutOrder(CheckoutType.QUARTERLY)
      break
  }
  if (isFreeTrailUser.value && selectedPlan.value === 'yearly') {
    if (props.showModel === 'modal') {
      trackEvent.track('Plugin_Sidebar_Paywall_Freetrial', {
        from: props.from,
      })
    } else {
      trackEvent.track('Plugin_Sidebar_Upgrade_Freetrial', {
        from: props.from,
      })
    }
  } else {
    if (props.showModel === 'modal') {
      trackEvent.track('Plugin_Sidebar_Paywall_Purchase', {
        from: props.from,
      })
    } else {
      trackEvent.track('Plugin_Sidebar_Upgrade_Purchase', {
        from: props.from,
      })
    }
  }
  loading.value = false
}

const handleClose = async () => {
  // 优先处理首天月包礼物弹窗逻辑
  if (!hasFirstDayMonthlyDiscount.value && isFreeTrailUser.value) {
    const clickRes = (await browser.storage.local.get(STORAGE_KEY.PRICE_GIFT_CLICK).catch(() => ({} as any))) as Record<
      string,
      any
    >
    const clicked = clickRes[STORAGE_KEY.PRICE_GIFT_CLICK]
    if (!clicked) {
      await browser.storage.local.set({ [STORAGE_KEY.PRICE_GIFT_CLICK]: 1 }).catch(() => {})
      showGift.value = true
      return
    }
  }

  // 检查是否有时间戳
  const result = await browser.storage.local.get(STORAGE_KEY.PRICE_TICKET_TIMESTAMP)
  const existingTimestamp = result[STORAGE_KEY.PRICE_TICKET_TIMESTAMP]

  if (!existingTimestamp && !pricingProducts.value?.weekDiscountUsed) {
    // 没有时间戳，显示 PriceTicket
    showTicketInternal.value = true
  } else {
    // 有时间戳，直接关闭
    emit('close')
  }
}

const handleClaimOffer = () => {
  checkOutClick('weekly')
}

const handleNoThanks = () => {
  emit('close')
}

const handleTryForFree = () => {
  checkOutClick('yearly')
}

onMounted(async () => {
  // 确保定价信息已初始化
  if (!pricingProducts.value && !isLoading.value) {
    await initPricingProducts()
  }

  // 组件挂载时检查并写入 gift 时间戳（最小化容错）
  const giftResult = (await browser.storage.local
    .get(STORAGE_KEY.PRICE_GIFT_TIMESTAMP)
    .catch(() => ({} as any))) as Record<string, any>
  const existingGiftTimestamp = giftResult[STORAGE_KEY.PRICE_GIFT_TIMESTAMP]
  if (!existingGiftTimestamp) {
    const nowTs = Date.now()
    await browser.storage.local.set({ [STORAGE_KEY.PRICE_GIFT_TIMESTAMP]: nowTs }).catch(() => {})
    scheduleGiftExpiry(nowTs)
    startGiftCountdown(nowTs)
  } else {
    const ts = Number(existingGiftTimestamp) || 0
    if (ts > 0) {
      scheduleGiftExpiry(ts)
      startGiftCountdown(ts)
    }
  }

  onUnmounted(() => {
    clearGiftTimer()
    clearGiftCountdown()
  })
})
</script>

<style scoped>
.element {
  filter: drop-shadow(-1.818px 0 4.545px rgba(17, 17, 17, 0.05)) drop-shadow(0.909px 0 4.545px rgba(17, 17, 17, 0.05));
}

/* 过渡动画 */
.slide-down-enter-active,
.slide-down-leave-active,
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-in-out;
}

/* 向下滑动动画（切换到 benefits） */
.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-30px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

/* 向上滑动动画（返回主界面） */
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

.slide-down-enter-to,
.slide-down-leave-from,
.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* 背景淡入淡出效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

/* 价格区域淡入淡出动画 */
.pricing-fade-up-enter-active,
.pricing-fade-up-leave-active {
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
}

/* 离开时向上渐隐 */
.pricing-fade-up-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

/* 进入时从原位淡入 */
.pricing-fade-up-enter-from {
  opacity: 0;
}

.pricing-fade-up-enter-to,
.pricing-fade-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
