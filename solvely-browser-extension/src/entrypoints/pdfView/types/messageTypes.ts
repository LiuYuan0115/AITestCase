// PDF查看器相关的消息类型
export enum PdfViewerMessageType {
  // 分片相关
  PDF_CHUNK_DATA = 'PDF_CHUNK_DATA',
  PDF_CHUNK_REQUEST = 'PDF_CHUNK_REQUEST',
  START_CHUNK_MODE = 'START_CHUNK_MODE',
  
  // 截图相关
  TRIGGER_SCREENSHOT = 'TRIGGER_SCREENSHOT',
  
  // 状态相关
  PDF_LOADING_STATUS = 'PDF_LOADING_STATUS',
  PDF_LOADING_COMPLETE = 'PDF_LOADING_COMPLETE',
  PDF_LOADING_ERROR = 'PDF_LOADING_ERROR',
  
  // 页面就绪相关
  PDF_VIEWER_READY = 'PDF_VIEWER_READY'
}

// 分片数据接口
export interface PdfChunkData {
  chunk: string // base64字符串
  chunkIndex: number
  totalChunks: number
  fileName?: string
  fileSize?: number
  cdnUrl?: string // 新增：CDN URL
  fileStackKey?: string // 新增：文件栈key
}

// 加载状态接口
export interface PdfLoadingStatus {
  type: 'chunk' | 'cdn' | 'idle'
  progress: number
  statusText: string
  error?: string
} 