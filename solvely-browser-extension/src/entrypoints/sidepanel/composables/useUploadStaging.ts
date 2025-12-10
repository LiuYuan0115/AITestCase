import { ref, type Ref, watch } from 'vue'
import {
  fileToBase64,
  generateHashesFromBase64,
  generateHashesFromFile,
  convertBase64ToBlob,
} from '@/utils/fileConverter'
import { getTrpc } from '@/lib/trpc/client'
import axios from 'axios'
import useAuth from './useAuth'
import defaultCache from '../utils/cache'
import { ref as vueRef } from 'vue'
import { ErrorMessage, ErrorType } from '../types/message'
import { getPdfUploadUrl } from '@/api'
import emitter from '@/utils/eventBus'
import trackEvent from '@/utils/trackEvent'
import { PDFDocument } from 'pdf-lib'

const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_PDF_PAGES = 50

const MAX_PDF_PAGES_SOLVE = 20
const MAX_PDF_PAGES_SUMMARIZE = 50
const MAX_PDF_PAGES_GENERATE_QUIZ = 50

const UPLOAD_TIMEOUT = 60000 // 30秒超时
const DOWNLOAD_TIMEOUT = 60000 // 30秒超时

// 缓存数据类型定义
interface FileCacheData {
  fileUrl: string
  fileName: string
  fileHash: string
}

// 下载缓存数据类型 - 只缓存 File 对象，避免重复存储
interface DownloadCacheData {
  file: File
  title: string
  timestamp: number
  // 注意：File 对象包含 blob，避免重复存储
}

interface FileUploadOptions {
  accept?: string
  maxSize?: number
  onFileSelect?: (file: File) => void
  onError?: (error: Error, pdfId?: number) => void
  onProgress?: (progress: number) => void
  onUploadSuccess?: (url: string, pdfId?: number) => void
  onBusy?: (msg: string) => void
}

interface UploadStagingReturn {
  uploadStaging: (file?: File, url?: string, pdfId?: number) => Promise<void>
  clearUpload: (isManualClose?: boolean) => void
  uploadProgress: Ref<number>
  fileType: Ref<string | null>
  fileName: Ref<string | null>
  isUploading: Ref<boolean>
  isVisible: Ref<boolean>
  uploadStatus: Ref<'idle' | 'uploading' | 'completed' | 'error'>
  uploadedFile: Ref<File | null> // 新增声明
  uploadedImageBase64: Ref<string | null> // 新增声明
  processUploadPDF: (
    pdfFile: File,
    onProgress?: (progress: number) => void,
    onError?: (error: Error) => void,
    onSuccess?: (url: string) => void
  ) => Promise<string> // 新增声明：PDF文件上传
  downloadAndCheckPdf: (
    url: string,
    maxSize?: number,
    maxPages?: number
  ) => Promise<{ arrayBuffer: ArrayBuffer; title: string; file: File }> // 新增声明：下载并检查PDF
}

// 单任务场景下的AbortController
const currentAbortController = vueRef<AbortController | null>(null)
// 添加标记来区分是手动关闭还是定时器关闭
const isManualAbort = vueRef<boolean>(false)

// 用axios上传S3的底层方法，支持进度回调
const uploadS3byAxios = async (
  url: string,
  blob: Blob,
  md5: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<void> => {
  // 根据文件类型设置Content-Type
  const contentType =
    blob.type === 'application/pdf' ? 'application/pdf' : 'image/webp'

  await axios.put(url, blob, {
    headers: {
      'Content-MD5': md5,
      'Content-Type': contentType,
    },
    onUploadProgress: (event) => {
      if (event.total) {
        const progress = (event.loaded / event.total) * 100
        onProgress?.(progress)
      }
    },
    signal: signal,
  })
}

// 上传文件到S3的方法，再包装
export const uploadToS3WithProgress = async (
  file: File,
  base64Data: string,
  fileHash: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    // 判断文件类型
    const isPdf = file.type === 'application/pdf'

    // 创建超时控制器
    const controller = new AbortController()
    currentAbortController.value = controller // 记录当前controller
    isManualAbort.value = false // 重置手动关闭标记

    let timeoutTriggered = false
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true
      controller.abort()
    }, UPLOAD_TIMEOUT) // 30秒超时

    try {
      // 根据文件类型获取预签名URL
      let uploadUrl, cdnUrl
      if (isPdf) {
        const res = await getPdfUploadUrl({
          files: [
            {
              fileName: file.name,
              contentMD5: fileHash,
            },
          ],
        })
        uploadUrl = res.data[0].url
        cdnUrl = res.data[0].cdnUrl
      } else {
        const res = await getTrpc().getUploadUrl.mutate({
          deviceId: '',
          files: [
            {
              fileName: file.name,
              contentMD5: fileHash,
            },
          ],
        })
        uploadUrl = res[0].url
        cdnUrl = res[0].cdnUrl
      }

      // 使用三元生成blob，替代原有的convertBase64ToBlob
      const blob = isPdf ? file : convertBase64ToBlob(base64Data, 'image/webp')

      // 使用三元生成base64Hash
      const { base64Hash } = isPdf
        ? await generateHashesFromFile(file)
        : await generateHashesFromBase64(base64Data)

      // 使用axios方法上传（带进度和超时）
      await uploadS3byAxios(
        uploadUrl,
        blob,
        base64Hash,
        onProgress,
        controller.signal
      )

      // 清除超时定时器
      clearTimeout(timeoutId)
      currentAbortController.value = null // 释放
      isManualAbort.value = false // 重置标记

      // 埋点：上传成功
      trackEvent.track('Plugin_Sidebar_FileUpload_Success', {
        Type: isPdf ? 'PDF' : 'Image',
      })

      return cdnUrl
    } catch (error) {
      // 清除超时定时器
      clearTimeout(timeoutId)
      currentAbortController.value = null // 释放

      // 检查是否是超时错误
      if (error instanceof Error && error.name === 'CanceledError') {
        // 只有定时器触发的超时才报网络错误
        if (timeoutTriggered && !isManualAbort.value) {
          throw new Error(ErrorMessage[ErrorType.NETWORK_ERROR])
        }
        // 手动关闭不报错
        throw new Error('Upload canceled')
      }
      throw error
    }
  } catch (error) {
    currentAbortController.value = null // 释放
    isManualAbort.value = false // 重置标记
    console.error('S3上传失败:', error)
    throw error
  }
}

// 下载并检查PDF的方法
const downloadAndCheckPdf = async (
  url: string,
  maxSize: number = MAX_PDF_SIZE,
  maxPages: number = MAX_PDF_PAGES
): Promise<{ arrayBuffer: ArrayBuffer; title: string; file: File }> => {
  // 步骤1: 检查下载缓存
  const downloadCacheKey = `download_${url}`
  const cachedDownloadData =
    defaultCache.get<DownloadCacheData>(downloadCacheKey)
  if (cachedDownloadData) {
    console.log('downloadAndCheckPdf: 文件缓存命中，直接返回缓存数据')
    // 从 File 对象重新生成 arrayBuffer
    const arrayBuffer = await cachedDownloadData.file.arrayBuffer()
    return {
      arrayBuffer,
      title: cachedDownloadData.title,
      file: cachedDownloadData.file,
    }
  }

  let size = 0
  let blob: Blob | null = null

  let timeoutTriggered = false
  try {
    // 创建超时控制器
    const controller = new AbortController()
    currentAbortController.value = controller // 记录当前controller
    isManualAbort.value = false // 重置手动关闭标记

    const timeoutId = setTimeout(() => {
      timeoutTriggered = true
      controller.abort()
    }, DOWNLOAD_TIMEOUT) // 30秒超时

    try {
      // 先尝试HEAD请求获取文件大小
      const headResp = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      })
      const contentLength = headResp.headers.get('Content-Length')

      if (contentLength) {
        size = parseInt(contentLength, 10)
        if (isNaN(size) || size > maxSize) {
          throw new Error(ErrorMessage[ErrorType.PDF_SIZE_TOO_LARGE])
        }
        const resp = await fetch(url, { signal: controller.signal })
        blob = await resp.blob()
      } else {
        const resp = await fetch(url, { signal: controller.signal })
        blob = await resp.blob()
        size = blob.size
        if (size > maxSize) {
          throw new Error(ErrorMessage[ErrorType.PDF_SIZE_TOO_LARGE])
        }
      }

      // 清除超时定时器
      clearTimeout(timeoutId)
      currentAbortController.value = null // 释放
      isManualAbort.value = false // 重置标记

      if (!blob) {
        throw new Error('Failed to download PDF')
      }

      const arrBuf = await blob.arrayBuffer()

      // 使用pdf-lib检查页数
      let pdfDoc
      let title = 'document.pdf'
      
      try {
        pdfDoc = await PDFDocument.load(arrBuf, { ignoreEncryption: true })
        title = pdfDoc.getTitle() || 'document.pdf'
      } catch (pdfError) {
        console.error('PDF解析失败 - useUploadStaging:', {
          error: pdfError,
          url: url,
          fileSize: arrBuf.byteLength
        })
        // 如果PDF解析失败，使用默认标题
        title = 'document.pdf'
      }

      // 0.3.0暂时不限制页数
      // const pageCount = pdfDoc?.getPageCount()
      // if (pageCount && pageCount > maxPages) {
      //   throw new Error(`The file exceeds ${maxPages} pages. Please try another file.`)
      // }

      // 创建File对象，使用PDF的真实标题作为文件名
      const file = new File([blob], title, { type: 'application/pdf' })

      // 步骤2: 设置下载缓存（只缓存 File 对象）
      const downloadData: DownloadCacheData = {
        file,
        title,
        timestamp: Date.now(),
      }
      // 设置 30 分钟的 TTL，避免内存占用过久
      defaultCache.set(downloadCacheKey, downloadData, 30 * 60 * 1000)

      // 浏览器自动下载file
      // const urlNew = URL.createObjectURL(file)
      // const a = document.createElement('a')
      // a.href = urlNew
      // a.download = title
      // a.click()
      // URL.revokeObjectURL(urlNew)
      return { arrayBuffer: arrBuf, title, file }
    } catch (error) {
      // 清除超时定时器
      clearTimeout(timeoutId)
      currentAbortController.value = null // 释放
      isManualAbort.value = false // 重置标记

      // 检查是否是超时错误
      if (error instanceof Error && error.name === 'AbortError') {
        // 只有定时器触发的超时才报网络错误
        if (timeoutTriggered && !isManualAbort.value) {
          throw new Error(ErrorMessage[ErrorType.NETWORK_ERROR])
        } else {
          throw new Error('Download canceled')
        }
      }

      // 重新抛出其他错误
      throw error
    }
  } catch (error) {
    currentAbortController.value = null // 释放
    isManualAbort.value = false // 重置标记
    throw error
  }
}

// 处理PDF文件上传的完整流程
const processUploadPDF = async (
  pdfFile: File,
  onProgress?: (progress: number) => void,
  onError?: (error: Error) => void,
  onSuccess?: (url: string) => void
): Promise<string> => {
  try {
    onProgress?.(0)

    // 步骤1: 检查缓存 (0-10%)
    const base64 = await fileToBase64(pdfFile)
    const { combinedHash } = await generateHashesFromBase64(base64)
    const cacheKey = `file_${combinedHash}`
    const cachedData = defaultCache.get<FileCacheData>(cacheKey)

    if (cachedData && cachedData.fileUrl && cachedData.fileName) {
      onProgress?.(100)
      onSuccess?.(cachedData.fileUrl)
      return cachedData.fileUrl
    }
    onProgress?.(10)

    // 步骤2: 检查文件大小和格式 (10-15%)
    if (pdfFile.size > MAX_PDF_SIZE) {
      const error = new Error(ErrorMessage[ErrorType.PDF_SIZE_TOO_LARGE])
      onError?.(error)
      throw error
    }

    if (pdfFile.type !== 'application/pdf') {
      const error = new Error('Invalid PDF file type')
      onError?.(error)
      throw error
    }
    onProgress?.(15)

    // 步骤3: 生成哈希 (15-20%)
    onProgress?.(20)

    // 步骤4: 上传到S3 (20-100%)
    const cdnUrl = await uploadToS3WithProgress(
      pdfFile,
      base64,
      combinedHash,
      (progress) => {
        // 将S3上传进度映射到20%-100%的范围
        const mappedProgress = 20 + progress * 0.8
        onProgress?.(mappedProgress)
      }
    )

    // 步骤5: 缓存结果 (100%)
    const cacheData: FileCacheData = {
      fileUrl: cdnUrl,
      fileName: pdfFile.name,
      fileHash: combinedHash,
    }
    defaultCache.set(cacheKey, cacheData)

    onProgress?.(100)
    onSuccess?.(cdnUrl)

    return cdnUrl
  } catch (error) {
    // 检查是否是手动取消的错误
    if (
      error instanceof Error &&
      (error.message === 'Upload canceled' ||
        error.message === 'Download canceled')
    ) {
      // 手动取消不报错，静默处理
      console.log('PDF文件上传被手动取消')
      throw error
    }
    onError?.(new Error(ErrorMessage[ErrorType.NETWORK_ERROR]))
    throw error
  }
}

// 上传文件总方法
function useUploadStaging(
  options: FileUploadOptions = {}
): UploadStagingReturn {
  const {
    accept = 'image/*,.pdf',
    maxSize = MAX_PDF_SIZE,
    onError,
    onProgress,
    onUploadSuccess,
    onBusy,
  } = options

  // 注入 auth
  const auth = useAuth()

  // 响应式状态
  const uploadProgress = ref<number>(0)
  const fileType = ref<string | null>(null)
  const fileName = ref<string | null>(null)
  const isUploading = ref<boolean>(false)
  const isVisible = ref<boolean>(false)
  const uploadStatus = ref<'idle' | 'uploading' | 'completed' | 'error'>('idle')
  const uploadedFile = ref<File | null>(null)
  // 新增：图片base64缩略图
  const uploadedImageBase64 = ref<string | null>(null)

  // 标记是否有待处理的上传请求
  let pendingUploadRequest = false
  // 添加文件暂存，保存拖拽的文件或chat with pdf的File
  let pendingFile: File | null = null

  // 监听登录状态变化，清空或自动恢复上传
  watch(
    () => auth.isAuthenticated.value,
    (newValue) => {
      if (!newValue) {
        // 用户退出登录，清理上传状态（不是手动关闭）
        clearUpload(false)
        pendingUploadRequest = false
        pendingFile = null
      } else if (pendingUploadRequest && pendingFile) {
        // 登录成功且有待处理的上传请求和文件，自动触发上传
        pendingUploadRequest = false
        const fileToUpload = pendingFile
        pendingFile = null
        uploadStaging(fileToUpload)
      }
    }
  )

  // 清空上传状态
  const clearUpload = (isManualClose = false): void => {
    if (isManualClose && currentAbortController.value) {
      isManualAbort.value = true // 标记为手动关闭
    }
    abortCurrentTask(isManualClose) // 传递手动关闭标记
    uploadProgress.value = 0
    fileType.value = null
    fileName.value = null
    isUploading.value = false
    isVisible.value = false
    uploadStatus.value = 'idle'
    // 新增：清空本地文件对象和图片base64
    uploadedFile.value = null
    uploadedImageBase64.value = null
  }

  // 获取文件扩展名
  const getFileExtension = (file: File): string => {
    const fileName = file.name
    const lastDotIndex = fileName.lastIndexOf('.')
    if (lastDotIndex === -1) return 'unknown'

    const extension = fileName.substring(lastDotIndex + 1).toUpperCase()
    return extension
  }

  // 判断文件类型（返回扩展名）
  const getFileType = (file: File): string => {
    if (file.type === 'application/pdf') return 'PDF'

    if (file.type.startsWith('image/')) {
      const extension = getFileExtension(file)
      // 映射常见的图片格式
      const imageExtensions: { [key: string]: string } = {
        JPG: 'JPEG',
        JPEG: 'JPEG',
        PNG: 'PNG',
        WEBP: 'WEBP',
      }
      // 明确排除 HEIC 文件
      if (
        extension === 'HEIC' ||
        extension === 'HEIF' ||
        file.type === 'image/heic' ||
        file.type === 'image/heif'
      ) {
        return 'unknown'
      }
      return imageExtensions[extension] || extension
    }

    return 'unknown'
  }

  // 处理文件上传流程
  const processFileUpload = async (file: File, pdfId?: number): Promise<void> => {
    if (!pdfId) {
      emitter.emit('upload-fail-from-chat-with-pdf', 'error')
    }
    try {
      isUploading.value = true
      uploadStatus.value = 'uploading'
      uploadProgress.value = 0
      fileName.value = file.name
      isVisible.value = true
      onProgress?.(0)
      // 新增：保存本地文件对象
      uploadedFile.value = file

      // 判断文件类型
      const type = getFileType(file)
      fileType.value = type

      if (type === 'unknown') throw new Error('Unsupported file type')

      // 转换为Base64
      uploadProgress.value = 10
      onProgress?.(10)
      const base64 = await fileToBase64(file)

      // 新增：如果是图片，保存base64缩略图
      if (type !== 'PDF') {
        uploadedImageBase64.value = base64
      } else {
        uploadedImageBase64.value = null
      }

      // 生成哈希
      uploadProgress.value = 20
      onProgress?.(20)
      const { combinedHash } = await generateHashesFromBase64(base64)

      // 检查缓存 - 使用文件哈希作为缓存键
      const cacheKey = `file_${combinedHash}`
      const cachedData = defaultCache.get<FileCacheData>(cacheKey)
      if (cachedData && cachedData.fileUrl && cachedData.fileName) {
        fileName.value = cachedData.fileName
        uploadProgress.value = 100
        uploadStatus.value = 'completed'
        // 缓存命中时也要设置 uploadedFile，确保 fileInfo 可用
        uploadedFile.value = file
        onProgress?.(100)
        onUploadSuccess?.(cachedData.fileUrl, pdfId)
        return
      }

      // 使用axios上传到S3（带实时进度）
      const cdnUrl = await uploadToS3WithProgress(
        file,
        base64,
        combinedHash,
        (progress) => {
          // 将S3上传进度映射到20%-100%的范围
          const mappedProgress = 20 + progress * 0.8
          uploadProgress.value = mappedProgress
          onProgress?.(mappedProgress)
        }
      )

      // 上传成功后缓存文件数据
      const cacheData: FileCacheData = {
        fileUrl: cdnUrl,
        fileName: file.name,
        fileHash: combinedHash,
      }
      defaultCache.set(cacheKey, cacheData)

      uploadProgress.value = 100
      uploadStatus.value = 'completed'
      onProgress?.(100)
      onUploadSuccess?.(cdnUrl, pdfId)
    } catch (error) {
      uploadStatus.value = 'error'
      // 检查是否是手动取消的错误
      if (
        error instanceof Error &&
        (error.message === 'Upload canceled' ||
          error.message === 'Download canceled')
      ) {
        // 手动取消不报错，静默处理
        uploadStatus.value = 'idle'
        return
      }
      // 如果是网络错误
      onError?.(new Error(ErrorMessage[ErrorType.NETWORK_ERROR]))
    } finally {
      isUploading.value = false
    }
  }

  // 处理文件上传的核心逻辑
  const handleFileUpload = async (file: File, pdfId?: number): Promise<void> => {
    // 1. 检查是否与当前文件相同
    if (uploadedFile.value && uploadStatus.value === 'completed') {
      try {
        // 生成新文件的哈希
        const base64 = await fileToBase64(file)
        const { combinedHash: newFileHash } = await generateHashesFromBase64(
          base64
        )

        // 生成当前文件的哈希
        const currentBase64 = await fileToBase64(uploadedFile.value)
        const { combinedHash: currentFileHash } =
          await generateHashesFromBase64(currentBase64)

        // 如果文件哈希相同，说明是同一份文件，跳过处理
        if (newFileHash === currentFileHash) {
          return
        }
      } catch (error) {
        // ignore
      }
    }

    // 2. 开始处理文件上传，提前清理状态（不是手动关闭）
    clearUpload(false)
    await processFileUpload(file, pdfId)
  }

  // 创建文件选择器
  const createFileSelector = (): void => {
    const fileInput: HTMLInputElement = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = accept
    fileInput.style.display = 'none'

    // 监听文件选择事件
    fileInput.addEventListener('change', async (event: Event) => {
      const target = event.target as HTMLInputElement
      const files: FileList | null = target.files

      if (files && files.length > 0) {
        const selectedFile: File = files[0]
        if (await preUploadCheck(selectedFile))
          // 清空文件暂存区的所有文件包括UI状态
          emitter.emit('clear-file-staging')
          await handleFileUpload(selectedFile)
      }

      // 清理DOM元素
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput)
      }
    })

    // 添加错误处理
    fileInput.addEventListener('error', (event: Event) => {
      const error = new Error('文件选择器出现错误')
      onError?.(error)

      // 清理DOM元素
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput)
      }
    })

    // 添加到DOM并触发点击
    document.body.appendChild(fileInput)
    fileInput.click()
  }

  // 公共的预检查逻辑
  const preUploadCheck = async (file?: File): Promise<boolean> => {
    // 如果正在上传中，直接返回，避免并发上传
    if (isUploading.value) {
      onBusy?.('Please wait for the current upload to complete.')
      return false
    }
    // 检查登录状态
    const isLoggedIn = await auth.getAuthStatus()
    if (!isLoggedIn) {
      // 未登录，标记有待处理的上传请求并保存文件（支持chat with pdf和普通文件）
      pendingUploadRequest = true
      if (file) {
        pendingFile = file
      }
      auth.showLoginModal()
      return false
    }

    // 如果传入了文件，进行文件检查
    if (file) {
      // 文件大小检查
      if (file.size > maxSize) {
        const error = new Error(
          `The file size exceeds ${Math.round(
            maxSize / 1024 / 1024
          )}MB. Please try another file.`
        )
        onError?.(error)
        return false
      }
    }

    return true
  }

  // 对外暴露一个方法，用于调用上传文件的方法
  const uploadStaging = async (file?: File, url?: string, pdfId?: number): Promise<void> => {
    console.log('当前正在上传的一个状态', isUploading.value, uploadStatus.value)  
    // 如果传入了url，则需要下载文件
    if (url) {
      const { file } = await downloadAndCheckPdf(url)
      // 当文件名没有 “.pdf” 后缀时，需要添加后缀
      let fileNew = file
      if (file.name) {
        // 去除特殊符号，只保留字母、数字、下划线、点和中划线
        let safeName = file.name.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '')
        const nameParts = safeName.split('.')
        if (nameParts.length === 1) {
          safeName = `${nameParts[0]}.pdf`
        }
        fileNew = new File([file], safeName, { type: file.type })
        console.log('fileNew---------------', file.name,safeName)
      }
      uploadStaging(fileNew, undefined, pdfId)
      return
    }

    // 统一前置校验（登录、大小、pendingFile等）
    if (!(await preUploadCheck(file))) {
      if (pdfId) {
        onError?.(new Error(ErrorMessage[ErrorType.NETWORK_ERROR]), pdfId)
      }
      return
    }

    // 普通文件
    if (file) {
      await handleFileUpload(file, pdfId)
      return
    }
    // 无file，弹出文件选择器
    createFileSelector()
  }

  // 新增：中断请求方法
  const abortCurrentTask = (isManual = false) => {
    if (currentAbortController.value) {
      if (isManual) {
        isManualAbort.value = true // 只有明确标记为手动时才设置
      }
      currentAbortController.value.abort()
      currentAbortController.value = null
    }
  }

  return {
    uploadStaging,
    clearUpload,
    uploadProgress: uploadProgress,
    fileType: fileType,
    fileName: fileName,
    isUploading: isUploading,
    isVisible: isVisible,
    uploadStatus: uploadStatus,
    uploadedFile, // 新增暴露
    uploadedImageBase64, // 新增暴露
    processUploadPDF, // 新增暴露：PDF文件上传
    downloadAndCheckPdf, // 新增暴露：下载并检查PDF
  }
}

export default useUploadStaging
