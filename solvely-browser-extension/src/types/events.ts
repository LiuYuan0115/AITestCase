// Solve All 相关事件
export const SOLVE_ALL_EVENTS = {
  // sidePanel → service worker
  REQUEST: 'SOLVE_ALL_REQUEST',
  
  // service worker → 内容脚本
  EXTRACT_CONTENT: 'SOLVE_ALL_EXTRACT_CONTENT',
  
  // 内容脚本 → service worker → offscreen
  RENDER_START: 'SOLVE_ALL_RENDER_START',
  
  // 内容脚本 → service worker (图片数据)
  IMAGE_DATA: 'SOLVE_ALL_IMAGE_DATA',
  
  // 内容脚本 → service worker (提取完成)
  EXTRACT_COMPLETE: 'SOLVE_ALL_EXTRACT_COMPLETE',
  
  // offscreen → service worker (渲染完成)
  RENDER_COMPLETE: 'SOLVE_ALL_RENDER_COMPLETE',
  
  // offscreen → service worker (旧的完成事件，保持兼容)
  COMPLETE: 'SOLVE_ALL_COMPLETE',
  
  // service worker → sidePanel
  RESPONSE: 'SOLVE_ALL_RESPONSE',
} as const

// 类型导出
export type SolveAllEventType = typeof SOLVE_ALL_EVENTS[keyof typeof SOLVE_ALL_EVENTS]
