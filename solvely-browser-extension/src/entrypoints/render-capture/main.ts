import { PageRenderer } from './renderer'
import { ScreenshotCapture } from './capture'
import { ImageOptimizer } from './optimizer'
import { ImageDownloader } from './downloader'
import { RenderStage, RenderMode } from './types'
import { uploadFileToS3 } from '@/utils/fileUpload'
import type { RenderTaskState, ImageInfo } from './types'

interface IframeMessage {
  source: string
  type: string
  data?: any
}

class OffscreenRenderApp {
  private state: RenderTaskState = {
    taskId: null,
    stage: RenderStage.IDLE,
    mode: null,
    pageCount: 0,
    startTime: 0,
    timeoutId: null,
  }

  private renderer: PageRenderer
  private capture: ScreenshotCapture
  private optimizer: ImageOptimizer
  private downloader: ImageDownloader
  private originalMarkdown: string = ''
  private originalImages: ImageInfo[] = []

  constructor() {
    this.renderer = new PageRenderer()
    this.capture = new ScreenshotCapture()
    this.optimizer = new ImageOptimizer()
    this.downloader = new ImageDownloader()
    this.setupMessageListener()
    this.notifyReady()
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      this.handleMessage(event).catch((error) => {
        this.handleError(error)
      })
    })
  }

  private notifyReady(): void {
    // 通知父页面 iframe 已准备就绪
    if (window.parent) {
      const message: IframeMessage = {
        source: 'solvely-render-capture',
        type: 'ready',
      }
      window.parent.postMessage(message, '*')
    }
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    // 验证消息来源
    if (!event.data || event.data.source !== 'solvely-answer-message') {
      return
    }

    switch (event.data.type) {
      case 'render_start':
        await this.handleRenderStart(event.data.data)
        break

      default:
        console.warn('Unknown message type:', event.data.type)
    }
  }

  private async handleRenderStart(data: any): Promise<void> {
    try {
      // 1. 初始化
      this.resetState()
      this.state.taskId = data.taskId
      this.state.stage = RenderStage.RENDERING
      this.originalMarkdown = data.markdown
      this.originalImages = data.images
      this.setupTimeout()

      // 2. 渲染Markdown到容器（此时图片为占位符）
      await this.renderer.startRender(data.markdown, data.images)

      // 3. 计算页数并确定渲染模式
      this.calculatePageCountAndMode()

      // 4. 直接进入处理流程
      this.state.stage = RenderStage.CAPTURING

      if (this.state.mode === RenderMode.LONG_IMAGE) {
        await this.handleLongImageFlow()
      } else {
        await this.handleResourceFlow()
      }

      this.state.stage = RenderStage.COMPLETED
    } catch (error) {
      this.handleError(error)
    } finally {
      this.cleanup()
    }
  }

  /**
   * 计算页数并确定渲染模式
   */
  private calculatePageCountAndMode(): void {
    const container = this.renderer.getContainer()
    if (!container) {
      this.state.pageCount = 0
      this.state.mode = RenderMode.LONG_IMAGE
      return
    }

    // 计算页数：容器高度 / 768
    this.state.pageCount = Math.ceil(container.scrollHeight / 768)

    // 确定渲染模式
    this.state.mode = RenderMode.RESOURCE_LIST
    // this.state.mode =
    //   this.state.pageCount <= 2
    //     ? RenderMode.LONG_IMAGE
    //     : RenderMode.RESOURCE_LIST
  }

  /**
   * 处理长图模式（≤2页）
   */
  private async handleLongImageFlow(): Promise<void> {
    // 1. 下载所有图片
    const imageDataMap = await this.downloader.downloadAllImages(
      this.originalImages
    )

    // 2. 插入图片到DOM占位符
    for (const [url, imageData] of imageDataMap) {
      await this.renderer.updateImage(url, imageData.data)
    }

    // 3. 等待布局稳定
    await this.waitForLayoutStability()

    // 4. 截取长图
    const container = this.renderer.getContainer()
    if (!container) {
      throw new Error('Render container not found')
    }

    const longImageBase64 = await this.captureLongImage(container)

    // 5. 上传长图
    const uniqueFileName = `solvely-plugin-long-${Date.now()}.webp`
    const cdnUrl = await uploadFileToS3(longImageBase64, uniqueFileName)

    // 6. 返回结果
    this.sendCompleteMessage({
      success: true,
      result: {
        pageSize: this.state.pageCount,
        cdnUrl,
      },
    })
  }

  /**
   * 处理资源模式（>2页）
   */
  private async handleResourceFlow(): Promise<void> {
    try {
      // 1. 下载所有图片（不插入DOM）
      const imageDataMap = await this.downloader.downloadAllImages(
        this.originalImages
      )

      // 2. 准备优化数据
      const imagesForOptimization = Array.from(imageDataMap.entries()).map(
        ([url, imageData]) => {
          const imageInfo = this.originalImages.find((img) => img.url === url)!
          return {
            url,
            data: imageData.data,
            info: imageInfo,
            isSvg: imageData.isSvg,
          }
        }
      )

      // 3. 批量优化图片
      const optimizedImages = await this.optimizer.batchOptimize(
        imagesForOptimization
      )

      // 4. 串行上传优化后的图片并建立URL映射
      const uploadResults = await this.uploadOptimizedImagesWithMapping(
        optimizedImages
      )

      // 5. 替换markdown中的图片URL
      const updatedMarkdown = this.replaceImageUrlsInMarkdown(
        this.originalMarkdown,
        uploadResults.urlMapping
      )

      // 6. 返回结果
      this.sendCompleteMessage({
        success: true,
        result: {
          pageSize: this.state.pageCount,
          markdown: updatedMarkdown,
          imagesUrl: uploadResults.successful,
        },
      })

      if (uploadResults.failed.length > 0) {
        console.warn(
          `${uploadResults.failed.length} images failed to upload:`,
          uploadResults.failed
        )
      }
    } catch (error) {
      throw new Error(`Resource mode processing failed: ${error}`)
    }
  }

  /**
   * 截取长图（基于现有逻辑但不分页）
   */
  private async captureLongImage(container: HTMLElement): Promise<string> {
    // 使用扩展后的ScreenshotCapture方法
    return await this.capture.captureLongImage(container)
  }

  /**
   * 串行上传优化后的图片（带URL映射）
   * @param optimizedImages 优化后的图片数组
   * @returns 上传结果和URL映射
   */
  private async uploadOptimizedImagesWithMapping(
    optimizedImages: Array<{ url: string; optimizedData: string }>
  ): Promise<{
    successful: string[]
    failed: Array<{ url: string; error: string }>
    urlMapping: Map<string, string>
  }> {
    const MAX_RETRIES = 2
    const UPLOAD_INTERVAL = 50 // 50ms间隔

    const successful: string[] = []
    const failed: Array<{ url: string; error: string }> = []
    const urlMapping = new Map<string, string>()

    // 串行处理每张图片
    for (let i = 0; i < optimizedImages.length; i++) {
      const imageItem = optimizedImages[i]
      const result = await this.uploadOptimizedImageWithRetry(
        imageItem,
        i,
        MAX_RETRIES
      )

      if (result.success && result.url) {
        successful.push(result.url)
        // 建立原始URL到上传URL的映射
        urlMapping.set(imageItem.url, result.url)
      } else {
        failed.push({
          url: imageItem.url,
          error: result.error || 'Upload failed',
        })
      }

      // 固定间隔，避免请求过于频繁（最后一张图片不需要等待）
      if (i < optimizedImages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, UPLOAD_INTERVAL))
      }
    }

    return { successful, failed, urlMapping }
  }

  /**
   * 带重试机制的单张优化图片上传
   * @param imageItem 图片项目
   * @param index 图片索引
   * @param maxRetries 最大重试次数
   * @returns 上传结果
   */
  private async uploadOptimizedImageWithRetry(
    imageItem: { url: string; optimizedData: string },
    index: number,
    maxRetries: number
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // 重试前等待
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }

        // 生成唯一文件名，包含原始URL的标识
        const urlHash = btoa(imageItem.url)
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 8)
        const uniqueFileName = `solvely-plugin-img-${Date.now()}-${index}-${urlHash}.webp`

        const url = await uploadFileToS3(
          imageItem.optimizedData,
          uniqueFileName
        )
        return { success: true, url }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        if (attempt === maxRetries) {
          return {
            success: false,
            error: errorMessage,
          }
        }

        console.warn(
          `图片 ${index + 1} (${imageItem.url}) 第 ${
            attempt + 1
          } 次上传失败: ${errorMessage}`
        )
      }
    }

    return { success: false, error: 'Unexpected error' }
  }

  /**
   * 替换Markdown中的图片URL
   * @param markdown 原始markdown文本
   * @param urlMapping 原始URL到上传URL的映射
   * @returns 替换后的markdown文本
   */
  private replaceImageUrlsInMarkdown(
    markdown: string,
    urlMapping: Map<string, string>
  ): string {
    if (urlMapping.size === 0) {
      console.warn('No URL mapping provided for markdown replacement')
      return markdown
    }

    let updatedMarkdown = markdown
    let replacementCount = 0

    // 遍历所有URL映射进行替换
    urlMapping.forEach((newUrl, originalUrl) => {
      // 计算替换前的出现次数
      const beforeCount = (
        updatedMarkdown.match(
          new RegExp(escapeRegexString(originalUrl), 'g')
        ) || []
      ).length

      // 全局替换所有出现的原始URL
      updatedMarkdown = updatedMarkdown.replaceAll(originalUrl, newUrl)

      // 计算替换后的出现次数
      const afterCount = (
        updatedMarkdown.match(new RegExp(escapeRegexString(newUrl), 'g')) || []
      ).length

      if (beforeCount > 0) {
        replacementCount += beforeCount
      }
    })

    return updatedMarkdown
  }

  /**
   * 等待布局稳定（优化版本）
   * 注意：updateImage()方法已经确保图片加载完成，这里只需等待布局重新计算
   */
  private async waitForLayoutStability(): Promise<void> {
    // 只等待布局稳定，避免冗余的图片加载等待
    // 因为updateImage()中的createImageElement()已经等待了图片加载完成
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  private setupTimeout(): void {
    this.state.timeoutId = window.setTimeout(() => {
      console.warn('Render timeout, proceeding with available content')
      this.handleError(new Error('Render process timeout'))
    }, 30000) // 30秒超时
  }

  private clearTimeout(): void {
    if (this.state.timeoutId) {
      window.clearTimeout(this.state.timeoutId)
      this.state.timeoutId = null
    }
  }

  private resetState(): void {
    this.cleanup()
    this.state = {
      taskId: null,
      stage: RenderStage.IDLE,
      mode: null,
      pageCount: 0,
      startTime: 0,
      timeoutId: null,
    }
    this.originalMarkdown = ''
    this.originalImages = []
  }

  private handleError(error: any): void {
    console.error('Render error:', error)

    const errorCode = this.determineErrorCode(error)

    this.sendCompleteMessage({
      success: false,
      error: {
        code: errorCode,
        message: error.message || 'Unknown error occurred',
      },
    })

    this.state.stage = RenderStage.ERROR
    this.cleanup()
  }

  private determineErrorCode(error: any): string {
    if (error.message?.includes('timeout')) return 'TIMEOUT'
    if (error.message?.includes('render')) return 'RENDER_FAILED'
    if (error.message?.includes('capture')) return 'CAPTURE_FAILED'
    if (error.message?.includes('optimize')) return 'IMAGE_FAILED'
    if (error.message?.includes('upload')) return 'IMAGE_FAILED'
    if (error.message?.includes('download')) return 'IMAGE_FAILED'
    return 'UNKNOWN'
  }

  private sendCompleteMessage(data: any): void {
    if (window.parent) {
      const message: IframeMessage = {
        source: 'solvely-render-capture',
        type: 'render_complete',
        data,
      }
      window.parent.postMessage(message, '*')
    }
  }

  private cleanup(): void {
    this.clearTimeout()
    this.renderer.cleanup()
  }
}

/**
 * 转义字符串中的正则表达式特殊字符
 * @param string 需要转义的字符串
 * @returns 转义后的字符串
 */
function escapeRegexString(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 启动应用
new OffscreenRenderApp()
