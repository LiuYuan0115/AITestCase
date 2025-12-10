import { convertMultipleImagesToPdf } from '~/utils/imageToPdf'
import useUploadStaging from '../composables/useUploadStaging'

export async function createMultiPagePdf(
  imageSlices: string[],
  tileSize?: number
): Promise<string> {
  try {
    // 生成多页PDF
    const s = Date.now()
    const { pdfFile } = await convertMultipleImagesToPdf(
      imageSlices,
      'page-screenshot.pdf',
      {
        pageSize: tileSize,
        maxPageCount: 20,
      }
    )
    trackEvent.track('Plugin_sidebar_createMultiPagePdf', {
      duration: Date.now() - s,
      slices: imageSlices.length,
      pdfSize: pdfFile.size,
    })
    // 使用专门的PDF上传方法
    const uploadStart = Date.now()
    const { processUploadPDF } = useUploadStaging()
    const pdfUrl = await processUploadPDF(pdfFile)
    trackEvent.track('Plugin_sidebar_createMultiPagePdf_upload', {
      duration: Date.now() - uploadStart,
      slices: imageSlices.length,
      pdfSize: pdfFile.size,
      pdfUrl,
    })
    return pdfUrl
  } catch (error) {
    throw new Error(
      `PDF Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
