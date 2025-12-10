/**
 * answer store
 * 新版解题store - 组合式API - 简化版
 */
import { ref, reactive, inject } from 'vue'
import { fetchStream } from '@/utils/fetchStream'
import { generateQuestionId } from '@/utils'
import { getTrpc } from '@/lib/trpc/client'
import type { QuestionInfo, StartAnswerOptions } from '@/types'
import { API_CONFIG } from '~/config'
import { AuthState } from '../types/auth'
import { QuestionType } from '~/entrypoints/sidepanel/types/question'
import { parse, STR, OBJ, ARR } from 'partial-json'
import trackEvent from '@/utils/trackEvent'
import { useLanguage } from '@/composables/useLanguage'
import useABTest from '@/composables/useABTest'
import { getPluginUuid } from '~/utils/pluginUuid'

/**
 * 渲染dsl
 * 处理流返回的内容并更新数据结构
 * @param {string} content - 流返回的内容
 * @param {any} rest - 流返回的其他数据
 * @param {any} answerJson - 当前的answerJson对象
 * @returns {any} 更新后的answerJson
 * @private 内部使用的辅助函数
 */
function renderDsl(content: string, rest: any, answerJson: any) {
  const { contentSection } = rest

  // 确保answerJson有正确的初始结构
  if (!Array.isArray(answerJson.questions)) {
    answerJson.questions = []
  }

  // 确保hasExplicitQuestion字段存在
  if (typeof answerJson.hasExplicitQuestion !== 'boolean') {
    answerJson.hasExplicitQuestion = false
  }

  // 处理contentSection=question的情况（多question支持）
  if (contentSection === 'question') {
    if (!answerJson.hasExplicitQuestion) {
      // 第一次遇到contentSection=question
      answerJson.hasExplicitQuestion = true
      // 如果当前question已有内容，则需要创建新question
      if (answerJson.questions[answerJson.currentIndex] && answerJson.questions[answerJson.currentIndex].question) {
        answerJson.currentIndex++
      }
    } else {
      // 非首次遇到，创建新question
      answerJson.currentIndex++
    }
  }

  // 确保当前question存在（兼容旧数据和新数据）
  if (!answerJson.questions[answerJson.currentIndex]) {
    answerJson.questions[answerJson.currentIndex] = {
      question: '',
      questionSteps: [],
      questionAnswer: '',
    }
  }

  // 如果没有currentSection且没有新的contentSection，则不处理内容
  if (!answerJson.currentSection && !contentSection) {
    return answerJson
  }

  // 如果有contentSection，更新当前处理的section类型
  if (contentSection) {
    answerJson.currentSection = contentSection
    // 如果是新的questionStepTitle，增加questionStepIndex
    if (contentSection === 'questionStepTitle') {
      answerJson.questionStepIndex = answerJson.questions[answerJson.currentIndex].questionSteps.length
    }
  }

  let currentStep

  // 根据当前正在处理的section类型来追加内容
  switch (answerJson.currentSection) {
    case 'question': {
      if (contentSection === 'question') {
        // question开始
        answerJson.questions[answerJson.currentIndex].question = content
      } else {
        // 继续追加到当前question
        answerJson.questions[answerJson.currentIndex].question += content
      }
      break
    }

    case 'thinking': {
      if (contentSection === 'thinking') {
        // thinking开始
        answerJson.thinking = {
          startTime: Date.now(),
          content: content,
        }
      } else {
        // 继续追加到thinking
        answerJson.thinking.content += content
      }
      break
    }

    case 'gmat_information': {
      try {
        // 如果content为空，则不处理
        if (!content) {
          return answerJson
        }
        const gmatData = JSON.parse(content)
        // 处理 URL，确保包含协议头
        let targetUrl = gmatData.target_url || ''
        if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = `https://${targetUrl}`
        }
        answerJson.gmatInfo = {
          examName: gmatData.exam_name || '',
          sourceReference: gmatData.source_reference || '',
          targetUrl,
        }
      } catch (error) {
        console.error('Failed to parse GMAT information:', error)
        answerJson.gmatInfo = {
          examName: '',
          sourceReference: '',
          targetUrl: '',
        }
      }
      break
    }

    case 'questionStepTitle': {
      // 确保在处理steps时当前question存在（兼容旧数据）
      if (!answerJson.hasExplicitQuestion && !answerJson.questions[0]) {
        answerJson.questions[0] = {
          question: '',
          questionSteps: [],
          questionAnswer: '',
        }
      }

      if (contentSection === 'questionStepTitle') {
        // 新的步骤
        answerJson.questions[answerJson.currentIndex].questionSteps[answerJson.questionStepIndex] = {
          questionStepTitle: content,
          questionStepBody: '',
        }
      } else {
        // 继续追加到当前标题
        currentStep = answerJson.questions[answerJson.currentIndex].questionSteps[answerJson.questionStepIndex]
        if (currentStep) {
          currentStep.questionStepTitle += content
        }
      }
      break
    }

    case 'questionStepBody': {
      // 确保在处理steps时当前question存在（兼容旧数据）
      if (!answerJson.hasExplicitQuestion && !answerJson.questions[0]) {
        answerJson.questions[0] = {
          question: '',
          questionSteps: [],
          questionAnswer: '',
        }
      }

      currentStep = answerJson.questions[answerJson.currentIndex].questionSteps[answerJson.questionStepIndex]
      if (!currentStep) {
        // 确保当前step存在
        answerJson.questions[answerJson.currentIndex].questionSteps[answerJson.questionStepIndex] = {
          questionStepTitle: '',
          questionStepBody: '',
        }
        currentStep = answerJson.questions[answerJson.currentIndex].questionSteps[answerJson.questionStepIndex]
      }

      if (contentSection === 'questionStepBody') {
        // body开始
        currentStep.questionStepBody = content
      } else {
        // 继续追加到当前body
        currentStep.questionStepBody += content
      }
      break
    }

    case 'questionAnswer': {
      // 确保在处理 questionAnswer 时当前 question 存在（兼容旧数据）
      if (!answerJson.hasExplicitQuestion && !answerJson.questions[0]) {
        answerJson.questions[0] = {
          question: '',
          questionSteps: [],
          questionAnswer: '',
        }
      }

      if (contentSection === 'questionAnswer') {
        // questionAnswer 开始
        answerJson.questions[answerJson.currentIndex].questionAnswer = content
      } else {
        // 继续追加到当前 questionAnswer
        answerJson.questions[answerJson.currentIndex].questionAnswer += content
      }
      break
    }

    case 'finalAnswer': {
      if (answerJson.thinking?.content) {
        answerJson.thinking.endTime = Date.now()
      }
      if (contentSection === 'finalAnswer') {
        // finalAnswer开始
        answerJson.finalAnswer = content
      } else {
        // 继续追加到当前finalAnswer
        answerJson.finalAnswer = (answerJson.finalAnswer || '') + content
      }
      break
    }
  }
  return answerJson
}

/**
 * useSolve 组合式API
 * 提供解题相关的状态和方法，用于管理解题过程中的数据和操作。
 * @returns {Object} 包含以下状态和方法的对象：
 * - currentAnswer: {Object} 当前答案对象，包含 command、content、answerJsonObject 属性
 * - isAnswering: {Ref<boolean>} 是否正在解题
 * - answerAttribute: {Object} 答案属性
 * - startAnswer: {Function} 开始解题的方法
 * - retryAnswer: {Function} 重试解题的方法
 * - cancelAnswer: {Function} 取消解题的方法
 * - clearAnswer: {Function} 清除答案内容的方法
 * - closeAnswer: {Function} 关闭解题的方法
 * @example
 * import { useSolve } from '@/composables/content/useSolve'
 *
 * const {
 *   currentAnswer,
 *   isAnswering,
 *   startAnswer,
 *   cancelAnswer
 * } = useSolve();
 *
 * // 使用示例
 * async function handleQuestion(question) {
 *   await startAnswer({
 *     question,
 *     questionId: generateQuestionId()
 *   }, {
 *     onStartOutput: () => console.log('开始输出答案'),
 *     successCallback: () => console.log('解题完成')
 *   });
 * }
 *
 * // 检查是否正在解题
 * if (isAnswering.value) {
 *   console.log('当前正在解题中');
 * }
 *
 * // 获取答案内容
 * const answer = currentAnswer.content;
 */
export function useSolve() {
  const auth = inject<AuthState>('auth')!

  // 语言设置（移到顶层，避免在异步函数中调用）
  const { currentLanguage } = useLanguage()
  // 答案状态
  const currentAnswer = reactive({
    command: '',
    content: '',
    answerJsonObject: null,
    // 新增字段：JSON格式相关
    isJsonFormat: false, // 是否为JSON格式（一次确定，不再改变）
    jsonFormatObject: null, // JSON格式的数据对象
  })

  // 是否正在请求中
  const isAnswering = ref(false)

  // 是否等待流式结果中
  const isWaiting = ref(false)

  // 用户中止标记
  const isStopped = ref(false)

  // 一键解题没有解出任何题目
  const isProblemMissing = ref(false)

  // 可能后续需要的状态变量，简化为单个记录
  const answerAttribute = reactive({
    command: '',
    content: '',
    answerJsonObject: null,
  })

  // 记录上一次解题的参数信息，用于重试
  const lastQuestionInfo = ref<QuestionInfo | null>(null)
  const lastOptions = ref<StartAnswerOptions | null>(null)

  // 存储当前请求的取消函数
  let cancelCurrentRequest: (() => void) | null = null

  /**
   * 开始解题
   * @param {QuestionInfo} questionInfo - 问题信息对象，包含问题ID、答案ID等
   * @param {StartAnswerOptions} options - 可选配置项
   * @param {Function} [options.onStartOutput] - 当第一次收到内容时的回调函数
   * @param {Function} [options.onMessage] - 接收消息事件的回调函数
   * @param {Function} [options.successCallback] - 成功完成时的回调函数
   * @param {Function} [options.errorCallback] - 发生错误时的回调函数
   * @param {Object} [options.answerInfo] - 用于存储答案信息的对象，会被更新
   * @returns {Promise<{questionId: string, answerId: string}|null>} 返回问题ID和答案ID，失败时返回null
   */
  async function startAnswer(questionInfo: QuestionInfo, options: StartAnswerOptions = {}) {
    // 保存当前问题信息
    lastQuestionInfo.value = { ...questionInfo }
    lastOptions.value = { ...options }

    if (isStopped.value) {
      isStopped.value = false
      return
    }

    const { questionId: qId, answerId: aId } = questionInfo
    const answerId = aId || Date.now()
    const questionId = qId || generateQuestionId()

    // DSL 相关标记
    let isDsl = false // 是否启用 DSL 解析
    let hasDslStyle = false // 是否收到过 dsl renderStyle
    let hasContentSection = false // 是否收到过 contentSection

    // JSON 格式检测标记
    let formatDetected = false // 避免重复检测

    // 检查锁定状态
    if (isAnswering.value) return

    const user = await getTrpc().getUser.query()

    // 获取用户扩展信息, 实验标签
    const userExtendInfo = await getTrpc().getUserExtendInfo.query()
    const experimentalTag = userExtendInfo.abTestTags?.find((tag) => tag === 'TEST_S_Web_PluginSpeed_On')

    // 初始化请求参数
    const requestParams = {
      ...questionInfo,
      platform: 'plugin',
      questionId,
      answerId,
      userName: user?.userName,
      // 语言设置
      language: currentLanguage.value,
      answerLanguage: currentLanguage.value,
      renderStyle: 'single-dsl',
      // 处理特殊配置
      // 新插件加速
      // 打补丁0.2.8，一定要带上这个TEST_Plugin_Gmat_Information
      experimental: experimentalTag
        ? experimentalTag + ',TEST_Plugin_Gmat_Information'
        : 'TEST_Plugin_Gmat_Information',
      useNewApi: true,
    }

    // 设置锁定状态
    isAnswering.value = true

    // 初始化等待状态
    isWaiting.value = false

    // 重置当前答案
    Object.assign(currentAnswer, {
      command: '',
      content: '',
      answerJsonObject: null,
      isJsonFormat: false,
      jsonFormatObject: null,
    })

    // 获取token
    const authToken = await getTrpc().getAuthToken.query()

    // 保存取消函数，fetchStream返回的函数会调用tRPC的cancelFetchStream方法
    if (
      questionInfo.type === QuestionType.PAGE_SOLVE_ALL ||
      questionInfo.type === QuestionType.PAGE_SCREENSHOT_SOLVE ||
      questionInfo.type === QuestionType.PDF_SOLVE_ALL
    ) {
      currentAnswer.isJsonFormat = true
      cancelCurrentRequest = fetchStream({
        url: '/solve/all',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body: requestParams,
        onOpen: async () => {
          currentAnswer.command = 'start'
          currentAnswer.content = ''
        },
        onMessage: (event: MessageEvent) => {
          const { content, command } = event.data || {}
          // 第一次收到内容时触发 onStartOutput 回调
          if (command === 'pending' && content && !isWaiting.value) {
            isWaiting.value = true
            options.onStartOutput?.()
          }

          if (command === 'pending') {
            currentAnswer.command = command
            try {
              currentAnswer.content += content
              currentAnswer.jsonFormatObject = parse(currentAnswer.content, STR | OBJ | ARR)
              if ((currentAnswer.jsonFormatObject as any)?.solutions?.[0]?.questionGoal === 'PROBLEM MISSING') {
                isProblemMissing.value = true
                // cancelCurrentRequest?.()
                return
              }
            } catch (e) {
              currentAnswer.content += content
              console.warn('Failed to parse JSON content:', e)
            }
          } else if (command === 'done' || command === 'all') {
            // 更新最终答案
            currentAnswer.command = command
            currentAnswer.content = content
            options.successCallback?.()
          } else if (command === 'error') {
            currentAnswer.command = 'error'
            currentAnswer.content = ''
            options.errorCallback?.()
          }
          options.onMessage?.(event)
        },
        onClose: () => {
          isAnswering.value = false
          isWaiting.value = false
          cancelCurrentRequest = null
        },
        onError: () => {
          isAnswering.value = false
          isWaiting.value = false
          cancelCurrentRequest = null
          trackEvent.track('Plugin_sidebar_solve_error')
          // 向上抛出错误，通知 UI 层展示网络错误
          options.errorCallback?.()
        },
        onDone: () => {
          isAnswering.value = false
          isWaiting.value = false
          cancelCurrentRequest = null
          const command = currentAnswer.command
          // 如果最后一条command不是done或all或server-stop或start，则认为解完题
          const validCommands = ['done', 'all', 'server-stop', 'start']
          if (!validCommands.includes(command)) {
            options.successCallback?.()
          }
        },
      })
    } else {
      cancelCurrentRequest = fetchStream({
        url: '/question/fast/add',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body: requestParams,
        onOpen: async () => {
          currentAnswer.command = 'start'
          currentAnswer.content = ''
        },
        onMessage: (event: MessageEvent) => {
          const { content, command, ...rest } = event.data || {}

          // 更新 DSL 相关标记
          if (rest?.renderStyle === 'dsl') hasDslStyle = true
          if (rest?.contentSection) hasContentSection = true
          isDsl = hasDslStyle && hasContentSection

          // 第一次收到内容时触发 onStartOutput 回调
          if (command === 'pending' && content && !isWaiting.value) {
            isWaiting.value = true
            options.onStartOutput?.()
          }

          if (command === 'pending' || command === 'graph') {
            currentAnswer.command = command

            // 一次性格式检测：只在第一次收到非空content时检测
            if (!formatDetected && content && content.trim()) {
              formatDetected = true
              try {
                const parsedContent = JSON.parse(content)
                // 如果parsedContent里面有exam_name字段，就不认为是json格式
                if (typeof parsedContent === 'object' && parsedContent !== null && !parsedContent.exam_name) {
                  // 确认为JSON格式
                  currentAnswer.isJsonFormat = true
                  currentAnswer.jsonFormatObject = parsedContent
                  currentAnswer.content = content // 保存原始JSON字符串
                }
              } catch (e) {
                // 解析失败，确认为普通文本格式
                currentAnswer.isJsonFormat = false
                currentAnswer.content += content // 开始累加文本
              }
            } else if (formatDetected) {
              // 格式已确定，根据格式分别处理
              if (currentAnswer.isJsonFormat) {
                // JSON格式：content是完整的JSON字符串，直接替换
                if (content) {
                  try {
                    const parsedContent = JSON.parse(content)
                    currentAnswer.jsonFormatObject = parsedContent
                    currentAnswer.content = content // 保留最新的完整JSON字符串
                  } catch (e) {
                    console.warn('Failed to parse JSON content:', e)
                  }
                }
              } else {
                // 文本格式：content是增量文本，需要累加
                currentAnswer.content += content
              }
            }

            // DSL 处理（仅文本格式）
            if (!currentAnswer.isJsonFormat && isDsl) {
              currentAnswer.answerJsonObject = renderDsl(
                content,
                rest,
                currentAnswer.answerJsonObject || {
                  finalAnswer: '',
                  questions: [],
                  currentSection: '',
                  currentIndex: 0,
                  questionStepIndex: 0,
                  hasExplicitQuestion: false,
                  thinking: {
                    content: '',
                  },
                }
              )
            }

            // 更新 regenerate 信息
            if (options.answerInfo) {
              if (currentAnswer.isJsonFormat) {
                options.answerInfo.answer = currentAnswer.content
                options.answerInfo.answerJsonObject = currentAnswer.jsonFormatObject
              } else {
                options.answerInfo.answer += content
                isDsl && (options.answerInfo.answerJsonObject = currentAnswer.answerJsonObject)
              }
            }
          } else if (command === 'done' || command === 'all') {
            // 更新最终答案
            currentAnswer.command = command
            currentAnswer.content = content

            // 更新 regenerate 信息
            if (options.answerInfo) {
              options.answerInfo.answer = content
              options.answerInfo.answerStatus = 0
              options.answerInfo.answerJsonObject = currentAnswer.isJsonFormat
                ? currentAnswer.jsonFormatObject
                : isDsl
                ? currentAnswer.answerJsonObject
                : null
            }

            options.successCallback?.()
          } else if (command === 'error') {
            currentAnswer.command = 'error'
            currentAnswer.content = ''
            options.errorCallback?.()
          }
          options.onMessage?.(event)
        },
        onClose: () => {
          isAnswering.value = false
          isWaiting.value = false
          cancelCurrentRequest = null
        },
        onError: () => {
          isAnswering.value = false
          isWaiting.value = false
          cancelCurrentRequest = null
          trackEvent.track('Plugin_sidebar_solve_error')
          // 向上抛出错误，通知 UI 层展示网络错误
          options.errorCallback?.()
        },
        onDone: () => {
          isAnswering.value = false
          isWaiting.value = false
          cancelCurrentRequest = null
          const command = currentAnswer.command
          // 如果最后一条command不是done或all或server-stop或start，则认为解完题
          const validCommands = ['done', 'all', 'server-stop', 'start']
          if (!validCommands.includes(command)) {
            options.successCallback?.()
          }
        },
      })
    }

    return {
      questionId,
      answerId,
    }
  }

  /**
   * 清除当前答案内容
   * 重置currentAnswer到初始状态
   * @returns {boolean} 操作是否成功
   */
  function clearAnswer() {
    Object.assign(currentAnswer, {
      command: '',
      content: '',
      answerJsonObject: null,
      isJsonFormat: false,
      jsonFormatObject: null,
    })
    // 清除当前问题信息
    lastQuestionInfo.value = null

    return true
  }

  /**
   * 取消当前正在进行中的解题请求
   * 使用fetchStream返回的取消函数中断请求流
   * @returns {boolean} 是否成功取消请求，如果当前没有请求则返回false
   */
  function cancelAnswer() {
    isStopped.value = true

    if (cancelCurrentRequest && isAnswering.value) {
      console.log('取消当前解题请求')
      // 调用fetchStream返回的取消函数
      // 该函数会调用tRPC的cancelFetchStream方法
      // tRPC的cancelFetchStream方法会调用background中的fetchStreamService.cancelStream
      // fetchStreamService.cancelStream使用AbortController.abort()实际取消请求
      cancelCurrentRequest()

      // 重置状态
      isAnswering.value = false
      isWaiting.value = false
      isStopped.value = false

      // 清空取消函数
      cancelCurrentRequest = null

      return true
    }

    return false
  }

  /**
   * 关闭当前解题
   * 如果正在请求中，则取消请求；如果已经结束，则清除答案内容
   * @returns {boolean} 操作是否成功
   */
  function closeAnswer() {
    // 如果正在解题，先取消请求
    if (isAnswering.value) {
      return cancelAnswer()
    }
    // 如果没有正在进行的请求，清除答案内容
    else {
      return clearAnswer()
    }
  }

  /**
   * 重试解题
   * 使用上次解题的参数，添加 isRetry: true 标记再次请求
   * @param {StartAnswerOptions} retryOptions - 重试时的选项，默认使用上次的选项
   * @returns {Promise<{questionId: string, answerId: string}|null>} 返回问题ID和答案ID，失败时返回null
   */
  async function retryAnswer(retryOptions = lastOptions.value || {}) {
    // 检查是否有上次解题的记录
    if (!lastQuestionInfo.value) {
      console.error('没有可重试的解题记录')
      return null
    }

    // 如果当前正在解题，不允许重试
    if (isAnswering.value) {
      console.warn('当前正在解题中，不能重试')
      return null
    }

    // 复制上次的参数，避免修改原始对象
    const { questionId: lastQuestionId } = lastQuestionInfo.value

    const retryQuestionInfo = {
      ...lastQuestionInfo.value,
    }

    const questionId = generateQuestionId()
    retryQuestionInfo.questionId = questionId
    retryQuestionInfo.answerId = `${questionId}#${Date.now()}`

    // 调用 startAnswer 开始重试
    return await startAnswer(retryQuestionInfo, retryOptions)
  }

  /**
   * 点赞或取消点赞
   * @param {boolean} isLike - true表示点赞，false表示取消点赞
   * @returns {Promise<boolean>} 操作是否成功
   */
  async function likeAnswer(isLike: boolean) {
    try {
      const authToken = await getTrpc().getAuthToken.query()
      const response = await fetch(`${API_CONFIG.BASE_URL}/question/${lastQuestionInfo.value?.questionId}/like`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'solvely-language': 'en',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body: JSON.stringify({
          like: isLike ? 1 : 0,
          answerId: lastQuestionInfo.value?.answerId,
        }),
      })

      if (!response.ok) {
        throw new Error('Like request failed')
      }

      return true
    } catch (error) {
      console.error('Failed to like/dislike:', error)
      return false
    }
  }

  return {
    // 状态
    currentAnswer,
    isAnswering,
    answerAttribute,
    lastQuestionInfo,
    isProblemMissing,

    // 方法
    startAnswer,
    retryAnswer,
    cancelAnswer,
    clearAnswer,
    closeAnswer,
    likeAnswer,
  }
}
