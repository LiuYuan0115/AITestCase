/**
 * 缓存项接口
 */
interface CacheItem<T> {
  value: T // 缓存的实际数据
  expireTime: number // 过期时间戳
  createdAt: number // 创建时间戳
}

/**
 * 缓存统计信息
 */
interface CacheStats {
  size: number // 当前缓存项数量
  hits: number // 命中次数
  misses: number // 未命中次数
  hitRate: number // 命中率
}

/**
 * 缓存管理器
 * 支持缓存任意对象，设置有效期，提供查找和添加方法
 */
export class CacheManager {
  private cache: Map<string, CacheItem<any>>
  private defaultTTL: number // 默认生存时间（一年）
  private stats: { hits: number; misses: number }

  constructor(defaultTTL?: number) {
    this.cache = new Map()
    // 默认一年有效期 (365 * 24 * 60 * 60 * 1000 毫秒)
    this.defaultTTL = defaultTTL || 365 * 24 * 60 * 60 * 1000
    this.stats = { hits: 0, misses: 0 }
  }

  /**
   * 添加或更新缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（毫秒），可选，默认使用构造函数中设置的默认值
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now()
    const timeToLive = ttl || this.defaultTTL

    const cacheItem: CacheItem<T> = {
      value,
      expireTime: now + timeToLive,
      createdAt: now,
    }

    this.cache.set(key, cacheItem)
  }

  /**
   * 根据key获取缓存值
   * @param key 缓存键
   * @returns 缓存值或null（如果不存在或已过期）
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)

    if (!item) {
      this.stats.misses++
      return null
    }

    // 检查是否过期
    if (Date.now() > item.expireTime) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return item.value as T
  }

  /**
   * 检查key是否存在且未过期
   * @param key 缓存键
   * @returns 是否存在有效缓存
   */
  has(key: string): boolean {
    const item = this.cache.get(key)

    if (!item) {
      return false
    }

    // 检查是否过期
    if (Date.now() > item.expireTime) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * 删除指定缓存项
   * @param key 缓存键
   * @returns 是否成功删除
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.stats.hits = 0
    this.stats.misses = 0
  }

  /**
   * 清理所有过期的缓存项
   * @returns 清理的项目数量
   */
  cleanup(): number {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireTime) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    return cleanedCount
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计数据
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100, // 保留两位小数
    }
  }

  /**
   * 获取所有缓存键
   * @returns 所有有效的缓存键数组
   */
  keys(): string[] {
    const now = Date.now()
    const validKeys: string[] = []

    for (const [key, item] of this.cache.entries()) {
      if (now <= item.expireTime) {
        validKeys.push(key)
      }
    }

    return validKeys
  }

  /**
   * 获取缓存项的剩余生存时间
   * @param key 缓存键
   * @returns 剩余时间（毫秒），如果不存在或已过期返回0
   */
  getTTL(key: string): number {
    const item = this.cache.get(key)

    if (!item) {
      return 0
    }

    const remaining = item.expireTime - Date.now()
    return remaining > 0 ? remaining : 0
  }

  /**
   * 更新缓存项的过期时间
   * @param key 缓存键
   * @param ttl 新的生存时间（毫秒）
   * @returns 是否成功更新
   */
  touch(key: string, ttl?: number): boolean {
    const item = this.cache.get(key)

    if (!item) {
      return false
    }

    // 检查是否已过期
    if (Date.now() > item.expireTime) {
      this.cache.delete(key)
      return false
    }

    const timeToLive = ttl || this.defaultTTL
    item.expireTime = Date.now() + timeToLive

    return true
  }
}

// 创建默认的缓存实例
const defaultCache = new CacheManager()

export default defaultCache

// 导出类型定义
export type { CacheItem, CacheStats }
