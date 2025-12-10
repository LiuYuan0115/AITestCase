import type { ImageInfo } from './types'

/**
 * 图片下载器 - 主动获取图片数据
 */
export class ImageDownloader {
  private readonly CONCURRENT_LIMIT = 3 // 并发下载限制
  private readonly MAX_RETRIES = 2 // 最大重试次数
  private readonly TIMEOUT_MS = 10000 // 下载超时时间

  /**
   * 批量下载所有图片
   * @param images 图片信息数组
   * @returns 下载成功的图片数据Map
   */
  async downloadAllImages(images: ImageInfo[]): Promise<Map<string, {data: string, isSvg: boolean}>> {
    const results = new Map<string, {data: string, isSvg: boolean}>()
    const failures: string[] = []

    console.log(`Starting to download ${images.length} images`)

    // 分批并发下载，避免服务器压力
    for (let i = 0; i < images.length; i += this.CONCURRENT_LIMIT) {
      const batch = images.slice(i, i + this.CONCURRENT_LIMIT)
      const batchPromises = batch.map(async (img) => {
        try {
          const imageData = await this.downloadWithRetry(img.url, this.MAX_RETRIES)
          return { url: img.url, data: imageData, success: true }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.warn(`Failed to download ${img.url}:`, errorMsg)
          failures.push(img.url)
          return { url: img.url, data: null, success: false }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      
      // 存储成功的结果
      batchResults.forEach(result => {
        if (result.success && result.data) {
          results.set(result.url, result.data)
        }
      })

      // 批次间隔，让服务器缓冲
      if (i + this.CONCURRENT_LIMIT < images.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    if (failures.length > 0) {
      console.warn(`${failures.length}/${images.length} images failed to download:`, failures)
    } else {
      console.log(`Successfully downloaded all ${images.length} images`)
    }

    return results
  }

  /**
   * 带重试机制的图片下载
   * @param url 图片URL
   * @param maxRetries 最大重试次数
   * @returns 图片数据
   */
  private async downloadWithRetry(url: string, maxRetries: number): Promise<{data: string, isSvg: boolean}> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // 重试前等待，递增延迟
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          console.log(`Retrying download (${attempt}/${maxRetries}): ${url}`)
        }
        
        return await this.downloadImage(url)
      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.warn(`Download attempt ${attempt + 1} failed for ${url}:`, errorMsg)
      }
    }
    throw new Error('Unexpected error in retry logic')
  }

  /**
   * 下载单张图片
   * @param url 图片URL
   * @returns 图片数据和格式信息
   */
  private async downloadImage(url: string): Promise<{data: string, isSvg: boolean}> {
    // 创建带超时的fetch请求
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS)

    try {
      console.log(`Downloading: ${url}`)
      
      const response = await fetch(url, { 
        signal: controller.signal,
        mode: 'cors', // 尝试跨域访问
        cache: 'default',
        headers: {
          'Accept': 'image/*,*/*;q=0.8'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 检测SVG格式
      const contentType = response.headers.get('content-type') || ''
      const isSvg = this.detectSvgFormat(url, contentType)

      if (isSvg) {
        const svgText = await response.text()
        // 验证SVG内容有效性
        if (!svgText.trim().includes('<svg')) {
          throw new Error('Invalid SVG content')
        }
        console.log(`✓ Downloaded SVG: ${url}`)
        return { data: svgText, isSvg: true }
      } else {
        const blob = await response.blob()
        const base64 = await this.blobToBase64(blob)
        console.log(`✓ Downloaded image: ${url} (${(blob.size / 1024).toFixed(1)}KB)`)
        return { data: base64, isSvg: false }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`Download timeout for ${url}`)
      }
      throw error
    }
  }

  /**
   * 检测SVG格式
   * @param url 图片URL
   * @param contentType HTTP Content-Type头
   * @returns 是否为SVG格式
   */
  private detectSvgFormat(url: string, contentType: string): boolean {
    return (
      contentType.includes('image/svg+xml') ||
      contentType.includes('svg') ||
      url.toLowerCase().includes('.svg') ||
      url.toLowerCase().includes('svg') ||
      url.includes('format=svg')
    )
  }

  /**
   * 将Blob转换为Base64
   * @param blob Blob对象
   * @returns Base64字符串
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'))
      reader.readAsDataURL(blob)
    })
  }
} 