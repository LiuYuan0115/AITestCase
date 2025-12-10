import { 
  getUploadUrl as getUploadUrlApi, 
  uploadS3 as uploadS3Api,
  getPdfUploadUrl as getPdfUploadUrlApi,
  getFlashcardsUploadUrl as getFlashcardsUploadUrlApi
} from '@/api'
import type { UploadData } from '~/types'
import { convertBase64ToBlob } from '~/utils/fileConverter'

export const uploadService = {
  getUploadUrl: async (params: UploadData) => {
    try {
      const res = await getUploadUrlApi(params)
      return res.data
    } catch (error) {
      console.error('[fileUpload error]: api fetch getUploadUrl', error)
      throw new Error('api fetch error getUploadUrl: ' + error)
    }
  },

  uploadS3: async (url: string, fileBase64: string, fileType: string, md5: string) => {
    try {
      // 将 base64 转换为 Blob
      const blob = convertBase64ToBlob(fileBase64, fileType)
      
      const res = await uploadS3Api(url, blob, md5)
      return res.data
    } catch (error) {
      console.error('[fileUpload error]: api fetch uploadS3', error)
      throw new Error('api fetch error uploadS3: ' + error)
    }
  },

  // 新增：获取 PDF CDN 预签名 URL
  getPdfUploadUrl: async (params: { files: Array<{ fileName: string; contentMD5: string }> }) => {
    try {
      const res = await getPdfUploadUrlApi(params)
      return res.data
    } catch (error) {
      console.error('[uploadService] getPdfUploadUrl error:', error)
      throw new Error('Failed to get PDF upload URL: ' + error)
    }
  },

  // 新增：获取 Quiz CDN 预签名 URL
  getQuizUploadUrl: async (params: { files: Array<{ fileName: string; fileType: string }> }) => {
    try {
      const res = await getFlashcardsUploadUrlApi(params)
      return res.data
    } catch (error) {
      console.error('[uploadService] getQuizUploadUrl error:', error)
      throw new Error('Failed to get Quiz upload URL: ' + error)
    }
  }
}