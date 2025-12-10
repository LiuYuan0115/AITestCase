<template>
  <div>
    <!-- 状态展示区 -->
    <div
      v-if="status === MessageStatus.PENDING"
      class="pb-[20px]"
    >
      <!-- <Vue3Lottie :animation-data="animationData" :width="257" :height="20" :loop="true" :autoplay="true" :style="{
                margin: 0,
            }" /> -->
      <Vue3Lottie
        :animation-data="isDark ? loadingPromptDark : loadingPrompt"
        :width="32"
        :height="32"
        :loop="true"
        :autoplay="true"
        :style="{ margin: '-4px' }"
      />
    </div>

    <!-- 内容展示区 -->
    <div
      v-else-if="
        status === MessageStatus.RESPONDING || status === MessageStatus.COMPLETED || status === MessageStatus.STOP
      "
    >
      <div
        class="text-[14px] leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      >
        <LatexFormat
          v-if="content"
          :text="content"
        />
      </div>

      <!-- 🎯 操作按钮已移至 UnifiedMessageActions 统一管理 -->
    </div>
    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-[#F30A34]">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue'
import { useRetrieveStore } from '../composables/useRetrieveStore'
import { useMessageScroll } from '../composables/useMessageScroll'
import LatexFormat from '@/components/common/LatexFormat.vue'
import { MessageStatus, PdfSummarizeAskMessage, ErrorType, ErrorMessage } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import { Vue3Lottie } from 'vue3-lottie'
import animationData from '@/assets/animations/message-loading.json'
import useMessages from '../composables/useMessages'
import { MessageType, ServiceMessageType } from '../types/message'
import loadingPrompt from '@/assets/animations/loading-prompt.json'
import loadingPromptDark from '@/assets/animations/loading-prompt-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'

const { isDark } = useDarkMode()

// 使用 inject 获取 cancelRegistry
const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

const errorMessage = ref('')

// Props 定义
interface Props {
  message: PdfSummarizeAskMessage
  messageStore: ReturnType<typeof useMessages>
  sessionId?: string // 从外界传入的会话ID
}

const props = defineProps<Props>()

// Emits 定义
const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'contentUpdate', content: string): void
  (e: 'messageUpdate'): void
  (e: 'done', data: { content: string; feedback: number }): void
}>()

// 组件状态
const status = ref<MessageStatus>(MessageStatus.PENDING)
const content = ref('')

// 添加连接状态
const isConnect = ref(true)

// 添加错误类型状态
const errorType = ref<ErrorType | null>(null)

// 取消标志
let isStopped = false

// 使用滚动管理
const { smartScroll } = useMessageScroll(props.message.id)

// 使用 useRetrieveStore
const { startRetrieveProcess, cancelRetrieve, startStoreProcess } = useRetrieveStore()

const registerCancelHandler = () => {
  const cancel = async () => {
    try {
      // 设置取消标志
      isStopped = true
      // 取消检索请求
      cancelRetrieve()
      // 更新状态为停止
      status.value = MessageStatus.STOP
      emit('statusChange', MessageStatus.STOP)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('PDFSummaryAskMessage cancel error:', error)
      }
      throw error
    }
  }
  // 使用 inject 的 cancelRegistry
  cancelRegistry?.registerCancelable(props.message.id, cancel)
}

// 中断当前请求的方法
const abortCurrentRequest = () => {
  cancelRetrieve()
  isConnect.value = false
}

// ==================== 查找相关的 PDF 消息 ====================

const findRelatedPdfMessage = (): any | null => {
  const messages = props.messageStore.messages.value
  const currentMessageIndex = messages.findIndex((msg) => msg.id === props.message.id)

  if (currentMessageIndex === -1) {
    console.warn('[PDFSummaryAskMessage] Current message not found')
    return null
  }

  // 从当前消息往前查找
  for (let i = currentMessageIndex - 1; i >= 0; i--) {
    const msg = messages[i]

    if (msg.type !== MessageType.SERVICE) continue

    const serviceMsg = msg as any

    // 跳过追问消息
    if (serviceMsg.serviceType === ServiceMessageType.PDF_SUMMARIZE_ASK) {
      continue
    }

    // 找到 PDF 总结消息
    if (serviceMsg.serviceType === ServiceMessageType.PDF_SUMMARIZE) {
      return serviceMsg
    }

    // 遇到其他类型消息，停止查找（避免跨会话）
    break
  }

  console.warn('[PDFSummaryAskMessage] No related PDF message found')
  return null
}

// ==================== 获取相关 PDF 信息 ====================

// 获取 PDF URL（优先从 storageInfo，回退到 userContent）
const getPdfUrl = (relatedMsg: any): string => {
  if (!relatedMsg) return ''

  // 优先使用 storageInfo 中的 pdfUrl
  if (relatedMsg.storageInfo?.pdfUrl) {
    return relatedMsg.storageInfo.pdfUrl
  }

  // 回退到 userContent
  const chatWithPdf = relatedMsg.userContent?.attachments?.chatWithPdf
  if (chatWithPdf?.fileUrl) {
    return chatWithPdf.fileUrl
  }

  const image = relatedMsg.userContent?.attachments?.image
  if (image?.cdnUrl_imageToPdf) {
    return image.cdnUrl_imageToPdf
  }

  console.warn('[PDFSummaryAskMessage] No PDF URL found')
  return ''
}

// ==================== 入库逻辑 ====================

// 执行入库（如果需要）
const ensureRelatedPdfStored = async (relatedMsg: any, pdfUrl: string): Promise<boolean> => {
  // 检查是否已入库
  if (relatedMsg.storageInfo?.isStored) {
    console.log('[PDFSummaryAskMessage] Already stored, skipping')
    return true
  }

  console.log('[PDFSummaryAskMessage] Not stored, executing storage...')

  // 30秒超时保护
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('[PDFSummaryAskMessage] Storage timeout (30s)')
      // 超时也标记为已入库（避免重复尝试）
      relatedMsg.storageInfo = {
        isStored: true,
        pdfUrl,
      }
      resolve(false)
    }, 30000)

    // 执行入库
    startStoreProcess({
      pdfUrl,
      sessionId: relatedMsg.id,
    })
      .then((res) => {
        clearTimeout(timeout)
        // 标记为已入库（不管成功失败）
        relatedMsg.storageInfo = {
          isStored: true,
          pdfUrl,
        }
        console.log('[PDFSummaryAskMessage] Storage completed:', res)
        resolve(true)
      })
      .catch((error) => {
        clearTimeout(timeout)
        // 入库失败也标记（避免重复尝试）
        relatedMsg.storageInfo = {
          isStored: true,
          pdfUrl,
        }
        console.error('[PDFSummaryAskMessage] Storage failed:', error)
        resolve(false)
      })
  })
}

// ==================== 检索逻辑 ====================

const startRetrieveProcessLogic = (sessionId: string, pdfUrl: string) => {
  // 检查是否已停止
  if (isStopped) {
    console.log('[PDFSummaryAskMessage] Stopped, skipping retrieve')
    return
  }

  // 重置状态
  errorType.value = null
  isConnect.value = true
  emit('statusChange', MessageStatus.PENDING)

  startRetrieveProcess(
    {
      text: props.message.userContent.value,
      sessionId: sessionId,
      pdfUrl,
    },
    {
      onOpen: () => {
        status.value = MessageStatus.RESPONDING
        emit('statusChange', MessageStatus.RESPONDING)
      },
      onMessage: (currentSummary) => {
        // 实时更新内容
        content.value = currentSummary.content.Answer
        try {
          if (
            currentSummary.content?.Connect === false ||
            (currentSummary.command === 'error' && currentSummary.errorCode === '404')
          ) {
            isConnect.value = false
            abortCurrentRequest()
            // 更新状态为错误
            status.value = MessageStatus.NO_CONTEXT
            emit('statusChange', MessageStatus.NO_CONTEXT)
            return
          }
        } catch (error) {
          // 如果不是JSON格式，继续正常处理
        }
        emit('messageUpdate')
      },
      onDone: () => {
        status.value = MessageStatus.COMPLETED
        emit('statusChange', MessageStatus.COMPLETED)

        // 🎯 传递完整数据
        emit('done', {
          content: content.value,
          feedback: -1, // 默认未操作，后续由 UnifiedMessageActions 更新
        })
      },
      onError: (err) => {
        console.error('PDF检索总结失败:', err)
        // errorType.value = ErrorType.NETWORK_ERROR
        status.value = MessageStatus.NO_CONTEXT
        emit('statusChange', MessageStatus.NO_CONTEXT)
      },
    }
  )
}

// ==================== 生命周期 ====================

onMounted(async () => {
  emit('statusChange', MessageStatus.PENDING)
  smartScroll()
  registerCancelHandler()

  // 1. 查找相关的 PDF 消息
  const relatedMsg = findRelatedPdfMessage()

  const pdfUrl = getPdfUrl(relatedMsg)

  if (!relatedMsg || !pdfUrl) {
    console.error('[PDFSummaryAskMessage] No related PDF message found or no pdfUrl')
    status.value = MessageStatus.ERROR
    errorMessage.value = 'failed.'
    emit('statusChange', MessageStatus.ERROR)
    return
  }

  // 检查是否已停止
  if (isStopped) {
    console.log('[PDFSummaryAskMessage] Stopped before storage')
    return
  }

  // 2. 确保入库（如果没入库则执行入库，30秒超时）
  const storageSuccess = await ensureRelatedPdfStored(relatedMsg, pdfUrl)

  // 检查是否已停止
  if (isStopped) {
    console.log('[PDFSummaryAskMessage] Stopped after storage')
    return
  }

  if (!storageSuccess) {
    console.error('[PDFSummaryAskMessage] Storage failed or timeout')
    status.value = MessageStatus.ERROR
    errorMessage.value = 'Network error. Please try again later.'
    emit('statusChange', MessageStatus.ERROR)
    return
  }

  // 3. 开始检索
  startRetrieveProcessLogic(relatedMsg.id, pdfUrl)
})

// 🎯 点赞、点踩、复制已移至 UnifiedMessageActions 统一管理
watch(
  () => props.message.status,
  (next) => {
    status.value = next
  }
)

// 组件卸载时取消检索
onUnmounted(() => {
  cancelRetrieve()
  isConnect.value = false
  // 使用 inject 的 cancelRegistry 注销
  cancelRegistry?.unregisterCancelable(props.message.id)
})
</script>
