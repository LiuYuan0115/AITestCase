<template>
  <div
    v-if="show"
    class="pdf-loading-overlay"
  >
    <div class="pdf-loading-container">
      <div class="pdf-loading-content">
        <!-- Logo -->
        <div class="pdf-loading-logo">
          <SvgIcon name="logo" size="48" />
        </div>
        
        <!-- 标题 -->
        <div class="pdf-loading-title">
          {{ loadingTitle }}
        </div>
        
        <!-- Loading圈圈 -->
        <div v-if="!error" class="pdf-loading-spinner">
          <div class="spinner"></div>
        </div>
        
        <!-- 错误信息 -->
        <div class="pdf-loading-status error" v-if="error">
          <div>{{ error }}</div>
          <!-- 只有在非上传失败错误时才显示重试按钮 -->
          <button 
            v-if="!isUploadFailedError" 
            class="retry-btn" 
            @click="$emit('retry')"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'

// Props
interface Props {
  show: boolean
  loadingType: 'chunk' | 'cdn' | 'idle'
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  loadingType: 'idle',
  error: ''
})

defineEmits(['retry'])

// 计算属性
const loadingTitle = computed(() => {
  switch (props.loadingType) {
    case 'chunk':
      return 'Rendering PDF'
    case 'cdn':
      return 'Downloading PDF file'
    default:
      return 'Loading PDF'
  }
})

// 判断是否为上传失败错误
const isUploadFailedError = computed(() => {
  return props.error?.includes('Upload failed') || 
         props.error?.includes('Oops! Upload failed')
})
</script>

<style scoped>
.pdf-loading-overlay {
  @apply fixed inset-0 w-screen h-screen bg-white/95 dark:bg-s-interface-bg-dark/95 backdrop-blur-md z-[999999] flex items-center justify-center transition-colors duration-200;
}

.pdf-loading-container {
  @apply bg-s-interface-bg dark:bg-s-interface-bg-dark rounded-2xl shadow-2xl p-12 text-center w-96 transition-colors duration-200;
}

.pdf-loading-content {
  @apply flex flex-col items-center gap-6;
}

.pdf-loading-logo {
  @apply text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200;
}

.pdf-loading-title {
  @apply text-xl font-semibold text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark m-0 transition-colors duration-200;
}

/* 圆圈loading样式 */
.pdf-loading-spinner {
  @apply flex flex-col items-center gap-4;
}

.spinner {
  @apply w-12 h-12 border-4 border-s-disable-bg dark:border-s-disable-bg-dark border-t-s-text-brand dark:border-t-s-text-brand-dark rounded-full animate-spin;
}

.spinner-text {
  @apply text-sm text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark font-medium;
}

.pdf-loading-status {
  @apply text-sm text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark max-w-[280px] leading-relaxed transition-colors duration-200;
}
.pdf-loading-status.error {
  @apply text-s-function-erro dark:text-s-function-erro-dark font-normal;
}
.retry-btn {
  @apply mt-4 px-6 py-2 bg-s-text-brand dark:bg-s-text-brand-dark text-s-interface-bg dark:text-s-interface-bg-dark border-none rounded-lg text-sm font-medium cursor-pointer transition-colors duration-200;
}
.retry-btn:hover {
  @apply bg-s-hover-primary dark:bg-s-hover-primary-dark;
}
</style> 