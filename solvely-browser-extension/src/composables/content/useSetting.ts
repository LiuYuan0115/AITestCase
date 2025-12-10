import { ref, computed, onMounted } from 'vue'
import { STORAGE_KEY } from '~/config'

export const SettingStorageMap = {
  'float-btn': STORAGE_KEY.FLOAT_BTN_ENABLED,
  'auto-detect': STORAGE_KEY.AUTO_DETECT_ENABLED,
  'select-toolbar': STORAGE_KEY.SELECT_TOOLBAR_ENABLED,
  'sidebar-popup-panel': STORAGE_KEY.SIDEBAR_POPUP_PANEL_ENABLED,
  'youtube-panel': STORAGE_KEY.YOUTUBE_PANEL_ENABLED,
  'quizlet-btn': STORAGE_KEY.QUIZLET_BTN_ENABLED,
  'chatgpt-btn': STORAGE_KEY.CHATGPT_BTN_ENABLED,
  'text-selection': STORAGE_KEY.TEXT_SELECTION_ENABLED,
}

export type SettingStorageMapKey = keyof typeof SettingStorageMap

/**
 * 设置功能是否启用
 * @param functionName 功能名称  'float-btn' | 'auto-detect' | 'select-toolbar' | 'sidebar-popup-panel'
 */
export const useSetting = (functionName: SettingStorageMapKey) => {
  // 该功能的存储的 key
  const storageKey = SettingStorageMap[functionName]

  // 在当前页面打开
  const pageEnable = ref(true)
  // 在全局打开
  const globalEnable = ref(true)

  // 可被监听的实时状态, 代表功能最终是否启用
  const isEnable = computed(() => {
    return pageEnable.value && globalEnable.value
  })

  // 在当前页面关闭
  function closeInThisPage() {
    pageEnable.value = false
  }
  function openInThisPage() {
    pageEnable.value = true
  }

  // 在全局关闭
  async function closeInGlobal() {
    await browser.storage.local.set({ [storageKey]: false })
    globalEnable.value = false
  }
  // 在全局打开
  async function openInGlobal() {
    await browser.storage.local.set({ [storageKey]: true })
    globalEnable.value = true
  }

  async function handleStorageChange(changes: any, areaName: string) {
    if (areaName === 'local') {
      if (changes[storageKey]) {
        globalEnable.value = changes[storageKey].newValue
      }
    }
  }

  onMounted(() => {
    // 页面载入的时候默认开启
    pageEnable.value = true
    // 加载全局设置
    browser.storage.local.get(storageKey).then((res) => {
      // 如果存储中没有该设置项，则默认为 true
      globalEnable.value =
        res[storageKey] !== undefined ? res[storageKey] : true
    })
    // 监听全局设置变化
    browser.storage.onChanged.addListener(handleStorageChange)
  })

  onUnmounted(() => {
    // 移除监听
    browser.storage.onChanged.removeListener(handleStorageChange)
  })

  return {
    isEnable,
    pageEnable,
    globalEnable,
    closeInThisPage,
    closeInGlobal,
    openInThisPage,
    openInGlobal,
  }
}

export default useSetting
