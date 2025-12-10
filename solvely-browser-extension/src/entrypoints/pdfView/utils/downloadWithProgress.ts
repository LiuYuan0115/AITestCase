import axios from 'axios'

interface DownloadOptions {
  url: string
  onProgress?: (progress: number) => void
  onError?: (error: Error) => void
  timeout?: number
}

const TIMEOUT = 60000

/**
 * 支持下载进度的文件下载函数
 */
export const downloadWithProgress = async (
  options: DownloadOptions
): Promise<ArrayBuffer> => {
  const { url, onProgress, onError, timeout = TIMEOUT } = options

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100
          onProgress?.(progress)
        }
      },
    })

    return response.data
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Download failed'
    const downloadError = new Error(errorMessage)
    onError?.(downloadError)
    throw downloadError
  }
}

/**
 * 使用fetch API的下载函数（备用方案）
 */
export const downloadWithFetch = async (
  options: DownloadOptions
): Promise<ArrayBuffer> => {
  const { url, onProgress, onError, timeout = TIMEOUT } = options

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to read response stream')
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0
    let loaded = 0
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break
      
      chunks.push(value)
      loaded += value.length
      
      if (total > 0) {
        const progress = (loaded / total) * 100
        onProgress?.(progress)
      }
    }

    // 合并所有chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result.buffer
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Download failed'
    const downloadError = new Error(errorMessage)
    onError?.(downloadError)
    throw downloadError
  }
} 