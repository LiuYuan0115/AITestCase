// ~/background/service/fetchStream.ts
import { API_CONFIG } from '~/config'
import { fetchEventSource } from '@sentool/fetch-event-source'
import type { Observer } from '@trpc/server/observable'

// 存储每个请求的控制器
const abortControllerMap = new Map<string, AbortController>()

export interface FetchStreamOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: any
  retries?: number
  retryDelay?: number
}

export interface FetchStreamCallbacks {
  onOpen?: (response: Response) => void
  onMessage?: (event: any) => void
  onClose?: (event: unknown) => void
  onError?: (err: Error) => void
  onDone?: (event: unknown) => void
}

// 定义 FetchStreamEvent 接口
export interface FetchStreamEvent {
  requestId: string
  type: 'open' | 'message' | 'close' | 'error' | 'done'
  payload?: any
}

// 存储每个请求的回调函数
const callbacksMap = new Map<string, FetchStreamCallbacks>()

// 发起请求并管理生命周期
export const fetchStreamService = {
  // 发起流式请求
  startStream: (
    options: FetchStreamOptions,
    requestId: string,
    observer?: Observer<FetchStreamEvent, unknown>
  ) => {
    const {
      url,
      method = 'POST',
      headers = { 'Content-Type': 'application/json' },
      body,
      retries = 3,
      retryDelay = 1000,
    } = options

    // 为此请求创建一个新的 AbortController
    const abortController = new AbortController()
    abortControllerMap.set(requestId, abortController)

    // 处理URL，确保使用完整URL
    const fullUrl = url.startsWith('http')
      ? url
      : `${API_CONFIG.BASE_URL}${url.startsWith('/') ? url : `/${url}`}`

    console.log('Requesting full URL:', fullUrl)

    try {
      // 添加一个使用 tRPC Observer 发送消息的辅助函数
      const sendEventToObserver = (
        event: FetchStreamEvent['type'],
        payload: any
      ) => {
        if (observer) {
          observer.next({
            requestId,
            type: event,
            payload,
          })
          return true
        }
        return false
      }

      // 执行请求，带重试逻辑
      const fetchWithRetry = (retriesLeft: number) => {
        return fetchEventSource(fullUrl, {
          method,
          headers,
          body: JSON.stringify(body),
          signal: abortController.signal,
          onopen(response: Response) {
            console.log('onOpen', response)
            // 通知 observer
            sendEventToObserver('open', {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
            })
          },
          onmessage(event: any) {
            // 通知 observer
            sendEventToObserver('message', event)
          },
          onclose(event: unknown) {
            console.log('onClose', event)
            // 通知 observer
            sendEventToObserver('close', event)

            // 清理资源
            abortControllerMap.delete(requestId)
          },
          onerror(err: Error) {
            console.error('onError', err)
            if (retriesLeft > 0) {
              console.log(`Retrying... ${retriesLeft} attempts left`)
              setTimeout(() => fetchWithRetry(retriesLeft - 1), retryDelay)
            } else {
              // 通知 observer
              sendEventToObserver('error', {
                message: err.message,
                stack: err.stack,
              })
            }
          },
          async done(event: unknown) {
            console.log('onDone', event)
            // 通知 observer
            sendEventToObserver('done', event)

            // 清理已完成的请求资源
            callbacksMap.delete(requestId)
            abortControllerMap.delete(requestId)
          },
        })
      }

      fetchWithRetry(retries)

      // 直接返回清理函数
      return () => {
        if (abortControllerMap.has(requestId)) {
          const self = fetchStreamService
          self.cancelStream(requestId)
        }
      }
    } catch (error) {
      console.error('fetchStream执行失败:', error)
      if (observer) {
        observer.error(error)
      }
      throw error
    }
  },

  // 取消流式请求
  cancelStream: (requestId: string) => {
    // 获取对应的 AbortController
    const controller = abortControllerMap.get(requestId)

    // 如果有 AbortController，则中止正在进行中的请求
    if (controller) {
      // 断开 render 的 socket 连接
      console.log('主动断开流式请求主动断开 render 的 socket 连接')

      // 中止请求
      controller.abort()
      // 清理资源
      abortControllerMap.delete(requestId)
      callbacksMap.delete(requestId)
      return { success: true, message: '流式请求已取消' }
    }
    return { success: false, message: '找不到对应的请求' }
  },
}
