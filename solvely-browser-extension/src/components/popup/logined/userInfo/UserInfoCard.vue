<template>
  <div
    class="self-stretch w-full rounded-xl inline-flex flex-col justify-center items-center gap-3 overflow-hidden"
  >
    <!-- 个人信息 -->
    <div class="w-full h-10 flex flex-row justify-start items-center gap-3">
      <!-- avatar -->
      <img :src="getUserAvatar" class="w-8 h-8 rounded-full" />
      <!-- user info -->
      <div
        class="self-stretch inline-flex flex-col justify-between items-start"
      >
        <div
          class="self-stretch w-full flex flex-row gap-2 justify-start max-w-[200px]"
        >
          <!-- user name  -->
          <span
            class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-base font-bold font-['Inter'] leading-tight truncate"
            >{{ user.userName }}</span
          >

          <!-- Unlimited Tag -->
          <div
            v-if="hasSolverSubscription"
            class="w-[72px] h-[18px] relative bg-s-foundation-iap-primary dark:bg-s-foundation-iap-primary-dark rounded-[3px] flex justify-center items-center"
          >
            <div
              class="text-center text-[#461702] text-xs font-medium font-['Inter'] leading-none"
            >
              Unlimited
            </div>
          </div>

          <!-- Free Tag -->
          <div
            v-else
            class="w-[42px] h-[18px] bg-s-disable-bg dark:bg-s-disable-bg-dark rounded-[3px] flex justify-center items-center"
          >
            <span
              class="text-center text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-xs font-normal font-['Inter'] leading-none"
            >
              Free
            </span>
          </div>
        </div>
        <div
          class="self-stretch justify-center text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark max-w-[200px] text-sm font-normal font-['Inter'] leading-[19.6px] truncate"
        >
          {{ user.email }}
        </div>
      </div>
    </div>

    <!-- 权益信息 Balance Section -->
    <div class="w-64 h-11 flex items-center px-3 bg-s-input-bg dark:bg-s-input-bg-dark rounded-xl">
      <SvgIcon name="login/free-solves" size="24" />
      <div class="w-full flex flex-row items-center justify-between">
        <div
          class="ml-1 text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-sm font-normal font-['Inter'] leading-tight"
        >
          {{ currentResource.label }}
        </div>
        <div
          class="ml-auto text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-sm font-normal font-['Inter'] leading-tight max-w-[120px]"
        >
          {{ currentResource.value }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { type UserAndSubscriptions } from '~/types'
import { computed } from 'vue'
import { getUserAvatarUrl } from '~/utils/userAvatar'

const props = defineProps<UserAndSubscriptions>()

// 获取用户头像
const getUserAvatar = computed(() => {
  return getUserAvatarUrl(props.user, null)
})

// 辅助函数：检查值是否为 null 或 undefined
const isNil = (value: any): boolean => value == null // 同时检查 null 和 undefined

// 检查数据是否已加载
// const isDataLoaded = computed(() => {
//   return (
//     !isNil(props.user) &&
//     !isNil(props.userBalance?.plugin) &&
//     !isNil(props.userBalance?.balance)
//   )
// })

// 是否存在solver订阅
const hasSolverSubscription = computed(
  () =>
    props?.subscriptions?.some((s) => s.subscriptionType === 'solver') ?? false
)

// 当前资源状态
const currentResource = computed(() => {
  const plugin = props.userBalance?.plugin
  const balance = props.userBalance?.balance

  // 有solver订阅，显示Unlimited
  if (props?.subscriptions?.some((s) => s.subscriptionType === 'solver')) {
    return {
      type: 'solves',
      value: 'Unlimited',
      label: 'Free Solves',
    }
  }

  // 无solver订阅，显示Free Solves
  if (Number(plugin) > 0) {
    return {
      type: 'solves',
      value: plugin,
      label: 'Free Solves',
    }
  }

  // 无solver订阅，无剩余次数，显示Gems
  if (Number(balance) > 0) {
    return {
      type: 'gems',
      value: balance,
      label: 'Gems 💎',
    }
  }

  // 兜底显示 default
  return {
    type: 'solves',
    value: 0,
    label: 'Free Solves',
  }
})
</script>

<style lang="less" scoped></style>
