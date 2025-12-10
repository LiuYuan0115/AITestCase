/**
 * 页面数据上传工具类
 * 用于下载页面中的图片并批量上传到S3
 */
import { getPdfUploadUrl } from '~/api'
import { generateHashesFromBase64 } from '~/utils/fileConverter'
import { STORAGE_KEY } from '~/config/storage'

export interface ImageDownloadResult {
  url: string
  base64: string
  success: boolean
  error?: string
  fileName: string
  originalExtension: string
}

export interface UploadResult {
  urls: {
    html: string
    json: string
    images: string[]
  }
  success: boolean
  error?: string
}

interface FileInfo {
  fileName: string
  contentMD5: string
}

interface UploadFile {
  fileName: string
  base64Data: string
  fileType: string
}

interface TodayFetchRecord {
  date: string // "2024-01-17"
  count: number // 今天已执行次数
}

export class PageDataUploader {
  private static readonly DAILY_LIMIT = 3

  /**
   * 检查今天是否还可以执行页面数据获取
   */
  static async canFetchToday(): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10)

    try {
      const result = await browser.storage.local.get(
        STORAGE_KEY.PAGE_DATA_FETCH_TODAY
      )
      const record: TodayFetchRecord = result[
        STORAGE_KEY.PAGE_DATA_FETCH_TODAY
      ] || { date: today, count: 0 }

      // 如果不是今天的数据，重置计数
      if (record.date !== today) {
        record.date = today
        record.count = 0
      }

      return record.count < this.DAILY_LIMIT
    } catch (error) {
      console.warn('检查页面数据获取限制失败:', error)
      return true // 出错时允许执行
    }
  }

  /**
   * 增加今天的执行计数
   */
  static async incrementTodayCount(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)

    try {
      const result = await browser.storage.local.get(
        STORAGE_KEY.PAGE_DATA_FETCH_TODAY
      )
      const record: TodayFetchRecord = result[
        STORAGE_KEY.PAGE_DATA_FETCH_TODAY
      ] || { date: today, count: 0 }

      // 如果不是今天的数据，重置计数
      if (record.date !== today) {
        record.date = today
        record.count = 0
      }

      // 增加计数
      record.count += 1

      // 保存更新
      await browser.storage.local.set({
        [STORAGE_KEY.PAGE_DATA_FETCH_TODAY]: record,
      })

      console.log(`页面数据获取次数: ${record.count}/${this.DAILY_LIMIT}`)
    } catch (error) {
      console.error('更新页面数据获取计数失败:', error)
    }
  }

  private generatePrefix(): string {
    return Date.now().toString()
  }

  private getFileExtension(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const lastDot = pathname.lastIndexOf('.')

      if (lastDot > 0) {
        const ext = pathname.substring(lastDot + 1).toLowerCase()
        // 常见图片格式
        const validExtensions = [
          'png',
          'jpg',
          'jpeg',
          'gif',
          'webp',
          'svg',
          'bmp',
        ]
        return validExtensions.includes(ext) ? ext : 'png'
      }
    } catch (error) {
      console.warn('解析图片URL扩展名失败:', url, error)
    }
    return 'png' // 默认扩展名
  }

  private async downloadImage(
    url: string,
    index: number,
    prefix: string
  ): Promise<ImageDownloadResult> {
    try {
      console.log('开始下载图片:', url)

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()

      // 转换为base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const originalExtension = this.getFileExtension(url)
      const fileName = `${prefix}_${index + 1}.${originalExtension}`

      return {
        url,
        base64,
        success: true,
        fileName,
        originalExtension,
      }
    } catch (error) {
      console.error('图片下载失败:', url, error)

      const originalExtension = this.getFileExtension(url)
      const fileName = `${prefix}_${index + 1}.${originalExtension}`

      return {
        url,
        base64: '',
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        fileName,
        originalExtension,
      }
    }
  }

  private async downloadImages(
    urls: string[],
    prefix: string
  ): Promise<ImageDownloadResult[]> {
    console.log('开始并行下载图片，总数:', urls.length)

    // 限制并发数，避免过多请求
    const concurrencyLimit = 5
    const results: ImageDownloadResult[] = []

    for (let i = 0; i < urls.length; i += concurrencyLimit) {
      const batch = urls.slice(i, i + concurrencyLimit)
      const batchPromises = batch.map((url, batchIndex) =>
        this.downloadImage(url, i + batchIndex, prefix)
      )

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error('图片下载批次失败:', result.reason)
        }
      })
    }

    const successCount = results.filter((r) => r.success).length
    console.log(`图片下载完成: ${successCount}/${urls.length} 成功`)

    return results
  }

  private generateFileNames(
    prefix: string,
    imageResults: ImageDownloadResult[]
  ): {
    html: string
    json: string
    images: { original: string; fileName: string }[]
  } {
    return {
      html: `${prefix}.html`,
      json: `${prefix}.json`,
      images: imageResults
        .filter((result) => result.success)
        .map((result) => ({
          original: result.url,
          fileName: result.fileName,
        })),
    }
  }

  private async prepareUploadFiles(
    html: string,
    imageResults: ImageDownloadResult[],
    fileNames: any
  ): Promise<UploadFile[]> {
    const files: UploadFile[] = []

    // 1. 准备HTML文件
    const htmlBase64 = btoa(unescape(encodeURIComponent(html)))
    files.push({
      fileName: fileNames.html,
      base64Data: `data:text/html;base64,${htmlBase64}`,
      fileType: 'text/html',
    })

    // 2. 准备图片文件
    const successfulImages = imageResults.filter((result) => result.success)
    for (const imageResult of successfulImages) {
      files.push({
        fileName: imageResult.fileName,
        base64Data: imageResult.base64,
        fileType: `image/${imageResult.originalExtension}`,
      })
    }

    // 3. 准备JSON描述文件
    const jsonData = {
      htmlFileName: fileNames.html,
      images: fileNames.images,
      uploadTime: new Date().toISOString(),
      totalImages: imageResults.length,
      successfulImages: successfulImages.length,
    }

    const jsonBase64 = btoa(
      unescape(encodeURIComponent(JSON.stringify(jsonData, null, 2)))
    )
    files.push({
      fileName: fileNames.json,
      base64Data: `data:application/json;base64,${jsonBase64}`,
      fileType: 'application/json',
    })

    return files
  }

  /**
   * 通用的 base64 到 Blob 转换方法
   * 支持所有文件类型的 data URL
   */
  private convertBase64ToBlob(base64Data: string, fileType: string): Blob {
    try {
      // 处理所有类型的 data URL：
      // - data:text/html;base64,xxx
      // - data:application/json;base64,xxx
      // - data:image/jpeg;base64,xxx
      const base64Content = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data

      const binaryString = atob(base64Content)
      const bytes = new Uint8Array(binaryString.length)

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      return new Blob([bytes], { type: fileType })
    } catch (error) {
      console.error(
        'base64 转 Blob 失败:',
        { fileType, base64Length: base64Data.length },
        error
      )
      throw new Error(
        `base64 转换失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`
      )
    }
  }

  /**
   * 直接上传到 S3
   */
  private async uploadToS3Direct(
    url: string,
    blob: Blob,
    md5: string,
    fileType: string
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-MD5': md5,
          'Content-Type': fileType,
        },
        body: blob,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(
          `S3上传失败: ${response.status} ${response.statusText}, ${errorText}`
        )
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络状态')
      }
      throw error
    }
  }

  /**
   * 上传单个文件
   */
  private async uploadSingleFile(
    file: UploadFile
  ): Promise<{ fileName: string; cdnUrl: string }> {
    try {
      console.log('开始上传文件:', file.fileName)

      // 1. 生成文件MD5（需要两种格式）
      const { combinedHash, base64Hash } = await generateHashesFromBase64(
        file.base64Data
      )

      // 2. 获取单文件预签名URL
      const uploadData = {
        files: [
          {
            fileName: file.fileName,
            contentMD5: combinedHash, // 使用十六进制格式的MD5
          },
        ],
        dirname: 'page-snapshots', // 使用固定目录名
      }

      const uploadUrls = await getPdfUploadUrl(uploadData)

      if (
        !uploadUrls?.data ||
        !Array.isArray(uploadUrls.data) ||
        uploadUrls.data.length === 0
      ) {
        throw new Error(`获取文件 ${file.fileName} 的上传URL失败`)
      }

      const urlInfo = uploadUrls.data[0]

      // 3. 直接上传文件到S3（替换原来的 trpc 调用）
      const blob = this.convertBase64ToBlob(file.base64Data, file.fileType)
      await this.uploadToS3Direct(urlInfo.url, blob, base64Hash, file.fileType)

      console.log('文件上传成功:', file.fileName)
      return {
        fileName: file.fileName,
        cdnUrl: urlInfo.cdnUrl,
      }
    } catch (error) {
      console.error('单文件上传失败:', file.fileName, error)
      throw error
    }
  }

  private async uploadFiles(files: UploadFile[]): Promise<UploadResult> {
    try {
      console.log('开始分批上传文件，总数量:', files.length)

      const concurrencyLimit = 3 // 最多并行3个请求
      const allResults: Array<{ fileName: string; cdnUrl: string }> = []
      const allErrors: Array<{ fileName: string; error: string }> = []

      // 分批处理文件
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit)
        console.log(
          `处理第 ${Math.floor(i / concurrencyLimit) + 1} 批文件，数量: ${
            batch.length
          }`
        )

        // 并行处理当前批次
        const batchResults = await Promise.allSettled(
          batch.map((file) => this.uploadSingleFile(file))
        )

        // 整理批次结果
        batchResults.forEach((result, index) => {
          const file = batch[index]
          if (result.status === 'fulfilled') {
            allResults.push(result.value)
          } else {
            const errorMessage =
              result.reason instanceof Error
                ? result.reason.message
                : '未知错误'
            allErrors.push({
              fileName: file.fileName,
              error: errorMessage,
            })
          }
        })
      }

      // 输出统计信息
      console.log(
        `文件上传完成: 成功 ${allResults.length}/${files.length}，失败 ${allErrors.length}`
      )
      if (allErrors.length > 0) {
        console.warn('失败的文件:', allErrors)
      }

      // 分类整理结果
      const result: UploadResult = {
        urls: {
          html: '',
          json: '',
          images: [],
        },
        success: allResults.length > 0,
      }

      allResults.forEach((upload) => {
        if (upload.fileName.endsWith('.html')) {
          result.urls.html = upload.cdnUrl
        } else if (upload.fileName.endsWith('.json')) {
          result.urls.json = upload.cdnUrl
        } else {
          result.urls.images.push(upload.cdnUrl)
        }
      })

      console.log('最终上传结果:', result)
      return result
    } catch (error) {
      console.error('文件上传流程失败:', error)
      return {
        urls: { html: '', json: '', images: [] },
        success: false,
        error: error instanceof Error ? error.message : '上传失败',
      }
    }
  }

  public async uploadPageData(data: {
    html: string
    imageUrls: string[]
  }): Promise<UploadResult> {
    try {
      console.log('开始页面数据上传流程')
      console.log('HTML长度:', data.html.length)
      console.log('图片数量:', data.imageUrls.length)

      const prefix = this.generatePrefix()

      // 1. 下载图片
      const imageResults = await this.downloadImages(data.imageUrls, prefix)

      // 2. 生成文件名
      const fileNames = this.generateFileNames(prefix, imageResults)

      // 3. 准备上传文件
      const uploadFiles = await this.prepareUploadFiles(
        data.html,
        imageResults,
        fileNames
      )

      // 4. 执行上传
      const result = await this.uploadFiles(uploadFiles)

      console.log('页面数据上传流程完成')
      return result
    } catch (error) {
      console.error('页面数据上传流程失败:', error)
      return {
        urls: { html: '', json: '', images: [] },
        success: false,
        error: error instanceof Error ? error.message : '上传失败',
      }
    }
  }
}
