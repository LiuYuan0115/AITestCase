import { ref, onMounted, onUnmounted, computed } from 'vue'
import { STORAGE_KEY } from '~/config'
import trackEvent from '~/utils/trackEvent'

// 基础语言代码类型（不带区域）
export type LanguageCode = 'en' | 'pt' | 'ko' | 'fr' | 'ja' | 'es' | 'de'

// 带区域的完整语言代码（用户可选的模式）
export type LanguageMode = 'auto' | 'en-US' | 'pt-BR' | 'ko' | 'fr-FR' | 'ja' | 'es-419' | 'de'

// 完整语言代码到基础代码的映射
const languageModeToBase: Record<string, LanguageCode> = {
  'en-US': 'en',
  'pt-BR': 'pt',
  'ko': 'ko',
  'fr-FR': 'fr',
  'ja': 'ja',
  'es-419': 'es',
  'de': 'de',
}

/**
 * 检测浏览器语言并映射到支持的语言代码
 * @returns 基础语言代码
 */
function detectBrowserLanguage(): LanguageCode {
  try {
    // 获取浏览器语言（如 'en-US', 'zh-CN', 'ja', 等）
    const browserLang = navigator.language || navigator.languages?.[0] || 'en-US'
    
    // 提取基础语言代码（去掉区域部分）
    const baseLanguage = browserLang.split('-')[0].toLowerCase()
    
    // 支持的语言列表
    const supportedLanguages: LanguageCode[] = ['en', 'pt', 'ko', 'fr', 'ja', 'es', 'de']
    
    // 判断是否在支持的语言中
    if (supportedLanguages.includes(baseLanguage as LanguageCode)) {
      return baseLanguage as LanguageCode
    }
    
    // 不在支持的语言中，默认返回英语
    return 'en'
  } catch (error) {
    console.error('Failed to detect browser language:', error)
    return 'en'
  }
}

export function useLanguage() {
  // 浏览器语言检测（一次性计算）
  const browserLanguage = detectBrowserLanguage()

  // 完全无状态的 languageMode - 每个实例都从 Storage 读取
  const languageMode = ref<LanguageMode>('auto')
  
  // 异步获取当前语言模式
  const getCurrentLanguageMode = async (): Promise<LanguageMode> => {
    try {
      const result = await browser.storage.local.get([STORAGE_KEY.AI_RESPONSE_LANGUAGE])
      const savedMode = result[STORAGE_KEY.AI_RESPONSE_LANGUAGE] as LanguageMode
      return savedMode || 'auto'
    } catch (error) {
      console.error('Failed to get language mode from storage:', error)
      return 'auto'
    }
  }

  // 计算当前实际使用的语言（响应式，基于当前 languageMode）
  const currentLanguage = computed<LanguageCode>(() => {
    if (languageMode.value === 'auto') {
      // auto 模式：使用浏览器检测到的语言
      return browserLanguage
    } else {
      // 非 auto 模式：从完整代码映射到基础代码
      return languageModeToBase[languageMode.value] || 'en'
    }
  })

  // 设置语言模式（直接操作 Storage）
  const setLanguage = async (mode: LanguageMode) => {
    // 验证语言模式值
    const validModes: LanguageMode[] = ['auto', 'en-US', 'pt-BR', 'ko', 'fr-FR', 'ja', 'es-419', 'de']
    if (!mode || !validModes.includes(mode)) {
      console.error('Invalid language mode:', mode)
      return
    }
    
    // 记录当前语言模式（from）
    const fromMode = languageMode.value
    
    // 直接保存到扩展存储
    try {
      await browser.storage.local.set({ [STORAGE_KEY.AI_RESPONSE_LANGUAGE]: mode })
      // 更新本地响应式状态（用于当前环境的 UI 更新）
      languageMode.value = mode
      
      // 计算实际发送给后端的语言（重新检测以确保准确性）
      const actualLanguage = mode === 'auto' ? detectBrowserLanguage() : languageModeToBase[mode] || 'en'
      
      // 埋点追踪
      trackEvent.track('Plugin_Settings_Language', {
        from: fromMode,
        to: mode,
      })
      
      console.log(`[Language Settings] 语言模式已设置为: ${mode}`)
      console.log(`[Language Settings] 实际发送给后端的语言: ${actualLanguage}`)
    } catch (error) {
      console.error('Failed to save language mode to extension storage:', error)
    }
  }

  // 从浏览器存储获取当前语言模式设置
  const getLanguageMode = async (): Promise<LanguageMode> => {
    return await getCurrentLanguageMode()
  }

  // 初始化：从 Storage 读取当前值
  const initialize = async () => {
    const currentMode = await getCurrentLanguageMode()
    languageMode.value = currentMode
  }

  // 监听扩展存储变化（跨环境同步）
  const handleStorageChange = (changes: any, areaName: string) => {
    if (areaName === 'local' && changes[STORAGE_KEY.AI_RESPONSE_LANGUAGE]) {
      const newMode = changes[STORAGE_KEY.AI_RESPONSE_LANGUAGE].newValue as LanguageMode
      if (newMode && newMode !== languageMode.value) {
        languageMode.value = newMode
      }
    }
  }

  // 使用生命周期钩子进行初始化
  onMounted(async () => {
    await initialize()
    browser.storage.onChanged.addListener(handleStorageChange)
  })

  // 清理监听器
  onUnmounted(() => {
    try {
      browser.storage.onChanged.removeListener(handleStorageChange)
    } catch (error) {
      console.error('Failed to remove storage listener:', error)
    }
  })

  return {
    languageMode,      // 响应式的用户选择模式
    currentLanguage,   // 响应式的实际语言代码
    setLanguage,       // 设置方法（直接操作 Storage）
    getLanguageMode,   // 获取方法（直接从 Storage 读取）
  }
}

