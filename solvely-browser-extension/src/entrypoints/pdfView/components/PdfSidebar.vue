<template>
  <div class="sidebar">
    <canvas
      v-for="page in totalPages"
      :key="page"
      :ref="el => sidebarCanvases[page-1] = el as HTMLCanvasElement | null" 
      :data-page="page"
      :class="{ active: page === currentPage }"
      @click="() => emit('sidebarClick', page)"
      class="w-[140px] max-w-[90%] m-auto mt-2 rounded-md shadow-sm cursor-pointer block"
    />
  </div>
</template>

<script setup lang="ts">
import { watch, nextTick } from 'vue'

const props = defineProps<{
  totalPages: number
  currentPage: number
  sidebarCanvases: (HTMLCanvasElement | null)[]
}>()
const emit = defineEmits(['sidebarClick'])

// 监听当前页面变化，自动滚动到对应的缩略图
watch(() => props.currentPage, (newPage) => {
  nextTick(() => {
    const activeCanvas = document.querySelector(`.sidebar canvas[data-page="${newPage}"]`) as HTMLElement
    if (activeCanvas) {
      activeCanvas.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    }
  })
})
</script>

<style scoped>
.sidebar {
  @apply w-[180px] bg-gradient-to-b bg-s-panel-bg dark:bg-s-panel-bg-dark border-r border-r-s-border dark:border-r-s-border-dark overflow-y-auto z-[2] grid grid-cols-1 auto-rows-min gap-3 justify-items-center items-start py-4 shadow-lg min-w-40 max-w-[180px] transition-colors duration-200;
}
.sidebar canvas {
  @apply transition-all duration-300 border-2 border-transparent;
}
.sidebar canvas.active {
  @apply border-2 border-s-text-brand dark:border-s-text-brand-dark shadow-lg shadow-s-text-brand/20 dark:shadow-s-text-brand-dark/20;
}

/* 滚动条样式 */
.sidebar::-webkit-scrollbar {
  @apply w-2;
}

.sidebar::-webkit-scrollbar-track {
  @apply bg-s-panel-bg dark:bg-s-panel-bg-dark;
}

.sidebar::-webkit-scrollbar-thumb {
  @apply bg-s-interface-bg/80 dark:bg-s-border-dark/80 rounded-full;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  @apply bg-s-interface-bg dark:bg-s-border-dark;
}
</style> 