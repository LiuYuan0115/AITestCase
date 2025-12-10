import { PDFDocument } from 'pdf-lib'

// WebP转PNG的工具函数
async function convertWebPToPNG(webpBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法获取canvas上下文'))
          return
        }
        
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        
        // 绘制图片到canvas
        ctx.drawImage(img, 0, 0)
        
        // 转换为PNG格式的base64
        const pngBase64 = canvas.toDataURL('image/png')
        console.log('🔍 WebP转PNG成功:', {
          originalSize: webpBase64.length,
          pngSize: pngBase64.length,
          width: img.naturalWidth,
          height: img.naturalHeight
        })
        
        resolve(pngBase64)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error('WebP图片加载失败'))
    }
    
    img.src = webpBase64
  })
}

// base64转Uint8Array 工具函数
function base64ToUint8Array(base64: string): Uint8Array {
  const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(pureBase64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * 图片base64转PDF工具函数
 * @param base64 图片的base64数据
 * @param imageName 图片文件名（可选）
 * @returns 返回PDF的Blob、File和URL
 */
export async function convertImageToPdf(
  base64: string,
  imageName?: string
): Promise<{ pdfBlob: Blob; pdfFile: File; pdfUrl: string }> {
  console.log('🔍 convertImageToPdf 开始处理:', {
    base64Length: base64.length,
    imageName: imageName,
    base64Prefix: base64.substring(0, 50) + '...'
  })
  
  const imageBytes = base64ToUint8Array(base64)
  console.log('🔍 转换后的imageBytes长度:', imageBytes.length)
  console.log('🔍 imageBytes前16字节:', Array.from(imageBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '))

  // 创建PDF
  const pdfDoc = await PDFDocument.create()
  
  // 检测是否为WebP格式
  const isWebP = (imageName || '').toLowerCase().endsWith('.webp') || 
                 (imageName || '').toLowerCase() === 'webp' ||
                 (imageBytes.length >= 12 &&
                  imageBytes[0] === 0x52 && imageBytes[1] === 0x49 &&
                  imageBytes[2] === 0x46 && imageBytes[3] === 0x46 &&
                  imageBytes[8] === 0x57 && imageBytes[9] === 0x45 &&
                  imageBytes[10] === 0x42 && imageBytes[11] === 0x50)
  
  // 根据文件内容检测PNG格式（PNG魔数：89 50 4e 47 0d 0a 1a 0a）
  const isPngByContent = imageBytes.length >= 8 &&
                        imageBytes[0] === 0x89 && imageBytes[1] === 0x50 &&
                        imageBytes[2] === 0x4e && imageBytes[3] === 0x47 &&
                        imageBytes[4] === 0x0d && imageBytes[5] === 0x0a &&
                        imageBytes[6] === 0x1a && imageBytes[7] === 0x0a
  
  // 根据文件内容检测JPEG格式（JPEG魔数：ff d8 ff）
  const isJpegByContent = imageBytes.length >= 3 &&
                         imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
  
  // 改进的图片格式判断逻辑 - 优先根据文件内容判断
  const isPng = isPngByContent || (!isJpegByContent && !isWebP && (imageName || '').toLowerCase().endsWith('.png'))
  const isJpeg = isJpegByContent || (!isPngByContent && !isWebP && ((imageName || '').toLowerCase().endsWith('.jpg') || 
                 (imageName || '').toLowerCase().endsWith('.jpeg'))) 
  
  console.log('🔍 图片格式判断:', {
    imageName: imageName,
    isPngByContent: isPngByContent,
    isJpegByContent: isJpegByContent,
    isPng: isPng,
    isJpeg: isJpeg,
    isWebP: isWebP,
    willUseEmbedPng: isPng,
    willUseEmbedJpg: isJpeg
  })
  
  let image
  try {
    if (isWebP) {
      console.log('🔍 检测到WebP格式，需要转换为PNG...')
      // 将WebP转换为PNG
      const pngBase64 = await convertWebPToPNG(base64)
      const pngBytes = base64ToUint8Array(pngBase64)
      console.log('🔍 WebP转PNG完成，PNG字节长度:', pngBytes.length)
      image = await pdfDoc.embedPng(pngBytes)
      console.log('✅ WebP转PNG后embedPng成功')
    } else if (isPng) {
      console.log('🔍 尝试使用 embedPng...')
      image = await pdfDoc.embedPng(imageBytes)
      console.log('✅ embedPng 成功')
    } else if (isJpeg) {
      console.log('🔍 尝试使用 embedJpg...')
      image = await pdfDoc.embedJpg(imageBytes)
      console.log('✅ embedJpg 成功')
    } else {
      // 如果无法确定格式，尝试PNG，失败后尝试JPEG
      console.log('🔍 无法确定格式，尝试PNG...')
      try {
        image = await pdfDoc.embedPng(imageBytes)
        console.log('✅ embedPng 成功（回退方案）')
      } catch (pngError) {
        console.log('🔍 PNG失败，尝试JPEG...')
        image = await pdfDoc.embedJpg(imageBytes)
        console.log('✅ embedJpg 成功（回退方案）')
      }
    }
  } catch (error) {
    console.error('❌ 图片嵌入失败:', {
      error: error instanceof Error ? error.message : String(error),
      imageName: imageName,
      isPng: isPng,
      isJpeg: isJpeg,
      isWebP: isWebP,
      imageBytesLength: imageBytes.length
    })
    throw error
  }

  const page = pdfDoc.addPage([image.width, image.height])
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  })

  // 导出PDF
  const pdfBytes = await pdfDoc.save()
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
  const pdfFile = new File(
    [pdfBlob],
    ((imageName || 'image').replace(/\.[^.]+$/, '') || 'image') + '.pdf',
    { type: 'application/pdf' }
  )
  const pdfUrl = URL.createObjectURL(pdfBlob)

  return { pdfBlob, pdfFile, pdfUrl }
}

/**
 * 多图片转多页PDF工具函数
 * @param base64Images 图片base64数据数组
 * @param fileName PDF文件名（可选）
 * @returns 返回PDF的Blob、File和URL
 */
export async function convertMultipleImagesToPdf(
  base64Images: string[],
  fileName: string = 'page-screenshot.pdf',
  options?: { pageSize?: number; maxPageCount?: number }
): Promise<{ pdfBlob: Blob; pdfFile: File; pdfUrl: string }> {
  if (!base64Images || base64Images.length === 0) {
    throw new Error('No images provided for PDF conversion')
  }

  const pdfDoc = await PDFDocument.create()

  // 为每个图片创建一页
  for (let i = 0; i < base64Images.length; i++) {
    const base64Image = base64Images[i]
    if (options?.maxPageCount && i >= options.maxPageCount) {
      break
    }
    try {
      const imageBytes = base64ToUint8Array(base64Image)

      // 尝试检测图片格式，优先处理WebP
      let image
      try {
        // 检查是否为WebP格式
        const isWebP = base64Image.includes('data:image/webp') ||
                      (imageBytes.length >= 12 &&
                       imageBytes[0] === 0x52 && imageBytes[1] === 0x49 &&
                       imageBytes[2] === 0x46 && imageBytes[3] === 0x46 &&
                       imageBytes[8] === 0x57 && imageBytes[9] === 0x45 &&
                       imageBytes[10] === 0x42 && imageBytes[11] === 0x50)
        
        if (isWebP) {
          console.log('🔍 检测到WebP格式，转换为PNG...')
          const pngBase64 = await convertWebPToPNG(base64Image)
          const pngBytes = base64ToUint8Array(pngBase64)
          image = await pdfDoc.embedPng(pngBytes)
        } else {
          // 尝试PNG，失败后尝试JPEG
          try {
            image = await pdfDoc.embedPng(imageBytes)
          } catch {
            try {
              image = await pdfDoc.embedJpg(imageBytes)
            } catch {
              console.warn('Failed to embed image, skipping')
              continue
            }
          }
        }
      } catch (error) {
        console.warn('Failed to embed image, skipping:', error)
        continue
      }

      // 页面尺寸与切片一致（优先使用传入的 pageSize，否则按图片实际尺寸）
      const pageWidth = options?.pageSize ?? image.width
      const pageHeight = options?.pageSize ?? image.height
      const page = pdfDoc.addPage([pageWidth, pageHeight])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      })
    } catch (error) {
      console.error('Error processing image:', error)
      // 继续处理下一张图片
      continue
    }
  }

  // 检查是否至少有一页成功创建
  if (pdfDoc.getPageCount() === 0) {
    throw new Error('No pages were successfully created in PDF')
  }

  // 导出PDF
  const pdfBytes = await pdfDoc.save()
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
  const pdfUrl = URL.createObjectURL(pdfBlob)

  return { pdfBlob, pdfFile, pdfUrl }
}
