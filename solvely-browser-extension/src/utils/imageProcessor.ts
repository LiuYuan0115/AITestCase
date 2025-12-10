/**
 * 图片处理工具类
 * 用于处理页面截图的拼接、缩放和切片
 */
export class ImageProcessor {
  /**
   * 将多个截图拼接成一张长图
   * @param screenshots base64格式的截图数组
   * @returns 拼接后的长图 base64
   */
  async stitchScreenshots(screenshots: string[]): Promise<string> {
    if (!screenshots || screenshots.length === 0) {
      throw new Error('No screenshots provided for stitching')
    }

    if (screenshots.length === 1) {
      return screenshots[0]
    }

    // 创建canvas用于拼接
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // 加载所有图片并计算总高度
    const images = await Promise.all(
      screenshots.map((screenshot) => this.loadImage(screenshot))
    )

    // 假设所有截图宽度一致，使用第一张图片的宽度
    const totalWidth = images[0].width
    const totalHeight = images.reduce((sum, img) => sum + img.height, 0)

    // 设置canvas尺寸
    canvas.width = totalWidth
    canvas.height = totalHeight

    // 逐个绘制图片
    let currentY = 0
    for (const img of images) {
      ctx.drawImage(img, 0, currentY)
      currentY += img.height
    }

    // 不在拼接阶段缩放，直接返回原始宽度的长图
    return canvas.toDataURL('image/png')
  }

  /**
   * 将长图缩放到指定宽度并切片成768x768的图片
   * @param longImageBase64 长图的base64数据
   * @param targetWidth 目标宽度，默认768
   * @returns 切片后的图片base64数组
   */
  async resizeAndSlice(
    longImageBase64: string,
    maxTargetWidth: number = 3072
  ): Promise<{ slices: string[]; tileSize: number; finalLongImage: string }> {
    // 加载原图
    const originalImage = await this.loadImage(longImageBase64)

    // 依据原始宽度决定最终切片尺寸（正方形 tileSize）
    const tileSize = Math.min(maxTargetWidth, originalImage.width)

    // 若需要缩放，先将长图缩放到 tileSize 宽；否则直接使用原图
    let workCanvas = document.createElement('canvas')
    let workCtx = workCanvas.getContext('2d')!
    const scaleFactor = tileSize / originalImage.width
    const scaledWidth = tileSize
    const scaledHeight = Math.round(originalImage.height * scaleFactor)

    workCanvas.width = scaledWidth
    workCanvas.height = scaledHeight
    workCtx.drawImage(originalImage, 0, 0, scaledWidth, scaledHeight)

    // 计算需要多少个切片（纵向）
    const sliceCount = Math.ceil(scaledHeight / tileSize)
    const slices: string[] = []

    for (let i = 0; i < sliceCount; i++) {
      const sliceCanvas = document.createElement('canvas')
      const sliceCtx = sliceCanvas.getContext('2d')!
      sliceCanvas.width = tileSize
      sliceCanvas.height = tileSize

      const sourceY = i * tileSize
      const sourceHeight = Math.min(tileSize, scaledHeight - sourceY)

      // 背景填充白色
      sliceCtx.fillStyle = '#ffffff'
      sliceCtx.fillRect(0, 0, tileSize, tileSize)

      // 顶对齐绘制，最后一片不足高度时底部留白
      sliceCtx.drawImage(
        workCanvas,
        0,
        sourceY,
        scaledWidth,
        sourceHeight,
        0,
        0,
        scaledWidth,
        sourceHeight
      )

      slices.push(sliceCanvas.toDataURL('image/png'))
    }

    const finalLongImage = workCanvas.toDataURL('image/png')
    return { slices, tileSize, finalLongImage }
  }

  /**
   * 处理完整的截图流程：拼接 -> 缩放 -> 切片
   * @param screenshots 截图base64数组
   * @param targetWidth 目标宽度，默认768
   * @returns 处理后的图片切片base64数组
   */
  async processScreenshots(
    screenshots: string[],
    maxTargetWidth: number = 3072
  ): Promise<{
    longImage: string
    slices: string[]
    tileSize: number
  }> {
    try {
      console.log(`开始处理 ${screenshots.length} 张截图`)

      // 1. 拼接截图（不缩放）
      const longImage = await this.stitchScreenshots(screenshots)
      console.log('截图拼接完成')

      // 2.（必要时）缩放到不超过 maxTargetWidth，并按正方形切片
      const { slices, tileSize, finalLongImage } = await this.resizeAndSlice(
        longImage,
        maxTargetWidth
      )
      console.log(`切片完成，共生成 ${slices.length} 个切片，tileSize=${tileSize}`)

      return {
        longImage: finalLongImage,
        slices,
        tileSize,
      }
    } catch (error) {
      console.error('图片处理失败:', error)
      throw new Error(
        `图片处理失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }
  }

  /**
   * 加载图片的辅助方法
   * @param base64 图片的base64数据
   * @returns Promise<HTMLImageElement>
   */
  private loadImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = base64
    })
  }
}

// 创建默认实例供外部使用
export const imageProcessor = new ImageProcessor()
