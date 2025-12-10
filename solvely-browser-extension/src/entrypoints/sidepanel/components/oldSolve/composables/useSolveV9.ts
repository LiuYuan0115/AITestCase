/**
 * v9 接口请求与状态管理
 *
 * 职责：
 * - 发起流式请求到 v9 接口
 * - 解析 JSON 数据
 * - 提取 components 数组
 * - 管理请求状态
 * - 提供操作方法（start/cancel/retry/like）
 */

import { reactive, ref, inject } from 'vue'

// 根据开关导入不同的 fetchStream
import { fetchStream } from '@/utils/fetchStream'

import { getTrpc } from '@/lib/trpc/client'
import { generateQuestionId } from '@/utils'
import { API_CONFIG } from '~/config'
import { useAnswerParser } from './useAnswerParser'
import trackEvent from '@/utils/trackEvent'
import type { SolveAnswer, QuestionInfo, StartAnswerOptions } from './types'
import { QuestionType } from '@/entrypoints/sidepanel/types/question'
import { useLanguage } from '@/composables/useLanguage'
import type { ABTestState } from '@/composables/useABTest'
import { getPluginUuid } from '~/utils/pluginUuid'

export function useSolveV9() {
  // ===== 依赖注入 =====
  const abTest = inject<ABTestState>('abTest')!

  // ===== 语言设置 =====
  const { currentLanguage } = useLanguage()

  // ===== 状态 =====
  const answer = reactive<SolveAnswer>({
    components: [],
    rawContent: '',
    contentType: 'json',
    status: 'idle',
    error: undefined,
    sections: {},
    currentSection: '',
  })

  const { parseStreamJSON, extractComponents, isProblemMissing } = useAnswerParser()

  // 保存取消函数和问题信息（用于 retry）
  let cancelCurrentRequest: (() => void) | null = null
  const lastQuestionInfo = ref<QuestionInfo | null>(null)
  const lastQuestionId = ref<string>('')
  const lastAnswerId = ref<string>('')

  // ===== 主要方法 =====

  /**
   * 开始解题
   */
  async function start(questionInfo: QuestionInfo, options: StartAnswerOptions = {}) {
    // 保存问题信息
    lastQuestionInfo.value = { ...questionInfo }

    // 重置状态
    answer.components = []
    answer.rawContent = ''
    answer.sections = {}
    answer.currentSection = ''
    answer.status = 'loading'
    answer.error = undefined

    // 生成或使用现有的 IDs
    const questionId = questionInfo.questionId || generateQuestionId()
    const answerId = questionInfo.answerId || `${questionId}#${Date.now()}`

    lastQuestionId.value = questionId
    lastAnswerId.value = answerId

    // 获取用户信息
    const authToken = await getTrpc().getAuthToken.query()
    const userId = await getTrpc().getUserId.query()
    const appVersion = await getTrpc().getAppVersion.query()

    // 生成请求 ID 和时间戳
    const requestTime = Date.now()
    const requestId = `r_${requestTime}`

    // 构建 Headers（v9 新增自定义 headers）
    const uuid = await getPluginUuid()
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
      'x-solvely-app-version': appVersion,
      'x-solvely-device-id': userId,
      'x-solvely-language': currentLanguage.value,
      'x-solvely-platform': 'plugin',
      'x-solvely-request-id': requestId,
      'x-solvely-request-time': String(requestTime),
      'x-solvely-user-group-label': '-',
      ...(uuid ? { 'x-plugin-uuid': uuid } : {}),
    }

    // 构建 Body（v9 简化参数）
    const requestBody: any = {
      questionId,
      answerId,
      // 图片 URL（优先从 files[0].processed 获取）
      pictureKey: questionInfo.files?.[0]?.processed || questionInfo.attachments?.image?.imageUrl || '',
      // 文本指令（图片题用 prompt，文本题用 value）
      instructions: questionInfo.prompt || '',
      answerLanguage: currentLanguage.value,
      answerStyle: 'standard',
      experimental: 'TEST_P_Geometry_Level1_New',
    }

    if (questionInfo.type !== QuestionType.PHOTO && questionInfo.type !== QuestionType.PAGE_SCREENSHOT_SOLVE) {
      requestBody.questionText = questionInfo.value || ''
    }

    const requestStartTime = Date.now()
    const totalStartTime = requestStartTime
    let hasTrackedFirstOutput = false
    let hasTrackedTotal = false

    const resolveCdnUrl = () =>
      questionInfo.files?.[0]?.processed ||
      questionInfo.attachments?.image?.imageUrl ||
      questionInfo.attachments?.imageUrl ||
      questionInfo.attachments?.pageScreenshot?.longImage ||
      questionInfo.attachments?.pageScreenshot?.cdnUrl ||
      ''

    const baseEventPayload = {
      questionId,
      type: questionInfo.type,
      source: questionInfo.source || '',
      pageUrl: questionInfo.pageUrl || questionInfo.attachments?.pageUrl || questionInfo.attachments?.page?.url || '',
      cdnUrl: resolveCdnUrl(),
    }

    const emitStartEvents = () => {
      if (hasTrackedFirstOutput) return
      hasTrackedFirstOutput = true
      const durationMS = Date.now() - requestStartTime
      const payload = {
        ...baseEventPayload,
        duration: durationMS / 1000,
        durationMS,
      }

      trackEvent.track('Extension_University_Solve_Success', {
        questionId,
      })

      trackEvent.track('Plugin_Solve_Success', baseEventPayload)

      trackEvent.track('Plugin_Solve_loading_solve', payload)
    }

    const emitTotalEvent = () => {
      if (hasTrackedTotal) return
      hasTrackedTotal = true
      const durationMS = Date.now() - totalStartTime
      trackEvent.track('Plugin_Solve_loading_total', {
        ...baseEventPayload,
        duration: durationMS / 1000,
        durationMS,
      })
    }

    cancelCurrentRequest = fetchStream({
      url: '/v9/question/solve',
      method: 'POST',
      headers: headers,
      body: requestBody,

      onMessage: (payload: any) => {
        try {
          if (answer.status !== 'streaming') {
            answer.status = 'streaming'
            options.onStartOutput?.()
          }
          // Mock 和真实接口的数据结构统一处理
          const data = payload.data.data || {}
          const { content, command, contentSection, contentType } = data

          if (command === 'pending') {
            // 1. 检测到新的 contentSection，切换当前活跃区
            if (contentSection) {
              // ⚠️ 关键：如果从 thinking 切换到其他 section，标记 thinking 完成
              if (answer.currentSection === 'thinking' && contentSection !== 'thinking') {
                const thinkingComp = answer.components.find((c) => c.type === 'question_thinking')
                if (thinkingComp) {
                  const endTime = Date.now()
                  // 如果有 startTime，计算 duration
                  if (thinkingComp.data.startTime) {
                    thinkingComp.data.duration = endTime - thinkingComp.data.startTime
                  }
                  thinkingComp.data.isDone = true
                  console.log(`✅ Thinking 完成, duration: ${thinkingComp.data.duration}ms`)
                }
              }

              answer.currentSection = contentSection
              console.log(`📍 切换到 contentSection: ${contentSection}`)
            }

            // 2. 根据 contentType 处理内容
            if (content && answer.currentSection) {
              emitStartEvents()
              const type = contentType || 'json' // 默认为 json

              // 全量替换该 section 的数据
              answer.sections[answer.currentSection] = { content, type }

              if (type === 'markdown') {
                // 🔑 Markdown 逻辑：全量替换，封装成 markdown component
                const markdownComp = {
                  id: `${answer.currentSection}_markdown`,
                  type: 'markdown',
                  sortId: 999, // 可根据需要调整
                  data: {
                    content: content, // 全量内容
                  },
                }

                // 按 componentId 更新或新增
                const existingIndex = answer.components.findIndex((comp) => comp.id === markdownComp.id)
                if (existingIndex !== -1) {
                  answer.components[existingIndex] = markdownComp // 全量替换
                } else {
                  answer.components.push(markdownComp)
                }
              } else {
                // 🔑 JSON 逻辑：全量替换，解析 JSON 提取 components（原有逻辑）
                const parsed = parseStreamJSON(content)
                if (parsed) {
                  // 检查是否 PROBLEM MISSING
                  if (isProblemMissing(parsed)) {
                    answer.status = 'error'
                    answer.error = new Error('PROBLEM_MISSING')
                    return
                  }

                  // 提取新的 components
                  const newComponents = extractComponents(parsed)

                  // 3. 合并逻辑：按 componentType 更新或新增
                  newComponents.forEach((newComp) => {
                    const existingIndex = answer.components.findIndex((comp) => comp.type === newComp.type)

                    if (existingIndex !== -1) {
                      // 已存在该 componentType
                      const existing = answer.components[existingIndex]

                      // ✅ 特殊处理：question_thinking 是增量输出，需要累加 thinking 字段
                      if (newComp.type === 'question_thinking') {
                        // 累加 thinking 内容
                        const existingThinking = existing.data.thinking || ''
                        const newThinking = newComp.data.thinking || ''
                        newComp.data.thinking = existingThinking + newThinking

                        // 保留其他状态字段
                        if (existing.data.startTime) {
                          newComp.data.startTime = existing.data.startTime
                        }
                        if (existing.data.isDone !== undefined) {
                          newComp.data.isDone = existing.data.isDone
                        }

                        answer.components[existingIndex] = newComp

                        console.log(
                          `💭 Thinking 累加: +${newThinking.length} chars, 总长: ${newComp.data.thinking.length}`
                        )
                      } else {
                        // ✅ 其他组件：全量替换（用于同一 type 的流式更新）
                        // 保留 startTime 和 isDone 状态
                        if (existing.data.startTime) {
                          newComp.data.startTime = existing.data.startTime
                        }
                        if (existing.data.isDone !== undefined) {
                          newComp.data.isDone = existing.data.isDone
                        }
                        answer.components[existingIndex] = newComp
                      }
                    } else {
                      // 新类型，追加
                      // 如果是 thinking 组件，初始化 startTime 和 isDone
                      if (newComp.type === 'question_thinking') {
                        newComp.data.startTime = Date.now()
                        newComp.data.isDone = false
                        console.log(`🚀 Thinking 开始, startTime: ${newComp.data.startTime}`)
                      }
                      answer.components.push(newComp)
                    }
                  })
                }
              }

              // 4. 更新完整的 rawContent（合并所有 sections，便于调试）
              answer.rawContent = JSON.stringify(answer.sections)
            }

            options.onMessage?.(payload)
          } else if (command === 'done' || command === 'all') {
            // done 命令只是结束标识，content 为空，不需要处理
            answer.status = 'done'
            emitTotalEvent()
            options.successCallback?.()
          } else if (command === 'error') {
            answer.status = 'error'
            answer.error = new Error('Solve failed')
            options.errorCallback?.()
          }
        } catch (error) {}
      },

      onError: (error) => {
        // 如果已经完成或主动取消，则忽略错误
        if (answer.status === 'done' || answer.status === 'idle') {
          return
        }

        answer.status = 'error'
        answer.error = error
        trackEvent.trackError('Plugin_SolveV9_Error', error, {
          questionType: questionInfo.type,
          questionId,
          eventString: String(error),
        })
        options.errorCallback?.()
      },

      onClose: () => {
        cancelCurrentRequest = null
      },

      onDone: () => {
        // 如果还在 streaming 状态，标记为 done
        if (answer.status === 'streaming') {
          answer.status = 'done'
          options.successCallback?.()
        }
        cancelCurrentRequest = null
      },
    })

    return {
      questionId,
      answerId,
    }
  }

  /**
   * 取消当前请求
   */
  function cancel() {
    answer.status = 'idle'
    if (cancelCurrentRequest) {
      cancelCurrentRequest()
      cancelCurrentRequest = null
      return true
    }
    return false
  }

  /**
   * 重试
   */
  async function retry(options: StartAnswerOptions = {}) {
    if (!lastQuestionInfo.value) {
      throw new Error('No previous question to retry')
    }

    // 生成新的 IDs
    const questionId = generateQuestionId()
    const retryInfo: QuestionInfo = {
      ...lastQuestionInfo.value,
      questionId,
      answerId: `${questionId}#${Date.now()}`,
    }

    return await start(retryInfo, options)
  }

  /**
   * 点赞/点踩
   */
  async function like(isLike: boolean) {
    if (!lastQuestionId.value) {
      console.warn('No questionId for like/dislike')
      return false
    }

    try {
      const authToken = await getTrpc().getAuthToken.query()
      const response = await fetch(`${API_CONFIG.BASE_URL}/question/${lastQuestionId.value}/like`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'solvely-language': 'en',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body: JSON.stringify({
          like: isLike ? 1 : 0,
          answerId: lastAnswerId.value,
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

  /**
   * 获取当前问题和答案 ID（用于埋点等）
   */
  function getQuestionInfo() {
    return {
      questionId: lastQuestionId.value,
      answerId: lastAnswerId.value,
    }
  }

  return {
    // 状态
    answer,

    // 方法
    start,
    cancel,
    retry,
    like,
    getQuestionInfo,
  }
}
