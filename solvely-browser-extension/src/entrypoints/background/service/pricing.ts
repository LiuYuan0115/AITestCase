import {
  createPricingCheckout as createPricingCheckoutFromApi,
  getPricingProducts as getPricingProductsFromApi,
} from '@/api'
import { STORAGE_KEY } from '~/config'

// 创建付款链接
export const createPricingCheckout = async (params: object) => {
  try {
    const res = await createPricingCheckoutFromApi(params)
    if (res.code == 0 || res.code == 200) {
      return res.url
    } else {
      throw new Error('api fetch error createPricingCheckout: ' + res.msg)
    }
  } catch (error) {
    throw new Error('api fetch error createPricingCheckout: ' + error)
  }
}

// 获取订阅商品列表
export const getPricingProducts = async () => {
  try {
    const res = await getPricingProductsFromApi()
    console.log('getPricingProducts res: ', res)
    return res
  } catch (error) {
    throw new Error('api fetch error getPricingProducts: ' + error)
  }
}

// 初始化定价信息 - 在插件启动时调用
export const initPricingProducts = async () => {
  try {
    // 检查本地是否已有缓存
    const result = await browser.storage.local.get(STORAGE_KEY.PRICING_PRODUCTS)
    if (result[STORAGE_KEY.PRICING_PRODUCTS]) {
      console.log('定价信息已缓存，跳过初始化请求')
      return result[STORAGE_KEY.PRICING_PRODUCTS]
    }

    // 如果没有缓存，则请求并缓存
    console.log('开始初始化定价信息...')
    const pricingData = await getPricingProducts()

    // 存储到本地
    await browser.storage.local.set({
      [STORAGE_KEY.PRICING_PRODUCTS]: pricingData,
    })

    console.log('定价信息初始化完成:', pricingData)
    return pricingData
  } catch (error) {
    console.error('初始化定价信息失败:', error)
    // 初始化失败不影响插件正常运行
    return null
  }
}
