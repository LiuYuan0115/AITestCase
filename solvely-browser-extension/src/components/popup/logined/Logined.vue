<template>
  <div>
    <UserInfoCard
      :user="user"
      :subscriptions="subscriptions"
      :user-balance="userBalance"
    />

    <button
      class="flex flex-row items-center justify-start gap-[5px] mt-[12px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      @click="handleGoToUserInfoClick()"
    >
      <SvgIcon name="login/user-1" class="w-[18px] h-[18px]" />
      <div
        class="text-center justify-center text-sm font-medium font-['Inter'] leading-none whitespace-nowrap"
      >
        My account
      </div>
    </button>

    <!-- divider line -->
    <div
      class="w-full h-0 mt-[12px] border-t border-[0.5px] border-s-border dark:border-s-border-dark"
    ></div>

    <!-- 退出登录 -->
    <button
      class="flex flex-row items-center justify-start gap-[5px] mt-[12px]"
      :class="{
        'cursor-pointer': !logoutLoading,
        'cursor-wait': logoutLoading,
      }"
      :disabled="logoutLoading"
      @click="handleLogOutClick()"
    >
      <SvgIcon name="login/log-out" class="w-[18px] h-[18px] text-[#F30A34]" />
      <div
        class="text-center justify-center text-[#F30A34] text-sm font-medium font-['Inter'] leading-none whitespace-nowrap"
      >
        Log out
      </div>
    </button>
  </div>
</template>

<script lang="ts" setup>
import UserInfoCard from '~/components/popup/logined/userInfo/UserInfoCard.vue'
import { type UserAndSubscriptions } from '~/types'
import trackEvent from '~/utils/trackEvent'
import { getTrpc } from '~/lib/trpc/client'
// import { Vue3Lottie } from 'vue3-lottie'
// import { STORAGE_KEY } from '~/config'
// import animationData from '~/assets/animations/pin.json'

const props = defineProps<UserAndSubscriptions>()


const emit = defineEmits<{
  (e: 'log-out'): void
}>()

const logoutLoading = ref(false)

// const toggleShowFloatBtn = (value: boolean) => {
//   // 保存浮动按钮显示状态
//   browser.storage.local.set({ [STORAGE_KEY.FLOAT_BTN_HIDDEN_KEY]: !value })
// }

const handleGoToUserInfoClick = () => {
  trackEvent.track('Plugin_Sidebar_Myaccount')
  goToSolvely('/user')
}

const handleLogOutClick = async () => {
  // logout
  logoutLoading.value = true
  await getTrpc().logout.mutate()
  emit('log-out')
  trackEvent.track('Plugin_Sidebar_Logout')
  logoutLoading.value = false
}

</script>

<style lang="less" scoped></style>
