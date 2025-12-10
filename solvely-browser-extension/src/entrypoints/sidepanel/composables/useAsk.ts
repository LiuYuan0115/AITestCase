/**
 * answer store
 * 追问store - 组合式API
 */
import { ref, reactive, inject } from 'vue'
import { getTrpc } from '@/lib/trpc/client'
import { API_CONFIG } from '@/config'
import { ServiceMessageType } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import { fetchEventSource } from '@sentool/fetch-event-source'
import useABTest from '@/composables/useABTest'
import { useLanguage } from '@/composables/useLanguage'
import { getPluginUuid } from '~/utils/pluginUuid'

interface AskInfo {
  content: string
  sessionId: string // 统一使用sessionId
  apiEndpoint: string // 动态API端点
  parentType: ServiceMessageType // 父消息类型，用于区分不同场景

  // 保留现有字段以兼容
  questionId?: string
  answerId?: string
  answerIdTime?: string
  step?: string
  language?: string
  isNewStep?: boolean
  isFirstAsk?: boolean
}

interface StartAskOptions {
  onStartOutput?: () => void
  onMessage?: (event: MessageEvent) => void
  successCallback?: () => void
  errorCallback?: () => void
  answerInfo?: {
    answer: string
    answerStatus: number
  }
}

/**
 * useAsk 组合式API
 * 提供追问相关的状态和方法，用于管理追问过程中的数据和操作。
 * @returns {Object} 包含以下状态和方法的对象：
 * - currentAnswer: {Object} 当前答案对象，包含 command、content 属性
 * - isAnswering: {Ref<boolean>} 是否正在追问
 * - startAsk: {Function} 开始追问的方法
 * - cancelAsk: {Function} 取消追问的方法
 * - clearAsk: {Function} 清除答案内容的方法
 * - closeAsk: {Function} 关闭追问的方法
 */
export function useAsk() {
  const injectedAbTest = inject<ReturnType<typeof useABTest>>('abTest')
  const abTest = injectedAbTest ?? useABTest()
  const { currentLanguage } = useLanguage()
  // 答案状态
  const currentAnswer = reactive({
    command: '',
    content: '',
  })

  // 是否正在请求中
  const isAnswering = ref(false)

  // 是否等待流式结果中
  const isWaiting = ref(false)

  const isConnect = ref(true)

  // 存储当前请求的取消函数
  let cancelCurrentRequest: (() => void) | null = null

  // 存储上一次的请求信息
  const lastAskInfo = ref<AskInfo | null>(null)
  const lastOptions = ref<StartAskOptions | null>(null)
  const messageId = ref<string | null>(null)

  // 判断是否需要初始请求
  const needsInitialRequest = (askInfo: AskInfo): boolean => {
    return askInfo.parentType === ServiceMessageType.ANSWER
  }

  // 发起初始请求（仅 ANSWER 类型需要）
  const sendInitialRequest = async (askInfo: AskInfo, authToken: string, isRetry: boolean = false) => {
    // 只有 ANSWER 类型才会调用此方法
    const apiPath = isRetry
      ? `${API_CONFIG.BASE_URL}/question/follow/${askInfo.questionId}/retry`
      : `${API_CONFIG.BASE_URL}/question/follow/${askInfo.questionId}`

    const requestBody = isRetry
      ? {
          language: currentLanguage.value,
          messageId: messageId.value,
          sessionId: askInfo.answerId,
          platform: 'plugin',
        }
      : {
          content: askInfo.content,
          step: askInfo.step || '',
          language: currentLanguage.value,
          isNewStep: askInfo.isFirstAsk || false,
          answerId: askInfo.answerId,
          platform: 'plugin',
        }

    const response = await fetch(apiPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
        'x-plugin-uuid': await getPluginUuid() || '',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error('Failed to start follow-up question')
    }

    const data = await response.json()
    if (data.code !== 0) {
      throw new Error(data.message || 'Failed to start follow-up question')
    }

    return data
  }

  // 建立流式连接
  const establishStreamConnection = async (askInfo: AskInfo, userId: string, authToken: string, options: StartAskOptions) => {
    const streamUrl = buildStreamPath(askInfo, userId)
    const controller = new AbortController()

    // 保存取消函数
    cancelCurrentRequest = () => {
      controller.abort()
    }

    await fetchEventSource(streamUrl, {
      method: getHttpMethod(askInfo),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'x-plugin-uuid': await getPluginUuid() || '',
      },
      body: buildRequestBody(askInfo, userId),
      signal: controller.signal,
      onopen(response) {
        console.log('连接已建立', response)
      },
      onmessage(event) {
        if (!event.data) return
        // 🔥 保持现有的 EventSource.onmessage 业务逻辑
        const result = event.data as any
        const { content, command } = result.data || result

        // 保存messageId用于重试
        if (command === 'pending' && result.data?.messageId) {
          messageId.value = result.data.messageId
        }

        // 第一次收到内容时触发 onStartOutput 回调
        if (command === 'pending' && content && !isWaiting.value) {
          isWaiting.value = true
          options.onStartOutput?.()
        }

        if (command === 'pending' || command === 'graph') {
          try {
            const parsedContent = JSON.parse(content)
            if (parsedContent.Connect === false) {
              isConnect.value = false
              controller.abort()
              return
            }
            currentAnswer.content = parsedContent.Answer
          } catch (e) {}

          // 更新答案内容
          currentAnswer.command = command
        } else if (command === 'done' || command === 'all') {
          // 更新最终答案
          currentAnswer.command = command
          isAnswering.value = false
          options.successCallback?.()
          trackEvent.track('Plugin_Followup_Question_Meassagest')
          controller.abort()
        } else if (command === 'error') {
          currentAnswer.command = 'error'
          currentAnswer.content = ''
          options.errorCallback?.()
          controller.abort()
        }

        // 适配 MessageEvent 格式
        const mockMessageEvent = {
          data: event.data,
          type: 'message',
          origin: window.location.origin,
          lastEventId: '',
          source: null,
          ports: [],
        } as unknown as MessageEvent
        options.onMessage?.(mockMessageEvent)
      },
      onerror(err) {
        // 🔥 保持现有的 EventSource.onerror 业务逻辑
        console.error('Stream error:', err)
        isAnswering.value = false
        isWaiting.value = false
        cancelCurrentRequest = null
        options.errorCallback?.()
      },
    })
  }

  // 动态构建流式响应路径
  const buildStreamPath = (askInfo: AskInfo, userId: string): string => {
    switch (askInfo.parentType) {
      case ServiceMessageType.ANSWER:
        // ANSWER 类型使用 questionId 和 answerId（GET 请求）
        return `${API_CONFIG.BASE_URL}/question/follow/${userId}/${askInfo.questionId}/stream?answerIdTime=${
          askInfo.answerId?.split('#')[1]
        }&useNewApi=true&platform=plugin`
      case ServiceMessageType.SUMMARY:
        // SUMMARY 类型使用 POST 请求，URL 更简洁
        return `${API_CONFIG.BASE_URL}/chat/page/ask`
      case ServiceMessageType.QUOTE:
        return `${API_CONFIG.BASE_URL}/context/chat`
      case ServiceMessageType.EXPLAIN:
        return `${API_CONFIG.BASE_URL}/context/chat`
      case ServiceMessageType.HIGHLIGHT_CHAT:
        return `${API_CONFIG.BASE_URL}/context/chat`
      default:
        return ''
    }
  }

  // 构建请求体
  const buildRequestBody = (askInfo: AskInfo, userId: string): string | undefined => {
    switch (askInfo.parentType) {
      case ServiceMessageType.SUMMARY:
        return JSON.stringify({
          sessionId: askInfo.sessionId,
          text: askInfo.content,
          platform: 'plugin',
        })
      case ServiceMessageType.QUOTE:
        return JSON.stringify({
          sessionId: askInfo.sessionId,
          text: askInfo.content,
          platform: 'plugin',
          type: 'askForChat',
          deviceId: userId,
        })
      case ServiceMessageType.EXPLAIN:
        return JSON.stringify({
          sessionId: askInfo.sessionId,
          text: askInfo.content,
          platform: 'plugin',
          type: 'explain',
          deviceId: userId,
        })
      case ServiceMessageType.HIGHLIGHT_CHAT:
        return JSON.stringify({
          sessionId: askInfo.sessionId,
          text: askInfo.content,
          platform: 'plugin',
          type: 'highlightChat',
          deviceId: userId,
        })
      default:
        return undefined
    }
  }

  // 获取HTTP方法
  const getHttpMethod = (askInfo: AskInfo): 'GET' | 'POST' => {
    switch (askInfo.parentType) {
      case ServiceMessageType.SUMMARY:
      case ServiceMessageType.QUOTE:
      case ServiceMessageType.EXPLAIN:
      case ServiceMessageType.HIGHLIGHT_CHAT:
        return 'POST'
      default:
        return 'GET'
    }
  }

  /**
   * 开始追问
   * @param {AskInfo} askInfo - 追问信息对象，包含问题ID、内容等
   * @param {StartAskOptions} options - 可选配置项
   * @param {boolean} isRetry - 是否为重试请求
   * @returns {Promise<{questionId: string, answerId: string}|null>} 返回问题ID和答案ID，失败时返回null
   */
  async function startAsk(askInfo: AskInfo, options: StartAskOptions = {}, isRetry: boolean = false) {
    console.log('startAsk', askInfo, options, isRetry)
    // 检查锁定状态
    if (isAnswering.value) return

    // 设置锁定状态
    isAnswering.value = true

    // 初始化等待状态
    isWaiting.value = false

    // 重置当前答案
    Object.assign(currentAnswer, {
      command: '',
      content: '',
    })

    // 获取token
    const authToken = await getTrpc().getAuthToken.query()

    try {
      // 获取用户ID
      const userId = await getTrpc().getUserId.query()
      if (!userId) {
        throw new Error('User ID not found')
      }

      // 判断是否需要初始请求
      if (needsInitialRequest(askInfo)) {
        // ANSWER 类型：发起初始请求（保持原有逻辑）
        await sendInitialRequest(askInfo, authToken, isRetry)
      }

      // 所有类型都需要建立流式连接
      await establishStreamConnection(askInfo, userId, authToken, options)

      // 如果不是重试，保存当前请求信息
      if (!isRetry) {
        lastAskInfo.value = askInfo
        lastOptions.value = options
      }

      return {
        questionId: askInfo.questionId || '',
        answerId: askInfo.sessionId,
      }
    } catch (error) {
      isAnswering.value = false
      isWaiting.value = false
      cancelCurrentRequest = null
      options.errorCallback?.()
      return null
    }
  }

  /**
   * 清除当前答案内容
   * 重置currentAnswer到初始状态
   * @returns {boolean} 操作是否成功
   */
  function clearAsk() {
    Object.assign(currentAnswer, {
      command: '',
      content: '',
    })

    return true
  }

  /**
   * 取消当前正在进行中的追问请求
   * 使用EventSource的close方法中断请求流
   * @returns {boolean} 是否成功取消请求，如果当前没有请求则返回false
   */
  function cancelAsk() {
    if (cancelCurrentRequest && isAnswering.value) {
      cancelCurrentRequest()

      // 重置状态
      isAnswering.value = false
      isWaiting.value = false

      // 清空取消函数
      cancelCurrentRequest = null

      return true
    }

    return false
  }

  /**
   * 关闭当前追问
   * 如果正在请求中，则取消请求；如果已经结束，则清除答案内容
   * @returns {boolean} 操作是否成功
   */
  function closeAsk() {
    // 如果正在追问，先取消请求
    if (isAnswering.value) {
      return cancelAsk()
    }
    // 如果没有正在进行的请求，清除答案内容
    else {
      return clearAsk()
    }
  }

  /**
   * 重试追问
   * @returns {Promise<{questionId: string, answerId: string}|null>} 返回问题ID和答案ID，失败时返回null
   */
  async function retryAsk() {
    if (!lastAskInfo.value || !lastOptions.value) {
      return null
    }
    return startAsk(lastAskInfo.value, lastOptions.value, true)
  }

  /**
   * 点赞/取消点赞追问答案
   * @param {number} followFeedBack - 点赞状态：1-点赞，0-取消点赞
   * @returns {Promise<boolean>} 操作是否成功
   */
  async function likeAnswer(followFeedBack: number): Promise<boolean> {
    // 检查是否有必要的状态
    if (!lastAskInfo.value || !messageId.value) {
      return false
    }

    const { questionId, answerId } = lastAskInfo.value

    try {
      // 获取token
      const authToken = await getTrpc().getAuthToken.query()

      // 发起点赞请求
      const response = await fetch(`${API_CONFIG.BASE_URL}/question/follow/${questionId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body: JSON.stringify({
          followFeedBack,
          messageId: messageId.value,
          sessionId: answerId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to like answer')
      }

      const data = await response.json()
      if (data.code !== 0) {
        throw new Error(data.message || 'Failed to like answer')
      }

      return true
    } catch (error) {
      console.error('Like answer error:', error)
      return false
    }
  }

  return {
    // 状态
    currentAnswer,
    isAnswering,
    isConnect,

    // 方法
    startAsk,
    retryAsk,
    cancelAsk,
    clearAsk,
    closeAsk,
    likeAnswer,
  }
}
