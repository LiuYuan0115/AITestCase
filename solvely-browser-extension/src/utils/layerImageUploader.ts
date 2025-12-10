import { getTrpc } from '~/lib/trpc/client'
import { generateHashesFromFile } from '~/utils/fileConverter'
import { convertImageToPdf } from '~/utils/imageToPdf'
import axios from 'axios'

export interface LayerUploadResult {
  cdnUrl_pdf?: string      // Summarize 使用
  cdnUrl_quiz?: string     // Quiz 使用
  imageName?: string
}

export type LayerUploadType = 'summarize' | 'quiz'

/**
 * Layer 环境专用：按需上传截图（只上传对应的 CDN）
 * 
 * 🔑 设计考虑：
 * - 不使用缓存机制：截图内容每次都是新的，基本不可能重复
 * - 简化代码逻辑：直接上传，无需检查缓存
 * - 截图场景：文件不会很大，无需大小检查
 * 
 * @param base64 - 图片 base64 数据
 * @param uploadType - 上传类型（'summarize' 或 'quiz'）
 * @param imageName - 图片名称（可选）
 * @returns 返回对应的 CDN URL
 */
export async function uploadImageForLayer(
  base64: string,
  uploadType: LayerUploadType,
  imageName?: string
): Promise<LayerUploadResult> {
  try {
    console.log('[layerImageUploader] 开始上传:', { 
      uploadType, 
      base64Length: base64.length, 
      imageName 
    })
    
    // 1. 图片转 PDF
    const { pdfFile } = await convertImageToPdf(base64, imageName || 'screenshot.webp')
    console.log('[layerImageUploader] 图片转 PDF 完成:', pdfFile.name)
    
    // 2. 生成 PDF 的 hash（直接从 File 对象生成）
    const { combinedHash, base64Hash } = await generateHashesFromFile(pdfFile)
    console.log('[layerImageUploader] PDF Hash 生成完成:', { combinedHash, base64Hash })
    
    // 3. 根据 uploadType 决定上传目标
    if (uploadType === 'summarize') {
      // ==================== Summarize: 上传到 PDF CDN ====================
      const pdfFileName = `screenShoot${Date.now()}.pdf`
      
      // 获取预签名 URL (通过 TRPC)
      const res = await getTrpc().getPdfUploadUrl.mutate({
        files: [{ fileName: pdfFileName, contentMD5: combinedHash }]
      })
      const uploadUrl = res[0].url
      const cdnUrl = res[0].cdnUrl
      
      // 使用 axios 上传 File 对象
      await axios.put(uploadUrl, pdfFile, {
        headers: {
          'Content-MD5': base64Hash,
          'Content-Type': 'application/pdf',
        },
      })
      
      console.log('[layerImageUploader] PDF CDN 上传完成:', cdnUrl)
      return { cdnUrl_pdf: cdnUrl, imageName }
    } else {
      // ==================== Quiz: 上传到 Quiz CDN ====================
      const quizFileName = `screenShoot${Date.now()}.pdf`
      
      // 获取预签名 URL (通过 TRPC)
      const res = await getTrpc().getQuizUploadUrl.mutate({
        files: [{ fileName: quizFileName, fileType: 'pdf' }]
      })
      const uploadUrl = res.urls[0].uploadUrl
      const cdnUrl = res.urls[0].fileUrl
      
      // 使用 axios 上传 File 对象
      await axios.put(uploadUrl, pdfFile, {
        headers: {
          'Content-Type': 'application/pdf',
        },
      })
      
      console.log('[layerImageUploader] Quiz CDN 上传完成:', cdnUrl)
      return { cdnUrl_quiz: cdnUrl, imageName }
    }
  } catch (error) {
    console.error('[layerImageUploader] 上传失败:', error)
    throw error
  }
}
