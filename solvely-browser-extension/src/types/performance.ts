/**
 * 性能统计相关类型定义
 */

export const PerformanceKeys = {
  // 后台脚本相关
  BACKGROUND_STARTUP: 'bg_startup',
  INSTALL_HANDLER_EXECUTION: 'bg_install_exec',
  INSTALL_HANDLER_GET_AD_REFERRER: 'bg_install_get_ad_referrer',
  INSTALL_HANDLER_OPEN_ONBOARDING_PAGE: 'bg_install_open_onboarding_page',
  
  // 侧边栏相关
  SIDEPANEL_HTML_START: 'sp_html_start',
  SIDEPANEL_CSS_LOAD: 'sp_css_load',
  SIDEPANEL_JS_LOAD: 'sp_js_load',
  SIDEPANEL_DOM_READY: 'sp_dom_ready',
  SIDEPANEL_WINDOW_LOAD: 'sp_window_load',
  SIDEPANEL_LOAD_START: 'sp_load_start',
  SIDEPANEL_VUE_CREATE: 'sp_vue_create',
  SIDEPANEL_VUE_MOUNT: 'sp_vue_mount',
  SIDEPANEL_COMPONENT_RENDER: 'sp_component_render',
  SIDEPANEL_AUTH_CHECK: 'sp_auth_check',
  SIDEPANEL_SUBSCRIPTION_INIT: 'sp_subscription_init',
  SIDEPANEL_PRICING_INIT: 'sp_pricing_init',
  SIDEPANEL_EVENT_LISTENERS: 'sp_event_listeners',
  SIDEPANEL_READY: 'sp_ready',
  
  // 组件出现时间
  SIDEPANEL_HEADER_APPEAR: 'sp_header_appear',
  SIDEPANEL_FOOTER_APPEAR: 'sp_footer_appear',
  SIDEPANEL_CHATAREA_APPEAR: 'sp_chatarea_appear',
  SIDEPANEL_AUTH_MODAL_APPEAR: 'sp_auth_modal_appear',
  
  SIDEPANEL_LOAD: 'sp_load',
  SIDEPANEL_RENDER: 'sp_render',
  
  // 内容脚本相关
  CONTENT_SCRIPT_INJECT: 'cs_inject',
  CONTENT_SCRIPT_READY: 'cs_ready',
  
  // 弹窗相关
  POPUP_OPEN: 'popup_open',
  
  // 通用功能
  API_REQUEST: 'api_request',
  DATA_PROCESSING: 'data_processing',
  USER_INTERACTION: 'user_interaction',
} as const

export type PerformanceKey = typeof PerformanceKeys[keyof typeof PerformanceKeys]

/**
 * 性能统计配置
 */
export interface PerformanceConfig {
  enabled: boolean
  environment: 'development' | 'production'
  context: 'background' | 'sidepanel' | 'content' | 'popup'
  
  // 输出配置
  output: {
    console: boolean
    format: 'pretty' | 'compact'
  }
}

/**
 * 上报数据格式
 */
export interface PerformancePointData {
  // 基础信息
  context: 'background' | 'sidepanel' | 'content' | 'popup'
  environment: 'development' | 'production'
  
  // 性能指标（直接用 key 作为属性名，耗时作为值）
  bg_startup?: number                    // 后台脚本启动耗时
  bg_trpc_init?: number                  // tRPC 初始化耗时
  bg_event_listeners?: number            // 事件监听器注册耗时
  bg_install_handler?: number            // 安装处理器注册耗时
  bg_install_exec?: number               // 安装处理器执行耗时
  bg_services_init?: number              // 服务初始化总耗时
  bg_sidepanel_init?: number             // 侧边栏服务初始化耗时
  bg_youtube_init?: number               // YouTube服务初始化耗时
  bg_pricing_init?: number               // 定价服务初始化耗时
  bg_utils_init?: number                 // 工具函数定义耗时
  
  sp_html_start?: number                 // HTML 文档开始解析耗时
  sp_css_load?: number                   // CSS 文件加载耗时
  sp_js_load?: number                    // JS 文件加载耗时
  sp_dom_ready?: number                  // DOM 内容加载完成耗时
  sp_window_load?: number                // 窗口所有资源加载完成耗时
  sp_load_start?: number                 // 侧边栏页面开始加载耗时
  sp_vue_create?: number                 // Vue 应用创建耗时
  sp_vue_mount?: number                  // Vue 应用挂载耗时
  sp_component_render?: number           // 组件渲染耗时
  sp_auth_check?: number                 // 认证状态检查耗时
  sp_subscription_init?: number          // 订阅状态初始化耗时
  sp_pricing_init?: number               // 定价信息初始化耗时
  sp_event_listeners?: number            // 事件监听器设置耗时
  sp_ready?: number                      // 页面完全就绪耗时
  
  // 组件出现时间
  sp_header_appear?: number              // Header 组件出现时间
  sp_footer_appear?: number              // Footer 组件出现时间
  sp_chatarea_appear?: number            // ChatArea 组件出现时间
  sp_auth_modal_appear?: number          // AuthModal 组件出现时间
  
  sp_load?: number                       // 侧边栏加载耗时
  sp_render?: number                     // 侧边栏渲染耗时
  cs_inject?: number                     // 内容脚本注入耗时
  cs_ready?: number                      // 内容脚本就绪耗时
  popup_open?: number                    // 弹窗打开耗时
  
  api_request?: number                   // API 请求耗时
  data_processing?: number               // 数据处理耗时
  user_interaction?: number              // 用户交互耗时
}

/**
 * 内部指标存储
 */
export interface PerformanceMetric {
  key: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: any
}

/**
 * HTML 阶段性能数据
 */
export interface HTMLPerformanceData {
  html_start: number
  css_time: number | null
  js_start: number | null
  js_end: number | null
  dom_ready: number | null
  window_load: number | null
} 