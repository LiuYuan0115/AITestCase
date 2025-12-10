<template>
  <div v-if="visible" class="user-popup-panel">
    <Logined
      :user="user!"
      :subscriptions="subscriptions!"
      :user-balance="userBalance"
      @log-out="handleLogOut"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
// import NoLogin from '@/components/popup/NoLogin.vue'
import Logined from '@/components/popup/logined/Logined.vue'
import { getTrpc } from '@/lib/trpc/client'
import EVENT from '@/utils/event'
import {
  type User,
  type Subscriptions,
  type UserAndSubscriptions,
  type UserBalance,
  type Message,
} from '@/types'
import { isEmpty } from 'lodash-es'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import { UseMessagesReturn } from '../../composables/useMessages'
const messageStore = inject<UseMessagesReturn>('messageStore')!

const visible = defineModel<boolean>('visible')

// 登录状态
const isLoggedIn = ref(false)
const user = ref<User | null>(null)
const subscriptions = ref<Subscriptions | null>(null)
const userBalance = reactive<UserBalance>({
  plugin: null,
  balance: null,
})

// 添加状态标志位
const userLoaded = ref(false)
const subscriptionLoaded = ref(false)

// 更新登录状态
const updateLoginStatus = async () => {
  if (userLoaded.value && subscriptionLoaded.value) {
    isLoggedIn.value = !!user.value
    if (isLoggedIn.value) {
      try {
        const balanceData = await getTrpc().getUserBalance.query()
        userBalance.plugin = balanceData.plugin ?? 0
        userBalance.balance = balanceData.balance ?? 0
        console.log('userBalance', userBalance)
      } catch (error) {
        console.error('获取用户余额失败:', error)
      }
    }
  }
}

const setState = async (data?: UserAndSubscriptions) => {
  console.log(`${EVENT.SOLVELY_DATA_SYNC} setState`, data)
  try {
    if (isEmpty(data)) {
      data = await getTrpc().getUserAndSubscriptionInfo.query()
    }
    const {
      user: userInfo,
      subscriptions: subscriptionsInfo,
    }: UserAndSubscriptions = data

    user.value = userInfo
    subscriptions.value = subscriptionsInfo

    // 设置标志位
    userLoaded.value = true
    subscriptionLoaded.value = true

    // 更新登录状态
    await updateLoginStatus()
  } catch (error) {
    console.error('检查登录状态失败:', error)
    isLoggedIn.value = false
    userLoaded.value = false
    subscriptionLoaded.value = false
  }
}

const onStateChange = (message: Message) => {
  if (message.type === EVENT.SOLVELY_DATA_SYNC) {
    // 根据 api 字段判断数据类型
    if (message.api === '/user') {
      user.value = message.data
      userLoaded.value = true
    } else if (message.api === '/pricing/subscription') {
      subscriptions.value = message.data
      subscriptionLoaded.value = true
    }

    // 更新登录状态
    updateLoginStatus()
  }
}

// 退出登录
const handleLogOut = async () => {
  await useSubscription.reset()
  messageStore.clearMessages()
  // close user popup panel
  visible.value = false
}

// 监听 visible 变化，当变为 true 时重新获取状态
watch(visible, (newValue) => {
  if (newValue) {
    setState()
  }
})

onMounted(async () => {
  // 添加点击外部关闭弹窗
  document.addEventListener('click', handleOutsideClick)

  setState()

  // 添加消息监听
  browser.runtime.onMessage.addListener(onStateChange)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)

  // 移除消息监听
  browser.runtime.onMessage.removeListener(onStateChange)
})

const handleOutsideClick = (event: MouseEvent) => {
  const popupEl = document.querySelector('.user-popup-panel')
  // 点击在弹窗外部时关闭
  if (popupEl && !popupEl.contains(event.target as Node)) {
    visible.value = false
  }
}
</script>

<style scoped>
.user-popup-panel {
  position: absolute;
  top: 48px;
  right: 16px;
  z-index: 100;
  overflow: hidden;
  width: 288px;
  padding: 16px;
  @apply bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border dark:border-s-border-dark rounded-[20px];
  box-shadow: 0px 10px 40px 0px rgba(120, 118, 128, 0.12);
}
</style>
