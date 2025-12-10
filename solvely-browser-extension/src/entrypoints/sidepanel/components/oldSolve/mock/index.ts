/**
 * Mock FetchStream 实现
 *
 * 用于在 v9 接口开发完成前进行调试
 * 模拟流式输出行为
 */

import mockData from './questionsStepStyle.json'
// import mockData from './questionSingle.json'
// import mockData from './questionMultiple.json'
// import mockData from './markdown.json'

// Mock 配置
const MOCK_CONFIG = {
  DELAY_PER_MESSAGE: 20, // 每条消息间隔（毫秒）
  RANDOM_DELAY: true, // 是否随机延迟（更真实）
  MIN_DELAY: 50, // 最小延迟
  MAX_DELAY: 300, // 最大延迟
  ENABLE_LOGS: true, // 是否打印日志
}

interface FetchStreamOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: any
  onOpen?: (payload: any) => void
  onMessage?: (payload: any) => void
  onClose?: (payload: any | null) => void
  onError?: (err: Error) => void
  onDone?: (payload: any | null) => void
}

/**
 * Mock 版本的 fetchStream
 *
 * @param options 与真实 fetchStream 相同的参数
 * @returns 取消函数
 */
export function mockFetchStream(options: FetchStreamOptions): () => void {
  const { onOpen, onMessage, onClose, onError, onDone } = options

  const requestId = `mock_stream_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`

  let cancelled = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let currentIndex = 0

  if (MOCK_CONFIG.ENABLE_LOGS) {
    console.log(
      `[${requestId}] Mock stream started with ${mockData.length} items`
    )
  }

  // 模拟异步开始（下一个 tick）
  setTimeout(() => {
    if (cancelled) {
      if (MOCK_CONFIG.ENABLE_LOGS) {
        console.log(`[${requestId}] Cancelled before start`)
      }
      return
    }

    // 触发 onOpen
    if (onOpen) {
      onOpen({ connected: true })
      if (MOCK_CONFIG.ENABLE_LOGS) {
        console.log(`[${requestId}] Stream opened`)
      }
    }

    // 开始处理数据流
    processNext()
  }, 10) // 模拟连接建立延迟

  /**
   * 递归处理下一条消息
   */
  function processNext() {
    if (cancelled) {
      if (MOCK_CONFIG.ENABLE_LOGS) {
        console.log(`[${requestId}] Cancelled at index ${currentIndex}`)
      }
      cleanup()
      return
    }

    // 检查是否完成
    if (currentIndex >= mockData.length) {
      if (MOCK_CONFIG.ENABLE_LOGS) {
        console.log(`[${requestId}] All messages processed`)
      }

      // 触发 onDone
      if (onDone) {
        onDone({ completed: true })
      }

      // 触发 onClose
      if (onClose) {
        onClose({ reason: 'completed' })
      }

      cleanup()
      return
    }

    // 获取当前消息
    const item = mockData[currentIndex]

    // 触发 onMessage
    if (onMessage) {
      // 模拟真实 fetchStream 的 payload 结构
      onMessage(item)

      if (MOCK_CONFIG.ENABLE_LOGS) {
        const command = item.data?.command || 'unknown'
        const section = item.data?.contentSection || ''
        console.log(
          `[${requestId}] Message ${currentIndex + 1}/${
            mockData.length
          }: ${command} ${section}`
        )
      }
    }

    currentIndex++

    // 调度下一条消息
    const delay = getDelay()
    timeoutId = setTimeout(processNext, delay)
  }

  /**
   * 清理资源
   */
  function cleanup() {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  /**
   * 获取延迟时间
   */
  function getDelay(): number {
    if (MOCK_CONFIG.RANDOM_DELAY) {
      const range = MOCK_CONFIG.MAX_DELAY - MOCK_CONFIG.MIN_DELAY
      return Math.random() * range + MOCK_CONFIG.MIN_DELAY
    }
    return MOCK_CONFIG.DELAY_PER_MESSAGE
  }

  /**
   * 返回取消函数
   */
  return () => {
    if (!cancelled) {
      cancelled = true
      cleanup()

      if (MOCK_CONFIG.ENABLE_LOGS) {
        console.log(`[${requestId}] Mock stream cancelled`)
      }

      // 触发 onClose
      if (onClose) {
        onClose({ reason: 'cancelled' })
      }
    }
  }
}

/**
 * 动态配置 Mock 行为
 */
export function configureMock(config: Partial<typeof MOCK_CONFIG>) {
  Object.assign(MOCK_CONFIG, config)
}

/**
 * 获取当前 Mock 数据信息
 */
export function getMockInfo() {
  return {
    totalMessages: mockData.length,
    estimatedDuration: mockData.length * MOCK_CONFIG.DELAY_PER_MESSAGE,
    config: { ...MOCK_CONFIG },
  }
}
