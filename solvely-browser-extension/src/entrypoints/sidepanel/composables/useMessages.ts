import { ref, computed, inject, watch, shallowRef, markRaw } from 'vue'
import {
  MessageItem,
  UserMessage,
  UserContent,
  MessageType,
  ServiceMessageType,
  MessageStatus,
  ServiceMessage,
} from '../types/message'
import { QuestionType } from '../types/question'
import { AuthState } from '../types/auth'
import { getTrpc } from '@/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'
import useSubscription from './useSubscription'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import { usePageScreenshotSingleton } from './usePageScreenshot'
import { STORAGE_KEYS } from '~/types/config'
import useABTest from '@/composables/useABTest'
import globalUpload from './useGlobalUpload'
import useFileStagingUIStatus from './useFileStagingUIStatus'
import useCurrentWebSite from './useCurrentWebSite'
import { uploadFileToS3 } from '~/utils/fileUpload'
import { PageScreenshotUploadManager } from '~/utils/PageScreenshotUploadManager'
import { imageProcessor } from '~/utils/imageProcessor'

// 定义支持追问的消息类型
const FOLLOWUP_SUPPORTED_TYPES = [
  ServiceMessageType.ANSWER, // 现有：解题支持追问
  ServiceMessageType.SUMMARY, // 新增：总结支持追问
  ServiceMessageType.PDF_SUMMARIZE, // 新增：PDF总结追问支持追问
  ServiceMessageType.QUOTE, // 新增：引用提问支持追问
  ServiceMessageType.EXPLAIN, // 新增：解释支持追问
  ServiceMessageType.HIGHLIGHT_CHAT, // 新增：网页/PDF 划词提问支持追问
  // 未来可扩展其他类型...
]

// API端点映射配置
const API_ENDPOINT_MAP: Record<ServiceMessageType, string> = {
  [ServiceMessageType.ANSWER]: '/question/follow',
  [ServiceMessageType.ASK]: '/question/follow', // ASK使用默认端点
  [ServiceMessageType.QUIZ]: '', // 默认端点
  [ServiceMessageType.SUMMARY]: '/chat/page/ask', // 新增
  [ServiceMessageType.PDF_SUMMARIZE]: '', // 默认端点
  [ServiceMessageType.PDF_SUMMARIZE_ASK]: '', // 默认端点
  [ServiceMessageType.QUOTE]: '/context/chat', // 新增：引用提问
  [ServiceMessageType.EXPLAIN]: '/context/chat', // 新增：解释
  [ServiceMessageType.HIGHLIGHT_CHAT]: '/context/chat', // 新增：网页/PDF 划词提问
}

export function useMessages() {
  const messages = ref<MessageItem[]>([])
  const isResponding = ref(false)
  const isOutLimit = ref(false)
  const isOutLimitFrom = ref('')
  const auth = inject<AuthState>('auth')!
  const abTest = useABTest()
  const pendingUserContent = ref<UserContent | null>(null)
  const pendingUserMessage = ref<UserMessage | null>(null)
  const isShowExample = ref(false)
  const subscription = useSubscription

  // 暂停按钮禁用状态
  const disabledStop = ref(false)

  // 设置暂停按钮禁用状态
  const setDisabledStop = (disabled: boolean) => {
    disabledStop.value = disabled
    console.log(`🛑 [useMessages] 设置暂停按钮禁用状态: ${disabled}`)
  }

  const isFromYoutubeCheckLimit = ref(false)

  const activeCancelHandler = ref<(() => void) | null>(null)

  // 判断消息列表是否为空
  const isMessageEmpty = computed(() => !isShowExample.value && messages.value.length === 0)

   watch(
     [() => auth.isAuthenticated.value, () => subscription.isSubscribed.value],
     ([newAuthValue, newSubValue], [oldAuthValue, oldSubValue]) => {
       if ((newAuthValue && !oldAuthValue) || (newSubValue && !oldSubValue)) {
         if (pendingUserContent.value) {
           const message = pendingUserContent.value
           pendingUserContent.value = null
           pendingUserMessage.value = null
           isOutLimit.value = false
           addUserMessage(message)
         } else if (isFromYoutubeCheckLimit) {
           isOutLimit.value = false
           isFromYoutubeCheckLimit.value = false
         }
       }
     }
   )

  // 检查余额和订阅状态（由 useSubscription 提供）
  const limitCheck = subscription.limitCheck

  const addPageSolveMessage = async () => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!activeTab?.id) return

    const response = await browser.tabs.sendMessage(activeTab.id, {
      type: SidepanelEventType.GET_PAGE_CONTENT_TYPE,
    })

    const url = activeTab.url
    const title = activeTab.title

    //0.3.4新增，要去判断是不是onboarding界面，如果是,AB测试

    if (
      activeTab.url?.split('?')[0] === import.meta.env.VITE_ONBOARDING_PAGE_URL
      // || 'localhost:3000/app/extension-onboarding'
    ) {
      const storage = await browser.storage.local.get(STORAGE_KEYS.ONBOARDING_COMPLETED)
      if (!storage[STORAGE_KEYS.ONBOARDING_COMPLETED]) {
        try {
          const screenshotComposable = usePageScreenshotSingleton()
          const result = await screenshotComposable.capturePageScreenshots()
          if (result.success) {
            browser.runtime.sendMessage({
              type: SidepanelEventType.SOLVE_FROM_CONTENT,
            })
          }
          // 发送消息给 content script
          await browser.tabs.sendMessage(activeTab.id, {
            type: SidepanelEventType.DISPATCH_ONBOARDING_EVENT,
          })
        } catch (error) {
          console.error('Failed to send onboarding event:', error)
        }
        return
      }
    }

    // 检查是否为 Canvas 页面
    let isCanvas = false
    let canvasUrl: string | null = null

    if (response?.contentType === 'application/pdf' && url && title) {
      addUserMessage({
        type: QuestionType.PDF_SOLVE_ALL,
        value: '',
        fileStackKey: url, // 使用URL作为fileStackKey
        attachments: {
          chatWithPdf: {
            fileUrl: url,
            fileName: title,
          },
        },
      })
    } else if (url && url.startsWith('chrome-extension://') && url.includes('pdfView')) {
      // 检查是否为自定义PDF阅读器页面
      try {
        const urlObj = new URL(url)
        const cdn = urlObj.searchParams.get('cdn')
        const fileStackKey = urlObj.searchParams.get('fileStackKey')

        if (cdn && fileStackKey) {
          // 获取文件名
          let fileName = ''
          try {
            const lastSegment = cdn.substring(cdn.lastIndexOf('/') + 1)
            fileName = lastSegment || cdn || ''
          } catch {
            fileName = cdn || ''
          }

          // 检查文件栈中是否存在该文件
          const { fileStack } = globalUpload
          if (fileStack.value[fileStackKey]) {
            // 文件栈中存在，直接添加PDF解题消息
            const fileNameNew = fileStack.value[fileStackKey]?.fileName || fileName
            addUserMessage({
              type: QuestionType.PDF_SOLVE_ALL,
              value: '',
              fileStackKey: fileStackKey,
              attachments: {
                chatWithPdf: {
                  fileUrl: cdn,
                  fileName: fileNameNew,
                },
              },
            })
          } else {
            // 走URL上传流程
            const { addFileOrUrl } = useFileStagingUIStatus()
            addFileOrUrl(cdn, true, undefined, undefined, 'Chat_with_pdf')

            addUserMessage({
              type: QuestionType.PDF_SOLVE_ALL,
              fileStackKey: cdn,
              value: '',
              attachments: {
                chatWithPdf: {
                  fileUrl: '',
                  fileName: fileName,
                  needHideDownload: true,
                },
              },
            })
          }
          return
        }
      } catch (error) {
        console.error('Failed to parse extension URL params:', error)
      }
    } else {
      // 检查是否为 Canvas 页面
      try {
        const { trySniffCanvasUrlFromPage } = useCurrentWebSite()
        const canvasResult = await trySniffCanvasUrlFromPage()
        isCanvas = canvasResult.isCanvas
        canvasUrl = canvasResult.url

        if (isCanvas && canvasUrl) {
          // Canvas 页面处理 - 当作 PDF 处理
          let fileName = canvasResult.fileName || ''
          if (!fileName) {
            try {
              const u = new URL(canvasUrl)
              const lastSegment = u.pathname.substring(u.pathname.lastIndexOf('/') + 1)
              fileName = lastSegment || canvasUrl || ''
            } catch {
              fileName = canvasUrl || ''
            }
          }

          addUserMessage({
            type: QuestionType.PDF_SOLVE_ALL,
            value: '',
            fileStackKey: canvasUrl,
            attachments: {
              chatWithPdf: {
                fileUrl: canvasUrl,
                fileName: fileName,
              },
            },
          })
          return
        }
      } catch (error) {
        console.warn('Canvas detection failed, falling back to screenshot:', error)
      }

      // 普通网页处理 - 截图拼接
      // addUserMessage({
      //   type: QuestionType.PAGE_SOLVE_ALL,
      //   value: '',
      //   attachments: {
      //     page: {
      //       title: title ?? '',
      //       url: url ?? '',
      //       content: '',
      //     },
      //   },
      // })
      // return
      // 普通网页处理 - 边截边切边传
      const screenshotComposable = usePageScreenshotSingleton()

      // ⭐ 1. 创建上传管理器
      const uploadManager = new PageScreenshotUploadManager(3072, '')

      // ⭐ 2. 设置上传函数注入器（当第3个切片时自动调用）
      uploadManager.setUploadFunctionInjector(() => {
        console.log('📤 注入上传函数（由第3个切片触发）')
        uploadManager.setUploadFunction(uploadFileToS3)
      })

      // ⭐ 3. 开始流式截图（会在第3个切片时自动启动上传）
      const result = await screenshotComposable.captureWithStreamingUpload({
        uploadManager,
      })

      if (result.success && result.uploadManager) {
        const { uploadManager: manager, tileSize } = result

        const sliceCount = manager.progress.value.total

        console.log(`📸 截图完成，共 ${sliceCount} 个切片`)

        // ⭐ 4. 根据切片数决定是否上传
        if (sliceCount <= 2) {
          console.log('📦 小页面（<=2 切片），跳过上传')
          manager.markAsSkipped()
        } else {
          console.log(
            `📊 大页面（${sliceCount} 切片），已上传: ${manager.progress.value.uploaded}/${sliceCount} (${manager.progress.value.percentage}%)`
          )
        }

        // ⭐ 5. 立即添加消息（不等上传完成）
        addUserMessage({
          type: QuestionType.PAGE_SCREENSHOT_SOLVE,
          value: '',
          attachments: {
            pageScreenshot: {
              uploadManager: markRaw(manager), // ⭐ 使用 markRaw 防止 Vue 响应式转换破坏 Ref 属性
              longImage: manager.longImage,
              slices: Array(sliceCount).fill(''), // ⭐ 长度正确的占位数组，用于 MessageList 组件判断
              tileSize,
            },
          },
        })

        trackEvent.track('Plugin_sidebar_addPageSolveMessage_streamingUpload', {
          slices: sliceCount,
          uploadedDuringCapture: manager.progress.value.uploaded,
          isSmallPage: sliceCount <= 2,
        })
      }
    }
    // 确定消息类型用于埋点
    let messageType = QuestionType.PAGE_SCREENSHOT_SOLVE
    if (response?.contentType === 'application/pdf' && url && title) {
      messageType = QuestionType.PDF_SOLVE_ALL
    } else if (isCanvas && canvasUrl) {
      // 如果之前已经检测到是 Canvas 页面，直接使用 PDF 类型
      messageType = QuestionType.PDF_SOLVE_ALL
    }

    trackEvent.track('Plugin_sidebar_addPageSolveMessage', {
      type: messageType,
      url,
    })
  }

  const addPdfSolveMessage = (data: any) => {
    addUserMessage({
      type: QuestionType.PDF_SOLVE_ALL,
      value: '',
      fileStackKey: data.currentFileStackKey, // 使用URL作为fileStackKey
      attachments: {
        chatWithPdf: {
          fileUrl: data.uploadedFileUrl,
          fileName: data.fileName,
          file: data.uploadedFile,
        },
      },
    })
  }

  const addUserMessage = async (content: UserContent) => {
    const userMessage: UserMessage = {
      id: crypto.randomUUID(),
      type: MessageType.USER,
      timestamp: Date.now(),
      content,
    }

    if (!auth.isAuthenticated.value) {
      trackEvent.track('Plugin_sidebar_addUserMessage_onlogin', {
        type: content.type,
        source: content.source,
      })
      
      // 使用回调方式处理登录流程
      auth.showLoginModal(
        () => {
          // 登录成功回调：直接使用闭包中的 content
          addUserMessage(content)
        },
        () => {
          // 登录取消回调：用户取消操作，不做任何处理
        }
      )
      
      // 立即返回，不阻塞
      return
    }

    if (content.type !== QuestionType.QUIZ && !(await limitCheck())) {
      pendingUserContent.value = content
      pendingUserMessage.value = userMessage
      isOutLimit.value = true
      isOutLimitFrom.value =
        content.source === 'chatgpt'
          ? 'ChatGPT'
          : content.type === QuestionType.PHOTO || content.type === QuestionType.TEXT_SOLVE
          ? 'SingleQuestion'
          : content.type === QuestionType.TEXT
          ? 'Chat'
          : content.type === QuestionType.SUMMARY
          ? 'Summarize'
          : content.type
      return
    }

    messages.value.push(userMessage)

    // 根据消息类型和上下文决定服务消息类型
    const serviceTypeMap = {
      [QuestionType.PHOTO]: ServiceMessageType.ANSWER, // 图片均认为是解题任务
      [QuestionType.PAGE_SOLVE_ALL]: ServiceMessageType.ANSWER, // 一键解题
      [QuestionType.PAGE_SCREENSHOT_SOLVE]: ServiceMessageType.ANSWER, // 一键解题
      [QuestionType.PDF_SOLVE_ALL]: ServiceMessageType.ANSWER, // 一键解题
      [QuestionType.SUMMARY]: ServiceMessageType.SUMMARY, // 总结均认为是总结任务
      [QuestionType.QUIZ]: ServiceMessageType.QUIZ,
      [QuestionType.TEXT_SOLVE]: ServiceMessageType.ANSWER, // 新增：划词均认为是解题任务
      [QuestionType.QUOTE]: ServiceMessageType.QUOTE, // 新增：引用提问
      [QuestionType.EXPLAIN]: ServiceMessageType.EXPLAIN, // 新增：解释
      [QuestionType.HIGHLIGHT_CHAT]: ServiceMessageType.HIGHLIGHT_CHAT, // 新增：网页/PDF 划词提问
      [QuestionType.TEXT]: () => {
        // 查找最后一条服务消息
        const lastServiceMessage = findLastServiceMessage()

        if (!lastServiceMessage) {
          return ServiceMessageType.ANSWER // 首次消息默认解题
        }

        // 检查上一条服务消息的状态，如果是错误状态，则当作新的解题请求,如果是停止状态，则当作新的解题请求
        if (
          lastServiceMessage.status === MessageStatus.ERROR ||
          lastServiceMessage.status === MessageStatus.NO_CONTEXT ||
          lastServiceMessage.status === MessageStatus.PROBLEM_MISSING ||
          lastServiceMessage.status === MessageStatus.STOP
        ) {
          return ServiceMessageType.ANSWER // 错误状态时当作新的解题请求
        }

        if (
          lastServiceMessage.serviceType === ServiceMessageType.PDF_SUMMARIZE ||
          lastServiceMessage.serviceType === ServiceMessageType.PDF_SUMMARIZE_ASK
        ) {
          return ServiceMessageType.PDF_SUMMARIZE_ASK
        }

        // 检查是否支持追问
        if (FOLLOWUP_SUPPORTED_TYPES.includes(lastServiceMessage.serviceType)) {
          return ServiceMessageType.ASK // 统一返回ASK类型
        }

        // 不支持追问的类型，创建新的解题消息
        return ServiceMessageType.ANSWER
      },
      // 新增：PDF总结
      [QuestionType.PDF_SUMMARIZE]: ServiceMessageType.PDF_SUMMARIZE,
      [QuestionType.PDF_SUMMARIZE_ASK]: ServiceMessageType.PDF_SUMMARIZE_ASK,
    }

    const getServiceType = serviceTypeMap[content.type]

    // 获取服务消息类型
    const serviceType =
      typeof getServiceType === 'function' ? getServiceType() : getServiceType || ServiceMessageType.ASK

    addServiceMessage(content, serviceType)
  }

  const addServiceMessage = (userContent: UserContent, serviceType: ServiceMessageType) => {
    // 添加服务消息时，清空暂停按钮状态
    setDisabledStop(false)
    const serviceMessageId = crypto.randomUUID()

    const serviceMessage: ServiceMessage = {
      id: serviceMessageId,
      type: MessageType.SERVICE,
      serviceType,
      status: MessageStatus.PENDING,
      timestamp: Date.now(),
      userContent,
    }

    // 如果是ASK类型，添加上下文信息
    if (serviceType === ServiceMessageType.ASK) {
      const lastServiceMessage = findLastServiceMessage()
      if (lastServiceMessage && lastServiceMessage.serviceType !== ServiceMessageType.ANSWER) {
        ;(serviceMessage as any).askContext = {
          parentMessageId: lastServiceMessage.id, // 父消息ID作为sessionId
          parentMessageType: lastServiceMessage.serviceType,
          apiEndpoint: getApiEndpoint(lastServiceMessage.serviceType),
        }
      }
    }

    isResponding.value = true
    messages.value.push(processServiceMessage(serviceMessage))
  }

  const registerCancelable = (messageId: string, cancelFn: () => void) => {
    activeCancelHandler.value = cancelFn
  }

  const unregisterCancelable = (messageId: string) => {
    activeCancelHandler.value = null
  }

  const findActiveServiceMessage = (): ServiceMessage | null => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i]
      if (msg.type !== MessageType.SERVICE) continue
      if (msg.status === MessageStatus.PENDING || msg.status === MessageStatus.RESPONDING) {
        return msg
      }
    }
    return null
  }

  const cancelCurrentServiceMessage = async (): Promise<boolean> => {
    const target = findActiveServiceMessage()
    if (!target) return false

    const cancelFn = activeCancelHandler.value
    if (cancelFn) {
      try {
        cancelFn()
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Cancel service message failed:', error)
        }
      }
    } else {
      console.warn('No cancel handler registered for message:', target.id)
      return false
    }

    updateServiceMessageStatus(target.id, MessageStatus.STOP)
    unregisterCancelable(target.id)
    isResponding.value = false

    return true
  }

  const processServiceMessage = (serviceMessage: ServiceMessage): ServiceMessage => {
    switch (serviceMessage.serviceType) {
      // 追问消息相关逻辑
      // 判断是否为题目下的第一条追问
      case ServiceMessageType.ASK:
        let isFirstAsk = true
        for (let i = messages.value.length - 1; i >= 0; i--) {
          const msg = messages.value[i]
          if (msg.type === MessageType.SERVICE) {
            if (msg.serviceType === ServiceMessageType.ASK) {
              isFirstAsk = false
              break
            }
            if (msg.serviceType === ServiceMessageType.ANSWER) {
              break
            }
          }
        }
        break
    }
    return serviceMessage
  }

  const updateServiceMessageStatus = (messageId: string, status: MessageStatus) => {
    const message = messages.value.find((msg) => msg.id === messageId)
    if (message && message.type === 'service') {
      message.status = status
      isResponding.value =
        status !== MessageStatus.COMPLETED &&
        status !== MessageStatus.ERROR &&
        status !== MessageStatus.PROBLEM_MISSING &&
        status !== MessageStatus.STOP
      if (
        status === MessageStatus.COMPLETED ||
        status === MessageStatus.ERROR ||
        status === MessageStatus.PROBLEM_MISSING ||
        status === MessageStatus.STOP
      ) {
        unregisterCancelable(messageId)
      }
      if (status !== MessageStatus.PENDING && status !== MessageStatus.RESPONDING) {
        subscription.refreshBalance()
      }
    }
  }

  const clearMessages = () => {
    messages.value = []
    isResponding.value = false
    isShowExample.value = false
    isOutLimit.value = false
    isOutLimitFrom.value = ''
    pendingUserContent.value = null
    pendingUserMessage.value = null
    activeCancelHandler.value = null
  }

  const canSendMessage = computed(() => !isResponding.value)

  const showOutLimit = (value: boolean, from?: string) => {
    isOutLimit.value = value
    isOutLimitFrom.value = from || ''
  }

  const showExample = () => {
    isShowExample.value = true
  }

  // 查找最后一条服务消息
  const findLastServiceMessage = (): ServiceMessage | null => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i]
      if (
        msg.type === MessageType.SERVICE &&
        (FOLLOWUP_SUPPORTED_TYPES.includes(msg.serviceType) || msg.serviceType === ServiceMessageType.PDF_SUMMARIZE_ASK)
      ) {
        return msg
      }
    }
    return null
  }

  // 获取API端点
  const getApiEndpoint = (messageType: ServiceMessageType): string => {
    return API_ENDPOINT_MAP[messageType] || '/question/follow'
  }

  // 重试最后一条消息
  const retryLastMessage = async (): Promise<boolean> => {
    // 检查消息列表是否为空
    if (messages.value.length === 0) {
      return false
    }

    // 检查最后一条消息是否是 service message
    const lastServiceMessage = messages.value[messages.value.length - 1]
    const lastUserMessage = messages.value[messages.value.length - 2]
    if (
      !lastServiceMessage ||
      lastServiceMessage.type !== MessageType.SERVICE ||
      !lastUserMessage ||
      lastUserMessage.type !== MessageType.USER
    ) {
      return false
    }

    // 删除最后一条 service message
    messages.value.pop()
    unregisterCancelable(lastServiceMessage.id)

    if (!(await limitCheck())) {
      pendingUserContent.value = lastUserMessage.content
      pendingUserMessage.value = lastUserMessage
      isOutLimit.value = true
      messages.value.pop()
      return false
    }

    // 使用最后一条 user message 的 content 创建新的 ANSWER 类型服务消息
    addServiceMessage(lastUserMessage.content, ServiceMessageType.ANSWER)

    return true
  }

  // 移除最后一条消息并用截图重试
  const retryWithScreenshot = async (): Promise<boolean> => {
    // 检查消息列表是否为空
    if (messages.value.length === 0) {
      return false
    }

    // 检查最后一条消息是否是 service message
    const lastServiceMessage = messages.value[messages.value.length - 1]
    if (!lastServiceMessage || lastServiceMessage.type !== MessageType.SERVICE) {
      return false
    }

    // 删除最后一条 service message
    messages.value.pop()
    unregisterCancelable(lastServiceMessage.id)

    if (!(await limitCheck())) {
      isOutLimit.value = true
      return false
    }

    try {
      // 调用截图 API
      const dataUrl = await getTrpc().screenShot.query()

      // 创建图片解题的 userContent
      const screenshotContent: UserContent = {
        type: QuestionType.PHOTO,
        value: dataUrl,
        attachments: {
          image: {
            imageUrl: '',
            imageName: 'screenshot-solve',
            base64: dataUrl,
          },
        },
      }

      // 添加新的 service message
      addServiceMessage(screenshotContent, ServiceMessageType.ANSWER)

      return true
    } catch (error) {
      console.error('Screenshot capture failed:', error)
      return false
    }
  }

  return {
    messages,
    isResponding,
    isOutLimit,
    isOutLimitFrom,
    isShowExample,
    isMessageEmpty,
    pendingUserMessage,
    isFromYoutubeCheckLimit,
    // 暂停按钮禁用状态
    disabledStop,
    setDisabledStop,
    addUserMessage,
    addServiceMessage,
    addPageSolveMessage,
    addPdfSolveMessage,
    updateServiceMessageStatus,
    clearMessages,
    canSendMessage,
    limitCheck,
    showOutLimit,
    showExample,
    retryLastMessage,
    retryWithScreenshot,
    registerCancelable,
    unregisterCancelable,
    cancelCurrentServiceMessage,
    hasCancelableMessage: computed(() => activeCancelHandler.value !== null),
  }
}

export type UseMessagesReturn = ReturnType<typeof useMessages>

export default useMessages
