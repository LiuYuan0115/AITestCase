<template>
  <footer class="p-4 pt-0 flex flex-col gap-[8px] w-full z-100">
    <FooterFloatModal
      v-if="!shouldHideFloatModal"
      :messageStore="messageStore"
    />
    <!-- 第一行按钮 -->
    <div class="flex gap-[8px]">
      <Button
        icon="cut"
        type="submit"
        class="p-[0_12px_0_10px] dark:text-s-border"
        @click="handleCrop"
        >Crop</Button
      >
      <Button
        icon="sidepanel/book"
        class="rounded-[16px] px-[12px] border border-s-border-secondary dark:border-s-border-secondary-dark"
        textColorClass="text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark"
        @click="handleChat"
        >Webpage Chat</Button
      >
      <!-- <FooterDeepSearch :messageStore="messageStore" /> -->
      <Button
        icon="clean"
        class="w-[32px] rounded-[16px] border border-s-border-secondary dark:border-s-border-secondary-dark"
        textColorClass="text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark"
        @click="handleClear"
        v-tooltip.top="'Clear'"
      />
    </div>
    <!-- 输入框 -->
    <div
      class="relative w-full border border-s-text-brand dark:border-s-text-brand-dark duration-200 transition-colors rounded-[16px] p-[11px]"
    >
      <!-- 文件上传组件 -->
      <FileStaging
        ref="fileStagingRef"
        @onSolve="handleSolve"
        @onSummarize="handleSummarize"
        @onQuiz="handleQuiz"
      />
      <QuoteStaging />
      <!-- 输入框 -->
      <div
        class="w-full pb-0 transition-[height] duration-300 ease-in-out"
        :style="{ height: textareaHeight + 'px' }"
      >
        <textarea
          ref="textareaRef"
          v-model="inputValue"
          :class="[
            'w-full h-full outline-none text-[14px] leading-[1.4] font-normal text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark placeholder:text-s-text-low-emphasis dark:placeholder:text-s-text-low-emphasis-dark bg-b_1 dark:bg-b_1_dk resize-none p-0 transition-colors duration-200',
            actualLines > 4 ? 'overflow-y-auto' : 'overflow-hidden',
          ]"
          placeholder="Ask me any questions"
          @keydown="onTextareaKeydown"
          @input="adjustTextareaHeight"
          @paste="handlePaste"
        />
      </div>
      <!-- 底部操作栏 -->
      <div class="w-full flex items-center justify-between pt-1">
        <OldUploadButton @click="handleUploadButtonClick" />
        <div class="flex items-center gap-[8px]">
          <button
            v-if="canStop"
            class="w-[20px] h-[20px] flex items-center justify-center rounded-full transition-colors duration-200 bg-s-text-brand dark:bg-s-text-brand-dark hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark text-s-interface-bg"
            :class="disabledStop ? '!bg-[#C4C6C9] cursor-not-allowed' : ''"
            :disabled="disabledStop"
            @click="handleStop"
            aria-label="Stop current response"
          >
            <span class="w-2 h-2 bg-current rounded-[2px]"></span>
          </button>
         <button
            v-else
            class="w-[20px] h-[20px] flex items-center justify-center color-transition rounded-full"
            :class="
              canSendButton
                ? 'bg-b_brand dark:bg-b_brand_dk hover:bg-b_brand_hov dark:hover:bg-b_brand_hov_dk text-t_btn dark:text-t_btn_dk'
                : 'bg-b_btn_dis dark:bg-b_btn_dis_dk text-t_btn_dis dark:text-t_btn_dis_dk'
            "
            :disabled="!canSendButton"
            @click="handleSend"
            aria-label="Send message"
          >
            <SvgIcon
              name="send"
              size="20"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- hover upgrade 按钮，弹出付费弹窗 -->
    <div
      v-if="!isSubscribed && auth.isAuthenticated.value"
      class="relative flex items-center justify-start group w-[81px]"
      @mouseenter="showUpgradePopup = true"
      @mouseleave="showUpgradePopup = false"
    >
      <img
        src="@/assets/images/sidepanel/upgrade-button.webp"
        class="w-[81px] h-[20px] cursor-pointer"
      />

      <div
        class="absolute bottom-2 w-20 h-10 group-hover:opacity-100 group-hover:block opacity-0 hidden transition-opacity duration-300"
      ></div>
      <transition name="fade">
        <UpgradePopup :auth="auth" v-if="showUpgradePopup" />
      </transition>
    </div>
    <!-- Toast 提示 -->
    <Toast ref="toastRef" :duration="2500" />
  </footer>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import Button from '@/components/common/Button.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import Toast from './Toast.vue'
import UpgradePopup from './business/UpgradePopup.vue'
import FooterFloatModal from './footer/FooterFloatModal.vue'
import contentScriptChecker from '../composables/useContentScriptChecker'
import useAuth from '../composables/useAuth'
import useMessages from '../composables/useMessages'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import { QuestionType } from '../types/question'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import trackEvent from '~/utils/trackEvent'
import { Performance } from '@/utils'
import { PerformanceKeys } from '@/types'
import FileStaging from './fileUpload/FileStaging.vue'
import OldUploadButton from './fileUpload/OldUploadButton.vue'
import emitter from '@/utils/eventBus'
import { useToast } from 'primevue/usetoast'
import { ErrorMessage, ErrorType } from '../types/message'
import { usePasteHandler } from '../composables/usePasteHandler'
import useCurrentWebsite from '../composables/useCurrentWebSite'
import useFileStagingUIStatus from '../composables/useFileStagingUIStatus'
import { useRetrieveStore } from '../composables/useRetrieveStore'
import globalUpload from '../composables/useGlobalUpload'
import { useDarkMode } from '@/composables/useDarkMode'
import { getConfigValue } from '~/utils/config'
import QuoteStaging from './quote/QuoteStaging.vue'
import { useQuoteStaging } from '@/entrypoints/sidepanel/composables/useQuoteStaging'
import { useQuoteManager } from '@/composables/content/useQuoteManager'
import { usePageScreenshotSingleton } from '../composables/usePageScreenshot'
import { PageScreenshotUploadManager } from '~/utils/PageScreenshotUploadManager'
import { uploadFileToS3 } from '~/utils/fileUpload'
import { markRaw } from 'vue'

const { startStoreProcessByFileStackKey } = useRetrieveStore()
const { handleSummarizePage, handleQuizPage, trySniffCanvasUrlFromPage } =
  useCurrentWebsite()
const {
  stagingFileInfo,
  stagingStatus,
  stagingType,
  clearStaging,
  addWebPage,
  addFileOrUrl,
  createFilePicker,
  currentFileStackKey,
} = useFileStagingUIStatus()

// 获取 QuoteStaging 实例来检查引用文本状态
const { quoteText, quoteIsShow } = useQuoteStaging()

// 获取 StepQuote 管理器来获取 8k 上下文
const stepQuoteManager = useQuoteManager()

const props = defineProps<{
  messageStore: ReturnType<typeof useMessages>
  auth: ReturnType<typeof useAuth>
}>()
const { isDark } = useDarkMode()
const toastPrime = useToast()
const inputValue = ref('')
const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const actualLines = ref(1) // 实际行数
const {
  addUserMessage,
  canSendMessage,
  clearMessages,
  addPdfSolveMessage,
  addPageSolveMessage,
  cancelCurrentServiceMessage,
  hasCancelableMessage,
  disabledStop,
} = props.messageStore
const { isSubscribed } = useSubscription
const showUpgradePopup = ref(false)
const fileStagingRef = ref<InstanceType<typeof FileStaging> | null>(null)

// 临时存储一个当前的会话id
const currentSessionId = ref('')

//TODO: 1.用户点击了summarize按钮2.只有在文件暂存区是pdf文件的情况下，并且用户在输入框当中输入文字，才会生成一个会话id，并存入currentSessionId
// 然后这两个时机只要一个触发了就调用startStoreProcessByFileStackKey函数，传入fileStackKey和body和sessionId，不重复调用，只调用一次

// 新增：判断 send 按钮是否可用的计算属性
const canSendButton = computed(() => {
  if (stagingStatus.value === 'uploading') return false

  // 检查是否有引用文本且输入框有内容
  const hasQuoteText =
    quoteIsShow.value && quoteText.value && quoteText.value.trim()
  const hasInputText = inputValue.value.trim()

  // 如果有引用文本，必须同时有输入框文字才能发送
  if (hasQuoteText && !hasInputText) {
    return false
  }

  // 如果输入框有文字，可以发送
  if (hasInputText) {
    return true
  }

  // 如果文件暂存区有图片且没有引用文本，可以发送
  if (
    stagingStatus.value === 'loaded' &&
    stagingType.value === 'image' &&
    !hasQuoteText
  ) {
    return true
  }

  return false
})

const canStop = computed(() => hasCancelableMessage.value)

// 判断是否处于empty组件显示状态
const isEmptyState = computed(() => {
  const messages = props.messageStore.messages.value
  const isShowExample = props.messageStore.isShowExample?.value
  const isShowSubscriptionMessage =
    !!props.messageStore.pendingUserMessage?.value
  return !isShowExample && messages.length === 0 && !isShowSubscriptionMessage
})

// 控制 FooterFloatModal 显示的逻辑
const shouldHideFloatModal = computed(() => {
  // empty组件显示时也隐藏FooterFloatModal
  if (isEmptyState.value) return true
  const fileInfo = stagingFileInfo.value
  // 网页模式时也隐藏FooterFloatModal
  if (fileInfo && fileInfo.webUrl) return true
  if (!fileInfo) return false
  if (fileInfo.uploadStatus !== 'empty') return true
  return false
})

// 粘贴处理器（带登录检查）
const { handlePaste } = usePasteHandler({
  onFilePaste: async (file: File) => {
    if (!props.auth.isAuthenticated.value) {
      // 记录待处理动作，弹出登录框
      pendingAction.value = () =>
        addFileOrUrl(file, false, undefined, undefined, 'Upload_Paste')
      props.auth.showLoginModal()
      return
    }
    addFileOrUrl(file, false, undefined, undefined, 'Upload_Paste')
    // Plugin_Sidebar_FileUpload_Paste
    trackEvent.track('Plugin_Sidebar_FileUpload_Paste')
  },
  onError: (error: Error) => {
    toastRef.value?.show(error.message)
  },
})

// 根据行数计算高度的计算属性
const textareaHeight = computed(() => {
  if (actualLines.value <= 2) return 40
  if (actualLines.value === 3) return 60
  if (actualLines.value === 4) return 80
  return 80 // 超过4行保持80px
})
// 调整文本框高度的函数
const adjustTextareaHeight = () => {
  if (!textareaRef.value) return

  // 临时设置高度为auto以获取真实的scrollHeight
  const originalHeight = textareaRef.value.style.height
  textareaRef.value.style.height = 'auto'

  // 计算行数（每行约20px）
  const lineHeight = 20
  const scrollHeight = textareaRef.value.scrollHeight
  const lines = Math.ceil(scrollHeight / lineHeight)

  // 更新实际行数
  actualLines.value = lines

  // 恢复原始高度
  textareaRef.value.style.height = originalHeight
}

// 监听输入框内容变化，当内容为空时自动重置高度
watch(inputValue, (newValue) => {
  if (newValue === '') {
    actualLines.value = 1
  }
})

watch(showUpgradePopup, (newVal) => {
  if (newVal) {
    trackEvent.track('Plugin_Sidebar_Upgrade_Show')
  } else {
    trackEvent.track('Plugin_Sidebar_Upgrade_Close')
  }
})

const handleSend = () => {
  if (!canSendButton.value) return // 按钮不可用直接返回

  if (!canSendMessage.value) {
    toastRef.value?.show('Let me finish first')
    return
  }

  // 检查是否有引用文本
  const hasQuoteText =
    quoteIsShow.value && quoteText.value && quoteText.value.trim()
  const hasInputText = inputValue.value.trim()

  // 如果有引用文本且有输入框文字，处理引用提问
  if (hasQuoteText && hasInputText) {
    handleQuotePrompt()
    return
  }

  // 文件暂存区有图片，输入框没内容，直接走 handleImageSolve
  if (
    stagingStatus.value === 'loaded' &&
    stagingType.value === 'image' &&
    !hasInputText
  ) {
    handleImageSolve()
    clearStaging()
    return
  }

  // 如果没有输入内容且没有文件暂存，不允许发送
  if (!hasInputText && stagingStatus.value === 'empty') {
    return
  }

  const value = inputValue.value.trim()

  // 根据文件暂存区状态和类型处理不同的发送逻辑
  if (stagingStatus.value === 'empty') {
    // 纯文本消息
    handleNormalText(value)
  } else if (stagingType.value === 'pdf') {
    // PDF + 文本
    handlePdfPrompt(value)
  } else if (stagingType.value === 'image') {
    // 图片 + 文本
    handleImagePrompt(value)
  } else if (stagingType.value === 'web') {
    // 网页截图 + 文本
    handleWebpagePrompt(value)
  }

  // 文件暂存区清空，认为是一次任务，而不是暂存挂起
  clearStaging()
}

const handleStop = async () => {
  if (!canStop.value) return
  trackEvent.track('Plugin_Sidebar_Stop')
  const stopped = await cancelCurrentServiceMessage()
  if (stopped) {
    // trackEvent.track('Plugin_sidebar_stop')
    toastRef.value?.show('User Canceled')
  } 
}

// ESC监听状态
const isListeningForEsc = ref(false)
let escListener: ((e: KeyboardEvent) => void) | null = null

const handleCrop = contentScriptChecker.withContentScriptCheck(async () => {
  if (!canSendMessage.value) {
    toastRef.value?.show('Let me finish first')
    return
  }
  try {
    // 获取当前活动标签页
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.id) {
      trackEvent.track('Plugin_sidebar_crop_no_tab')
      return
    }

    // 检查是否为扩展页面
    const isExtensionPage =
      tab.url?.startsWith('chrome-extension://') &&
      tab.url?.includes('pdfView.html')
    if (isExtensionPage) {
      // 如果是扩展页面，发送消息给扩展页面
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: 'TRIGGER_SCREENSHOT',
        })
      } catch (error) {
        console.error(error)
      }
    } else {
      // 如果是普通网页，发送消息到内容脚本
      await browser.tabs.sendMessage(tab.id, {
        type: SidepanelEventType.SHOW_SCREENSHOT,
      })
      trackEvent.track('Plugin_sidebar_crop')

      // 启动ESC监听，转发ESC事件到内容脚本
      startEscListener(tab.id)
    }
  } catch (error) {
    trackEvent.trackError('Plugin_sidebar_crop_error', error)
  }
})

// 启动ESC监听
const startEscListener = (tabId: number) => {
  if (isListeningForEsc.value) return

  isListeningForEsc.value = true
  escListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // 转发ESC事件到内容脚本
      browser.tabs
        .sendMessage(tabId, {
          type: SidepanelEventType.CANCEL_SCREENSHOT,
        })
        .catch((error) => {
          console.error('Failed to send cancel screenshot message:', error)
        })

      // 停止监听
      stopEscListener()
    }
  }

  document.addEventListener('keydown', escListener)
}

// 停止ESC监听
const stopEscListener = () => {
  if (escListener) {
    document.removeEventListener('keydown', escListener)
    escListener = null
  }
  isListeningForEsc.value = false
}

// 记录未登录时的待处理动作
const pendingAction = ref<null | (() => void)>(null)

// 监听登录状态变化，自动执行pendingAction
watch(
  () => props.auth.isAuthenticated.value,
  (newVal) => {
    if (newVal && pendingAction.value) {
      pendingAction.value()
      pendingAction.value = null
    }
  }
)

const handleChat = contentScriptChecker.withContentScriptCheck(async () => {
  if (!props.auth.isAuthenticated.value) {
    // 记录待处理动作，弹出登录框
    pendingAction.value = () => handleChat()
    props.auth.showLoginModal()
    return
  }
  if (!canSendMessage.value) {
    toastRef.value?.show('Let me finish first')
    return
  }
  try {
    // 1. 获取当前标签页信息
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (!tab?.id || !tab.url || !tab.title) {
      console.error('No active tab or missing tab info')
      return
    }

    // 2. 检查是否为扩展页面，并解析URL参数
    if (tab.url.startsWith('chrome-extension://')) {
      try {
        const url = new URL(tab.url)
        const cdn = url.searchParams.get('cdn')
        const fileStackKey = url.searchParams.get('fileStackKey')

        // 如果有cdn和fileStackKey参数，检查文件栈中是否存在该文件
        if (cdn && fileStackKey) {
          trackEvent.track('Plugin_Sidebar_Webpagechat', {
            type: 'extension',
          })
          // 检查文件栈中是否存在该文件
          if (globalUpload.fileStack.value[fileStackKey]) {
            // 文件栈中存在，设置当前的key
            // 🔧 关闭 QuoteStaging（与文件上传互斥）
            emitter.emit('close-quote-staging')
            currentFileStackKey.value = fileStackKey
            return
          } else {
            // 文件栈中不存在，将cdn当作网页URL处理
            addFileOrUrl(cdn, false, undefined, undefined, 'Chat_with_pdf')
            return
          }
        }
      } catch (error) {
        console.error('Failed to parse extension URL params:', error)
      }
    }
    // Canvas PDF 检测：复用 useCurrentWebsite 内的解析逻辑
    const { isCanvas, url, fileName } = await trySniffCanvasUrlFromPage()
    if (isCanvas && url) {
      trackEvent.track('Plugin_Sidebar_Webpagechat', { type: 'pdf-canvas' })
      addFileOrUrl(url, false, undefined, undefined, 'Chat_with_pdf', {
        fileName: fileName || undefined,
      })
      return
    }

    // 3. 获取页面内容类型
    const response = await browser.tabs.sendMessage(tab.id, {
      type: SidepanelEventType.GET_PAGE_CONTENT_TYPE,
    })

    // 4. 判断是否为PDF
    const isPdf = response?.contentType === 'application/pdf'

    // 如果是PDF，直接调用上传PDF
    if (isPdf) {
      trackEvent.track('Plugin_Sidebar_Webpagechat', {
        type: 'pdf',
      })
      addFileOrUrl(tab.url, false, undefined, undefined, 'Chat_with_pdf')
      return
    }

    // 5. 使用流式截图显示页面信息到FileStaging
    const screenshotComposable = usePageScreenshotSingleton()

    // ⭐ 1. 创建上传管理器
    const uploadManager = new PageScreenshotUploadManager(3072, '')

    // ⭐ 2. 设置上传函数注入器（当第3个切片时自动调用）
    uploadManager.setUploadFunctionInjector(() => {
      console.log('📤 [OldFooter handleChat] 注入上传函数（由第3个切片触发）')
      uploadManager.setUploadFunction(uploadFileToS3)
    })

    // ⭐ 3. 开始流式截图（会在第3个切片时自动启动上传）
    const result = await screenshotComposable.captureWithStreamingUpload({
      uploadManager,
    })

    if (result.success && result.uploadManager) {
      const { uploadManager: manager, tileSize } = result
      const sliceCount = manager.progress.value.total

      console.log(`📸 [OldFooter handleChat] 截图完成，共 ${sliceCount} 个切片`)

      // ⭐ 4. 根据切片数决定是否上传
      if (sliceCount <= 2) {
        console.log('📦 [OldFooter handleChat] 小页面（<=2 切片），跳过上传')
        manager.markAsSkipped()
      } else {
        console.log(
          `📊 [OldFooter handleChat] 大页面（${sliceCount} 切片），已上传: ${manager.progress.value.uploaded}/${sliceCount}`
        )
      }

      // ⭐ 5. 构建 imageSlices（与 addPageSolveMessage 一致的结构）
      const imageSlices = {
        uploadManager: markRaw(manager),
        longImage: manager.longImage,
        slices: Array(sliceCount).fill(''),
        tileSize,
      }

      addWebPage({
        webUrl: tab.url,
        webName: tab.title,
        imageSlices,
      })
    }

    textareaRef.value?.focus()

    trackEvent.track('Plugin_Sidebar_Webpagechat', {
      type: 'web',
    })
  } catch (error) {
    trackEvent.trackError('Plugin_sidebar_webpage_chat_error', error)
  }
})

const handleClear = () => {
  stepQuoteManager.clearContext()
  clearMessages()
  trackEvent.track('Plugin_sidebar_clear')
}

//FIXME: 当还在输入法当中按了enter键，会直接发送
function onTextareaKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// ============================== 处理不同类型的消息 ==============================
// ======================Quote===============================
const handleQuotePrompt = async () => {
  const currentContext = stepQuoteManager.getCurrentContext()
  if (!currentContext) return

  const sliceValue =
    inputValue.value.length > 250
      ? inputValue.value.slice(0, 250)
      : inputValue.value

  trackEvent.track('Plugin_Sidebar_Quote_Send', {
    from: currentContext!.from,
  })

  // 根据 from 字段决定使用哪个 QuestionType
  const isHighlightChat = currentContext.from === 'page' || currentContext.from === 'pdf'
  const questionType = isHighlightChat ? QuestionType.HIGHLIGHT_CHAT : QuestionType.QUOTE

  // 添加用户消息，流式请求将在 QuoteMessage.vue 中处理
  addUserMessage({
    type: questionType,
    value: '',
    prompt: sliceValue,
    attachments: {
      quote: {
        highlighted_text: currentContext!.stepTitleAndText,
        user_question: sliceValue,
        context: currentContext!.allText,
        from: currentContext!.from,
      },
    },
  })
  // 清空输入框和引用
  inputValue.value = ''
  stepQuoteManager.clearContext()
}
// ======================PDF==============================
// 处理PDF-Solve
const handlePdfSolve = () => {
  // 检查PDF页数，如果超过20页则提醒
  const pdfPageCount = stagingFileInfo.value?.pdfPage
  if (pdfPageCount && pdfPageCount > 20) {
    toastRef.value?.show(
      `File exceeds size limit. Only the first 20 pages will be processed.`
    )
  }
  trackEvent.track('Plugin_Sidebar_Uploadchat_Solve', {
    fileType: stagingType.value,
  })
  addPdfSolveMessage({
    uploadedFileUrl: stagingFileInfo.value?.cdnUrl!,
    fileName: stagingFileInfo.value?.fileName!,
    uploadedFile: stagingFileInfo.value?.file!,
    currentFileStackKey: currentFileStackKey.value,
  })
}
// 处理PDF-Summarize
const handlePdfSummarize = () => {
  // 检查PDF页数，如果超过20页则提醒
  const pdfPageCount = stagingFileInfo.value?.pdfPage
  if (pdfPageCount && pdfPageCount > 20) {
    toastRef.value?.show(
      `File exceeds size limit. Only the first 20 pages will be processed.`
    )
  }
  trackEvent.track('Plugin_Sidebar_Uploadchat_Summarize', {
    fileType: stagingType.value,
  })
  addUserMessage({
    type: QuestionType.PDF_SUMMARIZE,
    value: '',
    fileStackKey: currentFileStackKey.value,
    attachments: {
      chatWithPdf: {
        fileUrl: stagingFileInfo.value?.cdnUrl!,
        fileName: stagingFileInfo.value?.fileName!,
      },
    },
  })
}
// 处理PDF-Quiz
const handlePdfQuiz = () => {
  // 检查PDF页数，如果超过50页则提醒
  const pdfPageCount = stagingFileInfo.value?.pdfPage
  if (pdfPageCount && pdfPageCount > 50) {
    toastRef.value?.show(
      `File exceeds size limit. Only the first 50 pages will be processed.`
    )
  }
  trackEvent.track('Plugin_Sidebar_Uploadchat_Quiz', {
    fileType: stagingType.value,
  })
  addUserMessage({
    type: QuestionType.QUIZ,
    fileStackKey: currentFileStackKey.value,
    value: ``,
    attachments: {
      chatWithPdf: {
        fileUrl: stagingFileInfo.value?.cdnUrl_To_Quiz!,
        fileName: stagingFileInfo.value?.fileName!,
      },
    },
  })
}
// 处理PDF-Prompt
const handlePdfPrompt = (value: string) => {
  // 检查PDF页数，如果超过20页则提醒
  const pdfPageCount = stagingFileInfo.value?.pdfPage
  if (pdfPageCount && pdfPageCount > 20) {
    toastRef.value?.show(
      `File exceeds size limit. Only the first 20 pages will be processed.`
    )
  }
  trackEvent.track('Plugin_Sidebar_Uploadchat_Send', {
    prompt: value.length > 250 ? value.slice(0, 250) : value,
    fileType: stagingType.value,
  })
  addUserMessage({
    type: QuestionType.PDF_SUMMARIZE,
    value: '',
    prompt: value.length > 250 ? value.slice(0, 250) : value,
    fileStackKey: currentFileStackKey.value,
    attachments: {
      chatWithPdf: {
        fileUrl: stagingFileInfo.value?.cdnUrl!,
        fileName: stagingFileInfo.value?.fileName!,
      },
    },
  })
  inputValue.value = ''
}
// ======================图片===============================
// 处理图片-Solve
const handleImageSolve = () => {
  trackEvent.track('Plugin_Sidebar_Uploadchat_Solve', {
    fileType: stagingType.value,
  })
  browser.runtime.sendMessage({
    type: SidepanelEventType.SOLVE_FROM_CONTENT,
    data: {
      cutDataUrl: stagingFileInfo.value?.imageBase64,
    },
  })
}
// 处理图片-Summarize
const handleImageSummarize = () => {
  trackEvent.track('Plugin_Sidebar_Uploadchat_Summarize', {
    fileType: stagingType.value,
  })
  addUserMessage({
    type: QuestionType.PDF_SUMMARIZE,
    value: '',
    attachments: {
      image: {
        cdnUrl_imageToPdf: stagingFileInfo.value?.cdnUrl_imageToPdf!,
        base64: stagingFileInfo.value?.imageBase64!,
      },
    },
  })
}
// 处理图片-Quiz
const handleImageQuiz = () => {
  trackEvent.track('Plugin_Sidebar_Uploadchat_Quiz', {
    fileType: stagingType.value,
  })
  addUserMessage({
    type: QuestionType.QUIZ,
    value: `Generate quiz from this Image`,
    fileStackKey: currentFileStackKey.value,
    attachments: {
      image: {
        base64: stagingFileInfo.value?.imageBase64!,
        imageName: stagingFileInfo.value?.fileName!,
        cdnUrl_quiz: stagingFileInfo.value?.cdnUrl_imageToQuiz!,
      },
    },
  })
}
// 处理图片-Prompt
const handleImagePrompt = (value: string) => {
  trackEvent.track('Plugin_Sidebar_Uploadchat_Send', {
    fileType: stagingType.value,
    prompt: value,
    from: stagingFileInfo.value?.from || 'unknown',
  })
  if (stagingFileInfo.value?.imageSlices) {
    addUserMessage({
      type: QuestionType.PDF_SUMMARIZE,
      value: '',
      prompt: value,
      attachments: {
        pageScreenshot: stagingFileInfo.value?.imageSlices,
      },
    })
  } else {
    addUserMessage({
      type: QuestionType.PHOTO,
      value: '',
      prompt: value.length > 250 ? value.slice(0, 250) : value,
      attachments: {
        image: {
          imageUrl: stagingFileInfo.value?.cdnUrl!,
          imageName: stagingFileInfo.value?.fileName!,
          base64: stagingFileInfo.value?.imageBase64!,
        },
      },
    })
  }
  inputValue.value = ''
}
// ======================网页===============================
// 处理网页-Summarize
const handleWebpageSummarize = async () => {
  addUserMessage({
    type: QuestionType.PDF_SUMMARIZE,
    value: '',
    attachments: {
      pageScreenshot: stagingFileInfo.value?.imageSlices,
    },
  })
  trackEvent.track('Plugin_Sidebar_Webpagechat_Summarize', {
    url: stagingFileInfo.value?.webUrl,
  })
  trackEvent.track('Plugin_Sidebar_Uploadchat_Summarize', {
    fileType: stagingType.value,
  })
}
// 处理网页-Prompt
const handleWebpagePrompt = async (instructions: string) => {
  inputValue.value = ''
  addUserMessage({
    type: QuestionType.PDF_SUMMARIZE,
    value: '',
    prompt: instructions,
    attachments: {
      pageScreenshot: stagingFileInfo.value?.imageSlices,
    },
  })
  trackEvent.track('Plugin_Sidebar_Webpagechat_Prompt', {
    url: stagingFileInfo.value?.webUrl,
  })
  trackEvent.track('Plugin_Sidebar_Uploadchat_Send', {
    prompt: instructions,
    fileType: stagingType.value,
  })
}
// 处理网页-Quiz
const handleWebpageQuiz = async () => {
  addUserMessage({
    type: QuestionType.QUIZ,
    value: '',
    attachments: {
      pageScreenshot: stagingFileInfo.value?.imageSlices,
    },
  })
  trackEvent.track('Plugin_Sidebar_Webpagechat_Quiz', {
    url: stagingFileInfo.value?.webUrl,
  })
  trackEvent.track('Plugin_Sidebar_Uploadchat_Quiz', {
    fileType: stagingType.value,
  })
}
// 处理网页-Solve
const handleWebpageSolve = () => {
  trackEvent.track('Plugin_Sidebar_Webpagechat_Solve', {
    url: stagingFileInfo.value?.webUrl,
  })
  trackEvent.track('Plugin_Sidebar_Uploadchat_Solve', {
    fileType: stagingType.value,
  })
  addUserMessage({
    type: QuestionType.PAGE_SCREENSHOT_SOLVE,
    value: '',
    attachments: {
      pageScreenshot: {
        uploadManager: stagingFileInfo.value?.imageSlices?.uploadManager,
        longImage: stagingFileInfo.value?.imageSlices?.longImage,
        slices: stagingFileInfo.value?.imageSlices?.slices,
        tileSize: stagingFileInfo.value?.imageSlices?.tileSize,
      },
    },
  })
}
// ======================普通的文本提问===============================
// 处理普通文本提问
const handleNormalText = async (value: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return

  sendNormalText(trimmed)
}

// 直接发送普通文本（不触发拦截）
function sendNormalText(text: string) {
  addUserMessage({
    type: QuestionType.TEXT,
    value: text.length > 2000 ? text.slice(0, 2000) : text,
  })
  inputValue.value = ''
}
// ============================== 统一处理 FileStaging 的业务事件 ==============================
// 统一处理 FileStaging 的业务事件
const handleSolve = () => {
  if (!canSendMessage.value) {
    toastRef.value?.show('Let me finish first')
    return
  }
  if (stagingType.value === 'pdf') {
    handlePdfSolve()
  } else if (stagingType.value === 'image') {
    handleImageSolve()
  } else if (stagingType.value === 'web') {
    handleWebpageSolve()
  }
  clearStaging()
}
const handleSummarize = () => {
  if (!canSendMessage.value) {
    toastRef.value?.show('Let me finish first')
    return
  }
  if (stagingType.value === 'pdf') {
    handlePdfSummarize()
  } else if (stagingType.value === 'web') {
    handleWebpageSummarize()
  } else if (stagingType.value === 'image') {
    handleImageSummarize()
  }
  clearStaging()
}
const handleQuiz = () => {
  if (!canSendMessage.value) {
    toastRef.value?.show('Let me finish first')
    return
  }
  if (stagingType.value === 'pdf') {
    handlePdfQuiz()
  } else if (stagingType.value === 'web') {
    handleWebpageQuiz()
  } else if (stagingType.value === 'image') {
    handleImageQuiz()
  }
  clearStaging()
}
// 处理弹窗中的上传按钮点击（带登录检查）
const handleTriggerFileUpload = () => {
  if (!props.auth.isAuthenticated.value) {
    // 记录待处理动作，弹出登录框
    pendingAction.value = () => createFilePicker('Upload_Popup')
    props.auth.showLoginModal()
    return
  }
  createFilePicker('Upload_Popup')
}

// 处理上传按钮点击（带登录检查）
const handleUploadButtonClick = () => {
  trackEvent.track('Plugin_Sidebar_FileUpload_Click')
  if (!props.auth.isAuthenticated.value) {
    // 记录待处理动作，弹出登录框
    pendingAction.value = () => createFilePicker('Upload_Click')
    props.auth.showLoginModal()
    return
  }
  createFilePicker('Upload_Click')
}

const lastUploadActionType = ref<'summary' | 'quiz' | null>(null)
// 处理本地文件直接上传（带登录检查）
const handleLocalFileUpload = (data: unknown) => {
  if (!props.auth.isAuthenticated.value) {
    // 记录待处理动作，弹出登录框
    pendingAction.value = () => handleLocalFileUpload(data)
    props.auth.showLoginModal()
    return
  }
  if (!data || typeof data !== 'object' || !('file' in data)) return
  const { file, actionType } = data as {
    file: File
    actionType?: 'summary' | 'quiz'
  }
  if (!(file instanceof File)) return
  addFileOrUrl(file)
  lastUploadActionType.value = actionType || null
}

onMounted(() => {
  Performance.reportComponentAppear(PerformanceKeys.SIDEPANEL_FOOTER_APPEAR)
  emitter.on('trigger-file-upload', handleTriggerFileUpload)
  emitter.on('upload-local-file-from-modal', handleLocalFileUpload)
  emitter.on('upload-error', (data: any) => {
    const { fileName, error } = data as { fileName: string; error: string }

    // 根据错误类型判断错误类型
    const isUnsupportedType = error.includes('Unsupported file type')
    const isFileSizeError =
      error.includes('File size exceeds') ||
      error.includes('file size is too large')

    let summary = 'Network error'
    let detail = `${fileName} upload failed`

    if (isUnsupportedType) {
      summary = 'Unsupported type'
    } else if (isFileSizeError) {
      summary = 'File too large'
      detail = error // 使用原始错误信息，包含具体的大小限制
    }

    toastPrime.add({
      severity: 'error',
      summary,
      detail,
      life: 3000,
    })
  })
  // 新增：监听引用聚焦事件
  emitter.on('focus-footer-input', () => {
    textareaRef.value?.focus()
  })
})

// 清理事件监听
onUnmounted(() => {
  emitter.all.clear()
  // 清理ESC监听器
  stopEscListener()
})
</script>

<style scoped>
/* 定义进入和离开的过渡动画 */
.fade-enter-active {
  transition: opacity 0.4s ease;
}

.fade-leave-active {
  transition: opacity 0.1s ease;
}

/* 定义进入和离开的初始和结束状态 */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
