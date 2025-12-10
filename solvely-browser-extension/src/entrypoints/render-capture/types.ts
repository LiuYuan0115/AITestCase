import { SOLVE_ALL_EVENTS } from '@/types/events'

// === 消息类型 ===
export interface RenderStartMessage {
  type: typeof SOLVE_ALL_EVENTS.RENDER_START
  taskId: string
  markdown: string
  images: ImageInfo[]
}

export interface RenderCompleteMessage {
  type: typeof SOLVE_ALL_EVENTS.RENDER_COMPLETE
  taskId: string
  success: boolean
  result?: {
    pageSize: number
    // 长图模式返回字段
    cdnUrl?: string
    // 资源模式返回字段
    markdown?: string
    imagesUrl?: string[]
  }
  error?: {
    code: string
    message: string
  }
}

// === 渲染类型 ===
export interface ImageInfo {
  url: string
  width: number
  height: number
}

export interface DisplaySize {
  width: number
  height: number
}

// === 渲染模式 ===
export enum RenderMode {
  LONG_IMAGE = 'long_image', // ≤2页：长图模式
  RESOURCE_LIST = 'resource_list', // >2页：资源列表模式
}

// === 任务状态类型 ===
export enum RenderStage {
  IDLE = 'idle',
  RENDERING = 'rendering',
  CAPTURING = 'capturing',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export interface RenderTaskState {
  taskId: string | null
  stage: RenderStage
  mode: RenderMode | null
  pageCount: number
  startTime: number
  timeoutId: number | null
}

// === 错误类型 ===
export interface RenderError {
  code:
    | 'TIMEOUT'
    | 'RENDER_FAILED'
    | 'CAPTURE_FAILED'
    | 'IMAGE_FAILED'
    | 'UNKNOWN'
  message: string
  details?: any
}
