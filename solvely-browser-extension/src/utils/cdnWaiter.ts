import { watch, type Ref } from 'vue'
import type { LayerUploadResult } from './layerImageUploader'

export interface CdnWaitOptions {
  // ========== 侧边栏模式 ==========
  // 注意：不直接引入 globalUpload，而是由调用方传入 fileStack
  fileStack?: Ref<Record<string, any>>  // 由调用方传入
  fileStackKey?: string
  cdnKey?: 'cdnUrl_imageToPdf' | 'cdnUrl_imageToQuiz'
  
  // ========== Layer 模式 ==========
  uploadPromise?: Promise<LayerUploadResult>
  urlKey?: 'cdnUrl_pdf' | 'cdnUrl_quiz'
  
  // 通用配置
  timeout?: number  // 超时时间（毫秒），默认 30000
}

/**
 * 统一的 CDN URL 等待函数
 * 支持侧边栏模式（watch fileStack）和 Layer 模式（await Promise）
 * 
 * 🔑 关键设计：不直接引入环境相关的依赖（如 globalUpload），而是由调用方传入
 */
export async function waitForCdnUrl(options: CdnWaitOptions): Promise<string> {
  const timeout = options.timeout || 30000
  
  // ========== 侧边栏模式：watch fileStack ==========
  if (options.fileStack && options.fileStackKey && options.cdnKey) {
    console.log('[cdnWaiter] 侧边栏模式，watch fileStack:', {
      fileStackKey: options.fileStackKey,
      cdnKey: options.cdnKey
    })
    
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let stop: (() => void) | null = null
      
      // 设置超时
      timeoutId = setTimeout(() => {
        if (stop) stop()
        reject(new Error(`Timeout waiting for ${options.cdnKey} in fileStack`))
      }, timeout)
      
      // 监听 fileStack 变化
      stop = watch(
        () => options.fileStack!.value[options.fileStackKey!]?.[options.cdnKey!],
        (url) => {
          if (url) {
            if (timeoutId) clearTimeout(timeoutId)
            if (stop) stop()
            console.log('[cdnWaiter] fileStack CDN 就绪:', url)
            resolve(url)
          }
        },
        { immediate: true }  // 立即检查当前值
      )
    })
  }
  
  // ========== Layer 模式：await Promise ==========
  if (options.uploadPromise && options.urlKey) {
    console.log('[cdnWaiter] Layer 模式，await uploadPromise:', {
      urlKey: options.urlKey
    })
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for upload promise`))
      }, timeout)
      
      options.uploadPromise!.then((result) => {
        clearTimeout(timeoutId)
        
        const url = result[options.urlKey!]
        if (!url) {
          reject(new Error(`Upload result missing ${options.urlKey}`))
          return
        }
        
        console.log('[cdnWaiter] Layer CDN 就绪:', url)
        resolve(url)
      }).catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
    })
  }
  
  throw new Error('[cdnWaiter] Invalid options: must provide either (fileStack + fileStackKey + cdnKey) or (uploadPromise + urlKey)')
}

