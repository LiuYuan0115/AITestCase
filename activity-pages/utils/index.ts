// 获取url指定参数
export const getUrlQuery = (name: string) => {
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`, 'i')
  const r = window.location.search.substring(1).match(reg)
  if (r != null) return decodeURIComponent(r[2])
  return null
}
// 获取url中的所有参数，返回一个对象
export const getUrlParams = () => {
  const url = window.location.href
  const params = url.split('?')[1]
  if (!params) return {}
  const paramArr = params.split('&')
  const res: Record<string, string> = {}
  paramArr.forEach((item) => {
    const [key, value] = item.split('=')
    res[key] = value
  })
  return res
}
// 节流
export const throttle = (fn: Function, delay: number = 3000) => {
  let last = 0
  return function (this: any, ...args: any[]) {
    const now = +new Date()
    if (now - last > delay) {
      last = now
      fn.apply(this, args)
    }
  }
}

// 是否是prod环境
export const isProd = () => useRuntimeConfig().public.mode === 'production'

// 判断是chrome还是edge
export const getBrowserType = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return ''
  }

  // @ts-ignore
  if (navigator.userAgentData) {
    // @ts-ignore
    const brands = navigator.userAgentData.brands
    // brands 是一个数组，包含浏览器品牌信息
    for (const brand of brands) {
      const brandName = brand.brand.toLowerCase()
      if (brandName.includes('edge')) return 'edge'
      if (brandName.includes('chrome')) return 'chrome'
    }
  }
  // 默认返回 Chrome
  return 'chrome'
}
