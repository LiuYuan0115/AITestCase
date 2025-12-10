// AB 测试调试工具 - 仅在非生产环境下启用

import type { ContentScriptContext } from 'wxt/client'
import { createApp } from 'vue'
import ABTestDebugPanel from '@/components/ABTestDebugPanel.vue'
import '@/styles/main.less'
import '@/styles/tailwind.css'

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx: ContentScriptContext) {
    try {
      if (window.self !== window.top) return
      const FLAG = '__SOLVELY_ABTEST_DEBUG_INIT__' as const
      if ((window as any)[FLAG]) return
      ;(window as any)[FLAG] = true

      console.log('AB 测试调试内容脚本已注入！')

      const ui = await createShadowRootUi(ctx, {
        name: 'solvely-abtest-debug',
        position: 'inline',
        anchor: 'html',
        append: 'last',
        isolateEvents: true,
        onMount: (host: HTMLElement) => {
          host.style.position = 'fixed'
          host.style.top = '10px'
          host.style.right = '10px'
          host.style.zIndex = '999999'
          const app = createApp(ABTestDebugPanel)
          app.mount(host)
          return app
        },
        onRemove: (app: any) => app?.unmount?.(),
      })
      ui.mount()
    } catch (e) {
      console.error('[ABTestDebug] mount failed:', e)
    }
  },
})


