<template>
  <header
    class="h-[48px] w-full flex items-center justify-between p-[0_16px_0_17px] border-b border-d_1 dark:border-d_1_dk color-transtion"
  >
    <span class="font-medium text-[16px] text-t_1 dark:text-t_1_dk color-transition flex items-center"
      >Chat
      <span
        v-if="isTestEnv"
        class="h-5 leading-[22px] ml-[5px] px-[8px] rounded-[4px] bg-[#ffedd5] text-[#c2410c] text-[12px] font-[700]"
        >TEST
      </span>
       <span
        v-if="isLocalEnv"
        class="h-5 leading-[22px] ml-[5px] px-[8px] rounded-[4px] bg-[#d5ffe4] text-[#0cc23a] text-[12px] font-[700]"
        >LOCAL
      </span>
    </span>
    <div class="flex gap-[12px]">
      <!-- <ThemeToggle /> -->
      <CustomTooltip
        text="History"
        position="bottom"
      >
        <Button
          icon="history"
          class="w-[32px] rounded-[8px] text-t_brand dark:text-t_brand_dk"
          @click.stop="handleHistoryClick"
        />
      </CustomTooltip>
      <CustomTooltip
        text="Settings"
        position="bottom"
      >
        <Button
          icon="setting"
          class="w-[32px] rounded-[8px] text-t_brand dark:text-t_brand_dk"
          @click.stop="toggleSettingPopupPanel"
        />
      </CustomTooltip>
      <CustomTooltip
        text="Account"
        position="bottom"
        :offset="{ x: -20, y: 0 }"
      >
        <Button
          icon="user"
          class="w-[32px] rounded-[8px] text-t_brand dark:text-t_brand_dk relative"
          @click.stop="toggleUserPopupPanel"
        >
          <div
            v-if="isSubscribed"
            class="absolute top-[3px] right-[3px]"
          >
            <SvgIcon
              name="login/unlimited-user"
              size="10"
            />
          </div>
        </Button>
      </CustomTooltip>
    </div>

    <UserPopupPanel v-model:visible="userPopupPanelVisible" />
  </header>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, computed } from 'vue'
import Button from '@/components/common/Button.vue'
import UserPopupPanel from '@/entrypoints/sidepanel/components/user/UserPopupPanel.vue'
import CustomTooltip from '@/components/common/CustomTooltip.vue'
// import SettingPopupPanel from '@/entrypoints/sidepanel/components/setting/SettingPopupPanel.vue'
import { AuthState } from '@/entrypoints/sidepanel/types/auth'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import trackEvent from '~/utils/trackEvent'
import { Performance } from '@/utils'
import { PerformanceKeys } from '@/types'

const auth = inject<AuthState>('auth')!

const userPopupPanelVisible = ref(false)
const { isSubscribed } = useSubscription

const isTestEnv = computed(() => {
  return import.meta.env.VITE_ENV === 'TEST'
})

const isLocalEnv = computed(() => {
  return import.meta.env.VITE_ENV === 'LOCAL'
})

const toggleUserPopupPanel = async () => {
  // 关闭用户信息不需要检查登录
  if (userPopupPanelVisible.value) {
    userPopupPanelVisible.value = false
    return
  }

  // 登录状态下可查看用户信息
  const isLogin = await auth.getAuthStatus()
  userPopupPanelVisible.value = isLogin ? true : false

  // 未登录状态下可打开登录弹窗
  if (!isLogin) {
    auth.showLoginModal()
  }

  trackEvent.track('Plugin_sidebar_account')
}

const toggleSettingPopupPanel = async () => {
  // 检查登录状态
  const isLogin = await auth.getAuthStatus()

  if (!isLogin) {
    // 未登录状态下打开登录弹窗
    auth.showLoginModal()
    return
  }

  // 登录状态下打开自定义选项页面
  try {
    // 创建新标签页打开选项页面
    await browser.tabs.create({
      url: browser.runtime.getURL('/options.html'),
    })
    trackEvent.track('Plugin_sidebar_settings')
    trackEvent.track('Plugin_settings_show')
  } catch (error) {
    console.error('Failed to open options page:', error)
  }
}

const handleHistoryClick = async () => {
  if (!(await auth.getAuthStatus())) {
    auth.showLoginModal()
    return
  }

  window.open(`${import.meta.env.VITE_SOLVELY_URL}/history`, '_blank', 'noreferrer')

  trackEvent.track('Plugin_sidebar_history')
}

// 记录 Header 组件出现时间
onMounted(() => {
  Performance.reportComponentAppear(PerformanceKeys.SIDEPANEL_HEADER_APPEAR)
})
</script>
