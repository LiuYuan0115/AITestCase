import { ref, computed, watch } from 'vue'
import globalUpload from '@/entrypoints/sidepanel/composables/useGlobalUpload'
import emitter from '@/utils/eventBus'
const { currentFileStackKey, fileStack, addFile2Stack, createFileSelector } =
  globalUpload

// 类型定义
export type StagingStatus = 'empty' | 'uploading' | 'loaded'
export type StagingType = 'pdf' | 'image' | 'web'
export type StagingFileInfo_PDF = {
  fileType: 'pdf'
  cdnUrl: string
  cdnUrl_exceed: string
  cdnUrl_To_Quiz: string
  fileName: string
  isStored: boolean
  sessionId: string
  file: File
}
export type StagingFileInfo_IMAGE = {
  fileType: 'image'
  cdnUrl: string
  cdnUrl_To_Quiz: string
  cdnUrl_To_Summarize: string
  fileName: string
  isStored: boolean
  sessionId: string
  file: File
  base64: string
}
export type StagingFileInfo_WEB = {
  fileType: 'web'
  cdnUrl: string
  fileName: string
  webUrl: string
  webName: string
}
// fileStack 业务层类型
export type FileStackInfo = {
  fileType: string
  fileName: string
  file: File
  progress: number
  fileStatus: string
  cdnUrl?: string
  cdnUrl_exceed?: string
  imageBase64?: string
  isStored?: boolean
  from?: 'Chat_with_pdf' | 'Upload_Click' | 'Upload_Drag' | 'Upload_Popup' | 'Upload_Paste' | 'Chat_Send'
  [key: string]: any
}
// UI 扩展字段
export type UIExtraFields = {
  cdnUrl_To_Quiz?: string
  cdnUrl_To_Summarize?: string
  sessionId?: string
  base64?: string
  webUrl?: string
  webName?: string
  // ...其他UI专用字段
}
// UI 层类型
export type StagingFileInfo = (FileStackInfo & UIExtraFields) | null

// 创建单例实例
let instance: ReturnType<typeof createFileStagingUIStatus> | null = null

function createFileStagingUIStatus() {
  const stagingStatus = ref<StagingStatus>('empty')
  const stagingType = ref<StagingType>('pdf')
  const stagingProgress = ref(0)
  const stagingFileInfo = ref<StagingFileInfo>(null)
  const stagingIsShow = computed(() => {
    return stagingStatus.value !== 'empty'
  })

  // favicon 相关逻辑
  const currentFaviconProviderIndex = ref(0)
  const backupFaviconProviders = [
    (hostname: string) =>
      `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
    (hostname: string) => `https://icon.horse/icon/${hostname}`,
    (hostname: string) =>
      `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${hostname}&size=32`,
  ]
  function getFaviconUrl(webUrl: string) {
    try {
      const urlObj = new URL(webUrl)
      return backupFaviconProviders[currentFaviconProviderIndex.value](
        urlObj.hostname
      )
    } catch {
      return null
    }
  }
  function handleFaviconError() {
    if (!stagingFileInfo.value || !('webUrl' in stagingFileInfo.value)) return
    if (currentFaviconProviderIndex.value < backupFaviconProviders.length - 1) {
      currentFaviconProviderIndex.value++
      stagingFileInfo.value.icon = getFaviconUrl(stagingFileInfo.value.webUrl!)
    } else {
      stagingFileInfo.value.icon = null
    }
  }
  // 新增：添加网页模式
  function addWebPage({
    webUrl,
    webName,
    imageSlices,
  }: {
    webUrl: string
    webName?: string
    imageSlices?: {
      longImage: string
      slices: string[]
      uploadManager?: any  // 支持流式截图上传管理器
      tileSize?: number    // 支持流式截图的切片大小
    }
  }) {
    emitter.emit('close-quote-staging')
    // 直接设置状态，不需要先 clearStaging
    currentFileStackKey.value = 'web'
    currentFaviconProviderIndex.value = 0
    stagingStatus.value = 'loaded'
    stagingType.value = 'web'
    stagingProgress.value = 100
    stagingFileInfo.value = {
      fileType: 'web',
      fileName: webName,
      webUrl,
      webName,
      icon: getFaviconUrl(webUrl),
      imageSlices,
    } as any
  }

  function addFileOrUrl(
    fileOrUrl: File | string,
    needHide: boolean = false,
    onSuccess?: (fileInfo: FileStackInfo, key: string) => void,
    onError?: (error: Error) => void,
    from?: 'Chat_with_pdf' | 'Upload_Click' | 'Upload_Drag' | 'Upload_Popup' | 'Upload_Paste' | 'Chat_Send',
    options?: {
      fileName?: string
    }
  ) {
    clearStaging()
    addFile2Stack(fileOrUrl, needHide, onSuccess, onError, from, options)
  }

  function createFilePicker(from?: 'Upload_Click' | 'Upload_Drag' | 'Upload_Popup' | 'Upload_Paste' | 'Chat_Send') {
    createFileSelector(from)
  }

  watch(
    () => fileStack.value[currentFileStackKey.value],
    (val) => {
      // 如果当前 key 是 'web'，则不监听 fileStack 的变化
      if (currentFileStackKey.value === 'web') return

      if (!val) {
        stagingStatus.value = 'empty'
        stagingType.value = 'pdf'
        stagingProgress.value = 0
        stagingFileInfo.value = null
      } else {
        // 合并业务字段和UI字段，UI字段优先
        stagingProgress.value = val?.progress ?? 0
        stagingStatus.value = val?.fileStatus ?? 'empty'
        stagingType.value = val?.fileType ?? 'pdf'
        stagingFileInfo.value = {
          ...stagingFileInfo.value,
          ...val,
        }
      }
    },
    { immediate: true, deep: true }
  )

  function clearStaging() {
    stagingStatus.value = 'empty'
    stagingType.value = 'pdf'
    stagingProgress.value = 0
    stagingFileInfo.value = null
    currentFileStackKey.value = ''
  }

  return {
    stagingStatus,
    stagingType,
    stagingProgress,
    stagingFileInfo,
    stagingIsShow,
    clearStaging,
    addWebPage,
    addFileOrUrl,
    createFilePicker,
    handleFaviconError,
    currentFileStackKey,
  }
}

function useFileStagingUIStatus() {
  if (!instance) {
    instance = createFileStagingUIStatus()
  }
  return instance
}

export default useFileStagingUIStatus
