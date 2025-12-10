<template>
  <div
    class="w-[355px] relative rounded-xl border border-[#eeeeee] dark:border-[#474C58] flex flex-col justify-start items-center shadow-lg bg-gradient-to-b from-[#fff] to-[#fff8e6] dark:from-[#1B212D] dark:to-[#2F3543] pb-[30px] pt-[20px] gap-[26px]"
    v-if="isFromWeb"
  >
    <!-- close button -->
    <button
      v-if="showModel === 'modal'"
      class="absolute right-4 top-4 w-6 h-6 flex items-center justify-center cursor-pointer z-10 rounded-full hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200"
      @click="$emit('close')"
    >
      <SvgIcon
        name="close"
        :size="10"
        fill="#555"
      />
    </button>

    <!-- Header section with diamond icon and title -->
    <div class="flex flex-col items-center w-[307px]">
      <div class="flex flex-col gap-[10px]">
        <!-- Diamond icon with shadow -->
        <div class="relative w-[100px] h-[99.49px]">
          <img
            class="w-[100px] h-[99.49px]"
            src="@/assets/images/unlimited-diamond.webp"
          />
          <!-- Shadow ellipse -->
          <div
            class="absolute w-[54.54px] h-[4.29px] rounded-full opacity-20 blur-[10px]"
            style="background: rgba(173, 114, 2, 0.5); left: 32.48px; top: 106.01px"
          ></div>
        </div>
      </div>

      <!-- Title -->
      <div
        class="text-center text-[#461702] dark:text-[#FFF1C6] text-[20px] font-bold font-['Inter'] leading-[24px] w-full whitespace-nowrap mb-[15px] mt-[4px]"
      >
        Unlimited access to all features
      </div>
      <!-- List -->
      <div
        class="flex flex-col items-start gap-[12px] w-[277px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[15px] leading-[15px] font-['Inter'] font-[400]"
      >
        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>Unlimited solve & chat</span>
        </div>
        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>Top-Tier Accuracy</span>
        </div>

        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>PDF, Youtube, webpage summarize</span>
        </div>

        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>Generate AI quiz from any webpage</span>
        </div>
      </div>
    </div>

    <!-- Pricing plans section -->
    <div class="flex flex-col items-center self-stretch gap-[24px]">
      <!-- Pricing cards container -->
      <div class="flex flex-row justify-center items-end self-stretch gap-[6px]">
        <!-- weekly plan -->
        <div
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer transition-all duration-200 overflow-hidden"
          :class="{
            'border-2 border-[#ffce4f]': selectedPlan === 'weekly',
            'border-2 border-[#eeeeee] dark:border-[#474C58]': selectedPlan !== 'weekly',
          }"
          @click="handleSelectPlan('weekly')"
        >
          <!-- Save badge - only show for weekly -->
          <div
            v-if="selectedPlan === 'weekly'"
            class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
          >
            <span class="text-white text-[14px] font-bold font-['Inter'] leading-[1] text-right italic text-nowrap"
              >SAVE {{ weeklyDiscount }}</span
            >
            <SvgIcon
              name="business/save-flash"
              size="12"
              fill="#FFD725"
            />
          </div>

          <!-- Plan content -->
          <div class="flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
            <div class="text-[#111111] dark:text-[#FFFFFF] text-[14px] font-[400] leading-[1em] text-center">
              Weekly
            </div>
            <div class="text-[#111111] dark:text-[#FFFFFF] font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
              <div class="text-[22px] font-[700] leading-[1em]">${{ weeklyPrice }}</div>
              <div
                class="text-[12px] font-[400] text-[#999999] dark:text-[#686868] leading-[1em]"
                v-if="!pricingProducts?.weekDiscountUsed"
              >
                1st wk
              </div>
              <div
                class="text-[12px] font-[400] text-[#999999] dark:text-[#686868] leading-[1em]"
                v-else
              >
                /wk
              </div>
            </div>
            <div
              class="text-[#999999] dark:text-[#686868] text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
            >
              $9.99/mo
            </div>
          </div>
        </div>
        <!-- 12 months plan -->
        <div
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer transition-all duration-200 overflow-hidden"
          :class="{
            'border-2 border-[#ffce4f]': selectedPlan === 'yearly',
            'border-2 border-[#eeeeee] dark:border-[#474C58]': selectedPlan !== 'yearly',
          }"
          @click="handleSelectPlan('yearly')"
        >
          <!-- Save badge - only show for yearly -->
          <div
            v-if="selectedPlan === 'yearly'"
            class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
          >
            <span class="text-white text-[14px] font-bold font-['Inter'] leading-[1] text-right italic text-nowrap"
              >SAVE {{ yearlyDiscount }}</span
            >
            <SvgIcon
              name="business/save-flash"
              size="12"
              fill="#FFD725"
            />
          </div>

          <!-- Plan content -->
          <div class="flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
            <div class="text-[#111111] dark:text-[#FFFFFF] text-[14px] font-[400] leading-[1em] text-center">
              Yearly
            </div>
            <div class="text-[#111111] dark:text-[#FFFFFF] font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
              <div class="text-[22px] font-[700] leading-[1em]">${{ yearlyPrice }}</div>
              <div class="text-[#999999] dark:text-[#686868] text-[12px] font-[400] leading-[1em]">/mo</div>
            </div>
            <div
              class="text-[#999999] dark:text-[#686868] text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
            >
              $179.88/yr
            </div>
          </div>
        </div>

        <!-- monthly plan -->
        <div
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer transition-all duration-200 overflow-hidden"
          :class="{
            'border-2 border-[#ffce4f]': selectedPlan === 'monthly',
            'border-2 border-[#eeeeee] dark:border-[#474C58]': selectedPlan !== 'monthly',
          }"
          @click="handleSelectPlan('monthly')"
        >
          <!-- Save badge - only show for monthly -->
          <div
            v-if="selectedPlan === 'monthly'"
            class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
          >
            <span class="text-white text-[14px] font-bold font-['Inter'] leading-[1] text-right italic text-nowrap"
              >SAVE {{ monthlyDiscount }}</span
            >
            <SvgIcon
              name="business/save-flash"
              size="12"
              fill="#FFD725"
            />
          </div>

          <!-- Plan content -->
          <div class="flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
            <div class="text-[#111111] dark:text-[#FFFFFF] text-[14px] font-[400] leading-[1em] text-center">
              Monthly
            </div>
            <div class="text-[#111111] dark:text-[#FFFFFF] font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
              <div class="text-[22px] font-[700] leading-[1em]">${{ monthlyPrice }}</div>
              <div class="text-[#999999] dark:text-[#686868] text-[12px] font-[400] leading-[1em]">/mo</div>
            </div>
            <div
              class="text-[#999999] dark:text-[#686868] text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
            >
              $14.99/mo
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div class="flex flex-col items-center self-stretch gap-[16px] px-[24px]">
        <button
          class="bg-[#ffce4f] hover:bg-[#FFC52F] dark:bg-[#FFCE4F] dark:hover:bg-[#FACA4E] rounded-[90px] flex justify-center items-center self-stretch gap-[10px]"
          :class="selectedPlan === 'weekly' && !pricingProducts?.weekDiscountUsed ? 'h-[55px] -my-0.5' : 'h-[51px]'"
          @click="checkOutClick()"
        >
          <div
            class="text-[#461702] text-[18px] font-bold font-['Inter'] leading-[1.3] text-center flex flex-col items-center"
            v-if="!loading"
          >
            Continue
            <span
              v-if="selectedPlan === 'weekly' && !pricingProducts?.weekDiscountUsed"
              class="text-[#934A2A] text-[12px] font-[400] leading-[1.3] font-['Inter'] text-center"
              >${{ weeklyPrice }} 1st week, then $6.99/wk</span
            >
          </div>
          <svg
            v-else
            class="mt-[2px] inline-block h-7 w-7 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
  <div
    class="w-[355px] relative rounded-xl border border-[#eeeeee] dark:border-[#474C58] flex flex-col justify-start items-center shadow-lg bg-gradient-to-b from-[#fff] to-[#fff8e6] dark:from-[#1B212D] dark:to-[#2F3543] pb-[30px] pt-[20px] gap-[26px]"
    v-else
  >
    <!-- close button -->
    <button
      v-if="showModel === 'modal'"
      class="absolute right-4 top-4 w-6 h-6 flex items-center justify-center cursor-pointer z-10 rounded-full hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200"
      @click="$emit('close')"
    >
      <SvgIcon
        name="close"
        :size="10"
        fill="#555"
      />
    </button>

    <!-- Header section with diamond icon and title -->
    <div class="flex flex-col items-center w-[307px]">
      <div class="flex flex-col gap-[10px]">
        <!-- Diamond icon with shadow -->
        <div class="relative w-[100px] h-[99.49px]">
          <img
            class="w-[100px] h-[99.49px]"
            src="@/assets/images/unlimited-diamond.webp"
          />
          <!-- Shadow ellipse -->
          <div
            class="absolute w-[54.54px] h-[4.29px] rounded-full opacity-20 blur-[10px]"
            style="background: rgba(173, 114, 2, 0.5); left: 32.48px; top: 106.01px"
          ></div>
        </div>
      </div>

      <!-- Title -->
      <div
        class="text-center text-[#461702] dark:text-[#FFF1C6] text-[20px] font-bold font-['Inter'] leading-[24px] w-full whitespace-nowrap mb-[15px] mt-[4px]"
      >
        Unlimited access to all features
      </div>
      <!-- List -->
      <div
        class="flex flex-col items-start gap-[12px] w-[277px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[15px] leading-[15px] font-['Inter'] font-[400]"
      >
        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>Unlimited solve & chat</span>
        </div>
        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>Top-Tier Accuracy</span>
        </div>

        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>PDF, Youtube, webpage summarize</span>
        </div>

        <div class="flex items-center gap-[6px]">
          <SvgIcon
            name="business/tick"
            size="16"
          />
          <span>Generate AI quiz from any webpage</span>
        </div>
      </div>
    </div>

    <!-- Pricing plans section -->
    <div class="flex flex-col items-center self-stretch gap-[24px]">
      <!-- Pricing cards container -->
      <div class="flex flex-row justify-center items-end self-stretch gap-[6px]">
        <!-- 12 months plan -->
        <div
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer transition-all duration-200 overflow-hidden"
          :class="{
            'border-2 border-[#ffce4f]': selectedPlan === 'yearly',
            'border-2 border-[#eeeeee] dark:border-[#474C58]': selectedPlan !== 'yearly',
          }"
          @click="handleSelectPlan('yearly')"
        >
          <!-- Save badge - only show for yearly -->
          <div
            v-if="selectedPlan === 'yearly'"
            class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
          >
            <span class="text-white text-[14px] font-bold font-['Inter'] leading-[1em] text-right italic"
              >SAVE 62%</span
            >
            <SvgIcon
              name="business/save-flash"
              size="12"
              fill="#FFD725"
            />
          </div>

          <!-- Plan content -->
          <div class="flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
            <div class="text-[#111111] dark:text-[#FFFFFF] text-[14px] font-[400] leading-[1em] text-center">
              Yearly
            </div>
            <div class="text-[#111111] dark:text-[#FFFFFF] font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
              <div class="text-[22px] font-[700] leading-[1em]">${{ formatPriceByMonth(plans?.['12']) }}</div>
              <div class="text-[12px] font-[400] leading-[1em]">/mo</div>
            </div>
            <div
              class="text-[#999999] dark:text-[#686868] text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
            >
              $179.88/yr
            </div>
          </div>
        </div>

        <!-- 1 month plan -->
        <div
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer transition-all duration-200 overflow-hidden"
          :class="{
            'border-2 border-[#ffce4f]': selectedPlan === 'monthly',
            'border-2 border-[#eeeeee] dark:border-[#474C58]': selectedPlan !== 'monthly',
          }"
          @click="handleSelectPlan('monthly')"
        >
          <!-- Save badge - only show for monthly -->
          <div
            v-if="selectedPlan === 'monthly'"
            class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
          >
            <span class="text-white text-[14px] font-bold font-['Inter'] leading-[1em] text-right italic"
              >SAVE 13%</span
            >
            <SvgIcon
              name="business/save-flash"
              size="12"
              fill="#FFD725"
            />
          </div>

          <!-- Plan content -->
          <div class="flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
            <div class="text-[#111111] dark:text-[#FFFFFF] text-[14px] font-[400] leading-[1em] text-center">
              Monthly
            </div>
            <div class="text-[#111111] dark:text-[#FFFFFF] font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
              <div class="text-[22px] font-[700] leading-[1em]">${{ plans?.['1']?.price || '12.99' }}</div>
              <div class="text-[12px] font-[400] leading-[1em]">/mo</div>
            </div>
            <div
              class="text-[#999999] dark:text-[#686868] text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
            >
              $14.99/mo
            </div>
          </div>
        </div>

        <!-- 1 week plan -->
        <div
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer transition-all duration-200 overflow-hidden"
          :class="{
            'border-2 border-[#ffce4f]': selectedPlan === 'weekly',
            'border-2 border-[#eeeeee] dark:border-[#474C58]': selectedPlan !== 'weekly',
          }"
          @click="handleSelectPlan('weekly')"
        >
          <!-- Save badge - only show for weekly -->
          <div
            v-if="selectedPlan === 'weekly'"
            class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
          >
            <span class="text-white text-[14px] font-bold font-['Inter'] leading-[1em] text-right italic"
              >SAVE 30%</span
            >
            <SvgIcon
              name="business/save-flash"
              size="12"
              fill="#FFD725"
            />
          </div>

          <!-- Plan content -->
          <div class="flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
            <div class="text-[#111111] dark:text-[#FFFFFF] text-[14px] font-[400] leading-[1em] text-center">
              Weekly
            </div>
            <div class="text-[#111111] dark:text-[#FFFFFF] font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
              <div class="text-[22px] font-[700] leading-[1em]">${{ plans?.['7']?.price || '6.99' }}</div>
              <div class="text-[12px] font-[400] leading-[1em]">/wk</div>
            </div>
            <div
              class="text-[#999999] dark:text-[#686868] text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
            >
              $9.99/wk
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div class="flex flex-col items-center self-stretch gap-[16px] px-[24px]">
        <button
          class="bg-[#ffce4f] hover:bg-[#FFC52F] dark:bg-[#FFCE4F] dark:hover:bg-[#FACA4E] rounded-[90px] flex justify-center items-center self-stretch gap-[10px] h-[51px]"
          @click="checkOutClick()"
        >
          <span
            class="text-[#461702] text-[18px] font-bold font-['Inter'] leading-[1.3] text-center"
            v-if="!loading"
          >
            {{ getButtonText() }}
          </span>
          <svg
            v-else
            class="mt-[2px] inline-block h-7 w-7 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import useCheckout, { CheckoutType } from '@/entrypoints/sidepanel/composables/useCheckout'
import trackEvent from '~/utils/trackEvent'
import usePricingProducts from '@/entrypoints/sidepanel/composables/usePricingProducts'
import { AuthState } from '@/entrypoints/sidepanel/types/auth'
import { STORAGE_KEY } from '~/config'

const auth = inject<AuthState>('auth')!
// 使用全局定价信息状态管理
const { pricingProducts, isLoading, initPricingProducts } = usePricingProducts()

// 判断是否来自 web 或 SEM，且版本号 >= 0.5.4
const isFromWeb = ref(false)

function compareSemver(a: string, b: string): number {
  const pa = (a || '0').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = (b || '0').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

// 原始价格=======================================================================
const yearlyOriginPrice = 179.88
const monthlyOriginPrice = 14.99
const quarterlyOriginPrice = 44.99
const weeklyOriginPrice = 9.99

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
  return Math.floor(basePrice * 100) / 100
})
// 季包实际价格，要除以3，两位数取整
const quarterlyPrice = computed(() => {
  const basePrice = Number(pricingProducts.value?.subscription['3']?.price || 0)
  if (!basePrice) return 0
  return Math.floor((basePrice / 3) * 100) / 100
})
// 周包实际价格，要除以7，两位数取整
const weeklyPrice = computed(() => {
  const basePrice = Number(pricingProducts.value?.subscription['7']?.price || 0)
  if (!basePrice) return 0
  if (!pricingProducts.value?.weekDiscountUsed) {
    const discountedPrice = Math.max(basePrice - 5, 0)
    return Math.floor(discountedPrice * 100) / 100
  }
  return basePrice
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
// 周包折扣,原始价格要/7，两位数取整
const weeklyDiscount = computed(() => {
  return Math.floor((1 - weeklyPrice.value / weeklyOriginPrice) * 100) + '%'
})

interface PricePanelProps {
  // PricePanel 有两种显示模式 一种是作为 modal 显示，一种是作为 popup 显示
  showModel?: 'modal' | 'popup'
  from?: string
}

const props = withDefaults(defineProps<PricePanelProps>(), {
  showModel: 'popup',
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

// 当前选中的
const selectedPlan = ref('yearly')
const loading = ref(false)

const { createCheckoutOrder } = useCheckout()

// 判断是否是免费试用用户
const isFreeTrailUser = computed(() => {
  return !useSubscription.purchasedFreeTrial.value
})

// 计算属性：获取订阅计划
const plans = computed(() => {
  return pricingProducts.value?.subscription || null
})

// 定义一个映射对象，将 plan 的值映射到 trackEvent 所需的 package 值
const planPackageMap = {
  yearly: 'annual',
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
}

// 格式化月付价格
const formatPriceByMonth = (subscription: any) => {
  if (!subscription) return '4.33'
  return (Math.floor((subscription.price / 12) * 100) / 100).toFixed(2)
}

// 获取按钮文本
const getButtonText = () => {
  if (selectedPlan.value === 'yearly' && isFreeTrailUser.value) {
    return 'Start 3-Day Free Trial'
  }
  return 'Continue'
}

const handleSelectPlan = (plan: string) => {
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

// 点击 checkout 按钮
const checkOutClick = async () => {
  loading.value = true
  switch (selectedPlan.value) {
    case 'weekly':
      if (!pricingProducts.value?.weekDiscountUsed && isFromWeb.value) {
        await createCheckoutOrder(CheckoutType.WEEKLY, undefined, { discount: 'discount_5_usd' })
      } else {
        await createCheckoutOrder(CheckoutType.WEEKLY)
      }
      break
    case 'yearly':
      await createCheckoutOrder(CheckoutType.YEARLY)
      break
    case 'monthly':
      await createCheckoutOrder(CheckoutType.MONTHLY)
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

onMounted(async () => {
  // 确保定价信息已初始化
  if (!pricingProducts.value && !isLoading.value) {
    await initPricingProducts()
  }

  // 判断是否来自 web 或 SEM，且版本号 >= 0.5.4
  const userFrom = (auth as any).userFrom?.value || ''
  const isWebOrSEM = userFrom === 'web' || userFrom === 'SEM'

  if (isWebOrSEM) {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY.INSTALL_VERSION)
      const installVersion = result[STORAGE_KEY.INSTALL_VERSION]
      // 判断是否存在版本号，且版本号 >= 0.5.4
      if (installVersion && typeof installVersion === 'string' && installVersion.trim().length > 0) {
        const version = installVersion.trim()
        if (compareSemver(version, '0.5.4') >= 0) {
          isFromWeb.value = true
          selectedPlan.value = 'weekly'
        }
      }
      // 如果没有版本号，isFromWeb 保持为 false（默认值）
    } catch (error) {
      console.error('读取安装版本失败:', error)
      // 读取失败时，isFromWeb 保持为 false（默认值）
    }
  }
})
</script>
