import { STORAGE_KEY } from '~/config/storage'

/**
 * 获取插件唯一 UUID
 * 如果不存在则立即创建（兼容老版本升级）
 */
export async function getPluginUuid(): Promise<string> {
  const storage = await browser.storage.local.get([STORAGE_KEY.PLUGIN_UUID])
  let uuid = storage[STORAGE_KEY.PLUGIN_UUID]
  
  if (!uuid) {
    uuid = crypto?.randomUUID
      ? crypto.randomUUID()
      : `plugin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await browser.storage.local.set({
      [STORAGE_KEY.PLUGIN_UUID]: uuid,
    })
    
    console.log('[PluginUuid] 为旧用户生成 UUID:', uuid)
  }
  
  return uuid
}

/**
 * 更新插件 UUID（从 solvely.ai 恢复时使用）
 */
export async function updatePluginUuid(uuid: string): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEY.PLUGIN_UUID]: uuid,
  })
  console.log('[PluginUuid] UUID 已更新:', uuid)
}

