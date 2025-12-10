<template>
  <div
    class="font-sans text-[14px]"
    :class="{ dark: isDark }"
  >
    <!-- 按钮 -->
    <button
      v-if="!isExpanded"
      @click="handleButtonClick"
      @mousedown.stop="onButtonDragStart"
      class="fixed top-[10px] right-[10px] z-[999999] text-white rounded-full w-12 h-12 font-[900] text-[24px] cursor-move select-none whitespace-nowrap min-w-fit bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 dark:from-cyan-600 dark:via-blue-600 dark:to-purple-600 shadow-lg hover:shadow-xl hover:opacity-90 transition-all duration-200"
      :class="{
        'transition-none': isDraggingBtn,
      }"
      :style="buttonStyle"
      title="调试工具（可拖拽）"
    >
      🥶
    </button>

    <!-- 面板 -->
    <div
      v-else
      ref="panelRef"
      @click.stop
      class="fixed top-[10px] right-[10px] z-[999999] w-[400px] max-h-[600px] bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-950/70 dark:via-gray-900/70 dark:to-gray-900/70 border border-white dark:border-gray-700/60 rounded-xl shadow-2xl backdrop-blur-sm flex flex-col overflow-hidden"
    >
      <div
        class="flex items-center justify-between px-4 py-3.5 border-b border-gray-200/50 dark:border-gray-800/80 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30"
      >
        <h3 class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <img
            src="@/assets/images/logo.webp"
            alt="solvely-logo"
            class="w-5 h-5 rounded"
          />
          <span>调试工具</span>
          <span
            @click.stop="toggleUserSource"
            class="px-2 py-0.5 text-xs font-medium rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/70 hover:scale-105 transition-all duration-100"
            :title="`点击切换来源: ${displaySource}`"
          >
            {{ displaySource }}
          </span>
        </h3>
        <div class="flex items-center gap-2">
          <!-- 主题切换：亮 / 自动 / 暗 -->
          <div
            class="flex items-center gap-1 bg-white/40 dark:bg-gray-800/60 rounded-md p-1 border border-gray-200/50 dark:border-gray-700/60 backdrop-blur"
          >
            <button
              class="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all duration-100 hover:scale-110"
              :class="
                currentMode === 'light'
                  ? 'bg-white/70 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300/60 dark:border-gray-600'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
              "
              @click.stop="setMode('light')"
              title="亮色"
            >
              🌅
            </button>
            <button
              class="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all duration-100 hover:scale-110"
              :class="
                currentMode === 'auto'
                  ? 'bg-white/70 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300/60 dark:border-gray-600'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
              "
              @click.stop="setMode('auto')"
              title="自动"
            >
              ♻️
            </button>
            <button
              class="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all duration-100 hover:scale-110"
              :class="
                currentMode === 'dark'
                  ? 'bg-white/70 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300/60 dark:border-gray-600'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
              "
              @click.stop="setMode('dark')"
              title="暗黑"
            >
              🌃
            </button>
          </div>
          <button
            @click.stop="togglePanel"
            class="w-7 h-7 rounded-md flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 bg-white/40 dark:bg-gray-800/60 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 border border-gray-200/50 dark:border-gray-700/60 transition-all duration-100 hover:scale-110"
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>
      <div class="p-4 overflow-y-auto flex-1 bg-gradient-to-b from-transparent to-gray-50/30 dark:to-gray-950/60">
        <!-- 操作面板 -->
        <div class="mb-4 p-4 rounded-xl bg-gradient-to-br from-blue-50/60 via-purple-50/40 to-pink-50/40 dark:from-blue-900/30 dark:via-purple-900/20 dark:to-pink-900/20 backdrop-blur-md border border-blue-200/50 dark:border-blue-700/50 shadow-md">
          <!-- 清空操作 -->
          <div class="mb-4">
            <div class="mb-2.5 flex items-center gap-2">
              <div class="h-1 w-1 rounded-full bg-orange-400 dark:bg-orange-500"></div>
              <span class="text-xs font-bold text-gray-700 dark:text-gray-300">清空</span>
            </div>
            <div class="flex gap-2">
              <button
                @click.stop="resetOnboarding"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-orange-600 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-[0.98] transition-all duration-100 ease-in-out"
              >
                <span class="text-sm">⏳️</span>
                <span>Onboarding</span>
              </button>
              <button
                @click.stop="clearSubscription"
                :disabled="clearSubscriptionLoading"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-orange-500/80 dark:bg-orange-600/60 hover:bg-orange-600 dark:hover:bg-orange-600/80 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-[0.98] transition-all duration-100 ease-in-out backdrop-blur-md border border-white/20 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <span class="text-sm">🗑️</span>
                <span>{{ clearSubscriptionLoading ? '清空中...' : '订阅' }}</span>
              </button>
              <button
                @click.stop="handleLogout"
                :disabled="logoutLoading"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-red-500/80 dark:bg-red-600/60 hover:bg-red-600 dark:hover:bg-red-600/80 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-[0.98] transition-all duration-100 ease-in-out backdrop-blur-md border border-white/20 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <span class="text-sm">🚪</span>
                <span>{{ logoutLoading ? '登出中...' : '登录' }}</span>
              </button>
            </div>
          </div>
          <!-- 获取信息 -->
          <div>
            <div class="mb-2.5 flex items-center gap-2">
              <div class="h-1 w-1 rounded-full bg-blue-400 dark:bg-blue-500"></div>
              <span class="text-xs font-bold text-gray-700 dark:text-gray-300">获取</span>
            </div>
            <div class="flex gap-2">
              <button
                @click.stop="copyUserEmail"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-blue-500/80 dark:bg-blue-600/60 hover:bg-blue-600 dark:hover:bg-blue-600/80 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-[0.98] transition-all duration-100 ease-in-out backdrop-blur-md border border-white/20 dark:border-white/10"
              >
                <span class="text-sm">📧</span>
                <span>邮箱</span>
              </button>
              <button
                @click.stop="copyDeviceId"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-indigo-500/80 dark:bg-indigo-600/60 hover:bg-indigo-600 dark:hover:bg-indigo-600/80 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-[0.98] transition-all duration-100 ease-in-out backdrop-blur-md border border-white/20 dark:border-white/10"
              >
                <span class="text-sm">🆔</span>
                <span>DeviceID</span>
              </button>
              <button
                @click.stop="copyPluginUuid"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-purple-500/80 dark:bg-purple-600/60 hover:bg-purple-600 dark:hover:bg-purple-600/80 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-[0.98] transition-all duration-100 ease-in-out backdrop-blur-md border border-white/20 dark:border-white/10"
              >
                <span class="text-sm">🔑</span>
                <span>UUID</span>
              </button>
            </div>
          </div>
        </div>
        <div
          v-if="loading"
          class="text-center text-gray-500 dark:text-gray-400 py-8"
        >
          <div class="text-2xl mb-2">⏳</div>
          <div>加载中...</div>
        </div>
        <div
          v-else-if="assignedExperiments.length === 0"
          class="text-center text-gray-500 dark:text-gray-400 py-8"
        >
          <div class="text-2xl mb-2">📭</div>
          <div>暂无实验组数据</div>
        </div>
        <div
          v-else
          class="flex flex-col space-y-2.5"
        >
          <div
            v-for="exp in assignedExperiments"
            :key="exp.id"
            @click.stop="toggleExperiment(exp.id, exp.value)"
            class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border-l-[3px] hover:shadow-md hover:scale-[1.02] transition-all duration-100 ease-in-out cursor-pointer"
            :class="{
              'bg-green-50/80 dark:bg-green-950/60 hover:bg-green-100 dark:hover:bg-green-900/70 border-green-500 dark:border-green-500': exp.value === 'Test',
              'bg-orange-50/80 dark:bg-orange-950/60 hover:bg-orange-100 dark:hover:bg-orange-900/70 border-orange-500 dark:border-orange-500': exp.value === 'Control'
            }"
          >
            <label
              class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[65%] flex items-center gap-1.5"
              :title="exp.id"
            >
              <span>{{ formatExperimentId(exp.id) }}</span>
            </label>
            <div class="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium">
              <span v-if="exp.value === 'Test'">🟩 Tst</span>
              <span v-else-if="exp.value === 'Control'">🟧 Ctl</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { STORAGE_KEY } from '@/config/storage'
import { STORAGE_KEYS } from '@/types/config'
import { useDarkMode } from '@/composables/useDarkMode'
import { getTrpc } from '~/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'
import { getPluginUuid } from '~/utils/pluginUuid'

const { isDark, setMode, currentMode } = useDarkMode()

type Experiment = {
  id: string
  value: string
}

const isExpanded = ref(false)
const loading = ref(true)
const experiments = ref<Experiment[]>([])
const panelRef = ref<HTMLElement | null>(null)
const logoutLoading = ref(false)
const clearSubscriptionLoading = ref(false)
const userSource = ref<string>('')

// 来源选项列表（按循环顺序）
const sourceOptions = ['', 'web', 'SEM', 'plugin', 'plugin_sem']

// 显示用的来源文本
const displaySource = computed(() => {
  return userSource.value || 'null'
})

// 点击外部关闭panel
const handleClickOutside = (event: MouseEvent) => {
  if (!isExpanded.value) return
  
  const target = event.target as Node
  if (panelRef.value && !panelRef.value.contains(target)) {
    // 检查是否点击的是触发按钮（通过查找按钮元素）
    const button = (event.target as HTMLElement).closest('button[title="调试工具（可拖拽）"]')
    if (button) {
      return
    }
    isExpanded.value = false
  }
}

// 监听panel展开状态，添加/移除点击外部监听器
watch(isExpanded, (newValue) => {
  if (newValue) {
    // 延迟添加监听器，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

// 过滤出已分配的实验组
const assignedExperiments = computed(() => {
  return experiments.value.filter((exp) => exp.value === 'Test' || exp.value === 'Control')
})

// 切换实验组（Test <-> Control）
const toggleExperiment = async (expId: string, currentValue: string) => {
  const newValue = currentValue === 'Test' ? 'Control' : 'Test'
  await updateExperiment(expId, newValue)
}

// 加载用户来源信息
const loadUserSource = async () => {
  try {
    const res = await browser.storage.local.get(STORAGE_KEY.USER)
    const user = res[STORAGE_KEY.USER]
    userSource.value = user?.source ?? ''
  } catch (e) {
    console.error('加载用户来源失败:', e)
    userSource.value = ''
  }
}

// 切换用户来源
const toggleUserSource = async () => {
  try {
    // 获取当前来源在列表中的索引，如果不在列表中则从空值开始
    const currentValue = userSource.value ?? ''
    let currentIndex = sourceOptions.indexOf(currentValue)
    if (currentIndex === -1) {
      currentIndex = 0 // 如果不在列表中，默认从空值开始
    }
    
    // 计算下一个索引（循环）
    const nextIndex = (currentIndex + 1) % sourceOptions.length
    const nextSource = sourceOptions[nextIndex]
    
    // 更新本地状态
    userSource.value = nextSource
    
    // 更新 storage 中的 user.source
    const res = await browser.storage.local.get(STORAGE_KEY.USER)
    const user = res[STORAGE_KEY.USER] || {}
    
    await browser.storage.local.set({
      [STORAGE_KEY.USER]: {
        ...user,
        source: nextSource,
      },
    })
    
    console.log('用户来源已切换为:', nextSource || 'null')
  } catch (e) {
    console.error('切换用户来源失败:', e)
  }
}

// 加载实验组数据
const loadExperiments = async () => {
  try {
    loading.value = true
    const res = await browser.storage.local.get(STORAGE_KEY.ABTEST_ASSIGNMENTS)
    const assignments = res[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}

    // 将对象转换为数组
    experiments.value = Object.keys(assignments).map((id) => ({
      id,
      value: assignments[id] || '',
    }))

    // 如果没有数据，显示空状态
    if (experiments.value.length === 0) {
      experiments.value = []
    }
  } catch (e) {
    console.error('加载AB测试数据失败:', e)
    experiments.value = []
  } finally {
    loading.value = false
  }
}

// 更新实验组
const updateExperiment = async (expId: string, value: string) => {
  try {
    // 读取当前数据
    const res = await browser.storage.local.get(STORAGE_KEY.ABTEST_ASSIGNMENTS)
    const assignments = res[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}

    // 更新值
    assignments[expId] = value

    // 保存到storage，handleStorageChange会自动更新本地状态
    await browser.storage.local.set({
      [STORAGE_KEY.ABTEST_ASSIGNMENTS]: assignments,
    })
  } catch (e) {
    console.error('更新AB测试数据失败:', e)
  }
}

// 重置Onboarding
const resetOnboarding = async () => {
  // 删除插件localStorage中的onboardingCompleted字段
  await browser.storage.local.remove(STORAGE_KEYS.ONBOARDING_COMPLETED)
  // 删除当前域名下sessionStorage中的isCompletedExtOnboarding
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('isCompletedExtOnboarding')
  }
}

// 复制用户邮箱
const copyUserEmail = async () => {
  try {
    const res = await browser.storage.local.get(STORAGE_KEY.USER)
    const user = res[STORAGE_KEY.USER]
    if (user?.email) {
      await navigator.clipboard.writeText(user.email)
      console.log('邮箱已复制:', user.email)
    } else {
      alert('未找到用户邮箱')
      console.warn('未找到用户邮箱')
    }
  } catch (e) {
    console.error('复制邮箱失败:', e)
  }
}

// 复制DeviceID
const copyDeviceId = async () => {
  try {
    const res = await browser.storage.local.get(STORAGE_KEY.USER)
    const user = res[STORAGE_KEY.USER]
    if (user?.deviceId) {
      await navigator.clipboard.writeText(user.deviceId)
      console.log('DeviceID已复制:', user.deviceId)
    } else {
      alert('未找到DeviceID')
      console.warn('未找到DeviceID')
    }
  } catch (e) {
    console.error('复制DeviceID失败:', e)
  }
}

// 复制Plugin UUID
const copyPluginUuid = async () => {
  try {
    const uuid = await getPluginUuid()
    if (uuid) {
      await navigator.clipboard.writeText(uuid)
      console.log('Plugin UUID已复制:', uuid)
    } else {
      alert('未找到Plugin UUID')
      console.warn('未找到Plugin UUID')
    }
  } catch (e) {
    console.error('复制Plugin UUID失败:', e)
  }
}

// 清空订阅
const clearSubscription = async () => {
  if (clearSubscriptionLoading.value) return
  
  try {
    clearSubscriptionLoading.value = true
    
    // 获取 deviceId 和 transactionId
    const [userRes, subscriptionRes] = await Promise.all([
      browser.storage.local.get(STORAGE_KEY.USER),
      browser.storage.local.get(STORAGE_KEY.SUBSCRIPTION),
    ])
    
    const user = userRes[STORAGE_KEY.USER]
    const subscription = subscriptionRes[STORAGE_KEY.SUBSCRIPTION]
    
    const deviceId = user?.deviceId
    
    // 处理订阅信息可能是数组或单个对象的情况
    let transactionId: string | undefined
    if (Array.isArray(subscription) && subscription.length > 0) {
      transactionId = subscription[0]?.transactionId
    } else if (subscription && typeof subscription === 'object') {
      transactionId = subscription.transactionId
    }
    
    if (!deviceId) {
      alert('未找到 DeviceID')
      console.warn('未找到 DeviceID')
      return
    }
    
    if (!transactionId) {
      alert('未找到 TransactionID')
      console.warn('未找到 TransactionID')
      return
    }
    
    console.log('开始清空订阅...', { deviceId, transactionId })
    
    // 调用 DELETE API
    const response = await fetch('https://utils.solvely.ai/account/subscription', {
      method: 'DELETE',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,ja;q=0.8,fr;q=0.7',
        'content-type': 'application/json',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
      },
      body: JSON.stringify({
        deviceId,
        transactionId,
      }),
      mode: 'cors',
      credentials: 'omit',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    console.log('清空订阅成功')
    alert('清空订阅成功')
  } catch (error) {
    console.error('清空订阅失败:', error)
    alert('清空订阅失败，请重试')
  } finally {
    clearSubscriptionLoading.value = false
  }
}

// 登出
const handleLogout = async () => {
  if (logoutLoading.value) return
  
  try {
    logoutLoading.value = true
    console.log('开始登出...')
    
    // 调用登出 API（与 Logined.vue 对齐）
    await getTrpc().logout.mutate()
    
    // 埋点（与 Logined.vue 对齐）
    trackEvent.track('Plugin_Sidebar_Logout')
    
    console.log('登出成功，刷新页面')
    
    // 在内容脚本环境中，登出成功后刷新页面以清除所有状态
    // 这与 sidepanel 环境不同，sidepanel 会调用 useSubscription.reset() 和 messageStore.clearMessages()
    window.location.reload()
  } catch (error) {
    console.error('登出失败:', error)
    alert('登出失败，请重试')
  } finally {
    logoutLoading.value = false
  }
}

// 处理storage变化
const formatExperimentId = (id: string) => id.replace(/^TEST_Plugin_/, '')

const handleStorageChange = (changes: any, area: string) => {
  if (area !== 'local') return
  if (STORAGE_KEY.ABTEST_ASSIGNMENTS in changes) {
    const newAssignments = changes[STORAGE_KEY.ABTEST_ASSIGNMENTS]?.newValue || {}
    experiments.value = Object.keys(newAssignments).map((id) => ({
      id,
      value: newAssignments[id] || '',
    }))
  }
  if (STORAGE_KEY.USER in changes) {
    const user = changes[STORAGE_KEY.USER]?.newValue
    userSource.value = user?.source ?? ''
  }
}

// 切换面板展开/收起
const togglePanel = () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    loadExperiments()
  }
}

// ========== 静态锚点方案（拖拽后吸附到锚点） ==========
type Anchor = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
const currentAnchor = ref<Anchor>('top-right')

// 锚点位置配置
const anchorPositions: Record<Anchor, (w: number, h: number) => { left: number; top: number }> = {
  'top-right': (w, h) => ({ left: window.innerWidth - w - 10, top: 10 }),
  'top-left': (w, h) => ({ left: 10, top: 10 }),
  'bottom-right': (w, h) => ({ left: window.innerWidth - w - 10, top: window.innerHeight - h - 10 }),
  'bottom-left': (w, h) => ({ left: 10, top: window.innerHeight - h - 10 }),
  'top-center': (w, h) => ({ left: (window.innerWidth - w) / 2, top: 10 }),
}

const btnLeft = ref<number | null>(null)
const btnTop = ref<number | null>(null)
const isDraggingBtn = ref(false)
let btnStartX = 0
let btnStartY = 0
let btnStartLeft = 0
let btnStartTop = 0
let btnElement: HTMLElement | null = null
let hasDragged = false

const buttonStyle = computed(() => {
  const baseStyle: Record<string, string> = {}
  if (btnLeft.value != null && btnTop.value != null) {
    baseStyle.left = `${btnLeft.value}px`
    baseStyle.top = `${btnTop.value}px`
    baseStyle.right = 'auto'
  }
  // 拖拽时禁用过渡，避免卡顿和样式冲突
  if (isDraggingBtn.value) {
    baseStyle.transition = 'none'
    baseStyle.pointerEvents = 'auto'
  }
  return Object.keys(baseStyle).length > 0 ? baseStyle : undefined
})

// 更新按钮位置到当前锚点
const updateToAnchor = (anchor: Anchor) => {
  if (!btnElement) return
  const rect = btnElement.getBoundingClientRect()
  const pos = anchorPositions[anchor](rect.width, rect.height)

  // 确保位置在窗口范围内，防止超出边界
  const maxLeft = Math.max(0, window.innerWidth - rect.width)
  const maxTop = Math.max(0, window.innerHeight - rect.height)

  btnLeft.value = Math.max(0, Math.min(pos.left, maxLeft))
  btnTop.value = Math.max(0, Math.min(pos.top, maxTop))
}

// 计算距离最近的锚点（使用按钮左上角坐标）
const findNearestAnchor = (left: number, top: number): Anchor => {
  if (!btnElement) return 'top-right'
  const rect = btnElement.getBoundingClientRect()
  let minDist = Infinity
  let nearest: Anchor = 'top-right'

  for (const [anchor, getPos] of Object.entries(anchorPositions)) {
    const pos = getPos(rect.width, rect.height)
    // 使用按钮左上角与锚点左上角的距离
    const dist = Math.sqrt(Math.pow(left - pos.left, 2) + Math.pow(top - pos.top, 2))
    if (dist < minDist) {
      minDist = dist
      nearest = anchor as Anchor
    }
  }
  return nearest
}

const onButtonDragStart = (e: MouseEvent) => {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  hasDragged = false
  isDraggingBtn.value = true
  btnStartX = e.clientX
  btnStartY = e.clientY
  btnElement = e.currentTarget as HTMLElement
  const rect = btnElement.getBoundingClientRect()
  btnStartLeft = btnLeft.value ?? rect.left
  btnStartTop = btnTop.value ?? rect.top
  btnLeft.value = btnStartLeft
  btnTop.value = btnStartTop
  window.addEventListener('mousemove', onButtonDragging)
  window.addEventListener('mouseup', onButtonDragEnd)
}

const onButtonDragging = (e: MouseEvent) => {
  if (!isDraggingBtn.value || !btnElement) return
  const dx = e.clientX - btnStartX
  const dy = e.clientY - btnStartY
  const moved = Math.abs(dx) > 5 || Math.abs(dy) > 5
  if (moved) {
    hasDragged = true
  }
  const rect = btnElement.getBoundingClientRect()
  const newLeft = btnStartLeft + dx
  const newTop = btnStartTop + dy
  btnLeft.value = Math.max(0, Math.min(window.innerWidth - rect.width, newLeft))
  btnTop.value = Math.max(0, Math.min(window.innerHeight - rect.height, newTop))
}

const onButtonDragEnd = (e?: MouseEvent) => {
  if (!isDraggingBtn.value || !btnElement) return
  window.removeEventListener('mousemove', onButtonDragging)
  window.removeEventListener('mouseup', onButtonDragEnd)

  if (hasDragged) {
    // 先恢复transition，然后吸附到最近的锚点（会有平滑动画）
    setTimeout(() => {
      isDraggingBtn.value = false
      // 确保获取最新的按钮位置和尺寸
      const rect = btnElement!.getBoundingClientRect()
      const currentLeft = btnLeft.value ?? rect.left
      const currentTop = btnTop.value ?? rect.top

      // 使用最新的窗口尺寸重新计算锚点位置
      const nearest = findNearestAnchor(currentLeft, currentTop)
      currentAnchor.value = nearest

      // 使用 requestAnimationFrame 确保在下一帧更新，此时过渡动画已恢复
      requestAnimationFrame(() => {
        updateToAnchor(nearest)
      })
    }, 10)
  } else {
    isDraggingBtn.value = false
  }
}

const handleButtonClick = () => {
  if (!hasDragged) {
    togglePanel()
  }
}

const handleResize = () => {
  if (!isDraggingBtn.value && btnElement && (btnLeft.value != null || btnTop.value != null)) {
    updateToAnchor(currentAnchor.value)
  }
}

onMounted(async () => {
  await loadUserSource()
  await loadExperiments()
  browser.storage.onChanged.addListener(handleStorageChange)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  browser.storage.onChanged.removeListener(handleStorageChange)
  window.removeEventListener('mousemove', onButtonDragging)
  window.removeEventListener('mouseup', onButtonDragEnd)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleClickOutside)
})
</script>
