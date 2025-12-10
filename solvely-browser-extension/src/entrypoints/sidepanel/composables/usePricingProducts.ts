import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { getTrpc } from '@/lib/trpc/client'
import { STORAGE_KEY } from '~/config'

interface PricingProducts {
  subscription: {
    [key: string]: {
      period: number
      price: number
      [key: string]: any
    }
  }
  [key: string]: any
}

interface PricingProductsInstance {
  pricingProducts: Ref<PricingProducts | null>
  isLoading: Ref<boolean>
  isLoaded: ComputedRef<boolean>
  refreshPricingProducts: () => Promise<void>
  initPricingProducts: () => Promise<void>
}

// 全局单例状态
let pricingProductsInstance: PricingProductsInstance | null = null

function createPricingProductsInstance(): PricingProductsInstance {
  // 创建响应式状态
  const pricingProducts = ref<PricingProducts | null>(null)
  const isLoading = ref(false)

  // 计算属性：是否已加载
  const isLoaded = computed(() => pricingProducts.value !== null)

  // 初始化：从本地存储读取定价信息
  const initPricingProducts = async () => {
    try {
      const result = await browser.storage.local.get(
        STORAGE_KEY.PRICING_PRODUCTS
      )
      if (result[STORAGE_KEY.PRICING_PRODUCTS]) {
        pricingProducts.value = result[STORAGE_KEY.PRICING_PRODUCTS]
        console.log('从本地存储加载定价信息:', pricingProducts.value)
      } else {
        // 如果本地没有缓存，则立即请求
        await refreshPricingProducts()
      }
    } catch (error) {
      console.error('初始化定价信息失败:', error)
    }
  }

  // 刷新定价信息
  const refreshPricingProducts = async (): Promise<void> => {
    if (isLoading.value) {
      console.log('定价信息正在加载中，跳过重复请求')
      return
    }

    isLoading.value = true
    try {
      console.log('开始请求定价信息...')
      const res = await getTrpc().getPricingProducts.query()

      // 更新响应式状态
      pricingProducts.value = res

      // 写入本地存储
      await browser.storage.local.set({
        [STORAGE_KEY.PRICING_PRODUCTS]: res,
      })

      console.log('定价信息刷新成功:', res)
    } catch (error) {
      console.error('刷新定价信息失败:', error)
      // 失败时保持原状态不变
    } finally {
      isLoading.value = false
    }
  }

  return {
    pricingProducts,
    isLoading,
    isLoaded,
    refreshPricingProducts,
    initPricingProducts,
  }
}

// 获取全局单例实例
function usePricingProducts(): PricingProductsInstance {
  if (!pricingProductsInstance) {
    pricingProductsInstance = createPricingProductsInstance()
  }
  return pricingProductsInstance
}

export default usePricingProducts
export type { PricingProducts, PricingProductsInstance }
