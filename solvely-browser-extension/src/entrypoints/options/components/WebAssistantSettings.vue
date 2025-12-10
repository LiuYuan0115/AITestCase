<template>
  <div class="mx-auto flex flex-col gap-6 items-center">
    <div v-for="setting in webAssistantSettings" :key="setting.key">
      <h2
        class="text-[18px] font-[700] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-3 duration-200 transition-all"
      >
        {{ setting.title }}
      </h2>
      <div
        class="rounded-[12px] border border-s-border-secondary dark:border-s-border-secondary-dark w-[714px] duration-200 transition-all"
      >
        <div class="flex flex-col justify-between overflow-hidden">
          <!-- 图片容器 -->
          <div class="relative w-full h-[200px] bg-s-disable-bg dark:bg-s-disable-bg-dark rounded-t-[12px] duration-200 transition-all">
            <!-- 占位符 -->
            <div 
              v-if="setting.imageError.value" 
              class="absolute inset-0 flex items-center justify-center"
            >
              <div class="text-center">
                <div class="w-16 h-16 mx-auto mb-3 bg-s-border dark:bg-s-border-dark rounded-lg flex items-center justify-center duration-200 transition-all">
                  <svg class="w-8 h-8 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark duration-200 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p class="text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-sm duration-200 transition-all">
                  {{ setting.title }} Preview
                </p>
              </div>
            </div>
            
            <!-- 实际图片 -->
            <img
              v-show="!setting.imageError.value"
              :src="setting.image"
              :alt="setting.title"
              class="w-full h-full object-cover rounded-t-[12px]"
              @error="handleImageError(setting)"
            />
          </div>
          
          <div class="flex gap-2 h-[58px] items-center justify-between pl-4 pr-5">
            <div
              class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] font-[600] duration-200 transition-all"
            >
              {{ setting.label }}
            </div>
            <ToggleSwitch v-model="setting.enabled.value" />
          </div>

          <!-- Quick Action 禁用网站列表 -->
          <div v-if="setting.key === 'quick-action'" class="border-t border-s-border-secondary dark:border-s-border-secondary-dark">
            <div class="pl-4 font-[600] text-[14px] leading-[20px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark pt-4">
              <span>Disabled on sites</span>
            </div>
            <div v-if="textSelectionDisabledSites.length === 0" class="p-4 text-center text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-[14px]">
              No disabled sites
            </div>
            <div v-for="(site, index) in textSelectionDisabledSites" :key="site.url" class="p-4 flex justify-between items-center" :class="index < textSelectionDisabledSites.length - 1 ? 'border-b border-s-border-secondary dark:border-s-border-secondary-dark' : ''">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] font-[400] truncate max-w-full">{{ site.url }}</div>
                <div class="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0" 
                  :class="site.type === 'page' ? 'bg-[#ECF5FF] text-s-text-brand dark:bg-[#122E57] dark:text-s-text-brand-dark' : 'bg-s-function-success-bg text-s-function-success dark:bg-s-function-success-bg-dark dark:text-s-function-success-dark'">
                  {{ site.type === 'page' ? 'Page' : 'Website' }}
                </div>
              </div>
              <button 
                @click="removeTextSelectionDisabledSite(site.url)"
                class="bg-s-text-low-emphasis dark:bg-[#2A303E] rounded-full transition-colors duration-200 flex justify-center items-center text-white flex-shrink-0 ml-3"
                title="Remove from disabled list"
              >
                <SvgIcon name="options/close" size="20"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { STORAGE_KEY } from '~/config'
import trackEvent from '~/utils/trackEvent'
import { useDarkMode } from '@/composables/useDarkMode'
import { textSelectionDisabledSiteManager } from '~/utils/disabledSites'
import type { DisabledSite } from '~/utils/disabledSites'

// 导入图片
import popupImage from '@/assets/icons/options/Popup.webp?inline'
import chatgptImage from '@/assets/icons/options/ChatGPT Compare.webp?inline'
import youtubeImage from '@/assets/icons/options/YouTube Pannel.webp?inline'
import quickActionImage from '@/assets/icons/options/Quick Action.webp?inline'

const { isDark } = useDarkMode()

import popupImageDark from '@/assets/icons/options/Popup-dark.webp?inline'
import chatgptImageDark from '@/assets/icons/options/ChatGPT Compare-dark.webp?inline'
import youtubeImageDark from '@/assets/icons/options/YouTube Pannel-dark.webp?inline'
import quickActionImageDark from '@/assets/icons/options/Quick Action-dark.webp?inline'

// 功能开关状态
const popupEnabled = ref(true)
const chatgptCompareEnabled = ref(true)
const youtubePanelEnabled = ref(true)
const quickActionEnabled = ref(true)

// 图片错误状态管理
const popupImageError = ref(false)
const chatgptImageError = ref(false)
const youtubeImageError = ref(false)
const quickActionImageError = ref(false)

// 划词禁用站点列表
const textSelectionDisabledSites = ref<DisabledSite[]>([])

// Web Assistant 设置配置 - 使用与侧边栏相同的存储键
const webAssistantSettings = computed(() => [
  {
    key: 'popup',
    title: 'Popup',
    image: isDark.value ? popupImageDark : popupImage,
    label: 'Show popup panel on Website',
    enabled: popupEnabled,
    storageKey: STORAGE_KEY.SIDEBAR_POPUP_PANEL_ENABLED,
    imageError: popupImageError,
    trackEvent: 'Plugin_settings_popuppanel',
  },
  {
    key: 'chatgpt-compare',
    title: 'ChatGPT Compare',
    image: isDark.value ? chatgptImageDark : chatgptImage,
    label: 'Show compare panel on ChatGPT',
    enabled: chatgptCompareEnabled,
    storageKey: STORAGE_KEY.CHATGPT_BTN_ENABLED,
    imageError: chatgptImageError,
    trackEvent: 'Plugin_settings_chatgptbutton',
  },
  {
    key: 'youtube-panel',
    title: 'YouTube Panel',
    image: isDark.value ? youtubeImageDark : youtubeImage,
    label: 'Show summary panel on YouTube',
    enabled: youtubePanelEnabled,
    storageKey: STORAGE_KEY.YOUTUBE_PANEL_ENABLED,
    imageError: youtubeImageError,
    trackEvent: 'Plugin_settings_youtubePanel',
  },
  {
    key: 'quick-action',
    title: 'Quick Action',
    image: isDark.value ? quickActionImageDark : quickActionImage,
    label: 'The quick action is for selected text on a webpage',
    enabled: quickActionEnabled,
    storageKey: STORAGE_KEY.TEXT_SELECTION_ENABLED,
    imageError: quickActionImageError,
    trackEvent: 'Plugin_settings_textSelectionToolbar',
  },
])

// 处理图片加载错误
const handleImageError = (setting: any) => {
  setting.imageError.value = true
}

// 移除划词禁用的网站
const removeTextSelectionDisabledSite = async (url: string) => {
  try {
    await textSelectionDisabledSiteManager.removeDisabledSite(url)
    console.log('移除划词禁用网站:', url)
    // 重新加载禁用站点列表
    await loadTextSelectionDisabledSites()
  } catch (error) {
    console.error('移除划词禁用网站失败:', error)
  }
}

// 加载划词禁用站点列表
const loadTextSelectionDisabledSites = async () => {
  try {
    const sites = await textSelectionDisabledSiteManager.getDisabledSites()
    textSelectionDisabledSites.value = sites
    console.log('加载划词禁用站点列表:', sites)
  } catch (error) {
    console.error('加载划词禁用站点列表失败:', error)
  }
}

// 监听划词禁用站点存储变化
const handleTextSelectionDisabledSitesChange = (changes: any, area: string) => {
  if (area === 'local' && changes[STORAGE_KEY.TEXT_SELECTION_DISABLED_SITES]) {
    console.log('检测到划词禁用站点变化，重新加载')
    loadTextSelectionDisabledSites()
  }
}
// 保存设置到扩展存储
const saveSettings = async () => {
  try {
    const settings = webAssistantSettings.value.reduce((acc, setting) => {
      acc[setting.storageKey] = setting.enabled.value
      return acc
    }, {} as Record<string, boolean>)
    
    await browser.storage.local.set(settings)
  } catch (error) {
    console.error('Failed to save web assistant settings:', error)
  }
}

// 从扩展存储加载设置
const loadSettings = async () => {
  try {
    const storageKeys = webAssistantSettings.value.map(
      (setting) => setting.storageKey
    )
    const result = await browser.storage.local.get(storageKeys)
    
    webAssistantSettings.value.forEach((setting) => {
      setting.enabled.value = result[setting.storageKey] ?? true
    })
  } catch (error) {
    console.error('Failed to load web assistant settings:', error)
  }
}

// 监听设置变化
const handleSettingChange = (changedSetting?: any) => {
  saveSettings()
  
  // 如果有指定设置项，发送对应的埋点
  if (changedSetting) {
    trackEvent.track(changedSetting.trackEvent)
  }
}

// 监听存储变化
const handleStorageChange = (changes: any, area: string) => {
  if (area === 'local') {
    webAssistantSettings.value.forEach((setting) => {
      if (changes[setting.storageKey]) {
        setting.enabled.value = changes[setting.storageKey].newValue
      }
    })
  }
}

// 监听所有设置变化
const settingRefs = {
  'popup': popupEnabled,
  'chatgpt-compare': chatgptCompareEnabled,
  'youtube-panel': youtubePanelEnabled,
  'quick-action': quickActionEnabled,
}

// 使用一个循环来创建所有的 watch
Object.entries(settingRefs).forEach(([key, ref]) => {
  watch(ref, () => {
    const setting = webAssistantSettings.value.find(s => s.key === key)
    handleSettingChange(setting)
  })
})

onMounted(async () => {
  await loadSettings()
  browser.storage.onChanged.addListener(handleStorageChange)
  await loadTextSelectionDisabledSites() // 加载划词禁用站点列表
  browser.storage.onChanged.addListener(handleTextSelectionDisabledSitesChange) // 监听划词禁用站点存储变化
})

onUnmounted(() => {
  browser.storage.onChanged.removeListener(handleStorageChange)
  browser.storage.onChanged.removeListener(handleTextSelectionDisabledSitesChange)
})
</script>

<style scoped>
/* 可以添加自定义样式 */
</style>
