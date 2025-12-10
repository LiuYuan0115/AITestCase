import type { ImageInfo } from './types'

/**
 * 图片优化器 - 处理图片尺寸调整、质量压缩和SVG转换
 * 优化策略：统一WebP输出，最大化压缩效果
 */
export class ImageOptimizer {
  // 极致压缩配置 - 统一WebP策略
  private readonly COMPRESSION_CONFIG = {
    webpQuality: 0.5, // WebP 50%质量 - 激进压缩
    maxDimension: 800, // 最大尺寸限制
    scaleFactor: 1, // 更激进的缩放（85%）
    mimeType: 'image/webp', // 统一WebP格式
  }

  /**
   * 优化图片
   * @param imageData base64图片数据或SVG文本
   * @param targetInfo 目标图片信息
   * @param isSvg 是否为SVG格式
   * @returns 优化后的WebP base64图片数据
   */
  async optimizeImage(
    imageData: string,
    targetInfo: ImageInfo,
    isSvg: boolean
  ): Promise<string> {
    if (isSvg) {
      return await this.convertSvgToWebP(imageData, targetInfo)
    }
    return await this.resizeAndCompressToWebP(imageData, targetInfo)
  }

  /**
   * 将SVG转换为WebP图片
   * @param svgData SVG文本数据
   * @param info 目标尺寸信息
   * @returns WebP格式的base64图片数据
   */
  private async convertSvgToWebP(
    svgData: string,
    info: ImageInfo
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // 创建SVG blob URL
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml' })
        const svgUrl = URL.createObjectURL(svgBlob)

        // 创建图片元素
        const img = new Image()
        img.onload = () => {
          try {
            // 优化尺寸
            const optimizedSize = this.calculateOptimizedSize(info)

            // 创建canvas
            const canvas = document.createElement('canvas')
            canvas.width = optimizedSize.width
            canvas.height = optimizedSize.height

            const ctx = canvas.getContext('2d')!
            ctx.scale(1, 1)

            // 填充白色背景（WebP不透明背景压缩更好）
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // 使用高质量缩放
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'

            // 绘制SVG
            ctx.drawImage(img, 0, 0, optimizedSize.width, optimizedSize.height)

            // 转换为WebP
            const webpData = canvas.toDataURL(
              this.COMPRESSION_CONFIG.mimeType,
              this.COMPRESSION_CONFIG.webpQuality
            )

            // 清理资源
            URL.revokeObjectURL(svgUrl)
            canvas.width = 0
            canvas.height = 0

            const originalSize = svgData.length
            const optimizedSizeBytes = webpData.length
            const compressionRatio = (
              ((originalSize - optimizedSizeBytes) / originalSize) *
              100
            ).toFixed(1)

            console.log(
              `SVG→WebP: ${info.width}x${info.height} → ${
                optimizedSize.width
              }x${optimizedSize.height}, ${(originalSize / 1024).toFixed(
                1
              )}KB → ${(optimizedSizeBytes / 1024).toFixed(
                1
              )}KB (-${compressionRatio}%)`
            )

            resolve(webpData)
          } catch (error) {
            URL.revokeObjectURL(svgUrl)
            reject(new Error(`SVG to WebP conversion failed: ${error}`))
          }
        }

        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          reject(new Error('Failed to load SVG image'))
        }

        img.src = svgUrl
      } catch (error) {
        reject(new Error(`SVG processing failed: ${error}`))
      }
    })
  }

  /**
   * 调整图片尺寸并压缩为WebP
   * @param imageData base64图片数据
   * @param info 目标尺寸信息
   * @returns WebP格式的base64图片数据
   */
  private async resizeAndCompressToWebP(
    imageData: string,
    info: ImageInfo
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image()
        img.onload = () => {
          try {
            // 优化尺寸
            const optimizedSize = this.calculateOptimizedSize(info)

            // 创建canvas
            const canvas = document.createElement('canvas')
            canvas.width = optimizedSize.width
            canvas.height = optimizedSize.height

            const ctx = canvas.getContext('2d')!

            // 使用高质量的缩放算法
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'

            // 如果原图有透明度，填充白色背景（WebP压缩更优）
            if (this.mayHaveTransparency(imageData)) {
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
            }

            // 绘制缩放后的图片
            ctx.drawImage(img, 0, 0, optimizedSize.width, optimizedSize.height)

            // 统一转换为WebP
            const webpData = canvas.toDataURL(
              this.COMPRESSION_CONFIG.mimeType,
              this.COMPRESSION_CONFIG.webpQuality
            )

            // 清理资源
            canvas.width = 0
            canvas.height = 0

            const originalSize = imageData.length
            const optimizedSizeBytes = webpData.length
            const compressionRatio = (
              ((originalSize - optimizedSizeBytes) / originalSize) *
              100
            ).toFixed(1)

            console.log(
              `Image→WebP: ${info.width}x${info.height} → ${
                optimizedSize.width
              }x${optimizedSize.height}, ${(originalSize / 1024).toFixed(
                1
              )}KB → ${(optimizedSizeBytes / 1024).toFixed(
                1
              )}KB (-${compressionRatio}%)`
            )

            resolve(webpData)
          } catch (error) {
            reject(new Error(`Image to WebP conversion failed: ${error}`))
          }
        }

        img.onerror = () => {
          reject(new Error('Failed to load image for WebP conversion'))
        }

        img.src = imageData
      } catch (error) {
        reject(new Error(`Image processing failed: ${error}`))
      }
    })
  }

  /**
   * 计算优化后的尺寸
   * @param originalInfo 原始尺寸信息
   * @returns 优化后的尺寸
   */
  private calculateOptimizedSize(originalInfo: ImageInfo): {
    width: number
    height: number
  } {
    const { width: originalWidth, height: originalHeight } = originalInfo
    const { maxDimension, scaleFactor } = this.COMPRESSION_CONFIG

    // 应用更激进的缩放因子
    let newWidth = Math.round(originalWidth * scaleFactor)
    let newHeight = Math.round(originalHeight * scaleFactor)

    // 检查最大尺寸限制
    const maxOriginal = Math.max(newWidth, newHeight)
    if (maxOriginal > maxDimension) {
      const ratio = maxDimension / maxOriginal
      newWidth = Math.round(newWidth * ratio)
      newHeight = Math.round(newHeight * ratio)
    }

    // 确保最小尺寸（WebP在小尺寸下表现良好）
    newWidth = Math.max(newWidth, 32)
    newHeight = Math.max(newHeight, 32)

    return { width: newWidth, height: newHeight }
  }

  /**
   * 检测图片是否可能有透明度
   * @param imageData base64图片数据
   * @returns 是否可能有透明度
   */
  private mayHaveTransparency(imageData: string): boolean {
    // PNG通常有透明度，GIF可能有，JPEG没有
    return (
      imageData.includes('data:image/png') ||
      imageData.includes('data:image/gif') ||
      imageData.includes('data:image/webp')
    )
  }

  /**
   * 批量优化图片为WebP格式
   * @param imagesData 图片数据数组 {url, data, info, isSvg}
   * @returns 优化后的WebP图片数据数组 {url, optimizedData}
   */
  async batchOptimize(
    imagesData: Array<{
      url: string
      data: string
      info: ImageInfo
      isSvg: boolean
    }>
  ): Promise<
    Array<{
      url: string
      optimizedData: string
    }>
  > {
    const results: Array<{ url: string; optimizedData: string }> = []
    let totalOriginalSize = 0
    let totalOptimizedSize = 0

    // 串行处理避免内存压力
    for (let i = 0; i < imagesData.length; i++) {
      const imageItem = imagesData[i]

      try {
        const originalSize = imageItem.data.length
        totalOriginalSize += originalSize

        const optimizedData = await this.optimizeImage(
          imageItem.data,
          imageItem.info,
          imageItem.isSvg
        )

        const optimizedSize = optimizedData.length
        totalOptimizedSize += optimizedSize

        results.push({
          url: imageItem.url,
          optimizedData,
        })
      } catch (error) {
        console.warn(`❌ Failed to optimize ${imageItem.url}:`, error)
        // 优化失败时使用原始数据
        results.push({
          url: imageItem.url,
          optimizedData: imageItem.data,
        })
        totalOptimizedSize += imageItem.data.length
      }

      // 处理间隔，让垃圾回收器工作
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // 输出总体优化统计
    if (totalOriginalSize > 0) {
      const totalCompressionRatio = (
        ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) *
        100
      ).toFixed(1)
    }

    return results
  }
}
