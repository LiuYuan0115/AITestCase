import type { ContentScriptContext } from 'wxt/client'
import { createApp } from 'vue'
import SolvingInjectionMainApp from '@/components/injectionMainPage/SolvingInjectionMainApp.vue'
import OperaMainApp from '@/components/injectionMainPage/Opera/MainApp.vue'
import { isSidePanelSupported } from '@/utils/common'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { installLatexSandbox } from '@/plugins/latex-sandbox'
import '@/styles/main.less'
import '@/styles/tailwind.css'
import TextSelection from '@/components/textSelection/index.vue'

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  registration: 'manifest',
  async main(ctx: ContentScriptContext) {
    if (ctx.isInvalid) return
    // 初始化主要内容
    await initializeMainContent(ctx)
  },
})

// 初始化主要内容
async function initializeMainContent(ctx: ContentScriptContext) {
  try {
    // 防止时序导致的动态注入重复的问题
    const FLAG = '__SOLVELY_MAIN_INITIALIZED__' as const
    if ((window as any)[FLAG]) {
      return
    }
    ;(window as any)[FLAG] = true

    // 清理可能存在的重复主要元素
    const existingMainElements = document.querySelectorAll('solvely-screen-shot')
    existingMainElements.forEach((element, index) => {
      element.remove()
    })

    // 新增：清理可能存在的重复划词选择元素
    const existingTextSelectionElements = document.querySelectorAll('solvely-text-selection')
    existingTextSelectionElements.forEach((element, index) => {
      element.remove()
    })

    // 添加消息监听器，确保可以接收background中的消息
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      // 响应内容脚本检测
      if (message.type === 'CONTENT_SCRIPT_PING') {
        sendResponse({
          status: true,
        })
        return true
      }

      // 将消息转发到页面中供Vue组件使用
      window.dispatchEvent(
        new CustomEvent('fetchStream:response', {
          detail: message,
        })
      )
    }

    browser.runtime.onMessage.addListener(messageListener)

    // 主UI注入
    const ui = await createMainUi(ctx)
    ui.mount()

    // // 划词搜题注入TODO:干掉
    // if (isSidePanelSupported()) {
    //   const textSelectionUi = await createTextSelectionUi(ctx)
    //   textSelectionUi.mount()
    // }
    // 划词搜题注入（所有浏览器都挂载，包含 SolveLayer 组件）
    // 其他派会隐藏划词工具栏，但保留 SolveLayer 用于截图解题
    const textSelectionUi = await createTextSelectionUi(ctx)
    textSelectionUi.mount()

    // 监听上下文失效，清理资源
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(messageListener)
    })
  } catch (error) {
    console.error(error)
    // 失败时清除标记
    throw error
  }
}

// 创建主要 UI（原有逻辑）
function createMainUi(ctx: ContentScriptContext) {
  return createShadowRootUi(ctx, {
    name: 'solvely-screen-shot',
    position: 'inline',
    anchor: 'html',
    append: 'last',
    onMount: (uiContainer) => {
      //TODO:干掉OperaMainApp
      // const app = createApp(isSidePanelSupported() ? SolvingInjectionMainApp : OperaMainApp)
      // 所有浏览器统一使用 SolvingInjectionMainApp
      const app = createApp(SolvingInjectionMainApp)
      app.component('SvgIcon', SvgIcon)
      installLatexSandbox(app)
      app.mount(uiContainer)
      return app
    },
    onRemove: (app) => {
      app?.unmount()
    },
  })
}

// 创建划词工具栏 UI（页面绝对定位+静态锚点+Shadow DOM 方案）
function createTextSelectionUi(ctx: ContentScriptContext) {
  return createShadowRootUi(ctx, {
    name: 'solvely-text-selection',
    position: 'inline',
    anchor: 'html',
    append: 'last',
    onMount: (uiContainer) => {
      // 让 shadow host 覆盖整个页面，支持绝对定位
      uiContainer.style.position = 'absolute'
      uiContainer.style.top = '0'
      uiContainer.style.left = '0'
      uiContainer.style.right = '0'
      uiContainer.style.bottom = '0'
      uiContainer.style.pointerEvents = 'none'
      uiContainer.style.zIndex = '2147483647'

      const app = createApp(TextSelection)
      app.component('SvgIcon', SvgIcon)
      // FIXME:可能不能预期工作，PrimeVue tooltip 指令不能在 shadow DOM 中工作
      installLatexSandbox(app) // 安装 LatexSandbox，支持 LaTeX 渲染
      app.mount(uiContainer)
      return app
    },
    onRemove: (app) => {
      app?.unmount()
    },
  })
}
