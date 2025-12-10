// src/utils/throttledTrackEvent.ts
// 24小时节流埋点控制工具

import { STORAGE_KEY } from '@/config/storage'
import trackEvent from '@/utils/trackEvent'

interface ThrottleRecord {
  [eventName: string]: number // 直接存储最后上报的时间戳
}

const THROTTLE_STORAGE_KEY = STORAGE_KEY.THROTTLE_TRACK_RECORDS
const THROTTLE_DURATION = 24 * 60 * 60 * 1000 // 24小时毫秒数

/**
 * 24小时节流埋点控制工具
 * 确保每个埋点事件在24小时内只上报一次
 */
export class ThrottledTrackEvent {
  /**
   * 24小时节流埋点上报方法
   *
   * 功能说明：
   * - 确保每个埋点事件在24小时内只上报一次，有效控制埋点成本
   * - 异步执行，不阻塞主进程，保证UI响应性能
   * - 使用浏览器本地存储持久化节流记录，重启后仍然有效
   * - 具备容错机制，出错时仍会执行埋点上报，确保数据不丢失
   * - 默认使用 trackEvent.track 进行埋点上报，不支持 trackEvent.trackError
   *
   * 工作流程：
   * 1. 异步读取本地存储中的节流记录
   * 2. 检查该埋点是否在24小时内已经上报过
   * 3. 如果未上报过或超过24小时，则执行埋点上报
   * 4. 更新本地存储记录，记录本次上报时间
   * 5. 如果处理过程中出错，仍会执行埋点上报保证数据完整性
   *
   * @param eventName 埋点事件名称，如 'Plugin_Youtubepanel_Show'
   * @param params 埋点参数对象，包含业务相关的数据
   *
   * @example
   * ```typescript
   * // 原来的调用方式
   * trackEvent.track('Plugin_Youtubepanel_Show', { videoId: 'abc123' })
   *
   * // 改为节流版本（更简洁）
   * ThrottledTrackEvent.track('Plugin_Youtubepanel_Show', { videoId: 'abc123' })
   * ```
   */
  static track(eventName: string, params: any = {}): void {
    // 使用 Promise.resolve().then() 确保异步执行，不阻塞主进程
    // 这样即使存储操作较慢，也不会影响UI响应性能
    Promise.resolve().then(async () => {
      try {
        // 步骤1: 从浏览器本地存储中读取节流记录
        // 存储结构: { "eventName": timestamp }
        const result = await browser.storage.local.get(THROTTLE_STORAGE_KEY)
        const records: ThrottleRecord = result[THROTTLE_STORAGE_KEY] || {}

        // 步骤2: 获取当前时间戳，用于计算时间差
        const now = Date.now()
        const lastTrackedTime = records[eventName]

        // 步骤3: 检查是否在24小时节流期内
        // 如果存在记录且距离上次上报时间小于24小时，则跳过本次上报
        if (lastTrackedTime && now - lastTrackedTime < THROTTLE_DURATION) {
          console.log(
            `[Throttled Track] 24小时内已上报过埋点: ${eventName}，跳过`
          )
          return // 直接返回，不执行埋点上报
        }

        // 步骤4: 执行实际的埋点上报
        // 只有在节流期外或首次上报时才会执行到这里
        trackEvent.track(eventName, params)

        // 步骤5: 更新本地存储记录
        // 只记录本次上报的时间戳
        records[eventName] = now

        // 步骤6: 将更新后的记录保存到本地存储
        // 确保下次检查时能正确识别节流状态
        await browser.storage.local.set({
          [THROTTLE_STORAGE_KEY]: records,
        })

        // 输出成功日志，便于调试和监控
        console.log(`[Throttled Track] 上报并记录埋点: ${eventName}`, params)
      } catch (error) {
        // 步骤7: 容错处理
        // 如果存储操作失败或其他异常，仍然执行埋点上报
        // 确保重要的业务数据不会因为节流机制而丢失
        console.error('节流埋点处理失败:', error)
        trackEvent.track(eventName, params)
      }
    })
  }
}
