import { PDFDocument } from 'pdf-lib'

/**
 * 检查PDF文件是否超过指定页数
 * @param pdfFile PDF文件
 * @param maxPages 最大页数限制，默认20页
 * @returns 返回布尔值，true表示超过页数限制，false表示未超过
 */
export async function isPdfExceedsPageLimit(
  pdfFile: File,
  maxPages: number = 20
): Promise<boolean> {
  try {
    // 读取PDF文件
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
    const pageCount = pdfDoc.getPageCount()
    return pageCount > maxPages
  } catch (error: any) {
    console.error('PDF解析失败 - isPdfExceedsPageLimit:', {
      error: error,
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
      maxPages: maxPages
    })
    const message = String(error?.message || '')
    if (message.toLowerCase().includes('encrypted')) {
      return false
    }
    throw new Error('PDF Truncate Error')
  }
}

/**
 * PDF页数检查和截取工具函数
 * @param pdfFile PDF文件
 * @param maxPages 最大页数限制，默认20页
 * @returns 返回处理后的PDF文件，如果超过页数限制则截取前N页，否则返回原文件
 */
export async function truncatePdfIfNeeded(
  pdfFile: File,
  maxPages: number = 20
): Promise<File> {
  try {
    // 先检查是否超过页数限制
    const exceedsLimit = await isPdfExceedsPageLimit(pdfFile, maxPages)
    
    // 如果页数不超过限制，直接返回原文件
    if (!exceedsLimit) {
      return pdfFile
    }
    
    // 读取PDF文件进行截取
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
    
    // 创建新的PDF文档，只包含前N页
    const newPdfDoc = await PDFDocument.create()
    const pages = await newPdfDoc.copyPages(pdfDoc, Array.from({ length: maxPages }, (_, i) => i))
    pages.forEach(page => newPdfDoc.addPage(page))
    
    // 转换为ArrayBuffer
    const newPdfBytes = await newPdfDoc.save()
    const buffer = newPdfBytes.buffer
    // 确保返回的是ArrayBuffer而不是SharedArrayBuffer
    const finalBuffer = buffer instanceof ArrayBuffer ? buffer : new ArrayBuffer(buffer.byteLength)
    
    // 创建新的File对象
    const truncatedFile = new File([finalBuffer], pdfFile.name, { type: 'application/pdf' })
    
    return truncatedFile
  } catch (error: any) {
    console.error('PDF解析失败 - truncatePdfIfNeeded:', {
      error: error,
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
      maxPages: maxPages
    })
    const message = String(error?.message || '')
    if (message.toLowerCase().includes('encrypted')) {
      return pdfFile
    }
    throw new Error('PDF Truncate Error')
  }
}