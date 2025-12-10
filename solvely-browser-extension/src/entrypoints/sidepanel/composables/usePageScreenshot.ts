import { ref, reactive, computed } from 'vue'
import { getTrpc } from '~/lib/trpc/client'
import SidepanelEventType from '../types/eventTypes'
import trackEvent from '@/utils/trackEvent'
import { PageScreenshotUploadManager } from '~/utils/PageScreenshotUploadManager'
import { imageProcessor } from '~/utils/imageProcessor'

// ===== 类型定义区域 =====

export enum ScreenshotStatus {
  IDLE = 'idle',
  PREPARING = 'preparing',
  CAPTURING = 'capturing',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  INTERRUPTED = 'interrupted',
  FAILED = 'failed',
}

export interface ScreenshotProgress {
  current: number
  total: number
  currentStep: string
  percentage: number
  estimatedTimeLeft?: number
}

export interface PageScrollInfo {
  totalHeight: number
  viewportHeight: number
  currentScrollY: number
  scrollSteps: number
  // 以下为可选的扩展信息，用于容器滚动与裁剪
  targetType?: 'window' | 'element'
  innerWidthCss?: number
  devicePixelRatio?: number
  containerRectCss?: {
    top: number
    left: number
    width: number
    height: number
  } | null
}

export interface ScreenshotResult {
  success: boolean
  screenshots: string[]
  status: ScreenshotStatus
  error?: string
  metadata?: {
    totalTime: number
    pageUrl: string
    originalScrollY: number
  }
}

export type AbortReason = 'user' | 'guard' | null

export interface CaptureOptions {
  stabilizationDelay?: number // 页面稳定等待时间
  captureInterval?: number // 截图间隔时间
  timeout?: number // 总超时时间
}

// 错误类型枚举
export enum ScreenshotErrorType {
  TAB_NOT_FOUND = 'TAB_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  COMMUNICATION_TIMEOUT = 'COMMUNICATION_TIMEOUT',
  SCROLL_FAILED = 'SCROLL_FAILED',
  SCREENSHOT_API_ERROR = 'SCREENSHOT_API_ERROR',
  USER_INTERRUPTED = 'USER_INTERRUPTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class ScreenshotError extends Error {
  constructor(public type: ScreenshotErrorType, message: string, public context?: any) {
    super(message)
    this.name = 'ScreenshotError'
  }
}

// ===== Composable 实现 =====

export function usePageScreenshot() {
  // 响应式状态
  const state = reactive({
    status: ScreenshotStatus.IDLE,
    progress: {
      current: 0,
      total: 0,
      currentStep: '',
      percentage: 0,
      estimatedTimeLeft: undefined,
    } as ScreenshotProgress,
    result: null as ScreenshotResult | null,
    error: null as string | null,
    tab: null as chrome.tabs.Tab | null,
    lastAbortReason: null as AbortReason,
  })

  // 计算属性
  const isCapturing = computed(() =>
    [ScreenshotStatus.PREPARING, ScreenshotStatus.CAPTURING, ScreenshotStatus.PROCESSING].includes(state.status)
  )

  const canAbort = computed(() => [ScreenshotStatus.PREPARING, ScreenshotStatus.CAPTURING].includes(state.status))

  // 内部状态
  const abortController = ref<AbortController | null>(null)
  const startTime = ref<number>(0)
  const progressTimer = ref<NodeJS.Timeout | null>(null)
  const cleanupTasks = ref<(() => Promise<void>)[]>([])

  // ===== 内部工具方法 =====

  const addCleanupTask = (task: () => Promise<void>) => {
    cleanupTasks.value.push(task)
  }

  const executeCleanup = async () => {
    const tasks = [...cleanupTasks.value]
    cleanupTasks.value = []

    for (const task of tasks) {
      try {
        await task()
      } catch (error) {
        console.warn('Cleanup task failed:', error)
      }
    }
  }

  const checkAbortSignal = () => {
    if (abortController.value?.signal.aborted) {
      throw new ScreenshotError(ScreenshotErrorType.USER_INTERRUPTED, 'Screenshot capture was interrupted by user')
    }
  }

  const updateStatus = (status: ScreenshotStatus, error?: string) => {
    state.status = status
    state.error = error || null

    if (status === ScreenshotStatus.IDLE) {
      resetProgress()
    }
  }

  const updateProgress = (current: number, total: number) => {
    state.progress.current = current
    state.progress.total = total
    state.progress.percentage = total > 0 ? Math.round((current / total) * 100) : 0

    // 计算预估剩余时间
    if (current > 0 && startTime.value > 0) {
      const elapsed = Date.now() - startTime.value
      const avgTimePerStep = elapsed / current
      const remaining = total - current
      state.progress.estimatedTimeLeft = Math.round(avgTimePerStep * remaining)
    }
  }

  const resetProgress = () => {
    state.progress = {
      current: 0,
      total: 0,
      currentStep: '',
      percentage: 0,
      estimatedTimeLeft: undefined,
    }
  }

  // ===== 通信方法 =====

  const sendMessageWithTimeout = async <T>(tabId: number, message: any, timeout: number = 5000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new ScreenshotError(ScreenshotErrorType.COMMUNICATION_TIMEOUT, `Message timeout after ${timeout}ms`, {
            message,
            tabId,
          })
        )
      }, timeout)

      browser.tabs
        .sendMessage(tabId, message)
        .then((response) => {
          clearTimeout(timer)
          resolve(response)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(
            new ScreenshotError(ScreenshotErrorType.COMMUNICATION_TIMEOUT, 'Failed to send message to content script', {
              error,
              message,
              tabId,
            })
          )
        })
    })
  }

  const getActiveTab = async (): Promise<chrome.tabs.Tab> => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (!tab?.id) {
      throw new ScreenshotError(ScreenshotErrorType.TAB_NOT_FOUND, 'No active tab found')
    }

    return tab
  }

  const getPageScrollInfo = async (tabId: number): Promise<PageScrollInfo> => {
    try {
      const response = await sendMessageWithTimeout<any>(tabId, {
        type: SidepanelEventType.GET_PAGE_SCROLL_INFO,
      })

      const { totalHeight, viewportHeight, currentScrollY } = response as {
        totalHeight: number
        viewportHeight: number
        currentScrollY: number
      }
      const scrollSteps = Math.ceil(totalHeight / viewportHeight)

      return {
        totalHeight,
        viewportHeight,
        currentScrollY,
        scrollSteps,
        targetType: response?.targetType,
        innerWidthCss: response?.innerWidthCss,
        devicePixelRatio: response?.devicePixelRatio,
        containerRectCss: response?.containerRectCss ?? null,
      }
    } catch (error) {
      throw new ScreenshotError(ScreenshotErrorType.COMMUNICATION_TIMEOUT, 'Failed to get page scroll information', {
        error,
        tabId,
      })
    }
  }

  const preparePageForScreenshot = async (tabId: number): Promise<void> => {
    try {
      await sendMessageWithTimeout(tabId, {
        type: SidepanelEventType.PREPARE_PAGE_FOR_SCREENSHOT,
      })
    } catch (error) {
      // 不中断截图主流程
      console.warn('Failed to prepare page for screenshot:', error)
    }
  }

  const restorePageAfterScreenshot = async (tabId: number): Promise<void> => {
    try {
      await sendMessageWithTimeout(tabId, {
        type: SidepanelEventType.RESTORE_PAGE_AFTER_SCREENSHOT,
      })
    } catch (error) {
      console.warn('Failed to restore page after screenshot:', error)
    }
  }

  const scrollToPosition = async (tabId: number, position: number): Promise<void> => {
    try {
      await sendMessageWithTimeout(tabId, {
        type: SidepanelEventType.SCROLL_TO_POSITION,
        position,
      })
    } catch (error) {
      throw new ScreenshotError(ScreenshotErrorType.SCROLL_FAILED, `Failed to scroll to position ${position}`, {
        error,
        tabId,
        position,
      })
    }
  }

  const restoreScrollPosition = async (tabId: number, originalPosition: number): Promise<void> => {
    try {
      await sendMessageWithTimeout(tabId, {
        type: SidepanelEventType.RESTORE_SCROLL_POSITION,
        originalPosition,
      })
    } catch (error) {
      console.warn('Failed to restore scroll position:', error)
      // 不抛出错误，因为这不是关键操作
    }
  }

  const takeScreenshot = async (): Promise<string> => {
    try {
      const screenshot = await getTrpc().screenShot.query()
      if (!screenshot || typeof screenshot !== 'string') {
        throw new Error('Invalid screenshot data received')
      }
      return screenshot
    } catch (error) {
      throw new ScreenshotError(ScreenshotErrorType.SCREENSHOT_API_ERROR, 'Failed to capture screenshot', { error })
    }
  }

  const waitForPageStabilization = async (duration: number): Promise<void> => {
    checkAbortSignal()
    await new Promise((resolve) => setTimeout(resolve, duration))
  }

  // ===== 主要截图逻辑 =====

  /**
   * 按比例裁切图片顶部区域，用于移除最后一屏与上一屏的重叠内容
   * @param dataUrl 原始截图 base64
   * @param cropRatioTop 顶部需要裁切的比例 (0~1)
   * @returns 裁切后的 base64 截图
   */
  const cropImageTopByRatio = async (dataUrl: string, cropRatioTop: number): Promise<string> => {
    try {
      if (!dataUrl) return dataUrl
      if (!cropRatioTop || cropRatioTop <= 0) return dataUrl

      // 限制比例范围，避免异常入参
      const safeRatio = Math.max(0, Math.min(0.99, cropRatioTop))

      // 加载图片
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Failed to load screenshot image'))
        image.src = dataUrl
      })

      const cropPixels = Math.round(img.height * safeRatio)
      if (cropPixels <= 0) return dataUrl
      if (cropPixels >= img.height) return dataUrl

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = img.width
      canvas.height = img.height - cropPixels

      // 从原图的 (0, cropPixels) 开始绘制到新画布顶部
      ctx.drawImage(img, 0, cropPixels, img.width, img.height - cropPixels, 0, 0, img.width, img.height - cropPixels)

      // 使用 PNG 导出；质量参数对 PNG 无效，可省略
      return canvas.toDataURL('image/png')
    } catch {
      // 出错时保持原图，避免中断主流程
      return dataUrl
    }
  }

  /**
   * 根据页面高度与视口高度，裁切最后一张截图的顶部重叠区域
   */
  const removeFinalOverlapIfNeeded = async (screenshots: string[], pageInfo: PageScrollInfo): Promise<string[]> => {
    if (!screenshots.length) return screenshots
    const { totalHeight, viewportHeight } = pageInfo
    if (!totalHeight || !viewportHeight) return screenshots

    const remainderCss = totalHeight % viewportHeight
    if (remainderCss === 0) return screenshots

    const overlapCss = viewportHeight - remainderCss
    const overlapRatio = overlapCss / viewportHeight

    const processed = screenshots.slice()
    processed[processed.length - 1] = await cropImageTopByRatio(processed[processed.length - 1], overlapRatio)
    return processed
  }

  const captureScreenshotAtPosition = async (tabId: number, position: number, stepIndex: number): Promise<string> => {
    // 滚动到指定位置
    await scrollToPosition(tabId, position)

    // 等待页面稳定
    await waitForPageStabilization(500)

    // 检查中断信号
    checkAbortSignal()

    // 每步截图前再次进行页面预处理，以处理滚动后动态出现/变为 fixed 的元素
    await preparePageForScreenshot(tabId)

    // 进行截图
    const screenshot = await takeScreenshot()

    console.log(`完成第 ${stepIndex + 1} 张截图`)
    return screenshot
  }

  const executeCaptureLoop = async (
    tabId: number,
    pageInfo: PageScrollInfo,
    options: CaptureOptions
  ): Promise<string[]> => {
    const screenshots: string[] = []
    const { scrollSteps, viewportHeight } = pageInfo
    const { captureInterval = 700 } = options

    for (let i = 0; i < scrollSteps; i++) {
      checkAbortSignal()

      // 更新进度
      updateProgress(i, scrollSteps)

      // 计算滚动位置
      const scrollPosition = i * viewportHeight

      // 截取当前位置的截图
      const screenshot = await captureScreenshotAtPosition(tabId, scrollPosition, i)
      screenshots.push(screenshot)

      // 添加截图间隔（最后一张不需要等待）
      if (i < scrollSteps - 1) {
        await waitForPageStabilization(captureInterval)
      }
    }

    return screenshots
  }

  // ===== 公共API方法 =====

  const capturePageScreenshots = async (options: CaptureOptions = {}): Promise<ScreenshotResult> => {
    // 防止重复执行
    if (isCapturing.value) {
      throw new ScreenshotError(ScreenshotErrorType.UNKNOWN_ERROR, 'Another screenshot capture is already in progress')
    }

    // 初始化
    startTime.value = Date.now()
    abortController.value = new AbortController()
    state.result = null

    let tab: chrome.tabs.Tab | undefined
    let originalScrollY = 0

    try {
      // 1. 准备阶段
      updateStatus(ScreenshotStatus.PREPARING)
      updateProgress(0, 0)

      // 获取当前标签页
      tab = state.tab = await getActiveTab()

      // 2. 预处理页面（隐藏 fixed、去除 sticky），确保后续尺寸计算基于最终布局
      await preparePageForScreenshot(tab.id!)

      // 获取页面滚动信息（在预处理之后获取，避免时序导致的失真）
      const pageInfo = await getPageScrollInfo(tab.id!)
      originalScrollY = pageInfo.currentScrollY

      // 注册清理任务
      addCleanupTask(async () => {
        if (tab?.id) {
          await restoreScrollPosition(tab.id, originalScrollY)
        }
      })

      // 3. 截图阶段
      updateStatus(ScreenshotStatus.CAPTURING)
      let screenshots = await executeCaptureLoop(tab.id!, pageInfo, options)
      // 3.1 当滚动目标为容器时，按主容器矩形裁剪每张截图
      if (pageInfo.targetType === 'element' && pageInfo.containerRectCss) {
        const crop = pageInfo.containerRectCss
        // 基础可用性检查，避免误裁出极小图片
        const basicOk = crop.width > 0 && crop.height > 0 && crop.width >= 100 && crop.height >= 100
        if (basicOk) {
          try {
            // 用首张图宽度估算 CSS -> 像素比例
            const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image()
              img.onload = () => resolve(img)
              img.onerror = () => reject(new Error('Failed to load first screenshot'))
              img.src = screenshots[0]
            })
            const cssWidth = pageInfo.innerWidthCss || firstImg.width
            const scale = firstImg.width / cssWidth

            const cropped: string[] = []
            for (let idx = 0; idx < screenshots.length; idx++) {
              const shot = screenshots[idx]
              const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const im = new Image()
                im.onload = () => resolve(im)
                im.onerror = () => reject(new Error('Failed to load screenshot for crop'))
                im.src = shot
              })
              const sx = Math.max(0, Math.round(crop.left * scale))
              const sy = Math.max(0, Math.round(crop.top * scale))
              const sw = Math.max(1, Math.min(img.width - sx, Math.round(crop.width * scale)))
              const sh = Math.max(1, Math.min(img.height - sy, Math.round(crop.height * scale)))
              if (idx === 0) {
              }
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              canvas.width = sw
              canvas.height = sh
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
              if (idx === 0) {
                // 结果理智校验，过小则放弃裁剪，使用整图
                if (canvas.width < 100 || canvas.height < 100) {
                  console.warn('Cropped image too small; fallback to full screenshots.')
                  cropped.length = 0
                  break
                }
              }
              cropped.push(canvas.toDataURL('image/png'))
            }
            if (cropped.length === screenshots.length) {
              screenshots = cropped
            }
          } catch (e) {
            console.warn('Container cropping failed; using full screenshots.', e)
          }
        }
      }

      // 4. 处理阶段
      updateStatus(ScreenshotStatus.PROCESSING)
      updateProgress(pageInfo.scrollSteps, pageInfo.scrollSteps)

      // 移除最后一张截图与上一张的重叠区域（若 totalHeight 不是 viewportHeight 的整数倍）
      screenshots = await removeFinalOverlapIfNeeded(screenshots, pageInfo)

      // 5. 恢复页面状态
      await restoreScrollPosition(tab.id!, originalScrollY)
      await restorePageAfterScreenshot(tab.id!)

      // 5. 创建成功结果
      const totalTime = Date.now() - startTime.value
      const result: ScreenshotResult = {
        success: true,
        screenshots,
        status: ScreenshotStatus.SUCCESS,
        metadata: {
          totalTime,
          pageUrl: tab.url || '',
          originalScrollY,
        },
      }

      updateStatus(ScreenshotStatus.SUCCESS)
      updateProgress(screenshots.length, screenshots.length)
      state.result = result

      setTimeout(() => {
        resetState()
      }, 1500)

      console.log(`截图完成，共获取 ${screenshots.length} 张图片，耗时 ${totalTime}ms`)

      trackEvent.track('Plugin_Sidebar_capturePageScreenshots', {
        duration: totalTime,
        slices: screenshots.length,
        url: tab.url || '',
      })
      return result
    } catch (error) {
      console.error('Screenshot capture failed:', error)

      const screenshotError =
        error instanceof ScreenshotError
          ? error
          : new ScreenshotError(ScreenshotErrorType.UNKNOWN_ERROR, 'Unknown error occurred', { error })

      const result: ScreenshotResult = {
        success: false,
        screenshots: [],
        status:
          screenshotError.type === ScreenshotErrorType.USER_INTERRUPTED
            ? ScreenshotStatus.INTERRUPTED
            : ScreenshotStatus.FAILED,
        error: screenshotError.message,
      }

      updateStatus(result.status, screenshotError.message)
      state.result = result

      return result
    } finally {
      // 清理资源
      try {
        // 双保险：若中途抛错也尝试恢复页面
        const tab = await getActiveTab().catch(() => undefined as any)
        if (tab?.id) {
          await restorePageAfterScreenshot(tab.id).catch(() => {})
        }
      } catch {}
      await executeCleanup()
      abortController.value = null

      if (progressTimer.value) {
        clearInterval(progressTimer.value)
        progressTimer.value = null
      }
    }
  }

  const abortCapture = () => {
    if (abortController.value && canAbort.value) {
      console.log('User requested to abort screenshot capture')
      abortController.value.abort()
      updateStatus(ScreenshotStatus.INTERRUPTED, 'Screenshot capture was cancelled by user')
    }
  }

  const abortCaptureWithReason = (reason: 'user' | 'guard' = 'user') => {
    state.lastAbortReason = reason
    abortCapture()
    trackEvent.track('Plugin_Sidebar_OneClick_Pupup_Cancel', {
      cancelType: reason,
      url: state.tab?.url,
    })
  }

  const resetState = () => {
    // 允许在非CAPTURING状态下重置
    if (!isCapturing.value) {
      updateStatus(ScreenshotStatus.IDLE)
      state.result = null
      state.error = null
      state.lastAbortReason = null
      resetProgress()
    }
  }

  const getStateSnapshot = () => {
    return {
      status: state.status,
      progress: { ...state.progress },
      result: state.result,
      error: state.error,
      isCapturing: isCapturing.value,
      canAbort: canAbort.value,
      tab: state.tab,
      lastAbortReason: state.lastAbortReason,
    }
  }

  // ===== 流式截图上传功能 =====

  /**
   * 实时拼接切片的上下文
   */
  interface StreamingSliceContext {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    currentY: number // 当前 canvas 已绘制高度
    tileSize: number
    scaleFactor: number
    uploadManager: PageScreenshotUploadManager
  }

  /**
   * 从 canvas 切出一个完整瓦片
   * @returns 切出的瓦片 base64，如果内容不足返回 null
   */
  const extractTileFromCanvas = (context: StreamingSliceContext): string | null => {
    const { canvas, ctx, currentY, tileSize } = context

    // 检查是否有足够内容切片
    if (currentY < tileSize) return null

    // 创建切片 canvas
    const sliceCanvas = document.createElement('canvas')
    const sliceCtx = sliceCanvas.getContext('2d')!
    sliceCanvas.width = tileSize
    sliceCanvas.height = tileSize

    // 白色背景
    sliceCtx.fillStyle = '#ffffff'
    sliceCtx.fillRect(0, 0, tileSize, tileSize)

    // 从原 canvas 顶部切出 tileSize 高度
    sliceCtx.drawImage(canvas, 0, 0, canvas.width, tileSize, 0, 0, canvas.width, tileSize)

    const sliceBase64 = sliceCanvas.toDataURL('image/png')

    // 将剩余内容移到顶部
    const remaining = currentY - tileSize
    if (remaining > 0) {
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')!
      tempCanvas.width = canvas.width
      tempCanvas.height = remaining

      // 复制剩余部分
      tempCtx.drawImage(canvas, 0, tileSize, canvas.width, remaining, 0, 0, canvas.width, remaining)

      // 清空原 canvas 并重绘剩余部分
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(tempCanvas, 0, 0)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    // 更新上下文高度
    context.currentY = remaining

    return sliceBase64
  }

  /**
   * 边截图边拼接边切片边上传的流式截图方法
   *
   * @param options.uploadManager - 外部传入的上传管理器（已注入上传函数）
   */
  const captureWithStreamingUpload = async (
    options: CaptureOptions & {
      uploadManager: PageScreenshotUploadManager
    }
  ): Promise<
    ScreenshotResult & {
      uploadManager: PageScreenshotUploadManager
      tileSize: number
    }
  > => {
    // 防止重复执行
    if (isCapturing.value) {
      throw new ScreenshotError(ScreenshotErrorType.UNKNOWN_ERROR, 'Another screenshot capture is already in progress')
    }

    // 初始化
    startTime.value = Date.now()
    abortController.value = new AbortController()
    state.result = null

    let tab: chrome.tabs.Tab | undefined
    let originalScrollY = 0
    const uploadManager = options.uploadManager

    try {
      // 1. 准备阶段
      updateStatus(ScreenshotStatus.PREPARING)
      updateProgress(0, 0)

      // 获取当前标签页
      tab = state.tab = await getActiveTab()

      // 2. 预处理页面
      await preparePageForScreenshot(tab.id!)

      // 获取页面滚动信息
      const pageInfo = await getPageScrollInfo(tab.id!)
      originalScrollY = pageInfo.currentScrollY

      // 注册清理任务
      addCleanupTask(async () => {
        if (tab?.id) {
          await restoreScrollPosition(tab.id, originalScrollY)
        }
      })

      // 3. 开始截图阶段
      updateStatus(ScreenshotStatus.CAPTURING)

      // 先截第一张以获取实际宽度
      let firstScreenshot = await captureScreenshotAtPosition(tab.id!, 0, 0)

      // ⭐ 新增：容器裁切逻辑
      let cropParams: { sx: number; sy: number; sw: number; sh: number; scale: number } | null = null
      let shouldCropContainer = false

      if (pageInfo.targetType === 'element' && pageInfo.containerRectCss) {
        const crop = pageInfo.containerRectCss
        const basicOk = crop.width > 0 && crop.height > 0 && crop.width >= 100 && crop.height >= 100

        if (basicOk) {
          shouldCropContainer = true
          console.log('📐 检测到容器滚动，将裁切容器区域')

          // 加载第一张截图以计算裁切参数
          const tempImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('Failed to load first screenshot'))
            img.src = firstScreenshot
          })

          const cssWidth = pageInfo.innerWidthCss || tempImg.width
          const scale = tempImg.width / cssWidth

          const sx = Math.max(0, Math.round(crop.left * scale))
          const sy = Math.max(0, Math.round(crop.top * scale))
          const sw = Math.max(1, Math.min(tempImg.width - sx, Math.round(crop.width * scale)))
          const sh = Math.max(1, Math.min(tempImg.height - sy, Math.round(crop.height * scale)))

          // 校验裁切后尺寸
          if (sw < 100 || sh < 100) {
            console.warn('⚠️ 裁切后尺寸过小，放弃容器裁切')
            shouldCropContainer = false
          } else {
            cropParams = { sx, sy, sw, sh, scale }

            // 对第一张截图进行裁切
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')!
            canvas.width = sw
            canvas.height = sh
            ctx.drawImage(tempImg, sx, sy, sw, sh, 0, 0, sw, sh)
            firstScreenshot = canvas.toDataURL('image/png')

            console.log(`📐 容器裁切参数: ${sw}x${sh}`)
          }
        }
      }

      // 加载（可能已裁切的）第一张截图
      const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Failed to load first screenshot'))
        img.src = firstScreenshot
      })

      const maxTargetWidth = 3072
      const tileSize = Math.min(maxTargetWidth, firstImg.width)
      const scaleFactor = tileSize / firstImg.width

      // 更新 uploadManager 的 tileSize
      uploadManager.tileSize = tileSize

      console.log(`📐 切片尺寸: ${tileSize}x${tileSize}, 缩放比例: ${scaleFactor.toFixed(2)}`)

      // 4. 创建拼接 canvas
      const streamCanvas = document.createElement('canvas')
      const streamCtx = streamCanvas.getContext('2d')!
      streamCanvas.width = tileSize
      // 预分配足够高度（估算值）
      streamCanvas.height = Math.ceil(pageInfo.totalHeight * scaleFactor) + tileSize

      const streamingContext: StreamingSliceContext = {
        canvas: streamCanvas,
        ctx: streamCtx,
        currentY: 0,
        tileSize,
        scaleFactor,
        uploadManager,
      }

      // 5. 开始截图循环 - 边截边拼边切边传
      const screenshots: string[] = []

      // 处理第一张截图
      screenshots.push(firstScreenshot)
      const scaledHeight1 = Math.round(firstImg.height * scaleFactor)
      streamCtx.drawImage(firstImg, 0, 0, tileSize, scaledHeight1)
      streamingContext.currentY += scaledHeight1

      // 尝试切片（会自动上传）
      while (true) {
        const slice = extractTileFromCanvas(streamingContext)
        if (!slice) break
        uploadManager.addSlice(slice) // ⭐ 立即触发上传
      }

      // 继续后续截图
      for (let i = 1; i < pageInfo.scrollSteps; i++) {
        checkAbortSignal()
        updateProgress(i, pageInfo.scrollSteps)

        // 截图
        let screenshot = await captureScreenshotAtPosition(tab.id!, i * pageInfo.viewportHeight, i)

        // ⭐ 关键修复：如果是最后一张截图，裁切重叠部分
        if (i === pageInfo.scrollSteps - 1) {
          const remainderCss = pageInfo.totalHeight % pageInfo.viewportHeight
          if (remainderCss !== 0) {
            const overlapCss = pageInfo.viewportHeight - remainderCss
            const overlapRatio = overlapCss / pageInfo.viewportHeight
            console.log(`📐 检测到最后一屏重叠 ${overlapCss}px (${(overlapRatio * 100).toFixed(1)}%)，正在裁切...`)
            screenshot = await cropImageTopByRatio(screenshot, overlapRatio)
          }
        }

        // ⭐ 容器裁切（如果需要）
        if (shouldCropContainer && cropParams) {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error('Failed to load screenshot for container crop'))
            image.src = screenshot
          })

          // ⭐ 关键修复：检查图片高度是否足够进行容器裁切
          if (img.height > cropParams.sy) {
            // 图片高度足够，可以进行裁切
            let actualSh = cropParams.sh

            // 如果图片剩余高度不足sh，调整为实际剩余高度
            if (img.height < cropParams.sy + cropParams.sh) {
              actualSh = img.height - cropParams.sy
            }

            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')!
            canvas.width = cropParams.sw
            canvas.height = actualSh
            ctx.drawImage(img, cropParams.sx, cropParams.sy, cropParams.sw, actualSh, 0, 0, cropParams.sw, actualSh)
            screenshot = canvas.toDataURL('image/png')
          }
          // 如果图片太矮，无法裁切到容器位置，跳过容器裁切
        }

        screenshots.push(screenshot)

        // 加载图片
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error('Failed to load screenshot'))
          image.src = screenshot
        })

        // 缩放并追加到 canvas
        const scaledHeight = Math.round(img.height * scaleFactor)
        streamCtx.drawImage(img, 0, streamingContext.currentY, tileSize, scaledHeight)
        streamingContext.currentY += scaledHeight

        // 尝试切出所有完整瓦片（会自动上传）
        while (true) {
          const slice = extractTileFromCanvas(streamingContext)
          if (!slice) break
          uploadManager.addSlice(slice) // ⭐ 立即触发上传
        }

        // 截图间隔（在这期间，之前的切片在后台上传）
        if (i < pageInfo.scrollSteps - 1) {
          await waitForPageStabilization(options.captureInterval || 700)
        }
      }

      // 6. 处理剩余内容（最后不足一个瓦片的部分）
      if (streamingContext.currentY > 0) {
        const lastSliceCanvas = document.createElement('canvas')
        const lastSliceCtx = lastSliceCanvas.getContext('2d')!
        lastSliceCanvas.width = tileSize
        lastSliceCanvas.height = tileSize

        // 白色背景
        lastSliceCtx.fillStyle = '#ffffff'
        lastSliceCtx.fillRect(0, 0, tileSize, tileSize)

        // 绘制剩余内容（顶对齐）
        lastSliceCtx.drawImage(
          streamCanvas,
          0,
          0,
          streamCanvas.width,
          streamingContext.currentY,
          0,
          0,
          streamCanvas.width,
          streamingContext.currentY
        )

        const lastSlice = lastSliceCanvas.toDataURL('image/png')
        uploadManager.addSlice(lastSlice) // ⭐ 立即触发上传
      }

      // ⭐ 标记所有切片已接收完毕
      uploadManager.markAllSlicesReceived()

      // 7. 处理阶段
      updateStatus(ScreenshotStatus.PROCESSING)
      updateProgress(pageInfo.scrollSteps, pageInfo.scrollSteps)

      // 生成长图（用于显示）
      const longImage = await imageProcessor.stitchScreenshots(screenshots)
      const { finalLongImage } = await imageProcessor.resizeAndSlice(longImage, maxTargetWidth)
      uploadManager.longImage = finalLongImage

      // 8. 恢复页面状态
      await restoreScrollPosition(tab.id!, originalScrollY)
      await restorePageAfterScreenshot(tab.id!)

      // 9. 创建成功结果
      const totalTime = Date.now() - startTime.value
      const result: ScreenshotResult & {
        uploadManager: PageScreenshotUploadManager
        tileSize: number
      } = {
        success: true,
        screenshots,
        status: ScreenshotStatus.SUCCESS,
        uploadManager,
        tileSize,
        metadata: {
          totalTime,
          pageUrl: tab.url || '',
          originalScrollY,
        },
      }

      updateStatus(ScreenshotStatus.SUCCESS)
      updateProgress(uploadManager.progress.value.total, uploadManager.progress.value.total)
      state.result = result

      setTimeout(() => {
        resetState()
      }, 1500)

      console.log(
        `📸 截图完成，共 ${screenshots.length} 张图片，${uploadManager.progress.value.total} 个切片，耗时 ${totalTime}ms`
      )
      console.log(`📊 上传状态: ${uploadManager.progress.value.uploaded}/${uploadManager.progress.value.total} 已完成`)

      trackEvent.track('Plugin_Sidebar_captureWithStreamingUpload', {
        duration: totalTime,
        screenshots: screenshots.length,
        slices: uploadManager.progress.value.total,
        uploadedDuringCapture: uploadManager.progress.value.uploaded,
        url: tab.url || '',
      })

      return result
    } catch (error) {
      console.error('Screenshot capture failed:', error)

      const screenshotError =
        error instanceof ScreenshotError
          ? error
          : new ScreenshotError(ScreenshotErrorType.UNKNOWN_ERROR, 'Unknown error occurred', { error })

      const result: ScreenshotResult & {
        uploadManager: PageScreenshotUploadManager
        tileSize: number
      } = {
        success: false,
        screenshots: [],
        status:
          screenshotError.type === ScreenshotErrorType.USER_INTERRUPTED
            ? ScreenshotStatus.INTERRUPTED
            : ScreenshotStatus.FAILED,
        error: screenshotError.message,
        uploadManager: uploadManager,
        tileSize: uploadManager.tileSize,
      }

      updateStatus(result.status, screenshotError.message)
      state.result = result

      return result
    } finally {
      // 清理资源
      try {
        const tab = await getActiveTab().catch(() => undefined as any)
        if (tab?.id) {
          await restorePageAfterScreenshot(tab.id).catch(() => {})
        }
      } catch {}
      await executeCleanup()
      abortController.value = null

      if (progressTimer.value) {
        clearInterval(progressTimer.value)
        progressTimer.value = null
      }
    }
  }

  return {
    // 响应式状态
    status: computed(() => state.status),
    progress: computed(() => state.progress),
    result: computed(() => state.result),
    error: computed(() => state.error),
    tab: computed(() => state.tab),
    isCapturing,
    canAbort,

    // 方法
    capturePageScreenshots,
    captureWithStreamingUpload,
    abortCapture,
    abortCaptureWithReason,
    resetState,
    getStateSnapshot,
  }
}

// 单例模式，确保全局只有一个实例
let instance: ReturnType<typeof usePageScreenshot> | null = null

export function usePageScreenshotSingleton() {
  if (!instance) {
    instance = usePageScreenshot()
  }
  return instance
}
