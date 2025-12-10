<template>
  <div
    :style="toolbarStyle"
    v-show="shouldShow"
    ref="toolbarRef"
    @mousedown="handleToolbarMouseDown"
    class="h-[36px] w-fit bg-b_card dark:bg-b_card_dk color-transition rounded-[12px] cursor-auto flex items-center justify-between gap-[6px] pl-[5px] pr-[7px] shadow-[0_0_24px_rgba(0,0,0,0.12)] relative group box-border border border-white dark:border-f_card_2_dk z-50"
  >
    <div
      v-if="props.isSolveLayer"
      class="flex gap-0.5 cursor-grab active:cursor-grabbing"
      @mousedown="handleMouseDown"
    >
      <i class="w-0.5 h-[14px] bg-d_1 dark:bg-d_1_dk rounded-full"></i>
      <i class="w-0.5 h-[14px] bg-d_1 dark:bg-d_1_dk rounded-full"></i>
    </div>

    <SvgIcon
      name="logo"
      size="22"
    />
    <div
      v-show="canShowInput && props.isSolveLayer"
      class="w-[calc(100%-38px)] h-full bg-b_card dark:bg-b_card_dk absolute top-0 right-0 flex items-center rounded-tr-[12px] rounded-br-[12px] pr-3"
    >
      <iframe
        ref="iframeRef"
        src="about:blank"
        class="w-full h-5 border-0"
        style="display: block"
      />
      <div
        class="w-[20px] h-[20px] flex items-center justify-center bg-b_brand dark:bg-b_brand_dk hover:bg-b_brand dark:hover:bg-b_brand_dk rounded-full transition-all duration-200 cursor-pointer"
      >
        <SvgIcon
          name="textSelection/select-send"
          size="20"
          @click="handleSend"
        />
      </div>
    </div>

    <!-- 按钮列表 -->
    <button
      v-for="btn in actionButtons"
      :key="btn.key"
      type="button"
      :class="[
        'pl-1 pr-1.5 h-[28px] rounded-[6px] flex items-center text-[14px] font-[400] cursor-pointer color-transition hover:bg-b_card_hov dark:hover:bg-b_card_hov_dk',
        btn.textColor,
        btn.width
      ]"
      @click="btn.handler"
    >
      <SvgIcon
        :name="btn.icon"
        :size="btn.iconSize"
        class="mr-0.5"
      />
      {{ btn.label }}
    </button>

    <i class="w-[1px] h-[16px] bg-d_1 dark:bg-d_1_dk color-transition"></i>

    <!-- Chat按钮 -->
    <button
      type="button"
      class="p-1 h-[28px] rounded-[6px] text-sm font-normal cursor-pointer flex justify-center color-transition hover:bg-b_card_hov dark:hover:bg-b_card_hov_dk text-t_brand dark:text-t_brand_dk"
      @click="toChat"
    >
      <SvgIcon
        name="textSelection/select-chat"
        size="20"
      />
    </button>

    <!-- 右上角关闭按钮 -->
    <button
      class="absolute right-[-8px] top-[-8px] rounded-full cursor-pointer color-transition hover:bg-b_btn_2 dark:hover:bg-b_btn_2_dk opacity-0 invisible group-hover:visible group-hover:opacity-100"
      @click.stop="toClose"
      style="padding: 0; border: none; background: transparent"
    >
      <SvgIcon
        name="textSelection/select-close"
        size="16"
      />
    </button>
  </div>
</template>

<script lang="ts" setup>
import SvgIcon from '@/components/common/SvgIcon.vue'
import { computed, ref, watch, nextTick } from 'vue'
import { useToolbarDraggable } from '@/composables/content/useToolbarDraggable'
import { useDarkMode } from '@/composables/useDarkMode'
import trackEvent from '@/utils/trackEvent'

const canShowInput = ref(false)

const props = defineProps<{
  shouldShow: boolean
  position: {
    left: string
    top: string
  }
  isSolveLayer: boolean
}>()

// 按钮配置映射表
const actionButtons = computed(() => [
  {
    key: 'solve',
    label: 'Solve',
    icon: 'textSelection/select-solve',
    iconSize: 20,
    textColor: 'text-t_brand dark:text-t_brand_dk',
    width: 'w-[69px]',
    handler: toSolve,
  },
  {
    key: 'explain',
    label: 'Explain',
    icon: 'textSelection/select-explain',
    iconSize: 20,
    textColor: 'text-t_1 dark:text-t_1_dk',
    width: 'w-[80px]',
    handler: toExplain,
  },
  {
    key: 'summarize',
    label: 'Summarize',
    icon: 'textSelection/select-summarize',
    iconSize: 20,
    textColor: 'text-t_1 dark:text-t_1_dk',
    width: 'w-[106px]',
    handler: toSummarize,
  },
  {
    key: 'quiz',
    label: 'Quiz',
    icon: 'textSelection/select-quiz',
    iconSize: 20,
    textColor: 'text-t_1 dark:text-t_1_dk',
    width: 'w-[62px]',
    handler: toQuiz,
  },
])

// 使用拖拽 composable
const { dragOffset, isDragging, handleMouseDown, resetOffset } = useToolbarDraggable()
// 使用暗黑模式 composable
const { isDark } = useDarkMode()

// iframe 引用
const iframeRef = ref<HTMLIFrameElement>()
let iframeInput: HTMLInputElement | null = null

// 处理工具栏的 mousedown，防止清除选区
const handleToolbarMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

// 设置 iframe 内容
const setupIframe = () => {
  const iframe = iframeRef.value
  if (!iframe || !iframe.contentDocument) return

  const doc = iframe.contentDocument

  // 写入 HTML 内容
  doc.documentElement.innerHTML = `
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          margin: 0; 
          padding: 0;
          overflow: hidden;
        }
        input {
          width: 100%;
          height: 20px;
          border: none;
          border-radius: 4px;
          padding: 0 8px;
          outline: none;
          font-size: 14px;
          font-weight: 400;
          line-height: 140%;
          font-family: inherit;
          color: #111111;
          background: transparent;
        }
        input::placeholder {
          color: #989B9E;
          font-weight: 400;
        }
        input:focus {
          caret-color: #007AFF;
        }
        /* 暗黑模式 */
        .dark input {
          color: #fff;
        }
        .dark input::placeholder {
          color: #A4A6AB;
        }
      </style>
    </head>
    <body>
      <input type="text" id="iframe-input" placeholder="Ask me any questions" />
    </body>
  `

  // 获取 input 引用
  iframeInput = doc.getElementById('iframe-input') as HTMLInputElement

  // 应用初始暗黑模式状态
  updateIframeDarkMode()

  // 监听回车键
  if (iframeInput) {
    iframeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    })
  }

  if (iframeInput) {
    iframeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()

        if (canShowInput.value) {
          // 第一次 ESC：关闭输入框并将焦点移出 iframe，便于后续快捷键由宿主页面接管
          canShowInput.value = false
          iframeInput?.blur()
          iframeRef.value?.blur()
          iframeRef.value?.contentWindow?.blur()
          window.focus()
        } else {
          // 输入框已关闭时，将 ESC 事件转发至宿主文档以关闭工具栏
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          )
        }
      }
    })
  }
}

// 更新 iframe 的暗黑模式状态
const updateIframeDarkMode = () => {
  const iframe = iframeRef.value
  if (!iframe || !iframe.contentDocument) return

  const body = iframe.contentDocument.body
  if (isDark.value) {
    body.classList.add('dark')
  } else {
    body.classList.remove('dark')
  }
}

// 处理发送按钮点击
const handleSend = () => {
  if (!iframeInput) return

  const text = iframeInput.value.trim()
  if (!text) return

  // 🎯 添加埋点
  trackEvent.track('Plugin_NewPanel_Chat_Send',{
    input: text,
    from: 'textSelection',
  })

  // 清空输入框
  iframeInput.value = ''

  // 隐藏输入框
  canShowInput.value = false
  
  // 🔧 释放焦点
  iframeInput.blur()

  // 触发 Chat 浮层
  emit('toChat', {
    position: getToolbarPosition(),
    input: text,
  })
}

// 监听暗黑模式变化
watch(isDark, () => updateIframeDarkMode())

// 监听拖拽状态，拖拽结束时触发事件
watch(isDragging, async (newValue, oldValue) => {
  // 从拖拽状态变为非拖拽状态（拖拽结束）
  if (oldValue && !newValue) {
    // 1. 计算并发送最终位置（包含 dragOffset）
    emit('dragEnd', { position: getToolbarPosition() })

    // 2. 等待父组件更新 props.position 后再重置 dragOffset
    // 避免时序问题：resetOffset 后 props 还未更新，导致显示位置跳回旧位置
    await nextTick()

    // 3. 重置拖拽偏移（此时 props.position 已更新为约束后的位置）
    resetOffset()
  }
})

const toolbarStyle = computed(() => {
  // 解析原始位置
  const leftValue = parseFloat(props.position.left)
  const topValue = parseFloat(props.position.top)

  return {
    position: 'absolute' as const,
    left: `${leftValue + dragOffset.value.x}px`,
    top: `${topValue + dragOffset.value.y}px`,
    pointerEvents: 'auto' as const,
    cursor: isDragging.value ? 'grabbing' : 'auto',
  }
})

const emit = defineEmits<{
  (e: 'toSolve', payload: { position: { left: string; top: string } }): void
  (e: 'toExplain', payload: { position: { left: string; top: string } }): void
  (e: 'toSummarize', payload: { position: { left: string; top: string } }): void
  (e: 'toQuiz', payload: { position: { left: string; top: string } }): void
  (e: 'toChat', payload: { position: { left: string; top: string }; input: string }): void
  (e: 'toClose'): void
  (e: 'dragEnd', payload: { position: { left: string; top: string } }): void
}>()

// 计算当前工具栏的绝对位置
const getToolbarPosition = () => {
  const leftValue = parseFloat(props.position.left) + dragOffset.value.x
  const topValue = parseFloat(props.position.top) + dragOffset.value.y

  return {
    left: `${leftValue}px`,
    top: `${topValue}px`,
  }
}

const toSolve = () => {
  emit('toSolve', { position: getToolbarPosition() })
}

const toExplain = () => {
  emit('toExplain', { position: getToolbarPosition() })
}

const toSummarize = () => {
  emit('toSummarize', { position: getToolbarPosition() })
}

const toQuiz = () => {
  emit('toQuiz', { position: getToolbarPosition() })
}

const toChat = () => {
  if (!props.isSolveLayer) {
    emit('toChat', { position: getToolbarPosition(), input: '' })
  } else {
    canShowInput.value = true
    setupIframe()
    setTimeout(() => {
      iframeInput?.focus()
    }, 100)
  }
}

const toClose = () => {
  emit('toClose')
}
</script>
