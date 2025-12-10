<template>
  <div
    class="w-[355px] relative rounded-xl border border-d_2 dark:border-d_1_dk bg-b_1 dark:bg-b_1_dk flex flex-col justify-start items-center shadow-lg pb-[30px]"
  >
    <!-- Background with transition effects -->
    <Transition
      name="fade"
      mode="out-in"
    >
      <img
        v-if="!showBenefits && !isDark"
        key="header-bg"
        src="@/assets/images/business/modle-header.webp"
        alt=""
        class="absolute inset-0 w-full object-cover pointer-events-none select-none rounded-t-xl"
      />
      <img
        v-else-if="!showBenefits && isDark"
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

    <!-- Header -->
    <div class="relative w-full h-[318px] overflow-hidden">
      <Transition
        :name="showBenefits ? 'slide-down' : 'slide-up'"
        mode="out-in"
      >
        <!-- Main content -->
        <div
          v-if="!showBenefits"
          key="main"
          class="relative flex flex-col items-center w-full pt-[38px] mb-2"
        >
          <!-- Icons -->
          <div class="w-[203px] h-[109px] mb-[21px]">
            <img
              src="@/assets/images/business/modle-icons.webp"
              alt=""
              class="w-full h-full object-cover"
            />
          </div>
          <!-- Title -->
          <div
            class="text-center text-[#461702] dark:text-[#FFF1C6] text-[24px] font-[700] font-['Inter'] w-full whitespace-nowrap h-[29px] leading-[29px] mb-[2px]"
          >
            Your All-in-one AI Solver
          </div>
          <!-- Subtitle -->
          <div
            class="text-center text-[#461702] dark:text-[#FFF1C6] text-[16px] font-[600] font-['Inter'] w-full whitespace-nowrap h-[24px] leading-[24px]"
          >
            Unlimited access to top models
          </div>
          <!-- Compare -->
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

            <!-- Content overlay -->
            <div class="absolute inset-0 flex items-center justify-between px-[10px]">
              <!-- Left side: Other tools -->
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

              <!-- VS chip -->
              <div
                class="bg-b_1 dark:bg-b_1_dk rounded-full shadow-[0_1px_10px_rgba(153,153,153,0.1)] h-[24px] w-[24px] flex items-center justify-center"
              >
                <span class="text-[#461702] dark:text-[#FFF1C6] text-[12px] font-['Inter'] font-bold">VS</span>
              </div>

              <!-- Right side: Our price -->
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

            <!-- SAVE badge -->
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

        <!-- Benefits content -->
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
                    <div class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-0 w-[22px] h-[22px] shadow-md flex items-center justify-center">
                      <SolvelyFast />
                    </div>
                    <div class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-[19px] w-[22px] h-[22px] shadow-md flex items-center justify-center">
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
                <div class="flex-1 flex items-center gap-[6px]">Unlimited access to
                  <div class="w-[60px] h-[22px] relative">
                    <div class="bg-b_card dark:bg-b_card_dk text-black dark:text-white border border-white dark:border-d_1_dk rounded-full absolute top-0 left-0 w-[22px] h-[22px] shadow-md flex items-center justify-center">
                      <GPT/>
                    </div>
                    <div class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-[19px] w-[22px] h-[22px] shadow-md flex items-center justify-center">
                      <Gemini/>
                    </div>
                    <div class="bg-b_card dark:bg-b_card_dk border border-white dark:border-d_1_dk rounded-full absolute top-0 left-[38px] w-[22px] h-[22px] shadow-md flex items-center justify-center">
                      <Claude/>
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

    <!-- web用户显示全量周包计划 -->
    <div
      v-if="isFromWeb"
      class="relative flex flex-col items-center self-stretch gap-[24px]"
    >
      <!-- 价格容器 -->
      <div class="flex flex-row justify-center items-end self-stretch gap-[6px]">
        <div
          v-for="plan in webPlansConfig"
          :key="plan.key"
          class="w-[110px] bg-b_1 dark:bg-b_1_dk rounded-xl flex flex-col cursor-pointer color-transition overflow-hidden"
          :class="{
            'border-2 border-b_iap_1': selectedPlan === plan.key,
            'border-2 border-d_1 dark:border-d_1_dk': selectedPlan !== plan.key,
          }"
          @click="handleSelectPlan(plan.key)"
        >
          <!-- 折扣-->
          <div
            v-if="selectedPlan === plan.key"
            class="bg-gradient-to-r from-[#F70] to-[#FF0D00] flex items-center justify-center self-stretch h-auto py-[6px] px-[4px] pb-[4px]"
          >
            <span class="text-white text-[14px] font-bold font-['Inter'] leading-[1] text-right italic text-nowrap"
              >SAVE {{ plan.discount }}</span
            >
            <SvgIcon
              name="business/save-flash"
              size="12"
              fill="#FFDB00"
            />
          </div>

          <!-- 价格内容 -->
          <div class="text-t_1 dark:text-t_1_dk flex flex-col items-center self-stretch font-['Inter'] mt-[21px]">
            <div class="text-[14px] font-[400] leading-[1em] text-center">
              {{ plan.label }}
            </div>
            <div class="font-[400] flex items-end h-[22px] mt-[8px] mb-[10px]">
              <div class="text-[22px] font-[700] leading-[1em]">${{ plan.price }}</div>
              <div class="text-t_3 dark:text-t_3-dk text-[12px] font-[400] leading-[1em]">
                {{ plan.priceUnit }}
              </div>
            </div>
            <div
              class="text-t_3 dark:text-t_3-dk text-[14px] font-[400] leading-[1em] text-center line-through mb-[18px]"
            >
              {{ plan.originalPrice }}
            </div>
          </div>
        </div>
      </div>

      <!-- 确认按钮 -->
      <div class="flex flex-col items-center self-stretch gap-[16px] px-[24px]">
        <button
          class="bg-b_iap_1 hover:bg-[#FFC52F] dark:bg-b_iap_1_dk dark:hover:bg-[#FACA4E] rounded-[90px] flex justify-center items-center self-stretch gap-[10px] transition-all duration-100"
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
          <SpinnerIcon
            v-else
            class="mt-[2px] inline-block h-7 w-7 animate-spin text-white"
          />
        </button>
      </div>
    </div>

    <!-- 最原始对照组 -->
    <div
      v-else
      class="relative flex flex-col items-center self-stretch gap-[24px]"
    >
      <!-- Pricing cards container -->
      <div class="flex flex-row justify-center items-end self-stretch gap-[6px]">
        <div
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer color-transition overflow-hidden"
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
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer color-transition overflow-hidden"
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
          class="w-[110px] bg-white dark:bg-[#283142] rounded-xl flex flex-col cursor-pointer color-transition overflow-hidden"
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
          class="bg-[#ffce4f] hover:bg-[#FFC52F] dark:bg-[#FFCE4F] dark:hover:bg-[#FACA4E] rounded-[90px] flex justify-center items-center self-stretch gap-[10px] h-[51px] color-transition"
          @click="checkOutClick()"
        >
          <span
            class="text-[#461702] text-[18px] font-bold font-['Inter'] leading-[1.3] text-center"
            v-if="!loading"
          >
            {{ getButtonText() }}
          </span>
          <SpinnerIcon
            v-else
            class="mt-[2px] inline-block h-7 w-7 animate-spin text-white"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import useCheckout, { CheckoutType } from '@/entrypoints/sidepanel/composables/useCheckout'
import trackEvent from '~/utils/trackEvent'
import usePricingProducts from '@/entrypoints/sidepanel/composables/usePricingProducts'
import useABTest from '@/composables/useABTest'
import { useDarkMode } from '@/composables/useDarkMode'
import { inject } from 'vue'
import { AuthState } from '@/entrypoints/sidepanel/types/auth'
import { STORAGE_KEY } from '~/config'
import SpinnerIcon from '@/assets/icons/spinner.svg'

import SolvelyFast from '@/assets/icons/business/solvely-fast.svg'
import SolvelyMulti from '@/assets/icons/business/solvely-multi.svg'
import GPT from '@/assets/icons/business/gpt.svg'
import Gemini from '@/assets/icons/business/gemini.svg'
import Claude from '@/assets/icons/business/claude.svg'

const { isDark } = useDarkMode()
const auth = inject<AuthState>('auth')!

// const { isQuaterPackage } = useABTest()
// 使用全局定价信息状态管理
const { pricingProducts, isLoading, initPricingProducts } = usePricingProducts()

const showBenefits = ref(false)

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

// 计划配置映射表（isFromWeb 为 true 时使用）- 统一包含价格和折扣
const webPlansConfig = computed(() => [
  {
    key: 'weekly',
    label: 'Weekly',
    price: weeklyPrice.value,
    discount: weeklyDiscount.value,
    priceUnit: !pricingProducts.value?.weekDiscountUsed ? '1st wk' : '/wk',
    originalPrice: `$${weeklyOriginPrice}/wk`,
  },
  {
    key: 'yearly',
    label: 'Yearly',
    price: yearlyPrice.value,
    discount: yearlyDiscount.value,
    priceUnit: '/mo',
    originalPrice: `$${yearlyOriginPrice}/yr`,
  },
  {
    key: 'monthly',
    label: 'Monthly',
    price: monthlyPrice.value,
    discount: monthlyDiscount.value,
    priceUnit: '/mo',
    originalPrice: `$${monthlyOriginPrice}/mo`,
  },
])

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

const handleViewFullBenefits = () => {
  showBenefits.value = !showBenefits.value
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
      // 如果没有版本号，isFromWeb 保持为 false（默认值），selectedPlan 保持为 'yearly'
    } catch (error) {
      console.error('读取安装版本失败:', error)
      // 读取失败时，isFromWeb 保持为 false（默认值），selectedPlan 保持为 'yearly'
    }
  }
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
</style>
