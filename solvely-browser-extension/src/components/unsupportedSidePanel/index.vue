<template>
  <div class="unsupported-side-panel-container">
    <UserPanel
      v-if="show"
      :user="user"
      :subscriptions="subscriptions"
      :user-balance="userBalance"
      @close="handleClose"
    />
    <PayWall
      v-if="showPaywall"
      :key="`paywall-${showPaywall}`"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, watch } from 'vue'
import UserPanel from './UserPanel.vue'
import PayWall from './PayWall.vue'
import type { User } from '@/types'
import { getTrpc } from '@/lib/trpc/client'
import useAuth from '@/entrypoints/sidepanel/composables/useAuth'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import useABTest from '@/composables/useABTest'
import usePaywall from '@/composables/usePaywall'
import type { AuthState } from '@/entrypoints/sidepanel/types/auth'

// 定义 props
interface Props {
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
})

// 使用 Paywall 单例（解构 ref 以保持响应式连接）
const { showPaywall, handleSuccess, handleClose: paywallHandleClose } = usePaywall()

// 定义 emits
const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

// 使用 composables 获取数据
const auth = useAuth()
const subscription = useSubscription
const abTest = useABTest()

// 提供依赖给子组件（PayWall 和 PricePanelFullV2 需要）
provide<AuthState>('auth', auth)
provide('subscription', useSubscription)
provide('abTest', abTest)

// 用户信息（useSubscription 不提供，需要单独获取）
const user = ref<User | null>(null)

// 规范化 subscriptions 数据，确保是数组格式，因为不清楚老代码的数据拆包解包，这边做一个防御性措施
const normalizeSubscriptions = (subscriptions: any) => {
  if (!subscriptions) {
    return []
  }
  // 如果是数组，直接返回
  if (Array.isArray(subscriptions)) {
    return subscriptions
  }
  // 如果是对象且有 data 字段（API 返回的包装格式）
  if (typeof subscriptions === 'object' && 'data' in subscriptions && Array.isArray(subscriptions.data)) {
    return subscriptions.data
  }
  // 其他情况返回空数组
  return []
}

// 从 useSubscription 获取的 subscriptions（已规范化）
const subscriptions = computed(() => normalizeSubscriptions(subscription.subscription.value))

// 从 useSubscription 获取的 userBalance
const userBalance = computed(() => subscription.userBalance.value)

// 获取用户信息
const loadUser = async () => {
  try {
    const userData = await getTrpc().getUser.query()
    user.value = userData
  } catch (error) {
    console.error('获取用户信息失败:', error)
    user.value = null
  }
}

// 监听 show 变化，当变为 true 时重新获取用户信息、订阅和余额
watch(() => props.show, async (newValue) => {
  if (newValue) {
    // 并行刷新用户信息、订阅和余额
    await Promise.all([
      loadUser(),
      subscription.refreshSubscription(),
      subscription.refreshBalance(),
    ])
  }
})

// 初始化时获取用户信息
loadUser()

// 处理关闭面板
const handleClose = () => {
  emit('update:show', false)
}

// 监听订阅状态变化，订阅成功后触发成功回调
watch(
  () => subscription.isSubscribed.value,
  (newValue, oldValue) => {
    // 从未订阅变为已订阅时，触发成功回调
    if (!oldValue && newValue && showPaywall.value) {
      handleSuccess()
    }
  }
)
</script>

<style scoped>
.unsupported-side-panel-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483646;
  pointer-events: none;
}

.unsupported-side-panel-container > * {
  pointer-events: auto;
}
</style>

