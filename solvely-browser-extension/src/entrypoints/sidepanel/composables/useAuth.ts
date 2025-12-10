// src/entrypoints/sidepanel/composables/useAuth.ts
import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { STORAGE_KEY } from '~/config'
import trackEvent from '~/utils/trackEvent'
import { getTrpc } from '@/lib/trpc/client'
import { API_CONFIG } from '~/config/api'
import { getUserExtendInfo as apiGetUserExtendInfo, reportPluginLogin } from '~/api'
import useSubscription from './useSubscription'
import { syncAssignmentsWithServer } from '~/utils/abtestAssignments'
import usePricingProducts from './usePricingProducts'
import { getPluginUuid } from '~/utils/pluginUuid'
const { refreshPricingProducts } = usePricingProducts()

// 创建一个共享的登录状态
const isAuthenticated = ref(false)
const isShowModal = ref(false)
const isShowVerificationCode = ref(false)
const userEmail = ref('')
const userFrom = ref('')

// 存储登录成功和失败的回调
let loginSuccessCallback: (() => void) | null = null
let loginCancelCallback: (() => void) | null = null

// 用户扩展信息类型定义
interface UserExtendInfo {
  abTestTags?: string[]
  [key: string]: any
}

// 用户扩展信息状态
const userExtendInfo = ref<UserExtendInfo | null>(null)

export default function useAuth() {
  // 检查用户是否已登录
  const getAuthStatus = async () => {
    try {
      // 从 storage 或 background 服务获取用户状态
      const result = await browser.storage.local.get(STORAGE_KEY.USER)
      isAuthenticated.value = !!result[STORAGE_KEY.USER]
      userFrom.value = result[STORAGE_KEY.USER]?.source || ''
      console.log('获取登录状态 authenticated', isAuthenticated.value)
      return isAuthenticated.value
    } catch (error) {
      console.error('获取登录状态失败', error)
      return false
    }
  }

  // 刷新用户扩展信息
  const refreshUserExtendInfo = async () => {
    try {
      if (!isAuthenticated.value) {
        return
      }

      const extendInfo = await apiGetUserExtendInfo()

      // 更新 Vue 状态
      userExtendInfo.value = extendInfo

      // 保存到 storage
      await browser.storage.local.set({
        [STORAGE_KEY.USER_EXTEND_INFO]: extendInfo,
      })

      return extendInfo
    } catch (error) {
      return null
    }
  }

  // 登录成功后的处理
  const handleLoginSuccess = () => {
    isAuthenticated.value = true
    isShowModal.value = false
    trackEvent.track('Plugin_sidebar_login_success')

    refreshUserExtendInfo()
    useSubscription.refreshSubscription()
    syncAssignmentsWithServer().then((res) => {
      refreshPricingProducts()
    })
    // 上报插件登录面板登录成功事件
    reportPluginLogin()
      .then(() => {
        console.log('reportPluginLogin success')
      })
      .catch((error: any) => {
        console.error('reportPluginLogin failed:', error)
      })

    // 触发登录成功回调
    if (loginSuccessCallback) {
      loginSuccessCallback()
      loginSuccessCallback = null
      loginCancelCallback = null
    }
  }

  // 手动显示/隐藏登录弹窗
  const showLoginModal = (onSuccess?: () => void, onCancel?: () => void) => {
    // 如果有新的回调传入，直接覆盖旧的（保留最后一条消息）
    loginSuccessCallback = onSuccess || null
    loginCancelCallback = onCancel || null
    
    // 只在第一次调用时显示弹窗
    if (!isShowModal.value) {
      isShowModal.value = true
      trackEvent.track('Plugin_sidebar_login_show')
    }
  }
  
  const closeLoginModal = () => {
    isShowModal.value = false
    trackEvent.track('Plugin_sidebar_login_close')
    
    // 如果用户手动关闭弹窗，触发取消回调
    if (loginCancelCallback) {
      loginCancelCallback()
      loginSuccessCallback = null
      loginCancelCallback = null
    }
  }

  // 验证码相关方法
  const showVerificationCode = (email: string) => {
    userEmail.value = email
    isShowVerificationCode.value = true
    // 不关闭登录弹窗，让验证码覆盖在登录弹窗之上
    trackEvent.track('Plugin_sidebar_verification_show')
  }

  const closeVerificationCode = () => {
    isShowVerificationCode.value = false
    userEmail.value = ''
    trackEvent.track('Plugin_sidebar_verification_close')
  }

  // 获取用户信息
  const getUserInfo = async () => {
    const result = await browser.storage.local.get(STORAGE_KEY.USER)
    return result[STORAGE_KEY.USER]
  }

  // 更新用户信息
  const updateUserInfo = async (params: object) => {
    const authToken = await getTrpc().getAuthToken.query()
    await fetch(`${API_CONFIG.BASE_URL}/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
        'x-plugin-uuid': await getPluginUuid() || '',
      },
      body: JSON.stringify(params),
    })
  }

  // 保存 adjust uuid
  const saveAdjustUserId = async () => {
    const userInfo = await getUserInfo()
    if (!userInfo.webAdjustUserId) {
      const result = await browser.storage.local.get(STORAGE_KEY.WEB_ADJUST_USER_ID)
      if (result[STORAGE_KEY.WEB_ADJUST_USER_ID]) {
        // 添加已同步标识
        await browser.storage.local.set({
          [STORAGE_KEY.WEB_ADJUST_USER_ID_SYNCED]: true,
        })
        await updateUserInfo({
          webAdjustUserId: result[STORAGE_KEY.WEB_ADJUST_USER_ID],
        })
        // 删除临时存储
        // browser.storage.local.remove(STORAGE_KEY.WEB_ADJUST_USER_ID)
      }
    }
  }

  // 监听 storage 变更
  const handleStorageChange = (changes: any, area: any) => {
    if (area === 'local' && STORAGE_KEY.USER in changes) {
      const newUser = changes[STORAGE_KEY.USER].newValue
      isAuthenticated.value = !!newUser
      // 同步更新 userFrom
      userFrom.value = newUser?.source || ''
      if (isAuthenticated.value) {
        saveAdjustUserId()
        refreshUserExtendInfo()
        useSubscription.refreshSubscription()
        useSubscription.refreshBalance()
      }
      console.log('登录状态已更新', isAuthenticated.value, 'userFrom:', userFrom.value)
    }
  }

  // 初始化函数
  const init = async () => {
    // 初始化时获取登录状态
    await getAuthStatus()
    // 添加 storage 变更监听器
    browser.storage.onChanged.addListener(handleStorageChange)
    if (isAuthenticated.value) {
      saveAdjustUserId()
      refreshUserExtendInfo()
      useSubscription.refreshSubscription()
      useSubscription.refreshBalance()
    }
  }

  // 清理函数
  const cleanup = () => {
    // 组件卸载时移除监听器
    browser.storage.onChanged.removeListener(handleStorageChange)
  }

  // 检查是否有组件实例
  const instance = getCurrentInstance()
  
  if (instance) {
    // 有组件实例，使用 lifecycle hooks
    onMounted(init)
    onUnmounted(cleanup)
  } else {
    // 没有组件实例，立即初始化（用于模块顶层调用）
    init()
    // 注意：没有组件实例时，无法自动清理，需要在应用关闭时手动清理
    // 但浏览器扩展的 sidepanel 通常不会完全卸载，所以这里可以接受
  }

  return {
    isAuthenticated: computed(() => isAuthenticated.value),
    isShowModal,
    isShowVerificationCode,
    userEmail,
    userExtendInfo: computed(() => userExtendInfo.value),
    userFrom: computed(() => userFrom.value),
    getAuthStatus,
    showLoginModal,
    closeLoginModal,
    showVerificationCode,
    closeVerificationCode,
    handleLoginSuccess,
    refreshUserExtendInfo,
    saveAdjustUserId,
  }
}
