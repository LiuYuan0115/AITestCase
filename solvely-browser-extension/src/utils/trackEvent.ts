/* src/utils/trackEvent.ts */
// 打点事件, 利用 trpc 从后端打点

import { getTrpc } from '~/lib/trpc/client'
import { point } from '@/entrypoints/background/service/point'

const trackEvent = {
  /**
   * 事件追踪方法
   * @param pointName - 事件名称
   * @param _params - 自定义参数（可覆盖默认 originUrl）
   */
  async track(pointName: string, _params: any = {}) {
    await getTrpc().point.mutate({
      name: pointName,
      params: {
        ...(_params || {}),
        originUrl: window.location.href || null,
      },
    })
  },

  async trackError(type: string, error: any, params: any = {}) {
    await getTrpc().pointError.mutate({
      type,
      error,
      params,
    })
  },

  /**
   * 在 background 中使用 point, 需要直接调用 service 中的 point 服务, 放在 trackEvent 中进行统一管理
   * @param pointName - 事件名称
   * @param _params - 自定义参数（可覆盖默认 originUrl）
   */
  async backgroundTrack(pointName: string, _params: any = {}) {
    point(pointName, _params)
  },

  /**
   * 根据当前执行环境自动选择上报方式：
   * - 后台脚本（MV3 Service Worker 或 MV2 背景页）：调用 point
   * - 其他环境（页面/内容脚本等）：调用 track
   */
  async smartTrack(pointName: string, _params: any = {}) {
    const inBackground = (() => {
      try {
        // MV3 Service Worker：无 document
        if (
          typeof chrome !== 'undefined' &&
          chrome.runtime &&
          typeof document === 'undefined'
        ) {
          return true
        }
      } catch (e) {
        // 忽略判定异常，按非后台处理
      }
      return false
    })()

    if (inBackground) {
      await point(pointName, _params)
    } else {
      await this.track(pointName, _params)
    }
  },

  // async trackAdjust(pointName: string, _params: any = {}) {
  //   console.log('trackAdjust', pointName, _params)
  //   Adjust.trackEvent({
  //     eventToken: pointName,
  //     ..._params,
  //   })
  // },
}

export default trackEvent
