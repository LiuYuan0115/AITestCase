/**
 * tRPC 转发桥接层
 * 
 * 职责：
 * 1. 检测当前运行环境（内容脚本 vs 侧边栏/Background）
 * 2. 在内容脚本环境中，将 HTTP 请求通过 tRPC 转发到 Background 执行
 * 3. 在其他环境中，直接返回 null，让调用方走原生 HTTP
 * 
 * 使用约定：
 * - 内容脚本中，从 @/api 导入的函数应该只包含简单 JSON 参数
 * - 带特殊参数（signal、Blob）的函数应该通过 tRPC 直接调用
 */

import { getTrpc } from '@/lib/trpc/client'
import { API_CONFIG } from '~/config'

/**
 * 环境检测：判断当前是否为内容脚本环境
 * 
 * 三种环境特征：
 * 1. 内容脚本：有 document ✅，有 window ✅，无 chrome.tabs ❌，location 是网页 URL
 * 2. 侧边栏：  有 document ✅，有 window ✅，有 chrome.tabs ✅，location 是扩展 URL
 * 3. Background：无 document ❌，无 window ❌（MV3 Service Worker），有 chrome.tabs ✅
 * 
 * @returns {boolean} true = 内容脚本环境，false = 其他环境
 */
export function isContentScript(): boolean {
  try {
    // 步骤 1: 检测 document
    // Background Service Worker 没有 document，直接返回 false
    if (typeof document === 'undefined') {
      return false
    }

    // 步骤 2: 检测 chrome.tabs API
    // 侧边栏和 Background 有 tabs 权限，内容脚本没有
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      return false
    }

    // 步骤 3: 检测 location
    // 确保是网页环境（不是扩展页面如 popup、options 等）
    if (typeof window !== 'undefined' && window.location) {
      const url = window.location.href
      
      // 排除扩展内部页面
      const isExtensionPage = 
        url.startsWith('chrome-extension://') ||
        url.startsWith('moz-extension://') ||
        url.startsWith('about:')
      
      // 网页 URL = 内容脚本，扩展 URL = 其他
      return !isExtensionPage
    }

    // 无法确定时，默认不是内容脚本
    return false
  } catch {
    // 任何错误都默认不是内容脚本，走原生 HTTP
    return false
  }
}

/**
 * 通过 tRPC 转发 HTTP 请求到 background
 * 
 * @param url - 请求 URL（相对路径或完整 URL，都支持转发）
 * @param method - HTTP 方法
 * @param params - GET 请求参数
 * @param data - POST/PUT 请求体
 * @param options - 额外选项（headers、skipAuth、signal 等）
 * @returns 转发成功返回结果，否则返回 null（让调用方走原生 HTTP）
 * 
 * @description
 * 转发规则：
 * 1. 非内容脚本环境 → 不转发（侧边栏和 Background 直接走原生 HTTP）
 * 2. 有 signal 参数 → 不转发（AbortSignal 无法序列化传递）
 * 3. 其他情况 → 转发到 background（包括完整 URL，用于绕过 CORS）
 */
export async function trpcFetch(
  url: string,
  method: 'GET' | 'POST' | 'PUT',
  params?: any,
  data?: any,
  options?: any
): Promise<any | null> {
  // 1. 环境检测：非内容脚本不转发
  if (!isContentScript()) {
    return null
  }

  // 2. 注意：即使有 signal 参数也转发，但不传递 signal（AbortSignal 无法序列化）
  // 这意味着内容脚本中的取消功能会失效，但可以正常发起请求

  try {
    // 3. 获取 tRPC 客户端
    const trpc = getTrpc()

    // 4. 处理 URL（支持相对路径和完整 URL）
    let fullUrl = url
    
    // 如果是相对路径，拼接 baseURL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = `${API_CONFIG.BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    }
    
    // 5. 处理 GET 查询参数
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString()
      fullUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryString}`
    }

    // 6. 处理自定义 headers
    const customHeaders = options?.headers || {}
    
    // 7. 处理认证选项
    const autoAuth = options?.skipAuth !== true

    console.log(`[tRPC Bridge] ✅ 转发到 background: ${method} ${fullUrl}`)

    // 8. 调用 background 的通用 fetch 方法
    const result = await trpc.fetch.mutate({
      url: fullUrl,
      method,
      headers: customHeaders,
      body: data,
      autoAuth,
    })

    return result
  } catch (error) {
    // 9. 转发失败的处理
    console.error(`[tRPC Bridge] ❌ 转发失败:`, error)
    
    // 🚨 在内容脚本环境，不能回退到原生 HTTP（会 CORS）
    // 直接抛出错误，让上层处理
    throw error
  }
}

