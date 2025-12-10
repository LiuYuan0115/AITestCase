<template>
  <Transition name="paywall">
    <div
      v-if="showPaywall"
      ref="panelRef"
      :style="panelStyle"
      class="relative"
    >
      <div
        class="absolute left-0 top-0 w-full h-[16px] flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing z-[1]"
        @mousedown="handleDragMouseDown"
      >
        <i class="h-0.5 w-[14px] bg-t_3 dark:bg-t_3_dk rounded-full mt-[7px] color-transition"></i>
        <i class="h-0.5 w-[14px] bg-t_3 dark:bg-t_3_dk rounded-full color-transition"></i>
      </div>
      <!-- 关闭按钮 -->
      <div
        class="absolute top-2 right-2 text-t_2 dark:text-t_2_dk cursor-pointer flex items-center justify-center h-6 w-6 rounded-full bg-transparent hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk color-transition z-[2]"
        @click="handleClose"
      >
        <SvgIcon
          name="textSelection/layer-close"
          size="12"
        />
      </div>
      <!-- 商业化弹窗 -->
      <div class="w-[360px] flex items-center justify-center">
        <PricePanelFullV2 showModel="popup" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, provide, inject } from 'vue'
import { throttle } from 'lodash-es'
import PricePanelFullV2 from '@/entrypoints/sidepanel/components/business/PricePanelFullV2.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import usePaywall from '@/composables/usePaywall'

// 使用 Paywall 单例（解构 ref 以保持响应式连接）
const { showPaywall, handleClose: paywallHandleClose } = usePaywall()

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
  e.stopPropagation()

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

// 处理关闭
const handleClose = () => {
  paywallHandleClose()
}

// 组件挂载后初始化位置
onMounted(() => {
  // 监听 paywall 显示状态变化，当显示时初始化位置
  watch(
    () => showPaywall.value,
    (newVal) => {
      if (newVal) {
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
      }
    },
    { immediate: true }
  )

  // 监听窗口大小变化
  window.addEventListener('resize', throttledCheckPosition)
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('resize', throttledCheckPosition)
})
</script>

<style scoped>
/* 进入动画 */
.paywall-enter-active {
  transition: all 0.1s ease-out;
  transform-origin: top right;
}

/* 离开动画 */
.paywall-leave-active {
  transition: all 0.1s ease-in;
  transform-origin: top right;
}

/* 进入的初始状态 */
.paywall-enter-from {
  opacity: 0;
  transform: translateY(0) scaleX(0.97) scaleY(0.75);
}

/* 离开的最终状态 */
.paywall-leave-to {
  opacity: 0;
  transform: translateY(0) scaleX(1) scaleY(1);
}

/* 进入和离开的正常状态 */
.paywall-enter-to,
.paywall-leave-from {
  opacity: 1;
  transform: translateY(0) scaleX(1) scaleY(1);
}
</style>
