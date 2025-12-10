<template>
  <div class="w-full flex">
    <div class="flowing-container">
      <div
        class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark flowing-text"
      >
        <slot></slot>
      </div>
      <div class="flowing-mask"></div>
    </div>
    <div class="flex-1"></div>
    <!-- 动态注入CSS -->
    <component :is="'style'" v-html="dynamicCSS"></component>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 定义 props
interface Props {
  duration?: number // 流光动画持续时间，单位：秒
  pause?: number // 暂停时间，单位：秒
}

// 设置默认值
const props = withDefaults(defineProps<Props>(), {
  duration: 2, // 默认2秒流光
  pause: 1, // 默认1.1秒暂停
})

// 动态生成CSS并注入到组件内部
const dynamicCSS = computed(() => {
  const totalDuration = props.duration + props.pause
  const animationPercent = (props.duration / totalDuration) * 100

  return `
    .flowing-mask {
      animation: sweepWithPause ${totalDuration}s linear infinite;
    }
    @keyframes sweepWithPause {
      0% { left: -100%; }
      ${animationPercent}% { left: 200%; }
      99.99% { left: 200%; }
      100% { left: -100%; }
    }
  `
})
</script>

<style scoped>
.flowing-container {
  position: relative;
  overflow: hidden;
}

.flowing-mask {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 30%,
    rgba(255, 255, 255, 0.8) 50%,
    transparent 70%
  );
  pointer-events: none;
  transition: all 0.2s ease-in-out;
}

.dark .flowing-mask {
  background: linear-gradient(
    90deg,
    transparent 30%,
    rgba(22, 27, 38, 0.8) 50%,
    transparent 70%
  );
}
</style>
