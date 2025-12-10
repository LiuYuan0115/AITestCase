<template>
  <!-- float btn container -->
  <div
    class="fixed right-0"
    :class="[
      isOnboardingPage ? 'z-[100]' : 'z-[2147483652]',
      'h-[122px]',
    ]"
    :style="{ bottom: moveY + 'px' }"
    v-show="shouldDisplay"
  >
    <ShortCutTooltip
      content="Solve this page"
      position="left"
      :disabled="isOnboardingPage"
    >
      <template v-slot="{ onMouseenter, onMouseleave }">
        <div :class="['relative right-[4px] h-[32px] w-[32px] mb-[10px]']">
          <div
            :class="[
              'relative z-1000 cursor-pointer text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200',
              'flex items-center justify-center p-[5px] bg-s-interface-bg',
              'rounded-full border border-s-text-brand dark:border-s-text-brand-dark shadow-[0px_0px_24px_0px_rgba(0,0,0,0.16)]',
              'transition-all duration-200 select-none',
            ]"
            @mouseenter="onMouseenter"
            @mouseleave="onMouseleave"
            @click="handleClickSolveAll"
          >
            <SvgIcon name="s" size="20" aria-hidden="true" />
          </div>
        </div>
      </template>
    </ShortCutTooltip>

    <!-- cut btn -->
    <!-- 快捷键提示 -->
    <ShortCutTooltip
      :content="shortcutContent"
      position="left"
    >
      <template v-slot="{ onMouseenter, onMouseleave }">
        <div :class="['relative right-[4px] h-[32px] w-[32px]']">
          <div
            :class="[
              'relative z-1000 cursor-pointer text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200',
              'flex items-center justify-center p-[5px] bg-s-interface-bg',
              'rounded-full border border-s-text-brand dark:border-s-text-brand-dark shadow-[0px_0px_24px_0px_rgba(0,0,0,0.16)]',
              'transition-all duration-200 select-none',
            ]"
            @mouseenter="onMouseenter"
            @mouseleave="onMouseleave"
            @click="handleClickCut"
          >
            <SvgIcon name="cut" size="20" aria-hidden="true" />
          </div>
        </div>
      </template>
    </ShortCutTooltip>

    <!-- home btn -->
    <div
      :class="[
        'absolute h-[40px] w-[90px] cursor-pointer ',
        'flex items-center justify-between gap-[12px]',
        'rounded-l-full bg-s-interface-bg dark:bg-s-disable-bg-dark p-[8px] pr-[18px]',
        'shadow-[0px_0px_24px_0px_rgba(0,0,0,0.16)] transition-all duration-200',
        'group -right-[50px] hover:right-[0px] hover:bg-s-text-brand dark:hover:bg-s-text-brand-dark hover:delay-0',
        isOnboardingPage && !isboardingCompleted ? 'opacity-20' : '',
        'top-[84px]',
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
      <!-- 关闭按钮，PDF内部不需要禁用 -->
      <!-- <SvgIcon
        name="float-btn-close"
        size="18"
        :class="[
          'absolute -left-[7px] -top-[7px]',
          'transition-all duration-200 delay-300',
          'rounded-full cursor-pointer',
          'opacity-0 invisible group-hover:visible group-hover:opacity-100 group-hover:delay-0 hover:opacity-100',
        ]"
        @click.stop="showCloseModal = true"
      /> -->
    </div>
  </div>

  <!-- 关闭确认Modal -->
  <PdfCloseModal
    :show="showCloseModal"
    title="Disable"
    content="You can re-enable in settings"
    @confirm="handleModalConfirm"
    @cancel="handleModalCancel"
  />

  <!-- 截图快捷键 -->
  <KeyBoard
    :keys="['ctrl', 'shift', 's']"
    :winKeys="['alt', 'shift', 's']"
    :toHomeKeys="['command', 'l']"
    :winToHomeKeys="['alt', 'l']"
    @trigger="handleShortcutScreenshot"
    @toHome="handleShortcutHome"
  />
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, onUnmounted, ref } from 'vue'
import type { DragState } from '@/components/floatButtons/types'
import { throttle } from 'lodash-es'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ShortCutTooltip from '@/components/floatButtons/ShortCutTooltip.vue'
import KeyBoard from '@/components/screenshot/KeyBoard.vue'
import { getTrpc } from '~/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'
import { UserPlatform } from '~/utils/platforms'
import { useSetting } from '@/composables/content/useSetting'
import PdfCloseModal from './PdfCloseModal.vue'
import { isSidePanelSupported } from '~/utils/common'
import { STORAGE_KEYS } from '~/types/config'

const isOnboardingPage = computed(() => {
  return (
    window.location.href.split('?')[0] ===
    import.meta.env.VITE_ONBOARDING_PAGE_URL
  )
})

const isboardingCompleted = ref(false)

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

const {
  isEnable: floatBtnIsEnable,
  closeInThisPage,
  closeInGlobal,
} = useSetting('float-btn')

// 关闭弹窗状态
const showCloseModal = ref(false)

// 计算属性: 最终的显示状态由三个因素共同决定：此处改成永远显示
const shouldDisplay = computed(() => true || floatBtnIsEnable.value)

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
    if (!isSidePanelSupported()) {
      try {
        getTrpc().goToSolvely.query('/home')
      } catch (error) { console.error(error)}
    } else {
      try {
        chrome.runtime.sendMessage({
          type: SidepanelEventType.TOGGLE,
        }).catch((error) => {
        })
      } catch (error) {
      }
    }
  }
}

// 点击截图按钮
const handleClickCut = () => {
  emits('toCut')
  try {
    trackEvent.track('Plugin_screenshot_click')
  } catch (error) {
    console.error(error)
  }
}

// 点击 Solve All 按钮
const handleClickSolveAll = () => {
  emits('toSolveAll')
  try {
    trackEvent.track('Plugin_Sidebar_OneClick_Solve', {
      url: location.href,
    })
  } catch (error) {
    console.error(error)
  }
}

// 快捷键截图处理
const handleShortcutScreenshot = () => {
  emits('toCut')
  try {
    trackEvent.track('Plugin_screenshot_shortcut')
  } catch (error) {
    console.error(error)
  }
}

// 快捷键主页处理
const handleShortcutHome = () => {
  if (dragState.canClick) {
    if (!isSidePanelSupported()) {
      try {
        getTrpc().goToSolvely.query('/home')
      } catch (error) { console.error(error)}
    } else {
      try {
        chrome.runtime.sendMessage({
          type: SidepanelEventType.TOGGLE,
        }).catch((error) => {
        })
      } catch (error) {
      }
    }
  }
}

// 关闭弹窗回调
const handleModalConfirm = (value: 'next-visit' | 'global') => {
  if (value === 'next-visit') {
    closeInThisPage()
  } else if (value === 'global') {
    closeInGlobal()
  }
  showCloseModal.value = false
}
const handleModalCancel = () => showCloseModal.value = false

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
}, 100)

// 生命周期钩子
onMounted(async () => {
  // 初始化窗口高度记录
  windowState.height = window.innerHeight

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

  if (isOnboardingPage.value) {
    try {
      const { onboardingCompleted } = await browser.storage.local.get(
        STORAGE_KEYS.ONBOARDING_COMPLETED
      )
      isboardingCompleted.value = onboardingCompleted
      if (!onboardingCompleted) {
        browser.storage.onChanged.addListener((changes: any, area: string) => {
          if (area === 'local' && changes[STORAGE_KEYS.ONBOARDING_COMPLETED]) {
            isboardingCompleted.value =
              changes[STORAGE_KEYS.ONBOARDING_COMPLETED].newValue || false
          }
        })
      }
    } catch (error) { console.error(error) }
  }
})

// 组件卸载时清理监听器
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>