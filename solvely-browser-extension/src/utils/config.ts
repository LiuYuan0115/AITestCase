// src/utils/config.ts 插件云端配置管理

import { STORAGE_KEY } from '../config/storage'
import { processExperiments } from './abtestAssignments'

// 配置数据类型
type PluginConfigData = Record<string, any>

/**
 * 同步云端配置文件
 * @returns Promise<boolean> 同步是否成功
 */
export async function syncCloudConfig(): Promise<boolean> {
  try {
    // 添加时间戳避免缓存
    const url = `${import.meta.env.VITE_CLOUD_CONFIG_URL}?t=${Date.now()}`

    // 请求云端配置文件
    const response = await fetch(url)

    if (!response.ok) {
      console.error(
        'Failed to fetch cloud config:',
        response.status,
        response.statusText
      )
      return false
    }

    // 解析 JSON 数据
    const configData: PluginConfigData = await response.json()

    // 读取本地配置并进行版本比对
    const localResult = await browser.storage.local.get(
      STORAGE_KEY.PLUGIN_CONFIG
    )
    const localConfig: PluginConfigData | undefined =
      localResult[STORAGE_KEY.PLUGIN_CONFIG]

    const remoteVersion = (configData as any)?.version
    const localVersion = (localConfig as any)?.version

    const shouldWrite =
      !localConfig ||
      remoteVersion === undefined ||
      remoteVersion !== localVersion

    // 配置同步后的后处理（无论是否需要写入，都执行）
    try {
      await postSyncProcess(configData, shouldWrite)
    } catch (e) {
      console.warn('postSyncProcess error:', e)
    }

    if (!shouldWrite) {
      return true
    }

    // 存储到 browser.storage.local（仅在需要时写入）
    await browser.storage.local.set({
      [STORAGE_KEY.PLUGIN_CONFIG]: configData,
    })

    console.log('Cloud config synced successfully:', configData)
    return true
  } catch (error) {
    console.error('Error syncing cloud config:', error)
    return false
  }
}

/**
 * 获取完整的插件配置
 * @returns Promise<PluginConfigData | null> 配置数据或 null
 */
export async function getPluginConfig(): Promise<PluginConfigData | null> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY.PLUGIN_CONFIG)
    const configData = result[STORAGE_KEY.PLUGIN_CONFIG]

    return configData || null
  } catch (error) {
    console.error('Error getting plugin config:', error)
    return null
  }
}

/**
 * 获取单个配置项，支持嵌套键路径
 * @param key 配置键路径，支持嵌套（如 'limits.quizPdfMaxSize'）
 * @param defaultValue 默认值
 * @returns Promise<T | undefined> 配置值或默认值
 */
export async function getConfigValue<T>(
  key: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    // 获取完整配置
    const config = await getPluginConfig()

    if (!config) {
      return defaultValue
    }

    // 解析键路径
    const keyParts = key.split('.')
    let value: any = config

    // 逐层检查键路径
    for (const part of keyParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        // 键不存在，返回默认值
        return defaultValue
      }
    }

    return value as T
  } catch (error) {
    console.error('Error getting config value:', error)
    return defaultValue
  }
}

/**
 * 配置同步后的后处理逻辑
 * 将 experiments 与是否变更标识传递给 ABTest 分配模块
 */
async function postSyncProcess(
  config: PluginConfigData,
  hasChanged: boolean
): Promise<void> {
  const experiments = (config && (config as any).experiments) || {}
  await processExperiments(experiments, hasChanged)
}
