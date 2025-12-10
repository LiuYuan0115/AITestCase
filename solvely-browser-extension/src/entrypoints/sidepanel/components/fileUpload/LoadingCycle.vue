<template>
  <div :style="{ width: w + 'px', height: h + 'px' }" class="relative">
    <!-- 背景圆环 -->
    <svg :width="w" :height="h" :viewBox="`0 0 ${w} ${h}`" :style="{ transform: 'rotate(-90deg)' }">
      <circle
        :cx="w/2"
        :cy="h/2"
        :r="r"
        :stroke="isDark ? '#374151' : '#E5E7EB'"
        :stroke-width="strokeWidth"
        fill="none"
      />
      <!-- 进度圆环 -->
      <circle
        :cx="w/2"
        :cy="h/2"
        :r="r"
        :stroke="isDark ? '#51A9FE' : '#007AFF'"
        :stroke-width="strokeWidth"
        fill="none"
        stroke-linecap="round"
        :stroke-dasharray="2 * Math.PI * r"
        :stroke-dashoffset="2 * Math.PI * r * (1 - progress / 100)"
        class="transition-all duration-300 ease-out"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { useDarkMode } from '@/composables/useDarkMode'

interface Props {
  progress: number
  w?: number
  h?: number
  r?: number
  strokeWidth?: number
}
withDefaults(defineProps<Props>(), {
  w: 24,
  h: 24,
  r: 9,
  strokeWidth: 3
})

const { isDark } = useDarkMode()
</script>
