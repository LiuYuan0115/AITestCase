<template>
  <!-- float btn container -->
  <div
    v-if="shouldDisplay"
    class="fixed right-0 w-10 flex flex-col gap-[10px] items-end"
    :class="[isOnboardingPage ? 'z-[100]' : 'z-[2147483652]']"
    :style="{ bottom: moveY + 'px' }"
  >
    <!-- 🔴 其他派隐藏 Solve All 按钮 -->
    <ShortCutTooltip
      v-if="isSidePanelSupported()"
      content="Solve this page"
      position="left"
      :disabled="isOnboardingPage"
      class="absolute w-8 right-1"
    >
      <template v-slot="{ onMouseenter, onMouseleave }">
        <div class="relative h-[32px] w-[32px]">
          <div
            class="relative z-50 cursor-pointer text-s-text-brand dark:text-s-text-brand-dark select-none flex items-center justify-center p-[5px] bg-s-interface-bg rounded-full border border-s-text-brand dark:border-s-text-brand-dark transition-colors duration-200 shadow-[0px_0px_24px_0px_rgba(0,0,0,0.16)]"
            @mouseenter="onMouseenter"
            @mouseleave="onMouseleave"
            @click="handleClickSolveAll"
          >
            <SvgIcon
              name="s"
              size="20"
              aria-hidden="true"
            />
          </div>
          <transition
            name="guide-fade"
            appear
          >
            <div
              class="absolute top-0 right-0 z-1000"
              v-if="shouldShowGuide"
            >
              <div
                class="p-[17px_24px_16px_16px] bg-[#007AFF] rounded-[16px] flex gap-3 items-center justify-center absolute top-[10px] right-[124px] w-[180px]"
              >
                <div class="text-[25px] leading-[26px]">😃</div>
                <div class="text-[20px] leading-[1.3] font-['Inter'] font-bold text-white text-nowrap">Click Here</div>
              </div>
              <SvgIcon
                name="onboarding/vector"
                size="66"
                aria-hidden="true"
                class="absolute top-[3px] right-[45px]"
              />
            </div>
          </transition>
        </div>
      </template>
    </ShortCutTooltip>

    <!-- cut btn -->
    <!-- 快捷键提示, 如果已经看到引导提示, 则不显示快捷键提示 -->
    <ShortCutTooltip
      :content="shortcutContent"
      position="left"
      :disabled="isOnboardingPage"
      class="absolute w-8 right-1"
    >
      <template v-slot="{ onMouseenter, onMouseleave }">
        <div class="relative h-[32px] w-[32px]">
          <div
            :class="[
              'relative z-50 cursor-pointer text-s-text-brand dark:text-s-text-brand-dark flex items-center justify-center p-[5px] bg-s-interface-bg rounded-full border border-s-text-brand dark:border-s-text-brand-dark shadow-[0px_0px_24px_0px_rgba(0,0,0,0.16)] transition-all duration-200 select-none',
              isOnboardingPage && !isboardingCompleted && isOnClickStage && !isClickSolveAll && isSidePanelSupported()
                ? 'opacity-20 pointer-events-none'
                : '',
            ]"
            @mouseenter="onMouseenter"
            @mouseleave="onMouseleave"
            @click="handleClickCut"
          >
            <SvgIcon
              name="cut"
              size="20"
              aria-hidden="true"
            />
            <transition
              name="guide-fade"
              appear
            >
              <div
                class="absolute top-0 right-0 z-1000"
                v-if="shouldShowGuide && !isSidePanelSupported()"
              >
                <div
                  class="p-[17px_24px_16px_16px] bg-[#007AFF] rounded-[16px] flex gap-3 items-center justify-center absolute top-[10px] right-[124px] w-[180px]"
                >
                  <div class="text-[25px] leading-[26px]">😃</div>
                  <div class="text-[20px] leading-[1.3] font-['Inter'] font-bold text-white text-nowrap">
                    Click Here
                  </div>
                </div>
                <SvgIcon
                  name="onboarding/vector"
                  size="66"
                  aria-hidden="true"
                  class="absolute top-[3px] right-[45px]"
                />
              </div>
            </transition>
          </div>
        </div>
      </template>
    </ShortCutTooltip>

    <!-- home btn -->
    <div class="relative right-0 w-10 h-10">
      <div
        :class="[
          'absolute bottom-0 h-[40px] w-[90px] cursor-pointer flex items-center justify-between gap-[12px] rounded-l-full bg-s-interface-bg dark:bg-s-disable-bg-dark p-[8px] pr-[18px] shadow-[0px_0px_24px_0px_rgba(0,0,0,0.16)] transition-all duration-200 group -right-[50px] hover:right-[0px] hover:bg-s-text-brand dark:hover:bg-s-text-brand-dark hover:delay-0',
          isOnboardingPage && !isboardingCompleted && isOnClickStage && !isClickSolveAll ? 'opacity-20' : '',
        ]"
        @mousedown="dragHandlers.startMove"
        @click.stop="handleHomeClick"
      >
        <img
          src="@/assets/images/logo.webp"
          alt="solvely-logo"
          class="w-[24px] h-[24px] pointer-events-none rounded-[6.55px] outline-[1.5px] outline-s-foundation-tertiary/50 dark:outline-s-foundation-tertiary-dark/50 outline select-none"
        />
        <div
          class="text-center text-s-text-high-emphasis-dark text-sm font-medium font-['Inter'] leading-relaxed select-none whitespace-nowrap"
        >
          {{ UserPlatform.isMacOs ? '⌘ + L' : 'Alt + L' }}
        </div>
        <SvgIcon
          name="float-btn-close"
          size="18"
          class="absolute -left-[7px] -top-[7px] transition-all duration-200 delay-300 rounded-full cursor-pointer opacity-0 invisible group-hover:visible group-hover:opacity-100 group-hover:delay-0 hover:opacity-100"
          @click.stop="handleClose"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, onUnmounted, ref, watch } from 'vue'
import type { DragState } from './types'
import { throttle } from 'lodash-es'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import ShortCutTooltip from '@/components/floatButtons/ShortCutTooltip.vue'
import { getTrpc } from '~/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'
import { UserPlatform } from '~/utils/platforms'
import { useSetting } from '@/composables/content/useSetting'
import { isSidePanelSupported } from '~/utils/common'
import { modalService } from '@/services/modal/closeModalService'
import { STORAGE_KEYS } from '~/types/config'
import { STORAGE_KEY } from '~/config'
import { disabledSiteManager } from '~/utils/disabledSites'

const isOnboardingPage = computed(() => {
  return window.location.href.split('?')[0] === import.meta.env.VITE_ONBOARDING_PAGE_URL
})

const isboardingCompleted = ref(false)
const isClickSolveAll = ref(false)
const isOnClickStage = ref(false)

// 排除一些页面
const shouldExcludePage = () => {
  const url = currentUrl.value
  const pathname = currentPathname.value
  const { hostname } = window.location

  return (
    hostname === 'accounts.google.com' ||
    hostname === 'appleid.apple.com' ||
    url.startsWith('https://www.facebook.com/login.php') ||
    hostname.endsWith('.firebaseapp.com') ||
    pathname === '/login-ext'
  )
}

// 状态管理
const dragState = reactive<DragState>({
  canMove: false,
  canClick: false,
  startY: 0,
  endY: 0,
  bottom: window.innerHeight / 2,
})

// 窗口状态管理 - 用于跟踪高度变化
const windowState = reactive({
  height: window.innerHeight,
})

const { isEnable: floatBtnIsEnable, closeInThisPage, closeInGlobal } = useSetting('float-btn')

// 禁用站点检查状态
const isSiteDisabled = ref(false)

// 响应式 URL 追踪，确保 shouldDisplay 能响应 URL 变化
const currentUrl = ref(window.location.href)
const currentPathname = ref(window.location.pathname)

// 清理函数引用
const cleanupUrlListener = ref<(() => void) | null>(null)

// 检查当前页面是否被禁用
const checkSiteDisabled = async () => {
  try {
    const url = window.location.href
    const disabled = await disabledSiteManager.isSiteDisabledAsync(url)
    isSiteDisabled.value = disabled
  } catch (error) {
    console.error('[FloatBtns] 检查禁用状态失败:', error)
    isSiteDisabled.value = false
  }
}

// 监听地址栏 URL 变化
const handleUrlChange = () => {
  // 更新响应式 URL 和 pathname，触发 shouldDisplay 重新计算
  currentUrl.value = window.location.href
  currentPathname.value = window.location.pathname
  checkSiteDisabled()
}

// 设置地址栏变化监听器
const setupUrlChangeListener = () => {
  let lastUrl = window.location.href

  // ===== 第一层：popstate 事件监听 =====
  // 监听浏览器前进/后退按钮和传统页面跳转
  // 这是最可靠的浏览器原生事件，适用于传统多页网站
  window.addEventListener('popstate', handleUrlChange)

  // ===== 第二层：pushState/replaceState 拦截 =====
  // 拦截 SPA 应用的路由变化，适用于现代单页应用
  // 如 React Router、Vue Router、Angular Router 等
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  // 拦截 pushState 方法（SPA 路由跳转）
  history.pushState = function (...args) {
    originalPushState.apply(history, args)
    // 延迟检查，确保 URL 已更新
    setTimeout(handleUrlChange, 0)
  }

  // 拦截 replaceState 方法（SPA 路由替换）
  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args)
    // 延迟检查，确保 URL 已更新
    setTimeout(handleUrlChange, 0)
  }

  // ===== 第三层：MutationObserver 备用监听 =====
  // 监听 DOM 变化作为备用机制，防止前两层遗漏
  // 确保在任何情况下都能捕获到地址栏变化
  const observer = new MutationObserver(() => {
    const newUrl = window.location.href
    if (newUrl !== lastUrl) {
      lastUrl = newUrl
      handleUrlChange()
    }
  })

  // 监听整个 document 的变化
  observer.observe(document, {
    subtree: true, // 监听所有子节点变化
    childList: true, // 监听子节点增删变化
  })

  // 返回清理函数，确保组件卸载时清理所有监听器
  return () => {
    // 清理第一层：popstate 事件监听
    window.removeEventListener('popstate', handleUrlChange)
    // 清理第二层：恢复原始的 pushState/replaceState 方法
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    // 清理第三层：断开 MutationObserver 连接
    observer.disconnect()
  }
}

// 计算属性: 最终的显示状态由多个因素共同决定
const shouldDisplay = computed(() => {
  return !shouldExcludePage() && floatBtnIsEnable.value && !isSiteDisabled.value
})

// 监听引导页面进入 click 阶段
const handleOnboardingClickStage = (event: MessageEvent) => {
  if (event.data?.type === 'ONBOARDING_CLICK_STAGE') {
    isOnClickStage.value = true
    console.log('[FloatBtns] 进入引导 click 阶段')
  }
}

// 更新显示条件
const shouldShowGuide = computed(() => {
  return isOnboardingPage.value && !isboardingCompleted.value && isOnClickStage.value && !isClickSolveAll.value
})

// 监听引导 UI 显示状态变化
watch(
  shouldShowGuide,
  (isShowingNow, wasShowingBefore) => {
    // 从不显示变为显示时触发埋点
    if (isShowingNow && !wasShowingBefore) {
      console.log('Plugin_Newuser_Onboarding_Oneclick_Show')
      trackEvent.track('Plugin_Newuser_Onboarding_Oneclick_Show', {
        url: location.href,
      })
    }
  },
  { immediate: false }
)

const moveY = computed(() => {
  return dragState.startY - dragState.endY + dragState.bottom
})

// 快捷键文案
const shortcutContent = computed(() => {
  if (UserPlatform.isMacOs) {
    return 'Snap to solve Control + Shift + S'
  } else {
    return 'Snap to solve Alt + Shift + S'
  }
})

// Emits
const emits = defineEmits<{
  (e: 'toCut'): void
  (e: 'toSolveAll'): void
  (e: 'showGuideBorder'): void
  (e: 'showUserPanel'): void
}>()

// 存储相关方法
const storage = {
  // 保存浮动按钮位置, 在网页域的 local storage 中
  saveBottomPosition(value: string) {
    localStorage.setItem('solvely_plugin_float_btn_position', value)
  },
  // 获取浮动按钮位置
  getBottomPosition() {
    return localStorage.getItem('solvely_plugin_float_btn_position')
  },
}

// 计算垂直居中位置
const calculateCenterPosition = () => {
  const buttonHeight = 82 // 按钮容器高度
  return (window.innerHeight - buttonHeight) / 2
}

// 拖拽相关方法
const dragHandlers = {
  startMove(e: MouseEvent) {
    dragState.startY = e.clientY
    dragState.endY = e.clientY
    document.addEventListener('mousemove', dragHandlers.move)
    document.addEventListener('mouseup', dragHandlers.end)
    dragState.canMove = true
  },

  move(e: MouseEvent) {
    if (dragState.canMove) {
      dragState.endY = Math.max(
        dragState.startY - window.innerHeight + 102 + dragState.bottom,
        Math.min(dragState.startY + dragState.bottom - 20, e.clientY)
      )
    }
  },

  end() {
    dragState.bottom = moveY.value
    dragState.canClick = Math.abs(dragState.startY - dragState.endY) < 5
    dragState.startY = 0
    dragState.endY = 0
    document.removeEventListener('mousemove', dragHandlers.move)
    document.removeEventListener('mouseup', dragHandlers.end)
    storage.saveBottomPosition(dragState.bottom.toString())
    dragState.canMove = false

    // 更新当前窗口高度记录（用户手动拖拽后同步）
    windowState.height = window.innerHeight
  },
}

// 点击主站按钮
const handleHomeClick = () => {
  if (dragState.canClick) {
    trackEvent.track('Plugin_solvely')
    if (!isSidePanelSupported()) {
      // 发送显示用户面板事件
      emits('showUserPanel')
    } else {
      chrome.runtime.sendMessage({
        type: SidepanelEventType.TOGGLE,
      })
    }
  }
}

// 点击截图按钮
const handleClickCut = () => {
  // 如果是 Onboarding 页面且未完成，通知父组件显示引导遮罩
  if (isOnboardingPage.value && !isboardingCompleted.value && isOnClickStage.value && !isSidePanelSupported()) {
    emits('showGuideBorder')
    trackEvent.track('Plugin_Onboarding_Screenshot_Click')
  }
  emits('toCut')
  trackEvent.track('Plugin_screenshot_click')
}

// 点击 Solve All 按钮
const handleClickSolveAll = () => {
  if (isOnClickStage.value) {
    // 如果是在点击阶段，则设置为true，否则都不设置，以避免其他页面去点击
    isClickSolveAll.value = true
  }

  if (isOnboardingPage.value) {
    window.dispatchEvent(new Event('clickSolveAll'))

    // 在引导阶段触发埋点
    if (isOnClickStage.value && !isboardingCompleted.value) {
      trackEvent.track('Plugin_Newuser_Onboarding_Oneclick_Click', {
        url: location.href,
      })
      console.log('Plugin_Newuser_Onboarding_Oneclick_Click')
    }
  }

  emits('toSolveAll')
  trackEvent.track('Plugin_Sidebar_OneClick_Solve', {
    url: location.href,
  })
}

// 弹窗相关方法
// 点击悬浮球左上角关闭按钮, 打开确认浮窗
const handleClose = (e: MouseEvent) => {
  // 定义 FloatBtns 专用的关闭选项
  // 如果不支持侧边栏，只保留 "Disable until next visit" 选项
  const floatBtnCloseOptions = isSidePanelSupported()
    ? [
        {
          label: 'Disable until next visit',
          value: 'next-visit',
        },
        {
          label: 'Disable on this page',
          value: 'this-page',
        },
        {
          label: 'Disable on this website',
          value: 'this-website',
        },
        {
          label: 'Disable globally',
          value: 'global',
        },
      ]
    : [
        {
          label: 'Disable until next visit',
          value: 'next-visit',
        },
      ]

  const content = isSidePanelSupported() ? 'You can re-enable in settings' : ''
  modalService.showModal({
    title: 'Disable',
    content: content,
    onConfirm: handleModalConfirm,
    onCancel: handleModalCancel,
    customOptions: floatBtnCloseOptions,
  })
  trackEvent.track('Plugin_Disable_show', {
    from: 'sidebar',
    comment: '窗口右侧悬浮按钮关闭触发',
  })
}
// 点击弹窗取消按钮
const handleModalCancel = () => {
  trackEvent.track('Plugin_Disable_cancel', {
    from: 'sidebar',
  })
}
// 点击弹窗确认按钮
const handleModalConfirm = async (confirmValue: string) => {
  trackEvent.track('Plugin_Disable_confirm', {
    from: 'sidebar',
    confirmValue,
  })

  if (confirmValue === 'next-visit') {
    closeInThisPage()
  } else if (confirmValue === 'global') {
    closeInGlobal()
  } else if (confirmValue === 'this-page') {
    // 禁用当前页面
    const currentUrl = window.location.href
    await disabledSiteManager.addDisabledSite(currentUrl, 'page')
    console.log(`[FloatBtns] 已禁用当前页面: ${currentUrl}`)

    // 发送禁用埋点
    trackEvent.track('Plugin_Sidebar_FloatBtn_Disabled', {
      type: 'page',
      url: currentUrl,
    })
  } else if (confirmValue === 'this-website') {
    // 禁用当前网站
    const currentUrl = window.location.href
    const domain = disabledSiteManager.getDomainFromUrl(currentUrl)
    await disabledSiteManager.addDisabledSite(domain, 'website')
    console.log(`[FloatBtns] 已禁用当前网站: ${domain}`)

    // 发送禁用埋点
    trackEvent.track('Plugin_Sidebar_FloatBtn_Disabled', {
      type: 'website',
      url: domain,
    })
  }
}

// 调整位置，确保按钮不超出视口
const adjustPositionInViewport = () => {
  // 确保按钮至少有102px在视口内可见
  const minBottom = 102
  const maxBottom = window.innerHeight - 102
  // 限制bottom值在合理范围内
  dragState.bottom = Math.max(minBottom, Math.min(maxBottom, dragState.bottom))
  // 保存新位置到本地存储
  storage.saveBottomPosition(dragState.bottom.toString())
}

// resize事件处理函数 - 只在高度变化时居中
const handleResize = throttle(() => {
  const currentHeight = window.innerHeight
  const previousHeight = windowState.height

  // 只有高度发生变化时才调整位置
  if (currentHeight !== previousHeight) {
    // 高度变化，将按钮居中
    dragState.bottom = calculateCenterPosition()

    // 应用边界保护
    adjustPositionInViewport()

    // 更新记录的窗口高度
    windowState.height = currentHeight
  }
  // 如果只是宽度变化，不做任何调整
}, 100)

// 生命周期钩子
onMounted(async () => {
  // 初始化窗口高度记录
  windowState.height = window.innerHeight

  // 初始化响应式 URL 和 pathname
  currentUrl.value = window.location.href
  currentPathname.value = window.location.pathname

  // 初始化浮窗显示的位置
  const bottomValue = storage.getBottomPosition()
  if (bottomValue) {
    dragState.bottom = Number(bottomValue)
  } else {
    // 如果没有保存的位置，默认居中
    dragState.bottom = calculateCenterPosition()
  }

  // 初始化时确保位置在视口内
  adjustPositionInViewport()

  // 添加resize事件监听
  window.addEventListener('resize', handleResize)

  // 检查当前页面是否被禁用
  await checkSiteDisabled()

  // 设置 URL 变化监听器
  cleanupUrlListener.value = setupUrlChangeListener()

  // 监听禁用站点存储变化
  browser.storage.onChanged.addListener((changes: any, area: string) => {
    if (area === 'local' && changes[STORAGE_KEY.FLOAT_BUTTON_DISABLED_SITES]) {
      checkSiteDisabled()
    }
  })

  // 添加引导阶段消息监听
  if (isOnboardingPage.value && !isboardingCompleted.value) {
    window.addEventListener('message', handleOnboardingClickStage)
  }

  if (isOnboardingPage.value) {
    const { onboardingCompleted } = await browser.storage.local.get(STORAGE_KEYS.ONBOARDING_COMPLETED)
    isboardingCompleted.value = onboardingCompleted
    if (!onboardingCompleted) {
      browser.storage.onChanged.addListener((changes: any, area: string) => {
        if (area === 'local' && changes[STORAGE_KEYS.ONBOARDING_COMPLETED]) {
          isboardingCompleted.value = changes[STORAGE_KEYS.ONBOARDING_COMPLETED].newValue || false
        }
      })
    }
  }
})

// 组件卸载时清理监听器
onUnmounted(() => {
  // 移除resize事件监听
  window.removeEventListener('resize', handleResize)

  // 移除存储监听器
  browser.storage.onChanged.removeListener((changes: any, area: string) => {
    if (area === 'local' && changes[STORAGE_KEY.FLOAT_BUTTON_DISABLED_SITES]) {
      checkSiteDisabled()
    }
  })

  // 执行清理函数
  if (cleanupUrlListener.value) {
    cleanupUrlListener.value()
  }

  // 移除引导阶段消息监听
  window.removeEventListener('message', handleOnboardingClickStage)
})
</script>

<style scoped>
.solveTips {
  width: 288px;
  height: 125px;
  background: url('@/assets/images/onboarding/oneclick-step.webp') 0 0 no-repeat;
  background-size: 100% 100%;
  position: absolute;
  top: -19px;
  right: 27px;
  z-index: 9;
}

/* 引导提示渐显动画 */
.guide-fade-enter-active {
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
  transition-delay: 0.4s;
}

.guide-fade-leave-active {
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
  transition-delay: 0s;
}

.guide-fade-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(-10px);
}

.guide-fade-enter-to {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.guide-fade-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.guide-fade-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-10px);
}
</style>
