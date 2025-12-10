import './style.css'
import '~/styles/tailwind.css'
import '~/styles/main.less'

import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Tooltip from 'primevue/tooltip'
import ToastService from 'primevue/toastservice'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { installLatexSandbox } from '@/plugins/latex-sandbox'
import App from './App.vue'
import useAuth from './composables/useAuth'
import { Performance } from '@/utils'
import { PerformanceKeys } from '@/types'
import globalUpload from './composables/useGlobalUpload'

// 记录 JS 开始执行时间
if ((window as any).__PERFORMANCE_DATA__) {
  ;(window as any).__PERFORMANCE_DATA__.js_start = performance.now()
}

// 配置性能统计
Performance.configure({
  enabled: true,
  environment: import.meta.env.DEV ? 'development' : 'production',
  context: 'sidepanel',
  output: { console: true, format: 'pretty' },
})

// 开始页面加载统计
Performance.mark(PerformanceKeys.SIDEPANEL_LOAD_START)

// 开始 Vue 应用创建统计
Performance.mark(PerformanceKeys.SIDEPANEL_VUE_CREATE)

// 登录状态相关, 包括控制登录弹窗显示
const auth = useAuth()
const app = createApp(App)
app.component('SvgIcon', SvgIcon)
app.directive('tooltip', Tooltip)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    colorScheme: 'light',
  },
})
app.use(ToastService)
installLatexSandbox(app)
// 全局提供 auth 实例
app.provide('auth', auth)
// 全局提供 globalUpload 实例
app.provide('globalUpload', globalUpload)
// 完成 Vue 应用创建统计
Performance.measure(PerformanceKeys.SIDEPANEL_VUE_CREATE)

// 开始 Vue 应用挂载统计
Performance.mark(PerformanceKeys.SIDEPANEL_VUE_MOUNT)

app.mount('#app')

// 完成 Vue 应用挂载统计
Performance.measure(PerformanceKeys.SIDEPANEL_VUE_MOUNT)

// 记录 JS 执行完成时间
if ((window as any).__PERFORMANCE_DATA__) {
  ;(window as any).__PERFORMANCE_DATA__.js_end = performance.now()
}
