<template>
  <div class="summary-message">
    <!-- 状态展示区 -->
    <div
      v-if="status === MessageStatus.PENDING"
      class="pb-[20px] flex flex-row items-center justify-start gap-2"
    >
      <Vue3Lottie
        :animation-data="isDark ? loadingAnimationDark : loadingAnimation"
        :width="20"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{ margin: 0, height: '20px' }"
      />

      <div class="text-primary text-sm font-normal leading-tight">Summarizing</div>
    </div>
    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-[#F30A34]">
        {{ ErrorMessage[errorType as ErrorType] }}
      </div>
      <div
        v-if="errorType === ErrorType.NETWORK_ERROR"
        class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk cursor-pointer"
        @click="handleRetry"
      >
        <SvgIcon
          name="try-again"
          size="20"
        />
        <span>Try again</span>
      </div>
    </div>

    <!-- 内容展示区：流式和完成都显示 -->
    <div
      v-else-if="
        status === MessageStatus.RESPONDING ||
        status === MessageStatus.COMPLETED ||
        status === MessageStatus.STOP
      "
    >
      <div
        class="text-sm leading-[140%] font-[400] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      >
        <LatexFormat
          v-if="content"
          :text="content"
        />
      </div>
    </div>

        <!-- Stop 状态 -->
    <div
      v-if="status === MessageStatus.STOP"
      class="text-[14px] leading-[140%] text-[#989B9E]"
    >
      You stopped this response
    </div>
    <Toast
      ref="toastRef"
      :duration="3000"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject } from 'vue'
import { usePDFSummarize } from '../composables/usePDFSummarize'
import { useMessageScroll } from '../composables/useMessageScroll'
import LatexFormat from '@/components/common/LatexFormat.vue'
import { MessageStatus, ErrorType, ErrorMessage } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import { Vue3Lottie } from 'vue3-lottie'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useRetrieveStore } from '../composables/useRetrieveStore'
import globalUpload from '../composables/useGlobalUpload'
import { useDarkMode } from '@/composables/useDarkMode'
import { createMultiPagePdf } from '../utils/pageScreenshot'
import { waitForCdnUrl as waitForCdnUrlUnified } from '@/utils/cdnWaiter'
import type { LayerUploadResult } from '@/utils/layerImageUploader'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'

// 使用 inject 获取 cancelRegistry（可选，Layer 和侧边栏环境都有）
const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

const props = withDefaults(defineProps<{
  message: any
  showActions?: boolean
  // 新增：Layer 模式的上传 Promise
  uploadPromise?: Promise<LayerUploadResult>
  useScroll?: boolean
}>(), {
  useScroll: true
})

interface PDFSummaryObj {
  content: string
  command: string
}

const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'messageUpdate'): void
  // 新增：完成时传递数据
  (e: 'done', data: { content: string; feedback: number; pdfUrl?: string }): void
}>()

const status = ref<MessageStatus>(MessageStatus.PENDING)
const content = ref('')
const errorType = ref<ErrorType | null>(null)

// 🔧 保存当前 PDF URL（用于传递到浮层）
const currentPdfUrl = ref<string>('')

// 使用滚动管理（根据 props 决定）
const { smartScroll } = props.useScroll 
  ? useMessageScroll(props.message?.id || '')
  : { smartScroll: () => {} }
// 使用 useRetrieveStore
const { startStoreProcess } = useRetrieveStore()
// 使用 usePDFSummarize
const { startPDFSummary, startPDFSummaryWithPrompt, cancelPDFSummaryRequest, cancelSummary, retryPDFSummary } = usePDFSummarize()
const { isDark } = useDarkMode()

const registerCancelHandler = () => {
  const cancel = async () => {
    try {
      // 设置取消标志
      isCancelled = true
      // 清理定时器
      if (summaryTimeout) {
        clearTimeout(summaryTimeout)
        summaryTimeout = null
      }
      // 取消PDF摘要请求
      cancelPDFSummaryRequest()
      cancelSummary()
      // 更新状态为停止
      status.value = MessageStatus.STOP
      emit('statusChange', MessageStatus.STOP)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('PdfSummaryMessage cancel error:', error)
      }
      throw error
    }
  }
  // 使用 inject 的 cancelRegistry（可选，侧边栏和 Layer 都有）
    cancelRegistry?.registerCancelable(props.message?.id || '', cancel)
}

watch(
  () => props.message?.status,
  (next) => {
    if (next) {
      status.value = next
    }
  }
)

// 监听状态变化，管理取消句柄的注销
watch(
  () => status.value,
  (newStatus) => {
    // 只在状态变为终态时注销取消句柄，注册在 onMounted 和 handleRetry 中处理
    if (newStatus === MessageStatus.COMPLETED || newStatus === MessageStatus.ERROR || newStatus === MessageStatus.STOP) {
      // 使用 inject 的 cancelRegistry 注销
        cancelRegistry?.unregisterCancelable(props.message?.id || '')
    }
  }
)

// 超时定时器
let summaryTimeout: ReturnType<typeof setTimeout> | null = null
// 取消标志
let isCancelled = false

// 等待 CDN URL 生成的函数
const waitForCdnUrl = (fileStackKey: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    let stop: (() => void) | null = null

    const timeout = setTimeout(() => {
      if (stop) {
        stop()
      }
      // 检查是否已经被取消，如果是则抛出取消错误而不是超时错误
      if (isCancelled) {
        reject(new Error('Operation cancelled'))
      } else {
        reject(new Error('Waiting for CDN URL timeout'))
      }
    }, 30000) // 30秒超时

    stop = watch(
      () => globalUpload.fileStack.value[fileStackKey]?.cdnUrl,
      (cdnUrl) => {
        if (cdnUrl) {
          clearTimeout(timeout)
          if (stop) {
            stop()
          }
          resolve(cdnUrl)
        }
      },
      { immediate: true }
    )
  })
}

// 等待图片转PDF后的 cdnUrl（cdnUrl_imageToPdf）
const waitForImagePdfUrl = (fileStackKey: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    let stop: (() => void) | null = null

    const timeout = setTimeout(() => {
      if (stop) {
        stop()
      }
      // 检查是否已经被取消，如果是则抛出取消错误而不是超时错误
      if (isCancelled) {
        reject(new Error('Operation cancelled'))
      } else {
        reject(new Error('Waiting for image pdf cdnUrl timeout'))
      }
    }, 30000)

    stop = watch(
      () => globalUpload.fileStack.value[fileStackKey]?.cdnUrl_imageToPdf,
      (val) => {
        if (val) {
          console.log('waitForImagePdfUrl==================4', val)
          clearTimeout(timeout)
          if (stop) {
            stop()
          }
          resolve(val)
        }
      },
      { immediate: true }
    )
  })
}

// 统一的消息处理函数
const processMessage = async () => {
  if (isCancelled) {
    return
  }
  // 启动30秒超时定时器
  if (summaryTimeout) clearTimeout(summaryTimeout)
  summaryTimeout = setTimeout(() => {
    cancelPDFSummaryRequest()
    cancelSummary()
    status.value = MessageStatus.ERROR
    errorType.value = ErrorType.NETWORK_ERROR
    emit('statusChange', MessageStatus.ERROR)
  }, 35000)
  const image = props.message?.userContent?.attachments?.image
  const chatWithPdf = props.message?.userContent?.attachments?.chatWithPdf
  const pageScreenshot = props.message?.userContent?.attachments?.pageScreenshot
  const prompt = props.message?.userContent?.prompt

  // 判断消息类型并处理
  if (image) {
    // ================================================图片总结===============================================
    let pdf_url = image.cdnUrl_imageToPdf
    
    // 🔑 统一等待机制
    if (!pdf_url) {
      try {
        // Layer 模式：await uploadPromise
        if (props.uploadPromise) {
          pdf_url = await waitForCdnUrlUnified({
            uploadPromise: props.uploadPromise,
            urlKey: 'cdnUrl_pdf',
            timeout: 30000
          })
        }
        // 侧边栏模式：watch fileStack（传入 fileStack）
        else {
          const fileStackKey = props.message?.userContent?.fileStackKey
          if (fileStackKey) {
            pdf_url = await waitForCdnUrlUnified({
              fileStack: globalUpload.fileStack,  // 🔑 传入 fileStack
              fileStackKey,
              cdnKey: 'cdnUrl_imageToPdf',
              timeout: 30000
            })
          }
        }
      } catch (error) {
        if (isCancelled) return
        console.error('Waiting for pdf cdnUrl failed:', error)
        status.value = MessageStatus.ERROR
        errorType.value = ErrorType.NETWORK_ERROR
        emit('statusChange', MessageStatus.ERROR)
        return
      }
    }
    
    if (!pdf_url) {
      status.value = MessageStatus.ERROR
      errorType.value = ErrorType.NETWORK_ERROR
      emit('statusChange', MessageStatus.ERROR)
      return
    }
    // 异步入库（内部自带缓存机制）
    startFileStorageProcess(pdf_url)
    // 🔧 保存 PDF URL
    currentPdfUrl.value = pdf_url
    startPDFSummary(
      { pdfUrl: pdf_url, sessionId: props.message?.id || '' },
      createSummaryCallbacks()
    )
    return
  }

  // ================================================PDF总结或者Prompt流程===============================================
  let pdfUrl = chatWithPdf?.fileUrl || ''
  let pictures: string[] | undefined = undefined

  if (pageScreenshot) {
    try {
      // ⭐ 新增：检测是否有 uploadManager（流式截图）
      const uploadManager = pageScreenshot.uploadManager

      if (uploadManager) {
        const sliceCount = uploadManager.progress.value.total

        // 小页面（≤2切片）：使用 longImage 直接转PDF
        if (sliceCount <= 2) {
          console.log('📦 [PdfSummaryMessage] 小页面，使用 longImage')
          pdfUrl = await createMultiPagePdf([pageScreenshot.longImage], pageScreenshot.tileSize)
        } else {
          // 大页面（>2切片）：等待优化上传完成，获取压缩后的图片URLs
          console.log(`📊 [PdfSummaryMessage] 大页面（${sliceCount} 切片），开始优化上传（1024×1024, 质量0.7）`)

          try {
            const cdnUrls = await uploadManager.waitForOptimizedUpload(1600, 0.8)
            pictures = cdnUrls
            console.log(`✅ [PdfSummaryMessage] 获取到 ${cdnUrls.length} 个优化后的图片URL`)
          } catch (error) {
            console.error('❌ [PdfSummaryMessage] 优化上传失败，回退到 createMultiPagePdf', error)
            // 回退：使用原有的 createMultiPagePdf 逻辑
            pdfUrl = await createMultiPagePdf(pageScreenshot.slices || [], pageScreenshot.tileSize)
          }
        }
      } else {
        // 原有逻辑：没有 uploadManager，使用 createMultiPagePdf
        console.log('📝 [PdfSummaryMessage] 使用原有的 createMultiPagePdf 逻辑')
        pdfUrl = await createMultiPagePdf(pageScreenshot.slices || [], pageScreenshot.tileSize)
      }
    } catch (error) {
      errorType.value = ErrorType.NETWORK_ERROR
      emit('statusChange', MessageStatus.ERROR)
      return
    }
  } else {
    const needHideDownload = chatWithPdf.needHideDownload
    const fileStackKey = props.message?.userContent?.fileStackKey
    if (needHideDownload && !pdfUrl && fileStackKey) {
      // 监听传过来的filestack的key里面的cdnUrl是否生成了，如果生成了就往下走,没生成就等待cdn生成
      try {
        const finalPdfUrl = await waitForCdnUrl(fileStackKey)
        if (finalPdfUrl) {
          pdfUrl = finalPdfUrl // 更新 pdfUrl，让后续逻辑使用
        }
      } catch (error) {
        console.error('Waiting for CDN URL failed:', error)
        // 如果等待超时，继续使用原有的 pdfUrl
      }
    }
  }

  // 🔑 异步入库（不阻塞摘要）
  if (prompt) {
    await startFileStorageProcess(pdfUrl, pictures)
  } else {
    startFileStorageProcess(pdfUrl, pictures)
  }

  
  // 🔧 保存 PDF URL
  currentPdfUrl.value = pdfUrl
  
  // 开始摘要
  prompt
    ? startPDFSummaryWithPrompt(
        { pdfUrl: pdfUrl, prompt, sessionId: props.message?.id || '' },
        createSummaryCallbacks()
      )
    : startPDFSummary(
        {
          pdfUrl: pdfUrl,
          pictures: pictures, // ⭐ 新增：传递 pictures
          sessionId: props.message?.id || '',
        },
        createSummaryCallbacks()
      )
}

// 提取公共的回调函数
const createSummaryCallbacks = () => ({
  onMessage: (currentSummary: PDFSummaryObj) => {
    // 检查是否已经被取消，如果是则忽略流式消息
    if (isCancelled) {
      cancelSummary()
      cancelPDFSummaryRequest()
      return
    }
    content.value = currentSummary.content
    if (currentSummary.command && currentSummary.command !== 'done') {
      status.value = MessageStatus.RESPONDING
      emit('statusChange', MessageStatus.RESPONDING)
    }
    emit('messageUpdate')
  },
  onDone: (c: any) => {
    // 检查是否已经被取消，如果是则忽略完成回调
    if (isCancelled) {
      return
    }
    content.value = c
    status.value = MessageStatus.COMPLETED
    emit('statusChange', MessageStatus.COMPLETED)
    // 🎯 新增：传递完整数据（用于浮层存储）
    emit('done', { 
      content: c,
      feedback: -1,  // 默认未操作，后续由 UnifiedMessageActions 更新
      pdfUrl: currentPdfUrl.value,  // 🔧 传递 PDF URL 以支持侧栏重试
    })
    if (summaryTimeout) {
      clearTimeout(summaryTimeout)
      summaryTimeout = null
    }
  },
  onError: (e: any) => {
    // 检查是否已经被取消，如果是则不设置错误状态
    if (isCancelled) {
      return
    }
    status.value = MessageStatus.ERROR
    emit('statusChange', MessageStatus.ERROR)
    errorType.value = ErrorType.NETWORK_ERROR
    if (summaryTimeout) {
      clearTimeout(summaryTimeout)
      summaryTimeout = null
    }
  },
})

// ==================== 文件入库逻辑（支持 pdfUrl 或 pictures）====================

const startFileStorageProcess = async (pdfUrl?: string, pictures?: string[]) => {
  // 检查消息是否已标记为已入库
  if (props.message.storageInfo?.isStored) {
    console.log('[PdfSummaryMessage] Already marked as stored, skipping')
    return
  }
  
  try {
    // 调用入库接口
    const res = await startStoreProcess({
      pdfUrl: pdfUrl || undefined,
      pictures: pictures || undefined,
      sessionId: props.message?.id || '',
    })
    
    // 不管成功失败，都标记为已入库
    const storageKey = pdfUrl || (pictures ? pictures[0] : '')
    if (storageKey) {
      markAsStored(storageKey)
      console.log('[PdfSummaryMessage] Storage called and marked')
    }
  } catch (error) {
    console.error('[PdfSummaryMessage] Storage failed but marked:', error)
    // 即使失败也标记，避免重复调用
    const storageKey = pdfUrl || (pictures ? pictures[0] : '')
    if (storageKey) {
      markAsStored(storageKey)
    }
  }
}

// 标记消息为已入库
const markAsStored = (pdfUrl: string) => {
  if (!props.message) return
  
  // 初始化或更新 storageInfo
  props.message.storageInfo = {
    isStored: true,
    pdfUrl: pdfUrl,
  }
  
  // 触发消息更新，让响应式系统感知
  emit('messageUpdate')
}

// 🎯 重试处理（保留，通过 defineExpose 暴露给父组件）
const handleRetry = async () => {
  // 🔑 保存重试前的状态
  const previousStatus = status.value
  
  // 重置状态
  status.value = MessageStatus.PENDING
  errorType.value = null
  content.value = ''
  isCancelled = false
  
  emit('statusChange', MessageStatus.PENDING)
  registerCancelHandler()

  const sessionId = props.message?.id
  if (!sessionId) {
    console.error('重试需要 sessionId')
    status.value = MessageStatus.ERROR
    errorType.value = ErrorType.NETWORK_ERROR
    emit('statusChange', MessageStatus.ERROR)
    return
  }

  try {
    // 🔑 只有 COMPLETED 状态的重试才调用 retryPDFSummary，其他状态相当于新请求
    if (previousStatus === MessageStatus.COMPLETED) {
      // 使用重试接口（不扣余额）
      await retryPDFSummary(sessionId, createSummaryCallbacks())
    } else {
      // 其他状态（ERROR、STOP、PENDING、RESPONDING 等）相当于发起新的解题
      await processMessage()
    }
  } catch (error) {
    // 检查是否是因为取消导致的错误，如果是则不显示错误状态
    if (isCancelled || (error instanceof Error && error.message === 'Operation cancelled')) {
      return
    }
    status.value = MessageStatus.ERROR
    errorType.value = ErrorType.NETWORK_ERROR
    emit('statusChange', MessageStatus.ERROR)
  }
}

// 🎯 点赞、点踩、复制已移至 UnifiedMessageActions 统一管理

onMounted(async () => {
  // 🎯 检查是否有预加载数据（直接渲染模式）
  const preloadedData = props.message.preloadedData
  if (preloadedData && 'content' in preloadedData) {
    content.value = preloadedData.content
    status.value = MessageStatus.COMPLETED
    
    emit('statusChange', MessageStatus.COMPLETED)
    
    // 🎯 传递完整数据（包括预加载的 feedback）
    emit('done', {
      content: content.value,
      feedback: preloadedData.feedback ?? -1
    })
    
    return
  }
  
  // 🚀 正常请求模式
  // 🎯 立即发送 PENDING 状态
  emit('statusChange', MessageStatus.PENDING)
  
  // 初始化取消标志
  isCancelled = false

  // 立即注册取消处理器，确保暂停功能在阻塞操作开始前就可用
  registerCancelHandler()

  try {
    await processMessage()
  } catch (error) {
    // 检查是否是因为取消导致的错误，如果是则不显示错误状态
    if (isCancelled || (error instanceof Error && error.message === 'Operation cancelled')) {
      return
    }
    status.value = MessageStatus.ERROR
    errorType.value = ErrorType.NETWORK_ERROR
    emit('statusChange', MessageStatus.ERROR)
    if (summaryTimeout) {
      clearTimeout(summaryTimeout)
      summaryTimeout = null
    }
  }
})

// 监听内容变化，自动滚动并触发尺寸更新（与 AnswerMessage 对齐）
watch(
  () => content.value,
  () => {
    // 只在流式输出或完成时滚动
    if (status.value === MessageStatus.RESPONDING || status.value === MessageStatus.COMPLETED) {
      smartScroll()
      // 🎯 触发消息更新事件，确保浮层约束逻辑被执行
      emit('messageUpdate')
    }
  }
)

onUnmounted(() => {
  if (summaryTimeout) {
    clearTimeout(summaryTimeout)
    summaryTimeout = null
  }
  cancelPDFSummaryRequest()
  cancelSummary()
  
  // 只注销取消句柄（状态保留在消息对象上）
  cancelRegistry?.unregisterCancelable(props.message?.id || '')
})

// 🎯 暴露重试方法
defineExpose({
  retry: handleRetry
})
</script>
