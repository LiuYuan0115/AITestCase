import { ref } from 'vue'

interface PasteHandlerOptions {
  onFilePaste?: (file: File) => Promise<void> | void
  onError?: (error: Error) => void
  supportedTypes?: string[]
  maxFileSize?: number // 单位：字节
}

export function usePasteHandler(options: PasteHandlerOptions = {}) {
  const isProcessingPaste = ref(false)
  
  // 默认支持的文件类型
  const defaultSupportedTypes = [
    'image/png',
    'image/jpeg', 
    'image/jpg',
    'image/webp',
    'application/pdf'
  ]
  
  const supportedTypes = options.supportedTypes || defaultSupportedTypes
  const maxFileSize = options.maxFileSize || 50 * 1024 * 1024 // 默认50MB

  const handlePaste = async (event: ClipboardEvent) => {
    if (isProcessingPaste.value) return
    
    const clipboardData = event.clipboardData
    if (!clipboardData) return

    // 检查是否有文件
    const files = Array.from(clipboardData.files)
    if (files.length > 0) {
      event.preventDefault() // 阻止默认粘贴行为
      isProcessingPaste.value = true
      
      try {
        const file = files[0]
        
        // 文件类型检查
        if (!supportedTypes.includes(file.type)) {
          throw new Error(`不支持的文件类型: ${file.type}`)
        }
        
        // 文件大小检查
        if (file.size > maxFileSize) {
          throw new Error(`文件大小超过限制: ${Math.round(maxFileSize / 1024 / 1024)}MB`)
        }
        
        await options.onFilePaste?.(file)
        
      } catch (error) {
        options.onError?.(error as Error)
      } finally {
        isProcessingPaste.value = false
      }
      return
    }

    // 检查是否有图片数据
    const imageTypes = supportedTypes.filter(type => type.startsWith('image/'))
    for (const type of imageTypes) {
      if (clipboardData.types.includes(type)) {
        event.preventDefault()
        isProcessingPaste.value = true
        
        try {
          const blob = clipboardData.getData(type)
          if (blob) {
            // 将 blob 转换为 File
            const extension = type.split('/')[1]
            const fileName = `pasted-image.${extension}`
            const file = new File([blob], fileName, { type })
            
            await options.onFilePaste?.(file)
          }
        } catch (error) {
          options.onError?.(error as Error)
        } finally {
          isProcessingPaste.value = false
        }
        return
      }
    }
  }

  return {
    handlePaste,
    isProcessingPaste,
    supportedTypes
  }
} 