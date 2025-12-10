/**
 * v9 接口请求与状态管理（多模型支持）
 *
 * 职责：
 * - 发起流式请求到 v9 接口
 * - 解析 JSON 数据
 * - 提取 components 数组
 * - 管理多模型请求状态
 * - 提供操作方法（start/cancel/retry/like/switchModel）
 */

import { reactive, ref, inject, computed } from 'vue'

// 根据开关导入不同的 fetchStream
import { fetchStream } from '@/utils/fetchStream'

import { getTrpc } from '@/lib/trpc/client'
import { generateQuestionId } from '@/utils'
import { API_CONFIG } from '~/config'
import { STORAGE_KEY } from '@/config/storage'
import { useAnswerParser } from './useAnswerParser'
import trackEvent from '@/utils/trackEvent'
import type { SolveAnswer, QuestionInfo, StartAnswerOptions, ModelResult } from './types'
import { QuestionType } from '@/entrypoints/sidepanel/types/question'
import { useLanguage } from '@/composables/useLanguage'
import type { ABTestState } from '@/composables/useABTest'
import { useModelConfig } from './useModelConfig'
import http from '@/api/axios' // 🎯 导入 axios（自动处理内容脚本转发）
import { getPluginUuid } from '~/utils/pluginUuid'

export function useSolveV9() {
  // ===== 依赖注入 =====
  const abTest = inject<ABTestState>('abTest')!

  // ===== 语言设置 =====
  const { currentLanguage } = useLanguage()

  // ===== 模型配置 =====
  const { getModelName, defaultModelId } = useModelConfig()

  // ===== 多模型状态 =====
  const modelResults = reactive<Map<string, ModelResult>>(new Map())
  const currentModelId = ref<string>(defaultModelId.value)
  const sharedQuestionId = ref<string>('') // 共享的 questionId

  const { parseStreamJSON, extractComponents, isProblemMissing } = useAnswerParser()

  // 保存问题信息（用于 retry/switchModel）
  const lastQuestionInfo = ref<QuestionInfo | null>(null)

  const lastQuestionId = ref<string>('')

  const lastAnswerId = ref<string>('')

  // ===== 计算属性：当前模型的答案（兼容现有代码） =====
  const answer = computed<SolveAnswer>(() => {
    const result = modelResults.get(currentModelId.value)
    return (
      result?.answer || {
        components: [],
        rawContent: '',
        contentType: 'json',
        status: 'idle',
        error: undefined,
        sections: {},
        currentSection: '',
      }
    )
  })

  // ===== 计算属性：已请求的模型列表 =====
  const requestedModels = computed<ModelResult[]>(() => {
    return Array.from(modelResults.values()).sort((a, b) => a.requestedAt - b.requestedAt)
  })

  // ===== 辅助函数 =====

  /**
   * 获取有效的默认模型（用户设置优先，否则系统默认）
   */
  async function getEffectiveDefaultModel(): Promise<string> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY.DEFAULT_SOLVE_MODEL)
      const userModel = result[STORAGE_KEY.DEFAULT_SOLVE_MODEL]
      const effectiveModel = userModel || defaultModelId.value
      console.log('✅ useSolveV9: 获取默认模型', { userModel, effectiveModel })
      return effectiveModel
    } catch (error) {
      console.error('❌ useSolveV9: 获取默认模型失败', error)
      return defaultModelId.value
    }
  }

  /**
   * 记录解题完成情况
   */
  async function recordSolveCompletion(modelId: string) {
    try {
      // 1. 递增解题次数
      const result = await browser.storage.local.get(STORAGE_KEY.SOLVE_COUNT)
      const count = (result[STORAGE_KEY.SOLVE_COUNT] || 0) + 1
      await browser.storage.local.set({ [STORAGE_KEY.SOLVE_COUNT]: count })
      console.log('✅ 解题次数递增:', count)

      // 2. 如果是 Multi-model，记录首次使用
      if (modelId === 'MultiModel') {
        const multiModelResult = await browser.storage.local.get(STORAGE_KEY.MULTI_MODEL_USED)
        if (!multiModelResult[STORAGE_KEY.MULTI_MODEL_USED]) {
          await browser.storage.local.set({
            [STORAGE_KEY.MULTI_MODEL_USED]: Date.now(),
          })
          console.log('✅ 首次使用 Multi-model')
        }
      }
    } catch (error) {
      console.error('❌ recordSolveCompletion 失败:', error)
    }
  }

  // ===== 主要方法 =====

  /**
   * 开始解题（支持指定模型）
   */
  async function start(
    questionInfo: QuestionInfo,
    options: StartAnswerOptions = {},
    modelId?: string,
    useModelSwitchEndpoint?: boolean
  ) {
    // 保存问题信息
    lastQuestionInfo.value = { ...questionInfo }

    // 确定使用的模型 ID（必须显式传入，否则使用系统默认）
    const targetModelId = (modelId || defaultModelId.value) as string

    // 如果是首次请求，生成共享的 questionId
    if (!sharedQuestionId.value) {
      sharedQuestionId.value = questionInfo.questionId || generateQuestionId()
    }

    // 生成该模型的 answerId
    const answerId = `${sharedQuestionId.value}#${Date.now()}`

    // 更新 lastQuestionId 和 lastAnswerId
    lastQuestionId.value = questionInfo.questionId || ''
    lastAnswerId.value = answerId

    // 初始化该模型的结果状态
    const initialAnswer: SolveAnswer = {
      components: [],
      rawContent: '',
      contentType: 'json',
      status: 'loading',
      error: undefined,
      sections: {},
      currentSection: '',
    }

    const modelResult: ModelResult = {
      modelId: targetModelId,
      modelName: getModelName(targetModelId),
      answerId,
      answer: initialAnswer,
      requestedAt: Date.now(),
      cancelRequest: null,
    }

    modelResults.set(targetModelId, modelResult)
    currentModelId.value = targetModelId

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

    // 构建 Body（v9 简化参数 + model 参数）
    const requestBody: any = {
      questionId: sharedQuestionId.value,
      answerId,
      displayModelId: targetModelId, // ⭐ 新增：模型参数
      // 图片 URL（优先从 files[0].processed 获取）
      pictureKey: questionInfo.files?.[0]?.processed || questionInfo.attachments?.image?.imageUrl || '',
      // 文本指令（图片题用 prompt，文本题用 value）
      instructions: questionInfo.prompt || '',
      answerLanguage: currentLanguage.value,
      answerStyle: 'standard',
      experimental: 'TEST_MultiModel_ThirdParty_On,TEST_P_Geometry_Level1_New',
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
      questionId: sharedQuestionId.value,
      type: questionInfo.type,
      source: questionInfo.source || '',
      pageUrl: questionInfo.pageUrl || questionInfo.attachments?.pageUrl || questionInfo.attachments?.page?.url || '',
      cdnUrl: resolveCdnUrl(),
      displayModelId: targetModelId, // ⭐ 埋点添加模型信息
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
        questionId: sharedQuestionId.value,
        model: targetModelId,
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

    // 获取该模型的 answer 引用（便于更新）
    const currentAnswer = modelResults.get(targetModelId)!.answer

    const cancelFn = fetchStream({
      url: useModelSwitchEndpoint ? '/v9/question/model/solve' : '/v9/question/solve',
      method: 'POST',
      headers: headers,
      body: requestBody,

      onMessage: (payload: any) => {
        try {
          if (currentAnswer.status !== 'streaming') {
            currentAnswer.status = 'streaming'
            options.onStartOutput?.()
          }
          // Mock 和真实接口的数据结构统一处理
          const data = payload.data.data || {}
          const { content, command, contentSection, contentType } = data

          if (command === 'pending') {
            // 1. 检测到新的 contentSection，切换当前活跃区
            if (contentSection) {
              // ⚠️ 关键：如果从 thinking 切换到其他 section，标记 thinking 完成
              if (currentAnswer.currentSection === 'thinking' && contentSection !== 'thinking') {
                const thinkingComp = currentAnswer.components.find((c) => c.type === 'question_thinking')
                if (thinkingComp) {
                  const endTime = Date.now()
                  // 如果有 startTime，计算 duration
                  if (thinkingComp.data.startTime) {
                    thinkingComp.data.duration = endTime - thinkingComp.data.startTime
                  }
                  thinkingComp.data.isDone = true
                  console.log(`✅ Thinking 完成 [${targetModelId}], duration: ${thinkingComp.data.duration}ms`)
                }
              }

              currentAnswer.currentSection = contentSection
              console.log(`📍 [${targetModelId}] 切换到 contentSection: ${contentSection}`)
            }

            // 2. 根据 contentType 处理内容
            if (content && currentAnswer.currentSection) {
              emitStartEvents()
              const type = contentType || 'json' // 默认为 json

              // 全量替换该 section 的数据
              currentAnswer.sections[currentAnswer.currentSection] = { content, type }

              if (currentAnswer.currentSection === 'questionType') {
                try {
                  currentAnswer.questionType = JSON.parse(content)
                  if (currentModelId.value === 'Auto') {
                    const newModelId = currentAnswer.questionType?.isDifficult ? 'MultiModel' : 'Fast'
                    // ⭐ 关键修复：同步更新 modelResults 的 key
                    const autoResult = modelResults.get('Auto')
                    if (autoResult) {
                      // 更新 modelResult 的 modelId
                      autoResult.modelId = newModelId
                      autoResult.modelName = getModelName(newModelId)
                      // 将结果从 'Auto' 移动到新的 key
                      modelResults.delete('Auto')
                      modelResults.set(newModelId, autoResult)
                    }
                    // 更新当前模型 ID
                    currentModelId.value = newModelId
                    console.log(`✅ Auto 模式切换到: ${newModelId}`)
                  }
                } catch (error) {}
              }

              if (type === 'markdown') {
                // 🔑 Markdown 逻辑：全量替换，封装成 markdown component
                const markdownComp = {
                  id: `${currentAnswer.currentSection}_markdown`,
                  type: 'markdown',
                  sortId: 999, // 可根据需要调整
                  data: {
                    content: content, // 全量内容
                  },
                }

                // 按 componentId 更新或新增
                const existingIndex = currentAnswer.components.findIndex((comp) => comp.id === markdownComp.id)
                if (existingIndex !== -1) {
                  currentAnswer.components[existingIndex] = markdownComp // 全量替换
                } else {
                  currentAnswer.components.push(markdownComp)
                }
              } else {
                // 🔑 JSON 逻辑：全量替换，解析 JSON 提取 components（原有逻辑）
                const parsed = parseStreamJSON(content)
                if (parsed) {
                  // 检查是否 PROBLEM MISSING
                  if (isProblemMissing(parsed)) {
                    currentAnswer.status = 'error'
                    currentAnswer.error = new Error('PROBLEM_MISSING')
                    return
                  }

                  // 提取新的 components
                  const newComponents = extractComponents(parsed)

                  // 3. 合并逻辑：按 componentType 更新或新增
                  newComponents.forEach((newComp) => {
                    const existingIndex = currentAnswer.components.findIndex((comp) => comp.type === newComp.type)

                    if (existingIndex !== -1) {
                      // 已存在该 componentType
                      const existing = currentAnswer.components[existingIndex]

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
                        if (existing.data.duration !== undefined && newComp.data.duration === undefined) {
                          newComp.data.duration = existing.data.duration
                        }

                        currentAnswer.components[existingIndex] = newComp
                      } else {
                        // ✅ 其他组件：全量替换（用于同一 type 的流式更新）
                        // 保留 startTime 和 isDone 状态
                        if (existing.data.startTime) {
                          newComp.data.startTime = existing.data.startTime
                        }
                        if (existing.data.isDone !== undefined) {
                          newComp.data.isDone = existing.data.isDone
                        }
                        currentAnswer.components[existingIndex] = newComp
                      }
                    } else {
                      // 新类型，追加
                      // 如果是 thinking 组件，初始化 startTime 和 isDone
                      if (newComp.type === 'question_thinking') {
                        newComp.data.startTime = Date.now()
                        newComp.data.isDone = false
                        console.log(`🚀 [${targetModelId}] Thinking 开始, startTime: ${newComp.data.startTime}`)
                      }
                      currentAnswer.components.push(newComp)
                    }
                  })
                }
              }

              // 4. 更新完整的 rawContent（合并所有 sections，便于调试）
              currentAnswer.rawContent = JSON.stringify(currentAnswer.sections)
            }

            options.onMessage?.(payload)
          } else if (command === 'done' || command === 'all') {
            // done 命令只是结束标识，content 为空，不需要处理
            currentAnswer.status = 'done'
            emitTotalEvent()
            // ⭐ 记录解题完成情况
            recordSolveCompletion(targetModelId)
            options.successCallback?.()
          } else if (command === 'error') {
            currentAnswer.status = 'error'
            currentAnswer.error = new Error('Solve failed')
            options.errorCallback?.()
          }
        } catch (error) {
          console.error(`[${targetModelId}] Stream processing error:`, error)
        }
      },

      onError: (error) => {
        // 如果已经完成或主动取消，则忽略错误
        if (currentAnswer.status === 'done' || currentAnswer.status === 'idle') {
          return
        }

        currentAnswer.status = 'error'
        currentAnswer.error = error
        trackEvent.trackError('Plugin_SolveV9_Error', error, {
          questionType: questionInfo.type,
          questionId: sharedQuestionId.value,
          model: targetModelId,
          eventString: String(error),
        })
        options.errorCallback?.()
      },

      onClose: () => {
        const result = modelResults.get(targetModelId)
        if (result) {
          result.cancelRequest = null
        }
      },

      onDone: () => {
        // 如果还在 streaming 状态，标记为 done
        if (currentAnswer.status === 'streaming') {
          currentAnswer.status = 'done'
          options.successCallback?.()
        }
        const result = modelResults.get(targetModelId)
        if (result) {
          result.cancelRequest = null
        }
      },
    })

    // 保存取消函数到该模型结果中
    modelResults.get(targetModelId)!.cancelRequest = cancelFn

    return {
      questionId: sharedQuestionId.value,
      answerId,
      modelId: targetModelId,
    }
  }

  /**
   * 取消当前正在输出的模型
   *
   * 修复说明：
   * 之前只取消 currentModelId 指向的模型，但用户可能切换到已完成的模型查看，
   * 导致无法取消真正在运行的模型。
   * 现在改为找到正在运行的模型（status 为 loading 或 streaming）并取消。
   */
  function cancel() {
    // ✅ 找到所有正在运行的模型（loading 或 streaming）
    const runningModel = Array.from(modelResults.values()).find(
      (result) => result.answer.status === 'loading' || result.answer.status === 'streaming'
    )

    if (!runningModel) {
      console.warn('⚠️ No running model to cancel')
      return false
    }

    console.log(`🛑 取消正在运行的模型: ${runningModel.modelId}`)

    // 🎯 保存 thinking 的 duration 和 isStopped（如果有 thinking 组件且正在进行中）
    const thinkingComp = runningModel.answer.components.find((c) => c.type === 'question_thinking')
    if (thinkingComp) {
      // 🎯 关键：如果已经有 duration，不要重新计算（防止重复 cancel 覆盖正确值）
      if (!thinkingComp.data.duration && thinkingComp.data.startTime && !thinkingComp.data.isDone) {
        const endTime = Date.now()
        thinkingComp.data.duration = endTime - thinkingComp.data.startTime
      }

      // 🆕 标记 thinking 组件为停止状态（状态自包含）
      thinkingComp.data.isStopped = true
    }

    // 标记模型为停止状态
    runningModel.isStopped = true
    runningModel.answer.status = 'idle'

    if (runningModel.cancelRequest) {
      runningModel.cancelRequest()
      runningModel.cancelRequest = null
      return true
    }

    return false
  }

  /**
   * 切换到其他模型
   */
  async function switchModel(modelId: string) {
    if (modelResults.has(modelId)) {
      // 已有结果，直接切换显示
      currentModelId.value = modelId
      trackEvent.track('Plugin_Solve_NavigateResult', {
        fromModel: currentModelId.value,
        toModel: modelId,
        action: 'view_existing',
      })
    } else {
      // 触发新请求
      if (!lastQuestionInfo.value) {
        throw new Error('No question info to switch model')
      }

      await start(lastQuestionInfo.value, {}, modelId, true)
    }
  }

  /**
   * 重试指定模型（清除旧结果并重新请求）
   */
  async function retry(modelId: string) {
    // 清除该模型的旧结果（让 switchModel 认为这是新请求）
    modelResults.delete(modelId)

    // 复用 switchModel 逻辑（会自动使用正确的端点）
    await switchModel(modelId)

    trackEvent.track('Plugin_Solve_Retry', {
      modelId,
      questionId: sharedQuestionId.value,
    })
  }

  /**
   * 点赞/点踩当前模型
   */
  async function like(isLike: boolean) {
    const result = modelResults.get(currentModelId.value)
    if (!result || !sharedQuestionId.value) {
      console.warn('No current model result for like/dislike')
      return false
    }

    try {
      // 🎯 使用 axios（自动判断环境，在内容脚本中会转发到 background）
      await http.post(`/question/${sharedQuestionId.value}/like`, {
        like: isLike ? 1 : 0,
        answerId: result.answerId,
      })

      trackEvent.track(isLike ? 'Plugin_Solve_Like' : 'Plugin_Solve_Dislike', {
        questionId: sharedQuestionId.value,
        answerId: result.answerId,
        model: currentModelId.value,
      })

      return true
    } catch (error) {
      console.error('Failed to like/dislike:', error)
      return false
    }
  }

  /**
   * 获取当前模型的问题和答案 ID（用于追问、埋点等）
   */
  function getQuestionInfo() {
    const result = modelResults.get(currentModelId.value)
    return {
      questionId: sharedQuestionId.value,
      answerId: result?.answerId || '',
      modelId: currentModelId.value,
    }
  }

  /**
   * 获取图片 URL（用于浮层流转时传递 CDN URL）
   */
  function getImageUrl() {
    return lastQuestionInfo.value?.files?.[0]?.processed || lastQuestionInfo.value?.attachments?.image?.imageUrl
  }

  /**
   * 🎯 从预加载数据初始化（浮层流转场景）
   * 设置必要的状态，以便支持重试
   */
  function initFromPreloaded(questionInfo: QuestionInfo, preloadedData: any) {
    // 🔧 关键修复：恢复图片 CDN URL 以支持重试（仅图片题）
    const imageUrl = preloadedData.imageUrl || preloadedData.cdnUrl
    const restoredQuestionInfo = { ...questionInfo }

    // 只在图片题且有 imageUrl 时才恢复 files 字段
    const isPhotoQuestion =
      questionInfo.type === QuestionType.PHOTO || questionInfo.type === QuestionType.PAGE_SCREENSHOT_SOLVE

    if (imageUrl && isPhotoQuestion) {
      // 恢复上传后的 CDN URL
      restoredQuestionInfo.files = [{ processed: imageUrl }]
      if (restoredQuestionInfo.attachments) {
        restoredQuestionInfo.attachments.image = {
          ...restoredQuestionInfo.attachments.image,
          imageUrl,
        }
      }
    }

    // 保存问题信息（用于 retry）
    lastQuestionInfo.value = restoredQuestionInfo
    lastQuestionId.value = preloadedData.questionId || ''
    lastAnswerId.value = preloadedData.answerId || ''

    // 设置共享的 questionId
    sharedQuestionId.value = preloadedData.questionId || ''

    // 🎯 清空旧数据
    modelResults.clear()

    // 🎯 恢复多模型数据
    if (!preloadedData.modelResults || !Array.isArray(preloadedData.modelResults)) {
      console.error('❌ initFromPreloaded: modelResults 数据缺失或格式错误')
      return
    }

    // 恢复每个模型的结果
    preloadedData.modelResults.forEach((modelData: any) => {
      const modelResult: ModelResult = {
        modelId: modelData.modelId,
        modelName: modelData.modelName,
        answerId: modelData.answerId,
        answer: {
          components: modelData.components || [],
          rawContent: '',
          contentType: 'json',
          status: modelData.status || 'done',
          error: undefined,
          sections: {},
          currentSection: '',
        },
        requestedAt: Date.now(),
        cancelRequest: null,
        isLiked: modelData.isLiked,
        isDisliked: modelData.isDisliked,
        isStopped: modelData.isStopped,
      }

      modelResults.set(modelData.modelId, modelResult)
    })

    // 设置当前模型为预加载数据中指定的模型
    currentModelId.value = preloadedData.modelId || preloadedData.modelResults[0]?.modelId || defaultModelId.value
  }

  function getCurrentModelResult(): ModelResult | null {
    return modelResults.get(currentModelId.value) || null
  }

  /**
   * 🎯 更新指定模型的点赞状态（触发响应式更新）
   */
  function updateModelFeedback(modelId: string, isLiked: boolean) {
    const result = modelResults.get(modelId)
    if (!result) return false

    // 🔑 关键：重新 set 到 Map 触发响应式更新
    const updated = {
      ...result,
      isLiked: isLiked,
      isDisliked: !isLiked,
    }

    modelResults.set(modelId, updated)
    return true
  }

  return {
    // 状态（兼容现有代码）
    answer,

    // 多模型状态
    currentModelId,
    modelResults,
    requestedModels,

    // 方法
    start,
    cancel,
    switchModel,
    retry,
    like,
    getQuestionInfo,
    getImageUrl, // 🎯 获取图片 CDN URL
    initFromPreloaded, // 🎯 新增
    getCurrentModelResult,
    getEffectiveDefaultModel,
    updateModelFeedback, // 🎯 更新点赞状态
  }
}
