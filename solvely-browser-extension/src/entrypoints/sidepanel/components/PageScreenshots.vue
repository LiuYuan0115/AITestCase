<template>
  <Dialog
    v-model:visible="dialogVisible"
    :modal="true"
    :draggable="false"
    :resizable="false"
    @hide="handleDialogClose"
    class="w-[300px] !border-none !bg-white dark:!bg-s-bg-panel-dark"
    :style="{
      '--p-dialog-header-padding': '16px 12px 12px',
      '--p-dialog-content-padding': '0 20px 16px',
    }"
  >
    <template #header>
      <div
        class="flex-1 pl-[16px] text-center text-emph-1 dark:text-emph-1-dark text-[18px] font-bold leading-[1.3]"
      >
        Solve this page
      </div>
    </template>

    <template #closebutton>
      <span
        class="text-s-text-disabled-label dark:text-s-text-disabled-label-dark"
      >
        <SvgIcon
          name="sidepanel/close"
          class="w-[16px] h-[16px] cursor-pointer"
          @click="handleCloseButtonClick"
      /></span>
    </template>

    <!-- 进行中状态 -->
    <div v-if="showProgress">
      <!-- 进度条 -->
      <div
        class="text-emph-1 dark:text-emph-1-dark text-[14px] text-center leading-[1.3]"
      >
        <span>Reading</span>
      </div>
      <div
        class="w-full bg-s-panel-bg dark:bg-s-bg-secondary rounded-full h-[4px] my-[9px]"
      >
        <div
          class="bg-primary h-[4px] rounded-full transition-all duration-300"
          :style="{ width: `${screenshotState.progress.percentage}%` }"
        />
      </div>
      <div
        class="text-center text-[12px] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark leading-[1.3]"
      >
        Page may auto‑scroll—please don’t interrupt.
      </div>
    </div>

    <!-- 成功状态 -->
    <div v-else-if="screenshotState.status === ScreenshotStatus.SUCCESS">
      <div
        class="text-emph-1 dark:text-emph-1-dark text-[14px] text-center leading-[1.3]"
      >
        <span>Page catured</span>
      </div>
      <div class="mt-[6px] flex justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="34"
          height="34"
          viewBox="0 0 34 34"
          fill="none"
        >
          <rect width="34" height="34" rx="17" fill="#40C700" />
          <path
            d="M10 16.4286L14.3333 22L24 13"
            stroke="white"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>
  </Dialog>
  <Toast ref="toastRef" :duration="2000" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Dialog from 'primevue/dialog'
import {
  usePageScreenshotSingleton,
  ScreenshotStatus,
} from '../composables/usePageScreenshot'
import SidepanelEventType from '../types/eventTypes'
import SvgIcon from '@/components/common/SvgIcon.vue'
import Toast from './Toast.vue'
import trackEvent from '@/utils/trackEvent'
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

// ===== 状态管理 =====

const screenshotComposable = usePageScreenshotSingleton()
const screenshotState = computed(() => screenshotComposable.getStateSnapshot())

// 弹窗控制
const dialogVisible = ref(false)
const isProcessingCancel = ref(false)

// ===== 计算属性 =====

const showProgress = computed(() => {
  return [
    ScreenshotStatus.PREPARING,
    ScreenshotStatus.CAPTURING,
    ScreenshotStatus.PROCESSING,
  ].includes(screenshotState.value.status)
})

const canShowConfirmButton = computed(() => {
  return [
    ScreenshotStatus.SUCCESS,
    ScreenshotStatus.FAILED,
    ScreenshotStatus.INTERRUPTED,
  ].includes(screenshotState.value.status)
})

// ===== 状态监听 =====

// 监听截图状态变化，控制弹窗显示
watch(
  () => screenshotState.value.status,
  async (newStatus) => {
    if (
      [
        ScreenshotStatus.IDLE,
        ScreenshotStatus.INTERRUPTED,
        ScreenshotStatus.FAILED,
      ].includes(newStatus)
    ) {
      dialogVisible.value = false
    } else if (!dialogVisible.value) {
      // 截图进行中的状态显示弹窗
      dialogVisible.value = true
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      trackEvent.track('Plugin_Sidebar_OneClick_Pupup_Show', {
        url: tab.url,
      })
    }
    if (newStatus === ScreenshotStatus.SUCCESS) {
      trackEvent.track('Plugin_Sidebar_OneClick_Pupup_Captured', {
        url: screenshotState.value?.tab?.url,
      })
    }
  },
  { immediate: true }
)

// ===== 截图守卫（监听标签切换/关闭并中断） =====

const capturingTabId = ref<number | null>(null)
const isGuardActive = ref(false)
const hasNotifiedCancel = ref(false)

let onActivatedHandler:
  | ((activeInfo: chrome.tabs.TabActiveInfo) => void)
  | null = null
let onRemovedHandler: ((tabId: number) => void) | null = null
let onFocusChangedHandler: ((windowId: number) => void) | null = null

const notifyUserCanceledOnce = () => {
  if (hasNotifiedCancel.value) return
  toastRef.value?.show('User canceled')
  hasNotifiedCancel.value = true
}

const restoreOverlayForCapturingTab = async () => {
  try {
    if (capturingTabId.value != null) {
      await browser.tabs.sendMessage(capturingTabId.value, {
        type: SidepanelEventType.RESTORE_PAGE_AFTER_SCREENSHOT,
      })
    }
  } catch {}
}

const startCaptureGuard = async () => {
  if (isGuardActive.value) return
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    capturingTabId.value = tab?.id ?? null
  } catch {
    capturingTabId.value = null
  }

  onActivatedHandler = async (activeInfo: chrome.tabs.TabActiveInfo) => {
    if (!capturingTabId.value) return
    if (activeInfo.tabId !== capturingTabId.value) {
      await restoreOverlayForCapturingTab()
      if (screenshotComposable.canAbort.value) {
        screenshotComposable.abortCaptureWithReason('guard')
      }
      stopCaptureGuard()
    }
  }

  onRemovedHandler = (tabId: number) => {
    if (!capturingTabId.value) return
    if (tabId === capturingTabId.value) {
      if (screenshotComposable.canAbort.value) {
        screenshotComposable.abortCaptureWithReason('guard')
      }
      stopCaptureGuard()
    }
  }

  onFocusChangedHandler = async () => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (capturingTabId.value && tab?.id !== capturingTabId.value) {
        await restoreOverlayForCapturingTab()
        if (screenshotComposable.canAbort.value) {
          screenshotComposable.abortCaptureWithReason('guard')
        }
        stopCaptureGuard()
      }
    } catch {}
  }

  browser.tabs.onActivated.addListener(onActivatedHandler)
  browser.tabs.onRemoved.addListener(onRemovedHandler as any)
  browser.windows.onFocusChanged.addListener(onFocusChangedHandler)
  isGuardActive.value = true
  hasNotifiedCancel.value = false
}

const stopCaptureGuard = () => {
  if (!isGuardActive.value) return
  try {
    if (onActivatedHandler)
      browser.tabs.onActivated.removeListener(onActivatedHandler)
    if (onRemovedHandler)
      browser.tabs.onRemoved.removeListener(onRemovedHandler as any)
    if (onFocusChangedHandler)
      browser.windows.onFocusChanged.removeListener(onFocusChangedHandler)
  } catch {}
  onActivatedHandler = null
  onRemovedHandler = null
  onFocusChangedHandler = null
  isGuardActive.value = false
  capturingTabId.value = null
}

// 监听状态变化以启动/停止守卫，并在失败/中断时提示
watch(
  () => screenshotState.value.status,
  async (newStatus, oldStatus) => {
    // 进入准备阶段时启动守卫
    if (newStatus === ScreenshotStatus.PREPARING && !isGuardActive.value) {
      await startCaptureGuard()
    }

    // 失败或中断时提示并清理守卫
    if (
      newStatus === ScreenshotStatus.FAILED ||
      (newStatus === ScreenshotStatus.INTERRUPTED &&
        screenshotState.value.lastAbortReason === 'guard')
    ) {
      notifyUserCanceledOnce()
      stopCaptureGuard()
    }

    // 成功或返回空闲时，停止守卫
    if (
      newStatus === ScreenshotStatus.SUCCESS ||
      newStatus === ScreenshotStatus.IDLE
    ) {
      stopCaptureGuard()
    }
  }
)

// ===== 事件处理 =====

const handleCloseButtonClick = () => {
  // 直接调用中断，状态变化会自动隐藏弹窗
  if (screenshotComposable.isCapturing.value) {
    screenshotComposable.abortCaptureWithReason('user')
  } else {
    // 如果不在截图中，直接重置状态
    screenshotComposable.resetState()
  }
}

const handleCancelClick = async () => {
  if (!screenshotComposable.canAbort.value) {
    return
  }

  isProcessingCancel.value = true

  try {
    if (screenshotComposable.isCapturing.value) {
      screenshotComposable.abortCaptureWithReason('user')
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } catch (error) {
    console.error('Failed to cancel screenshot:', error)
  } finally {
    isProcessingCancel.value = false
  }
}

const handleConfirmClick = () => {
  console.log('User clicked confirm button')

  // 重置状态，状态变化会自动隐藏弹窗
  screenshotComposable.resetState()
}

const handleDialogClose = () => {
  console.log('Dialog closed')

  // 如果是在截图进行中被其他方式关闭，则取消截图
  if (screenshotComposable.isCapturing.value) {
    screenshotComposable.abortCapture()
  }

  // 对于已完成状态，重置以便下次使用
  if (
    [
      ScreenshotStatus.SUCCESS,
      ScreenshotStatus.FAILED,
      ScreenshotStatus.INTERRUPTED,
    ].includes(screenshotState.value.status)
  ) {
    screenshotComposable.resetState()
  }
}

// ===== 键盘事件处理 =====

const handleKeydown = (event: KeyboardEvent) => {
  if (!dialogVisible.value) return

  // ESC键取消截图
  if (event.key === 'Escape' && screenshotComposable.canAbort.value) {
    event.preventDefault()
    handleCancelClick()
  }

  // Enter键确认
  if (event.key === 'Enter' && canShowConfirmButton.value) {
    event.preventDefault()
    handleConfirmClick()
  }
}

// ===== 生命周期 =====

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  console.log('PageScreenshots component mounted')
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  console.log('PageScreenshots component unmounted')
  stopCaptureGuard()
})
</script>
