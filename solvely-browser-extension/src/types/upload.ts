// src/types/upload.ts 上传类型定义 

// 上传数据类型
export type UploadData = {
  deviceId?: string
  files: {
    fileName: string
    contentMD5: string
  }[]
}