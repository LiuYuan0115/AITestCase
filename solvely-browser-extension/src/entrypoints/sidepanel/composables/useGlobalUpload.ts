import axios from 'axios'
import { getFlashcardsUploadUrl, getPdfUploadUrl, getUploadUrl } from '@/api'
import { PDFDocument } from 'pdf-lib'
import { ref } from 'vue'
import defaultCache from '../utils/cache'
import { truncatePdfIfNeeded, isPdfExceedsPageLimit } from '@/utils/pdfTruncate'
import { getTrpc } from '@/lib/trpc/client'
import emitter from '@/utils/eventBus'
import trackEvent from '@/utils/trackEvent'
import { PdfViewerMessageType } from '@/entrypoints/pdfView/types/messageTypes'

// 文件状态类型
export enum FileStatus {
  UPLOADING = 'uploading',
  LOADED = 'loaded',
  EMPTY = 'empty',
}
export enum FileType {
  PDF = 'pdf',
  IMAGE = 'image',
  WEB = 'web',
}
export type GlobalUploadType = ReturnType<typeof useGlobalUpload>
export type FileInfo = {
  fileType: FileType
  fileName: string
  fileNameFormat?: string
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
const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024 // 50MB

// 响应式变量
function useGlobalUpload() {
  // key是文件名字+文件md5
  const fileStack = ref<{
    [key: string]: {
      fileType: FileType
      fileName: string
      file: File
      fileNameFormat?: string
      cdnUrl?: string
      cdnUrl_exceed?: string
      imageBase64?: string
      isStored?: boolean
      from?: 'Chat_with_pdf' | 'Upload_Click' | 'Upload_Drag' | 'Upload_Popup' | 'Upload_Paste' | 'Chat_Send'
      progress: number
      fileStatus: FileStatus
      cdnUrl_imageToPdf?: string
      cdnUrl_imageToQuiz?: string
      cdnUrl_To_Quiz?: string
      isExceed?: boolean
      pdfPage?: number
    }
  }>({})
  const currentFileStackKey = ref<string>('')

  // 文件缓存相关
  const getFileCache = (
    md5: string
  ): { cdnUrl?: string; other?: any } | null => {
    const cacheKey = `file_${md5}`
    return defaultCache.get(cacheKey) as {
      cdnUrl?: string
      other?: any
    } | null
  }
  // 设置文件缓存
  const setFileCache = (md5: string, cdnUrl: string, other?: any) => {
    const cacheKey = `file_${md5}`
    defaultCache.set(cacheKey, { cdnUrl, other }, 24 * 60 * 60 * 1000)
  }
  // 定义底层上传S3的接口，带进度回调,库不带md5
  const uploadS3byAxios = async (
    url: string,
    blob: Blob,
    md5?: string,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    // 根据文件类型设置Content-Type
    const contentType =
      blob.type === 'application/pdf' ? 'application/pdf' : 'image/webp'
    const headers = {
      'Content-MD5': md5 || undefined,
      'Content-Type': contentType,
    }
    await axios.put(url, blob, {
      headers,
      onUploadProgress: (event) => {
        if (event.total) {
          const progress = (event.loaded / event.total) * 100
          onProgress?.(progress)
        }
      },
    })
  }
  // 图片上传获取预签名 https://dev-webserver.solvely.ai/uploadurl
  const getCdnUrl_Image = async (
    fileName: string,
    contentMD5: string
  ): Promise<{ uploadUrl: string; cdnUrl: string }> => {
    const res = await getUploadUrl({
      deviceId: '', // TODO:暂时不传
      files: [
        {
          fileName: fileName,
          contentMD5: contentMD5,
        },
      ],
    })
    return {
      uploadUrl: res.data[0].url,
      cdnUrl: res.data[0].cdnUrl,
    }
  }
  // PDF上传获取预签名 https://dev-webserver.solvely.ai/uploadurl/file
  const getCdnUrl_PDF = async (
    fileName: string,
    contentMD5: string
  ): Promise<{ uploadUrl: string; cdnUrl: string }> => {
    const res = await getPdfUploadUrl({
      files: [
        {
          fileName: fileName,
          contentMD5: contentMD5,
        },
      ],
    })
    return {
      uploadUrl: res.data[0].url,
      cdnUrl: res.data[0].cdnUrl,
    }
  }
  // Quiz上传获取预签名 https://flashcards-api.solvely.ai/v1/upload/batch-presigned-url
  const getCdnUrl_Quiz = async (
    fileName: string
  ): Promise<{ uploadUrl: string; cdnUrl: string }> => {
    const response = await getFlashcardsUploadUrl({
      files: [
        {
          fileName: fileName,
          fileType: 'pdf',
        },
      ],
    })
    const uploadInfo = response.data.urls[0]
    return {
      uploadUrl: uploadInfo.uploadUrl,
      cdnUrl: uploadInfo.fileUrl,
    }
  }
  // 获取PDF页数
  const getPdfPageCount = async (file: File): Promise<number> => {
    if (file.type !== 'application/pdf') return 0

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
      })
      return pdfDoc.getPageCount()
    } catch (error) {
      console.error('PDF解析失败 - getPdfPageCount:', {
        error: error,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
      return 0
    }
  }

  // 从url获取文件，自动获取文件名(超过50MB的文件无法下载)
  const getFileFromUrl = async (
    url: string,
    customFileName?: string
  ): Promise<File> => {
    // 先尝试 HEAD 请求获取文件大小
    const headResp = await fetch(url, { method: 'HEAD' })
    const contentLength = headResp.headers.get('Content-Length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      if (!isNaN(size) && size > MAX_DOWNLOAD_SIZE) {
        throw new Error(
          `File size exceeds the limit of ${
            MAX_DOWNLOAD_SIZE / (1024 * 1024)
          }MB`
        )
      }
    }
    const response = await fetch(url)
    const blob = await response.blob()
    // 再次兜底检查
    if (blob.size > MAX_DOWNLOAD_SIZE) {
      throw new Error(
        `File size exceeds the limit of ${MAX_DOWNLOAD_SIZE / (1024 * 1024)}MB`
      )
    }
    let fileName = customFileName || url.split('/').pop() || 'Document.pdf'

    if (blob.type === 'application/pdf' && !customFileName) {
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer, {
          ignoreEncryption: true,
        })
        const title = pdfDoc.getTitle()
        //encodeURIComponent
        // if (title) fileName = encodeURIComponent(title) + '.pdf'
        // if (title) fileName = title.replace(/\s+/g, '-') + '.pdf'
        if (title) fileName = title + '.pdf'
      } catch (e) {
        console.error('PDF解析失败 - getFileFromUrl:', {
          error: e,
          url: url,
          fileSize: blob.size,
          fileName: fileName,
        })
      }
    }

    return new File([blob], fileName, { type: blob.type })
  }
  // 添加文件到文件栈
  const addFile2Stack = async (
    fileOrUrl: File | string,
    needHide: boolean = false,
    onSuccess?: (fileInfo: FileInfo, key: string) => void,
    onError?: (error: Error) => void,
    from?:
      | 'Chat_with_pdf'
      | 'Upload_Click'
      | 'Upload_Drag'
      | 'Upload_Popup'
      | 'Upload_Paste'
      | 'Chat_Send',
    options?: {
      fileName?: string
    }
  ) => {
    console.log('addFile2Stack', fileOrUrl)
    emitter.emit('close-quote-staging')
    try {
      let key = ''
      let file =
        fileOrUrl instanceof File
          ? fileOrUrl
          : // ? new File([fileOrUrl], fileOrUrl.name.replace(/\s+/g, '-'),{type:fileOrUrl.type})
            // ? new File([fileOrUrl], encodeURIComponent(fileOrUrl.name),{type:fileOrUrl.type})
            new File([], 'Document.pdf')

      // 检查文件大小限制
      if (fileOrUrl instanceof File && fileOrUrl.size > MAX_UPLOAD_SIZE) {
        const error = new Error(
          `File size exceeds the limit of ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`
        )
        emitter.emit('upload-error', {
          fileName: fileOrUrl.name,
          error: error.message,
        })
        onError?.(error)
        return
      }
      // ================== 如果是url ==================
      if (typeof fileOrUrl === 'string') {
        // 1. 假进度条 0~30
        key = fileOrUrl
        const url = fileOrUrl
        const fileName =
          options?.fileName || url.split('/').pop() || 'Document.pdf'
        const tsForBackend = Date.now()
        const fileNameFormat = `pdf${tsForBackend}.pdf`
        if (!fileStack.value[key]) {
          fileStack.value[key] = {
            fileType: FileType.PDF,
            fileName: fileName,
            fileNameFormat: fileNameFormat,
            file: new File([], fileName),
            progress: 0,
            fileStatus: FileStatus.UPLOADING,
            from: from, // 添加来源信息
          }
        }
        if (!needHide) {
          currentFileStackKey.value = key
          if (fileStack.value[key].fileStatus === FileStatus.LOADED) {
            onSuccess?.(fileStack.value[key] as FileInfo, key)
            return
          }
        }
        let fakeProgress = 0
        const fakeTimer = setInterval(() => {
          if (fakeProgress < 30) {
            fakeProgress += 1
            fileStack.value[key].progress = fakeProgress
          }
        }, 150)
        try {
          file = await getFileFromUrl(url, options?.fileName)
        } catch (err) {
          clearInterval(fakeTimer)
          fileStack.value[key].progress = 0
          fileStack.value[key].fileStatus = FileStatus.EMPTY

          // 处理文件大小错误
          const error = err as Error
          if (error.message.includes('File size exceeds')) {
            emitter.emit('upload-error', {
              fileName:
                options?.fileName || url.split('/').pop() || 'Document.pdf',
              error: error.message,
            })
          }

          onError?.(error)
          currentFileStackKey.value = ''
          return
        }
        clearInterval(fakeTimer)
        fileStack.value[key].progress = 30
        // 如果外部传入了文件名，使用外部文件名；否则使用从URL获取的文件名（仅展示）
        fileStack.value[key].fileName = options?.fileName || file.name
        fileStack.value[key].file = file
      }
      const ext = getFileTypeExtension(file as File)
      console.log('ext', ext)
      if (ext === 'unknown' || ext === 'unsupported') {
        const error = new Error('Unsupported file type')
        emitter.emit('upload-error', {
          fileName: file.name,
          error: error.message,
        })
        onError?.(error)
        currentFileStackKey.value = ''
        return
      }
      // 获取文件md5
      const Type = getFileType(file as File)
      let timeStart = Date.now()
      // 获取key，文件名+时间戳
      // 如果有该任务就返回该任务，否则创建新任务，只有不是url才能走进来这个if
      if (!key && typeof fileOrUrl !== 'string') {
        key = `${fileOrUrl.name}-${timeStart}`
        if (!fileStack.value[key]) {
          fileStack.value[key] = {
            fileType: getFileType(fileOrUrl as File),
            fileName: fileOrUrl.name,
            fileNameFormat:
              getFileType(fileOrUrl as File) === FileType.PDF
                ? `pdf${Date.now()}.pdf`
                : undefined,
            file: fileOrUrl as File,
            progress: 0,
            fileStatus: FileStatus.UPLOADING,
            from: from, // 添加来源信息
          }
        } else {
          if (
            fileStack.value[key].fileStatus === FileStatus.UPLOADING &&
            !needHide
          ) {
            currentFileStackKey.value = key
            return
          }
        }
      }
      if (!needHide) {
        currentFileStackKey.value = key
      }
      // ================== 专门处理图片的并行上传逻辑 ==================
      if (Type === FileType.IMAGE) {
        try {
          console.log('🖼️ 开始处理图片上传:', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            lastModified: file.lastModified,
          })

          // 1. 先转 base64
          console.log('📝 开始转换图片为base64...')
          const base64_before = await fileToBase64(file)
          console.log('📝 base64转换完成，长度:', base64_before.length)

          const base64 = 'data:image/webp;base64,' + base64_before
          console.log('📝 构建完整base64 URL:', {
            prefix: 'data:image/webp;base64,',
            base64Length: base64_before.length,
            fullUrlLength: base64.length,
          })
          // 创建新的key，这边的key用图片的哈希
          // 先清除旧的key
          delete fileStack.value[key]
          key = base64.slice(0, 256)
          if (!fileStack.value[key]) {
            fileStack.value[key] = {
              fileType: FileType.IMAGE,
              fileName: file.name,
              file: file,
              progress: 35,
              fileStatus: FileStatus.UPLOADING,
              from: from, // 添加来源信息
            }
            fileStack.value[key].imageBase64 = base64
          } else {
            if (!needHide) {
              currentFileStackKey.value = key
            }
            return
          }
          if (!needHide) {
            currentFileStackKey.value = key
          }
          // 2. 转 PDF
          console.log('🔄 开始转换图片为PDF...')
          console.log('🔄 调用convertImageToPdf参数:', {
            base64Length: base64.length,
            imageName: file.name,
            originalFileName: file.name,
            originalFileType: file.type,
          })

          // 为图片转PDF生成仅用于上传的命名
          const imagePdfTs = Date.now()
          const pdfFileNameForUpload = `pdf${imagePdfTs}.pdf`
          // 记录到文件栈，仅用于上传使用
          fileStack.value[key].fileNameFormat = pdfFileNameForUpload

          const imageToPdf = await convertImageToPdf(base64, pdfFileNameForUpload)

          console.log('✅ 图片转PDF成功:', {
            pdfFileSize: imageToPdf.pdfFile.size,
            pdfFileName: imageToPdf.pdfFile.name,
            pdfBlobSize: imageToPdf.pdfBlob.size,
          })
          // 3. 进度变量
          let imageProgress = 0
          let pdfProgress = 0
          function updateTotalProgress() {
            fileStack.value[key].progress = Math.round(
              ((imageProgress + pdfProgress) / 2) * 0.65 + 35
            )
          }
          // 4. 并行上传 imageRes 和 pdfRes
          const [imageRes, pdfRes] = await Promise.all([
            (async () => {
              // 图片上传
              const { combinedHash, base64Hash } = await generateHashesFromFile(
                file
              )
              const cachedData = getFileCache(combinedHash)
              if (cachedData && cachedData.cdnUrl) {
                fileStack.value[key].cdnUrl = cachedData.cdnUrl
                imageProgress = 100
                updateTotalProgress()
                return cachedData.cdnUrl
              }
              const { uploadUrl, cdnUrl } = await getCdnUrl_Image(
                file.name,
                combinedHash
              )
              await uploadS3byAxios(uploadUrl, file, base64Hash, (progress) => {
                imageProgress = progress
                updateTotalProgress()
              })
              setFileCache(combinedHash, cdnUrl)
              fileStack.value[key].cdnUrl = cdnUrl
              imageProgress = 100
              updateTotalProgress()
              return cdnUrl
            })(),
            (async () => {
              // PDF上传
              const { combinedHash, base64Hash } = await generateHashesFromFile(
                imageToPdf.pdfFile
              )
              const cachedData = getFileCache(combinedHash)
              if (cachedData && cachedData.cdnUrl) {
                fileStack.value[key].cdnUrl_imageToPdf = cachedData.cdnUrl
                pdfProgress = 100
                updateTotalProgress()
                return cachedData.cdnUrl
              }
              const { uploadUrl, cdnUrl } = await getCdnUrl_PDF(
                fileStack.value[key].fileNameFormat || imageToPdf.pdfFile.name,
                combinedHash
              )
              await uploadS3byAxios(
                uploadUrl,
                imageToPdf.pdfFile,
                base64Hash,
                (progress) => {
                  pdfProgress = progress
                  updateTotalProgress()
                }
              )
              setFileCache(combinedHash, cdnUrl)
              fileStack.value[key].cdnUrl_imageToPdf = cdnUrl
              pdfProgress = 100
              updateTotalProgress()
              return cdnUrl
            })(),
          ])

          // 5. 异步上传 quizRes，不阻塞主流程
          ;(async () => {
            try {
              const { uploadUrl, cdnUrl } = await getCdnUrl_Quiz(
                fileStack.value[key].fileNameFormat || imageToPdf.pdfFile.name
              )
              await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'content-type': 'application/pdf' },
                body: imageToPdf.pdfFile,
              })
              fileStack.value[key].cdnUrl_imageToQuiz = cdnUrl
            } catch (error) {
              console.error('Quiz上传失败:', error)
            }
          })()
          fileStack.value[key].progress = 100
          fileStack.value[key].fileStatus = FileStatus.LOADED

          // 埋点：文件上传成功
          trackEvent.track('Plugin_Sidebar_FileUpload_Success', {
            fileType: 'image',
            fileName: file.name,
            cdnUrl: fileStack.value[key].cdnUrl,
            from: from,
          })

          onSuccess?.(fileStack.value[key] as FileInfo, key)
          return
        } catch (err) {
          const error = err as Error
          console.error('❌ 图片上传处理失败:', {
            error: error.message,
            errorStack: error.stack,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            key: key,
            currentFileStackKey: currentFileStackKey.value,
          })
          emitter.emit('upload-error', {
            fileName: file.name,
            error: error.message,
          })
          onError?.(error)
          currentFileStackKey.value = ''
          return
        }
      }
      // ================== PDF并行上传逻辑 ==================
      else if (Type === FileType.PDF) {
        try {
          // 1. 获取PDF页数并存储
          ;(async () => {
            const pdfPageCount = await getPdfPageCount(file)
            fileStack.value[key].pdfPage = pdfPageCount
          })()

          // 2. 检查是否超过20页
          const file_origin = file // 原始PDF文件
          let isExceed = false
          try {
            isExceed = await isPdfExceedsPageLimit(file, 20)
          } catch (e) {
            isExceed = false
          }
          if (isExceed) {
            fileStack.value[key].isExceed = true
            let truncated: File
            try {
              truncated = await truncatePdfIfNeeded(file, 20)
            } catch (e) {
              truncated = file
            }
            // 异步上传完整PDF，文件名加_exceed.pdf
            const exceedName = (() => {
              const ts = Date.now()
              return `pdf_exceed${ts}.pdf`
            })()
            // const exceedName = encodeURIComponent(
            //   file.name.replace(/\.pdf$/i, '_exceed.pdf')
            // )
            const file_exceed = new File([file], exceedName, {
              type: file.type,
            })
            // 异步上传完整PDF（埋点用，不阻塞主流程）
            ;(async () => {
              const { combinedHash, base64Hash } = await generateHashesFromFile(
                file_exceed
              )
              const cachedData = getFileCache(combinedHash)
              if (cachedData && cachedData.cdnUrl) {
                fileStack.value[key].cdnUrl_exceed = cachedData.cdnUrl
                setFileCache(combinedHash, file_exceed.name, cachedData.cdnUrl)
                return
              }
              const { uploadUrl, cdnUrl } = await getCdnUrl_PDF(
                exceedName,
                combinedHash
              )
              fileStack.value[key].cdnUrl_exceed = cdnUrl
              await uploadS3byAxios(uploadUrl, file_exceed, base64Hash)
              setFileCache(combinedHash, cdnUrl)
            })()
            file = truncated
          } else {
            fileStack.value[key].isExceed = false
          }
          // 2. 主流程：PDF上传到PDF CDN
          let pdfProgress = 0
          function updateTotalProgress() {
            fileStack.value[key].progress = Math.round(pdfProgress * 0.7 + 30)
          }

          // 为本次PDF上传生成仅用于上传的命名
          if (!fileStack.value[key].fileNameFormat) {
            fileStack.value[key].fileNameFormat = `pdf${Date.now()}.pdf`
          }

          // PDF上传
          const { combinedHash, base64Hash } = await generateHashesFromFile(
            file
          )
          const cachedData = getFileCache(combinedHash)
          if (cachedData && cachedData.cdnUrl) {
            fileStack.value[key].cdnUrl = cachedData.cdnUrl
            pdfProgress = 100
            updateTotalProgress()
          } else {
            const { uploadUrl, cdnUrl } = await getCdnUrl_PDF(
              fileStack.value[key].fileNameFormat || fileStack.value[key].fileName,
              combinedHash
            )
            await uploadS3byAxios(uploadUrl, file, base64Hash, (progress) => {
              pdfProgress = progress
              updateTotalProgress()
            })
            setFileCache(combinedHash, cdnUrl)
            fileStack.value[key].cdnUrl = cdnUrl
            pdfProgress = 100
            updateTotalProgress()
          }

          // 3. 异步上传：Quiz CDN（截取前50页PDF）
          ;(async () => {
            try {
              // 截取前50页PDF
              let quizPdfFile = file_origin
              try {
                quizPdfFile = await truncatePdfIfNeeded(file_origin, 50)
              } catch (e) {
                quizPdfFile = file_origin
              }
              const { uploadUrl, cdnUrl } = await getCdnUrl_Quiz(
                fileStack.value[key].fileNameFormat || quizPdfFile.name
              )
              await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'content-type': 'application/pdf' },
                body: quizPdfFile,
              })
              fileStack.value[key].cdnUrl_To_Quiz = cdnUrl
              console.log(fileStack.value[key].cdnUrl_To_Quiz, key)
            } catch (error) {
              console.error('faild:', error)
            }
          })()
          fileStack.value[key].progress = 100
          fileStack.value[key].fileStatus = FileStatus.LOADED
          onSuccess?.(fileStack.value[key] as FileInfo, key)

          // 埋点：文件上传成功，等待 cdnUrl_exceed 生成
          ;(async () => {
            let cdnUrlExceed = fileStack.value[key].cdnUrl_exceed

            // 如果需要等待 cdnUrl_exceed 生成
            if (fileStack.value[key].isExceed && !cdnUrlExceed) {
              try {
                cdnUrlExceed = await waitForExceedUrl(key, 30000) // 30秒超时
              } catch (error) {
                console.warn('cdnUrl_exceed timeout, sending undefined value')
                cdnUrlExceed = undefined
              }
            }

            trackEvent.track('Plugin_Sidebar_FileUpload_Success', {
              fileType: 'pdf',
              fileName: fileStack.value[key].fileName,
              fileSize: file.size,
              cdnUrl: fileStack.value[key].cdnUrl,
              cdnUrl_exceed: cdnUrlExceed,
              page: fileStack.value[key].pdfPage,
              isExceed: fileStack.value[key].isExceed,
              from: from,
            })
          })()
          trackEvent.track('Plugin_Sidebar_PDFpage_Show')
          openPDFDView(undefined, file_origin, key)
          return
        } catch (err) {
          const error = err as Error
          emitter.emit('upload-error', {
            fileName: file.name,
            error: error.message,
          })
          onError?.(error)
          currentFileStackKey.value = ''
          return
        }
      }
    } catch (error) {
      const err = error as Error
      // 对于 URL 下载失败的情况，使用 URL 作为文件名
      const fileName =
        typeof fileOrUrl === 'string'
          ? options?.fileName || fileOrUrl.split('/').pop() || 'Unknown file'
          : options?.fileName || fileOrUrl.name
      emitter.emit('upload-error', { fileName, error: err.message })
      onError?.(err)
      currentFileStackKey.value = ''
    }
  }
  const openPDFDView = async (
    cdnUrl?: string,
    file?: File,
    fileStackKey?: string,
    isMessageClick = false
  ) => {
    try {
      // 如果当前 key 不是传入的 key，则取消打开
      if (
        fileStackKey &&
        currentFileStackKey.value !== fileStackKey &&
        !isMessageClick
      )
        return

      let finalCdnUrl = cdnUrl
      if (fileStackKey && fileStack.value[fileStackKey]) {
        const stack = fileStack.value[fileStackKey]
        if (stack.isExceed) {
          // 等待 exceed URL 可用，最多等 5 秒
          try {
            finalCdnUrl = await waitForExceedUrl(fileStackKey, 5000)
          } catch (error) {
            console.warn(
              'Exceed URL not available within timeout, using regular URL'
            )
            finalCdnUrl = stack.cdnUrl
          }
        } else {
          finalCdnUrl = stack.cdnUrl
        }
      }

      // 构建PDF查看器URL - 不传cdn参数，直接打开
      const viewerUrl = chrome.runtime.getURL('pdfView.html')

      // 打开PDF查看器页面
      const tab = await chrome.tabs.create({ url: viewerUrl })

      // 如果有文件需要分片发送
      if (file && tab.id) {
        // 等待页面发送就绪消息
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            chrome.runtime.onMessage.removeListener(messageListener)
            reject(new Error('页面加载超时'))
          }, 15000) // 15秒超时

          const messageListener = (message: any, sender: any) => {
            if (
              message.type === 'PDF_VIEWER_READY' &&
              sender.tab?.id === tab.id
            ) {
              clearTimeout(timeout)
              chrome.runtime.onMessage.removeListener(messageListener)
              console.log('✅ PDF查看器页面就绪')
              resolve()
            }
          }

          chrome.runtime.onMessage.addListener(messageListener)
        })

        // 发送分片模式启动请求
        try {
          console.log('📤 准备发送分片模式启动请求到tab:', tab.id)
          // 使用 tabs.sendMessage 并添加重试机制
          let retryCount = 0
          const maxRetries = 3

          while (retryCount < maxRetries) {
            try {
              await chrome.tabs.sendMessage(tab.id!, {
                type: PdfViewerMessageType.START_CHUNK_MODE,
              })
              console.log('📤 分片模式启动请求已发送')
              break
            } catch (sendError) {
              retryCount++
              console.warn(
                `📤 启动请求发送失败，重试 ${retryCount}/${maxRetries}:`,
                sendError
              )
              if (retryCount >= maxRetries) {
                throw sendError
              }
              // 等待100ms后重试
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }
        } catch (error) {
          console.error('❌ 分片模式启动请求失败:', error)
          throw new Error('无法启动分片模式')
        }

        // 分片发送PDF数据
        const sendChunks = async () => {
          try {
            console.log('🚀 开始分片传输', {
              fileName: file.name,
              fileSize: file.size,
              tabId: tab.id,
            })

            const base64 = await fileToBase64(file)
            const chunkSize = 1 * 1024 * 1024 // 1MB
            const totalChunks = Math.ceil(base64.length / chunkSize)

            console.log('📦 分片配置:', {
              chunkSize,
              totalChunks,
              fileSize: file.size,
            })

            for (let i = 0; i < totalChunks; i++) {
              const chunk = base64.slice(i * chunkSize, (i + 1) * chunkSize)

              console.log(
                `📤 发送分片 ${i + 1}/${totalChunks} (${Math.round(
                  ((i + 1) / totalChunks) * 100
                )}%)`
              )

              // 使用 chrome.tabs.sendMessage 发送分片，同时发送CDN URL
              await chrome.tabs.sendMessage(tab.id!, {
                type: 'PDF_CHUNK_DATA',
                data: {
                  chunk: chunk,
                  chunkIndex: i,
                  totalChunks: totalChunks,
                  fileName: file.name,
                  fileSize: file.size,
                  cdnUrl: finalCdnUrl,
                  fileStackKey: fileStackKey,
                },
              })

              // 添加小延迟避免消息堆积
              await new Promise((resolve) => setTimeout(resolve, 50))
            }

            console.log('✅ 分片传输完成')
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            console.error('❌ 分片传输失败:', {
              error: errorMessage,
              fileName: file.name,
              tabId: tab.id,
            })
          }
        }

        // 开始发送分片
        sendChunks()
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error('❌ PDF查看器页面加载失败:', {
        error: errorMessage,
        fileName: file?.name,
      })

      // 可以在这里添加用户提示或回退逻辑
      if (errorMessage.includes('页面加载超时')) {
        console.warn('页面加载超时，可能需要检查网络连接')
      }
    }
  }

  // 等待 exceed URL 可用的函数
  const waitForExceedUrl = (
    fileStackKey: string,
    timeout: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const checkUrl = () => {
        // 检查是否超时
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for exceed URL'))
          return
        }

        // 检查当前 key 是否还是同一个
        if (currentFileStackKey.value !== fileStackKey) {
          reject(new Error('File stack key changed'))
          return
        }

        const stack = fileStack.value[fileStackKey]
        if (stack?.cdnUrl_exceed) {
          resolve(stack.cdnUrl_exceed)
        } else {
          // 继续轮询，间隔 100ms
          setTimeout(checkUrl, 100)
        }
      }

      checkUrl()
    })
  }

  // 辅助函数：文件转base64
  const fileToBase64 = (file: File): Promise<string> => {
    console.log('📝 fileToBase64 开始处理文件:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        console.log('📝 FileReader 读取完成:', {
          resultLength: result.length,
          resultPrefix: result.substring(0, 50) + '...',
          hasComma: result.includes(','),
        })

        const base64 = result.split(',')[1]
        console.log('📝 提取的base64长度:', base64.length)
        resolve(base64)
      }
      reader.onerror = (error) => {
        console.error('❌ FileReader 读取失败:', error)
        reject(error)
      }
      reader.readAsDataURL(file)
    })
  }
  // 判断文件类型（返回扩展名PDF/PNG/JPEG/WEBP）
  const getFileTypeExtension = (file: File): string => {
    console.log('🔍 getFileTypeExtension 开始分析文件:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    // 获取文件扩展名
    const getFileExtension = (file: File): string => {
      const fileName = file.name
      const lastDotIndex = fileName.lastIndexOf('.')
      if (lastDotIndex === -1) return 'unknown'

      const extension = fileName.substring(lastDotIndex + 1).toUpperCase()
      console.log('🔍 从文件名提取的扩展名:', extension)
      return extension
    }

    if (file.type === 'application/pdf') {
      console.log('🔍 检测到PDF文件，返回: PDF')
      return 'PDF'
    }

    if (file.type.startsWith('image/')) {
      const extension = getFileExtension(file)
      // 只支持特定的图片格式
      const supportedExtensions: { [key: string]: string } = {
        JPG: 'JPEG',
        JPEG: 'JPEG',
        PNG: 'PNG',
        WEBP: 'WEBP',
      }

      // 检查是否为支持的格式
      if (supportedExtensions[extension]) {
        const result = supportedExtensions[extension]
        console.log('🔍 支持的图片格式:', {
          originalExtension: extension,
          mappedResult: result,
          fileType: file.type,
        })
        return result
      } else {
        console.log('❌ 不支持的图片格式:', {
          originalExtension: extension,
          fileType: file.type,
          supportedFormats: Object.keys(supportedExtensions).join(', '),
        })
        return 'unsupported'
      }
    }

    console.log('🔍 未知文件类型，返回: unknown')
    return 'unknown'
  }
  // 获取文件类型
  const getFileType = (file: File): FileType => {
    if (file.type.startsWith('image/')) return FileType.IMAGE
    if (file.type === 'application/pdf') return FileType.PDF
    return FileType.WEB
  }
  // 创建文件选择器
  const createFileSelector = (
    from?: 'Upload_Click' | 'Upload_Drag' | 'Upload_Popup' | 'Upload_Paste' | 'Chat_Send'
  ): void => {
    const fileInput: HTMLInputElement = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/jpeg,image/jpg,image/png,image/webp,.pdf'
    fileInput.style.display = 'none'

    fileInput.addEventListener('change', async (event: Event) => {
      const target = event.target as HTMLInputElement
      const files: FileList | null = target.files

      if (files && files.length > 0) {
        const selectedFile: File = files[0]
        addFile2Stack(selectedFile, false, undefined, undefined, from)
      }

      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput)
      }
    })

    fileInput.addEventListener('error', (event: Event) => {
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput)
      }
    })
    document.body.appendChild(fileInput)
    fileInput.click()
  }
  // 暴露字段
  return {
    fileStack,
    currentFileStackKey,
    createFileSelector,
    getFileType,
    addFile2Stack,
    openPDFDView,
  }
}

const globalUpload = useGlobalUpload()
export default globalUpload
