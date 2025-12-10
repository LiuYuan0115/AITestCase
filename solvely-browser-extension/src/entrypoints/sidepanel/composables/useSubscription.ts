import { ref, computed, type Ref, type ComputedRef } from 'vue'
import {
  getUserSubscription as getUserSubscriptionFromApi,
  getUserBalance as getUserBalanceFromApi,
  decrementPluginUsage,
} from '@/api'
import { STORAGE_KEY } from '~/config'
import type { Subscriptions, UserBalance } from '~/types'

interface SubscriptionInstance {
  subscription: Ref<Subscriptions | null>
  isSubscribed: ComputedRef<boolean>
  purchasedFreeTrial: Ref<boolean>
  refreshSubscription: () => Promise<void>
  userBalance: Ref<UserBalance | null>
  refreshBalance: () => Promise<void>
  limitCheck: () => Promise<boolean>
  reset: () => Promise<void>
  // 队列扣减
  addDeductionToQueue: (amount: number) => void
  // 余额判断
  hasBalance: ComputedRef<boolean>
  // 清理监听器（单例模式下通常不需要调用，预留接口）
  cleanup: () => void
}

// 判断是否已订阅的逻辑函数 - 参照 datasync.ts 中的 getSubscriptionStatus
function checkIsSubscribed(subscriptions: Subscriptions | null): boolean {
  if (!subscriptions) return false

  const subscriptionArray = Array.isArray(subscriptions) ? subscriptions : []
  console.log('subscriptionArray', subscriptionArray)
  console.log('Date.now()', Date.now())
  return subscriptionArray.some((s) => s.subscriptionType === 'solver' && Date.now() < s.expireTimestamp)
}

function useSubscription() {
  // 创建响应式状态
  const subscription = ref<Subscriptions | null>(null)
  const userBalance = ref<UserBalance | null>(null)

  // 计算属性：是否已订阅
  // expireTick 用于在过期点触发一次重算（方案B）
  const expireTick = ref(0)
  let expireTimer: number | null = null
  const isSubscribed = computed(() => {
    void expireTick.value
    return checkIsSubscribed(subscription.value)
  })

  // 安排到最近过期点的一次性触发，促使 isSubscribed 重新计算
  function scheduleExpireTick(subs: Subscriptions | null) {
    if (expireTimer) {
      clearTimeout(expireTimer)
      expireTimer = null
    }
    if (!subs) return
    const arr = Array.isArray(subs) ? subs : []
    const now = Date.now()
    const future = arr
      .filter((s: any) => s?.subscriptionType === 'solver')
      .map((s: any) => (typeof s?.expireTimestamp === 'number' ? s.expireTimestamp : null))
      .filter((ts: number | null): ts is number => ts != null && ts > now)

    if (future.length === 0) return
    const nearest = Math.min(...future)
    const delay = Math.max(0, nearest - now)
    expireTimer = window.setTimeout(() => {
      expireTick.value = Date.now()
    }, delay)
  }

  // 是否已购买免费试用
  const purchasedFreeTrial = ref(false)

  // 计算属性：是否有余额（plugin 余额或 wallet 余额）
  const hasBalance = computed(() => {
    const balance = userBalance.value
    if (!balance) return false

    const pluginBalance = balance.plugin ?? 0
    const accountBalance = balance.balance ?? 0
    const walletCredits = Math.floor(accountBalance / 10)

    return pluginBalance > 0 || walletCredits > 0
  })

  // 队列相关状态（累计待处理数量）
  // const pendingAmount = ref(0)
  let isProcessingQueue = false
  let queueLength = 0

  // 初始化：从本地存储读取订阅信息
  const initSubscription = async () => {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY.SUBSCRIPTION)
      if (result[STORAGE_KEY.SUBSCRIPTION]) {
        subscription.value = result[STORAGE_KEY.SUBSCRIPTION]
        scheduleExpireTick(subscription.value)
      }
    } catch (error) {
      console.error('获取本地订阅信息失败:', error)
    }
  }

  // 初始化：从本地存储读取余额信息
  const initBalance = async () => {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY.USER_BALANCE)
      if (result[STORAGE_KEY.USER_BALANCE]) {
        userBalance.value = result[STORAGE_KEY.USER_BALANCE]
      }
    } catch (error) {
      console.error('获取本地余额信息失败:', error)
    }
  }

  // 🎯 监听本地存储变化（监听其他地方的更新，如 background script）
  const handleStorageChange = (changes: Record<string, any>, areaName: string) => {
    // 只监听 local 存储区域
    if (areaName !== 'local') return

    // 检查订阅信息是否变化
    if (changes[STORAGE_KEY.SUBSCRIPTION]) {
      const newValue = changes[STORAGE_KEY.SUBSCRIPTION].newValue
      console.log('[useSubscription] 📦 Storage changed, updating subscription:', newValue)
      subscription.value = newValue ?? null
      scheduleExpireTick(subscription.value)
    }

    // 检查余额信息是否变化
    if (changes[STORAGE_KEY.USER_BALANCE]) {
      const newValue = changes[STORAGE_KEY.USER_BALANCE].newValue
      console.log('[useSubscription] 📦 Storage changed, updating userBalance:', newValue)
      userBalance.value = newValue ?? null
    }
  }

  // 添加存储监听器（单例模式下会持续监听，直到扩展卸载）
  browser.storage.onChanged.addListener(handleStorageChange)

  // 刷新订阅信息
  const refreshSubscription = async (): Promise<void> => {
    try {
      const { data: userSubscription, purchasedFreeTrial: apiPurchasedFreeTrial } = await getUserSubscriptionFromApi()

      // 更新响应式状态
      subscription.value = userSubscription
      purchasedFreeTrial.value = apiPurchasedFreeTrial
      scheduleExpireTick(subscription.value)

      // 🎯 暂时移除监听器，避免监听到自己的写入操作
      browser.storage.onChanged.removeListener(handleStorageChange)

      try {
        // 写入本地存储
        await browser.storage.local.set({
          [STORAGE_KEY.SUBSCRIPTION]: userSubscription,
        })
      } finally {
        // 🎯 重新添加监听器
        browser.storage.onChanged.addListener(handleStorageChange)
      }
    } catch (error) {
      console.error('刷新订阅信息失败:', error)
      // 失败时保持原状态不变
    }
  }

  // 刷新余额信息
  const refreshBalance = async (): Promise<void> => {
    try {
      const res = await getUserBalanceFromApi()
      userBalance.value = res?.data ?? null
      // 🎯 暂时移除监听器，避免监听到自己的写入操作
      browser.storage.onChanged.removeListener(handleStorageChange)

      try {
        // 写入本地存储
        await browser.storage.local.set({
          [STORAGE_KEY.USER_BALANCE]: userBalance.value,
        })
      } finally {
        // 🎯 重新添加监听器
        browser.storage.onChanged.addListener(handleStorageChange)
      }
    } catch (error) {
      console.error('获取余额失败:', error)
    }
  }

  // 检查余额和订阅状态（若本地无余额则尝试刷新一次）
  const limitCheck = async (): Promise<boolean> => {
    try {
      let balanceData = userBalance.value
      if (!balanceData) {
        await refreshBalance()
        balanceData = userBalance.value
        if (!balanceData) return false
      }

      const pluginBalance = balanceData.plugin ?? 0
      const accountBalance = balanceData.balance ?? 0

      return pluginBalance > 0 || accountBalance >= 10 || !!isSubscribed.value
    } catch (error) {
      console.error('Error checking limits:', error)
      return false
    }
  }

  // 清空订阅与余额状态（用于退出登录）
  const reset = async (): Promise<void> => {
    try {
      subscription.value = null
      purchasedFreeTrial.value = false
      userBalance.value = null
      await browser.storage.local.remove(STORAGE_KEY.SUBSCRIPTION)
      if (expireTimer) {
        clearTimeout(expireTimer)
        expireTimer = null
      }
    } catch (error) {
      console.error('清空订阅信息失败:', error)
    }
  }

  // 减扣队列 - 累加待处理数量并触发处理
  // const addDeductionToQueue = async (amount: number): Promise<void> => {
  //   pendingAmount.value += amount
  //   if (pendingAmount.value === amount) {
  //     while (pendingAmount.value > 0) {
  //       const amountToProcess = pendingAmount.value
  //       try {
  //         await decrementPluginUsage(amountToProcess)
  //       } catch {}
  //       pendingAmount.value = pendingAmount.value - amountToProcess
  //     }
  //   }
  // }

  // let isProcessingQueue = false
  // let queueLength = 0

  const addDeductionToQueue = async (amount: number): Promise<void> => {
    if (isProcessingQueue) {
      queueLength += amount
      return
    }
    isProcessingQueue = true
    decrementPluginUsage(amount).finally(() => {
      if (queueLength) {
        const n = queueLength
        queueLength = 0
        addDeductionToQueue(n)
      } else {
        isProcessingQueue = false
      }
    })
  }

  // 清理监听器（预留方法，单例模式下通常不会调用）
  // 如果未来改为非单例模式，可在组件 onUnmounted 时调用
  const cleanup = () => {
    browser.storage.onChanged.removeListener(handleStorageChange)
    if (expireTimer) {
      clearTimeout(expireTimer)
      expireTimer = null
    }
  }

  const subscriptionInstance: SubscriptionInstance = {
    subscription: subscription, // 直接返回 ref，不需要包装 computed
    isSubscribed,
    userBalance,
    purchasedFreeTrial,
    refreshSubscription,
    refreshBalance,
    limitCheck,
    reset,
    addDeductionToQueue,
    hasBalance,
    cleanup,
  }

  // 初始化订阅信息
  initSubscription()
  // 初始化余额信息
  initBalance()

  return subscriptionInstance
}

export default useSubscription()
