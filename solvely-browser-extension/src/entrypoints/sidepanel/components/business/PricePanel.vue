<template>
  <div
    class="relative rounded-xl border border-[#eeeeee] dark:border-[#474C58] flex flex-col justify-start items-center pt-[14px] px-[26px] shadow-lg dark:bg-[#1B212D]"
    :class="{
      'w-[322px] h-[688px]': showModel === 'modal',
      'w-[364px] h-[576px] bg-white dark:bg-[#1B212D]': showModel === 'popup',
    }"
  >
    <!-- close button -->
    <button
      v-if="showModel === 'modal'"
      class="absolute right-4 top-4 w-6 h-6 flex items-center justify-center cursor-pointer z-10"
      @click="$emit('close')"
    >
      <SvgIcon name="close" :size="10" fill="#555" class="dark:fill-[#D1D3D5]" />
    </button>
    <div
      class="self-stretch flex flex-col justify-start items-center gap-1 mb-[30px]"
      v-show="!showAllPlans"
    >
      <img
        :class="{
          'w-[120px] h-[120px]': showModel === 'modal',
          'w-[80px] h-[80px]': showModel === 'popup',
        }"
        src="@/assets/images/unlimited-diamond.webp"
      />
      <div class="self-stretch flex flex-col justify-start items-center">
        <div
          class="self-stretch text-center justify-start text-[#111111] dark:text-[#FFFFFF] font-bold font-['Inter'] leading-[1.21]"
          :class="{
            'text-[22px] mb-[30px]': showModel === 'modal',
            'text-[16px] mb-[14px]': showModel === 'popup',
          }"
        >
          {{
            showModel === 'modal'
              ? 'Unlock Unlimited Access'
              : 'Unlock Your All-in-One Study Suite'
          }}
        </div>
        <div
          class="flex flex-col justify-start items-center gap-[10px] px-[10px]"
        >
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="self-stretch inline-flex justify-start items-center gap-[6px]"
          >
            <div class="w-4 h-4 relative rounded-[22.83px] overflow-hidden">
              <SvgIcon name="business/check-mark" size="16" />
            </div>
            <div
              class="justify-center text-[#111111] dark:text-[#FFFFFF] text-[14px] font-normal font-['Inter'] leading-[14px] whitespace-nowrap"
              :class="{ 'flex-1': index === 0 }"
            >
              {{ feature }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="w-full" v-show="showAllPlans">
      <div
        class="text-[#111111] dark:text-[#FFFFFF] text-[22px] font-bold font-['Inter'] leading-[1.21] text-center"
        :class="{
          'mt-[95px] mb-[32px]': showModel === 'modal',
          'my-[32px]': showModel === 'popup',
        }"
      >
        Choose a plan
      </div>
      <!-- Popular Choice Header with Line -->
      <div class="relative flex items-center justify-center h-[14px] mb-[16px]">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-[#EEEEEE] dark:border-[#474C58]"></div>
        </div>
        <div class="relative bg-white dark:bg-[#1B212D] px-[7px]">
          <span class="text-[14px] font-semibold font-['Inter'] text-[#111111] dark:text-[#FFFFFF]"
            >Popular Choice</span
          >
        </div>
      </div>
    </div>
    <div class="w-[300px] relative flex flex-col gap-[20px]">
      <!-- Weekly Plan -->
      <div
        class="w-full h-[66px] flex flex-col justify-start items-center gap-2.5 cursor-pointer relative"
        @click="handleSelectPlan('weekly')"
      >
        <div
          class="self-stretch h-[66px] px-[20px] py-[20px] rounded-xl flex flex-col justify-center items-center gap-2.5 overflow-hidden"
          :class="{
            'outline outline-2 outline-offset-[-2px] outline-[#eeeeee] dark:outline-[#474C58] bg-white dark:bg-[#283142]':
              selectedPlan !== 'weekly',
            'outline outline-[3px] outline-offset-[-3px] outline-[#ffce4f] bg-[#fffdf8] dark:bg-[#2F3543]':
              selectedPlan === 'weekly',
          }"
        >
          <div
            class="self-stretch flex flex-col justify-start items-center gap-[1.8px]"
          >
            <div class="self-stretch inline-flex justify-between items-center">
              <div
                class="justify-center text-[#461702] dark:text-[#FFCE4F] text-[18px] font-bold font-['Inter'] leading-[1.11] tracking-[0.25px]"
              >
                Weekly
              </div>
              <div
                class="justify-center text-[#461702] dark:text-[#FFCE4F] text-[16px] font-semibold font-['Inter'] leading-[1.1]"
              >
                {{ formatPriceByWeek(plans?.['7']) }}
              </div>
            </div>
          </div>
        </div>
        <SvgIcon
          v-if="selectedPlan === 'weekly'"
          name="business/selected-right"
          size="26"
          class="absolute right-[1px] -top-[13px]"
        />
      </div>
      <!-- Yearly Plan -->
      <div
        class="w-full relative cursor-pointer rounded-xl"
        :class="{
          'outline outline-2 outline-offset-[-2px] outline-[#eeeeee] dark:outline-[#474C58] bg-[#ffffff] dark:bg-[#283142]':
            selectedPlan !== 'yearly',
          'outline outline-[3px] outline-offset-[-3px] outline-[#ffce4f] bg-[#fffdf8] dark:bg-[#2F3543]':
            selectedPlan === 'yearly',
        }"
        @click="handleSelectPlan('yearly')"
      >
        <div
          class="w-full inline-flex flex-col justify-center items-center gap-[9px] px-[20px] py-[16px]"
        >
          <div
            class="self-stretch inline-flex justify-between items-center gap-[1.8px]"
          >
            <div
              class="justify-center text-[#461702] dark:text-[#FFCE4F] text-[18px] font-bold font-['Inter'] leading-[1.3]"
            >
              Annual
            </div>
            <div class="flex flex-col justify-end items-end gap-[8px]">
              <div
                class="justify-center text-[#461702] dark:text-[#FFCE4F] text-[16px] font-semibold font-['Inter'] leading-[1.1]"
              >
                {{ formatPriceByWeek(plans?.['12']) }}
              </div>
              <div
                class="px-[6px] py-[4px] bg-gradient-to-l from-[#ff0c00] to-[#ff7700] rounded-md flex justify-center items-center gap-[3px] overflow-hidden w-[84px] h-[22px]"
              >
                <div
                  class="text-right justify-center text-white text-[12px] font-bold font-['Inter'] leading-[12px] whitespace-nowrap flex flex-row items-center"
                >
                  SAVE 87%
                  <span>
                    <SvgIcon name="business/save-flash" size="12" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          class="-left-[1px] top-[-11px] absolute inline-flex justify-start items-center gap-[121px] w-[300px] px-[1px]"
        >
          <div
            v-if="isFreeTrailUser"
            class="h-[24px] px-[8px] py-[4px] bg-[#ffce4f] rounded-t-md rounded-br-md flex justify-center items-center gap-2.5 overflow-hidden"
          >
            <div
              class="text-right justify-center text-[#461702] text-[14px] font-semibold font-['Inter'] leading-[1.21] whitespace-nowrap"
            >
              3-Day Free Trial
            </div>
          </div>
        </div>
        <SvgIcon
          v-if="selectedPlan === 'yearly'"
          name="business/selected-right"
          size="26"
          class="absolute -right-[1px] -top-[13px]"
        />
      </div>
      <div class="gap-4 mb-[5px]" v-show="showAllPlans">
        <div
          class="relative flex items-center justify-center h-[14px] mb-[16px]"
        >
          <div class="inset-0 flex-1 flex items-center">
            <div class="w-full border-t border-[#EEEEEE] dark:border-[#474C58]"></div>
          </div>
          <div class="relative px-[7px]">
            <span
              class="text-[14px] font-semibold font-['Inter'] text-[#111111] dark:text-[#FFFFFF]"
              >Balanced Choice</span
            >
          </div>
          <div class="inset-0 flex-1 flex items-center">
            <div class="w-full border-t border-[#EEEEEE] dark:border-[#474C58]"></div>
          </div>
        </div>
        <!-- Monthly Plan -->
        <div
          class="w-full h-[66px] flex flex-col justify-start items-center relative gap-2.5 cursor-pointer"
          @click="handleSelectPlan('monthly')"
        >
          <div
            class="self-stretch h-[66px] px-[20px] py-[20px] rounded-xl flex flex-col justify-center items-center gap-2.5 overflow-hidden"
            :class="{
              'outline outline-2 outline-offset-[-2px] outline-[#eeeeee] dark:outline-[#474C58] bg-white dark:bg-[#283142]':
                selectedPlan !== 'monthly',
              'outline outline-[3px] outline-offset-[-3px] outline-[#ffce4f] bg-[#fffdf8] dark:bg-[#2F3543]':
                selectedPlan === 'monthly',
            }"
          >
            <div
              class="self-stretch flex flex-col justify-start items-center gap-[1.8px]"
            >
              <div
                class="self-stretch inline-flex justify-between items-center"
              >
                <div
                  class="justify-center text-[#461702] dark:text-[#FFCE4F] text-[18px] font-bold font-['Inter'] leading-[1.11] tracking-[0.25px]"
                >
                  Monthly
                </div>
                <div
                  class="justify-center text-[#461702] dark:text-[#FFCE4F] text-[16px] font-semibold font-['Inter'] leading-[1.1]"
                >
                  {{ formatPriceByWeek(plans?.['1']) }}
                </div>
              </div>
            </div>
          </div>
          <SvgIcon
            v-if="selectedPlan === 'monthly'"
            name="business/selected-right"
            size="26"
            class="absolute -right-[1px] -top-[13px]"
          />
        </div>
      </div>
    </div>
    <div
      class="w-full gap-4"
      :class="{
        'mt-[25px]': showModel === 'modal',
        'mt-[20px]': showModel === 'popup',
      }"
    >
      <div class="flex flex-col justify-start items-center gap-4">
        <!-- CheckOut Button -->
        <button
          class="w-[300px] h-[50px] px-[44px] py-[14px] bg-[#ffce4f] hover:bg-[#FFC52F] dark:bg-[#FFCE4F] dark:hover:bg-[#FACA4E] rounded-[90px] inline-flex justify-center items-center gap-2.5 overflow-hidden"
          @click="checkOutClick()"
        >
          <span
            class="text-center justify-center text-[#461702] dark:text-[#795305] text-[18px] font-bold font-['Inter'] leading-[1.3] whitespace-nowrap"
            v-if="!loading"
          >
            {{
              isFreeTrailUser && selectedPlan === 'yearly'
                ? 'Start 3-Day Free Trial'
                : 'Continue'
            }}
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
        <div
          class="inline-flex justify-start items-center cursor-pointer gap-[1px]"
          v-show="!showAllPlans"
          @click="toViewAllPlans"
        >
          <div
            class="justify-center text-[14px] font-normal font-['Inter'] leading-[1.21] text-[#555555] dark:text-[#999999] overflow-auto"
          >
            View all plans
          </div>
          <SvgIcon name="arrow-right" size="18" fill="#555555" class="dark:fill-[#999999]" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTrpc } from '@/lib/trpc/client'
import { getPricingPath } from '@/utils'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import useCheckout, {
  CheckoutType,
} from '@/entrypoints/sidepanel/composables/useCheckout'
import trackEvent from '~/utils/trackEvent'
import usePricingProducts from '@/entrypoints/sidepanel/composables/usePricingProducts'

interface PricePanelProps {
  // PricePanel 有两种显示模式 一种是作为 modal 显示，一种是作为 popup 显示
  showModel?: 'modal' | 'popup'
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

// 使用全局定价信息状态管理
const { pricingProducts, isLoading, initPricingProducts } = usePricingProducts()

const features = [
  'Unlimited solve & chat',
  'Top-Tier Accuracy',
  'Youtube, webpage summarize',
  'Generate AI quiz from any webpage',
]

const showAllPlans = ref(false)

// 计算属性：获取订阅计划
const plans = computed(() => {
  return pricingProducts.value?.subscription || null
})

const period = computed(() => {
  switch (selectedPlan.value) {
    case 'weekly':
      return '7'
    case 'yearly':
      return '12'
    case 'monthly':
      return '1'
    default:
      return '12'
  }
})

// 定义一个映射对象，将 plan 的值映射到 trackEvent 所需的 package 值
const planPackageMap = {
  yearly: 'annual',
  weekly: 'weekly',
  monthly: 'monthly',
}

// price 是总价格
const formatPriceByWeek = (subscription: any) => {
  if (!subscription) return ''
  if (subscription.period == 1) {
    return `$${(Math.floor((subscription.price / 4) * 100) / 100).toFixed(
      2
    )}/wk`
  } else if (subscription.period == 7) {
    return `$${subscription.price}/wk`
  } else if (subscription.period == 12) {
    return `$${(Math.floor((subscription.price / 52) * 100) / 100).toFixed(
      2
    )}/wk`
  }
}

const toViewAllPlans = () => {
  showAllPlans.value = true
  if (props.showModel === 'modal') {
    trackEvent.track('Plugin_Sidebar_Paywall_Otherplans')
  } else {
    trackEvent.track('Plugin_Sidebar_Upgrade_Otherplans')
  }
}

const handleSelectPlan = (plan: string) => {
  const packageName = planPackageMap[plan as keyof typeof planPackageMap]
  if (props.showModel === 'modal') {
    trackEvent.track('Plugin_Sidebar_Paywall_Package', {
      package: packageName,
    })
  } else {
    trackEvent.track('Plugin_Sidebar_Upgrade_Package', {
      package: packageName,
    })
  }
  selectedPlan.value = plan
}

// 点击 checkout 按钮
const checkOutClick = async () => {
  loading.value = true
  switch (selectedPlan.value) {
    case 'weekly':
      await createCheckoutOrder(CheckoutType.WEEKLY)
      break
    case 'yearly':
      await createCheckoutOrder(CheckoutType.YEARLY)
      break
    case 'monthly':
      await createCheckoutOrder(CheckoutType.MONTHLY)
      break
  }
  if (isFreeTrailUser.value && selectedPlan.value === 'yearly') {
    if (props.showModel === 'modal') {
      trackEvent.track('Plugin_Sidebar_Paywall_Freetrial')
    } else {
      trackEvent.track('Plugin_Sidebar_Upgrade_Freetrial')
    }
  } else {
    if (props.showModel === 'modal') {
      trackEvent.track('Plugin_Sidebar_Paywall_Purchase')
    } else {
      trackEvent.track('Plugin_Sidebar_Upgrade_Purchase')
    }
  }
  loading.value = false
}

// click view all plans button
const goToSolvelyPluginPriceWall = async () => {
  const pricingPath = await getPricingPath()
  const queryString = '?portal=plugin_sidebar'
  getTrpc().goToSolvely.query(`${pricingPath}${queryString}`)
  if (props.showModel === 'modal') {
    trackEvent.track('Plugin_Sidebar_Paywall_Otherplans')
  } else {
    trackEvent.track('Plugin_Sidebar_Upgrade_Otherplans')
  }
}

onMounted(async () => {
  // 确保定价信息已初始化
  if (!pricingProducts.value && !isLoading.value) {
    await initPricingProducts()
  }
})
</script>

<style lang="less"></style>
