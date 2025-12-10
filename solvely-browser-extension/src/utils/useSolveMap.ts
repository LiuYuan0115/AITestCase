/**
 * answer store
 * 新版解题store - 组合式API
 */
import { ref, reactive } from 'vue'
import { fetchStream } from '@/utils/fetchStream'
import { generateQuestionId } from '@/utils'
import { getTrpc } from '@/lib/trpc/client'
import type { QuestionInfo, StartAnswerOptions } from '@/types'
import { getPluginUuid } from '~/utils/pluginUuid'
// import { point, adjustPoint } from '@/utils/point'

// 状态变量
const answerMap = reactive(new Map())
const currentAnswerMap = reactive(new Map())
const currentAnswerAttribute = reactive(new Map())
const pointedAnswerIds = reactive(new Set())

/**
 * 开始解题
 */
async function startAnswer(questionInfo: QuestionInfo, options: StartAnswerOptions = {}) {
  const { questionId: qId, answerId: aId } = questionInfo
  const answerId = aId || Date.now()
  const questionId = qId || generateQuestionId()
  const answerKey = `${questionId}#${answerId}`

  // DSL 相关标记
  let isDsl = false // 是否启用 DSL 解析
  let hasDslStyle = false // 是否收到过 dsl renderStyle
  let hasContentSection = false // 是否收到过 contentSection

  // 检查锁定状态
  const currentAnswerLock = currentAnswerMap.get(answerKey)
  if (currentAnswerLock) return

  const user = await getTrpc().getUser.query()

  // 初始化请求参数
  const requestParams = {
    ...questionInfo,
    questionId,
    answerId,
    userName: user?.userName,
    language: 'en',
    renderStyle: 'single-dsl',
     // 处理特殊配置
    experimental: 'TEST_P_WebFollowupUX_New', // 实验标签
  }

  // 设置锁定状态
  currentAnswerMap.set(answerKey, 'lock')
  answerMap.set(answerKey, null)

  // 获取token
  const authToken = await getTrpc().getAuthToken.query()

  fetchStream({
    url: `/api-web/v1/question/fast/add`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
      'x-plugin-uuid': await getPluginUuid() || ''
    },
    body: requestParams,
    onOpen: async () => {
      // point('Web_Question_RequestSolve', { questionId })
      answerMap.set(answerKey, { command: 'start', content: '' })
    },
    onMessage: (event: MessageEvent) => {
      const { content, command, ...rest } = event.data || {}

      // 获取或初始化当前答案状态
      const currentAnswer = answerMap.get(answerKey) || {
        command: 'pending',
        content: '',
        answerJsonObject: null
      }

      // 更新 DSL 相关标记
      if (rest?.renderStyle === 'dsl') hasDslStyle = true
      if (rest?.contentSection) hasContentSection = true
      isDsl = hasDslStyle && hasContentSection

      if (command === 'pending' || command === 'graph') {
        // 更新答案内容和 DSL 数据
        const updatedAnswer = {
          ...currentAnswer,
          content: currentAnswer.content + content,
          command,
          answerJsonObject: isDsl
            ? renderDsl(
                content,
                rest,
                currentAnswer.answerJsonObject || {
                  finalAnswer: '',
                  questions: [],
                  currentSection: '',
                  currentIndex: 0,
                  questionStepIndex: 0
                }
              )
            : currentAnswer.answerJsonObject
        }
        answerMap.set(answerKey, updatedAnswer)

        // 更新 regenerate 信息
        if (options.answerInfo) {
          options.answerInfo.answer += content
          isDsl && (options.answerInfo.answerJsonObject = updatedAnswer.answerJsonObject)
        }
      } else if (command === 'done' || command === 'all') {
        const finalAnswer = answerMap.get(answerKey)
        // 更新最终答案
        answerMap.set(answerKey, {
          command,
          content,
          answerJsonObject: isDsl ? finalAnswer?.answerJsonObject : null
        })

        // 更新 regenerate 信息
        if (options.answerInfo) {
          options.answerInfo.answer = content
          options.answerInfo.answerStatus = 0
          options.answerInfo.answerJsonObject = isDsl ? finalAnswer?.answerJsonObject : null
        }

        // adjustPoint('kknp8z')
        options.successCallback?.()
      } else if (command === 'error') {
        answerMap.set(answerKey, { command: 'error', content: '' })
        options.errorCallback?.()
      }
      options.onMessage?.(event)
    },
    onClose: () => {
      currentAnswerMap?.delete(answerKey)
    },
    onError: () => {
      currentAnswerMap?.delete(answerKey)
      // point('Web_Solve_Stream_Stop', {
      //   questionId,
      //   answerId,
      //   version: 2,
      //   source: 'answer'
      // })
      options.errorCallback?.()
    },
    onDone: () => {
      currentAnswerMap?.delete(answerKey)
      const command = answerMap.get(answerKey)?.command
      // 如果最后一条command不是done或all或server-stop或start，则认为解完题
      const validCommands = ['done', 'all', 'server-stop', 'start']
      if (!validCommands.includes(command)) {
        options.successCallback?.()
        // adjustPoint('kknp8z')
      }
    }
  })
}

/**
 * 切换答案属性
 */
// export async function changeAnswerAttribute(type, params, answer, options = {}) {
//   const authToken = await getTrpc().getAuthToken.query()
//   let messageIndex = 0
//   const answerId = params.answerId
//   const questionId = params.questionId
//   const answerKey = `${questionId}#${answerId}`
//   const currentAnswerLock = currentAnswerMap.get(answerKey)
//   // 如果当前answerKey已经加锁，则直接返回
//   if (currentAnswerLock) return
//   currentAnswerMap.set(answerKey, 'lock')

//   // 初始化 DSL 相关变量
//   let isDsl = false
//   let hasDslStyle = false
//   let hasContentSection = false // 是否受到过contentSection
//   // dsl 新版解题，不含多小问题
//   // 用户的标签
//   params.renderStyle = 'single-dsl'
//   params.experimental = 'TEST_P_WebFollowupUX_New'

//   fetchStream({
//     url: `/api-web/v1/answer/${type}`,
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Accept: 'application/json',
//       Authorization: `Bearer ${authToken}`
//     },
//     body: params,
//     onOpen: () => {
//       currentAnswerAttribute.set(answerId, { command: 'pending', content: '' })
//     },
//     onMessage: (event) => {
//       if (messageIndex === 1 && !pointedAnswerIds.has(answerKey)) {
//         pointedAnswerIds.add(answerKey)
//         // point('Web_Answer_ChangeAttribute_Start', {
//         //   type: params.toLanguage ? 'language' : 'style',
//         //   answerId,
//         //   questionId,
//         //   duration: Date.now() - parseInt(answerId.split('#')[1])
//         // })
//       }

//       const { content, command, ...rest } = event.data

//       // 检查是否收到过dsl style标记
//       if (rest?.renderStyle === 'dsl') {
//         hasDslStyle = true
//       }

//       // 检查是否收到过contentSection
//       if (rest?.contentSection) {
//         hasContentSection = true
//       }

//       // 只有收到过dsl style标记且有contentSection时才进行dsl处理
//       isDsl = hasDslStyle && hasContentSection

//       if (command === 'pending') {
//         answer.answerStatus = 1
//         answer.answer += content
//         const currentAttribute = currentAnswerAttribute.get(answerId) || {
//           command: 'pending',
//           content: '',
//           answerJsonObject: null
//         }

//         // 更新当前属性
//         const updatedAttribute = {
//           command: 'pending',
//           content: answer.answer,
//           answerJsonObject: isDsl
//             ? renderDsl(
//                 content,
//                 rest,
//                 currentAttribute.answerJsonObject || {
//                   finalAnswer: '',
//                   questions: [],
//                   currentSection: '',
//                   currentIndex: 0,
//                   questionStepIndex: 0
//                 }
//               )
//             : null
//         }
//         currentAnswerAttribute.set(answerId, updatedAttribute)

//         // 同步更新 answer 对象的 DSL 数据
//         if (isDsl) {
//           answer.answerJsonObject = updatedAttribute.answerJsonObject
//         }

//         if (content.length > 1) {
//           messageIndex++
//         }
//       }

//       if (command === 'done') {
//         answer.answerStatus = 0
//         answer.answer = content
//         const currentAttribute = currentAnswerAttribute.get(answerId)
//         currentAnswerAttribute.set(answerId, {
//           command: 'done',
//           content: answer.answer,
//           answerJsonObject: isDsl ? currentAttribute?.answerJsonObject || null : null
//         })
//         options.successCallback?.()
//         emitter.emit('change-answer-done', { answerId, questionId })
//       }

//       if (command === 'error') {
//         options.errorCallback?.()
//       }
//     },
//     onClose: () => {
//       currentAnswerMap?.delete(answerKey)
//     },
//     onError: () => {
//       currentAnswerMap?.delete(answerKey)
//       // point('Web_Translate_Stream_Stop', {
//       //   questionId,
//       //   answerId,
//       //   version: 2,
//       //   attribute: params.toLanguage ? 'language' : 'style'
//       // })
//     },
//     onDone: () => {
//       currentAnswerMap?.delete(answerKey)
//       if (currentAnswerAttribute.get(answerId)?.command === 'pending') {
//         options.successCallback?.()
//       }
//       // 上报总耗时埋点
//       // point('Web_Answer_ChangeAttribute_Done', {
//       //   type: params.toLanguage ? 'language' : 'style',
//       //   answerId,
//       //   questionId,
//       //   duration: Date.now() - parseInt(answerId.split('#')[1])
//       // })
//       // 清理已执行过point的记录
//       pointedAnswerIds.delete(answerKey)
//       // 提交成功，如果params.toLanguage存在，那么就是切换语言切换语言后，重新获取用户最近语言
//       if (params.toLanguage) {
//         useUserinfoStore().getRecentLanguages()
//       }
//     }
//   })
// }

/**
 * 渲染dsl
 * @param {*} content 流返回的内容
 * @param {*} rest 流返回的rest
 * @param {*} answerJson 当前的answerJson
 * @returns 更新后的answerJson
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
      questionSteps: []
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
          questionStepBody: ''
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
          questionStepBody: ''
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
 * 提供解题相关的状态和方法
 */
export function useSolveMap() {
  return {
    // 状态
    answerMap,
    currentAnswerMap,
    currentAnswerAttribute,
    pointedAnswerIds,
    
    // 方法
    startAnswer
  }
}

// 为了保持兼容性，仍然导出原来的 solveStore
export const solveMapStore = {
  answerMap,
  currentAnswerMap,
  currentAnswerAttribute,
  pointedAnswerIds
} 