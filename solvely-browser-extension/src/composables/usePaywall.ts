import { ref } from 'vue'

// 单例实例（模块级别，只创建一次）
let instance: ReturnType<typeof createPaywallInstance> | null = null

/**
 * 创建 Paywall 实例
 */
function createPaywallInstance() {
  // ==================== 基础状态 ====================
  const showPaywall = ref(false)
  const from = ref<string>('unknown')
  
  // ==================== 回调函数 ====================
  type PaywallCallback = () => void | Promise<void>
  let onSuccessCallback: PaywallCallback | null = null
  let onCloseCallback: PaywallCallback | null = null

  /**
   * 显示 Paywall
   * @param options - 配置选项
   * @param options.from - 来源标识
   * @param options.onSuccess - 付款成功回调
   * @param options.onClose - 关闭回调
   */
  const show = (options?: {
    from?: string
    onSuccess?: PaywallCallback
    onClose?: PaywallCallback
  }) => {

    trackEvent.track('Plugin_Sidebar_Paywall_Show', {
        oprea:'1'
    })
    console.log('[usePaywall] show() called', {
      from: options?.from || 'unknown',
      currentState: showPaywall.value,
    })
    from.value = options?.from || 'unknown'
    onSuccessCallback = options?.onSuccess || null
    onCloseCallback = options?.onClose || null
    showPaywall.value = true
  }

  /**
   * 隐藏 Paywall
   */
  const hide = () => {
    console.log('[usePaywall] hide() called')
    showPaywall.value = false
    // 清理回调
    onSuccessCallback = null
    onCloseCallback = null
  }

  /**
   * 处理付款成功
   */
  const handleSuccess = async () => {
    console.log('[usePaywall] handleSuccess() called', {
      hasCallback: !!onSuccessCallback,
    })
    if (onSuccessCallback) {
      try {
        await onSuccessCallback()
      } catch (error) {
        console.error('[Paywall] Success callback error:', error)
      }
    }
    hide()
  }

  /**
   * 处理关闭
   */
  const handleClose = async () => {
    console.log('[usePaywall] handleClose() called', {
      hasCallback: !!onCloseCallback,
    })
    if (onCloseCallback) {
      try {
        await onCloseCallback()
      } catch (error) {
        console.error('[Paywall] Close callback error:', error)
      }
    }
    hide()
  }

  return {
    // 状态
    showPaywall,
    from,
    
    // 方法
    show,
    hide,
    handleSuccess,
    handleClose,
  }
}

/**
 * Paywall 管理 composable（单例模式）
 */
export default function usePaywall() {
  // 第一次调用时创建实例
  if (!instance) {
    instance = createPaywallInstance()
  }

  // 始终返回同一个实例
  return instance
}
