// plugins/adjust.client.ts
import Adjust from '@adjustcom/adjust-web-sdk'
import { isProd } from '~/utils'

export default defineNuxtPlugin(() => {
  // 配置Adjust
  const adjustConfig = {
    appToken: 'asr8f8tiywao',
    environment: (isProd() ? 'production' : 'sandbox') as 'sandbox' | 'production'
  }

  // 初始化SDK
  Adjust.initSdk(adjustConfig)

  // 提供工具函数用于跟踪事件
  const trackEvent = (eventToken: string, params: Record<string, any> = {}) => {
    Adjust.trackEvent({
      eventToken,
      ...params
    })
    console.log(`[Adjust] Tracked event: ${eventToken}`, params)
  }

  return {
    provide: {
      adjust: Adjust,
      trackAdjustEvent: trackEvent
    }
  }
})
