<template>
  <div class="flex flex-col h-full w-full relative bg-b_1 dark:bg-b_1_dk color-transition">
    <Header />
    <MessageList
      ref="messageListRef"
      :message-store="messageStore"
      :auth="auth"
    />
    <Footer
      v-if="isMutiModel"
      :message-store="messageStore"
      :auth="auth"
      @showPriceTicket="showPriceTicket"
    />
    <OldFooter
      v-else
      :message-store="messageStore"
      :auth="auth"
    />
    <AuthModal />
    <OutLimitModal
      v-if="showPaywall"
      :from="messageStore.isOutLimitFrom.value"
      @close="handleClosePaywall"
      :auth="auth"
      :show-ticket="isShowPriceTicket"
    />
    <ContentScriptUnavailableModal />
    <Toast
      ref="toastRef"
      :duration="2000"
    />
    <PrimeToast
      position="top-right"
      class="_primevue_toast"
    />
    <DragUpload />
    <PageScreenshots />
    <AdjustPoint :auth="auth" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, provide, inject } from 'vue'
import Header from './components/Header.vue'
import MessageList from './components/MessageList.vue'
import Footer from './components/Footer.vue'
import OldFooter from './components/OldFooter.vue'
import AuthModal from './components/auth/authModal.vue'
import useMessages from './composables/useMessages'
import { QuestionType } from './types/question'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import OutLimitModal from './components/OutLimitModal.vue'
import trackEvent from '~/utils/trackEvent'
import useAuth from './composables/useAuth'
import { STORAGE_KEYS, StorageSchema } from '~/types/config'
import ContentScriptUnavailableModal from './components/ContentScriptUnavailableModal.vue'
import useSubscription from './composables/useSubscription'
import { syncCloudConfig } from '~/utils/config'
import Toast from './components/Toast.vue'
import usePricingProducts from './composables/usePricingProducts'
import { Performance } from '@/utils'
import { PerformanceKeys } from '@/types'
import type { HTMLPerformanceData } from '@/types/performance'
import DragUpload from './components/fileUpload/DragUpload.vue'
import PageScreenshots from './components/PageScreenshots.vue'
import emitter from '@/utils/eventBus'
import PrimeToast from 'primevue/toast'
import { useDarkMode } from '@/composables/useDarkMode'
import useABTest from '@/composables/useABTest'
import useFileStagingUIStatus from './composables/useFileStagingUIStatus'
import useCurrentWebSite from './composables/useCurrentWebSite'
import { useQuoteManager } from '@/composables/content/useQuoteManager'
import { ThrottledTrackEvent } from '@/utils/throttledTrackEvent'
import { LatexSandboxSymbol } from '~/plugins/latex-sandbox'
import type { LatexSandboxService } from '~/services/latex-sandbox'
import AdjustPoint from './components/AdjustPoint.vue'
import { base64ToFile } from '@/utils/fileConverter'
import { completePluginTrial } from '@/api'
import { useCanvasCapture } from './composables/useCanvasCapture'

const stepQuoteManager = useQuoteManager()

const canvasCapture = useCanvasCapture()

const isShowPriceTicket = ref(false)

// 解耦 OutLimitModal：以本地状态控制显示
const showPaywall = ref(false)

const showPriceTicket = () => {
  isShowPriceTicket.value = true
  showPaywall.value = true
}

const handleClosePaywall = () => {
  showPaywall.value = false
  isShowPriceTicket.value = false
  messageStore.showOutLimit(false)
}

const abTest = useABTest()
const { isMutiModel } = abTest
provide('abTest', abTest)

const { addFileOrUrl } = useFileStagingUIStatus()

const messageStore = useMessages()
provide('messageStore', messageStore)

provide('showOutLimit', messageStore.showOutLimit)

// 🎯 Provide subscription 单例给所有子组件
provide('subscription', useSubscription)

// 🎯 MessageList ref（用于调用 addPreloadedMessage）
const messageListRef = ref<InstanceType<typeof MessageList> | null>(null)

const auth = useAuth()
provide('auth', auth)

const isAuthReady = ref(false)
const { isDark, isDarkSystem, getCurrentMode } = useDarkMode()

// 🎯 注入 LatexSandbox 服务，用于检测其就绪状态
const latexSandboxService = inject<LatexSandboxService>(LatexSandboxSymbol)

// 监听暗黑模式变化，直接操作 document.documentElement
watch(
  isDark,
  (dark) => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },
  { immediate: true }
)

// 定价信息状态管理
const { initPricingProducts, refreshPricingProducts } = usePricingProducts()

// 定时器常量
const CONFIG_SYNC_INTERVAL = 60 * 60 * 1000 // 1小时

let heartbeatInterval: number | undefined
let configSyncInterval: number | undefined
let isRefreshing = ref(false)
const hasReportedTrialCompletion = ref(false)

const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const messageListener = async (message: any) => {
  switch (message.type) {
    // 解题请求
    case SidepanelEventType.SOLVE_TO_SIDEPANEL:
      // 在 onboarding 页面第一次解题走假解题演示流程
      try {
        if (!messageStore.canSendMessage.value) {
          toastRef.value?.show('Let me finish first')
          return
        }
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (tab?.url?.split('?')[0] === import.meta.env.VITE_ONBOARDING_PAGE_URL) {
          const storage: StorageSchema = await browser.storage.local.get(STORAGE_KEYS.ONBOARDING_COMPLETED)
          if (!storage[STORAGE_KEYS.ONBOARDING_COMPLETED]) {
            messageStore.showExample()
            return
          }
        }
        if (message.data.source === 'chatgpt' && message.data.content && message.data.cutDataUrl) {
          let payload = {
            type: QuestionType.PHOTO,
            value: message.data.cutDataUrl,
            prompt: message.data.content.slice(0, 2000),
            attachments: {
              image: {
                imageUrl: '',
                imageName: 'chatgpt-image',
                base64: message.data.cutDataUrl,
              },
            },
            source: message.data.source || 'unknown',
          }
          console.log('图文解题：', payload)
          messageStore.addUserMessage(payload)
        } else {
          messageStore.addUserMessage({
            type: message.data.type || QuestionType.PHOTO,
            value: message.data.type === QuestionType.TEXT_SOLVE ? message.data.content : message.data.cutDataUrl,
            source: message.data.source || 'unknown',
          })
        }
      } catch (error) {}
      break
    case SidepanelEventType.SOLVE_ALL_TO_SIDEPANEL:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }
      messageStore.addPageSolveMessage()
      break
    // 生成 Quiz 请求
    case SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }
      messageStore.addUserMessage({
        type: QuestionType.QUIZ,
        value: `${message.data.title} Generate quiz from this page`,
        attachments: {
          pdf: {
            tabId: message.tabId,
            pdfId: message.data.pdfId,
            title: message.data.title,
            arrayBuffer:
              message.data.pdf && message.data.pdf.length > 0 ? new Uint8Array(message.data.pdf).buffer : null,
            url: message.data.url,
            error: message.data.error,
            errorMessage: message.data.errorMessage,
            size: message.data.size,
            pages: message.data.pages,
          },
        },
      })
      break
    // feature: 生成 Chat with PDF 请求 - 传输给上传暂存组件
    case SidepanelEventType.GENERATE_TO_SIDEPANEL_CHAT_WITH_PDF:
      // 检查登录状态
      if (!auth.isAuthenticated.value) {
        sendChatWithPdfSuccessMessage(message.tabId)
        auth.showLoginModal()
        return
      }
      // 检查是否为 Canvas 页面
      let canvasFileName: string | undefined
      try {
        const { trySniffCanvasUrlFromPage } = useCurrentWebSite()
        const { isCanvas, fileName: canvasName } = await trySniffCanvasUrlFromPage()

        if (isCanvas && canvasName) {
          canvasFileName = canvasName
        }
      } catch (error) {
        console.warn('Canvas detection failed:', error)
      }

      addFileOrUrl(
        message.data.url,
        false,
        () => {
          sendChatWithPdfSuccessMessage(message.tabId)
        },
        () => {
          sendChatWithPdfSuccessMessage(message.tabId)
        },
        'Chat_with_pdf',
        canvasFileName ? { fileName: canvasFileName } : undefined
      )
      break

    // 新增：接收截图图片生成（chat/summarize/quiz）
    case SidepanelEventType.GENERATE_IMAGE_TO_SIDEPANEL:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }

      // 🎯 统一的图片处理逻辑
      const handleGenerateImage = async () => {
        try {
          const payload = message.data || {}
          const action = payload.action as 'chat' | 'summarize' | 'quiz'
          const base64 = payload.base64 as string
          const userInput = (payload.userInput as string) || ''
          const fileName = (payload.fileName as string) || 'Screenshot.webp'
          const file = base64ToFile(base64, fileName, 'image/webp')

          // 1️⃣ 旧逻辑：非 SolveLayer 模式下的 chat 特殊处理
          if (!abTest.isSolveLayer.value && action === 'chat') {
            addFileOrUrl(
              file,
              false,
              () => {},
              (error: Error) => {
                console.error('Upload from screenshot failed:', error)
                toastRef.value?.show('Network error')
              },
              'Chat_Send'
            )
            return
          }

          // 2️⃣ 新逻辑：添加用户消息
          const fileStackKey = base64.slice(0, 256)

          if (action === 'chat') {
            messageStore.addUserMessage({
              type: QuestionType.PHOTO,
              value: base64,
              prompt: userInput,
              fileStackKey,
              attachments: { image: { base64, imageName: fileName } },
            })
          } else if (action === 'summarize') {
            messageStore.addUserMessage({
              type: QuestionType.PDF_SUMMARIZE,
              value: '',
              fileStackKey,
              attachments: { image: { base64 } },
            })
            trackEvent.track('Plugin_Sidebar_Uploadchat_Summarize', { fileType: 'image' })
          } else if (action === 'quiz') {
            messageStore.addUserMessage({
              type: QuestionType.QUIZ,
              value: 'Generate quiz from this Image',
              fileStackKey,
              attachments: { image: { base64, imageName: fileName } },
            })
            trackEvent.track('Plugin_Sidebar_Uploadchat_Quiz', { fileType: 'image' })
          }

          // 静默上传
          addFileOrUrl(
            file,
            true,
            () => {},
            (error: Error) => {
              console.error('Upload from screenshot failed:', error)
              toastRef.value?.show('Network error')
            },
            'Chat_Send'
          )
        } catch (error) {
          console.error('GENERATE_IMAGE_TO_SIDEPANEL error:', error)
        }
      }

      // 检查登录状态
      if (!auth.isAuthenticated.value) {
        auth.showLoginModal(
          () => {
            // 登录成功回调，执行图片处理逻辑
            handleGenerateImage()
          },
          () => {
            // 登录取消回调，什么都不做
          }
        )
        return
      }

      // 已登录，直接执行
      handleGenerateImage()
      break

    // 处理登录请求
    case SidepanelEventType.LOGIN_REQUEST_TO_SIDEPANEL:
      handleLoginRequest(message.data)
      break
    // 生成 Quizlet Quiz 请求
    case SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL_QUIZLET:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }
      messageStore.addUserMessage({
        type: QuestionType.QUIZ,
        value: 'Generate quiz from this page',
        attachments: {
          quizlet: {
            tabId: message.tabId,
            title: message.data.title,
            url: message.data.url,
          },
        },
      })
      break
    // 生成 Youtube Quiz 请求
    case SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL_YOUTUBE:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }
      messageStore.addUserMessage({
        type: QuestionType.QUIZ,
        value: 'Generate quiz from this page',
        attachments: {
          youtube: {
            title: message.data.title,
            url: message.data.url,
          },
        },
      })
      break
    // 生成 Selection Quiz 请求
    case SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL_SELECTION:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }
      messageStore.addUserMessage({
        type: QuestionType.QUIZ,
        value: message.data.content,
        attachments: {
          selection: {
            content: message.data.content,
            url: message.data.url,
            title: message.data.title,
          },
        },
      })
      break
    // 生成 Summarize 请求
    case SidepanelEventType.GENERATE_SUMMARIZE_TO_SIDEPANEL_SELECTION:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }
      messageStore.addUserMessage({
        type: QuestionType.SUMMARY,
        value: message.data.content,
        attachments: {
          selection: {
            title: message.data.title,
            content: message.data.content,
            url: message.data.url,
          },
        },
      })
      break
    // 生成 Explain 请求
    case SidepanelEventType.GENERATE_EXPLAIN_TO_SIDEPANEL_SELECTION:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }
      console.log(
        '🔍 ===== Explain =====,当前时间是',
        `${new Date().toLocaleString()}:${new Date().getMilliseconds().toString().padStart(3, '0')}`
      )
      messageStore.addUserMessage({
        type: QuestionType.EXPLAIN,
        value: message.data.content,
        attachments: {
          selection: {
            totalText: message.data.totalText,
            content: message.data.selectedText,
            url: message.data.url,
            from: message.data.from || 'unknown',
          },
        },
      })
      break
    // 生成 Chat 请求
    case SidepanelEventType.GENERATE_CHAT_TO_SIDEPANEL_SELECTION:
      stepQuoteManager.updateContext({
        allText: message.data.totalText,
        stepText: message.data.selectedText,
        stepTitleAndText: message.data.selectedText,
        from: message.data.from || 'unknown',
      })
      break
    // 处理Youtube余额不足请求
    case SidepanelEventType.YOUTUBE_OUT_LIMIT_TO_SIDEPANEL:
      // 重新检查余额状态，而不是直接显示弹窗
      handleYouTubeOutLimitRequest(message.data)
      break
    // 处理浮层余额不足请求
    case SidepanelEventType.SHOW_PAYWALL_TO_SIDEPANEL:
      handleShowPaywallFromLayer(message.data)
      break
    // YouTube 总结完成后刷新余额
    case SidepanelEventType.YOUTUBE_SUMMARY_COMPLETED_TO_SIDEPANEL:
      useSubscription.refreshBalance()
      break

    // 🎯 浮层推送消息到侧边栏
    case SidepanelEventType.LAYER_TO_SIDEPANEL_PUSH_MESSAGES:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }

      // 🎯 防重复：检查消息 ID 是否已存在
      const { userMessage, serviceMessage } = message.data

      const isDuplicate = messageStore.messages.value.some((msg: any) => msg.id === serviceMessage.id)
      if (isDuplicate) return
      // 🎯 检查 LatexSandbox 是否 ready
      if (latexSandboxService && !latexSandboxService.isReady.value) {
        console.log('[Sidepanel] LatexSandbox not ready, waiting...')
        // 等待 LatexSandbox ready 后再处理消息
        const unwatch = watch(
          () => latexSandboxService.isReady.value,
          (isReady) => {
            if (isReady) {
              console.log('[Sidepanel] LatexSandbox ready, processing layer messages')
              try {
                // 🎯 推送消息到列表
                messageStore.messages.value.push(userMessage)
                messageStore.messages.value.push(serviceMessage)

                // 🎯 立即缓存预加载数据（关键：必须在 push 后立即调用）
                // 原因：Vue 渲染是异步的，如果不立即缓存，UnifiedMessageActions 会读取不到数据
                messageListRef.value?.addPreloadedMessage(serviceMessage)
              } catch (error) {
                console.error('[Sidepanel] Failed to handle layer messages:', error)
                toastRef.value?.show('Failed to add messages')
              }
              unwatch() // 停止监听
            }
          }
        )
        return
      }

      // LatexSandbox 已 ready 或不存在，直接处理
      try {
        // 🎯 推送消息到列表
        messageStore.messages.value.push(userMessage)
        messageStore.messages.value.push(serviceMessage)

        // 🎯 立即缓存预加载数据（关键：必须在 push 后立即调用）
        // 原因：Vue 渲染是异步的，如果不立即缓存，UnifiedMessageActions 会读取不到数据
        messageListRef.value?.addPreloadedMessage(serviceMessage)
      } catch (error) {
        console.error('[Sidepanel] Failed to handle layer messages:', error)
        toastRef.value?.show('Failed to add messages')
      }
      break

    // 🎯 激活 Quote Staging 组件
    case SidepanelEventType.ACTIVATE_QUOTE_STAGING:
      if (!messageStore.canSendMessage.value) {
        toastRef.value?.show('Let me finish first')
        return
      }

      // 🎯 检查 LatexSandbox 是否 ready（和消息推送逻辑一致）
      if (latexSandboxService && !latexSandboxService.isReady.value) {
        console.log('[Sidepanel] LatexSandbox not ready, delaying quote activation...')
        // 等待 LatexSandbox ready 后再激活 Quote
        const unwatch = watch(
          () => latexSandboxService.isReady.value,
          (isReady) => {
            if (isReady) {
              console.log('[Sidepanel] LatexSandbox ready, activating quote now')
              try {
                const { highlighted_text, context, from } = message.data

                stepQuoteManager.updateContext({
                  allText: context,
                  stepText: highlighted_text,
                  stepTitleAndText: highlighted_text,
                  from: from || 'layer',
                })
              } catch (error) {
                console.error('[Sidepanel] Failed to activate quote staging:', error)
                toastRef.value?.show('Failed to process quote')
              }
              unwatch()
            }
          }
        )
        return
      }

      // LatexSandbox 已 ready，直接处理
      try {
        const { highlighted_text, context, from } = message.data

        // 唤醒 quote staging 组件（和 chat 链路一样）
        stepQuoteManager.updateContext({
          allText: context,
          stepText: highlighted_text,
          stepTitleAndText: highlighted_text,
          from: from || 'layer',
        })
      } catch (error) {
        console.error('[Sidepanel] Failed to activate quote staging:', error)
        toastRef.value?.show('Failed to process quote')
      }
      break

    // 检查侧边栏是否正在解题
    case SidepanelEventType.CHECK_SIDEPANEL_SOLVING:
      try {
        const isSolving = !messageStore.canSendMessage.value
        browser.runtime
          .sendMessage({
            type: SidepanelEventType.CHECK_SIDEPANEL_SOLVING_RESPONSE,
            data: {
              isSolving,
              requestId: message.data?.requestId,
            },
          })
          .catch((err) => {
            console.error('[Sidepanel] Failed to send solving status response:', err)
          })
      } catch (error) {
        console.error('[Sidepanel] Failed to check solving status:', error)
      }
      break
    case SidepanelEventType.CANVAS_CAPTURE_COMPLETE:
      await canvasCapture.receiveCaptureData(message.data)
      break
  }
}

// 处理登录请求
const handleLoginRequest = async (data: any) => {
  console.log('[Sidepanel] 处理登录请求:', data)

  // 检查当前登录状态
  const isLoggedIn = await auth.getAuthStatus()

  if (isLoggedIn) {
    // 已登录，直接通知content script
    notifyLoginSuccess(data)
  } else {
    // 未登录，显示登录弹窗，并传入回调
    auth.showLoginModal(
      () => {
        // 登录成功回调：通知 content script，原样返回 data
        console.log('[Sidepanel] 登录成功，通知 content script:', data)
        notifyLoginSuccess(data)
      },
      () => {
        // 取消登录回调（可选）
        console.log('[Sidepanel] 用户取消登录')
      }
    )
  }
}

// 通知content script登录成功
const notifyLoginSuccess = (originalData: any) => {
  browser.runtime.sendMessage({
    type: SidepanelEventType.LOGIN_SUCCESS_TO_CONTENT,
    data: originalData,
  })
}

// 处理YouTube余额不足请求
const handleYouTubeOutLimitRequest = async (data: any) => {
  // 记录埋点
  trackEvent.track('Plugin_Sidebar_Youtube_Out_Limit_Request', {
    videoId: data?.videoId || '',
    source: data?.source || 'youtube-panel',
  })

  // 重新检查余额状态
  const isLimit = await messageStore.limitCheck()

  if (!isLimit) {
    // 如果余额不足，显示三包弹窗
    messageStore.showOutLimit(true, 'YouTube')
    messageStore.isFromYoutubeCheckLimit.value = true
  }
}

// 处理浮层余额不足请求
const handleShowPaywallFromLayer = async (data: any) => {
  if (data?.from === 'model') {
    messageStore.showOutLimit(true, data?.from)
    return
  }
  // 先刷新余额，确保数据最新
  await useSubscription.refreshBalance()
  // 重新检查余额状态
  const isLimit = await messageStore.limitCheck()
  if (!isLimit) {
    // 如果余额不足，显示付费弹窗
    messageStore.showOutLimit(true, data?.from || 'Layer')
  }
}

// 带重试机制的订阅刷新函数
const refreshSubscriptionWithRetry = async (maxRetries: number = 3): Promise<void> => {
  if (isRefreshing.value) {
    return
  }

  isRefreshing.value = true
  let retryCount = 0

  const tryRefresh = async (): Promise<void> => {
    try {
      await useSubscription.refreshSubscription()
      await refreshPricingProducts()

      // 检查订阅状态
      if (useSubscription.isSubscribed.value) {
        // 🎯 新增：订阅成功后调用试用完成接口（仅调用一次）
        if (!hasReportedTrialCompletion.value) {
          try {
            await completePluginTrial()
            hasReportedTrialCompletion.value = true
            console.log('[Plugin Trial] Trial completion recorded successfully')
          } catch (error) {
            // 静默失败，不影响主流程
            console.error('[Plugin Trial] Failed to record trial completion:', error)
          }
        }
        return // 成功，退出
      }

      // 如果还有重试机会
      if (retryCount < maxRetries) {
        retryCount++
        return new Promise((resolve) => {
          setTimeout(() => {
            tryRefresh().then(resolve).catch(resolve)
          }, 1000)
        })
      }
    } catch (error) {
      // 即使出错也继续重试逻辑
      if (retryCount < maxRetries) {
        retryCount++
        return new Promise((resolve) => {
          setTimeout(() => {
            tryRefresh().then(resolve).catch(resolve)
          }, 1000)
        })
      }
    }
  }

  try {
    await tryRefresh()
  } finally {
    isRefreshing.value = false
  }
}

// 监听登录状态变化，处理登录成功后的逻辑
watch(
  () => auth.isAuthenticated.value,
  (newValue, oldValue) => {
    // 从未登录变为已登录时，处理登录成功逻辑
    if (!oldValue && newValue) {
      // 检查是否有待处理的登录请求
      const pendingRequest = sessionStorage.getItem('pendingLoginRequest')
      if (pendingRequest) {
        try {
          const data = JSON.parse(pendingRequest)
          // 清除待处理的请求
          sessionStorage.removeItem('pendingLoginRequest')
          // 通知content script登录成功
          notifyLoginSuccess(data)
        } catch (error) {
          console.error('解析待处理登录请求失败:', error)
        }
      }

      // 登录成功后刷新定价信息
      refreshPricingProducts()
    }
  }
)

watch(
  () => messageStore.isOutLimit.value,
  (newValue, oldValue) => {
    // 同步到本地显示状态
    showPaywall.value = !!newValue
    if (!oldValue && newValue) {
      if (messageStore.isOutLimitFrom.value === 'model') {
        return
      }
      toastRef.value?.show(
        messageStore.isOutLimitFrom.value === 'NO_FC_SUBSCRIPTION_PLAN'
          ? "You've used up all your free credits"
          : "You've used all your free solves today"
      )
    }
  }
)

// 监听订阅状态变化，如果订阅有变化就关闭付费弹窗
watch(
  () => useSubscription.isSubscribed.value,
  (newValue, oldValue) => {
    // 从未订阅变为已订阅时，关闭付费弹窗
    if (!oldValue && newValue && showPaywall.value) {
      handleClosePaywall()
    }
  }
)

const visibilityChangeListener = () => {
  if (document.visibilityState === 'visible') {
    if (isAuthReady.value) {
      browser.runtime.sendMessage({
        type: SidepanelEventType.READY,
      })
      ThrottledTrackEvent.track('Plugin_sidebar_show')
    }
  } else {
    browser.runtime.sendMessage({
      type: SidepanelEventType.CLOSED,
    })
    ThrottledTrackEvent.track('Plugin_sidebar_close')
  }
}

const handleTabChange = async (tabId: number, changeInfo: any) => {
  if (changeInfo.url && !changeInfo.url.startsWith('chrome://')) {
    // 订阅成功时刷新订阅状态（带重试机制）
    if (changeInfo.url.startsWith(import.meta.env.VITE_STRIPE_SUCCESS_URL) && auth.isAuthenticated.value) {
      await refreshSubscriptionWithRetry(3)
    }
  }
}

const performanceReport = async () => {
  const htmlData = (window as any).__PERFORMANCE_DATA__ as HTMLPerformanceData
  if (htmlData) {
    Performance.recordFromHTML(htmlData)
  }
  await Performance.reportFromNonBackground()
}

const sendChatWithPdfSuccessMessage = async (tabId?: number) => {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (tab?.id) {
      browser.tabs.sendMessage(tabId || tab.id, {
        type: SidepanelEventType.CHAT_WITH_PDF_UPLOAD_SUCCESS,
      })
    }
  } catch (error) {}
}

onMounted(() => {
  // 第一次挂载的时候如果是auto模式，则发送埋点
  ;(async () => {
    const currentMode = await getCurrentMode()
    if (currentMode === 'auto') {
      trackEvent.track('Plugin_Settings_Appearance_Default', {
        theme: isDarkSystem.value ? 'dark' : 'light',
      })
    }
  })()
  // 开始组件渲染统计
  Performance.mark(PerformanceKeys.SIDEPANEL_COMPONENT_RENDER)

  // 添加消息监听器
  browser.runtime.onMessage.addListener(messageListener)

  // 开始认证状态检查统计
  Performance.mark(PerformanceKeys.SIDEPANEL_AUTH_CHECK)

  auth.getAuthStatus().then((isAuthenticated) => {
    // 完成认证状态检查统计
    Performance.measure(PerformanceKeys.SIDEPANEL_AUTH_CHECK)

    // 再次发送 READY（容错），保证后台处理挂起任务
    browser.runtime.sendMessage({
      type: SidepanelEventType.READY,
    })
    isAuthReady.value = isAuthenticated

    if (isAuthenticated) {
      // 开始订阅状态初始化统计
      Performance.mark(PerformanceKeys.SIDEPANEL_SUBSCRIPTION_INIT)
      useSubscription.refreshSubscription().then(() => {
        // 完成订阅状态初始化统计
        Performance.measure(PerformanceKeys.SIDEPANEL_SUBSCRIPTION_INIT)
      })
      useSubscription.refreshBalance()

      // 开始定价信息初始化统计
      Performance.mark(PerformanceKeys.SIDEPANEL_PRICING_INIT)

      // 初始化定价信息
      initPricingProducts().then(() => {
        // 完成定价信息初始化统计
        Performance.measure(PerformanceKeys.SIDEPANEL_PRICING_INIT)

        // 延迟上报性能数据，确保所有统计完成
        setTimeout(performanceReport, 1000)
      })
    } else {
      setTimeout(performanceReport, 1000)
    }
  })

  // 开始事件监听器设置统计
  Performance.mark(PerformanceKeys.SIDEPANEL_EVENT_LISTENERS)

  // 监听显示状态变化
  document.addEventListener('visibilitychange', visibilityChangeListener)

  // 启动心跳定时器
  heartbeatInterval = window.setInterval(() => {
    browser.runtime.sendMessage({ type: 'SIDEPANEL:HEARTBEAT' })
  }, 3000)

  chrome.tabs.onUpdated.addListener(handleTabChange)

  // 启动配置同步定时器 - 每小时执行一次
  configSyncInterval = window.setInterval(async () => {
    await syncCloudConfig()
  }, CONFIG_SYNC_INTERVAL)

  // 立即执行一次配置同步
  syncCloudConfig()

  trackEvent.track('Plugin_sidebar_mounted')

  // 完成组件渲染统计
  Performance.measure(PerformanceKeys.SIDEPANEL_COMPONENT_RENDER)

  emitter.on('upload-cancel', () => {
    sendChatWithPdfSuccessMessage()
  })
})

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(messageListener)
  document.removeEventListener('visibilitychange', visibilityChangeListener)
  // Canvas 抓取清理
  canvasCapture.cleanup()
  // 清除心跳定时器
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = undefined
  }
  // 清除配置同步定时器
  if (configSyncInterval) {
    clearInterval(configSyncInterval)
    configSyncInterval = undefined
  }
  // 停止可能正在进行的订阅刷新重试
  isRefreshing.value = false
  chrome.tabs.onUpdated.removeListener(handleTabChange)
  emitter.off('upload-cancel')

  // 清理性能统计数据
  Performance.clearMetrics()

  trackEvent.track('Plugin_sidebar_unmounted')
})
</script>

<style scoped lang="less">
:global(._primevue_toast) {
  line-height: 20px;
  transform: translateY(43px);
  --p-toast-width: 322px;
  --p-toast-error-detail-color: #f30a34;
  --p-toast-error-color: #f30a34;
  --p-toast-border-radius: 12px;
  --p-toast-content-padding: 12px;
  --p-toast-content-gap: 6px;
  --p-toast-icon-size: 20px;
  --p-toast-text-gap: 6px;
  --p-toast-summary-font-weight: 400;
  --p-toast-summary-font-size: 14px;
  --p-toast-detail-font-weight: 400;
  --p-toast-detail-font-size: 14px;
  --p-toast-close-button-width: 20px;
  --p-toast-close-button-height: 20px;
  --p-toast-close-icon-size: 12px;
  --p-toast-blur: 0px;
  --p-toast-error-background: #fff3f3;
}
</style>
