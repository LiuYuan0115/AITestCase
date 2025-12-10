import { getTrpc } from '@/lib/trpc/client'
import SidepanelEventType from '@/entrypoints/sidepanel/types/eventTypes'

interface PendingTask<T = any> {
  execute: () => void | Promise<void> // 执行函数
  context: T // 任务上下文数据（用于埋点）
  timestamp: number
  requestId: string // 唯一标识
}

// 挂起的任务（单例）
let pendingTask: PendingTask | null = null

// 监听器标志
let messageListenerAdded = false

// 监听器超时时长（30分钟）
const LISTENER_TIMEOUT = 30 * 60 * 1000

/**
 * 生成唯一的请求ID
 */
const generateRequestId = (): string => {
  return `content-auth-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 通用的内容脚本登录检查中间件
 */
export default function useContentAuth() {
  /**
   * 检查登录状态
   */
  const checkLogin = async (): Promise<boolean> => {
    try {
      const isLogin = await getTrpc().isLogin.query()
      return isLogin
    } catch (error) {
      console.error('[ContentAuth] 检查登录状态失败:', error)
      return false
    }
  }

  /**
   * 处理登录成功消息
   */
  const handleLoginSuccess = (message: any) => {
    if (message.type !== SidepanelEventType.LOGIN_SUCCESS_TO_CONTENT) {
      return
    }
    // 检查是否有挂起的任务
    if (!pendingTask) return

    // 🔒 安全检查1：验证 requestId 是否匹配（防止跨 tab 误触发）
    if (message.data?.requestId !== pendingTask.requestId) return

    // 🔒 安全检查2：检查是否超时（30分钟）
    const waitTime = Date.now() - pendingTask.timestamp
    if (waitTime > LISTENER_TIMEOUT) {
      // 清理任务和监听器
      cleanup()
      return
    }

    // 执行挂起的任务
    const taskToExecute = pendingTask.execute
    cleanup() // 先清理，再执行（避免执行中出错导致无法清理）
    taskToExecute()
  }

  /**
   * 启动登录监听器
   * 性能优化：不使用 setTimeout，在回调时检查时间戳
   */
  const startLoginListener = () => {
    if (messageListenerAdded) return

    browser.runtime.onMessage.addListener(handleLoginSuccess)
    messageListenerAdded = true
  }

  /**
   * 停止登录监听器
   */
  const stopLoginListener = () => {
    if (!messageListenerAdded) {
      return
    }

    browser.runtime.onMessage.removeListener(handleLoginSuccess)
    messageListenerAdded = false
  }

  /**
   * 清理所有状态
   */
  const cleanup = () => {
    pendingTask = null
    stopLoginListener()
  }

  /**
   * 发送登录请求到侧边栏
   */
  const requestLogin = (requestId: string, context?: any) => {

    browser.runtime.sendMessage({
      type: SidepanelEventType.LOGIN_REQUEST_FROM_CONTENT,
      data: {
        requestId, // 携带 requestId 用于回调验证
        context, // 携带上下文信息（可选）
      },
    })
  }

  /**
   * 检查登录并执行任务
   * @param executeFn - 要执行的函数
   * @param context - 任务上下文数据（用于埋点和日志，可选）
   * @returns Promise<boolean> - 是否立即执行了任务
   */
  const checkAndExecute = async <T = any>(executeFn: () => void | Promise<void>, context?: T): Promise<boolean> => {
    // 1. 检查登录状态
    const isLogin = await checkLogin()

    if (isLogin) {
      // 已登录，直接执行
      await executeFn()
      return true
    }

    // 2. 未登录，生成唯一 requestId 并挂起任务
    const requestId = generateRequestId()

    pendingTask = {
      execute: executeFn,
      context,
      timestamp: Date.now(),
      requestId, // 🔒 记录 requestId，用于回调验证
    }

    // 3. 启动监听器
    startLoginListener()

    // 4. 请求登录，携带 requestId
    requestLogin(requestId, context)

    return false
  }

  return {
    checkAndExecute,
    cleanup,
  }
}
