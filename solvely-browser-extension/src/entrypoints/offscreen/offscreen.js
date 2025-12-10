// 这个 URL 必须指向公共网站
const AUTH_URL = import.meta.env.VITE_OFFSCREEN_URL + '/app/extension-login'

// 标记iframe是否加载完成
let iframeLoaded = false

// 创建并添加 iframe
const iframe = document.createElement('iframe')
iframe.src = AUTH_URL
document.documentElement.appendChild(iframe)

// 监听iframe加载完成事件
iframe.onload = () => {
  iframeLoaded = true
  console.log('iframe 加载完成')

  iframe.contentWindow.focus()
  window.focus()
}

// 监听来自 Chrome 运行时的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 过滤不是发给屏幕外文档的消息
  if (message.target !== 'offscreen') {
    return false
  }
  
  // 处理状态检查请求
  if (message.type === 'iframe:status-check') {
    sendResponse({ ready: iframeLoaded })
    return true
  }

  // 如果iframe还没加载完成，返回错误
  if (!iframeLoaded && message.type && (message.type.startsWith('login:') || message.type.startsWith('plugin:'))) {
    sendResponse({ ready: iframeLoaded })
    return true
  }

  // 定义处理 iframe 消息的函数
  const handleIframeMessage = (event) => {
    try {
      const { data } = event

      // 验证数据格式
      if (!data || typeof data !== 'object' || !data.type) {
        return
      }

      // 处理认证和插件相关的响应消息
      if (data.type && (data.type.startsWith('login:') || data.type.startsWith('plugin:'))) {
        // 收到结果后，移除事件监听器以避免内存泄漏
        window.removeEventListener('message', handleIframeMessage)
        // 直接透传数据给调用者
        sendResponse(data)
      }
    } catch (error) {
      console.error('处理 iframe 消息时发生错误:', error)
      sendResponse({ type: 'login:auth-error', error: '处理消息失败' })
    }
  }

  // 添加消息监听器
  window.addEventListener('message', handleIframeMessage, false)

  // 获取目标源
  const targetOrigin = new URL(AUTH_URL).origin

  try {
    // 从 message 中删除 target 属性（因为这是给 offscreen 用的）
    const authMessage = { ...message }
    delete authMessage.target

    console.log('authMessage', authMessage)
    console.log('targetOrigin', targetOrigin)

    // 直接将消息透传给 iframe
    iframe.contentWindow.postMessage(authMessage, targetOrigin)
  } catch (error) {
    console.error('发送消息到 iframe 时发生错误:', error)
    sendResponse({ type: 'login:auth-error', error: '发送消息失败' })
    window.removeEventListener('message', handleIframeMessage)
    return false
  }

  // 返回 true 表示将异步发送响应
  return true
})
