// ~/utils/fetchStream.ts

import { getTrpc } from '@/lib/trpc/client'
import type { FetchStreamEvent } from '~/entrypoints/background/service/fetchStream'

interface FetchStreamOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: any
  onOpen?: (payload: any) => void
  onMessage?: (payload: any) => void
  onClose?: (payload: any | null) => void
  onError?: (err: Error) => void
  onDone?: (payload: any | null) => void
  retries?: number
  retryDelay?: number
}

export const fetchStream = (options: FetchStreamOptions = {} as FetchStreamOptions) => {
  const {
    url,
    method = 'POST',
    headers = { 'Content-Type': 'application/json' },
    body,
    onOpen,
    onMessage,
    onClose,
    onError,
    onDone,
    retries = 3,
    retryDelay = 1000
  } = options

  // 生成唯一请求ID
  const requestId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  
  // 初始化为 null，移除类型注解
  let subscription: any = null

  try {
    // 使用 subscribe 替代 mutate
    subscription = getTrpc().fetchStream.subscribe(
      {
        url,
        method,
        headers,
        body,
        retries,
        retryDelay,
        requestId,
      },
      {
        onData(event: FetchStreamEvent) {
          switch (event.type) {
            case 'open':
              onOpen && onOpen(event.payload)
              break
            case 'message':
              onMessage && onMessage(event.payload)
              break
            case 'close':
              onClose && onClose(event.payload)
              break
            case 'error': {
              onError && onError(event.payload)
              break
            }
            case 'done':
              onDone && onDone(event.payload)
              break
          }
        },
        onError(err) {
          console.error(`[${requestId}] Stream error:`, err)
          onError && onError(err)
          subscription = null
        },
        onComplete() {
          console.log(`[${requestId}] Stream completed.`)
          subscription = null
        },
      }
    )
  } catch (error) {
    console.error(`[${requestId}] Failed to subscribe to stream:`, error)
    onError && onError(error as Error)
    subscription = null
  }

  // 返回取消函数
  return () => {
    if (subscription) {
      console.log(`[${requestId}] Unsubscribing from stream.`)
      const subToCancel = subscription
      subscription = null
      // @ts-ignore - 假设 subToCancel 总是有 unsubscribe 方法
      subToCancel.unsubscribe()
      
      getTrpc()
        .cancelFetchStream.mutate({ requestId })
        .catch((error) => {
          console.error(`[${requestId}] Failed to explicitly cancel stream on backend:`, error)
        })
    } else {
      console.log(`[${requestId}] Cancel called but no active subscription found.`)
    }
  }
}