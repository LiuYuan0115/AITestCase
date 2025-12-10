<template>
  <div class="mx-auto w-[714px]">
    <h2
      class="text-[18px] font-[700] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-3"
    >
      Sidebar
    </h2>
    <div
      class="rounded-[12px] border border-s-border-secondary dark:border-s-border-secondary-dark w-[714px] overflow-hidden"
    >
      <div class="flex flex-col justify-between overflow-hidden">
        <!-- 图片容器 -->
        <div class="relative w-full h-[200px] bg-s-disable-bg dark:bg-s-disable-bg-dark rounded-t-[12px]">
          <!-- 占位符 -->
          <div 
            v-if="sidebarImageError" 
            class="absolute inset-0 flex items-center justify-center"
          >
            <div class="text-center">
              <div class="w-16 h-16 mx-auto mb-3 bg-s-border dark:bg-s-border-dark rounded-lg flex items-center justify-center">
                <svg class="w-8 h-8 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p class="text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-sm">
                Sidebar Preview
              </p>
            </div>
          </div>
          
          <!-- 实际图片 -->
          <img 
            v-show="!sidebarImageError"
            :src="isDark ? sidebarImageDark : sidebarImage" 
            class="w-full h-full object-cover rounded-t-[12px]" 
            @error="handleImageError"
          />
        </div>
        
        <div class="flex gap-2 h-[58px] items-center justify-between pl-4 pr-5">
          <div
            class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] font-[600]"
          >
            Always show Side icon on page
          </div>

          <ToggleSwitch v-model="sidebarEnabled" />
        </div>

				<div class="pl-4 font-[600] text-[14px] leading-[20px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark pt-4 border-t border-s-border-secondary dark:border-s-border-secondary-dark">
					<span>Disabled on sites</span>
				</div>
				<div v-if="disabledSites.length === 0" class="p-4 text-center text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-[14px]">
					No disabled sites
				</div>
				<div v-for="(site, index) in disabledSites" :key="site.url" class="p-4 flex justify-between items-center" :class="index < disabledSites.length - 1 ? 'border-b border-s-border-secondary dark:border-s-border-secondary-dark' : ''">
					<div class="flex items-center gap-3 flex-1 min-w-0">
						<div class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] font-[400] truncate max-w-full">{{ site.url }}</div>
						<div class="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0" 
							:class="site.type === 'page' ? 'bg-[#ECF5FF] text-s-text-brand dark:bg-[#122E57] dark:text-s-text-brand-dark' : 'bg-s-function-success-bg text-s-function-success dark:bg-s-function-success-bg-dark dark:text-s-function-success-dark'">
							{{ site.type === 'page' ? 'Page' : 'Website' }}
						</div>
					</div>
					<button 
						@click="removeDisabledSite(site.url)"
						class="bg-s-text-low-emphasis dark:bg-[#2A303E] rounded-full transition-colors duration-200 flex justify-center items-center text-white flex-shrink-0 ml-3"
						title="Remove from disabled list"
					>
						<SvgIcon name="options/close" size="20"/>
					</button>
				</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'
import { STORAGE_KEY } from '~/config'
import sidebarImage from '@/assets/icons/options/Sidebar.webp?inline'
import sidebarImageDark from '@/assets/icons/options/Sidebar-dark.webp?inline'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { disabledSiteManager } from '~/utils/disabledSites'
import type { DisabledSite } from '~/utils/disabledSites'
import trackEvent from '~/utils/trackEvent'
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark } = useDarkMode()

// 禁用站点列表
const disabledSites = ref<DisabledSite[]>([])

// Sidebar 设置状态
const sidebarEnabled = ref(true)

// 图片错误状态
const sidebarImageError = ref(false)

// 处理图片加载错误
const handleImageError = () => {
  sidebarImageError.value = true
}

// 移除禁用的网站
const removeDisabledSite = async (url: string) => {
  try {
    await disabledSiteManager.removeDisabledSite(url)
    console.log('移除禁用网站:', url)
    // 重新加载禁用站点列表
    await loadDisabledSites()
  } catch (error) {
    console.error('移除禁用网站失败:', error)
  }
}

// 加载禁用站点列表
const loadDisabledSites = async () => {
  try {
    const sites = await disabledSiteManager.getDisabledSites()
    disabledSites.value = sites
    console.log('加载禁用站点列表:', sites)
  } catch (error) {
    console.error('加载禁用站点列表失败:', error)
  }
}

// 监听禁用站点存储变化
const handleDisabledSitesChange = (changes: any, area: string) => {
  if (area === 'local' && changes[STORAGE_KEY.FLOAT_BUTTON_DISABLED_SITES]) {
    console.log('检测到禁用站点变化，重新加载')
    loadDisabledSites()
  }
}

// 保存设置到扩展存储
const saveSettings = async () => {
  try {
    await browser.storage.local.set({
      [STORAGE_KEY.FLOAT_BTN_ENABLED]: sidebarEnabled.value,
    })
  } catch (error) {
    console.error('Failed to save sidebar settings:', error)
  }
}

// 从扩展存储加载设置
const loadSettings = async () => {
  try {
    const result = await browser.storage.local.get([STORAGE_KEY.FLOAT_BTN_ENABLED])
    sidebarEnabled.value = result[STORAGE_KEY.FLOAT_BTN_ENABLED] ?? true
  } catch (error) {
    console.error('Failed to load sidebar settings:', error)
  }
}

// 监听设置变化
const handleSettingChange = () => {
  saveSettings()
  // 添加埋点
  trackEvent.track('Plugin_settings_sidebar')
}

// 监听存储变化
const handleStorageChange = (changes: any, area: string) => {
  if (area === 'local' && changes[STORAGE_KEY.FLOAT_BTN_ENABLED]) {
    sidebarEnabled.value = changes[STORAGE_KEY.FLOAT_BTN_ENABLED].newValue
  }
}

// 监听设置变化
watch(sidebarEnabled, () => {
  handleSettingChange()
})

onMounted(async () => {
  await loadSettings()
  browser.storage.onChanged.addListener(handleStorageChange)
  await loadDisabledSites() // 加载禁用站点列表
  browser.storage.onChanged.addListener(handleDisabledSitesChange) // 监听禁用站点存储变化
})

onUnmounted(() => {
  browser.storage.onChanged.removeListener(handleStorageChange)
  browser.storage.onChanged.removeListener(handleDisabledSitesChange)
})
</script>
