<template>
  <div v-if="visible" class="setting-popup-panel">
    <div class="panel-content">
      <!-- <img src="@/assets/images/rectangle.webp" class="panel-arrow-up" /> -->
      <!-- 设置项列表 -->
      <div class="settings-list">
        <!-- Sidebar 开关 -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Sidebar</span>
          </div>
          <ToggleSwitch
            v-model="settings.floatButton"
            @toggle="toggleSidebar"
          />
        </div>

        <!-- Auto-Detect Button 开关 -->
        <!-- <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Auto-Detect Button</span>
          </div>
          <ToggleSwitch v-model="settings.autoDetectButton" />
        </div> -->

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Popup Panel</span>
          </div>
          <ToggleSwitch
            v-model="settings.popupPanel"
            @toggle="togglePopupPanel"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">YouTube Panel</span>
          </div>
          <ToggleSwitch
            v-model="settings.youtubePanel"
            @toggle="toggleYoutubePanel"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">ChatGPT Compare</span>
          </div>
          <ToggleSwitch
            v-model="settings.chatgptButton"
            @toggle="toggleChatgptButton"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Quizlet-AI Quiz Button</span>
          </div>
          <ToggleSwitch
            v-model="settings.quizletButton"
            @toggle="toggleQuizletButton"
          />
        </div>

        <!-- 悬浮划词 -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Quick Action</span>
          </div>
          <ToggleSwitch
            v-model="settings.textSelectionEnabled"
            @toggle="toggleTextSelectionToolbar"
          />
        </div>

        <!-- slide-select 开关 -->
        <!-- <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Select-Toolbar</span>
          </div>
          <ToggleSwitch v-model="settings.selectToolbar" />
        </div> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, onUnmounted, watch } from 'vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'
import { STORAGE_KEY } from '~/config'
import trackEvent from '~/utils/trackEvent'

const visible = defineModel<boolean>('visible')

// 设置状态
const settings = reactive({
  floatButton: true,
  autoDetectButton: true,
  popupPanel: true,
  selectToolbar: true,
  youtubePanel: true,
  chatgptButton: true,
  quizletButton: true,
  textSelectionEnabled: true,
})

// 从存储中加载设置
const loadSettings = async () => {
  try {
    const result = await browser.storage.local.get([
      STORAGE_KEY.FLOAT_BTN_ENABLED,
      STORAGE_KEY.AUTO_DETECT_ENABLED,
      STORAGE_KEY.SELECT_TOOLBAR_ENABLED,
      STORAGE_KEY.SIDEBAR_POPUP_PANEL_ENABLED,
      STORAGE_KEY.YOUTUBE_PANEL_ENABLED,
      STORAGE_KEY.CHATGPT_BTN_ENABLED,
      STORAGE_KEY.QUIZLET_BTN_ENABLED,
      //新增
      STORAGE_KEY.TEXT_SELECTION_ENABLED,
    ])

    settings.floatButton = result[STORAGE_KEY.FLOAT_BTN_ENABLED] ?? true
    settings.autoDetectButton = result[STORAGE_KEY.AUTO_DETECT_ENABLED] ?? true
    settings.selectToolbar = result[STORAGE_KEY.SELECT_TOOLBAR_ENABLED] ?? true
    settings.popupPanel =
      result[STORAGE_KEY.SIDEBAR_POPUP_PANEL_ENABLED] ?? true
    settings.youtubePanel = result[STORAGE_KEY.YOUTUBE_PANEL_ENABLED] ?? true
    settings.chatgptButton = result[STORAGE_KEY.CHATGPT_BTN_ENABLED] ?? true
    settings.quizletButton = result[STORAGE_KEY.QUIZLET_BTN_ENABLED] ?? true
    settings.textSelectionEnabled = result[STORAGE_KEY.TEXT_SELECTION_ENABLED] ?? true
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 保存设置到存储
const saveSettings = async () => {
  try {
    await browser.storage.local.set({
      [STORAGE_KEY.FLOAT_BTN_ENABLED]: settings.floatButton,
      [STORAGE_KEY.AUTO_DETECT_ENABLED]: settings.autoDetectButton,
      [STORAGE_KEY.SELECT_TOOLBAR_ENABLED]: settings.selectToolbar,
      [STORAGE_KEY.SIDEBAR_POPUP_PANEL_ENABLED]: settings.popupPanel,
      [STORAGE_KEY.YOUTUBE_PANEL_ENABLED]: settings.youtubePanel,
      [STORAGE_KEY.CHATGPT_BTN_ENABLED]: settings.chatgptButton,
      [STORAGE_KEY.QUIZLET_BTN_ENABLED]: settings.quizletButton,
      //新增
      [STORAGE_KEY.TEXT_SELECTION_ENABLED]: settings.textSelectionEnabled,
    })
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}

// 监听设置变化并自动保存
watch(settings, saveSettings, { deep: true })

// 点击外部关闭弹窗
const handleOutsideClick = (event: MouseEvent) => {
  const popupEl = document.querySelector('.setting-popup-panel')
  if (popupEl && !popupEl.contains(event.target as Node)) {
    visible.value = false
  }
}

// 监听 storage 变化并更新 settings
const handleStorageChange = (changes: any, areaName: string) => {
  if (areaName === 'local') {
    if (changes[STORAGE_KEY.FLOAT_BTN_ENABLED]) {
      settings.floatButton =
        changes[STORAGE_KEY.FLOAT_BTN_ENABLED].newValue ?? true
    }
    if (changes[STORAGE_KEY.AUTO_DETECT_ENABLED]) {
      settings.autoDetectButton =
        changes[STORAGE_KEY.AUTO_DETECT_ENABLED].newValue ?? true
    }
    if (changes[STORAGE_KEY.SELECT_TOOLBAR_ENABLED]) {
      settings.selectToolbar =
        changes[STORAGE_KEY.SELECT_TOOLBAR_ENABLED].newValue ?? true
    }
    if (changes[STORAGE_KEY.SIDEBAR_POPUP_PANEL_ENABLED]) {
      settings.popupPanel =
        changes[STORAGE_KEY.SIDEBAR_POPUP_PANEL_ENABLED].newValue ?? true
    }
    if (changes[STORAGE_KEY.YOUTUBE_PANEL_ENABLED]) {
      settings.youtubePanel =
        changes[STORAGE_KEY.YOUTUBE_PANEL_ENABLED].newValue ?? true
    }
    if (changes[STORAGE_KEY.CHATGPT_BTN_ENABLED]) {
      settings.chatgptButton =
        changes[STORAGE_KEY.CHATGPT_BTN_ENABLED].newValue ?? true
    }
    if (changes[STORAGE_KEY.QUIZLET_BTN_ENABLED]) {
      settings.quizletButton =
        changes[STORAGE_KEY.QUIZLET_BTN_ENABLED].newValue ?? true
    }
    if (changes[STORAGE_KEY.TEXT_SELECTION_ENABLED]) {
      settings.textSelectionEnabled = changes[STORAGE_KEY.TEXT_SELECTION_ENABLED].newValue ?? true
    }
  }
}

// 监听 visible 变化，当变为 true 时重新加载设置
watch(visible, (newValue) => {
  if (newValue) {
    loadSettings()
  }
})

function toggleSidebar() {
  trackEvent.track('Plugin_settings_sidebar')
}

function togglePopupPanel() {
  trackEvent.track('Plugin_settings_popuppanel')
}

function toggleYoutubePanel() {
  trackEvent.track('Plugin_settings_youtubePanel')
}

function toggleChatgptButton() {
  trackEvent.track('Plugin_settings_chatgptbutton')
}

function toggleQuizletButton() {
  trackEvent.track('Plugin_settings_quizletbutton')
}

function toggleTextSelectionToolbar() {
  // trackEvent.track('Plugin_settings_textSelectionToolbar')
}

onMounted(() => {
  // 添加点击外部关闭弹窗
  document.addEventListener('click', handleOutsideClick)
  // 添加 storage 变化监听器
  browser.storage.onChanged.addListener(handleStorageChange)
  loadSettings()
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  // 移除 storage 变化监听器
  browser.storage.onChanged.removeListener(handleStorageChange)
})
</script>

<style scoped>
.setting-popup-panel {
  position: absolute;
  top: 55px;
  right: 16px;
  width: 220px;
  @apply bg-s-interface-bg dark:bg-s-interface-bg-dark transition-colors duration-200;
  @apply border border-s-border dark:border-s-border-dark transition-colors duration-200;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 100;
}

.panel-content {
  padding: 16px;
  position: relative;
}

.panel-arrow-up {
  position: absolute;
  top: -7px;
  right: 44px;
  transform: translateX(-50%);
  width: 14px;
  height: 7px;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.setting-label {
  font-size: 14px;
  font-weight: 400;
  @apply text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200;
  line-height: 140%;
  font-style: normal;
}
</style>
