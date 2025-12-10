<template>
  <div class="flex flex-col gap-[24px]">
    <!-- 加载状态 -->
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

      <div class="text-primary text-sm font-normal leading-tight">
        Uploading
      </div>
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="status === MessageStatus.ERROR"
      class="flex flex-col items-start gap-[4px] text-[14px] leading-[150%]"
    >
      <div class="text-s-function-erro dark:text-s-function-erro-dark transition-colors duration-200">
        {{ errorMessage || ErrorMessage[errorType as ErrorType] }}
      </div>
      <div
        v-if="errorType === ErrorType.NETWORK_ERROR"
        class="flex items-center justify-start gap-[4px] text-t_2 dark:text-t_2_dk transition-colors duration-200 cursor-pointer"
        @click="handleRetry"
      >
        <SvgIcon name="try-again" size="20" />
        <span>Try again</span>
      </div>
    </div>

    <!-- 缓存状态 -->
    <div
      class="text-[14px] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      v-else-if="status === MessageStatus.CACHED && quizUrl"
    >
      You have generated deck for this page,
      <a
        href="https://solvely.ai/quiz/home"
        target="_blank"
        @click="console.log('handleLinkClick')"
        class="text-[#007AFF]"
      >
        go to Solvely.ai to study instantly >>
      </a>
    </div>

    <!-- 成功状态 -->
    <div
      class="text-[14px] leading-[150%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      v-else-if="status === MessageStatus.COMPLETED && quizUrl"
    >
      Upload Successfully!
      <br />
      <a
        :href="quizUrl"
        target="_blank"
        @click="console.log('handleLinkClick')"
        class="text-[#007AFF]"
      >
        Go to Solvely.ai to study instantly >>
      </a>
    </div>

    <!-- Stop状态 -->
    <div
      v-else-if="status === MessageStatus.STOP"
      class="text-[14px] leading-[140%] text-[#989B9E]"
    >
      You stopped this response
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject } from 'vue'
import {
  ErrorMessage,
  ErrorType,
  MessageStatus,
  QuizMessage,
} from '../types/message'
import trackEvent from '~/utils/trackEvent'
import defaultCache from '../utils/cache'
import { uploadToS3WithProgress } from '../composables/useUploadStaging'
import { fileToBase64, generateHashesFromBase64 } from '@/utils/fileConverter'
import { convertImageToPdf } from '@/utils/imageToPdf'
import globalUpload from '../composables/useGlobalUpload'
import { Vue3Lottie } from 'vue3-lottie'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import { waitForCdnUrl } from '@/utils/cdnWaiter'
import type { LayerUploadResult } from '@/utils/layerImageUploader'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'
import { useMessageScroll } from '../composables/useMessageScroll'

const { isDark } = useDarkMode()

// 使用 inject 获取 cancelRegistry（可选，Layer 和侧边栏环境都有）
const cancelRegistry = inject<CancelRegistry | undefined>(InjectionTokens.CANCEL_REGISTRY)

const props = withDefaults(defineProps<{
  message: QuizMessage
  showActions?: boolean
  // 新增：Layer 模式的上传 Promise
  uploadPromise?: Promise<LayerUploadResult>
  useScroll?: boolean
}>(), {
  useScroll: true
})

const emit = defineEmits<{
  (e: 'statusChange', status: MessageStatus): void
  (e: 'messageUpdate'): void
  // 新增：完成时传递数据
  (e: 'done', data: { quizUrl: string }): void
}>()

// 组件状态
const status = ref<MessageStatus>(MessageStatus.PENDING)
const errorType = ref<ErrorType | null>(null)
const errorMessage = ref<string>('')
const quizUrl = ref<string>('')
const isStopped = ref<boolean>(false)

// 使用滚动管理（根据 props 决定）
const { smartScroll } = props.useScroll 
  ? useMessageScroll(props.message.id)
  : { smartScroll: () => {} }

// 取消控制器
let abortController: AbortController | null = null

// 构建quiz链接
function buildQuizUrl(fileUrl: string, fileName?: string): string {
  const encodedUrl = encodeURIComponent(fileUrl)
  return `${
    import.meta.env.VITE_SOLVELY_URL
  }/quiz/home?pdfUrl=${encodedUrl}&pdfName=${fileName || 'document.pdf'}`
}

// 简单哈希函数
function simpleHash(str: string): string {
  if (!str) return ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

// 检查缓存并设置状态
function checkCacheAndSetStatus(): boolean {
  // 用imageUrl的hash作为缓存key
  const imageUrl = props.message.userContent.attachments?.image?.imageUrl
  if (!imageUrl) return false
  const cacheKey = simpleHash(imageUrl)
  const cachedQuizUrl = defaultCache.get(cacheKey)
  if (cachedQuizUrl && typeof cachedQuizUrl === 'string') {
    quizUrl.value = cachedQuizUrl
    status.value = MessageStatus.CACHED
    emit('statusChange', MessageStatus.COMPLETED)
    return true
  }
  return false
}

// 处理状态变化
function handleDone(
  currentStatus: MessageStatus,
  error?: ErrorType,
  message?: string
) {
  // 🔒 最高优先级：如果已经是 STOP 状态，不允许被覆盖（除非是重试）
  if (isStopped.value && currentStatus !== MessageStatus.PENDING) {
    console.log('[ImageQuizMessage] 已停止，忽略状态更新:', currentStatus)
    return
  }
  
  if (error) {
    errorType.value = error
    errorMessage.value = message || ''
  }
  status.value = currentStatus
  emit('statusChange', currentStatus)
  emit('messageUpdate')
  
  // 🎯 新增：完成时传递数据
  if (currentStatus === MessageStatus.COMPLETED && quizUrl.value) {
    emit('done', { quizUrl: quizUrl.value })
  }
}

const handleRetry = () => {
  status.value = MessageStatus.PENDING
  quizUrl.value = ''
  isStopped.value = false // 重置停止状态
  emit('statusChange', MessageStatus.PENDING)
  // 重新开始整个流程
  // processQuizGeneration()
  newProcess()
  
  // 重新注册取消处理器，确保暂停功能正常工作
  registerCancelHandler()
}

// 处理quiz生成的完整流程
async function processQuizGeneration() {
  try {
    if (checkCacheAndSetStatus()) return
    else {
      // 取base64、imageName、imageUrl
      const base64 = props.message.userContent.attachments?.image?.base64
      const imageName = props.message.userContent.attachments?.image?.imageName
      const imageUrl = props.message.userContent.attachments?.image?.imageUrl
      if (!base64 || !imageUrl) return
      const cacheKey = simpleHash(imageUrl)
      // 1. base64转pdf
      const { pdfFile } = await convertImageToPdf(base64, 'PNG')
      // 2. PDF转base64
      const pdfBase64 = await fileToBase64(pdfFile)
      // 3. 生成hash
      const { combinedHash } = await generateHashesFromBase64(pdfBase64)
      // 4. 上传到S3
      const cdnUrl = await uploadToS3WithProgress(
        pdfFile,
        pdfBase64,
        combinedHash
      )
      // 5. 拼接 quiz URL
      quizUrl.value = buildQuizUrl(cdnUrl, imageName)
      // 6. 存入缓存
      defaultCache.set(cacheKey, quizUrl.value)
      status.value = MessageStatus.COMPLETED
      emit('statusChange', MessageStatus.COMPLETED)
    }
  } catch (error) {
    handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR)
  }
}

const waitForQuizCdnUrl = async (fileStackKey: string) => {
  return new Promise<string>((resolve, reject) => {
    // 设置超时时间（30秒）
    const timeout = setTimeout(() => {
      stop()
      reject(new Error('Waiting for quiz cdnUrl timeout'))
    }, 30000)
    
    const stop = watch(
      () => globalUpload.fileStack.value[fileStackKey]?.cdnUrl_imageToQuiz,
      (val) => {
        if (val) {
          clearTimeout(timeout)
          stop()
          resolve(val)
        }
      }
    )

    // 检查是否已经被取消
    if (abortController?.signal.aborted) {
      clearTimeout(timeout)
      stop()
      reject(new Error('Operation cancelled'))
      return
    }

    // 监听取消信号
    abortController?.signal.addEventListener('abort', () => {
      clearTimeout(timeout)
      stop()
      reject(new Error('Operation cancelled'))
    })
  })
}

const newProcess = async () => {
  // 检查是否已被停止
  if (isStopped.value) {
    return
  }

  // 创建新的AbortController
  abortController = new AbortController()
  
  const image = props.message.userContent.attachments?.image
  if (!image) {
    console.error('No image attachment found')
    return
  }
  
  let cdnUrlQuiz = image?.cdnUrl_quiz
  
  // 🔑 统一等待机制
  if (!cdnUrlQuiz) {
    // 再次检查是否已被停止
    if (isStopped.value) {
      return
    }
    
    try {
      // Layer 模式：await uploadPromise
      if (props.uploadPromise) {
        cdnUrlQuiz = await waitForCdnUrl({
          uploadPromise: props.uploadPromise,
          urlKey: 'cdnUrl_quiz',
          timeout: 30000
        })
      }
      // 侧边栏模式：watch fileStack（传入 fileStack）
      else {
        const fileStackKey = props.message.userContent.fileStackKey
        if (fileStackKey) {
          cdnUrlQuiz = await waitForCdnUrl({
            fileStack: globalUpload.fileStack,  // 🔑 传入 fileStack
            fileStackKey,
            cdnKey: 'cdnUrl_imageToQuiz',
            timeout: 30000
          })
        }
      }
    } catch (error) {
      // 检查是否是取消错误
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Operation cancelled')) {
        // 如果是用户主动取消，不显示错误
        if (status.value === MessageStatus.STOP || isStopped.value) {
          return
        }
      }
      
      // 如果已经停止，忽略错误
      if (isStopped.value) {
        return
      }
      
      console.error('Waiting for quiz cdnUrl failed:', error)
      handleDone(MessageStatus.ERROR, ErrorType.NETWORK_ERROR, 'Network error. Please try again.')
      return
    }
  }
  
  if (!cdnUrlQuiz) {
    console.error('No cdnUrl_quiz available')
    return
  }
  
  // 检查是否被停止
  if (isStopped.value) {
    return
  }
  
  const cacheKey = simpleHash(cdnUrlQuiz)
  const cachedQuizUrl = defaultCache.get(cacheKey)
  if (cachedQuizUrl && typeof cachedQuizUrl === 'string') {
    quizUrl.value = cachedQuizUrl
    handleDone(MessageStatus.CACHED)
    return
  }
  
  quizUrl.value = buildQuizUrl(cdnUrlQuiz, image?.imageName)
  defaultCache.set(cacheKey, quizUrl.value)
  handleDone(MessageStatus.COMPLETED)
}

// 注册取消句柄
const registerCancelHandler = () => {
  const cancel = async () => {
    try {
      // 设置停止状态
      isStopped.value = true
      
      if (abortController) {
        abortController.abort()
      }
      
      // 更新状态为停止
      status.value = MessageStatus.STOP
      emit('statusChange', MessageStatus.STOP)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('ImageQuizMessage cancel error:', error)
      }
      throw error
    }
  }
  // 使用 inject 的 cancelRegistry（可选，侧边栏和 Layer 都有）
  cancelRegistry?.registerCancelable(props.message.id, cancel)
}

// 监听状态变化，自动滚动（与 AnswerMessage 对齐）
watch(
  () => status.value,
  (newStatus) => {
    // 只在完成或缓存状态时滚动
    if (newStatus === MessageStatus.PENDING || newStatus === MessageStatus.COMPLETED || newStatus === MessageStatus.CACHED) {
      smartScroll()
      emit('messageUpdate')
    }
  }
)

// 监听消息状态变化
watch(
  () => props.message.status,
  (next) => {
    status.value = next
    if (next === MessageStatus.STOP) {
      // 当状态变为STOP时，取消当前请求
      if (abortController) {
        abortController.abort()
      }
    }
  }
)

// 组件挂载时开始处理
onMounted(async () => {
  // 🎯 检查是否有预加载数据（直接渲染模式）
  const preloadedData = props.message.preloadedData
  if (preloadedData && 'quizUrl' in preloadedData) {
    quizUrl.value = preloadedData.quizUrl
    status.value = MessageStatus.COMPLETED
    emit('statusChange', MessageStatus.COMPLETED)
    return
  }

  // 🚀 正常请求模式
  // 🎯 立即发送 PENDING 状态
  emit('statusChange', MessageStatus.PENDING)
  registerCancelHandler()
  // 开始处理
  await newProcess()
  trackEvent.track('Plugin_sidebar_QuizPDFMessage_mounted')
})

// 组件卸载时清理
onUnmounted(() => {
  if (abortController) {
    abortController.abort()
  }
  // 使用 inject 的 cancelRegistry 注销
  cancelRegistry?.unregisterCancelable(props.message.id)

})
</script>
