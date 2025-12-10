<template>
  <div class="space-y-6 mx-auto w-[714px]">
    <!-- Account Section -->
    <div>
      <h2 class="text-[18px] font-[700] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-3 duration-200 transition-all">Account</h2>
      <div class="rounded-[12px] border border-s-border-secondary dark:border-s-border-secondary-dark p-4 duration-200 transition-all">
        <div class="flex items-center">
          <!-- Avatar -->
          <img
            :src="getUserAvatar"
            class="w-9 h-9 rounded-full mr-4"
          />
          <!-- User Info -->
          <div class="h-9">
            <div class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark font-[600] text-[14px] leading-[20px] duration-200 transition-all">
              {{ isAuthenticated ? user?.userName || 'Unknown User' : 'Not logged in' }}
            </div>
            <div class="text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark font-[400] text-[12px] duration-200 transition-all">
              {{ isAuthenticated ? user?.email || 'No email' : 'Please log in to view your account' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Appearance Section -->
    <div>
      <h2 class="text-[18px] font-[700] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-3 duration-200 transition-all">Appearance</h2>
      <div class="rounded-[12px] border border-s-border-secondary dark:border-s-border-secondary-dark p-4 duration-200 transition-all">
        <div class="flex items-center justify-between">
          <div class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] font-[600] duration-200 transition-all">Mode</div>
          <Select
            v-model="selectedMode"
            :options="modes"
            option-label="label"
            option-value="value"
            placeholder="Select Mode"
            class="_primevue_select"
          />
        </div>
      </div>
    </div>

    <!-- Language Section -->
    <div>
      <h2 class="text-[18px] font-[700] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-3 duration-200 transition-all">Language</h2>
      <div class="rounded-[12px] border border-s-border-secondary dark:border-s-border-secondary-dark p-4 duration-200 transition-all">
        <div class="flex items-center justify-between">
          <div class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-[14px] font-[600] duration-200 transition-all">
            AI response language
          </div>
          <Select
            v-model="selectedLanguage"
            :options="languageOptions"
            option-label="label"
            option-value="value"
            placeholder="Select Language"
            class="_primevue_select"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Select from 'primevue/select'
import { STORAGE_KEY } from '~/config'
import type { User } from '~/types'
import { getUserAvatarUrl } from '~/utils/userAvatar'
import { useDarkMode } from '@/composables/useDarkMode'
import { useLanguage } from '@/composables/useLanguage'
import type { LanguageMode } from '@/composables/useLanguage'
import trackEvent from '~/utils/trackEvent'

// 使用暗黑模式中间件
const { currentMode, setMode } = useDarkMode()

// 使用语言设置
const { languageMode, currentLanguage, setLanguage } = useLanguage()

// 模式选项
const modes = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// 选中的模式（直接使用字符串值）
const selectedMode = computed({
  get: () => {
    return currentMode.value
  },
  set: async (newMode: string) => {
    if (newMode && ['dark', 'light', 'auto'].includes(newMode)) {
      await setMode(newMode as 'dark' | 'light' | 'auto')
      trackEvent.track('Plugin_Settings_Appearance', {
        theme: newMode,
      })
    }
  },
})

// 语言选项（基于标准化的语言代码表）
const languageOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'ko', label: '한국어' },
  { value: 'fr-FR', label: 'Français (FR)' },
  { value: 'ja', label: '日本語' },
  { value: 'es-419', label: 'Español (LATAM)' },
  { value: 'de', label: 'Deutsch' },
]

// 选中的语言（持久化存储）
const selectedLanguage = computed({
  get: () => {
    return languageMode.value
  },
  set: async (newMode: string) => {
    if (newMode) {
      await setLanguage(newMode as LanguageMode)
      trackEvent.track('Plugin_Settings_Language', {
        mode: newMode,
        actualLanguage: currentLanguage.value, // 记录实际应用的基础语言代码
      })
    }
  },
})

// 用户信息状态
const isAuthenticated = ref(false)
const user = ref<User | null>(null)

// 获取用户头像
const getUserAvatar = computed(() => {
  return getUserAvatarUrl(user.value, null)
})

// 获取用户信息
const fetchUserInfo = async () => {
  try {
    // 获取用户信息
    const userResult = await browser.storage.local.get(STORAGE_KEY.USER)
    const userData = userResult[STORAGE_KEY.USER]
    isAuthenticated.value = !!userData
    user.value = userData
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}

// 监听存储变化
const handleStorageChange = (changes: any, area: string) => {
  if (area === 'local') {
    // 监听用户信息变化
    if (STORAGE_KEY.USER in changes) {
      const newUser = changes[STORAGE_KEY.USER].newValue
      isAuthenticated.value = !!newUser
      user.value = newUser
    }
  }
}

// 移除这个 watch，因为 selectedMode 的 setter 已经处理了模式设置

// 组件挂载时获取用户信息
onMounted(async () => {
  await fetchUserInfo()

  // 监听存储变化
  browser.storage.onChanged.addListener(handleStorageChange)
})

// 组件卸载时清理监听器
onUnmounted(() => {
  browser.storage.onChanged.removeListener(handleStorageChange)
})
</script>

<style scoped>
:global(.p-select-overlay) {
  --p-select-overlay-background: #fff;
  --p-select-option-selected-focus-background: #ecf5ff;
  --p-select-option-selected-background: transparent;
  --p-select-option-focus-background: #ecf5ff;
  --p-select-overlay-border-radius: 12px;
  --p-select-overlay-shadow: 0 0 24px 0 rgba(0, 0, 0, 0.16);
  @apply p-2 text-[14px] font-[400] leading-[20px] !mt-2 !border-none;
}

:global(.dark .p-select-overlay) {
  --p-select-overlay-background: #2f3543;
  --p-select-option-selected-focus-background: #324b68;
  --p-select-option-focus-background: #324b68;
}

:global(.p-select-overlay .p-select-option) {
  --p-select-option-selected-color: #111;
  --p-select-option-focus-color: #007aff;
  --p-select-option-selected-focus-color: #007aff;
  color: #111;
  @apply py-1;
}

:global(.dark .p-select-overlay .p-select-option) {
  --p-select-option-selected-color: #fff;
  --p-select-option-focus-color: #1d8eff;
  --p-select-option-selected-focus-color: #1d8eff;
  color: #fff;
}

:deep(._primevue_select.p-select) {
  @apply w-[162px] border-s-border-secondary dark:border-s-border-secondary-dark border;
  --p-select-background: transparent;
  --p-select-color: #111;
  --p-select-padding-y: 6px;
  --p-select-hover-border-color: #e6e8ea;
  --p-select-focus-border-color: #e6e8ea;
  @apply text-[14px] font-[400] leading-[20px];
}

:deep(.dark ._primevue_select.p-select) {
  --p-select-hover-border-color: #474c58;
  --p-select-focus-border-color: #474c58;
}

:global(.dark .p-select-label) {
  --p-select-color: #fff;
}

:deep(._primevue_select.p-select.p-select-open) {
  @apply bg-s-disable-bg dark:bg-s-disable-bg-dark;
}

:global(.p-select-list-container) {
  /* 滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #e6e8ea transparent;
}
:global(.dark .p-select-list-container) {
  /* 滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #474c58 transparent;
}
</style>
