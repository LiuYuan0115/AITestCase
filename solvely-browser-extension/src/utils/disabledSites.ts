import { STORAGE_KEY } from '~/config'

// 禁用站点类型定义
export interface DisabledSite {
  url: string
  type: 'page' | 'website'  // page: 页面级别, website: 网站级别
  createdAt: number  // 创建时间戳
}

// 禁用站点管理相关类型
export interface DisabledSiteManagerInterface {
  addDisabledSite: (url: string, type: 'page' | 'website') => Promise<void>
  removeDisabledSite: (url: string) => Promise<void>
  isSiteDisabled: (currentUrl: string) => boolean
  isSiteDisabledAsync: (currentUrl: string) => Promise<boolean>
  getDisabledSites: () => Promise<DisabledSite[]>
  clearAllDisabledSites: () => Promise<void>
  getDomainFromUrl: (url: string) => string
  isDuplicate: (url: string, type: 'page' | 'website') => Promise<boolean>
}

/**
 * 禁用站点管理工具类
 */
class DisabledSiteManager implements DisabledSiteManagerInterface {
  private storageKey: string

  constructor(storageKey: string) {
    this.storageKey = storageKey
  }

  /**
   * 添加禁用站点
   * @param url 要禁用的URL
   * @param type 禁用类型：'page' | 'website'
   */
  async addDisabledSite(url: string, type: 'page' | 'website'): Promise<void> {
    try {
      // 获取现有的禁用站点列表
      const result = await browser.storage.local.get([this.storageKey])
      const disabledSites: DisabledSite[] = result[this.storageKey] || []
      
      // 检查是否已存在相同的禁用项
      const existingIndex = disabledSites.findIndex(site => site.url === url)
      
      if (existingIndex !== -1) {
        // 如果已存在，更新类型和时间戳
        disabledSites[existingIndex] = {
          url,
          type,
          createdAt: Date.now()
        }
      } else {
        // 如果不存在，添加新的禁用项
        disabledSites.push({
          url,
          type,
          createdAt: Date.now()
        })
      }
      
      // 保存到存储
      await browser.storage.local.set({
        [this.storageKey]: disabledSites
      })
      
      console.log(`[DisabledSiteManager] 已添加禁用站点: ${url} (${type})`)
    } catch (error) {
      console.error('[DisabledSiteManager] 添加禁用站点失败:', error)
      throw error
    }
  }

  /**
   * 移除禁用站点
   * @param url 要移除的URL
   */
  async removeDisabledSite(url: string): Promise<void> {
    try {
      // 获取现有的禁用站点列表
      const result = await browser.storage.local.get([this.storageKey])
      const disabledSites: DisabledSite[] = result[this.storageKey] || []
      
      // 过滤掉要移除的项
      const filteredSites = disabledSites.filter(site => site.url !== url)
      
      // 保存到存储
      await browser.storage.local.set({
        [this.storageKey]: filteredSites
      })
      
      console.log(`[DisabledSiteManager] 已移除禁用站点: ${url}`)
    } catch (error) {
      console.error('[DisabledSiteManager] 移除禁用站点失败:', error)
      throw error
    }
  }

  /**
   * 检查当前页面是否被禁用
   * @param currentUrl 当前页面URL
   * @returns 是否被禁用
   */
  isSiteDisabled(currentUrl: string): boolean {
    try {
      // 注意：由于 browser.storage.local.get 是异步的，这里无法同步获取
      // 这个方法主要用于兼容性，实际使用时建议使用 isSiteDisabledAsync
      console.warn('[DisabledSiteManager] isSiteDisabled 方法已废弃，请使用 isSiteDisabledAsync')
      return false
    } catch (error) {
      console.error('[DisabledSiteManager] 检查禁用状态失败:', error)
      return false
    }
  }

  /**
   * 异步检查当前页面是否被禁用（推荐使用）
   * @param currentUrl 当前页面URL
   * @returns 是否被禁用
   */
  async isSiteDisabledAsync(currentUrl: string): Promise<boolean> {
    try {
      // 获取禁用站点列表
      const result = await browser.storage.local.get([this.storageKey])
      const disabledSites: DisabledSite[] = result[this.storageKey] || []
      
      // 检查是否有匹配的禁用项
      return disabledSites.some(site => {
        if (site.type === 'page') {
          // 页面级别：精确匹配
          return site.url === currentUrl
        } else if (site.type === 'website') {
          // 网站级别：检查当前URL是否以该网站URL开头
          return currentUrl.startsWith(site.url)
        }
        return false
      })
    } catch (error) {
      console.error('[DisabledSiteManager] 异步检查禁用状态失败:', error)
      return false
    }
  }

  /**
   * 获取所有禁用站点
   * @returns 禁用站点列表
   */
  async getDisabledSites(): Promise<DisabledSite[]> {
    try {
      const result = await browser.storage.local.get([this.storageKey])
      return result[this.storageKey] || []
    } catch (error) {
      console.error('[DisabledSiteManager] 获取禁用站点列表失败:', error)
      return []
    }
  }

  /**
   * 清空所有禁用站点
   */
  async clearAllDisabledSites(): Promise<void> {
    try {
      await browser.storage.local.remove([this.storageKey])
      console.log('[DisabledSiteManager] 已清空所有禁用站点')
    } catch (error) {
      console.error('[DisabledSiteManager] 清空禁用站点失败:', error)
      throw error
    }
  }

  /**
   * 获取当前页面的域名
   * @param url 完整URL
   * @returns 域名
   */
  getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.hostname}`
    } catch (error) {
      console.error('[DisabledSiteManager] 解析URL失败:', error)
      return url
    }
  }

  /**
   * 检查禁用项是否重复
   * @param url 要检查的URL
   * @param type 要检查的类型
   * @returns 是否重复
   */
  async isDuplicate(url: string, type: 'page' | 'website'): Promise<boolean> {
    try {
      const disabledSites = await this.getDisabledSites()
      return disabledSites.some(site => site.url === url && site.type === type)
    } catch (error) {
      console.error('[DisabledSiteManager] 检查重复失败:', error)
      return false
    }
  }
}

/**
 * 创建禁用站点管理器的工厂函数
 * @param storageKey 存储键
 * @returns 禁用站点管理器实例
 */
export function createDisabledSiteManager(storageKey: string): DisabledSiteManager {
  return new DisabledSiteManager(storageKey)
}

// 创建默认的浮动按钮禁用站点管理器实例
const disabledSiteManager = new DisabledSiteManager(STORAGE_KEY.FLOAT_BUTTON_DISABLED_SITES)

// 创建划词禁用站点管理器实例
const textSelectionDisabledSiteManager = new DisabledSiteManager(STORAGE_KEY.TEXT_SELECTION_DISABLED_SITES)

// 导出实例和类
export { disabledSiteManager, textSelectionDisabledSiteManager } 