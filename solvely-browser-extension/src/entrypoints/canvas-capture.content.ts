import type { ContentScriptContext } from 'wxt/client'
import { STORAGE_KEY } from '@/config/storage'
import SidepanelEventType from './sidepanel/types/eventTypes'
import { getTrpc } from '~/lib/trpc/client'

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

const EXCLUDED_EXTENSIONS = ['mp3', 'mp4', 'avi', 'mov', 'webm', 'ogg', 'wav']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * 通过 Canvas API 检测是否为 Canvas 页面
 */
async function isCanvasPageByAPI(): Promise<boolean> {
  try {
    const response = await fetch('/api/v1/features/environment', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })
    return response.ok || response.status === 401
  } catch (error) {
    return false
  }
}

/**
 * 检查页面是否已上传（从 localStorage 读取）
 */
function isPageUploaded(pathname: string): boolean {
  try {
    const pages = JSON.parse(localStorage.getItem('_cp') || '{}')
    return !!pages[pathname]
  } catch {
    return false
  }
}

/**
 * 记录页面到 localStorage
 */
function recordPageToLocalStorage(pathname: string): void {
  try {
    const pages = JSON.parse(localStorage.getItem('_cp') || '{}')
    pages[pathname] = Date.now()
    localStorage.setItem('_cp', JSON.stringify(pages))
    console.log('[Canvas Capture] Recorded page to localStorage:', pathname)
  } catch (error) {
    console.error('[Canvas Capture] Failed to record page:', error)
  }
}

/**
 * 记录文件到 localStorage
 */
function recordFilesToLocalStorage(fileIds: string[]): void {
  try {
    const files = JSON.parse(localStorage.getItem('_cf') || '{}')
    const now = Date.now()
    fileIds.forEach((id) => {
      files[id] = now
    })
    localStorage.setItem('_cf', JSON.stringify(files))
    console.log('[Canvas Capture] Recorded files to localStorage:', fileIds.length)
  } catch (error) {
    console.error('[Canvas Capture] Failed to record files:', error)
  }
}

/**
 * 过滤已上传的文件
 */
function filterUploadedFiles(files: CanvasFile[]): CanvasFile[] {
  try {
    const uploaded = JSON.parse(localStorage.getItem('_cf') || '{}')
    return files.filter((file) => !uploaded[file.id])
  } catch {
    return files
  }
}

/**
 * 从页面提取文件信息
 */
function extractFilesFromPage(html: string, baseUrl: string): CanvasFile[] {
  const fileMap = new Map<string, CanvasFile>()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 提取 /courses/{courseId}/files/{fileId}/download 链接
  doc.querySelectorAll('a[href*="/files/"][href*="/download"]').forEach((a) => {
    const href = a.getAttribute('href')
    if (!href) return

    const match = href.match(/\/courses\/\d+\/files\/(\d+)\/download/)
    if (match) {
      const fileId = match[1]

      if (fileMap.has(fileId)) {
        return
      }

      const fileName = a.textContent?.trim() || `file_${fileId}`
      const ext = fileName.split('.').pop()?.toLowerCase()

      if (ext && EXCLUDED_EXTENSIONS.includes(ext)) {
        return
      }

      // 构造完整 URL
      let fullUrl = href
      if (href.startsWith('/')) {
        fullUrl = new URL(href, baseUrl).href
      }

      fileMap.set(fileId, {
        id: fileId,
        name: fileName,
        url: fullUrl.split('?')[0], // 移除查询参数
        size: 0,
        contentType: guessContentType(fileName),
      })
    }
  })

  return Array.from(fileMap.values())
}

/**
 * 推测文件类型
 */
function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
  }
  return map[ext || ''] || 'application/octet-stream'
}

/**
 * 检查 sidepanel 是否打开
 */
async function isSidepanelOpen(): Promise<boolean> {
  try {
    return await getTrpc().getSidepanelStatus.query()
  } catch (error) {
    console.warn('[Canvas Capture] Failed to check sidepanel status:', error)
    return false
  }
}

/**
 * 延迟等待
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default defineContentScript({
  matches: ['*://*.instructure.com/*', '*://*.edu/*'],
  allFrames: false,
  runAt: 'document_idle',

  async main(ctx: ContentScriptContext) {
    console.log('[Canvas Capture] Content script loaded on:', window.location.href)

    if (ctx.isInvalid || window.self !== window.top) {
      console.log('[Canvas Capture] Skipped: invalid context or iframe')
      return
    }

    // 1. 通过 Canvas API 检测是否为 Canvas 页面
    console.log('[Canvas Capture] Detecting Canvas page via API...')
    const isCanvas = await isCanvasPageByAPI()

    if (!isCanvas) {
      console.log('[Canvas Capture] Skipped: not a Canvas page')
      return
    }
    console.log('[Canvas Capture] ✓ Canvas page detected')

    // 2. 检查用户是否登录
    const storage = await browser.storage.local.get([STORAGE_KEY.USER])
    const user = storage[STORAGE_KEY.USER]
    if (!user || !user.deviceId) {
      console.log('[Canvas Capture] Skipped: user not logged in')
      return
    }
    console.log('[Canvas Capture] ✓ User logged in:', user.deviceId)

    // 3. 检查配置
    const configRes = await browser.storage.local.get(STORAGE_KEY.PLUGIN_CONFIG)
    const config = configRes[STORAGE_KEY.PLUGIN_CONFIG]
    const captureConfig = config?.features?.canvasCapture

    if (!captureConfig?.enabled) {
      console.log('[Canvas Capture] Skipped: feature not enabled')
      return
    }
    console.log('[Canvas Capture] ✓ Feature enabled')

    // 4. 检查 sidepanel 是否打开
    console.log('[Canvas Capture] Checking sidepanel status...')
    const sidepanelOpen = await isSidepanelOpen()

    if (!sidepanelOpen) {
      console.log('[Canvas Capture] Skipped: sidepanel not open')
      return
    }
    console.log('[Canvas Capture] ✓ Sidepanel is open')

    // 5. 检查页面是否已上传（去重）
    const pathname = window.location.pathname
    if (isPageUploaded(pathname)) {
      console.log('[Canvas Capture] Skipped: page already uploaded', pathname)
      return
    }
    console.log('[Canvas Capture] ✓ Page not yet uploaded')

    // 防止重复初始化
    const initKey = '__SOLVELY_CANVAS_CAPTURE_INIT__'
    if ((window as any)[initKey]) {
      console.log('[Canvas Capture] Skipped: already initialized')
      return
    }
    ;(window as any)[initKey] = true

    // 开始抓取
    console.log('[Canvas Capture] Starting capture...')

    try {
      // 等待 5 秒，确保 Canvas 页面渲染完成
      console.log('[Canvas Capture] Waiting 5 seconds for page to render...')
      await wait(5000)
      console.log('[Canvas Capture] Wait completed, starting extraction...')

      // 提取页面信息
      const pageData = {
        url: window.location.href,
        pathname: window.location.pathname,
        title: document.title,
        html: document.documentElement.outerHTML,
        timestamp: Date.now(),
      }

      // 提取文件信息
      const files = extractFilesFromPage(pageData.html, pageData.url)

      console.log('[Canvas Capture] Extracted files:', files.length)

      // 立即记录页面到 localStorage（避免重复抓取）
      recordPageToLocalStorage(pageData.pathname)

      // 过滤已上传的文件
      const pendingFiles = filterUploadedFiles(files)

      console.log('[Canvas Capture] Pending files:', pendingFiles.length, '/', files.length)

      // 乐观记录所有待上传文件到 localStorage
      if (pendingFiles.length > 0) {
        recordFilesToLocalStorage(pendingFiles.map((f) => f.id))
      }

      // 组装完整数据
      const captureData: CaptureData = {
        ...pageData,
        files: pendingFiles, // 只发送未上传的文件
        domain: window.location.hostname,
      }

      // 发送给 sidepanel
      await browser.runtime.sendMessage({
        type: SidepanelEventType.CANVAS_CAPTURE_COMPLETE,
        data: captureData,
      })

      console.log('[Canvas Capture] Data sent to sidepanel')
    } catch (error) {
      console.error('[Canvas Capture] Capture failed:', error)
    }
  },
})
