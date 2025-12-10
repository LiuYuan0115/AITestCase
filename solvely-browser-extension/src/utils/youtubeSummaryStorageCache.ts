/**
 * 基于 browser.storage.local 的 YouTube 字幕总结缓存管理器
 * 功能特性：
 * 1. 24小时自动过期
 * 2. 基于数据大小的容量限制（默认5MB）
 * 3. LRU淘汰策略
 * 4. 持久化存储，浏览器重启后数据不丢失
 */

import type { SummaryData } from '~/composables/content/useYouTubePanelProvider'
import { STORAGE_KEY } from '~/config/storage'

// 缓存项接口
interface StorageCacheItem {
  videoId: string
  data: SummaryData
  timestamp: number
  size: number // 数据大小（字节）
  accessTime: number // 最后访问时间，用于LRU
}

// 缓存元数据接口
interface CacheMeta {
  totalSize: number // 当前总大小
  itemCount: number // 缓存项数量
  lastCleanup: number // 上次清理时间
}

// 缓存配置
interface StorageCacheConfig {
  maxSize: number // 最大缓存大小（字节）
  expireTime: number // 过期时间（毫秒）
  cleanupInterval: number // 清理间隔（毫秒）
}

export class YouTubeSummaryStorageCache {
  private config: StorageCacheConfig
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config?: Partial<StorageCacheConfig>) {
    this.config = {
      maxSize: config?.maxSize || 5 * 1024 * 1024, // 默认5MB
      expireTime: config?.expireTime || 24 * 60 * 60 * 1000, // 默认24小时
      cleanupInterval: config?.cleanupInterval || 60 * 60 * 1000, // 默认1小时清理一次
    }
    
    // 启动定期清理任务
    this.startCleanupTask()
  }

  /**
   * 计算数据大小（字节）
   */
  private calculateSize(data: SummaryData): number {
    const jsonString = JSON.stringify(data)
    return new Blob([jsonString]).size
  }

  /**
   * 检查数据是否过期
   */
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.config.expireTime
  }

  /**
   * 获取缓存元数据
   */
  private async getCacheMeta(): Promise<CacheMeta> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY.YOUTUBE_SUMMARY_CACHE_META)
      return result[STORAGE_KEY.YOUTUBE_SUMMARY_CACHE_META] || {
        totalSize: 0,
        itemCount: 0,
        lastCleanup: Date.now(),
      }
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 获取缓存元数据失败:', error)
      return {
        totalSize: 0,
        itemCount: 0,
        lastCleanup: Date.now(),
      }
    }
  }

  /**
   * 更新缓存元数据
   */
  private async updateCacheMeta(meta: CacheMeta): Promise<void> {
    try {
      await browser.storage.local.set({
        [STORAGE_KEY.YOUTUBE_SUMMARY_CACHE_META]: meta
      })
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 更新缓存元数据失败:', error)
    }
  }

  /**
   * 获取所有缓存数据
   */
  private async getAllCacheItems(): Promise<Record<string, StorageCacheItem>> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY.YOUTUBE_SUMMARY_CACHE)
      return result[STORAGE_KEY.YOUTUBE_SUMMARY_CACHE] || {}
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 获取缓存数据失败:', error)
      return {}
    }
  }

  /**
   * 保存所有缓存数据
   */
  private async saveAllCacheItems(items: Record<string, StorageCacheItem>): Promise<void> {
    try {
      await browser.storage.local.set({
        [STORAGE_KEY.YOUTUBE_SUMMARY_CACHE]: items
      })
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 保存缓存数据失败:', error)
      throw error
    }
  }

  /**
   * 清理过期数据
   */
  private async cleanExpiredItems(): Promise<void> {
    try {
      const items = await this.getAllCacheItems()
      const meta = await this.getCacheMeta()
      const now = Date.now()
      
      let cleanedCount = 0
      let cleanedSize = 0
      const validItems: Record<string, StorageCacheItem> = {}

      for (const [key, item] of Object.entries(items)) {
        if (this.isExpired(item.timestamp)) {
          cleanedCount++
          cleanedSize += item.size
        } else {
          validItems[key] = item
        }
      }

      if (cleanedCount > 0) {
        await this.saveAllCacheItems(validItems)
        
        const newMeta: CacheMeta = {
          totalSize: meta.totalSize - cleanedSize,
          itemCount: meta.itemCount - cleanedCount,
          lastCleanup: now,
        }
        
        await this.updateCacheMeta(newMeta)
        
        console.log(`[YouTubeSummaryStorageCache] 清理了 ${cleanedCount} 个过期缓存项，释放 ${cleanedSize} 字节`)
      }
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 清理过期数据失败:', error)
    }
  }

  /**
   * LRU淘汰策略 - 移除最早访问的项目
   */
  private async evictLRU(): Promise<void> {
    try {
      const items = await this.getAllCacheItems()
      const itemEntries = Object.entries(items)
      
      if (itemEntries.length === 0) return

      // 找到最早访问的项目
      let oldestKey = ''
      let oldestTime = Date.now()
      
      for (const [key, item] of itemEntries) {
        if (item.accessTime < oldestTime) {
          oldestTime = item.accessTime
          oldestKey = key
        }
      }

      if (oldestKey) {
        const evictedItem = items[oldestKey]
        delete items[oldestKey]
        
        await this.saveAllCacheItems(items)
        
        const meta = await this.getCacheMeta()
        const newMeta: CacheMeta = {
          totalSize: meta.totalSize - evictedItem.size,
          itemCount: meta.itemCount - 1,
          lastCleanup: meta.lastCleanup,
        }
        
        await this.updateCacheMeta(newMeta)
        
        console.log(`[YouTubeSummaryStorageCache] LRU淘汰缓存项: ${oldestKey}，释放 ${evictedItem.size} 字节`)
      }
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] LRU淘汰失败:', error)
    }
  }

  /**
   * 确保有足够空间存储新数据
   */
  private async ensureSpace(newItemSize: number): Promise<void> {
    // 如果单个数据就超过最大容量，直接拒绝
    if (newItemSize > this.config.maxSize) {
      throw new Error(`数据大小 (${newItemSize} bytes) 超过最大缓存容量 (${this.config.maxSize} bytes)`)
    }

    // 先清理过期数据
    await this.cleanExpiredItems()

    // 检查是否需要LRU淘汰
    let meta = await this.getCacheMeta()
    
    while (meta.totalSize + newItemSize > this.config.maxSize && meta.itemCount > 0) {
      await this.evictLRU()
      meta = await this.getCacheMeta()
    }
  }

  /**
   * 设置缓存
   */
  async set(videoId: string, data: SummaryData): Promise<void> {
    try {
      const size = this.calculateSize(data)
      const now = Date.now()

      // 确保有足够空间
      await this.ensureSpace(size)

      const items = await this.getAllCacheItems()
      const meta = await this.getCacheMeta()

      // 如果已存在，先减去旧数据的大小
      let sizeDiff = size
      if (items[videoId]) {
        sizeDiff = size - items[videoId].size
      }

      // 创建新的缓存项
      const cacheItem: StorageCacheItem = {
        videoId,
        data: JSON.parse(JSON.stringify(data)), // 深拷贝
        timestamp: now,
        size,
        accessTime: now,
      }

      items[videoId] = cacheItem
      await this.saveAllCacheItems(items)

      // 更新元数据
      const newMeta: CacheMeta = {
        totalSize: meta.totalSize + sizeDiff,
        itemCount: items[videoId] ? meta.itemCount : meta.itemCount + 1,
        lastCleanup: meta.lastCleanup,
      }
      
      await this.updateCacheMeta(newMeta)

      console.log(`[YouTubeSummaryStorageCache] 缓存已保存: ${videoId}, 大小: ${size} bytes, 总大小: ${newMeta.totalSize} bytes`)
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 设置缓存失败:', error)
      throw error
    }
  }

  /**
   * 获取缓存
   */
  async get(videoId: string): Promise<SummaryData | null> {
    try {
      const items = await this.getAllCacheItems()
      const item = items[videoId]
      
      if (!item) {
        return null
      }

      // 检查是否过期
      if (this.isExpired(item.timestamp)) {
        await this.delete(videoId)
        console.log(`[YouTubeSummaryStorageCache] 缓存已过期并删除: ${videoId}`)
        return null
      }

      // 更新访问时间（LRU策略）
      item.accessTime = Date.now()
      items[videoId] = item
      await this.saveAllCacheItems(items)

      console.log(`[YouTubeSummaryStorageCache] 缓存命中: ${videoId}`)
      return JSON.parse(JSON.stringify(item.data)) // 返回深拷贝
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 获取缓存失败:', error)
      return null
    }
  }

  /**
   * 检查是否存在有效缓存
   */
  async has(videoId: string): Promise<boolean> {
    try {
      const items = await this.getAllCacheItems()
      const item = items[videoId]
      
      if (!item) return false
      
      if (this.isExpired(item.timestamp)) {
        await this.delete(videoId)
        return false
      }
      
      return true
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 检查缓存存在性失败:', error)
      return false
    }
  }

  /**
   * 删除指定缓存
   */
  async delete(videoId: string): Promise<boolean> {
    try {
      const items = await this.getAllCacheItems()
      const item = items[videoId]
      
      if (!item) return false

      delete items[videoId]
      await this.saveAllCacheItems(items)

      const meta = await this.getCacheMeta()
      const newMeta: CacheMeta = {
        totalSize: meta.totalSize - item.size,
        itemCount: meta.itemCount - 1,
        lastCleanup: meta.lastCleanup,
      }
      
      await this.updateCacheMeta(newMeta)

      console.log(`[YouTubeSummaryStorageCache] 缓存已删除: ${videoId}`)
      return true
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 删除缓存失败:', error)
      return false
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    try {
      await browser.storage.local.remove([
        STORAGE_KEY.YOUTUBE_SUMMARY_CACHE,
        STORAGE_KEY.YOUTUBE_SUMMARY_CACHE_META
      ])
      
      console.log('[YouTubeSummaryStorageCache] 所有缓存已清空')
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 清空缓存失败:', error)
      throw error
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    try {
      const meta = await this.getCacheMeta()
      return {
        itemCount: meta.itemCount,
        currentSize: meta.totalSize,
        maxSize: this.config.maxSize,
        usagePercentage: Math.round((meta.totalSize / this.config.maxSize) * 100),
        expireTime: this.config.expireTime,
        lastCleanup: meta.lastCleanup,
      }
    } catch (error) {
      console.error('[YouTubeSummaryStorageCache] 获取统计信息失败:', error)
      return {
        itemCount: 0,
        currentSize: 0,
        maxSize: this.config.maxSize,
        usagePercentage: 0,
        expireTime: this.config.expireTime,
        lastCleanup: 0,
      }
    }
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTask(): void {
    // 清除之前的定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    // 启动新的定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanExpiredItems()
    }, this.config.cleanupInterval)
  }

  /**
   * 停止定期清理任务
   */
  stopCleanupTask(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 手动触发清理
   */
  async cleanup(): Promise<void> {
    await this.cleanExpiredItems()
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    this.stopCleanupTask()
  }
}

// 创建全局缓存实例
export const youtubeSummaryStorageCache = new YouTubeSummaryStorageCache() 