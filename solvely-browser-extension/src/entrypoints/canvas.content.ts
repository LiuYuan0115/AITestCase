import type { ContentScriptContext } from 'wxt/client'
import { detectCanvas, hasPreview } from '~/utils/canvasPageDetector'
import '@/styles/main.less'
import '@/styles/tailwind.css'
import { createApp } from 'vue'
import CanvasSniffButton from '@/components/CanvasSniffButton.vue'
import { isSidePanelSupported } from '@/utils/common'
// 保持纯 UI 注入逻辑，侧边栏直接使用 canvasPageDetector 解析页面内容

/**
 * Canvas 站点内容脚本：
 * - 仅在检测为 Canvas 环境时生效
 * - 当页面出现可见的文件预览容器时（抽屉/预览面板），在页面内以 Shadow DOM 方式注入一个下载按钮（Vue 组件）
 * - 监听 SPA 路由变更与页面 DOM 变化，动态决定挂载/卸载
 * - 避免重复注入与焦点/可见性冲突
 */

// 统一的选择器/工具
const PREVIEW_CONTAINER_SELECTOR = '#file-preview-modal-drawer-layout' as const
const queryHostEl = () => document.querySelector('solvely-canvas-sniff-button') as HTMLElement | null

/**
 * 判定元素是否可见：display/visibility/opacity/hidden/aria-hidden/尺寸
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    (element as HTMLElement).hidden ||
    (element as HTMLElement).getAttribute('aria-hidden') === 'true'
  ) {
    return false
  }
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  return true
}

/**
 * 安装 SPA 路由变更钩子：hook pushState/replaceState + 监听 popstate
 * - 触发自定义事件 solvely:locationchange
 * - 返回卸载函数，用于恢复原生方法与移除事件监听
 */
function installLocationChangeHook(handler: () => void) {
  const fire = () => window.dispatchEvent(new Event('solvely:locationchange'))
  const origPush = history.pushState
  const origReplace = history.replaceState
  history.pushState = function (...args) {
    const r = origPush.apply(this, args as any)
    fire()
    return r
  }
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args as any)
    fire()
    return r
  }
  window.addEventListener('popstate', fire)
  window.addEventListener('solvely:locationchange', handler)
  return () => {
    window.removeEventListener('popstate', fire)
    window.removeEventListener('solvely:locationchange', handler)
    history.pushState = origPush
    history.replaceState = origReplace
  }
}

/**
 * 焦点管理：
 * - 当宿主或其 Shadow 内部有聚焦元素时，主动 blur，避免 aria-hidden 与聚焦冲突
 * - 用于挂载/卸载以及点击后收起焦点
 */
function blurUiFocus() {
  try {
    const host = queryHostEl() as (HTMLElement & { shadowRoot?: ShadowRoot }) | null
    const ae = document.activeElement as HTMLElement | null
    if (host && ae && host.contains(ae)) {
      try { ae.blur() } catch {}
    }
    try { host?.shadowRoot && (host.shadowRoot.activeElement as HTMLElement | null)?.blur() } catch {}
    try { (document.body as any)?.focus?.() } catch {}
  } catch {}
}

export default defineContentScript({
  // 匹配所有页面，由内部 detector 决定是否执行
  matches: ['<all_urls>'],
  allFrames: false,
  matchAboutBlank: true,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  registration: 'manifest',
  async main(ctx: ContentScriptContext) {
    if (ctx.isInvalid) return

    // 检查是否支持侧边栏，不支持则禁用整个 Canvas 功能
    if (!isSidePanelSupported()) {
      console.log('[Solvely][Canvas] 不支持侧边栏，Canvas 功能已禁用')
      return
    }

    // 仅顶层窗口执行，避免在 iframe 中重复注入
    if (window.self !== window.top) {
      console.log('[Solvely][Canvas] skip: inside iframe', { href: location.href })
      return
    }

    const host = location.hostname
    const href = location.href

    console.log('[Solvely][Canvas] candidate injected', { host, href })

    // 使用零参工具进行 Canvas 环境检测
    const { isCanvas, score, reasons } = detectCanvas()
    if (!isCanvas) {
      console.log('[Solvely][Canvas] skip by detector', { score, reasons, host, href })
      return
    }

    // 等待 body 可用（极端早期注入场景）
    if (!document.body) {
      await new Promise<void>((resolve) => {
        const obs = new MutationObserver(() => {
          if (document.body) {
            obs.disconnect()
            resolve()
          }
        })
        obs.observe(document.documentElement, { childList: true, subtree: true })
      })
    }

    // 避免多次初始化（例如多次动态注册/刷新）
    const SCRIPT_FLAG = '__SOLVELY_CANVAS_SCRIPT_INIT__' as const
    if ((window as any)[SCRIPT_FLAG]) {
      console.log('[Solvely][Canvas] script already initialized')
      return
    }
    ;(window as any)[SCRIPT_FLAG] = true

    // 挂载状态机（防重入与状态自描述）
    type MountState = 'idle' | 'mounting' | 'mounted' | 'unmounting'
    let mountState: MountState = 'idle'

    // 资源句柄
    let ui: any | null = null
    let domObserver: MutationObserver | null = null
    let containerAttrObserver: MutationObserver | null = null
    let removeUrlHook: (() => void) | null = null

    /**
     * 清理可能存在的重复 UI 宿主节点（容错）
     * - 处理历史/异常情况下的残留节点，确保一次只存在一个 UI
     */
    const cleanupExistingUiHosts = () => {
      try {
        let removed = 0
        document.querySelectorAll('solvely-canvas-sniff-button').forEach((n) => {
          n.remove()
          removed++
        })
        document
          .querySelectorAll('[data-solvely-canvas-sniff-button]')
          .forEach((el) => {
            const host = el.closest('solvely-canvas-sniff-button')
            if (host) (host as HTMLElement).remove()
            else (el as HTMLElement).remove()
            removed++
          })
        if (removed > 0) {
          console.warn('[Solvely][Canvas] cleanup duplicates removed =', removed)
        }
      } catch {}
    }

    /**
     * 是否满足挂载条件：
     * - hasPreview(): 站点有预览能力
     * - 存在并且可见的预览容器 #file-preview-modal-drawer-layout
     */
    const canMount = () => {
      const container = document.querySelector(PREVIEW_CONTAINER_SELECTOR) as HTMLElement | null
      return hasPreview() && !!container && isElementVisible(container)
    }

    /**
     * 尝试挂载 UI（幂等防抖）
     * - 先校验状态与条件，再创建 Shadow Root UI 并挂载 Vue 组件
     * - 监听容器属性变化，失效时调度复核挂载状态
     */
    const mountUI = async () => {
      if (mountState !== 'idle') return
      if (!canMount()) return
      mountState = 'mounting'

      cleanupExistingUiHosts()

      try {
        const created = await createShadowRootUi(ctx, {
          name: 'solvely-canvas-sniff-button',
          position: 'inline',
          anchor: 'body',
          append: 'last',
          isolateEvents: true, // 隔离事件，避免影响宿主页面交互
          onMount: (uiContainer) => {
            // 在 Shadow DOM 宿主内挂载 Vue 组件
            const app = createApp(CanvasSniffButton)
            app.mount(uiContainer)
            try {
              const hostEl = queryHostEl()
              hostEl?.removeAttribute('inert')
            } catch {}
            console.log('[Solvely][Canvas] CanvasSniffButton mounted')
            return app
          },
          onRemove: (app: any) => {
            // 卸载时做焦点与 inert 管理，避免残留焦点与可达性问题
            try {
              try { blurUiFocus() } catch {}
              try {
                const hostEl = queryHostEl()
                hostEl?.setAttribute('inert', '')
              } catch {}
              app?.unmount?.()
              console.log('[Solvely][Canvas] CanvasSniffButton unmounted')
            } catch (e) {
              console.warn('[Solvely][Canvas] unmount failed', e)
            }
          },
        })

        created.mount()
        ui = created
        mountState = 'mounted'

        // 监听容器属性变化（class/style/hidden/aria-hidden），实时感知可见性失效
        try {
          const container = document.querySelector(PREVIEW_CONTAINER_SELECTOR) as HTMLElement | null
          if (container) {
            containerAttrObserver = new MutationObserver(() => {
              if (!canMount()) {
                try { blurUiFocus() } catch {}
                scheduleCheckMount()
              }
            })
            containerAttrObserver.observe(container, {
              attributes: true,
              attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
            })
          }
        } catch {}
      } catch (e) {
        console.warn('[Solvely][Canvas] mount failed', e)
        mountState = 'idle'
      }
    }

    /**
     * 卸载 UI（安全幂等）
     */
    const unmountUI = () => {
      if (mountState !== 'mounted') return
      mountState = 'unmounting'
      try {
        containerAttrObserver?.disconnect()
      } catch {}
      containerAttrObserver = null
      try {
        try { blurUiFocus() } catch {}
        try {
          const hostEl = queryHostEl()
          hostEl?.setAttribute('inert', '')
        } catch {}
        ui?.remove()
      } catch {}
      ui = null
      cleanupExistingUiHosts()
      mountState = 'idle'
    }

    /**
     * 根据 canMount 结果决定挂载或卸载
     */
    const checkMount = () => {
      if (canMount()) mountUI()
      else unmountUI()
    }

    // 简单调度：避免高频触发（DOM 变更/路由）导致的重复计算
    let pendingCheckTimer: number | null = null
    const scheduleCheckMount = () => {
      if (pendingCheckTimer != null) return
      pendingCheckTimer = window.setTimeout(() => {
        pendingCheckTimer = null
        checkMount()
      }, 50)
    }

    // 初次调度检查
    scheduleCheckMount()

    // 监听 SPA 路由变更（push/replace/popstate），变化后调度复核
    removeUrlHook = installLocationChangeHook(() => {
      console.log('[Solvely][Canvas] location changed, re-check')
      scheduleCheckMount()
    })

    // 监听文档 DOM 变更（包含预览容器的创建/销毁），变化后调度复核
    domObserver = new MutationObserver(() => {
      scheduleCheckMount()
    })
    domObserver.observe(document.documentElement, { childList: true, subtree: true })

    // 生命周期：当内容脚本失效（刷新/切换页面）时，清理观察者与 UI
    ctx.onInvalidated(() => {
      try {
        domObserver?.disconnect()
      } catch {}
      try {
        containerAttrObserver?.disconnect()
      } catch {}
      try {
        removeUrlHook?.()
      } catch {}
      unmountUI()
    })
  },
}) 