import { ref, readonly, type Ref } from 'vue'
import emitter from '@/utils/eventBus'

export interface ContentScriptStatus {
  status: boolean
  isFile?: boolean // 只在 status: true 时存在
}

export interface CheckOptions {
  requireNonFileContext?: boolean // 是否要求不在文件上下文中（即 isFile 不为 true）
}

export interface UseContentScriptChecker {
  showModal: Readonly<Ref<boolean>>
  currentTabUrl: Readonly<Ref<string>>
  currentActionType: Readonly<Ref<'summary' | 'quiz' | null>>
  setCurrentActionType: (type: 'summary' | 'quiz' | null) => void
  getCurrentActionType: () => 'summary' | 'quiz' | null
  checkContentScript: () => Promise<ContentScriptStatus>
  checkAndShowModalIfUnavailable: (
    onSuccess?: () => void | Promise<void>,
    options?: CheckOptions
  ) => Promise<ContentScriptStatus>
  withContentScriptCheck: <T extends any[]>(
    handler: (...args: T) => void | Promise<void>,
    options?: CheckOptions
  ) => (...args: T) => Promise<void>
  openModal: () => void
  closeModal: () => void
  handleUpload: () => Promise<void>
}

/**
 * 内容脚本检查器 Composable
 */
export function useContentScriptChecker(): UseContentScriptChecker {
  // 弹层显示状态
  const showModal = ref(false)
  const currentTabUrl = ref('')
  // 全局状态：记录当前的操作类型
  const currentActionType = ref<'summary' | 'quiz' | null>(null)

  // 获取当前标签页URL
  const getCurrentTabUrl = async () => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      currentTabUrl.value = tab?.url || ''
    } catch (error) {
      console.error('Failed to get current tab URL:', error)
    }
  }

  // 设置当前操作类型
  const setCurrentActionType = (type: 'summary' | 'quiz' | null) => {
    currentActionType.value = type
  }

  // 获取当前操作类型
  const getCurrentActionType = () => {
    return currentActionType.value
  }

  /**
   * 检查当前活动标签页的内容脚本是否可用
   * @returns Promise<ContentScriptStatus>
   */
  const checkContentScript = async (): Promise<ContentScriptStatus> => {
    try {
      // 获取当前活动标签页
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (!tab?.id) {
        return { status: false }
      }

      // 检查扩展页面（我们的PDF查看器等）
      if (
        tab.url?.startsWith('chrome-extension://') &&
        tab.url?.includes('pdfView')
      ) {
        // 扩展页面视为可用，因为我们可以直接与它们通信
        return { status: true }
      }

      // 检查其他特殊页面
      if (
        tab.url?.startsWith('chrome://') ||
        tab.url?.startsWith('extension://') ||
        tab.url?.startsWith('moz-extension://')
      ) {
        return { status: false }
      }

      // 发送检测消息到内容脚本
      const response = await browser.tabs.sendMessage(tab.id, {
        type: 'CONTENT_SCRIPT_PING',
      })

      // 返回内容脚本的响应
      return {
        status: response?.status || false,
        isFile: tab.url?.startsWith('file://'),
      }
    } catch (error) {
      // 发送失败说明内容脚本不可用
      console.warn('Content script check failed:', error)
      return { status: false }
    }
  }

  /**
   * 检查内容脚本，如果不可用则自动显示弹层，可用则执行成功回调
   * @param onSuccess 检查通过时的回调函数
   * @param options 检查配置选项
   * @returns Promise<ContentScriptStatus>
   */
  const checkAndShowModalIfUnavailable = async (
    onSuccess?: () => void | Promise<void>,
    options?: CheckOptions
  ): Promise<ContentScriptStatus> => {
    const result = await checkContentScript()

    // 基础检查：内容脚本是否可用
    const basicCheck = result.status

    // 可选检查：是否要求非文件上下文
    const contextCheck = options?.requireNonFileContext
      ? result.isFile !== true
      : true

    // 综合检查结果
    const isCheckPassed = basicCheck && contextCheck

    if (isCheckPassed) {
      // 检查通过，执行成功回调
      if (onSuccess) {
        onSuccess()
      }
    } else {
      // 检查不通过，显示弹层
      await getCurrentTabUrl() // 获取当前URL用于显示
      showModal.value = true
    }

    return result
  }

  /**
   * 打开弹层
   */
  const openModal = async () => {
    await getCurrentTabUrl()
    showModal.value = true
  }

  /**
   * 关闭弹层
   */
  const closeModal = () => {
    showModal.value = false
  }

  /**
   * 处理上传按钮点击
   */
  const handleUpload = async () => {
    // 如果是本地文件，尝试直接获取文件内容
    if (currentTabUrl.value?.startsWith('file://')) {
      try {
        await handleLocalFileUpload()
      } catch (error) {
        console.error('Failed to upload local file directly:', error)
        // 如果直接上传失败，回退到文件选择器,这边的逻辑可要可不要，暂且保留
        emitter.emit('trigger-file-upload')
      }
    } else {
      // 非本地文件，使用文件选择器
      emitter.emit('trigger-file-upload')
    }
    closeModal()
  }

  /**
   * 处理本地文件直接上传
   */
  const handleLocalFileUpload = async () => {
    const actionType = currentActionType.value
    try {
      // 从URL中提取文件路径
      const fileUrl = currentTabUrl.value
      // 使用 decodeURIComponent 解码文件名
      const fileName = decodeURIComponent(fileUrl.split('/').pop() || 'document.pdf')
      
      // 检查文件类型
      const isPdf = fileName.toLowerCase().endsWith('.pdf')
      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)
      
      if (!isPdf && !isImage) {
        throw new Error('Unsupported file type')
      }
      
      // 创建文件对象（这里我们需要从URL获取文件内容）
      // 由于浏览器安全限制，我们需要通过fetch获取文件内容
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch file')
      }
      
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: blob.type })
      
      // 标记为从URL获取的文件
      ;(file as any).isPdfFromUrl = isPdf
      ;(file as any).pdfUrl = fileUrl
      
      // 通过事件总线发送文件进行上传，并传递操作类型
      emitter.emit('upload-local-file-from-modal', { file, actionType })
    } catch (error) {
      console.error('Error uploading local file:', error)
      throw error
    }
  }

  /**
   * 工厂函数：包装事件处理函数，自动执行内容脚本检查
   * @param handler 原始事件处理函数
   * @param options 检查配置选项
   * @returns 包装后的事件处理函数
   */
  const withContentScriptCheck = <T extends any[]>(
    handler: (...args: T) => void,
    options?: CheckOptions
  ) => {
    return async (...args: T): Promise<void> => {
      await checkAndShowModalIfUnavailable(() => handler(...args), options)
    }
  }

  return {
    showModal: readonly(showModal),
    currentTabUrl: readonly(currentTabUrl),
    currentActionType: readonly(currentActionType),
    setCurrentActionType,
    getCurrentActionType,
    checkContentScript,
    checkAndShowModalIfUnavailable,
    withContentScriptCheck,
    openModal,
    closeModal,
    handleUpload,
  }
}

export default useContentScriptChecker()
