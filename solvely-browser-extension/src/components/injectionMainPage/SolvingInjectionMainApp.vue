<template>
  <div
    id="solvely-main-app-root"
    class="visible"
    :class="{ dark: isDark }"
  >
    <FloatBtns
      @toCut="openCut"
      @toSolveAll="handleClickSolveAll"
      @showGuideBorder="shouldShowGuideBorder = true"
      @showUserPanel="handleShowUserPanel"
      v-show="!isShowScreenshot && !hideFloatBtnsForScreenshot"
    />
    <Screenshot
      ref="screenshotRef"
      @toSolve="handleClickSolve"
      @toSummarize="handleClickSummarize"
      @toQuiz="handleClickQuiz"
      @toChat="handleClickChat"
      @close="closeScreenshot"
    />
    <AiButton v-if="isSidePanelSupported()" />
    <CloseModal />
    <PageScreenshotController
      v-model:hideFloatBtns="hideFloatBtnsForScreenshot"
      v-model:hideSolveLayer="hideSolveLayerForScreenshot"
    />
    <!-- 0.5.5不支持 sidePanel 的浏览器显示用户面板 -->
    <UnsupportedSidePanel
      v-if="!isSidePanelSupported()"
      ref="unsupportedSidePanelRef"
      v-model:show="showUserPanel"
    />
    <!-- 0.5.5兼容没有侧边栏 引导遮罩层：中间透明，四周遮罩，带虚线边框和圆角 -->
    <transition name="guide-overlay-fade">
      <div
        v-if="shouldShowGuideBorder"
        class="guide-overlay"
      >
        <!-- 高亮区域：使用 box-shadow 创建四周遮罩效果 -->
        <div class="guide-highlight-border"></div>
        <div class="guide-highlight-box">
          <transition
            name="guide-fade"
            appear
          >
            <div class="absolute top-[180px] left-[20px] z-max">
              <div
                class="p-[17px_24px_16px_16px] bg-[#007AFF] rounded-[16px] flex gap-3 items-center justify-center absolute top-[10px] right-[124px] w-[220px]"
              >
                <div class="text-[25px] leading-[26px]">✂️</div>
                <div class="text-[20px] leading-[1.3] font-['Inter'] font-bold text-white text-nowrap">
                  Select your<br />
                  question area
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
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import FloatBtns from '~/components/floatButtons/FloatBtns.vue'
import Screenshot from '~/components/screenshot/index.vue'
import EVENT from '~/utils/event'
import trackEvent from '~/utils/trackEvent'
import AiButton from '~/components/AiButton.vue'
import CloseModal from '~/components/common/CloseModal.vue'
import { modalService } from '~/services/modal/closeModalService'
import { isSidePanelSupported } from '~/utils/common'
import PageScreenshotController from '@/components/PageScreenshotController.vue'
import { STORAGE_KEY } from '~/config'
import { useDarkMode } from '@/composables/useDarkMode'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useSolveAllExtractor } from '~/composables/content/useSolveAllExtractor'
import { SOLVE_ALL_EVENTS } from '@/types/events'
import { checkIsSubscribedFromStorage } from '@/utils/user'
import UnsupportedSidePanel from '@/components/unsupportedSidePanel/index.vue'

const { isDark } = useDarkMode()

const userExtendInfo = ref<{
  abTestTags?: string[]
} | null>(null)

// 监听扩展存储变化
const handleStorageChange = (changes: any, areaName: string) => {
  if (areaName === 'local') {
    if (changes[STORAGE_KEY.USER_EXTEND_INFO]) {
      userExtendInfo.value = changes[STORAGE_KEY.USER_EXTEND_INFO].newValue
    }
  }
}

onMounted(async () => {
  try {
    const result = await browser.storage.local.get([STORAGE_KEY.USER_EXTEND_INFO])
    if (result[STORAGE_KEY.USER_EXTEND_INFO]) {
      userExtendInfo.value = result[STORAGE_KEY.USER_EXTEND_INFO]
    }
    // 监听扩展存储变化
    browser.storage.onChanged.addListener(handleStorageChange)
  } catch (error) {
    console.error('Failed to initialize dark mode:', error)
  }
})

// 24小时节流的元素嗅探与上报逻辑
onMounted(async () => {
  try {
    const { [STORAGE_KEY.SNIFFING_LAST_CHECK_AT]: lastCheckAt } = await browser.storage.local.get([
      STORAGE_KEY.SNIFFING_LAST_CHECK_AT,
    ])

    const DAY_MS = 24 * 60 * 60 * 1000
    if (typeof lastCheckAt === 'number' && Date.now() - lastCheckAt < DAY_MS) {
      return
    }

    setTimeout(async () => {
      try {
        const isQB = document.documentElement.hasAttribute('data-qb-installed')
        const isGr = !!document.querySelector('grammarly-desktop-integration')
        const isSider = !!document.querySelector('chatgpt-sidebar')
        const isMonica = document.body.hasAttribute('monica-id')
        const isBetterCanvas = !!document.querySelector('bettercanvas-todo-list')
        const isTaskCanvas = !!document.querySelector('#tfc-wall-rose')
        const isSubscribed = await checkIsSubscribedFromStorage()

        trackEvent.track('Plugin_Sniff_Elements', {
          isQB,
          isGr,
          isSider,
          isMonica,
          isBetterCanvas,
          isTaskCanvas,
          isSubscribed,
        })

        console.log('Plugin_Sniff_Elements', {
          isQB,
          isGr,
          isSider,
          isMonica,
          isBetterCanvas,
          isTaskCanvas,
          isSubscribed,
        })

        await browser.storage.local.set({
          [STORAGE_KEY.SNIFFING_LAST_CHECK_AT]: Date.now(),
        })
      } catch (err) {
        console.error('Sniffing elements check failed:', err)
      }
    }, 5000)
  } catch (error) {
    console.error('Init sniffing check failed:', error)
  }
})

// meet.google.com 专用：每日检测 html 是否含有 tactiq-lang
onMounted(async () => {
  try {
    if (window.location.hostname !== 'meet.google.com') {
      return
    }

    const { [STORAGE_KEY.MEET_SNIFFING_LAST_CHECK_AT]: meetLastCheckAt } = await browser.storage.local.get([
      STORAGE_KEY.MEET_SNIFFING_LAST_CHECK_AT,
    ])

    const DAY_MS = 24 * 60 * 60 * 1000
    if (typeof meetLastCheckAt === 'number' && Date.now() - meetLastCheckAt < DAY_MS) {
      return
    }

    setTimeout(async () => {
      try {
        const isTactiqMeet = document.documentElement.hasAttribute('tactiq-lang')
        const isSubscribed = await checkIsSubscribedFromStorage()

        trackEvent.track('Plugin_Sniff_Elements', {
          isTactiqMeet,
          isSubscribed,
        })

        await browser.storage.local.set({
          [STORAGE_KEY.MEET_SNIFFING_LAST_CHECK_AT]: Date.now(),
        })
      } catch (err) {
        console.error('Meet sniffing check failed:', err)
      }
    }, 15000)
  } catch (error) {
    console.error('Init meet sniffing check failed:', error)
  }
})

onUnmounted(() => {
  try {
    // 移除存储监听器
    browser.storage.onChanged.removeListener(handleStorageChange)
  } catch (error) {
    console.error('Failed to remove listeners:', error)
  }
})

// 点击解题, 按钮, emit 出来的是截图的图片数据
interface SolveImageData {
  canvas: HTMLCanvasElement
  cutDataUrl: string
}

// 组件引用
const screenshotRef = ref<InstanceType<typeof Screenshot> | null>(null)
const isShowScreenshot = ref(false)
// 截图期间隐藏浮动按钮
const hideFloatBtnsForScreenshot = ref(false)
// 整页截图期间隐藏 solveLayer
const hideSolveLayerForScreenshot = ref(false)

// 引导遮罩相关状态
const shouldShowGuideBorder = ref(false)

// UnsupportedSidePanel 引用
const unsupportedSidePanelRef = ref<InstanceType<typeof UnsupportedSidePanel> | null>(null)

// 用户面板显示状态
const showUserPanel = ref(false)

// 处理显示用户面板
const handleShowUserPanel = () => {
  showUserPanel.value = true
}

// 监听整页截图状态，派发事件给 solveLayer
watch(hideSolveLayerForScreenshot, (newValue) => {
  if (newValue) {
    window.dispatchEvent(new Event('solvely-page-screenshot-suspend'))
  } else {
    window.dispatchEvent(new Event('solvely-page-screenshot-resume'))
  }
})

// 当前面板状态
const currentImageData = ref<SolveImageData | null>(null)

// 使用 Solve All 提取器组合式函数
const { handleSolveAllExtraction } = useSolveAllExtractor()

const handleMessage = (message: any, sender: any, sendResponse: any) => {
  switch (message.type) {
    // 新增：解题一键解题的onboarding流程
    case SidepanelEventType.DISPATCH_ONBOARDING_EVENT:
      window.dispatchEvent(new Event('onboarding_oneClick'))
      break

    case SidepanelEventType.SHOW_SCREENSHOT:
      screenshotRef.value?.toShow()
      isShowScreenshot.value = true
      break

    case SidepanelEventType.CANCEL_SCREENSHOT:
      // 取消截图，关闭截图界面
      if (screenshotRef.value) {
        screenshotRef.value.clearRectBox()
      }
      isShowScreenshot.value = false
      break

    // 处理 Solve All 内容提取请求
    case SOLVE_ALL_EVENTS.EXTRACT_CONTENT:
      handleSolveAllExtraction(message, sendResponse)
      return true

    case SidepanelEventType.GET_PAGE_CONTENT:
      sendResponse({
        html: document.body.outerHTML,
      })
      break

    case SidepanelEventType.GET_PAGE_CONTENT_TYPE:
      sendResponse({
        contentType: document.contentType,
      })
      break

    // 新增：获取页面HTML和图片列表
    case SidepanelEventType.GET_PAGE_HTML_AND_IMAGES:
      try {
        // 获取HTML
        const html = document.documentElement.outerHTML
        // 获取并过滤图片
        const allImages = Array.from(document.images) as HTMLImageElement[]
        const validImages = allImages.filter(isValidImage)
        // 转换为绝对路径
        const imageUrls = validImages
          .map((img) => {
            const src = img.src || img.getAttribute('data-src') || ''
            try {
              return new URL(src, window.location.href).href
            } catch (error) {
              console.warn('转换图片URL失败:', src, error)
              return src
            }
          })
          .filter((url) => url.trim()) // 过滤空URL
        console.log(`页面数据获取成功: HTML长度=${html.length}, 有效图片=${imageUrls.length}/${allImages.length}`)
        // 发送响应
        browser.runtime.sendMessage({
          type: SidepanelEventType.PAGE_HTML_AND_IMAGES_RESPONSE,
          requestId: message.requestId,
          data: { html, imageUrls },
          success: true,
        })
      } catch (error) {
        console.error('获取页面数据失败:', error)
        // 发送错误响应
        browser.runtime.sendMessage({
          type: SidepanelEventType.PAGE_HTML_AND_IMAGES_RESPONSE,
          requestId: message.requestId,
          data: null,
          success: false,
          error: error instanceof Error ? error.message : '获取页面数据失败',
        })
      }
      // 不需要sendResponse
      return

    // 显示关闭模态框, 模态框关闭需要和 sidebar 通信
    case SidepanelEventType.SHOW_CLOSE_MODAL:
      modalService.showModal({
        title: 'Disable',
        content: 'You can re-enable in settings',
        onConfirm: (value) => {
          console.log('onConfirm in content script from popup panel')
          sendResponse({
            isConfirmClose: true,
            closeType: value,
          })
          trackEvent.track('Plugin_Disable_confirm', {
            from: 'popup-panel',
            confirmValue: value,
          })
        },
        onCancel: () => {
          console.log('onCancel in content script from popup panel')
          sendResponse({
            isConfirmClose: false,
            closeType: 'cancel',
          })
          trackEvent.track('Plugin_Disable_cancel', {
            from: 'popup-panel',
          })
        },
        onClose: () => {
          console.log('onClose in content script from popup panel')
          sendResponse({
            isConfirmClose: false,
            closeType: 'close',
          })
        },
      })
      trackEvent.track('Plugin_Disable_show', {
        from: 'popup-panel',
      })
      // 这样做是为了告诉浏览器："我收到了这个消息，我正在处理它，但我不会立即发送响应，我会稍后异步发送。"
      return true

    default:
      break
  }
}

// 图片过滤函数
function isValidImage(img: HTMLImageElement): boolean {
  // 1. 基础检查
  const src = img.getAttribute('src') || img.getAttribute('data-src')
  if (!src?.trim()) return false
  if (src.startsWith('data:') && src.length < 200) return false

  // 2. 获取实际渲染尺寸
  const rect = img.getBoundingClientRect()
  const width = rect.width
  const height = rect.height

  // 过滤追踪像素
  if (width === 1 && height === 1) return false

  // 过滤过小的图片
  const MIN_RENDER_SIZE = 50
  if (width < MIN_RENDER_SIZE || height < MIN_RENDER_SIZE) return false

  // 4. 内容相关性检查
  const alt = img.getAttribute('alt') || ''
  if (alt.trim() && alt.length > 2) return true

  // 5. 装饰性关键词过滤
  const decorativeKeywords = ['icon', 'logo', 'bullet', 'arrow', 'divider', 'spacer', 'pixel']
  if (decorativeKeywords.some((keyword) => src.toLowerCase().includes(keyword))) {
    return false
  }

  // 6. 大图片优先
  if (width >= 100 && height >= 100) return true

  // 7. 默认有效
  return true
}

const handleWindowMessage = (event: MessageEvent) => {
  // 监听到登录的成功状态消息, 在link登录时, 会从 onboarding 页面发送登录成功消息, 需要转发到 background 页面
  const message = event.data
  if (message.type === EVENT.SOLVELY_EMAIL_LINK_LOGIN) {
    console.log('content js 监听到登录成功消息转发给 service worker', message.data)
    browser.runtime.sendMessage({
      type: EVENT.SOLVELY_EMAIL_LINK_LOGIN,
      data: message,
    })
  }
}

onMounted(() => {
  // 添加消息监听器
  browser.runtime.onMessage.addListener(handleMessage)

  // 监听 onboarding 页面
  window.addEventListener('message', handleWindowMessage)

  // 监听 solveLayer 打开截图事件（跨 Shadow DOM 通信）
  window.addEventListener('solvely-open-screenshot', openCut)
})

onUnmounted(() => {
  // 移除消息监听器
  browser.runtime.onMessage.removeListener(handleMessage)

  // 移除 solveLayer 截图事件监听
  window.removeEventListener('solvely-open-screenshot', openCut)
})

// 开启截图组件
const openCut = () => {
  // 隐藏划词工具栏
  window.dispatchEvent(new Event('solvely-hide-text-selection-toolbar'))
  screenshotRef.value?.toShow()
  isShowScreenshot.value = true
}

const closeScreenshot = () => {
  isShowScreenshot.value = false
  // 关闭截图时也隐藏引导遮罩
  shouldShowGuideBorder.value = false
}

// 点击 solve 按钮, 进入解题流程 ===================== 侧栏处理 =========================
const handleClickSolve = async ({ canvas, cutDataUrl }: SolveImageData) => {
  try {
    // 保存当前截图数据
    currentImageData.value = { canvas, cutDataUrl }
    // 发送解题请求
    browser.runtime.sendMessage({
      type: SidepanelEventType.SOLVE_FROM_CONTENT,
      data: { canvas, cutDataUrl },
    })
  } catch (error) {
    trackEvent.trackError('Plugin_Solve_error', error)
  }
}

// 点击 Solve All 按钮 ====================== 侧栏处理 =========================
const handleClickSolveAll = () => {
  try {
    browser.runtime.sendMessage({
      type: SidepanelEventType.SOLVE_ALL_FROM_CONTENT,
    })
  } catch (error) {
    trackEvent.trackError('Plugin_Solve_error', error)
  }
}

// 点击 Summarize 按钮 ====================== 侧栏处理 =========================
const handleClickSummarize = ({ cutDataUrl }: SolveImageData) => {
  try {
    browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_FROM_SCREENSHOT,
      data: {
        action: 'summarize',
        base64: cutDataUrl,
        fileName: `Screenshot_${Date.now()}.webp`,
      },
    })
    // 🎯 埋点已移至 screenshot/index.vue 的 toSummarize 中，避免 AB 测试导致埋点丢失
  } catch (error) {
    trackEvent.trackError('Plugin_Solve_error', error)
  }
}

// 点击 Quiz 按钮 ====================== 侧栏处理 =========================
const handleClickQuiz = ({ cutDataUrl }: SolveImageData) => {
  try {
    browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_FROM_SCREENSHOT,
      data: {
        action: 'quiz',
        base64: cutDataUrl,
        fileName: `Screenshot_${Date.now()}.webp`,
      },
    })
    // 🎯 埋点已移至 screenshot/index.vue 的 toQuiz 中，避免 AB 测试导致埋点丢失
  } catch (error) {
    trackEvent.trackError('Plugin_Solve_error', error)
  }
}

// 点击 Chat 按钮 ====================== 侧栏处理 =========================
const handleClickChat = ({ cutDataUrl, userInput }: SolveImageData & { userInput?: string }) => {
  try {
    browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_FROM_SCREENSHOT,
      data: {
        action: 'chat',
        base64: cutDataUrl,
        fileName: `Screenshot_${Date.now()}.webp`,
        userInput: userInput || '',
      },
    })
    // 🎯 埋点已移至 screenshot/index.vue 的 toChat 中，避免 AB 测试导致埋点丢失
  } catch (error) {
    trackEvent.trackError('Plugin_Solve_error', error)
  }
}
</script>

<style scoped>
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

/* 引导遮罩层渐显动画 */
.guide-overlay-fade-enter-active {
  transition: opacity 0.4s ease-in-out;
}

.guide-overlay-fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.guide-overlay-fade-enter-from {
  opacity: 0;
}

.guide-overlay-fade-enter-to {
  opacity: 1;
}

.guide-overlay-fade-leave-from {
  opacity: 1;
}

.guide-overlay-fade-leave-to {
  opacity: 0;
}

/* 引导遮罩层样式 - 使用 box-shadow 实现圆角矩形挖洞 */
.guide-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: start;
  pointer-events: auto;
  z-index: 219999; /* 低于截图组件的 z-index: 220000，确保不遮挡截图交互 */
  pointer-events: none;
}

.guide-highlight-box {
  position: relative;
  margin-top: 206px;
  width: 586px;
  height: 316px;
  background: transparent;
  border-radius: 24px;
  /* 使用 box-shadow 创建四周遮罩效果，实现圆角矩形挖洞 */
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.guide-highlight-border {
  border: 3px dashed #ebf0f9;
  width: 596px;
  height: 326px;
  border-radius: 28px;
  position: absolute;
  top: 201px;
  left: calc(50% - 298px);
  z-index: 1;
}
</style>
