<template>
  <div
    class="min-h-screen flex min-w-[1024px] bg-s-interface-bg dark:bg-s-interface-bg-dark duration-200 transition-all"
  >
    <!-- 登录面板 -->
    <template v-if="!isAuthenticated">
      <LoginPanel />
    </template>
    <template v-else>
      <!-- 侧边栏 -->
      <Sidebar
        :active-tab="activeTab"
        :menu-items="menuItems"
        @navigate="navigateToSection"
      />

      <!-- 主内容区域 -->
      <div
        class="flex-1 p-6 pb-8 bg-s-interface-bg dark:bg-s-interface-bg-dark h-screen overflow-y-auto duration-200 transition-all"
      >
        <component :is="currentTab.component" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, provide } from 'vue'
import Sidebar from './components/Sidebar.vue'
import GeneralSettings from './components/GeneralSettings.vue'
import SidebarSettings from './components/SidebarSettings.vue'
import WebAssistantSettings from './components/WebAssistantSettings.vue'
import LoginPanel from './components/LoginPanel.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { STORAGE_KEY } from '~/config'
import type { User } from '~/types'
import useAuth from '../sidepanel/composables/useAuth'
import { AuthState } from '../sidepanel/types/auth'

// 使用暗黑模式中间件
const { isDark } = useDarkMode()

// 使用 auth composable
const auth = useAuth()

// 提供 auth 状态给子组件
provide<AuthState>('auth', auth)

// 监听暗黑模式变化，动态设置body的dark类
watch(
  isDark,
  (newValue) => {
    if (newValue) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  },
  { immediate: true }
)

// 用户认证状态 - 使用 auth composable 的状态
const isAuthenticated = auth.isAuthenticated
const user = ref<User | null>(null)

// 当前激活的标签页
const activeTab = ref('general')

// 菜单项配置
const menuItems = [
  {
    id: 'general',
    name: 'General',
    icon: 'options/general',
    component: GeneralSettings,
  },
  {
    id: 'sidebar',
    name: 'Sidebar',
    icon: 'options/sidebar',
    component: SidebarSettings,
  },
  {
    id: 'web-assistant',
    name: 'Web Assistant',
    icon: 'options/web-assistant',
    component: WebAssistantSettings,
  },
]

// 当前标签页信息
const currentTab = computed(() => {
  return menuItems.find((item) => item.id === activeTab.value) || menuItems[0]
})

// 从URL获取当前section
function getSectionFromURL(): string {
  const urlParams = new URLSearchParams(window.location.search)
  const section = urlParams.get('section')
  return section || 'general'
}

// 更新URL中的section参数
function updateURL(section: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('section', section)
  window.history.pushState({ section }, '', url.toString())
}

// 导航到指定section
function navigateToSection(section: string) {
  activeTab.value = section
  updateURL(section)
}

// 处理浏览器前进后退
function handlePopState(event: PopStateEvent) {
  const section = getSectionFromURL()
  activeTab.value = section
}

// 获取用户信息
const fetchUserInfo = async () => {
  try {
    const userResult = await browser.storage.local.get(STORAGE_KEY.USER)
    const userData = userResult[STORAGE_KEY.USER]
    // isAuthenticated 现在由 auth composable 管理，不需要手动设置
    user.value = userData
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}

// 监听存储变化
const handleStorageChange = (changes: any, area: string) => {
  if (area === 'local') {
    if (STORAGE_KEY.USER in changes) {
      const newUser = changes[STORAGE_KEY.USER].newValue
      // isAuthenticated 现在由 auth composable 管理，不需要手动设置
      user.value = newUser
    }
  }
}

// 处理登录成功 - 现在由 auth composable 统一处理
// const handleLoginSuccess = () => {
//   fetchUserInfo()
// }

// 初始化时从URL读取section
onMounted(async () => {
  // 获取用户信息
  await fetchUserInfo()

  // 监听存储变化
  browser.storage.onChanged.addListener(handleStorageChange)

  // 初始化URL导航
  const section = getSectionFromURL()
  activeTab.value = section

  // 监听浏览器前进后退
  window.addEventListener('popstate', handlePopState)

  // 如果URL中没有section参数，添加默认参数
  if (!window.location.search.includes('section=')) {
    updateURL('general')
  }
})

onUnmounted(() => {
  // 移除浏览器前进后退监听器
  window.removeEventListener('popstate', handlePopState)

  // 移除存储监听器
  browser.storage.onChanged.removeListener(handleStorageChange)
})
</script>

<style scoped>
/* 可以添加自定义样式 */
</style>
