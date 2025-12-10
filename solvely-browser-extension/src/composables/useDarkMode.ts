import { ref, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { STORAGE_KEY } from '~/config'

// 主题模式类型
type ThemeMode = 'dark' | 'light' | 'auto'

// 单例状态
const isDark = ref(false)
const isDarkSystem = ref(false) 
const currentMode = ref<ThemeMode>('auto')
let debounceTimer: number | null = null
let systemThemeMediaQuery: MediaQueryList | null = null
let isInitialized = false

// 防止循环触发的标志：记录最近一次内部设置的模式和时间戳
let lastInternalSetMode: ThemeMode | null = null
let lastInternalSetTime = 0
const INTERNAL_UPDATE_THROTTLE = 100 // 100ms 内的相同更新视为内部更新

// 函数声明 - 使用 let 因为需要在函数内部赋值
let setMode: (mode: ThemeMode, forceUpdate?: boolean) => Promise<void>
let getCurrentMode: () => Promise<ThemeMode>

export function useDarkMode() {
  // 如果已经初始化，直接返回现有实例
  if (isInitialized) {
    return {
      isDark,
      isDarkSystem,
      currentMode,
      setMode,
      getCurrentMode,
    }
  }

  // 从浏览器存储获取当前模式
  getCurrentMode = async (): Promise<ThemeMode> => {
    try {
      const result = await browser.storage.local.get([STORAGE_KEY.THEME_MODE])
      const savedMode = result[STORAGE_KEY.THEME_MODE] as ThemeMode
      return savedMode || 'auto'
    } catch (error) {
      console.error('Failed to get theme mode from storage:', error)
      return 'auto'
    }
  }

  // 设置主题模式
  setMode = async (mode: ThemeMode, forceUpdate = false) => {
    // 验证模式值
    if (!mode || !['dark', 'light', 'auto'].includes(mode)) {
      console.error('Invalid theme mode:', mode)
      return
    }
    
    // 如果模式没有变化且不是强制更新，跳过（但初始化时需要强制更新）
    if (!forceUpdate && currentMode.value === mode) {
      return
    }
    
    currentMode.value = mode
    
    // 根据模式设置实际主题
    let shouldBeDark = false
    
    switch (mode) {
      case 'dark':
        shouldBeDark = true
        break
      case 'light':
        shouldBeDark = false
        break
      case 'auto':
        shouldBeDark = systemThemeMediaQuery?.matches ?? false
        break
    }
    
    // 更新状态，让外部组件自己处理 DOM 类
    isDark.value = shouldBeDark
    
    // 标记为内部更新，防止触发 storage 监听器循环
    lastInternalSetMode = mode
    lastInternalSetTime = Date.now()
    
    // 保存到扩展存储
    try {
      await browser.storage.local.set({ [STORAGE_KEY.THEME_MODE]: mode })
    } catch (error) {
      console.error('Failed to save theme mode to extension storage:', error)
    }
  }

  // 监听系统主题变化
  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    // 始终更新系统暗黑模式状态
    isDarkSystem.value = e.matches
    
    // 只有在自动模式下才更新实际主题
    if (currentMode.value === 'auto') {
      isDark.value = e.matches
    }
  }

  // 监听扩展存储变化
  const handleStorageChange = (changes: any, areaName: string) => {
    if (areaName === 'local' && changes[STORAGE_KEY.THEME_MODE]) {
      const newMode = changes[STORAGE_KEY.THEME_MODE].newValue as ThemeMode
      
      // 节流：如果是最近（100ms内）自己设置的相同模式，跳过处理
      const now = Date.now()
      if (
        newMode === lastInternalSetMode &&
        now - lastInternalSetTime < INTERNAL_UPDATE_THROTTLE
      ) {
        // 这是自己触发的更新，忽略
        return
      }
      
      // 如果模式没有变化，也跳过
      if (newMode && newMode !== currentMode.value) {
        // 清除内部更新标志，因为这是外部更新（可能是其他标签页）
        lastInternalSetMode = null
        lastInternalSetTime = 0
        
        setMode(newMode)
      }
    }
  }

  // 初始化主题
  const initializeTheme = async () => {
    try {
      // 设置系统主题监听
      systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      
      // 初始化系统暗黑模式状态
      isDarkSystem.value = systemThemeMediaQuery.matches
      
      // 始终添加系统主题监听（无论当前模式如何）
      systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange)
      
      // 从扩展存储获取设置
      const result = await browser.storage.local.get([STORAGE_KEY.THEME_MODE])
      const savedMode = result[STORAGE_KEY.THEME_MODE] as ThemeMode
      
      // 设置模式（初始化时强制更新，确保主题状态正确设置）
      const mode = savedMode || 'auto'
      
      setMode(mode, true)
      
      // 监听扩展存储变化
      browser.storage.onChanged.addListener(handleStorageChange)
      isInitialized = true // 标记为已初始化
    } catch (error) {
      console.error('Failed to initialize dark mode:', error)
    }
  }

  // 检查是否有组件实例
  const instance = getCurrentInstance()
  
  if (instance) {
    // 有组件实例，使用 lifecycle hooks
    onMounted(async () => {
      await initializeTheme()
    })

    // 清理监听器
    onUnmounted(() => {
      try {
        // 清除防抖定时器
        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }
        
        // 移除系统主题监听
        if (systemThemeMediaQuery) {
          systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange)
        }
        
        browser.storage.onChanged.removeListener(handleStorageChange)
      } catch (error) {
        console.error('Failed to remove storage listener:', error)
      }
    })
  } else {
    // 没有组件实例，立即初始化（用于模块顶层调用）
    initializeTheme()
  }

  return {
    isDark,
    isDarkSystem,
    currentMode,
    setMode,
    getCurrentMode,
  }
} 