/**
 * answer store
 * 新版解题store - 组合式API - 简化版
 */
import { ref, reactive } from 'vue'
import { fetchStream } from '@/utils/fetchStream'
import { generateQuestionId } from '@/utils'
import { getTrpc } from '@/lib/trpc/client'
import type { QuestionInfo, StartAnswerOptions } from '@/types'
import { getPluginUuid } from '~/utils/pluginUuid'

// 答案状态
const currentAnswer = reactive({
  command: '',
  content: '',
  answerJsonObject: null,
})

// 是否正在请求中
const isAnswering = ref(false)

// 是否等待流式结果中
const isWaiting = ref(false)

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
 * @example
 * const { startAnswer } = useSolve();
 * const result = await startAnswer({
 *   questionId: 'q123',
 *   question: '如何解决这个问题?'
 * }, {
 *   onStartOutput: () => console.log('开始输出'),
 *   successCallback: () => console.log('解题完成')
 * });
 */
async function startAnswer(
  questionInfo: QuestionInfo,
  options: StartAnswerOptions = {}
) {
  // 记录参数信息，用于重试
  lastQuestionInfo.value = { ...questionInfo }
  lastOptions.value = { ...options }

  const { questionId: qId, answerId: aId } = questionInfo
  const answerId = aId || Date.now()
  const questionId = qId || generateQuestionId()

  // DSL 相关标记
  let isDsl = false // 是否启用 DSL 解析
  let hasDslStyle = false // 是否收到过 dsl renderStyle
  let hasContentSection = false // 是否收到过 contentSection

  // 检查锁定状态
  if (isAnswering.value) return

  const user = await getTrpc().getUser.query()

  // 获取用户扩展信息, 实验标签
  const userExtendInfo = await getTrpc().getUserExtendInfo.query()
  const experimentalTag = userExtendInfo.abTestTags?.find(
    (tag) => tag === 'TEST_S_Web_PluginSpeed_On'
  )

  // 初始化请求参数
  const requestParams = {
    ...questionInfo,
    questionId,
    answerId,
    userName: user?.userName,
    language: 'en',
    renderStyle: 'single-dsl',
    // 处理特殊配置
    // 新插件加速
    experimental: experimentalTag || '', // 当包含 'TEST_S_Web_PluginSpeed_On' 时返回该值，不包含时返回空字符串
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
  })

  // 获取token
  const authToken = await getTrpc().getAuthToken.query()

  // 保存取消函数，fetchStream返回的函数会调用tRPC的cancelFetchStream方法
  cancelCurrentRequest = fetchStream({
    url: `/question/fast/add`,
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
        // 更新答案内容和 DSL 数据
        currentAnswer.content += content
        currentAnswer.command = command

        if (isDsl) {
          currentAnswer.answerJsonObject = renderDsl(
            content,
            rest,
            currentAnswer.answerJsonObject || {
              finalAnswer: '',
              questions: [],
              currentSection: '',
              currentIndex: 0,
              questionStepIndex: 0,
            }
          )
        }

        // 更新 regenerate 信息
        if (options.answerInfo) {
          options.answerInfo.answer += content
          isDsl &&
            (options.answerInfo.answerJsonObject =
              currentAnswer.answerJsonObject)
        }
      } else if (command === 'done' || command === 'all') {
        // 更新最终答案
        currentAnswer.command = command
        currentAnswer.content = content

        // 更新 regenerate 信息
        if (options.answerInfo) {
          options.answerInfo.answer = content
          options.answerInfo.answerStatus = 0
          options.answerInfo.answerJsonObject = isDsl
            ? currentAnswer.answerJsonObject
            : null
        }

        options.successCallback?.()
      } else if (command === 'error') {
        currentAnswer.command = 'error'
        currentAnswer.content = ''
        options.errorCallback?.()
      }
      console.log('[use Solve] onMessage', currentAnswer)

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
      console.log('[stream done] currentAnswer', currentAnswer)
    },
  })

  return {
    questionId,
    answerId,
  }
}

/**
 * 清除当前答案内容
 * 重置currentAnswer到初始状态
 * @returns {boolean} 操作是否成功
 * @example
 * const { clearAnswer } = useSolve();
 * clearAnswer(); // 清除当前答案
 */
function clearAnswer() {
  Object.assign(currentAnswer, {
    command: '',
    content: '',
    answerJsonObject: null,
  })

  return true
}

/**
 * 取消当前正在进行中的解题请求
 * 使用fetchStream返回的取消函数中断请求流
 * @returns {boolean} 是否成功取消请求，如果当前没有请求则返回false
 * @example
 * const { cancelAnswer } = useSolve();
 * if (cancelAnswer()) {
 *   console.log('成功取消了解题请求');
 * }
 */
function cancelAnswer() {
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
 * @example
 * const { closeAnswer } = useSolve();
 * closeAnswer(); // 根据当前状态自动选择取消请求或清除内容
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
 * @example
 * const { retryAnswer } = useSolve();
 * const result = await retryAnswer({
 *   successCallback: () => console.log('重试成功')
 * });
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
    isRetry: true, // 添加重试标记
    answerId: `${lastQuestionId}#${Date.now()}`, // 生成新的 answerId
  }

  // 调用 startAnswer 开始重试
  return await startAnswer(retryQuestionInfo, retryOptions)
}

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

  // 确保当前question存在
  if (!answerJson.questions[answerJson.currentIndex]) {
    answerJson.questions[answerJson.currentIndex] = {
      question: '',
      questionSteps: [],
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
      answerJson.questionStepIndex =
        answerJson.questions[answerJson.currentIndex].questionSteps.length
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

    case 'questionStepTitle': {
      if (contentSection === 'questionStepTitle') {
        // 新的步骤
        answerJson.questions[answerJson.currentIndex].questionSteps[
          answerJson.questionStepIndex
        ] = {
          questionStepTitle: content,
          questionStepBody: '',
        }
      } else {
        // 继续追加到当前标题
        currentStep =
          answerJson.questions[answerJson.currentIndex].questionSteps[
            answerJson.questionStepIndex
          ]
        if (currentStep) {
          currentStep.questionStepTitle += content
        }
      }
      break
    }

    case 'questionStepBody': {
      currentStep =
        answerJson.questions[answerJson.currentIndex].questionSteps[
          answerJson.questionStepIndex
        ]
      if (!currentStep) {
        // 确保当前step存在
        answerJson.questions[answerJson.currentIndex].questionSteps[
          answerJson.questionStepIndex
        ] = {
          questionStepTitle: '',
          questionStepBody: '',
        }
        currentStep =
          answerJson.questions[answerJson.currentIndex].questionSteps[
            answerJson.questionStepIndex
          ]
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

    case 'finalAnswer': {
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
  return {
    // 状态
    currentAnswer,
    isAnswering,
    answerAttribute,

    // 方法
    startAnswer,
    retryAnswer, // 重试方法
    cancelAnswer, // 取消方法
    clearAnswer, // 清除答案内容
    closeAnswer, // 关闭解题（取消或清除）
  }
}

// 为了保持兼容性，仍然导出solveStore但使用新的状态
export const solveStore = {
  currentAnswer,
  isAnswering,
  answerAttribute,
}
