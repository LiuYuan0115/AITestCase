import axios, { InternalAxiosRequestConfig } from 'axios'
import { API_CONFIG, STORAGE_KEY } from '~/config'
import { getToken } from '~/entrypoints/background/service/datasync'
import { trpcFetch } from './trpcBridge'
import { getPluginUuid } from '~/utils/pluginUuid'

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  skipAuth?: boolean
  __isRetry?: boolean
}

// 创建axios实例
const service = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_CONFIG.TIMEOUT,
})

// 请求拦截器
service.interceptors.request.use(
  async (config: CustomRequestConfig) => {
    // 请求前做的事情
    // 如果 skipAuth 为 true，则不进行 token 的获取和写入
    if (!config.skipAuth) {
      // 获取localStorage中的token, 写入请求头中
      const token = await getToken()
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    }
    
    // 添加插件 UUID 请求头
    try {
      const uuid = await getPluginUuid()
      if (uuid) {
        config.headers['x-plugin-uuid'] = uuid
      }
    } catch (error) {
      console.warn('[Axios] 获取 UUID 失败:', error)
    }
    
    return config
  },
  (error) => {
    // 请求失败做的事情
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const status = error?.response?.status
    const config = (error?.config || {}) as CustomRequestConfig & {
      headers?: any
    }

    // 仅在 401/403、且原请求携带 Authorization、且不是已重试请求时尝试刷新
    const hasAuthHeader = !!(
      config?.headers?.Authorization || config?.headers?.authorization
    )
    const shouldAttemptRefresh =
      (status === 401 || status === 403) && hasAuthHeader && !config.__isRetry

    if (shouldAttemptRefresh) {
      try {
        // 仅对自家 API 尝试刷新
        const base = new URL(API_CONFIG.BASE_URL)
        const full = new URL(
          // Axios 可能传相对路径，这里用 baseURL 兜底
          config.url || '',
          (config.baseURL as string) || API_CONFIG.BASE_URL
        )
        if (full.origin !== base.origin) {
          return Promise.reject(error)
        }

        // 读取本地 uid
        return browser.storage.local
          .get(STORAGE_KEY.USER_ID_KEY)
          .then(async (result) => {
            const uid = result[STORAGE_KEY.USER_ID_KEY]
            if (!uid) return Promise.reject(error)

            // 使用 fetch 直接获取新 token，避免引入循环依赖
            const tokenUrl = new URL('/token', API_CONFIG.BASE_URL)
            tokenUrl.searchParams.set('uid', uid)
            const res = await fetch(tokenUrl.toString(), {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            })
            if (!res.ok) return Promise.reject(error)

            // 服务端返回纯文本 token（与现有 index.ts 的用法一致）
            const newToken = await res.text()
            if (!newToken) return Promise.reject(error)

            // 写入本地并更新请求头
            await browser.storage.local.set({
              [STORAGE_KEY.TOKEN_KEY]: newToken,
            })
            config.headers = config.headers || {}
            config.headers.Authorization = `Bearer ${newToken}`
            config.__isRetry = true

            // 重试原请求，并将结果返回给业务侧
            return service.request(config)
          })
          .catch(() => Promise.reject(error))
      } catch (_) {
        // 任何异常都按原逻辑抛出
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// 暴露出get和post方法
export default {
  async get(url: string, params?: object, options?: object): Promise<any> {
    // 尝试 tRPC 转发（内容脚本环境会转发，其他环境返回 null）
    try {
      const result = await trpcFetch(url, 'GET', params, undefined, options)
      if (result !== null) return result
    } catch (error) {
      // tRPC 转发失败，抛出错误（内容脚本环境不应该走原生 HTTP）
      console.error('[Axios] tRPC 转发失败:', error)
      throw error
    }
    
    // 其他环境：走原生 HTTP
    return service.get(url, { params, ...options })
  },
  
  async post(url: string, data: object, options?: object): Promise<any> {
    try {
      const result = await trpcFetch(url, 'POST', undefined, data, options)
      if (result !== null) return result
    } catch (error) {
      console.error('[Axios] tRPC 转发失败:', error)
      throw error
    }
    
    return service.post(url, data, options)
  },
  
  async put(url: string, data: object, options?: object): Promise<any> {
    try {
      const result = await trpcFetch(url, 'PUT', undefined, data, options)
      if (result !== null) return result
    } catch (error) {
      console.error('[Axios] tRPC 转发失败:', error)
      throw error
    }
    
    return service.put(url, data, options)
  },
  // patch(url, data, options) {
  //   return service.patch(url, data, options)
  // },
  // delete(url, data, options) {
  //   return service.delete(url, { data, ...options })
  // }
}
