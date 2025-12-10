import type { ContentScriptContext } from 'wxt/client'
import { createApp } from 'vue'
import YouTubeMain from '@/components/youtube/YouTubeMain.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import '@/styles/main.less'
import '@/styles/tailwind.css'
import { isSidePanelSupported } from '@/utils/common'

export default defineContentScript({
  matches: ['*://youtube.com/*', '*://*.youtube.com/*'],
  cssInjectionMode: 'ui',
  registration: 'manifest',
  async main(ctx: ContentScriptContext) {
    if (ctx.isInvalid) return

    // 检查是否支持侧边栏，不支持则禁用整个 YouTube 功能
    if (!isSidePanelSupported()) {
      console.log('[YouTube] 不支持侧边栏，YouTube 功能已禁用')
      return
    }

    // 防止重复初始化
    const FLAG = '__SOLVELY_YOUTUBE_INITIALIZED__' as const
    if ((window as any)[FLAG]) {
      return
    }
    ;(window as any)[FLAG] = true

    let lastUrl = window.location.href

    // 初始化UI
    await ensureYouTubeUi(ctx)
    console.log('YouTube 内容脚本已初始化.', window.location.href)

    // 监听页面导航
    window.addEventListener('yt-navigate-finish', async (event) => {
      if (lastUrl !== window.location.href) {
        console.log('页面导航:', lastUrl, '->', window.location.href)
        lastUrl = window.location.href
        await ensureYouTubeUi(ctx)
      }
    })

    // 初始化 YouTube 特定内容
    await initializeYouTubeContent(ctx)
  },
})

// 确保YouTube UI存在且在正确位置
async function ensureYouTubeUi(ctx: ContentScriptContext) {
  // 检查当前页面是否是观看页面
  const isWatchPage = window.location.href.includes('/watch')
  
  // 查找现有的面板
  let existingPanel = document.querySelector('solvely-youtube-panel')
  
  if (isWatchPage) {
    // 观看页面需要显示面板
    await waitForElement('#secondary.style-scope.ytd-watch-flexy')
    const container = document.querySelector('#secondary.style-scope.ytd-watch-flexy')
    
    if (existingPanel) {
      // 确保面板在正确位置
      if (container && container.firstChild !== existingPanel) {
        container.insertBefore(existingPanel, container.firstChild)
      }
      // 确保面板可见
      ;(existingPanel as HTMLElement).style.display = ''
    } else {
      // 创建新面板
      const ui = await createYouTubeUi(ctx)
      ui.mount()
    }
  } else {
    // 非观看页面隐藏面板
    if (existingPanel) {
      ;(existingPanel as HTMLElement).style.display = 'none'
    }
  }
}

// 初始化 YouTube 特定内容
async function initializeYouTubeContent(ctx: ContentScriptContext) {
  console.log('初始化 YouTube 内容脚本')

  try {
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'YOUTUBE_CONTENT_SCRIPT_PING') {
        sendResponse({ status: true })
        return true
      }

      if (message.type && message.type.startsWith('YOUTUBE:')) {
        console.log('YouTube Content script 收到消息:', message)
        window.dispatchEvent(
          new CustomEvent('youtube:message', { detail: message })
        )
        return true
      }
    }

    browser.runtime.onMessage.addListener(messageListener)

    ctx.onInvalidated(() => {
      console.log('YouTube 上下文失效，清理资源')
      browser.runtime.onMessage.removeListener(messageListener)
      // 清理初始化标记
      delete (window as any).__SOLVELY_YOUTUBE_INITIALIZED__
    })
  } catch (error) {
    console.error('初始化 YouTube 内容失败:', error)
    throw error
  }
}

// 创建 YouTube UI
async function createYouTubeUi(ctx: ContentScriptContext) {
  await waitForElement('#secondary.style-scope.ytd-watch-flexy')
  
  return createShadowRootUi(ctx, {
    name: 'solvely-youtube-panel',
    position: 'inline',
    anchor: '#secondary.style-scope.ytd-watch-flexy',
    append: 'first',
    isolateEvents: true,
    onMount: (uiContainer) => {
      const mountPoint = document.createElement('div')
      mountPoint.setAttribute('data-solvely-youtube-panel', 'true')
      uiContainer.appendChild(mountPoint)

      const app = createApp(YouTubeMain)
      app.component('SvgIcon', SvgIcon)
      app.mount(mountPoint)
      console.log('YouTubeMain 已挂载')
      return app
    },
    onRemove: (app) => {
      if (app) {
        console.log('YouTubeMain 已卸载')
        app.unmount()
      }
    },
  })
}

// 等待元素出现
function waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Element ${selector} not found within ${timeout}ms`))
    }, timeout)
  })
}
