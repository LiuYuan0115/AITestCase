import type { UploadData } from '~/types'
import { getTrpc } from '~/lib/trpc/client'
import { generateHashesFromBase64 } from '~/utils/fileConverter'

/**
 * 上传文件到 s3
 * @param {string} fileBase64 文件的base64字符串
 * @param {string} fileName 可选的文件名，默认会生成带时间戳的唯一文件名
 * @returns {string} 文件的访问地址
 *  */
export const uploadFileToS3 = async (fileBase64: string, fileName?: string) => {
  try {
    let uploadData: UploadData = {
      deviceId: '',
      files: [],
    }

    // 直接从base64字符串生成哈希，注意使用 await
    const { combinedHash, base64Hash } = await generateHashesFromBase64(
      fileBase64
    )

    // 生成唯一文件名
    const uniqueFileName = fileName || `solvely-plugin-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.webp`

    // 添加文件信息到上传数据
    uploadData.files.push({
      fileName: uniqueFileName,
      contentMD5: combinedHash,
    })

    // 获取 s3 上传URL
    const uploadUrls = await getTrpc().getUploadUrl.mutate(uploadData)

    if (!uploadUrls || !uploadUrls.length) {
      throw new Error('uploadUrls is empty')
    }

    // 只有一个文件, 所以取第一个
    const uploadUrl = uploadUrls[0]

    // cdnUrl 是图片的访问地址, 可以直接预览和下载图片
    // url 是图片的存储地址，
    // fileName 是图片的文件名
    const { cdnUrl, url, fileName: uploadedFileName } = uploadUrl

    // 上传文件到 s3
    const uploadResult = await getTrpc().uploadS3.mutate({
      url,
      fileBase64,
      fileType: 'image/webp',
      md5: base64Hash,
    })

    // 上传文件成功返回文件访问地址
    return cdnUrl
  } catch (error) {
    console.error('[fileUpload error]: uploadFileToS3', error)
    throw error
  }
}
