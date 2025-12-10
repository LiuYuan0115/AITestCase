import { STORAGE_KEY } from '~/config'

// Offscreen 文档路径
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html'

// 确保只有一个创建 offscreen 文档的Promise
let creatingOffscreenDocument: Promise<void> | null = null
// 标记iframe是否已经准备好
let iframeReady = false

/**
 * 检查是否已存在 offscreen 文档
 */
async function hasOffscreenDocument(): Promise<boolean> {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'] as chrome.runtime.ContextType[],
    })
    return existingContexts.length > 0
  } catch (error) {
    console.error('检查offscreen文档失败:', error)
    return false
  }
}

/**
 * 设置 offscreen 文档
 */
async function setupOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return
  }

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument
    return
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
    reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
    justification: 'Firebase authentication',
  })

  await creatingOffscreenDocument
  creatingOffscreenDocument = null

  // 等待iframe准备完成
  await checkIframeStatus()
}

/**
 * 检查iframe状态
 */
async function checkIframeStatus(): Promise<void> {
  if (iframeReady) return

  return new Promise((resolve) => {
    const checkStatus = () => {
      sendMessageToOffscreen({
        type: 'iframe:status-check',
      })
        .then((response) => {
          if (response?.ready) {
            iframeReady = true
            resolve()
          } else {
            // 如果iframe还没准备好，等待200ms后再次检查
            setTimeout(checkStatus, 200)
          }
        })
        .catch(() => {
          // 如果发送消息失败，等待500ms后再次检查
          setTimeout(checkStatus, 500)
        })
    }

    // 开始检查
    setTimeout(checkStatus, 500) // 给予初始加载时间
  })
}

/**
 * 发送消息到 offscreen 文档并等待响应
 */
async function sendMessageToOffscreen(message: any): Promise<any> {
  // 如果是登录相关操作且iframe未准备好，先检查状态
  if (
    !iframeReady &&
    message.type &&
    (message.type.startsWith('login:') ||
      message.type === 'iframe:status-check')
  ) {
    // 对于状态检查消息，不进行递归检查，避免死循环
    if (message.type !== 'iframe:status-check') {
      await checkIframeStatus()
    }
  }

  return new Promise((resolve, reject) => {
    console.log('sendMessageToOffscreen', message)
    chrome.runtime.sendMessage(
      { ...message, target: 'offscreen' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        if (response?.error) {
          reject(new Error(response.error))
          return
        }

        resolve(response)
      }
    )
  })
}

/**
 * 关闭 offscreen 文档
 */
export async function closeOffscreenDocument(): Promise<void> {
  if (!(await hasOffscreenDocument())) {
    return
  }

  await chrome.offscreen.closeDocument()
  iframeReady = false
}

/**
 * 清除用户数据
 */
async function clearUserData(): Promise<void> {
  try {
    // 根据 login.ts 中存储用户数据的方式，清除所有相关的本地存储键
    await chrome.storage.local.remove([
      '/firebase_user',
      STORAGE_KEY.USER,
      STORAGE_KEY.USER_ID_KEY,
      STORAGE_KEY.TOKEN_KEY,
      STORAGE_KEY.SUBSCRIPTION,
      STORAGE_KEY.USER_EXTEND_INFO,
    ])
  } catch (error) {
    console.error('清除用户数据失败:', error)
    throw new Error('清除用户数据失败')
  }
}

/**
 * 退出登录
 */
export async function logout(): Promise<void> {
  try {
    // 1. 设置 offscreen 文档，确保 iframe 准备就绪
    await setupOffscreenDocument()

    // 2. 向 offscreen 文档发送退出登录消息并等待响应
    const response = await sendMessageToOffscreen({
      type: 'login:logout',
    })

    // 3. 根据响应判断退出登录结果
    if (response.type === 'login:logout-success') {
      console.log('退出登录成功')
      // 4. 清除本地存储的用户数据
      await clearUserData()
    } else if (response.type === 'login:logout-error') {
      // 如果 offscreen 文档返回退出登录错误
      throw new Error(response.error || '退出登录失败')
    } else {
      // 捕获其他非预期的响应类型
      throw new Error('退出登录收到未知响应')
    }
  } catch (error) {
    console.error('退出登录过程中发生错误:', error)
    // 重新抛出错误，以便调用方可以处理
    throw error
  } finally {
    // 5. 无论退出登录成功与否，最终关闭 offscreen 文档
    await closeOffscreenDocument()
  }
}
