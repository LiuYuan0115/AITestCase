<template>
  <div
    class="neo-tooltip-wrapper"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 触发元素 -->
    <slot />

    <!-- Tooltip 气泡 -->
    <Teleport to="body">
      <Transition name="neo-tooltip">
        <div
          v-if="isVisible"
          ref="tooltipRef"
          class="neo-tooltip"
          :class="[`neo-tooltip--${position}`]"
          :style="tooltipStyle"
          role="tooltip"
        >
          <div class="neo-tooltip__content" :style="contentStyle">
            <slot name="content">{{ text }}</slot>
          </div>
          <div class="neo-tooltip__arrow" :class="[`neo-tooltip__arrow--${position}`]"></div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, useSlots } from 'vue';

const props = withDefaults(defineProps<{
  text?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
  delay?: number;
  maxWidth?: number;
}>(), {
  position: 'bottom',
  disabled: false,
  delay: 0,
  maxWidth: 200
});

const slots = useSlots();

// 状态
const isVisible = ref(false);
const triggerRect = ref<DOMRect | null>(null);
let showTimer: ReturnType<typeof setTimeout> | null = null;

// 检查是否有内容
const hasContent = computed(() => !!slots.content || !!props.text);

// 内容样式
const contentStyle = computed(() => ({
  maxWidth: props.maxWidth + 'px'
}));

// 计算 Tooltip 位置
const tooltipStyle = computed(() => {
  if (!triggerRect.value) return {};

  const rect = triggerRect.value;
  const gap = 8;

  let top = 0;
  let left = 0;

  switch (props.position) {
    case 'top':
      top = rect.top + window.scrollY - gap;
      left = rect.left + window.scrollX + rect.width / 2;
      break;
    case 'bottom':
      top = rect.bottom + window.scrollY + gap;
      left = rect.left + window.scrollX + rect.width / 2;
      break;
    case 'left':
      top = rect.top + window.scrollY + rect.height / 2;
      left = rect.left + window.scrollX - gap;
      break;
    case 'right':
      top = rect.top + window.scrollY + rect.height / 2;
      left = rect.right + window.scrollX + gap;
      break;
  }

  return {
    top: `${top}px`,
    left: `${left}px`
  };
});

// 事件处理
function handleMouseEnter(event: MouseEvent) {
  if (props.disabled || !hasContent.value) return;

  const target = event.currentTarget as HTMLElement;
  triggerRect.value = target.getBoundingClientRect();

  if (props.delay > 0) {
    showTimer = setTimeout(() => {
      isVisible.value = true;
    }, props.delay);
  } else {
    isVisible.value = true;
  }
}

function handleMouseLeave() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  isVisible.value = false;
}

onUnmounted(() => {
  if (showTimer) {
    clearTimeout(showTimer);
  }
});
</script>

<style scoped>
.neo-tooltip-wrapper {
  display: inline-flex;
  position: relative;
}

.neo-tooltip {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
}

.neo-tooltip--top {
  transform: translateX(-50%) translateY(-100%);
}

.neo-tooltip--bottom {
  transform: translateX(-50%);
}

.neo-tooltip--left {
  transform: translateX(-100%) translateY(-50%);
}

.neo-tooltip--right {
  transform: translateY(-50%);
}

.neo-tooltip__content {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  color: #FFFEF9;
  background: #1a1a1a;
  border: 2px solid #1a1a1a;
  border-radius: 4px;
  box-shadow: 2px 2px 0 #1a1a1a;
  white-space: nowrap;
}

/* 箭头样式 */
.neo-tooltip__arrow {
  position: absolute;
  width: 0;
  height: 0;
}

.neo-tooltip__arrow--top {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #1a1a1a;
}

.neo-tooltip__arrow--bottom {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid #1a1a1a;
}

.neo-tooltip__arrow--left {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid #1a1a1a;
}

.neo-tooltip__arrow--right {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #1a1a1a;
}

/* 过渡动画 */
.neo-tooltip-enter-active {
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.neo-tooltip-leave-active {
  transition: opacity 0.1s ease-in, transform 0.1s ease-in;
}

.neo-tooltip-enter-from,
.neo-tooltip-leave-to {
  opacity: 0;
}

.neo-tooltip-enter-from.neo-tooltip--top,
.neo-tooltip-leave-to.neo-tooltip--top {
  transform: translateX(-50%) translateY(calc(-100% + 4px));
}

.neo-tooltip-enter-from.neo-tooltip--bottom,
.neo-tooltip-leave-to.neo-tooltip--bottom {
  transform: translateX(-50%) translateY(-4px);
}

.neo-tooltip-enter-from.neo-tooltip--left,
.neo-tooltip-leave-to.neo-tooltip--left {
  transform: translateX(calc(-100% + 4px)) translateY(-50%);
}

.neo-tooltip-enter-from.neo-tooltip--right,
.neo-tooltip-leave-to.neo-tooltip--right {
  transform: translateY(-50%) translateX(-4px);
}
</style>
