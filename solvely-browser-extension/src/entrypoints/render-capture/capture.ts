import html2canvas from 'html2canvas'

class FullPageCapture {
  async capture(container: HTMLElement): Promise<HTMLCanvasElement> {
    // 等待所有资源稳定
    // await this.waitForStability(container)
    const canvas = await html2canvas(container, {
      width: 768,
      height: container.scrollHeight,
      useCORS: true,
      allowTaint: true,
      background: '#ffffff',
      logging: false,
      scale: 1,
    })
    return canvas
  }

  private async waitForStability(container: HTMLElement): Promise<void> {
    // 等待图片加载（由外层调用者负责）
    // 这里主要等待布局稳定
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

class PageSlicer {
  private readonly PAGE_SIZE = 768

  async sliceIntoPages(fullCanvas: HTMLCanvasElement): Promise<string[]> {
    const totalHeight = fullCanvas.height
    const pageCount = Math.ceil(totalHeight / this.PAGE_SIZE)
    const pages: string[] = []

    // 分批处理避免内存问题
    const BATCH_SIZE = 3

    for (let i = 0; i < pageCount; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, pageCount)
      const batchPages = await this.processBatch(fullCanvas, i, batchEnd)
      pages.push(...batchPages)

      // 批次间隙让垃圾回收器工作
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    return pages
  }

  private async processBatch(
    sourceCanvas: HTMLCanvasElement,
    startIndex: number,
    endIndex: number
  ): Promise<string[]> {
    const pages: string[] = []

    for (let i = startIndex; i < endIndex; i++) {
      const pageCanvas = this.createPageCanvas(sourceCanvas, i)
      pages.push(pageCanvas.toDataURL('image/png', 0.95))

      // 立即清理Canvas避免内存积累
      pageCanvas.width = 0
      pageCanvas.height = 0
    }

    return pages
  }

  private createPageCanvas(
    sourceCanvas: HTMLCanvasElement,
    pageIndex: number
  ): HTMLCanvasElement {
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = this.PAGE_SIZE
    pageCanvas.height = this.PAGE_SIZE

    const ctx = pageCanvas.getContext('2d')!

    // 填充白色背景（处理最后一页高度不足）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.PAGE_SIZE, this.PAGE_SIZE)

    // 计算源区域
    const sourceY = pageIndex * this.PAGE_SIZE
    const sourceHeight = Math.min(this.PAGE_SIZE, sourceCanvas.height - sourceY)

    // 绘制内容
    if (sourceHeight > 0) {
      ctx.drawImage(
        sourceCanvas,
        0,
        sourceY,
        this.PAGE_SIZE,
        sourceHeight, // 源区域
        0,
        0,
        this.PAGE_SIZE,
        sourceHeight // 目标区域
      )
    }

    return pageCanvas
  }
}

export class ScreenshotCapture {
  private fullPageCapture: FullPageCapture
  private pageSlicer: PageSlicer

  constructor() {
    this.fullPageCapture = new FullPageCapture()
    this.pageSlicer = new PageSlicer()
  }

  async captureAndSlice(container: HTMLElement): Promise<string[]> {
    try {
      const s = Date.now()
      // 生成完整页面截图
      const fullCanvas = await this.fullPageCapture.capture(container)
      // 分页切片
      const pages = await this.pageSlicer.sliceIntoPages(fullCanvas)
      // 清理完整截图
      fullCanvas.width = 0
      fullCanvas.height = 0

      return pages
    } catch (error) {
      throw new Error(
        `Screenshot capture failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  /**
   * 截取长图（用于长图模式）
   * @param container DOM容器
   * @returns base64格式的图片数据
   */
  async captureLongImage(container: HTMLElement): Promise<string> {
    try {
      // 生成完整页面截图
      const fullCanvas = await this.fullPageCapture.capture(container)
      // 转换为base64
      const base64 = fullCanvas.toDataURL('image/png', 0.95)

      // 清理内存
      fullCanvas.width = 0
      fullCanvas.height = 0

      return base64
    } catch (error) {
      throw new Error(
        `Long image capture failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }
}
