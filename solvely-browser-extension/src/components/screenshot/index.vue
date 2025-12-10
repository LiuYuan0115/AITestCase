<template>
  <div
    id="solvely-screen-shot"
    :class="{ onboarding: isOnboardingPage }"
  >
    <!-- 蒙层和选区 -->
    <div
      class="solvely-coverbg"
      @mousedown="maskDown"
      @mousemove="maskMove"
      @mouseup="maskUp"
      v-if="maskShow"
    >
      <div
        class="mask top"
        :style="{
          height: rectStyle.top,
          left: rectStyle.left,
          right: maskStyle.right,
        }"
      ></div>
      <div
        class="mask left"
        :style="{ width: rectStyle.left }"
      ></div>
      <div
        class="mask right"
        :style="{ width: maskStyle.right }"
      ></div>
      <div
        class="mask bottom"
        :style="{
          height: maskStyle.bottom,
          left: rectStyle.left,
          right: maskStyle.right,
        }"
      ></div>
      <div
        class="rect-box"
        :style="rectStyle"
        ref="rectBox"
        @mousedown="rectDown"
        @mousemove="rectMove"
        @mouseup="rectUp"
        v-if="rectShow"
      >
        <span
          class="circle lt"
          data-c="lt"
        ></span>
        <span
          class="circle lb"
          data-c="lb"
        ></span>
        <span
          class="circle rt"
          data-c="rt"
        ></span>
        <span
          class="circle rb"
          data-c="rb"
        ></span>
        <span
          class="circle ct"
          data-c="ct"
        ></span>
        <span
          class="circle cl"
          data-c="cl"
        ></span>
        <span
          class="circle cb"
          data-c="cb"
        ></span>
        <span
          class="circle cr"
          data-c="cr"
        ></span>
        <!-- 截图工具栏 Toolbar -->
        <Toolbar
          :rectPosition="{ minX, minY, maxX, maxY }"
          :shouldShow="!rectDrawing && !rectDragging"
          :isSolveLayer="isSolveLayer || false"
          @toHome="toHome"
          @toCancel="toCancel"
          @toCopy="toCopy"
          @toSolve="toSolve"
          @toSummarize="toSummarize"
          @toQuiz="toQuiz"
          @toChat="toChat"
        />
      </div>
    </div>
    <!-- 截图快捷键 -->
    <KeyBoard
      :keys="['ctrl', 'shift', 's']"
      :winKeys="['alt', 'shift', 's']"
      :toHomeKeys="['command', 'l']"
      :winToHomeKeys="['alt', 'l']"
      @trigger="
        () => {
          toShow()
          trackEvent.track(isWindows ? 'Plugin_Shotcut_Win_Screenshot' : 'Plugin_Shotcut_Mac_Screenshot')
        }
      "
      @escape="clearRectBox"
      @enter="handleEnter"
      @toHome="
        () => {
          toHome()
          trackEvent.track(isWindows ? 'Plugin_Shotcut_Win_Sidebar' : 'Plugin_Shotcut_Mac_Sidebar')
        }
      "
    />
    <!-- 鼠标悬浮文字 -->
    <FollowMouse v-if="maskShow && !rectShow" />
    <!-- Toast提示组件 -->
    <Reactive
      :message="toast"
      :type="toast_type"
    />
  </div>
</template>

<script lang="ts" setup>
import { debounce } from 'lodash-es'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import { getTrpc } from '~/lib/trpc/client'
import KeyBoard from './KeyBoard.vue'
import FollowMouse from './FollowMouse.vue'
import Reactive from './Reactive.vue'
import Toolbar from './Toolbar.vue'
import { STORAGE_KEY } from '~/config'
import { STORAGE_KEYS } from '~/types/config'
import trackEvent from '~/utils/trackEvent'

import useABTest from '@/composables/useABTest'
import useSolveLayer from '@/composables/useSolveLayer'
import { uploadImageForLayer } from '@/utils/layerImageUploader'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import usePaywall from '@/composables/usePaywall'
import { isSidePanelSupported } from '@/utils/common'

const minMoveValue = 16
const maskShow = ref(false)
const rectShow = ref(false)
const rectDrawing = ref(false)
const rectDragging = ref(false)
const rectAction = ref('')
const toast = ref('')
const toast_type = ref('')
const scrollTop = ref(0)
const rectBox = ref()
const innerWidth = ref(window.innerWidth)
const innerHeight = ref(window.innerHeight)
// 独立控制滚动条显示/隐藏的状态，与maskShow分离以解决截图时序问题
const shouldHideScrollbar = ref(false)

// 使用 AB Test composable
const { isSolveLayer } = useABTest()

// 使用 Solve Layer composable
const { showLayer, showExample } = useSolveLayer()

// 使用 Paywall composable
const paywall = usePaywall()

// 获取侧边栏当前状态
const getSidepanelStatus = async (): Promise<boolean> => {
  try {
    return await getTrpc().getSidepanelStatus.query()
  } catch (error) {
    console.error('Failed to get sidepanel status:', error)
    return false
  }
}

// 初始坐标
const startX = ref(0)
const startY = ref(0)
const endX = ref(0)
const endY = ref(0)

// 移动坐标
const smoveX = ref(0)
const smoveY = ref(0)
const emoveX = ref(0)
const emoveY = ref(0)

// 裁切坐标
const stretchX = ref(0)
const stretchY = ref(0)

// 重置坐标
const resetX = ref(0)
const resetY = ref(0)

// 截图区域宽度和高度
const rectWidth = computed(() => Math.abs(endX.value - startX.value))
const rectHeight = computed(() => Math.abs(endY.value - startY.value))

const moveX = computed(() => emoveX.value - smoveX.value)
const moveY = computed(() => emoveY.value - smoveY.value)

const minX = computed(() => Math.min(startX.value, endX.value))
const minY = computed(() => Math.min(startY.value, endY.value))
const maxX = computed(() => Math.max(startX.value, endX.value))
const maxY = computed(() => Math.max(startY.value, endY.value))

const isWindows = navigator.userAgent.includes('Windows')

const isOnboardingPage = computed(() => {
  return window.location.href.split('?')[0] === import.meta.env.VITE_ONBOARDING_PAGE_URL
})

const isboardingCompleted = ref(false)

const rectStyle = computed(() => ({
  left: `${minX.value + moveX.value}px`,
  top: `${minY.value + moveY.value}px`,
  width: `${rectWidth.value}px`,
  height: `${rectHeight.value}px`,
  pointerEvents: rectDrawing.value ? ('none' as 'none') : ('auto' as 'auto'),
}))

const maskStyle = computed(() => ({
  right: `${Math.max(innerWidth.value - rectWidth.value - Math.min(startX.value, endX.value) - moveX.value, 0)}px`,
  bottom: `${Math.max(innerHeight.value - rectHeight.value - Math.min(startY.value, endY.value) - moveY.value, 0)}px`,
}))

const emit = defineEmits<{
  (e: 'toSolve', payload: { canvas: HTMLCanvasElement; cutDataUrl: string }): void
  (e: 'toSummarize', payload: { canvas: HTMLCanvasElement; cutDataUrl: string }): void
  (e: 'toQuiz', payload: { canvas: HTMLCanvasElement; cutDataUrl: string }): void
  (e: 'toChat', payload: { canvas: HTMLCanvasElement; cutDataUrl: string; userInput?: string }): void
  (e: 'close'): void
}>()

const cutImg = (dataUrl: string): Promise<HTMLCanvasElement> => {
  // 创建一个隐藏的 canvas 元素
  let canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')

  // 创建一个 Image 对象来加载截图
  let img = new Image()
  img.src = dataUrl
  return new Promise((resolve, reject) => {
    img.onload = () => {
      // 设置 canvas 的大小
      canvas.width = img.width
      canvas.height = img.height
      // 将截图绘制到 canvas 上
      ctx?.drawImage(img, 0, 0, img.width, img.height)
      // 计算缩放比例
      let ratio = img.width / innerWidth.value
      // 裁剪指定区域
      let x = (minX.value + moveX.value) * ratio // 裁剪区域的 x 坐标
      let y = (minY.value + moveY.value) * ratio // 裁剪区域的 y 坐标
      let width = rectWidth.value * ratio // 裁剪区域的宽度
      let height = rectHeight.value * ratio // 裁剪区域的高度

      let cut_canvas = document.createElement('canvas')
      let cut_ctx = cut_canvas.getContext('2d')
      cut_canvas.width = width
      cut_canvas.height = height
      cut_ctx?.drawImage(canvas, x, y, width, height, 0, 0, width, height)
      // console.log(canvas.width, canvas.height);
      resolve(cut_canvas)
    }
  })
}

// 获取截图画面
const captureScreenshot = async (): Promise<{
  canvas: HTMLCanvasElement
  cutDataUrl: string
}> => {
  if (!rectShow.value) throw new Error('No screenshot area selected')

  // 1. 先隐藏遮罩（视觉上消失），但保持滚动条隐藏状态
  maskShow.value = false
  await new Promise((resolve) => setTimeout(resolve, 50))

  // 2. 执行截图（此时滚动条仍然隐藏，页面布局保持一致）
  const dataUrl = await getTrpc().screenShot.query()
  const canvas = await cutImg(dataUrl)
  // 内部使用 webp 格式
  const cutDataUrl = canvas.toDataURL('image/webp', 1)

  // 3. 截图完成后才恢复滚动条
  shouldHideScrollbar.value = false

  return { canvas, cutDataUrl }
}

const writeClipboard = async (canvas: HTMLCanvasElement) => {
  // 复制到剪贴板时使用 png 格式
  let blob: any = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  let file = new File([blob], 'image.png', { type: 'image/png' })
  let data = [new ClipboardItem({ 'image/png': file })]
  await navigator.clipboard.write(data)
}

const clearRectBox = () => {
  maskShow.value = false
  shouldHideScrollbar.value = false
  rectShow.value = false
  startX.value = 0
  startY.value = 0
  endX.value = 0
  endY.value = 0

  // 关闭截图时恢复 solveLayer
  window.dispatchEvent(new Event('solvely-screenshot-resume'))

  emit('close')
}

const handleEnter = () => {
  if (maskShow.value) {
    toSolve()
  }
}

const toShow = () => {
  // 只要显示截图, 保存引导提示状态, 之后不再显示
  browser.storage.local.set({ [STORAGE_KEY.ATTRACT_TOOLTIP_SHOWN_KEY]: true })

  // 打开截图蒙层时挂起 solveLayer
  window.dispatchEvent(new Event('solvely-screenshot-suspend'))

  // 同时设置遮罩显示和滚动条隐藏
  maskShow.value = true
  shouldHideScrollbar.value = true
}

const toCancel = (e?: MouseEvent) => {
  getTrpc().point.mutate({
    name: 'Plugin_screenshot_cancel',
    params: { originUrl: window.location.href },
  })
  if (isOnboardingPage.value && !isboardingCompleted.value && !isSidePanelSupported()) {
    trackEvent.track('Plugin_Onboarding_Screenshot_Cancel')
  }
  clearRectBox()
}

// 复制截图
const toCopy = async () => {
  try {
    const { canvas } = await captureScreenshot()
    await writeClipboard(canvas)
    sendToast('The screenshot is saved to the clipboard!')
    getTrpc().point.mutate({
      name: 'Plugin_screenshot_copy',
      params: { originUrl: window.location.href },
    })
  } catch (error: any) {
    sendToast('Failed to copy screenshot. Please try again!', 'error')
    console.log('复制截图失败:', error)
    // 出错时确保恢复页面状态
    shouldHideScrollbar.value = false
  } finally {
    clearRectBox()
  }
}

// 新的solve解题逻辑 需要把图片传给 preview
// 计算 SolveLayer 显示位置（截图区域右侧 20px，顶部对齐）
const getSolveLayerPosition = () => {
  const SOLVE_LAYER_WIDTH = 400 // SolveLayer 实际宽度
  const RIGHT_PADDING = 40 // 距离窗口右侧的最小距离
  const DEFAULT_LEFT_OFFSET = 20 // 默认在截图区域右侧 20px

  // 计算截图区域右边界
  const rectRightX = maxX.value + moveX.value

  // 计算浮层默认位置（截图区域右侧 20px）
  let layerLeft = rectRightX + DEFAULT_LEFT_OFFSET

  // 判断右侧是否有足够空间（浮层宽度 + 右侧边距）
  const requiredSpace = layerLeft + SOLVE_LAYER_WIDTH + RIGHT_PADDING

  if (requiredSpace > innerWidth.value) {
    // 右侧空间不足，固定在窗口右侧 40px 的位置
    layerLeft = innerWidth.value - SOLVE_LAYER_WIDTH - RIGHT_PADDING
  }

  return {
    left: `${layerLeft}px`,
    top: `${minY.value + moveY.value}px`,
  }
}

// 通用的截图操作处理函数
const handleScreenshotAction = async (actionType: 'Solve' | 'Summarize' | 'Quiz' | 'Chat', userInput?: string) => {
  try {
    // 🎯 提前检查：如果是 Onboarding 页面且未完成，且不支持侧边栏，直接显示 example，不需要截图
    // 支持侧边栏的情况下，onboarding 有自己的处理逻辑
    if (!isSidePanelSupported() && isOnboardingPage.value && !isboardingCompleted.value) {
      // 显示 example
      showExample(getSolveLayerPosition())
      window.dispatchEvent(new Event('onboarding_oneClick'))
      isboardingCompleted.value = true
      return
    }

    const { canvas, cutDataUrl } = await captureScreenshot()

    // 🎯 优先检查登录状态
    const isLogin = await getTrpc().isLogin.query()

    // 如果不支持侧边栏且未登录
    if (!isLogin && !isSidePanelSupported()) {
      // 🎯 显示 Layer，但会显示未登录状态（NoLoginLayerSolution 组件）
      // layerServiceMessage 会自动检测登录状态，未登录时显示假的解题背景和登录按钮
      showLayer(actionType, getSolveLayerPosition(), {
        base64: cutDataUrl,
        userInput: userInput || '',
      })
      return
    }

    // 每次都实时查询侧边栏状态
    const isSidepanelOpen = await getSidepanelStatus()

    const isLimit = await useSubscription.limitCheck()
    const isSubscribed = useSubscription.isSubscribed.value

    // 只有在 已登录 + isSolveLayer 启用 + 侧边栏未打开 同时只有在余额充足时才使用 SolveLayer,浏览器不支持 sidePanel 时必定使用 SolveLayer
    if ((isLogin && isSolveLayer.value && !isSidepanelOpen && (isLimit || isSubscribed)) || !isSidePanelSupported()) {
      // 🔑 Layer 模式：对 Summarize 和 Quiz 启动异步上传
      let uploadPromise = undefined

      if (actionType === 'Summarize') {
        // 启动异步上传到 PDF CDN
        uploadPromise = uploadImageForLayer(cutDataUrl, 'summarize')

        // 后台追踪上传结果
        uploadPromise
          .then((result) => {
            console.log('[toSummarize] 上传成功:', result)
          })
          .catch((error) => {
            console.error('[toSummarize] 上传失败:', error)
          })
      } else if (actionType === 'Quiz') {
        // 启动异步上传到 Quiz CDN
        uploadPromise = uploadImageForLayer(cutDataUrl, 'quiz')

        // 后台追踪上传结果
        uploadPromise
          .then((result) => {
            console.log('[toQuiz] 上传成功:', result)
          })
          .catch((error) => {
            console.error('[toQuiz] 上传失败:', error)
          })
      }

      // 统一的显示 Layer 函数
      const showLayerWithData = () => {
        showLayer(
          actionType,
          getSolveLayerPosition(),
          {
            base64: cutDataUrl,
            userInput: userInput || '',
          },
          uploadPromise
        )
      }

      // 不支持侧边栏且需要显示 paywall 时，显示 paywall 后返回
      if (!isSidePanelSupported() && !isLimit && !isSubscribed) {
        paywall.show({
          from: actionType,
          onSuccess: async () => {
            // 付款成功后继续显示 Layer
            showLayerWithData()
          },
        })
        return
      }

      // 其他情况直接显示 Layer
      showLayerWithData()
    } else {
      // 侧边栏模式：根据 actionType 触发对应的事件
      if (actionType === 'Solve') {
        emit('toSolve', { canvas, cutDataUrl })
      } else if (actionType === 'Summarize') {
        emit('toSummarize', { canvas, cutDataUrl })
      } else if (actionType === 'Quiz') {
        emit('toQuiz', { canvas, cutDataUrl })
      } else if (actionType === 'Chat') {
        emit('toChat', { canvas, cutDataUrl, userInput })
      }
    }
  } catch (error) {
    console.error(`${actionType} error:`, error)
    // 出错时确保恢复页面状态
    shouldHideScrollbar.value = false
  } finally {
    clearRectBox()
  }
}

const toSolve = async () => {
  // 打点 插件成功截图后，点击Solve
  trackEvent.track('Plugin_Screenshot_solve')
  if (isOnboardingPage.value && !isboardingCompleted.value && !isSidePanelSupported()) {
    trackEvent.track('Plugin_Onboarding_Screenshot_Solve')
  }
  await handleScreenshotAction('Solve')
}

const toSummarize = () => {
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Screenshot_Summarize', {
    from: 'page',
  })
  handleScreenshotAction('Summarize')
}

const toQuiz = () => {
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Screenshot_Quiz', {
    from: 'page',
  })
  handleScreenshotAction('Quiz')
}

const toChat = (input?: string) => {
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Screenshot_Chat', {
    from: 'page',
  })
  handleScreenshotAction('Chat', input)
}

const toHome = async () => {
  chrome.runtime.sendMessage({
    type: SidepanelEventType.OPEN,
  })
}

const maskDown = (e: MouseEvent) => {
  if (!rectShow.value) {
    // 未创建截图区域
    startX.value = e.clientX
    startY.value = e.clientY
    endX.value = e.clientX
    endY.value = e.clientY
    rectDrawing.value = true
  } else if (!rectAction.value) {
    // 重置截图区域
    rectAction.value = 'reset'
    resetX.value = e.clientX
    resetY.value = e.clientY
  }
  if (rectAction.value && rectAction.value != 'move') {
    // 拉伸截图区域
    stretchX.value = e.clientX
    stretchY.value = e.clientY
  }
  e.stopPropagation()
  e.preventDefault()
}

const maskMove = (e: MouseEvent) => {
  if (startX.value && startY.value && rectDrawing.value) {
    if (Math.abs(e.clientX - startX.value) < minMoveValue) return
    rectShow.value = true
    console.log('maskMove')
    endX.value = e.clientX
    endY.value = e.clientY
  }
  if (!rectAction.value) return
  if (rectAction.value.length == 2) {
    // console.log("rectStretch", rectAction.value);
    let xv = e.clientX - stretchX.value
    let yv = e.clientY - stretchY.value
    stretchX.value += xv
    stretchY.value += yv
    switch (rectAction.value) {
      case 'lt':
        startX.value += xv
        startY.value += yv
        break
      case 'lb':
        startX.value += xv
        endY.value += yv
        break
      case 'rt':
        endX.value += xv
        startY.value += yv
        break
      case 'rb':
        endX.value += xv
        endY.value += yv
        break
      case 'ct':
        startY.value += yv
        break
      case 'cl':
        startX.value += xv
        break
      case 'cb':
        endY.value += yv
        break
      case 'cr':
        endX.value += xv
        break
    }
  }
  // 截图框移动
  if (rectAction.value == 'move') {
    emoveX.value = Math.max(
      Math.min(e.clientX, innerWidth.value - maxX.value + smoveX.value),
      smoveX.value - minX.value
    )
    emoveY.value = Math.max(
      Math.min(e.clientY, innerHeight.value - maxY.value + smoveY.value),
      smoveY.value - minY.value
    )
  }
  // 重新创建截图框
  if (rectAction.value == 'reset') {
    if (Math.abs(e.clientX - resetX.value) < minMoveValue) return
    startX.value = resetX.value
    startY.value = resetY.value
    endX.value = e.clientX
    endY.value = e.clientY
    rectDrawing.value = true
    rectAction.value = ''
  }
  e.preventDefault()
  // e.stopPropagation();
}

// 重新计算坐标
const resetCircleBtn = () => {
  let xv = endX.value - startX.value
  let yv = endY.value - startY.value
  if (xv < 0) {
    startX.value = endX.value
    endX.value = startX.value - xv
  }
  if (yv < 0) {
    startY.value = endY.value
    endY.value = startY.value - yv
  }
}

const maskUp = (e: MouseEvent) => {
  rectDrawing.value = false
  rectDragging.value = false
  if (rectAction.value == 'move') {
    startX.value += moveX.value
    startY.value += moveY.value
    endX.value += moveX.value
    endY.value += moveY.value
    smoveX.value = 0
    smoveY.value = 0
    emoveX.value = 0
    emoveY.value = 0
  } else {
    resetCircleBtn()
  }
  rectAction.value = ''
  e.stopPropagation()
}

const rectDown = (e: MouseEvent) => {
  rectDragging.value = true
  let target = e.target as HTMLElement
  rectAction.value = target.dataset?.c || 'move'
  console.log('rectDown', rectAction.value)
  if (rectAction.value == 'move') {
    smoveX.value = e.clientX
    smoveY.value = e.clientY
    emoveX.value = e.clientX
    emoveY.value = e.clientY
    e.stopPropagation()
  }
}
const rectMove = (e: MouseEvent) => {
  if (!rectDragging.value) {
    return e.stopPropagation()
  }
  // if (rectAction.value == "move") {
  // if (diffX <= 0) {
  //   // smoveX.value - e.clientX < minX.value;
  // } else {
  //   // e.clientX < window.innerWidth - maxX.value + smoveX.value;
  // }
}
const rectUp = (e: MouseEvent) => {}

const sendToast = (msg: string, type = 'success') => {
  toast_type.value = type
  toast.value = msg
  setTimeout(() => {
    toast.value = ''
  }, 3000)
}

// 隐藏滚动条, 并保存滚动位置（使用 position: fixed 方案）
const hideScrollbar = (bool = true) => {
  if (bool) {
    // 保存当前滚动位置
    scrollTop.value = window.scrollY

    // 使用 position: fixed 固定页面，并通过负的 top 值模拟滚动位置
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollTop.value}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
  } else {
    // 移除 fixed 定位
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.width = ''

    // 恢复滚动位置
    if (scrollTop.value) {
      window.scrollTo(0, scrollTop.value)
    }
  }
}

// 监听滚动条控制状态（与蒙层显示分离，解决截图时文字偏移问题）
watch(
  () => shouldHideScrollbar.value,
  (val) => {
    if (val) {
      hideScrollbar(true)
    } else {
      hideScrollbar(false)
    }
  }
)

// 当窗口大小发生变化的时候，获取当前窗口的大小
const getWindowSize = () => {
  innerWidth.value = window.innerWidth
  innerHeight.value = window.innerHeight
}

// 使用lodash的debounce函数处理resize事件，200ms后执行一次
const debouncedGetWindowSize = debounce(getWindowSize, 200)

// 添加onMounted钩子，监听resize事件
onMounted(async () => {
  window.addEventListener('resize', debouncedGetWindowSize)

  // 初始化 onboarding 完成状态
  if (isOnboardingPage.value) {
    const { onboardingCompleted } = await browser.storage.local.get(STORAGE_KEYS.ONBOARDING_COMPLETED)
    isboardingCompleted.value = onboardingCompleted || false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', debouncedGetWindowSize)

  // 组件卸载时强制恢复页面状态，防止用户被卡在 fixed 状态
  if (shouldHideScrollbar.value) {
    shouldHideScrollbar.value = false
    // 直接清理样式，确保页面可以正常使用
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.width = ''
  }
})

watch(
  () => rectShow.value,
  (val) => {
    if (val && window.location.href.split('?')[0] === import.meta.env.VITE_ONBOARDING_PAGE_URL) {
      // onboarding页面，裁剪框出现
      trackEvent.track('Plugin_onboarding_crop')
    }
  }
)

defineExpose({
  toShow,
  clearRectBox,
})
</script>

<style lang="less">
#solvely-screen-shot {
  .solvely-coverbg {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 220000;
    .mask {
      background: #0000004d;
      position: absolute;
      cursor: crosshair;
      &.top {
        top: 0;
        left: 0;
        right: 0;
      }
      &.left {
        top: 0;
        left: 0;
        bottom: 0;
      }
      &.right {
        top: 0;
        right: 0;
        bottom: 0;
      }
      &.bottom {
        left: 0;
        right: 0;
        bottom: 0;
      }
    }
    .rect-box {
      // 圆圈样式
      --circle-size: 14px;
      --circle-border-size: 2px;
      --circle-border-color: #007aff;
      --circle-bg-color: #ffffff;
      // box line 的样式
      --box-border-size: 2px;
      --box-border-color: #007aff;
      // 移动距离
      --move-distance: calc((var(--circle-size) + var(--box-border-size)) / -2);

      position: fixed;
      border: var(--box-border-size) solid var(--box-border-color);
      pointer-events: none;
      cursor: move;
      position: relative;

      // 暗黑模式样式
      .dark & {
        --circle-border-color: #1d8eff;
        --box-border-color: #1d8eff;
      }
      .circle {
        position: absolute;
        width: var(--circle-size);
        height: var(--circle-size);
        background: var(--circle-bg-color);
        border: var(--circle-border-size) solid var(--circle-border-color);
        border-radius: 50%;
        &.lt {
          top: var(--move-distance);
          left: var(--move-distance);
          cursor: nw-resize;
        }
        &.lb {
          bottom: var(--move-distance);
          left: var(--move-distance);
          cursor: sw-resize;
        }
        &.rt {
          top: var(--move-distance);
          right: var(--move-distance);
          cursor: ne-resize;
        }
        &.rb {
          bottom: var(--move-distance);
          right: var(--move-distance);
          cursor: se-resize;
        }
        &.ct {
          top: var(--move-distance);
          left: 50%;
          transform: translateX(-50%);
          cursor: ns-resize;
        }
        &.cl {
          left: var(--move-distance);
          top: 50%;
          transform: translateY(-50%);
          cursor: ew-resize;
        }
        &.cb {
          bottom: var(--move-distance);
          left: 50%;
          transform: translateX(-50%);
          cursor: ns-resize;
        }
        &.cr {
          right: var(--move-distance);
          top: 50%;
          transform: translateY(-50%);
          cursor: ew-resize;
        }
      }
    }
  }
}
</style>
