<template>
  <div
    ref="panelRef"
    :style="panelStyle"
    :class="[
      'bg-b_1 dark:bg-b_1_dk overflow-hidden relative rounded-[24px] shadow-[0px_0px_16px_0px_rgba(120,118,128,0.16)] w-[360px] flex flex-col',
      user ? 'h-[240px]' : 'h-[318px]',
    ]"
    @click="handlePanelClick"
    @mousedown="handlePanelMouseDown"
  >
    <!-- 拖拽手柄 - 独占一行 -->
    <div
      class="h-[16px] flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing shrink-0"
      @mousedown="handleDragMouseDown"
    >
      <i class="h-0.5 w-[14px] bg-d_1 dark:bg-d_1_dk rounded-full mt-[7px] color-transition"></i>
      <i class="h-0.5 w-[14px] bg-d_1 dark:bg-d_1_dk rounded-full color-transition"></i>
    </div>

    <!-- 顶部 Logo -->
    <div class="h-[27.5px] mb-[12.5px] px-4 flex items-center shrink-0 text-t_1 dark:text-t_1_dk color-transition">
      <div class="flex items-center gap-[2px]">
        <LogoIcon class="shrink-0" />
        <SolvelyAiIcon class="shrink-0" />
      </div>
    </div>

    <!-- 未登录状态 -->
    <template v-if="!user">
      <div class="flex flex-col gap-[8px] items-center mx-4 flex-1 min-h-0">
        <!-- 闪电图标和文本 -->
        <div class="flex gap-[2px] items-center justify-center shrink-0 w-full">
          <img
            :src="lightningIcon"
            class="w-[20px] h-[20px] shrink-0"
            alt="Lightning icon"
          />
          <div
            class="font-['Inter'] font-bold text-[16px] text-t_1 dark:text-t_1_dk leading-[1.3] whitespace-nowrap color-transition"
          >
            Screenshot for an instant answer
          </div>
        </div>
        <!-- 截图示例图片 -->
        <div class="bg-b_1 dark:bg-b_1_dk h-[164px] overflow-hidden relative rounded-[8px] shrink-0 w-full">
          <img
            src="@/assets/images/login/login-function.webp"
            class="w-full h-full object-cover opacity-90"
            alt="Screenshot example"
          />
        </div>
      </div>
    </template>

    <!-- 已登录状态：用户信息卡片 -->
    <div
      v-else
      class="bg-b_panel dark:bg-b_panel_dk box-border flex gap-[12px] mx-4 p-[12px] rounded-[12px] flex-1 min-h-0 h-[116px]"
    >
      <!-- 左侧：头像 -->
      <div class="flex items-start shrink-0 justify-center">
        <img
          :src="getUserAvatar"
          class="size-[40px] rounded-full object-cover"
          alt="User avatar"
        />
      </div>

      <!-- 右侧：所有信息 -->
      <div class="flex flex-col gap-[12px] flex-1 min-w-0">
        <!-- 用户名和邮箱以及登出按钮 -->
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-0 flex-1 min-w-0 h-[40px]">
            <div
              class="font-['Inter'] font-bold text-[16px] text-t_1 dark:text-t_1_dk leading-[1.3] w-[190px] truncate"
            >
              {{ user?.userName || 'User' }}
            </div>
            <div
              class="font-['Inter'] font-normal text-[14px] text-t_3 dark:text-t_3_dk leading-[1.4] w-[190px] truncate"
            >
              {{ user?.email || '' }}
            </div>
          </div>

          <button
            @click="handleLogOut"
            :disabled="logoutLoading"
            class="font-['Inter'] font-medium text-[14px] text-t_brand dark:text-t_brand_dk leading-[1.4] whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed color-transition"
          >
            Log out
          </button>
        </div>

        <!-- 分割线 -->
        <div class="h-[2px] relative shrink-0 w-full">
          <div class="absolute bottom-0 left-0 right-0 top-0 bg-d_1 dark:bg-d_1_dk"></div>
        </div>

        <!-- 订阅状态或免费解决次数 -->
        <div class="flex items-center justify-between h-[26px]">
          <!-- 有订阅：显示 Unlimited Solver 徽章 -->
          <div
            v-if="hasSolverSubscription"
            class="flex items-center gap-[4px]"
          >
            <UnlimitedIcon class="w-[16px] h-[16px]" />
            <div class="font-['Inter'] font-medium text-[14px] text-t_2 dark:text-t_2_dk whitespace-nowrap">
              Unlimited Solver
            </div>
          </div>

          <!-- 无订阅：显示免费解决次数和升级按钮 -->
          <template v-else>
            <div class="font-['Inter'] font-medium text-[14px] text-t_1 dark:text-t_1_dk">
              <span>Free Solves Left: </span>
              <span class="text-t_brand dark:text-t_brand_dk font-medium">{{ freeSolvesLeft }}</span>
            </div>
            <button
              @click="handleUpgrade"
              class="bg-b_iap_1 dark:bg-b_iap_1_dk box-border flex gap-[2px] items-center justify-center px-[13px] h-[26px] rounded-[6px] shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div
                class="font-['Inter'] font-bold text-[14px] text-t_iap_btn dark:text-t_iap_btn_dk text-center whitespace-nowrap"
              >
                Upgrade
              </div>
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="h-[68px] flex items-center px-[16px] shrink-0">
      <div class="content-stretch flex gap-[12px] h-[36px] items-center w-full">
        <!-- 未登录状态：显示 Login 按钮 -->
        <button
          v-if="!user"
          @click="handleLogin"
          class="bg-b_brand dark:bg-b_brand_dk flex-[1_0_0] h-[36px] min-h-px min-w-px relative rounded-[28px] shrink-0 cursor-pointer hover:bg-b_brand_hov dark:hover:bg-b_brand_hov_dk transition-colors color-transition"
        >
          <div
            class="box-border flex gap-[4px] h-[36px] items-center justify-center px-[24px] py-[16px] relative rounded-[inherit] w-full"
          >
            <div
              class="font-['Inter'] font-bold text-[16px] text-t_btn dark:text-t_btn_dk leading-[1.3] text-center whitespace-nowrap color-transition"
            >
              Login
            </div>
          </div>
        </button>
        <!-- 已登录状态：显示 Go to Solvely.ai 按钮 -->
        <button
          v-else
          @click="handleGoToSolvely"
          class="bg-b_1 dark:bg-b_1_dk border border-d_1 dark:border-d_1_dk border-solid flex-[1_0_0] h-[36px] min-h-px min-w-px relative rounded-[100px] shrink-0 cursor-pointer hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk transition-colors"
        >
          <div
            class="box-border flex gap-[6px] h-[36px] items-center justify-center px-[24px] py-[15px] relative rounded-[inherit] w-full"
          >
            <LogoIcon class="shrink-0 w-[16px] h-[16px]" />
            <div
              class="leading-[1.4] flex flex-col font-['Inter'] font-medium justify-center not-italic relative shrink-0 text-[16px] text-t_1 dark:text-t_1_dk text-center whitespace-nowrap"
            >
              Go to Solvely.ai
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { throttle } from 'lodash-es'
import LogoIcon from '@/assets/icons/logo.svg'
import SolvelyAiIcon from '@/assets/icons/solvelyAi.svg'
import UnlimitedIcon from '@/assets/icons/business/unlimited.svg'
import { getUserAvatarUrl } from '@/utils/userAvatar'
import { getTrpc } from '@/lib/trpc/client'
import type { User, Subscriptions, UserBalance } from '@/types'
import lightningIcon from '@/assets/images/popup/no-login-lighting-icon.webp'
import screenshotImage from '@/assets/images/popup/no-login-screenshot-image.webp'
import trackEvent from '@/utils/trackEvent'
import useSolveLayer from '@/composables/useSolveLayer'
import usePaywall from '@/composables/usePaywall'

interface UserPanelProps {
  user?: User | null
  subscriptions?: Subscriptions | null
  userBalance?: UserBalance | null
}

const props = withDefaults(defineProps<UserPanelProps>(), {
  user: null,
  subscriptions: null,
  userBalance: null,
})

// 定义 emits
const emits = defineEmits<{
  (e: 'close'): void
}>()

// 面板引用
const panelRef = ref<HTMLElement | null>(null)

// 拖拽相关状态
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
let dragStartMousePos = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }

// 计算面板样式
const panelStyle = computed(() => {
  return {
    position: 'fixed' as const,
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    zIndex: 2147483646,
  }
})

// 约束位置在窗口范围内
const constrainToWindow = (x: number, y: number) => {
  if (!panelRef.value) return { x, y }

  const rect = panelRef.value.getBoundingClientRect()
  const maxX = document.documentElement.clientWidth - rect.width
  const maxY = window.innerHeight - rect.height

  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

// 检查并调整位置（如果超出边界则重置）
const checkAndAdjustPosition = () => {
  if (!panelRef.value) return

  const rect = panelRef.value.getBoundingClientRect()
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  const panelWidth = rect.width
  const panelHeight = rect.height

  let newX = position.value.x
  let newY = position.value.y

  // 如果右侧超出，重置为贴右侧
  if (position.value.x + panelWidth > windowWidth) {
    newX = windowWidth - panelWidth
  }

  // 如果底部超出，重置为贴底部
  if (position.value.y + panelHeight > windowHeight) {
    newY = windowHeight - panelHeight
  }

  // 如果位置发生变化，更新位置
  if (newX !== position.value.x || newY !== position.value.y) {
    const constrained = constrainToWindow(newX, newY)
    position.value = constrained
  }
}

// 节流的窗口大小变化处理函数
const throttledCheckPosition = throttle(checkAndAdjustPosition, 150)

// 处理鼠标移动
const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  // 计算鼠标移动的距离
  const deltaX = e.clientX - dragStartMousePos.x
  const deltaY = e.clientY - dragStartMousePos.y

  // 基于拖拽开始时的偏移量，叠加鼠标移动距离
  const newPosition = {
    x: dragStartOffset.x + deltaX,
    y: dragStartOffset.y + deltaY,
  }

  // 约束在窗口范围内
  const constrained = constrainToWindow(newPosition.x, newPosition.y)
  position.value = constrained
}

// 处理鼠标释放
const handleMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 处理拖拽手柄的 mousedown 事件
const handleDragMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation() // 阻止事件冒泡，防止触发外部点击关闭

  // 记录鼠标按下时的位置（相对于视口）
  dragStartMousePos = { x: e.clientX, y: e.clientY }
  // 记录当前的偏移量
  dragStartOffset = { x: position.value.x, y: position.value.y }

  // 启动拖拽
  isDragging.value = true

  // 添加文档级别的监听器（确保鼠标移出元素时仍能拖拽）
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 处理面板内部点击，阻止冒泡到外部点击处理
const handlePanelClick = (e: MouseEvent) => {
  e.stopPropagation()
}

// 处理面板内部 mousedown，阻止冒泡到外部点击处理
const handlePanelMouseDown = (e: MouseEvent) => {
  e.stopPropagation()
}

// 获取用户头像
const getUserAvatar = computed(() => {
  return getUserAvatarUrl(props.user, null)
})

// 检查是否有 solver 订阅
const hasSolverSubscription = computed(() => {
  return props?.subscriptions?.some((s) => s.subscriptionType === 'solver' && Date.now() < s.expireTimestamp) ?? false
})

// 计算免费解决次数
const freeSolvesLeft = computed(() => {
  return props.userBalance?.plugin ?? 0
})

// 处理跳转到 Solvely.ai
const handleGoToSolvely = () => {
  trackEvent.track('Plugin_NewPanel_Go_Website')
  getTrpc().goToSolvely.query('/home')
}

// 处理登录按钮点击
const handleLogin = async () => {
  trackEvent.track('Plugin_NewPanel_Login_Click')

  try {
    await getTrpc().goToLogin.query()
    // 登录后关闭面板
    emits('close')
  } catch (error) {
    console.error('打开登录窗口失败:', error)
  }
}

// 获取解题浮层单例
const solveLayer = useSolveLayer()

// 使用 Paywall 单例
const paywall = usePaywall()

// 处理升级按钮点击
const handleUpgrade = () => {
  trackEvent.track('Plugin_Sidebar_Upgrade_Click', {
    from: 'page'
  })
  paywall.show({
    from: 'UserPanel',
  })
}

// 登出加载状态
const logoutLoading = ref(false)

// 处理登出
const handleLogOut = async () => {
  trackEvent.track('Plugin_NewPanel_Logout_Click')
  if (logoutLoading.value) return

  try {
    logoutLoading.value = true
    await getTrpc().logout.mutate()
    // 重置解题浮层状态
    solveLayer.resetLayer()
    // 登出成功后关闭面板
    emits('close')
  } catch (error) {
    console.error('登出失败:', error)
  } finally {
    logoutLoading.value = false
  }
}

// 面板是否刚显示（用于防止立即关闭）
const isJustShown = ref(false)

// 处理点击外部关闭面板
const handleClickOutside = (e: MouseEvent) => {
  // 如果正在拖拽，不关闭面板
  if (isDragging.value || !panelRef.value || isJustShown.value) return

  // 检查点击是否在面板外部
  if (!panelRef.value.contains(e.target as Node)) {
    emits('close')
  }
}

// 组件挂载后初始化位置
onMounted(() => {
  nextTick(() => {
    if (panelRef.value) {
      // 计算贴顶部和右侧的位置
      const panelWidth = panelRef.value.offsetWidth || 360
      const initialX = window.innerWidth - panelWidth
      const initialY = 0

      // 应用约束（确保在窗口范围内）
      const initialPos = constrainToWindow(initialX, initialY)
      position.value = initialPos
    }
  })

  trackEvent.track('Plugin_NewPanel_Settings')

  // 延迟上报 Upgrade 按钮展示埋点
  setTimeout(() => {
    // 检查是否有 Upgrade 按钮显示（用户已登录且没有订阅）
    if (props.user && !hasSolverSubscription.value) {
      trackEvent.track('Plugin_Sidebar_Upgrade_Show', {
        from: 'page'
      })
    }
  }, 5000)

  // 监听窗口大小变化
  window.addEventListener('resize', throttledCheckPosition)

  // 标记面板刚显示，延迟一段时间后允许关闭
  isJustShown.value = true
  setTimeout(() => {
    isJustShown.value = false
  }, 100)

  // 监听点击外部事件（延迟添加，避免立即触发）
  nextTick(() => {
    document.addEventListener('mousedown', handleClickOutside)
  })
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('resize', throttledCheckPosition)
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<style scoped>
/* 可以添加自定义样式 */
</style>
