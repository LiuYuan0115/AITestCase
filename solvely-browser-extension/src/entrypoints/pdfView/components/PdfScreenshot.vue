<template>
  <div
    id="pdf-screenshot"
    v-show="maskShow"
  >
    <!-- 鼠标悬浮文字 -->
    <PdfMouseFollow v-if="maskShow && !rectShow" />
    <!-- 蒙层和选区 -->
    <div
      class="screenshot-coverbg"
      @mousedown="maskDown"
      @mousemove="maskMove"
      @mouseup="maskUp"
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

        <!-- 截图工具栏 -->
        <div
          :class="[
            'absolute h-[36px] bg-[#fff] dark:bg-[#222A38] rounded-[12px] cursor-auto flex items-center justify-start p-[1px] pl-[9px] shadow-[0_0_24px_0_rgba(0,0,0,0.12)] box-border border border-[#fff] dark:border-[#2C3649] left-1/2 transform -translate-x-1/2 transition-colors duration-200',
            shouldShowToolbarOnTop ? '-top-[48px]' : '-bottom-[48px]',
          ]"
          v-show="!rectDrawing && !rectDragging"
          @mousedown.stop
          @mousemove.stop
          @mouseup.stop
        >
          <SvgIcon
            name="logo"
            size="22"
          />

          <!-- 🎯 Chat 输入框 -->
          <div
            v-show="canShowChatInput && isSolveLayer"
            class="w-[calc(100%-44px)] h-full bg-[#fff] dark:bg-[#222A38] absolute top-0 right-0 flex items-center rounded-tr-xl rounded-br-xl pr-3 gap-2 transition-colors duration-200"
          >
            <input
              ref="chatInputRef"
              type="text"
              placeholder="Ask me any questions"
              class="w-full h-5 border-0 outline-none text-[14px] font-[400] leading-[140%] bg-transparent px-2 text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark placeholder:text-s-text-low-emphasis dark:placeholder:text-s-text-low-emphasis-dark transition-colors duration-200"
              @keydown.enter="handleChatSend"
              @keydown.esc="canShowChatInput = false"
            />
            <div
              class="w-[20px] h-[20px] flex items-center justify-center bg-s-text-brand dark:bg-s-text-brand-dark hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark rounded-full transition-colors duration-200 cursor-pointer shrink-0"
            >
              <SvgIcon
                name="textSelection/select-send"
                size="20"
                @click="handleChatSend"
              />
            </div>
            <i class="w-[1px] h-4 bg-[#E6E8EA] dark:bg-[#485162] ml-[2px] mr-[1px] transition-colors duration-200"></i>
            <div
              class="w-[20px] h-[20px] flex items-center justify-center text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark hover:bg-[#F5F7FA] dark:hover:bg-[#303A52] rounded-full transition-colors duration-200 cursor-pointer shrink-0"
            >
              <SvgIcon
                name="textSelection/layer-send-close"
                size="20"
                @click="handleChatInputClose"
              />
            </div>
          </div>

          <!-- 分割线 -->
          <div
            class="w-[2px] h-[20px] rounded-full bg-[#E6E8EA] dark:bg-[#485162] ml-[9px] mr-[3px] transition-colors duration-200"
          ></div>

          <div class="flex items-center justify-start gap-1.5">
            <!-- 按钮列表 -->
            <button
              v-for="btn in actionButtons"
              :key="btn.key"
              type="button"
              :class="[
                'pl-1 pr-1.5 h-[28px] rounded-[6px] cursor-pointer flex items-center transition-all duration-200 text-[14px] font-[400] hover:bg-[#ECF5FF] dark:hover:bg-[#303A52]',
                btn.textColor,
                btn.width,
              ]"
              @click.stop="btn.handler"
            >
              <SvgIcon
                :name="btn.icon"
                :size="btn.iconSize"
                class="mr-0.5"
              />
              {{ btn.label }}
            </button>
          </div>

          <!-- Solve 按钮 -->
          <button
            type="button"
            class="w-[88px] h-[32px] rounded-[10px] font-[700] cursor-pointer text-[14px] ml-[6px] bg-s-text-brand dark:bg-s-text-brand-dark text-s-interface-bg hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark transition-colors duration-200"
            @click.stop="toCapture"
          >
            Solve
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import PdfMouseFollow from './PdfMouseFollow.vue'
import { getTrpc } from '@/lib/trpc/client'
import SidepanelEventType from '@/entrypoints/sidepanel/types/eventTypes'
import trackEvent from '~/utils/trackEvent'
import useABTest from '@/composables/useABTest'

const { isSolveLayer } = useABTest()

const minMoveValue = 16
const maskShow = ref(false)
const rectShow = ref(false)
const rectDrawing = ref(false)
const rectDragging = ref(false)
const rectAction = ref('')

// 🎯 Chat 输入框状态
const canShowChatInput = ref(false)
const chatInputRef = ref<HTMLInputElement>()

// 窗口尺寸
const innerWidth = ref(window.innerWidth)
const innerHeight = ref(window.innerHeight)

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

// 调整大小坐标
const stretchX = ref(0)
const stretchY = ref(0)

const moveX = computed(() => emoveX.value - smoveX.value)
const moveY = computed(() => emoveY.value - smoveY.value)

// 计算属性
const minX = computed(() => Math.min(startX.value, endX.value))
const maxX = computed(() => Math.max(startX.value, endX.value))
const minY = computed(() => Math.min(startY.value, endY.value))
const maxY = computed(() => Math.max(startY.value, endY.value))

const rectWidth = computed(() => maxX.value - minX.value)
const rectHeight = computed(() => maxY.value - minY.value)

const rectStyle = computed(() => ({
  left: `${minX.value + moveX.value}px`,
  top: `${minY.value + moveY.value}px`,
  width: `${rectWidth.value}px`,
  height: `${rectHeight.value}px`,
  pointerEvents: 'auto' as 'auto',
}))

const maskStyle = computed(() => ({
  right: `${Math.max(innerWidth.value - rectWidth.value - Math.min(startX.value, endX.value) - moveX.value, 0)}px`,
  bottom: `${Math.max(innerHeight.value - rectHeight.value - Math.min(startY.value, endY.value) - moveY.value, 0)}px`,
}))

// 按钮配置映射表
const actionButtons = computed(() => [
  {
    key: 'cancel',
    label: 'Cancel',
    icon: 'toolbar/close',
    iconSize: 20,
    textColor: 'text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark',
    width: 'w-[78px]',
    handler: toCancel,
  },
  {
    key: 'summarize',
    label: 'Summarize',
    icon: 'textSelection/select-summarize',
    iconSize: 20,
    textColor: 'text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark',
    width: 'w-[106px]',
    handler: toSummarize,
  },
  {
    key: 'quiz',
    label: 'Quiz',
    icon: 'textSelection/select-quiz',
    iconSize: 20,
    textColor: 'text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark',
    width: 'w-[62px]',
    handler: toQuiz,
  },
  {
    key: 'chat',
    label: 'Chat',
    icon: 'textSelection/select-chat',
    iconSize: 20,
    textColor: 'text-s-text-brand dark:text-s-text-brand-dark',
    width: 'w-[64px]',
    handler: toChat,
  },
])

// 判断工具栏是否应该显示在选区上方
const shouldShowToolbarOnTop = computed(() => {
  const toolbarHeight = 50 // 工具栏高度
  const margin = 10 // 边距
  const bottomSpace = innerHeight.value - (minY.value + moveY.value + rectHeight.value + toolbarHeight + margin)
  return bottomSpace < 0 // 下方空间不足时显示在上方
})

// 截图功能 - 使用扩展的截图 API
const captureScreenshot = async (): Promise<{
  canvas: HTMLCanvasElement
  cutDataUrl: string
}> => {
  if (!rectShow.value) throw new Error('No screenshot area selected')

  // 隐藏截图界面
  maskShow.value = false
  await new Promise((resolve) => setTimeout(resolve, 50))

  try {
    // 使用扩展的截图 API，与 index.vue 保持一致
    const dataUrl = await getTrpc().screenShot.query()

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

        resolve({
          canvas: cut_canvas,
          cutDataUrl: cut_canvas.toDataURL('image/webp', 1),
        })
      }
      img.onerror = reject
    })
  } catch (error) {
    throw error
  }
}

// 复制到剪贴板 - 与 index.vue 保持一致
const writeClipboard = async (canvas: HTMLCanvasElement) => {
  // 复制到剪贴板时使用 png 格式
  let blob: any = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  let file = new File([blob], 'image.png', { type: 'image/png' })
  let data = [new ClipboardItem({ 'image/png': file })]
  await navigator.clipboard.write(data)
}

// 事件处理
const maskDown = (e: MouseEvent) => {
  if (rectShow.value) return
  rectDrawing.value = true
  startX.value = e.clientX
  startY.value = e.clientY
  endX.value = e.clientX
  endY.value = e.clientY
  rectShow.value = true
}

const maskMove = (e: MouseEvent) => {
  if (rectDrawing.value) {
    endX.value = e.clientX
    endY.value = e.clientY
  }

  // 调整大小
  if (rectDragging.value && rectAction.value && rectAction.value !== 'move') {
    const xv = e.clientX - stretchX.value
    const yv = e.clientY - stretchY.value
    stretchX.value = e.clientX
    stretchY.value = e.clientY

    switch (rectAction.value) {
      case 'lt':
        startX.value += xv
        startY.value += yv
        break
      case 'rt':
        endX.value += xv
        startY.value += yv
        break
      case 'lb':
        startX.value += xv
        endY.value += yv
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
  if (rectDragging.value && rectAction.value === 'move') {
    emoveX.value = Math.max(
      Math.min(e.clientX, innerWidth.value - maxX.value + smoveX.value),
      smoveX.value - minX.value
    )
    emoveY.value = Math.max(
      Math.min(e.clientY, innerHeight.value - maxY.value + smoveY.value),
      smoveY.value - minY.value
    )
  }
}

const maskUp = () => {
  if (rectDrawing.value) {
    rectDrawing.value = false

    // 确保选区有最小尺寸，但允许用户继续操作
    if (rectWidth.value < minMoveValue || rectHeight.value < minMoveValue) {
      // 如果选区太小，不自动退出，让用户可以重新绘制
      rectShow.value = false
      // 重置绘制状态，允许重新绘制
      startX.value = 0
      startY.value = 0
      endX.value = 0
      endY.value = 0
    }
  }

  if (rectDragging.value) {
    rectDragging.value = false

    if (rectAction.value === 'move') {
      // 应用移动结果
      startX.value += moveX.value
      startY.value += moveY.value
      endX.value += moveX.value
      endY.value += moveY.value
      // 重置移动变量
      smoveX.value = 0
      smoveY.value = 0
      emoveX.value = 0
      emoveY.value = 0
    }

    rectAction.value = ''
  }
}

const rectDown = (e: MouseEvent) => {
  if (rectDrawing.value) return
  rectDragging.value = true
  const target = e.target as HTMLElement
  rectAction.value = target.dataset.c || 'move'

  if (rectAction.value === 'move') {
    // 移动
    smoveX.value = e.clientX
    smoveY.value = e.clientY
    emoveX.value = e.clientX
    emoveY.value = e.clientY
  } else {
    // 调整大小
    stretchX.value = e.clientX
    stretchY.value = e.clientY
  }
}

const rectUp = () => {
  if (rectAction.value === 'move') {
    // 应用移动结果
    startX.value += moveX.value
    startY.value += moveY.value
    endX.value += moveX.value
    endY.value += moveY.value
  }

  // 重置移动变量
  smoveX.value = 0
  smoveY.value = 0
  emoveX.value = 0
  emoveY.value = 0

  rectDragging.value = false
  rectAction.value = ''
}

const clearRectBox = () => {
  maskShow.value = false
  rectShow.value = false
  startX.value = 0
  startY.value = 0
  endX.value = 0
  endY.value = 0
  smoveX.value = 0
  smoveY.value = 0
  emoveX.value = 0
  emoveY.value = 0
  stretchX.value = 0
  stretchY.value = 0
  enableScroll()
}

const toCancel = () => {
  clearRectBox()
}

const emit = defineEmits<{
  (e: 'copy-success'): void
  (e: 'copy-error'): void
}>()

const toCopy = async () => {
  try {
    const { canvas } = await captureScreenshot()
    await writeClipboard(canvas)
    emit('copy-success')
    clearRectBox()
  } catch (error) {
    console.error('Failed to copy screenshot:', error)
    emit('copy-error')
  }
}

const toCapture = async () => {
  try {
    const { cutDataUrl } = await captureScreenshot()
    trackEvent.track('Plugin_Sidebar_PDFpage_Crop')
    // 发送解题请求，与内容脚本保持一致
    try {
      browser.runtime.sendMessage({
        type: SidepanelEventType.SOLVE_FROM_CONTENT,
        data: {
          cutDataUrl: cutDataUrl,
        },
      })
    } catch (error) {
      console.error(error)
    }
    clearRectBox()
  } catch (error: any) {
    console.error(error)
  }
}

// Summarize / Quiz / Chat
const toSummarize = async () => {
  try {
    const { cutDataUrl } = await captureScreenshot()
    trackEvent.track('Plugin_Screenshot_Summarize', {
      from: 'pdf',
    })
    await browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_FROM_SCREENSHOT,
      data: {
        action: 'summarize',
        base64: cutDataUrl,
        fileName: `Screenshot_${Date.now()}.webp`,
      },
    })
  } catch (error) {
    console.error('toSummarize error:', error)
  } finally {
    clearRectBox()
  }
}

const toQuiz = async () => {
  try {
    const { cutDataUrl } = await captureScreenshot()
    trackEvent.track('Plugin_Screenshot_Quiz', {
      from: 'pdf',
    })
    await browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_FROM_SCREENSHOT,
      data: {
        action: 'quiz',
        base64: cutDataUrl,
        fileName: `Screenshot_${Date.now()}.webp`,
      },
    })
  } catch (error) {
    console.error('toQuiz error:', error)
  } finally {
    clearRectBox()
  }
}

const toChat = async () => {
  trackEvent.track('Plugin_Screenshot_Chat', {
        from: 'pdf',
      })
  if (!isSolveLayer.value) {
    try {
      const { cutDataUrl } = await captureScreenshot()
      await browser.runtime.sendMessage({
        type: SidepanelEventType.GENERATE_FROM_SCREENSHOT,
        data: {
          action: 'chat',
          base64: cutDataUrl,
          fileName: `Screenshot_${Date.now()}.webp`,
        },
      })
    } catch (error) {
      console.error('toQuiz error:', error)
    } finally {
      clearRectBox()
    }
    return
  }
  // 🔧 显示输入框，让用户输入提示词
  canShowChatInput.value = true
  setTimeout(() => {
    chatInputRef.value?.focus()
  }, 100)
}

const handleChatSend = async () => {
  trackEvent.track('Plugin_Screenshot_Chat_Send', {
    input: chatInputRef.value,
    from: 'pdf',
  })
  if (!chatInputRef.value) return

  const userInput = chatInputRef.value.value.trim()
  if (!userInput) return

  try {
    const { cutDataUrl } = await captureScreenshot()
    await browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_FROM_SCREENSHOT,
      data: {
        action: 'chat',
        base64: cutDataUrl,
        fileName: `Screenshot_${Date.now()}.webp`,
        userInput, // 🔧 传递用户输入
      },
    })

    // 清空输入框
    chatInputRef.value.value = ''
    canShowChatInput.value = false
  } catch (error) {
    console.error('toChat error:', error)
  } finally {
    clearRectBox()
  }
}

const handleChatInputClose = () => {
  canShowChatInput.value = false
  // 清空输入框
  if (chatInputRef.value) {
    chatInputRef.value.value = ''
  }
}

// 禁用页面滚动
const disableScroll = () => {
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
}

// 启用页面滚动
const enableScroll = () => {
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
}

// 显示截图界面
const show = () => {
  maskShow.value = true
  disableScroll()
}

// 暴露方法
defineExpose({ show })

// 监听窗口大小变化
const handleResize = () => {
  innerWidth.value = window.innerWidth
  innerHeight.value = window.innerHeight
}

// 监听键盘事件
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    clearRectBox()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// 监听截图界面显示状态，动态添加/移除键盘监听
const watchMaskShow = () => {
  if (maskShow.value) {
    // 截图界面显示时，添加键盘监听
    document.addEventListener('keydown', handleKeydown)
  } else {
    // 截图界面隐藏时，移除键盘监听
    document.removeEventListener('keydown', handleKeydown)
  }
}

// 监听 maskShow 变化
import { watch } from 'vue'
watch(maskShow, watchMaskShow)
</script>

<style scoped>
#pdf-screenshot {
  @apply fixed inset-0 w-screen h-screen z-[999999] pointer-events-auto;
}

.screenshot-coverbg {
  @apply absolute inset-0 w-full h-full;
}

.mask {
  @apply absolute bg-black/50;
}

.mask.top {
  @apply top-0;
}

.mask.left {
  @apply left-0 top-0 h-full;
}

.mask.right {
  @apply right-0 top-0 h-full;
}

.mask.bottom {
  @apply bottom-0;
}

.rect-box {
  @apply absolute border-2 border-s-text-brand dark:border-s-text-brand-dark cursor-move transition-colors duration-200;
}

.circle {
  @apply absolute w-2 h-2 bg-s-text-brand dark:bg-s-text-brand-dark border border-white rounded-full transition-colors duration-200;
}

.circle.lt {
  @apply -top-1 -left-1 cursor-nw-resize;
}

.circle.rt {
  @apply -top-1 -right-1 cursor-ne-resize;
}

.circle.lb {
  @apply -bottom-1 -left-1 cursor-sw-resize;
}

.circle.rb {
  @apply -bottom-1 -right-1 cursor-se-resize;
}

.circle.ct {
  @apply -top-1 left-1/2 -translate-x-1/2 cursor-n-resize;
}

.circle.cb {
  @apply -bottom-1 left-1/2 -translate-x-1/2 cursor-s-resize;
}

.circle.cl {
  @apply -left-1 top-1/2 -translate-y-1/2 cursor-w-resize;
}

.circle.cr {
  @apply -right-1 top-1/2 -translate-y-1/2 cursor-e-resize;
}
</style>
