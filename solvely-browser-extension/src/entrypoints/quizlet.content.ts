import type { ContentScriptContext } from 'wxt/client'
import { createApp } from 'vue'
import QuizletComponent from '@/components/injectionMainPage/Quizlet.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { QUIZLET_SELECTORS } from '~/types/content'
import { STORAGE_KEY } from '~/config'
import { isQuizletABTestOn } from '~/utils/abtest'
import '@/styles/tailwind.css'

// 状态管理变量
let currentUI: any = null // 当前UI实例
let currentContainer: Element | null = null // 当前容器引用
let containerObserver: MutationObserver | null = null // 观察器
let rebuildTimeout: ReturnType<typeof setTimeout> | null = null // 防抖定时器
let ctx: ContentScriptContext // 保存context引用
let storageListener: ((changes: any, areaName: string) => void) | null = null // 存储监听器
let messageListener: ((event: MessageEvent) => void) | null = null // 消息监听器
let isUICreated = false // UI是否已创建状态

// 消息接口定义
interface QuizletCloseMessage {
  type: 'QUIZLET_CLOSE_IN_THIS_PAGE'
  source: 'solvely-quizlet-component'
  timestamp: number
}

/**
 * 检查元素是否可见
 */
function isElementVisible(element: Element): boolean {
  if (!element) return false

  const style = window.getComputedStyle(element)

  // 检查基本可见性条件
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false
  }

  // 检查元素是否有尺寸
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }

  return true
}

/**
 * 获取第一个可见的匹配元素
 */
function getFirstVisibleElement(selector: string): Element | null {
  const elements = document.querySelectorAll(selector)

  for (const element of elements) {
    if (isElementVisible(element)) {
      return element
    }
  }

  return null
}

/**
 * 等待特定元素出现（始终检查可见性）
 */
function waitForElement(
  selector: string,
  timeout = 10000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = getFirstVisibleElement(selector)

    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const element = getFirstVisibleElement(selector)

      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // 超时处理
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

/**
 * 创建 Quizlet UI (使用 WXT 标准方式)
 */
async function createQuizletUI(ctx: ContentScriptContext, container: Element) {
  return await createShadowRootUi(ctx, {
    name: 'quizlet-ai-quiz-button',
    position: 'inline',
    anchor: container,
    append: 'last',
    onMount: (uiContainer) => {
      const app = createApp(QuizletComponent)
      app.component('SvgIcon', SvgIcon)
      app.mount(uiContainer)
      return app
    },
    onRemove: (app) => {
      app?.unmount()
    },
  })
}

/**
 * 创建并挂载UI
 */
async function createAndMountUI() {
  if (isUICreated || !ctx) return

  // 清理可能存在的重复元素
  try {
    const existingElement = document.querySelector('quizlet-ai-quiz-button')
    if (existingElement) {
      console.warn('Found existing solvely extension element, removing it')
      existingElement.remove()
    }
  } catch (error) {}

  try {
    const isABTestOn = await isQuizletABTestOn()

    const container = await waitForElement(
      isABTestOn ? QUIZLET_SELECTORS.thirdLi : QUIZLET_SELECTORS.container,
      10000
    )

    if (!container) {
      return
    }

    if (isABTestOn) {
      ;(container as HTMLElement).style.position = 'relative'
    }

    const ui = await createQuizletUI(ctx, container)
    ui.mount()

    // 更新状态
    currentUI = ui
    currentContainer = container
    isUICreated = true
  } catch (error) {}
}

/**
 * 销毁UI
 */
function destroyUI() {
  if (!isUICreated) return

  try {
    if (currentUI) {
      currentUI.remove()
      currentUI = null
    }
    currentContainer = null
    isUICreated = false
  } catch (error) {}
}

/**
 * 检查存储设置
 */
async function checkStorageSetting(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(
      STORAGE_KEY.QUIZLET_BTN_ENABLED
    )
    // 如果存储中没有该设置项，则默认为 true
    return result[STORAGE_KEY.QUIZLET_BTN_ENABLED] !== undefined
      ? result[STORAGE_KEY.QUIZLET_BTN_ENABLED]
      : true
  } catch (error) {
    return true // 默认启用
  }
}

/**
 * 处理存储变化
 */
function handleStorageChange(changes: any, areaName: string) {
  if (areaName === 'local' && changes[STORAGE_KEY.QUIZLET_BTN_ENABLED]) {
    const newValue = changes[STORAGE_KEY.QUIZLET_BTN_ENABLED].newValue
    if (newValue === true && !isUICreated) {
      createAndMountUI()
    } else if (newValue === false && isUICreated) {
      destroyUI()
    }
  }
}

/**
 * 处理页面消息
 */
function handlePageMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return
  const message = event.data as QuizletCloseMessage
  if (
    message?.type === 'QUIZLET_CLOSE_IN_THIS_PAGE' &&
    message?.source === 'solvely-quizlet-component'
  ) {
    destroyUI()
  }
}

/**
 * 清理当前UI（保留观察器）
 */
function cleanupCurrentUI() {
  // 销毁现有UI
  if (currentUI) {
    try {
      currentUI.remove()
    } catch (error) {}
    currentUI = null
  }

  currentContainer = null
}

/**
 * 完全清理状态
 */
function cleanupCurrentState() {
  // 停止观察器
  if (containerObserver) {
    containerObserver.disconnect()
    containerObserver = null
  }

  // 清理定时器
  if (rebuildTimeout) {
    clearTimeout(rebuildTimeout)
    rebuildTimeout = null
  }

  // 销毁UI
  destroyUI()

  // 重置状态
  isUICreated = false
}

export default defineContentScript({
  matches: ['*://quizlet.com/*', '*://*.quizlet.com/*'],
  cssInjectionMode: 'ui',
  registration: 'manifest',
  async main(context: ContentScriptContext) {
    if (context.isInvalid) return

    // 防止时序导致的动态注入重复的问题
    const FLAG = '__SOLVELY_QUIZLET_INITIALIZED__' as const
    if ((window as any)[FLAG]) {
      return
    }
    ;(window as any)[FLAG] = true

    ctx = context

    // 检查存储设置
    const isEnabled = await checkStorageSetting()

    // 设置存储监听器
    storageListener = handleStorageChange
    browser.storage.onChanged.addListener(storageListener)

    // 设置消息监听器
    messageListener = handlePageMessage
    window.addEventListener('message', messageListener)

    // 只有当设置启用时才创建UI
    if (isEnabled) {
      await createAndMountUI()
    }

    context.onInvalidated(() => {
      cleanupCurrentState()
      // 清理存储监听器
      if (storageListener) {
        browser.storage.onChanged.removeListener(storageListener)
        storageListener = null
      }
      // 清理消息监听器
      if (messageListener) {
        window.removeEventListener('message', messageListener)
        messageListener = null
      }
    })
  },
})
