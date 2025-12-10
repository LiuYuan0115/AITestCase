import { STORAGE_KEY } from '@/config'

export const checkIsSubscribedFromStorage = async (): Promise<boolean> => {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY.SUBSCRIPTION)
    const subscriptions = result?.[STORAGE_KEY.SUBSCRIPTION] ?? null
    if (!subscriptions) return false
    const arr = Array.isArray(subscriptions) ? subscriptions : []
    return arr.some((s: any) => s?.subscriptionType === 'solver')
  } catch (error) {
    console.error('checkIsSubscribedFromStorage failed:', error)
    return false
  }
}
