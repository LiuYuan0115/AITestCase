// src/types/common.ts 通用类型定义


// 定义的消息通信的格式
export type Message = {
  type?: string
  api?: string
  data: any
}