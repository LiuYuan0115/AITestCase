import { ref, Ref } from 'vue'

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed'
export type UploadFunction = (base64: string, fileName: string) => Promise<string>

interface SliceInfo {
  index: number
  cdnUrl: string | null
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: Error
}

/**
 * 页面截图上传管理器
 * 负责管理切片的实时上传和状态跟踪
 *
 * 使用方式：
 * 1. 创建实例：const manager = new PageScreenshotUploadManager(tileSize)
 * 2. 注入上传函数：manager.setUploadFunction(uploadFileToS3)
 * 3. 添加切片（自动上传）：manager.addSlice(base64)
 * 4. 标记完成：manager.markAllSlicesReceived()
 * 5. 等待上传：await manager.waitForCompletion()
 */
export class PageScreenshotUploadManager {
  // 响应式状态
  public status: Ref<UploadStatus>
  public progress: Ref<{
    uploaded: number
    total: number
    percentage: number
  }>
  public error: Ref<Error | null>

  // 元数据
  public tileSize: number
  public longImage: string

  // 私有状态
  private slices: SliceInfo[] = []
  private sliceDataCache: string[] = [] // 缓存切片 base64
  private uploadFunction: UploadFunction | null = null
  private uploadFunctionInjector?: () => void // 延迟注入回调
  private completionPromise: Promise<string[]> | null = null
  private completionResolve: ((urls: string[]) => void) | null = null
  private completionReject: ((error: Error) => void) | null = null
  private isAllSlicesReceived = false

  // 优化上传相关状态
  private optimizedSlices: SliceInfo[] = []
  private optimizedCompletionPromise: Promise<string[]> | null = null
  private optimizedCompletionResolve: ((urls: string[]) => void) | null = null
  private optimizedCompletionReject: ((error: Error) => void) | null = null
  private isOptimizedUploadStarted = false

  constructor(tileSize: number, longImage: string = '') {
    this.status = ref<UploadStatus>('pending')
    this.progress = ref({ uploaded: 0, total: 0, percentage: 0 })
    this.error = ref<Error | null>(null)
    this.tileSize = tileSize
    this.longImage = longImage

    // 创建完成 Promise
    this.completionPromise = new Promise((resolve, reject) => {
      this.completionResolve = resolve
      this.completionReject = reject
    })
  }

  /**
   * 设置上传函数注入器（当需要时自动调用）
   */
  setUploadFunctionInjector(injector: () => void) {
    this.uploadFunctionInjector = injector
    console.log('📤 上传函数注入器已设置，将在第3个切片时启动')
  }

  /**
   * 设置上传函数（由注入器调用）
   */
  setUploadFunction(fn: UploadFunction) {
    this.uploadFunction = fn
    this.status.value = 'uploading'
    console.log('📤 上传函数已注入')
  }

  /**
   * 添加切片（自动判断是否启动上传）
   */
  addSlice(base64: string): number {
    const index = this.slices.length

    // 添加切片信息
    this.slices.push({
      index,
      cdnUrl: null,
      status: 'pending',
    })

    // ⭐ 缓存 base64 数据
    this.sliceDataCache[index] = base64

    // 更新总数
    this.progress.value.total = this.slices.length

    console.log(`📦 添加切片 #${index + 1}, 总数: ${this.slices.length}`)

    // ⭐ 关键：当第3个切片到来时，启动上传
    if (this.slices.length === 3 && !this.uploadFunction) {
      console.log('🚀 检测到第3个切片，启动边截边传上传！')

      // 调用注入器获取上传函数
      if (this.uploadFunctionInjector) {
        this.uploadFunctionInjector()
      }

      // 上传前面缓存的所有切片（1、2、3）
      if (this.uploadFunction) {
        for (let i = 0; i < this.slices.length; i++) {
          this.uploadSlice(i, this.sliceDataCache[i])
        }
      }
    } else if (this.uploadFunction) {
      // 上传函数已注入，直接上传当前切片
      this.uploadSlice(index, base64)
    }

    return index
  }

  /**
   * 标记所有切片已接收完毕（截图完成后调用）
   */
  markAllSlicesReceived() {
    this.isAllSlicesReceived = true
    console.log(`✅ 所有切片已接收，共 ${this.slices.length} 个`)
    this.checkCompletion()
  }

  /**
   * 标记为跳过上传（小页面使用）
   */
  markAsSkipped() {
    this.isAllSlicesReceived = true
    this.status.value = 'completed'
    console.log('✅ 小页面（<=2 切片），跳过上传直接完成')
    // 返回空数组，表示不需要 CDN URLs
    this.completionResolve?.([])
  }

  /**
   * 上传单个切片（异步，不阻塞）
   */
  private uploadSlice(index: number, base64: string): void {
    const slice = this.slices[index]
    if (!slice || !this.uploadFunction) return

    slice.status = 'uploading'

    const fileName = `page-slice-${index + 1}-${Date.now()}.webp`

    // ⭐ 异步上传，不阻塞后续切片的产生和上传
    this.uploadFunction(base64, fileName)
      .then((cdnUrl) => {
        slice.cdnUrl = cdnUrl
        slice.status = 'completed'

        // 更新进度
        const uploaded = this.slices.filter((s) => s.status === 'completed').length
        this.progress.value = {
          uploaded,
          total: this.slices.length,
          percentage: Math.round((uploaded / this.slices.length) * 100),
        }

        console.log(`✓ 切片 ${index + 1}/${this.slices.length} 上传完成 (${this.progress.value.percentage}%)`)

        // 检查是否全部完成
        this.checkCompletion()
      })
      .catch((err) => {
        slice.status = 'failed'
        slice.error = err instanceof Error ? err : new Error(String(err))
        console.error(`✗ 切片 ${index + 1} 上传失败:`, err)

        // 单个失败不影响其他切片
        this.checkCompletion()
      })
  }

  /**
   * 检查是否所有切片都已处理完毕
   */
  private checkCompletion(): void {
    // 只有当所有切片都接收完毕，且都处理完成时，才触发完成
    if (!this.isAllSlicesReceived) return

    const pendingCount = this.slices.filter((s) => s.status === 'pending' || s.status === 'uploading').length

    if (pendingCount > 0) {
      console.log(`⏳ 还有 ${pendingCount} 个切片待上传...`)
      return
    }

    // 所有切片都处理完毕
    const cdnUrls = this.slices.filter((s) => s.cdnUrl !== null).map((s) => s.cdnUrl!)

    if (cdnUrls.length === 0) {
      const error = new Error('所有切片上传失败')
      this.status.value = 'failed'
      this.error.value = error
      console.error('❌ 上传失败：所有切片都失败了')
      this.completionReject?.(error)
    } else {
      this.status.value = 'completed'
      console.log(`🎉 上传完成：${cdnUrls.length}/${this.slices.length} 个切片成功`)
      this.completionResolve?.(cdnUrls)
    }
  }

  /**
   * 等待所有上传完成
   */
  async waitForCompletion(): Promise<string[]> {
    if (!this.completionPromise) {
      throw new Error('Upload not initialized')
    }
    return this.completionPromise
  }

  /**
   * 获取当前已上传的 URLs（按顺序）
   */
  getCdnUrls(): string[] {
    return this.slices.filter((s) => s.cdnUrl !== null).map((s) => s.cdnUrl!)
  }

  /**
   * 获取所有切片的原始 base64 数据
   * 用于需要本地处理的场景（如生成 PDF）
   */
  getSliceDataCache(): string[] {
    return [...this.sliceDataCache] // 返回副本，防止外部修改
  }

  /**
   * 是否已完成
   */
  isCompleted(): boolean {
    return this.status.value === 'completed'
  }

  /**
   * 获取状态快照（用于调试）
   */
  getSnapshot() {
    return {
      status: this.status.value,
      progress: this.progress.value,
      slicesCount: this.slices.length,
      uploadedCount: this.slices.filter((s) => s.status === 'completed').length,
      failedCount: this.slices.filter((s) => s.status === 'failed').length,
      pendingCount: this.slices.filter((s) => s.status === 'pending' || s.status === 'uploading').length,
    }
  }

  /**
   * 等待优化上传完成
   * 对所有切片进行优化处理后上传（缩小尺寸、降低质量）
   * 专门用于 Summarize/Prompt 场景
   *
   * @param maxSize 最大尺寸限制（默认 1024）
   * @param quality 图片质量（默认 0.7）
   * @returns 优化后上传的图片 CDN URLs
   */
  async waitForOptimizedUpload(maxSize: number = 1024, quality: number = 0.7): Promise<string[]> {
    console.log(`🎨 [优化上传] 开始优化上传：${this.sliceDataCache.length} 个切片`)
    console.log(`🎨 [优化上传] 目标尺寸: ${maxSize}×${maxSize}, 质量: ${quality}`)

    // 1. 确保上传函数已注入
    if (!this.uploadFunction) {
      throw new Error('Upload function not set')
    }

    // 2. 创建优化上传的 Promise（如果尚未创建）
    if (!this.optimizedCompletionPromise) {
      this.optimizedCompletionPromise = new Promise((resolve, reject) => {
        this.optimizedCompletionResolve = resolve
        this.optimizedCompletionReject = reject
      })
    }

    // 3. 检查是否已经开始优化上传
    if (!this.isOptimizedUploadStarted) {
      this.isOptimizedUploadStarted = true

      // 4. 开始批量优化并上传
      this.uploadOptimizedSlicesInBatches(maxSize, quality).catch((error) => {
        console.error('❌ [优化上传] 批量上传失败:', error)
        this.optimizedCompletionReject?.(error)
      })
    }

    return this.optimizedCompletionPromise
  }

  /**
   * 批量优化并上传切片
   */
  private async uploadOptimizedSlicesInBatches(maxSize: number, quality: number): Promise<void> {
    const BATCH_SIZE = 3 // 并发上传3个

    // 初始化 optimizedSlices 数组
    this.optimizedSlices = this.sliceDataCache.map((_, index) => ({
      index,
      cdnUrl: null,
      status: 'pending' as const,
    }))

    try {
      // 分批处理
      for (let i = 0; i < this.sliceDataCache.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, this.sliceDataCache.length)
        const batchPromises: Promise<void>[] = []

        for (let j = i; j < batchEnd; j++) {
          batchPromises.push(this.optimizeAndUploadSlice(j, this.sliceDataCache[j], maxSize, quality))
        }

        await Promise.all(batchPromises)

        console.log(`🎨 [优化上传] 进度: ${batchEnd}/${this.sliceDataCache.length}`)
      }

      // 所有切片优化上传完成
      const successfulUrls = this.optimizedSlices.filter((s) => s.cdnUrl !== null).map((s) => s.cdnUrl!)

      const failedCount = this.optimizedSlices.filter((s) => s.status === 'failed').length

      if (successfulUrls.length === 0) {
        throw new Error('所有切片优化上传失败')
      }

      console.log(
        `✅ [优化上传] 完成: ${successfulUrls.length}/${this.sliceDataCache.length} 成功${
          failedCount > 0 ? `, ${failedCount} 失败` : ''
        }`
      )

      this.optimizedCompletionResolve?.(successfulUrls)
    } catch (error) {
      console.error('❌ [优化上传] 批量上传过程出错:', error)
      this.optimizedCompletionReject?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 优化并上传单个切片
   */
  private async optimizeAndUploadSlice(index: number, base64: string, maxSize: number, quality: number): Promise<void> {
    const sliceInfo = this.optimizedSlices[index]

    try {
      sliceInfo.status = 'uploading'

      // 1. 优化切片
      const startTime = Date.now()
      const optimizedBase64 = await this.optimizeSlice(base64, maxSize, quality)
      const optimizeTime = Date.now() - startTime

      // 计算压缩比
      const originalSize = base64.length
      const optimizedSize = optimizedBase64.length
      const compressionRatio = ((1 - optimizedSize / originalSize) * 100).toFixed(1)

      console.log(
        `🎨 [优化上传] 切片 #${index + 1} 优化完成: ${(originalSize / 1024).toFixed(0)}KB → ${(
          optimizedSize / 1024
        ).toFixed(0)}KB (压缩 ${compressionRatio}%, 耗时 ${optimizeTime}ms)`
      )

      // 2. 上传优化后的切片
      const fileName = `optimized-slice-${Date.now()}-${index}.webp`
      const uploadStartTime = Date.now()
      const cdnUrl = await this.uploadFunction!(optimizedBase64, fileName)
      const uploadTime = Date.now() - uploadStartTime

      // 3. 保存结果
      sliceInfo.cdnUrl = cdnUrl
      sliceInfo.status = 'completed'

      console.log(`✅ [优化上传] 切片 #${index + 1} 上传完成 (上传耗时 ${uploadTime}ms)`)
    } catch (error) {
      console.error(`❌ [优化上传] 切片 #${index + 1} 失败:`, error)
      sliceInfo.status = 'failed'
      sliceInfo.error = error instanceof Error ? error : new Error(String(error))
      // 不抛出错误，允许其他切片继续
    }
  }

  /**
   * 优化单个切片
   * @param base64 原始切片 base64
   * @param targetSize 目标尺寸
   * @param quality 质量
   * @returns 优化后的 base64
   */
  private async optimizeSlice(base64: string, targetSize: number, quality: number): Promise<string> {
    // 1. 创建 Image 并加载
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Failed to load image for optimization'))
      image.src = base64
    })

    // 2. 计算缩放后的尺寸（保持宽高比）
    const scale = Math.min(targetSize / img.width, targetSize / img.height, 1) // 不放大，只缩小
    const newWidth = Math.round(img.width * scale)
    const newHeight = Math.round(img.height * scale)

    // 3. 创建 canvas 并设置为目标尺寸
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // 4. 填充白色背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetSize, targetSize)

    // 5. 绘制图片（顶对齐）
    ctx.drawImage(img, 0, 0, newWidth, newHeight)

    // 6. 转换为 WebP 格式
    return canvas.toDataURL('image/webp', quality)
  }
}
