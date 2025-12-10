import { ref } from 'vue'
import http from '@/api/axios'
import trackEvent from '@/utils/trackEvent'

interface CanvasFile {
  id: string
  name: string
  url: string
  size: number
  contentType: string
}

interface CaptureData {
  url: string
  pathname: string
  title: string
  html: string
  timestamp: number
  files: CanvasFile[]
  domain: string
}

interface FileTask {
  domain: string
  files: CanvasFile[]
  uploadedFileIds: string[]
  failureCount: number
}

const UPLOAD_INTERVAL_MIN = 10000 // 10秒
const UPLOAD_INTERVAL_MAX = 20000 // 20秒
const MAX_CONSECUTIVE_FAILURES = 5
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * 从 Content-Type 获取文件扩展名
 */
function getExtensionFromContentType(contentType: string): string {
  const mimeToExt: Record<string, string> = {
    // 文档类型
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',

    // 文本类型
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/json': 'json',
    'text/csv': 'csv',

    // 图片类型
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',

    // 压缩文件
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',

    // 其他
    'application/octet-stream': 'bin',
  }

  // 移除可能的参数（如 charset）
  const cleanType = contentType.split(';')[0].trim().toLowerCase()

  return mimeToExt[cleanType] || 'bin'
}

/**
 * 从 S3 uploadUrl 中提取 UID（目录名）
 * URL 格式: https://...s3.../canvas-captures/{domain}/{uid}/{filename}?...
 */
function extractUidFromUploadUrl(uploadUrl: string): string | null {
  try {
    const url = new URL(uploadUrl)
    const pathParts = url.pathname.split('/').filter(Boolean)
    // 路径格式: ['canvas-captures', 'canvas.eee.uci.edu', '92e6545b7c95c783', 'page_xxx.json']
    if (pathParts.length >= 3 && pathParts[0] === 'canvas-captures') {
      return pathParts[2] // 返回 UID
    }
    return null
  } catch (error) {
    console.error('[Canvas Capture] Failed to extract UID from uploadUrl:', error)
    return null
  }
}

export function useCanvasCapture() {
  // 当前文件上传任务（内存中，不持久化）
  const currentTask = ref<FileTask | null>(null)
  const uploadTimer = ref<number | null>(null)

  /**
   * 上传页面 JSON 到 S3
   */
  async function uploadPageJson(data: CaptureData): Promise<void> {
    const fileName = `page_${data.timestamp}.json`

    console.log('[Canvas Capture] Uploading page JSON:', fileName)

    // 任务开始埋点
    trackEvent.track('Plugin_canvas_task_start', {
      canvasDomain: data.domain,
      fileName,
    })

    // 获取预签名 URL
    const response = await http.post('/canvas/uploadurl', {
      domain: data.domain,
      fileName,
      fileType: 'json',
    })

    const { uploadUrl } = response.data

    // 上传到 S3
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        {
          url: data.url,
          pathname: data.pathname,
          title: data.title,
          html: data.html,
          timestamp: data.timestamp,
          files: data.files,
        },
        null,
        2
      ),
    })

    console.log('[Canvas Capture] Page JSON uploaded successfully')

    // 从 uploadUrl 提取 UID
    const dir = extractUidFromUploadUrl(uploadUrl)

    // 任务完成埋点
    trackEvent.track('Plugin_canvas_task_end', {
      canvasDomain: data.domain,
      fileName,
      dir: dir || 'unknown',
    })
  }

  /**
   * 上传单个文件
   */
  async function uploadSingleFile(domain: string, file: CanvasFile): Promise<boolean> {
    try {
      console.log(`[Canvas Capture] Uploading file: ${file.name} (ID: ${file.id})`)

      // 1. 下载文件
      const response = await fetch(file.url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const blob = await response.blob()

      if (blob.size > MAX_FILE_SIZE) {
        console.warn('[Canvas Capture] File too large, skipping:', file.name)
        return true // 跳过，视为成功
      }

      // 2. 从响应头获取真实的 Content-Type
      const responseContentType = response.headers.get('Content-Type') || 'application/octet-stream'
      console.log(`[Canvas Capture] Content-Type from response: ${responseContentType}`)

      // 3. 确定文件扩展名（优先级：响应头 > 文件名 > 默认）
      let ext = getExtensionFromContentType(responseContentType)

      // 如果从 Content-Type 无法获取（得到 bin），尝试从文件名获取
      if (ext === 'bin' && file.name.includes('.')) {
        const nameExt = file.name.split('.').pop()
        if (nameExt && nameExt.length <= 5) {
          // 确保是合理的扩展名长度
          ext = nameExt
        }
      }

      const fileName = `${file.id}.${ext}` // 使用文件 ID + 扩展名

      console.log(`[Canvas Capture] Final file name: ${fileName}`)

      // 4. 获取预签名 URL
      const urlResponse = await http.post('/canvas/uploadurl', {
        domain,
        fileName,
        fileType: ext,
      })

      const { uploadUrl } = urlResponse.data

      // 5. 上传到 S3（使用响应头的 Content-Type）
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': responseContentType },
        body: blob,
      })

      console.log(`[Canvas Capture] File uploaded successfully: ${fileName} (original: ${file.name})`)
      return true
    } catch (error) {
      console.error('[Canvas Capture] File upload failed:', file.name, error)
      return false
    }
  }

  /**
   * 开始文件上传任务
   */
  async function startFileUpload(domain: string, files: CanvasFile[]): Promise<void> {
    if (currentTask.value) {
      console.log('[Canvas Capture] File upload already in progress')
      return
    }

    currentTask.value = {
      domain,
      files,
      uploadedFileIds: [],
      failureCount: 0,
    }

    console.log('[Canvas Capture] Starting file upload task, files:', files.length)

    // 开始上传循环
    await uploadNextFile()
  }

  /**
   * 上传下一个文件
   */
  async function uploadNextFile(): Promise<void> {
    const task = currentTask.value
    if (!task) return

    // 查找下一个待上传的文件
    const pendingFiles = task.files.filter((f) => !task.uploadedFileIds.includes(f.id))

    if (pendingFiles.length === 0) {
      console.log('[Canvas Capture] All files uploaded')
      currentTask.value = null
      return
    }

    // 检查失败次数
    if (task.failureCount >= MAX_CONSECUTIVE_FAILURES) {
      console.error('[Canvas Capture] Too many consecutive failures, stopping upload')
      currentTask.value = null
      return
    }

    const file = pendingFiles[0]

    // 上传文件
    const success = await uploadSingleFile(task.domain, file)

    if (success) {
      task.uploadedFileIds.push(file.id)
      task.failureCount = 0
    } else {
      task.failureCount++
    }

    // 如果还有文件，延迟后继续
    if (task.uploadedFileIds.length < task.files.length && task.failureCount < MAX_CONSECUTIVE_FAILURES) {
      const delay = Math.random() * (UPLOAD_INTERVAL_MAX - UPLOAD_INTERVAL_MIN) + UPLOAD_INTERVAL_MIN
      console.log(`[Canvas Capture] Next file in ${Math.round(delay / 1000)}s`)

      uploadTimer.value = window.setTimeout(() => {
        uploadNextFile()
      }, delay)
    } else {
      console.log('[Canvas Capture] File upload task completed')
      currentTask.value = null
    }
  }

  /**
   * 接收 content script 发送的抓取数据
   */
  async function receiveCaptureData(data: CaptureData): Promise<void> {
    console.log('[Canvas Capture] Received capture data:', {
      url: data.url,
      pathname: data.pathname,
      files: data.files.length,
    })

    try {
      // 1. 上传页面 JSON
      await uploadPageJson(data)

      // 2. 如果有文件，开始文件上传
      if (data.files && data.files.length > 0) {
        await startFileUpload(data.domain, data.files)
      }
    } catch (error) {
      console.error('[Canvas Capture] Upload failed:', error)
    }
  }

  /**
   * 清理定时器和内存（sidepanel 关闭时调用）
   */
  function cleanup(): void {
    console.log('[Canvas Capture] Cleaning up...')

    if (uploadTimer.value) {
      clearTimeout(uploadTimer.value)
      uploadTimer.value = null
    }

    currentTask.value = null
  }

  return {
    receiveCaptureData,
    cleanup,
  }
}
