/**
 * summary store
 * 摘要store - 组合式API
 */
import { ref, reactive } from 'vue'
import { getTrpc } from '@/lib/trpc/client'
import { API_CONFIG } from '@/config'
import trackEvent from '~/utils/trackEvent'
import { fetchStream } from '@/utils/fetchStream'
import { getPluginUuid } from '~/utils/pluginUuid'
import { useLanguage } from '@/composables/useLanguage'

interface SummaryInfo {
  sessionId: string
  content: string
  pageUrl: string
  instructions?: string
}

interface StartSummaryOptions {
  onStartOutput?: () => void
  onMessage?: (event: MessageEvent) => void
  successCallback?: () => void
  errorCallback?: () => void
}

/**
 * useSummary 组合式API
 * 提供页面摘要相关的状态和方法，用于管理摘要过程中的数据和操作。
 * @returns {Object} 包含以下状态和方法的对象：
 * - currentSummary: {Object} 当前摘要对象，包含 command、content 属性
 * - isSummarizing: {Ref<boolean>} 是否正在生成摘要
 * - startSummary: {Function} 开始生成摘要的方法
 * - cancelSummary: {Function} 取消摘要生成的方法
 * - clearSummary: {Function} 清除摘要内容的方法
 * - retrySummary: {Function} 重试摘要生成的方法
 * - likeSummary: {Function} 为摘要点赞的方法
 */
export function useSummary() {
  const { currentLanguage } = useLanguage()
  
  // 摘要状态
  const currentSummary = reactive({
    command: '',
    content: '',
  })

  // 是否正在请求中
  const isSummarizing = ref(false)

  // 是否等待流式结果中
  const isWaiting = ref(false)

  // 存储当前请求的取消函数
  let cancelCurrentRequest: (() => void) | null = null

  // 存储上一次的请求信息
  const lastSummaryInfo = ref<SummaryInfo | null>(null)
  const lastOptions = ref<StartSummaryOptions | null>(null)
  const summaryId = ref<string | null>('summaryId')

  /**
   * 开始生成摘要
   * @param {SummaryInfo} summaryInfo - 摘要信息对象，包含内容等
   * @param {StartSummaryOptions} options - 可选配置项
   * @param {'solve' | 'retry'} mode - 模式：'solve' 解题模式（默认），'retry' 重试模式
   * @returns {Promise<{summaryId: string}|null>} 返回摘要ID，失败时返回null
   */
  async function startSummary(
    summaryInfo: SummaryInfo,
    options: StartSummaryOptions = {},
    mode: 'solve' | 'retry' = 'solve'
  ) {
    const isRetry = mode === 'retry'
    
    // 保存当前摘要信息（仅解题模式保存）
    if (!isRetry) {
      lastSummaryInfo.value = { ...summaryInfo }
      lastOptions.value = { ...options }
    }

    // 检查锁定状态
    if (isSummarizing.value) return

    // 设置锁定状态
    isSummarizing.value = true

    // 初始化等待状态
    isWaiting.value = false

    // 重置当前摘要
    Object.assign(currentSummary, {
      command: '',
      content: '',
    })

    let formatDetected = false
    let isJsonFormat = false

    // 获取token
    const authToken = await getTrpc().getAuthToken.query()

    try {
      // 获取用户ID
      const userId = await getTrpc().getUserId.query()
      if (!userId) {
        throw new Error('User ID not found')
      }

      // 根据模式决定 URL 和 body
      const url = isRetry 
        ? `${API_CONFIG.BASE_URL}/plugin/summary/retry`
        : `${API_CONFIG.BASE_URL}/plugin/summary`
      
      const body = isRetry
        ? {
            sessionId: summaryId.value || summaryInfo.sessionId,
            platform: 'plugin',
          }
        : {
            sessionId: summaryInfo.sessionId,
            platform: 'plugin',
            content: summaryInfo.content,
            pageUrl: summaryInfo.pageUrl,
            instructions: summaryInfo.instructions,
            language: currentLanguage.value,
          }

      // 使用 fetchStream 发起流式请求
      cancelCurrentRequest = fetchStream({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body,
        onOpen: (payload) => {
          console.log('Summary 流式连接已建立', payload)
          // 可选：触发开始输出回调
          // options.onStartOutput?.()
        },
        onMessage: (event: any) => {
          // 解析事件数据
          const parseEvent = (evt: any): any => {
            const raw = evt && typeof evt === 'object' && 'data' in evt ? evt.data : evt
            if (typeof raw === 'string') {
              try {
                return JSON.parse(raw)
              } catch {
                return { content: raw }
              }
            }
            return raw || {}
          }

          const payload = parseEvent(event)
          const { content = '', command = '' } = payload

          // 第一次收到内容时触发 onStartOutput 回调
          if (command === 'pending' && content && !isWaiting.value) {
            isWaiting.value = true
            options.onStartOutput?.()
          }

          if (command === 'pending') {
            // 一次性格式检测：只在第一次收到非空content时检测
            if (!formatDetected && content && content.trim()) {
              formatDetected = true
              try {
                const parsedContent = JSON.parse(content)
                if (
                  typeof parsedContent === 'object' &&
                  parsedContent !== null
                ) {
                  isJsonFormat = true
                }
              } catch (e) {}
            }

            if (isJsonFormat) {
              try {
                const parsedContent = JSON.parse(content)
                currentSummary.content = parsedContent.Answer
              } catch (e) {
                currentSummary.content = content
              }
            } else {
              currentSummary.content += content
            }

            currentSummary.command = command
          } else if (command === 'done' || command === 'all') {
            // 更新最终摘要
            currentSummary.command = command
            isSummarizing.value = false
            options.successCallback?.()
            // 打点记录
            trackEvent.track('Plugin_summarize_success', {
              pageUrl: summaryInfo.pageUrl,
              summaryContent: summaryInfo.content,
            })
          } else if (command === 'error') {
            currentSummary.command = 'error'
            currentSummary.content = ''
            options.errorCallback?.()
          }
        },
        onError: (err: any) => {
          console.error('Summary 流式错误', err)
          isSummarizing.value = false
          options.errorCallback?.()
        },
        onClose: () => {
          console.log('Summary 流式连接关闭')
        },
        onDone: (payload: any) => {
          console.log('Summary 流式完成', payload)
          // 流式完成，确保状态更新
          if (currentSummary.command !== 'done' && currentSummary.command !== 'all') {
            currentSummary.command = 'done'
            isSummarizing.value = false
          }
        },
      })

      return {
        summaryId: summaryId.value,
      }
    } catch (error) {
      isSummarizing.value = false
      isWaiting.value = false
      cancelCurrentRequest = null
      console.error('fetch summary stream error', error)
      options.errorCallback?.()
      return null
    }
  }

  /**
   * 清除当前摘要内容
   * 重置currentSummary到初始状态
   * @returns {boolean} 操作是否成功
   */
  function clearSummary() {
    Object.assign(currentSummary, {
      command: '',
      content: '',
    })

    return true
  }

  /**
   * 取消当前正在进行中的摘要请求
   * 调用 fetchStream 返回的取消函数
   * @returns {boolean} 是否成功取消请求，如果当前没有请求则返回false
   */
  function cancelSummary() {
    if (cancelCurrentRequest) {
      try {
        cancelCurrentRequest()
      } catch (e) {
        console.error('Cancel summary error:', e)
      }

      // 重置状态
      isSummarizing.value = false
      isWaiting.value = false

      // 清空取消函数
      cancelCurrentRequest = null

      return true
    }

    return false
  }

  /**
   * 关闭当前摘要
   * 如果正在请求中，则取消请求；如果已经结束，则清除摘要内容
   * @returns {boolean} 操作是否成功
   */
  function closeSummary() {
    // 如果正在生成摘要，先取消请求
    if (isSummarizing.value) {
      return cancelSummary()
    }
    // 如果没有正在进行的请求，清除摘要内容
    else {
      return clearSummary()
    }
  }

  /**
   * 重试摘要生成
   * 使用重试接口，不扣余额，只传 sessionId
   * @returns {Promise<{summaryId: string}|null>} 返回摘要ID，失败时返回null
   */
  async function retrySummary() {
    // 检查是否有 sessionId
    if (!summaryId.value || summaryId.value === 'summaryId') {
      // 尝试从 lastSummaryInfo 获取 sessionId
      if (!lastSummaryInfo.value?.sessionId) {
        console.error('没有可重试的摘要记录')
        return null
      }
      summaryId.value = lastSummaryInfo.value.sessionId
    }

    // 使用 mode='retry' 调用 startSummary
    return startSummary(
      lastSummaryInfo.value || { sessionId: summaryId.value, content: '', pageUrl: '' },
      lastOptions.value || {},
      'retry'
    )
  }

  /**
   * 🎯 从预加载数据初始化（浮层流转场景）
   * 设置必要的状态，以便支持重试
   */
  function initFromPreloaded(summaryInfo: SummaryInfo) {
    // 保存摘要信息（用于 retry）
    lastSummaryInfo.value = { ...summaryInfo }
    summaryId.value = summaryInfo.sessionId
  }

  /**
   * 点赞或取消点赞
   * @param {number} feedback - 1表示点赞，0表示取消点赞
   * @returns {Promise<boolean>} 操作是否成功
   */
  async function likeSummary(feedback: number): Promise<boolean> {
    try {
      // 🎯 使用 axios（支持内容脚本环境的自动 trpc 转发）
      const axios = (await import('@/api/axios')).default
      await axios.post(`/plugin/summary/${summaryId.value}/feedback`, {
        feedback,
      })

      return true
    } catch (error) {
      console.error('Failed to provide feedback:', error)
      return false
    }
  }

  return {
    // 状态
    currentSummary,
    isSummarizing,

    // 方法
    startSummary,
    cancelSummary,
    clearSummary,
    closeSummary,
    retrySummary,
    likeSummary,
    initFromPreloaded,  // 🎯 新增
  }
}
