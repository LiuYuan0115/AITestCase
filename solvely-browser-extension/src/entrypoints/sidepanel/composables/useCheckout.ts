import { getTrpc } from '@/lib/trpc/client'

// 创建购买订单类型
export enum CheckoutType {
  WEEKLY = 'weekly',
  YEARLY = 'yearly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

export const useCheckout = () => {
  // 创建付款链接
  const getCheckoutLink = async (
    checkoutType: CheckoutType,
    isFreeTrail?: boolean,
    options?: any
  ) => {
    // default
    const checkoutParams = {
      mode: 'subscription',
      period: 7,
      backPath: 'pricing-plugin',
      source: 'plugin',
      isFreeTrail,
      ...options,
    } as any

    // 根据 checkoutType 设置 period
    switch (checkoutType) {
      case CheckoutType.WEEKLY:
        checkoutParams.period = 7
        break
      case CheckoutType.YEARLY:
        checkoutParams.period = 12
        break
      case CheckoutType.MONTHLY:
        checkoutParams.period = 1
        break
      case CheckoutType.QUARTERLY:
        checkoutParams.period = 3
        break
    }

    // 创建付款链接
    try {
      const res = await getTrpc().createPricingCheckout.mutate(checkoutParams)
      console.log('[checkoutOrder url]', res)
      return res
    } catch (error) {
      console.error('[createPricingCheckout]', error)
    }
  }

  const createCheckoutOrder = async (
    checkoutType: CheckoutType,
    isFreeTrial?: boolean,
    options?: any
  ) => {
    const checkoutLink = await getCheckoutLink(checkoutType, isFreeTrial, options)
    if (!checkoutLink) {
      return
    }
    window.open(checkoutLink, '_blank')
  }

  return {
    getCheckoutLink,
    createCheckoutOrder,
  }
}

export default useCheckout
