<template>
  <div
    class="relative inline-flex items-center justify-center"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <slot />
    <Transition
      name="tooltip"
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      :enter-from-class="getEnterFromClass()"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      :leave-to-class="getLeaveToClass()"
    >
      <div
        v-show="show"
        class="absolute z-50 pointer-events-none"
        :class="[getTooltipClasses(), hasSlotContent ? '' : 'whitespace-nowrap']"
        role="tooltip"
      >
        <!-- tooltip 方块，可以独立偏移 -->
        <div
          class="px-2 py-1 text-[14px] text-white bg-b_tip dark:bg-b_tip_dk rounded-[4px] max-w-[220px]"
          :style="getTooltipBoxStyle()"
        >
          <!-- 优先使用具名插槽内容 -->
          <slot name="content">
            <!-- 降级：使用 text prop -->
            {{ text }}
          </slot>
        </div>
        <!-- 箭头，保持原位 -->
        <div
          class="absolute w-0 h-0"
          :class="getArrowClasses()"
        ></div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, useSlots, computed } from 'vue'

const props = defineProps<{
  text?: string // 🎯 改为可选，支持插槽模式
  position?: 'top' | 'bottom' | 'left' | 'right'
  offset?: {
    x?: number // 水平偏移，单位px
    y?: number // 垂直偏移，单位px
  }
  disabled?: boolean // 🎯 禁用 tooltip，不显示任何内容
}>()

const slots = useSlots()
const show = ref(false)

// 判断是否使用了具名插槽
const hasSlotContent = computed(() => !!slots.content)

// 判断是否有任何内容（插槽或文字）
const hasContent = computed(() => hasSlotContent.value || !!props.text)

// 监听鼠标悬停事件
const handleMouseEnter = () => {
  // 禁用时不显示
  if (props.disabled) {
    return
  }
  // 只有在有内容时才显示
  if (hasContent.value) {
    show.value = true
  }
}

const handleMouseLeave = () => {
  show.value = false
}

// 根据位置获取进入动画的起始类
const getEnterFromClass = () => {
  switch (props.position) {
    case 'top':
    case undefined:
      return 'opacity-0 scale-95 translate-y-1'
    case 'bottom':
      return 'opacity-0 scale-95 -translate-y-1'
    case 'left':
      return 'opacity-0 scale-95 -translate-x-1'
    case 'right':
      return 'opacity-0 scale-95 translate-x-1'
    default:
      return 'opacity-0 scale-95 translate-y-1'
  }
}

// 根据位置获取离开动画的结束类
const getLeaveToClass = () => {
  switch (props.position) {
    case 'top':
    case undefined:
      return 'opacity-0 scale-95 translate-y-1'
    case 'bottom':
      return 'opacity-0 scale-95 -translate-y-1'
    case 'left':
      return 'opacity-0 scale-95 -translate-x-1'
    case 'right':
      return 'opacity-0 scale-95 translate-x-1'
    default:
      return 'opacity-0 scale-95 translate-y-1'
  }
}

// 获取 tooltip 的 CSS 类（最外层容器，不包含偏移）
const getTooltipClasses = () => {
  switch (props.position) {
    case 'top':
    case undefined:
      return ['bottom-full', 'left-1/2', '-translate-x-1/2', 'mb-[10px]']
    case 'bottom':
      return ['top-full', 'left-1/2', '-translate-x-1/2', 'mt-[10px]']
    case 'left':
      return ['right-full', 'top-1/2', '-translate-y-1/2', 'mr-[10px]']
    case 'right':
      return ['left-full', 'top-1/2', '-translate-y-1/2', 'ml-[10px]']
    default:
      return ['bottom-full', 'left-1/2', '-translate-x-1/2', 'mb-[10px]']
  }
}

// 获取 tooltip 方块的样式（独立控制偏移）
const getTooltipBoxStyle = () => {
  if (!props.offset) return {}

  const style: Record<string, string> = {}

  if (props.offset.x !== undefined || props.offset.y !== undefined) {
    const transforms = []

    if (props.offset.x !== undefined) {
      transforms.push(`translateX(${props.offset.x}px)`)
    }
    if (props.offset.y !== undefined) {
      transforms.push(`translateY(${props.offset.y}px)`)
    }

    if (transforms.length > 0) {
      style.transform = transforms.join(' ')
    }
  }

  return style
}

// 获取箭头的 CSS 类（箭头保持原位）
const getArrowClasses = () => {
  switch (props.position) {
    case 'top':
    case undefined:
      return 'top-full left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-b_tip dark:border-t-b_tip_dk'
    case 'bottom':
      return 'bottom-full left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-b_tip dark:border-b-b_tip_dk'
    case 'left':
      return 'left-full top-1/2 -translate-y-1/2 border-t-[6px] border-b-[6px] border-l-[6px] border-t-transparent border-b-transparent border-l-b_tip dark:border-l-b_tip_dk'
    case 'right':
      return 'right-full top-1/2 -translate-y-1/2 border-t-[6px] border-b-[6px] border-r-[6px] border-t-transparent border-b-transparent border-r-b_tip dark:border-r-b_tip_dk'
    default:
      return 'top-full left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-b_tip dark:border-t-b_tip_dk'
  }
}
</script>
