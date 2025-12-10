<template>
  <div class="pdf-viewer">
    <PdfControls
      :current-scale="currentScale"
      :min-scale="minScale"
      :max-scale="maxScale"
      :input-scale="inputScale"
      :total-pages="totalPages"
      :current-page="currentPage"
      :input-page="inputPage"
      @zoomIn="zoomIn"
      @zoomOut="zoomOut"
      @update:inputScale="onScaleInputBlur"
      @update:inputPage="onPageInputBlur"
    />
    <div class="main-content">
      <PdfSidebar
        v-show="sidebarVisible"
        :total-pages="totalPages"
        :current-page="sidebarActivePage"
        :sidebar-canvases="sidebarCanvases"
        @sidebarClick="onSidebarClick"
      />
      <div class="viewer-panel">
        <!-- 官方 Viewer 容器 -->
        <div ref="pdfContainer" class="pdf-container">
          <div id="viewer" class="pdfViewer"></div>
        </div>
      </div>
    </div>
    <!-- 悬浮栏 -->
    <PdfFloatButtons 
      @toCut="handleToCut" 
      @toSolveAll="handleToSolveAll"
    />
    <!-- 截图组件 -->
    <PdfScreenshot 
      ref="screenshotRef" 
      @copy-success="handleCopySuccess"
      @copy-error="handleCopyError"
    />
    <!-- 划词工具栏 -->
    <PdfTextSelectionToolbar />
    <!-- Toast提示组件 -->
    <Reactive :message="toast" :type="toast_type" />
    <!-- 加载组件 -->
    <PdfLoading
      :show="loadingState.show"
      :progress="loadingState.progress"
      :loading-type="loadingState.type"
      :error="loadingState.error"
      @retry="handleRetry"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted, markRaw } from 'vue'
import type { Ref } from 'vue'
import PdfControls from './PdfControls.vue'
import PdfSidebar from './PdfSidebar.vue'
import PdfFloatButtons from './PdfFloatButtons.vue'
import PdfScreenshot from './PdfScreenshot.vue'
import PdfTextSelectionToolbar from './PdfTextSelectionToolbar.vue'
import PdfLoading from './PdfLoading.vue'
import Reactive from '@/components/screenshot/Reactive.vue'
import { downloadWithProgress } from '@/entrypoints/pdfView/utils/downloadWithProgress'
import { PdfViewerMessageType, type PdfChunkData } from '../types/messageTypes'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import { STORAGE_KEY } from '~/config'
import useABTest from '@/composables/useABTest'

// 自定义渲染工具已移除，改用官方 PDFViewer 全权处理
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs'
// Vite worker 方式加载 pdf.worker，与 API 版本一致
// @ts-ignore
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker'
// 官方 CSS（确保已引入）
import 'pdfjs-dist/web/pdf_viewer.css'

const pdfContainer = ref<HTMLElement | null>(null)
const screenshotRef = ref<InstanceType<typeof PdfScreenshot> | null>(null)
const sidebarVisible = ref(false)
const totalPages = ref(1)
const currentPage = ref(1)
const sidebarActivePage = ref(1)
let sidebarDebounceTimer: any = null
let jumpTargetPage: number | null = null
// 侧边栏 active 锁，防止跳转过程被右侧滚动反向驱动
let isSidebarActiveLocked = false
// 在该时间点之前，忽略右侧对 active 的更新
let suppressActiveUntil = 0
const currentScale = ref(100)
const minScale = 20
const maxScale = 300
const inputScale = ref(currentScale.value)
const inputPage = ref(currentPage.value)
const sidebarCanvases = ref([]) as Ref<(HTMLCanvasElement | null)[]>

// 简化版渲染队列，兼容官方缩略图与页面渲染调度
class SimpleRenderingQueue {
  pdfViewer: any = null
  pdfThumbnailViewer: any = null
  isThumbnailViewEnabled = false
  setViewer(v: any) { this.pdfViewer = v }
  setThumbnailViewer(tv: any) { this.pdfThumbnailViewer = tv }
  renderHighestPriority(currentlyVisiblePages?: any) {
    if (this.pdfViewer?.forceRendering?.(currentlyVisiblePages)) return
    if (this.isThumbnailViewEnabled) {
      this.pdfThumbnailViewer?.forceRendering?.()
    }
  }
}
let pdfDocument: any = null
const isJumpingToPage = ref(false)
let jumpTimer: any = null

// 加载状态管理
const loadingState = ref({
  show: false,
  progress: 0,
  type: 'idle' as 'chunk' | 'cdn' | 'idle',
  error: ''
})

// 分片接收相关
let chunkTimeout: NodeJS.Timeout | null = null
let receivedChunks: Uint8Array[] = []
let expectedChunks = 0
let receivedChunkCount = 0

// 当前CDN URL状态
const currentCdnUrl = ref<string | null>(null)

// A/B 测试相关
const userExtendInfo = ref<{
  abTestTags?: string[]
} | null>(null)

// Toast 相关
const toast = ref('')
const toast_type = ref<'success' | 'error'>('success')

const pdfWorkerInstance = new PdfWorker()
pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorkerInstance

// 官方 viewer refs
const officialViewerRef = ref<any>(null)
const officialEventBusRef = ref<any>(null)
const officialLinkServiceRef = ref<any>(null)

// 禁用浏览器原生缩放的辅助函数
const preventNativeZoom = (e: Event) => {
  // 只阻止手势缩放，不影响键盘快捷键
  e.preventDefault()
  e.stopPropagation()
}

// 预渲染半径（可见区前后各 N 页）
const PRERENDER_RADIUS = 4
// 尺寸占位与预取半径（可见区前后各 M 页）
const PLACEHOLDER_RADIUS = 6

// 动态更新URL的方法
function updateUrlWithCdn(cdnUrl: string,fileStackKey:string) {
  const url = new URL(window.location.href)
  url.searchParams.set('cdn', cdnUrl)
  // 多加一个参数fileStackKey
  url.searchParams.set('fileStackKey', fileStackKey)
  window.history.replaceState({}, '', url.toString())
  currentCdnUrl.value = cdnUrl
}

// 从当前URL获取CDN参数
function getCdnFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('cdn')
}

// 加载并渲染PDF
async function renderPdf(data: Uint8Array) {
  try {
    pdfDocument = markRaw(await pdfjsLib.getDocument({ data }).promise)
    totalPages.value = pdfDocument.numPages

    // 将pdfDocument设置为全局变量，供文本选择功能使用
    ;(window as any).pdfDocument = pdfDocument
    ;(globalThis as any).pdfDocument = pdfDocument
    // 暴露当前页码，供PDF上下文提取使用
    ;(window as any).currentPage = currentPage.value
    ;(globalThis as any).currentPage = currentPage.value

    const viewer = officialViewerRef.value as any
    const linkService = officialLinkServiceRef.value as any

    if (viewer && linkService) {
      // 先链接服务，再设置 viewer
      linkService.setDocument(pdfDocument, null)
      viewer.setDocument(pdfDocument)
      // 使用自绘缩略图
      await renderSidebarThumbnails()
    }

    loadingState.value.show = false
  } catch (error) {
    console.error('PDF rendering failed:', error)
    loadingState.value.error = 'PDF rendering failed, please try again later'
  } finally {
    if (!loadingState.value.error) loadingState.value.show = false
  }
}

// 开始分片接收模式
function startChunkMode() {
  console.log('🔄 启动分片接收模式')
  loadingState.value.show = true
  loadingState.value.type = 'chunk'
  loadingState.value.progress = 0
  loadingState.value.error = ''
  
  // 设置超时，如果30秒内没有收到分片，切换到CDN模式
  chunkTimeout = setTimeout(() => {
    console.log('⏰ 分片接收超时，切换到CDN模式')
    startCdnMode()
  }, 30000) // 30秒超时，给分片传输足够时间
}

// 处理分片数据
function handleChunkData(chunk: string, chunkIndex: number, totalChunks: number, cdnUrl?: string, fileStackKey?: string) {
  if (loadingState.value.type !== 'chunk') return
  
  // 如果提供了CDN URL，动态更新URL
  if (cdnUrl && !currentCdnUrl.value && fileStackKey) {
    updateUrlWithCdn(cdnUrl, fileStackKey)
  }
  
  // 更新预期分片数量
  if (expectedChunks === 0) {
    expectedChunks = totalChunks
    // 收到第一个分片时，取消超时计时器
    if (chunkTimeout) {
      console.log('✅ 收到第一个分片，取消分片超时计时器')
      clearTimeout(chunkTimeout)
      chunkTimeout = null
    }
  }
  
  // 将base64字符串转换为Uint8Array
  const chunkArray = base64ToUint8Array(chunk)
  
  // 存储分片
  receivedChunks[chunkIndex] = chunkArray
  receivedChunkCount++
  
  // 更新进度
  const progress = (receivedChunkCount / expectedChunks) * 100
  loadingState.value.progress = progress
  
  // 检查是否接收完成
  if (receivedChunkCount === expectedChunks) {
    // 合并所有分片
    const totalLength = receivedChunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const mergedData = new Uint8Array(totalLength)
    let offset = 0
    
    for (const chunk of receivedChunks) {
      mergedData.set(chunk, offset)
      offset += chunk.length
    }
    
    // 清理分片相关状态
    clearChunkState()
    
    // 渲染PDF
    renderPdf(mergedData)
  }
}

// base64 转 Uint8Array 工具函数
function base64ToUint8Array(base64: string): Uint8Array {
  // 处理 data URL 前缀，如果存在的话
  const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(pureBase64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// 清理分片状态
function clearChunkState() {
  if (chunkTimeout) {
    clearTimeout(chunkTimeout)
    chunkTimeout = null
  }
  receivedChunks = []
  expectedChunks = 0
  receivedChunkCount = 0
}

// 开始CDN下载模式
async function startCdnMode(cdnUrl?: string) {
  // 清理分片状态
  clearChunkState()
  
  loadingState.value.show = true
  loadingState.value.type = 'cdn'
  loadingState.value.progress = 0
  loadingState.value.error = ''
  
  try {
    // 优先使用传入的CDN URL，其次从当前URL参数获取
    const url = cdnUrl || getCdnFromUrl()
    if (!url) {
      throw new Error('PDF file address not found')
    }
    
    // 更新当前CDN URL状态
    currentCdnUrl.value = url
    
    // 使用带进度的下载
    const arrayBuffer = await downloadWithProgress({
      url,
      onProgress: (progress) => {
        loadingState.value.progress = progress
      },
      onError: (error) => {
        console.error('Download failed:', error)
        loadingState.value.error = 'Download failed, please check your network connection'
      }
    })
    
    // 渲染PDF
    await renderPdf(new Uint8Array(arrayBuffer))
    
  } catch (error) {
    console.error('CDN download failed:', error)
    loadingState.value.error = 'Download failed, please try again later'
    loadingState.value.show = true
  }
}

// 智能启动加载模式
function startSmartLoading() {
  // 检查当前URL是否有CDN参数
  const cdnFromUrl = getCdnFromUrl()
  
  if (cdnFromUrl) {
    // 如果有CDN参数，直接启动CDN下载模式
    currentCdnUrl.value = cdnFromUrl
    startCdnMode(cdnFromUrl)
  } else {
    // 默认等待状态，设置3秒超时
    loadingState.value.show = true
    loadingState.value.type = 'idle'
    loadingState.value.progress = 0
    loadingState.value.error = ''
    
    // 3秒内没有收到启动请求就报错
    const idleTimeout = setTimeout(() => {
      if (loadingState.value.type === 'idle') {
        console.error('❌ 3秒内未收到分片启动请求，当前状态:', loadingState.value.type)
        loadingState.value.error = 'Oops! Upload failed. Please try again.'
        loadingState.value.show = true
      } else {
        console.log('✅ 分片模式已启动，状态:', loadingState.value.type)
      }
    }, 3000)
    
    // 保存超时ID，供后续取消使用
    ;(window as any).idleTimeout = idleTimeout
  }
}

// 自绘缩略图渲染
async function renderSidebarThumbnails() {
  if (!pdfDocument) return
  nextTick(() => {
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      pdfDocument.getPage(pageNum).then((page: any) => {
        const thumbScale = 0.18
        const viewport = page.getViewport({ scale: thumbScale })
        const canvas = sidebarCanvases.value[pageNum - 1]
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        page.render({ canvasContext: ctx, viewport })
      })
    }
    sidebarVisible.value = true
  })
}

function withNoSmoothScroll(run: () => void) {
  const container = pdfContainer.value as HTMLElement | null
  if (!container) {
    run()
    return
  }
  const prev = container.style.scrollBehavior
  container.style.scrollBehavior = 'auto'
  try {
    run()
  } finally {
    // 使用 rAF 在当前帧后恢复，避免同帧被覆盖
    requestAnimationFrame(() => {
      container.style.scrollBehavior = prev || 'smooth'
    })
  }
}

// 键盘缩放快捷键（防抖）
let keyZoomTimer: any = null
function scheduleKeyZoom(action: 'in' | 'out' | 'reset') {
  if (keyZoomTimer) clearTimeout(keyZoomTimer)
  keyZoomTimer = setTimeout(() => {
    const viewer: any = officialViewerRef.value
    if (!viewer) return
    if (action === 'in') {
      zoomIn()
    } else if (action === 'out') {
      zoomOut()
    } else if (action === 'reset') {
      currentScale.value = 100
      inputScale.value = 100
      withNoSmoothScroll(() => { viewer.currentScale = 1 })
    }
  }, 120)
}

// 只在按下 Ctrl/Cmd 时处理滚轮事件
function handleWheel(e: WheelEvent) {
  const isModifierPressed = e.ctrlKey || e.metaKey
  if (!isModifierPressed) {
    return
  }

  e.preventDefault()
  e.stopPropagation()

  const magnitude = Math.min(400, Math.abs(e.deltaY))
  const step = Math.max(2, Math.min(12, Math.round((magnitude / 100) * 3)))
  if (e.deltaY < 0) {
    zoomIn(step)
  } else if (e.deltaY > 0) {
    zoomOut(step)
  }
}

function handleKeydown(e: KeyboardEvent) {
  // 输入框/可编辑区域内不拦截
  const target = e.target as HTMLElement | null
  const tag = (target?.tagName || '').toLowerCase()
  const isEditable = target && (tag === 'input' || tag === 'textarea' || (target as any).isContentEditable)
  if (isEditable) return

  const isCtrlOrCmd = e.ctrlKey || e.metaKey
  if (!isCtrlOrCmd) return

  if (e.key === '=' || e.key === '+') {
    e.preventDefault()
    scheduleKeyZoom('in')
  } else if (e.key === '-') {
    e.preventDefault()
    scheduleKeyZoom('out')
  } else if (e.key === '0') {
    e.preventDefault()
    scheduleKeyZoom('reset')
  }
}

function zoomIn(val: number = 10 ) {
  if (currentScale.value >= maxScale) return
  const viewer: any = officialViewerRef.value
  const next = Math.min(currentScale.value + val, maxScale)
  currentScale.value = next
  inputScale.value = next
  if (viewer) withNoSmoothScroll(() => { viewer.currentScale = next / 100 })
}
function zoomOut(val: number = 10) {
  if (currentScale.value <= minScale) return
  const viewer: any = officialViewerRef.value
  const next = Math.max(currentScale.value - val, minScale)
  currentScale.value = next
  inputScale.value = next
  if (viewer) withNoSmoothScroll(() => { viewer.currentScale = next / 100 })
}

function onScaleInputBlur(val: number) {
  let v = Number(val)
  if (!v || isNaN(v)) {
    inputScale.value = currentScale.value
    return
  }
  v = Math.max(minScale, Math.min(maxScale, v))
  currentScale.value = v
  inputScale.value = v
  const viewer: any = officialViewerRef.value
  if (viewer) withNoSmoothScroll(() => { viewer.currentScale = v / 100 })
}

function onSidebarClick(page: number) {
  currentPage.value = page
  inputPage.value = page
  // 同步更新全局当前页码
  ;(window as any).currentPage = page
  ;(globalThis as any).currentPage = page
  // 锁定侧边栏 active，跳转过程中不被右侧滚动反向驱动
  isJumpingToPage.value = true
  jumpTargetPage = page
  isSidebarActiveLocked = true
  // 开启抑制窗口，忽略滚动中的中间事件
  suppressActiveUntil = performance.now() + 800
  // 立即更新左侧 active，并清除任何在途的防抖更新
  if (sidebarDebounceTimer) clearTimeout(sidebarDebounceTimer)
  sidebarActivePage.value = page
  // 立刻让左侧对应缩略图平滑滚动到可视位置（与缩放无关，不禁用平滑）
  try {
    (document.querySelector(`.sidebar canvas[data-page='${page}']`) as HTMLElement)?.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: 'smooth'
    })
  } catch {}
  nextTick(() => {
    const viewer: any = officialViewerRef.value
    if (viewer) {
      viewer.currentPageNumber = page
    }
    if (jumpTimer) clearTimeout(jumpTimer)
    jumpTimer = setTimeout(() => {
      isJumpingToPage.value = false
      jumpTargetPage = null
    }, 300)
  })
}
// 保持inputScale、inputPage的同步逻辑
function onPageInputBlur(val: number) {
  let v = val
  if (!v || isNaN(v) || v < 1) {
    inputPage.value = currentPage.value
    return
  }
  if (v > totalPages.value) v = totalPages.value
  currentPage.value = v
  inputPage.value = v
  // 同步更新全局当前页码
  ;(window as any).currentPage = v
  ;(globalThis as any).currentPage = v
  // 调用缩略图点击逻辑，实现PDF滚动
  onSidebarClick(v)
}

// 处理截图事件
function handleToCut() {
  // 直接显示截图界面
  if (screenshotRef.value) {
    screenshotRef.value.show()
  } else {
    console.error('screenshotRef.value is null')
  }
}

// 处理一键解题事件
function handleToSolveAll() {
  // 发送消息给 sidepanel 进行一键解题
  try {
    chrome.runtime.sendMessage({
      type: SidepanelEventType.SOLVE_ALL_FROM_CONTENT,
    })
  } catch (error) {
    console.error('Failed to send solve all message:', error)
  }
}

// 重试逻辑
function handleRetry() {
  loadingState.value.error = ''
  loadingState.value.progress = 0
  // 使用智能加载模式重试
  startSmartLoading()
}

// 处理截图复制成功
function handleCopySuccess() {
  // 先清空消息，确保能触发 watch
  toast.value = ''
  // 使用 nextTick 确保清空操作完成后再设置新消息
  nextTick(() => {
    toast.value = 'Screenshot copied to clipboard'
    toast_type.value = 'success'
  })
}

// 处理截图复制失败
function handleCopyError() {
  // 先清空消息，确保能触发 watch
  toast.value = ''
  // 使用 nextTick 确保清空操作完成后再设置新消息
  nextTick(() => {
    toast.value = 'Failed to copy screenshot'
    toast_type.value = 'error'
  })
}

// 初始化PDF加载
onMounted(async () => {
  // 加载A/B测试数据
  try {
    const result = await browser.storage.local.get([STORAGE_KEY.USER_EXTEND_INFO])
    if (result[STORAGE_KEY.USER_EXTEND_INFO]) {
      userExtendInfo.value = result[STORAGE_KEY.USER_EXTEND_INFO]
    }
  } catch (error) {
    console.error('Failed to load A/B test data:', error)
  }

  // 先设置全局 pdfjsLib，供 viewer.mjs 解构使用
  ;(globalThis as any).pdfjsLib = pdfjsLib
  // 动态导入官方 Viewer 模块
  // @ts-ignore - 一些导出未在类型中声明，但运行时可用
  const { EventBus, PDFViewer: OfficialPDFViewer, PDFLinkService, PDFFindController } = await import('pdfjs-dist/web/pdf_viewer.mjs')

  // 使用官方 Viewer 初始化
  const eventBus = markRaw(new EventBus())
  const linkService = markRaw(new PDFLinkService({ eventBus }))
  const findController = markRaw(new PDFFindController({ eventBus, linkService }))

  const container = pdfContainer.value as HTMLDivElement
  const viewerContainer = container.querySelector('#viewer') as HTMLDivElement

  const officialViewer = markRaw(new OfficialPDFViewer({
    container,
    viewer: viewerContainer,
    eventBus,
    linkService,
    findController,
    textLayerMode: 1,
  }))
  linkService.setViewer(officialViewer)

  // 初始化官方渲染队列与缩略图
  const renderingQueue = markRaw(new SimpleRenderingQueue())
  renderingQueue.setViewer(officialViewer as any)
 
  // 显示侧边栏并在 nextTick 后渲染缩略图
  sidebarVisible.value = true
  await nextTick()

  // 使用自绘缩略图（不使用官方 PDFThumbnailViewer）
  // 保存 refs
  officialViewerRef.value = officialViewer
  officialEventBusRef.value = eventBus
  officialLinkServiceRef.value = linkService
  // 额外保存渲染队列供后续使用
  ;(officialViewerRef as any).renderingQueue = renderingQueue

  // 事件同步
  eventBus.on('pagechanging', (evt: any) => {
    const page = evt.pageNumber || evt.page || (officialViewer as any).currentPageNumber
    if (typeof page === 'number') {
      // 若处于侧边栏 active 锁定期：
      // 1) 未到目标页：忽略此次事件（不更新 currentPage/inputPage/active）
      // 2) 到达目标页：解除锁定并继续后续同步
      if (isSidebarActiveLocked) {
        if (jumpTargetPage != null && page === jumpTargetPage) {
          isSidebarActiveLocked = false
          isJumpingToPage.value = false
          jumpTargetPage = null
          // 目标页已到达：立即更新左侧 active，并取消任何旧的防抖
          if (sidebarDebounceTimer) clearTimeout(sidebarDebounceTimer)
          sidebarActivePage.value = page
          try { (document.querySelector(`.sidebar canvas[data-page='${page}']`) as HTMLElement)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) } catch {}
          // 着陆后开启一个短暂抑制窗口，忽略后续惯性滚动造成的中间事件
          suppressActiveUntil = performance.now() + 400
          return
        } else {
          return
        }
      }

      // 正常同步页码与输入框
      currentPage.value = page
      inputPage.value = page
      // 同步更新全局当前页码
      ;(window as any).currentPage = page
      ;(globalThis as any).currentPage = page
      // 抑制窗口内不更新 active（但允许右侧页码显示）
      if (performance.now() < suppressActiveUntil) return
      // 正常滚动下更新 active（防抖）
      if (sidebarDebounceTimer) clearTimeout(sidebarDebounceTimer)
      sidebarDebounceTimer = setTimeout(() => {
        sidebarActivePage.value = page
        try { (document.querySelector(`.sidebar canvas[data-page='${page}']`) as HTMLElement)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) } catch {}
      }, 150)
    }
  })
  eventBus.on('pagesinit', () => {
    try { (officialViewerRef as any)?.renderingQueue?.renderHighestPriority?.() } catch {}
  })
  eventBus.on('scalechanging', (evt: any) => {
    const scale = evt.scale || (officialViewer as any).currentScale
    if (typeof scale === 'number') {
      currentScale.value = Math.round(scale * 100)
      inputScale.value = currentScale.value
    }
  })

  // 注册键盘与滚轮缩放
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('wheel', handleWheel, { passive: false, capture: true })
  // 额外监听以防止浏览器原生缩放
  document.addEventListener('gesturestart', preventNativeZoom, { passive: false, capture: true })
  document.addEventListener('gesturechange', preventNativeZoom, { passive: false, capture: true })
  document.addEventListener('gestureend', preventNativeZoom, { passive: false, capture: true })

  // 智能启动加载模式（保留你现有的 chunk/CDN 逻辑）
  startSmartLoading()

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === PdfViewerMessageType.TRIGGER_SCREENSHOT) {
      handleToCut()
      sendResponse({ success: true })
    }
  })
  
  // 监听来自侧边栏的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    if (message.type === PdfViewerMessageType.START_CHUNK_MODE) {
      // 收到侧边栏的分片请求，启动分片模式
      console.log('📥 收到分片模式启动请求，开始启动分片模式')
      
      // 取消idle状态的超时计时器
      if ((window as any).idleTimeout) {
        console.log('✅ 取消idle状态超时计时器')
        clearTimeout((window as any).idleTimeout)
        ;(window as any).idleTimeout = null
      }
      
      startChunkMode()
      sendResponse({ success: true })
    }
    
    if (message.type === PdfViewerMessageType.PDF_CHUNK_DATA) {
      const chunkData: PdfChunkData = message.data
      console.log('📥 收到分片数据:', chunkData.chunkIndex + 1, '/', chunkData.totalChunks)
      handleChunkData(
        chunkData.chunk,
        chunkData.chunkIndex,
        chunkData.totalChunks,
        chunkData.cdnUrl,
        chunkData.fileStackKey
      )
      sendResponse({ success: true })
    }
    
    // 添加一个通用的响应，确保消息被处理
    if (sendResponse) {
      sendResponse({ received: true })
    }
  })

  // 发送页面就绪消息
  console.log('📤 发送PDF查看器就绪消息')
  chrome.runtime.sendMessage({
    type: 'PDF_VIEWER_READY',
    tabId: chrome.tabs.TAB_ID_NONE // 当前页面
  })
})
onUnmounted(() => {
  // 清理缩放定时器
  if (jumpTimer) clearTimeout(jumpTimer)
  if (sidebarDebounceTimer) clearTimeout(sidebarDebounceTimer)
  
  // 移除键盘与滚轮/手势缩放监听
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('wheel', handleWheel)
  document.removeEventListener('gesturestart', preventNativeZoom)
  document.removeEventListener('gesturechange', preventNativeZoom)
  document.removeEventListener('gestureend', preventNativeZoom)

  // 清理分片状态
  clearChunkState()
  
  // 移除消息监听器
  chrome.runtime.onMessage.removeListener((message, sender, sendResponse) => {
    if (message.type === PdfViewerMessageType.TRIGGER_SCREENSHOT) {
      handleToCut()
      sendResponse({ success: true })
    }
  })
  
  chrome.runtime.onMessage.removeListener((message, sender, sendResponse) => {
    if (message.type === PdfViewerMessageType.PDF_CHUNK_DATA) {
      const chunkData: PdfChunkData = message.data
      handleChunkData(
        chunkData.chunk,
        chunkData.chunkIndex,
        chunkData.totalChunks
      )
      sendResponse({ success: true })
    }
  })
})
</script>

<style scoped lang="less">
.pdf-viewer {
  @apply flex-1 flex flex-col h-full bg-s-border-secondary dark:bg-s-input-bg-dark transition-colors duration-200;
}
.main-content {
  @apply flex-1 flex flex-row min-h-0;
  /* 为绝对定位的 pdf-container 提供定位上下文 */
  position: relative;
}
/* 右侧查看区域占满剩余空间，并提供相对定位上下文 */
.viewer-panel {
  @apply flex-1 min-w-0 relative;
}
:deep(.pdf-page) {
  margin: var(--pdf-page-margin, 36px auto);
  @apply bg-s-interface-bg dark:bg-s-interface-bg-dark rounded-xl;
  position: relative;
  display: block;
  box-shadow: 0 2px 12px #e0e7ef;
  .dark & {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  }
}
:deep(.pdf-canvas) {
  @apply rounded-xl;
  border-radius: var(--pdf-page-radius, 12px);
}

:deep(.pdfViewer .page){
  border-radius: 0.5em;
  border: none;
  margin: 0;
  overflow: hidden;
  position: relative;
  margin: 16px auto;
}

.controls-divider {
  @apply mx-3 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-lg font-light select-none;
  transition: color 200ms ease;
}

/* 滚动条样式 */
.pdf-container::-webkit-scrollbar {
  @apply w-2;
}

.pdf-container::-webkit-scrollbar-track {
  @apply bg-s-panel-bg dark:bg-s-panel-bg-dark;
}

.pdf-container::-webkit-scrollbar-thumb {
  @apply bg-s-interface-bg dark:bg-s-border-dark/80 rounded-full;
  transition: background-color 150ms ease;
}

.pdf-container::-webkit-scrollbar-thumb:hover {
  @apply bg-s-interface-bg/80 dark:bg-s-border-dark;
}
:deep(.textLayer) {
  transition: none !important;
}
:deep(.pdf-page),
:deep(.pdf-page > .canvasWrapper),
:deep(.pdf-page > .textLayer),
:deep(.pdf-canvas) {
  transition-property: none !important;
}

/* 关键：使用官方选择器，确保对齐 */
:deep(.page > .canvasWrapper) {
  position: relative;
  display: block;
  z-index: 0;
}
:deep(.page > .textLayer) {
  position: absolute;
  // height: 100% !important;
  // width: 100% !important;
  inset:0;
  z-index: 2; /* 保证文字层在画布之上 */
  pointer-events: auto; /* 允许选择文本 */
}

/* 缩放阶段，禁用内部过渡，避免抖动 */
.css-zooming :deep(.pdf-page),
.css-zooming :deep(.pdf-page > .canvasWrapper),
.css-zooming :deep(.pdf-page > .textLayer),
.css-zooming :deep(.pdf-canvas) {
  // transition: none !important;
}

/* wrapper 缩放时，避免内部滚动条误差 */
.pdf-pages-wrapper {
  will-change: transform;
  display: inline-block;
}

/* 容器居中，以配合 wrapper 的居中缩放 */
.pdf-container {
  /* 官方 PDFViewer 要求容器必须是绝对定位 */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: auto;
  scroll-behavior: smooth; /* 默认保持平滑滚动 */
  text-align: center;
}

.pdf-container > .pdf-pages-wrapper {
  text-align: initial;
}
/* 禁用浏览器原生缩放行为，但保留文字选择功能 */
.pdf-viewer {
  touch-action: pan-x pan-y;
  /* 移除 user-select: none，允许文字选择和复制 */
}

.pdf-container {
  touch-action: pan-x pan-y;
  /* 确保PDF文本可以被选择 */
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}
</style>
