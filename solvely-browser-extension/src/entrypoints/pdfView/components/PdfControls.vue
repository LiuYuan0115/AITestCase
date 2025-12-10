<template>
  <div class="controls">
    <div class="logo-section">
      <SvgIcon name="logo" :size="32" />
      <SvgIcon name="solvelyAi" :customClass="'!h-8 !w-28'" />
    </div>
    <div class="center-controls">
      <div class="zoom-controls">
        <button
          class="zoom-btn"
          @click="emit('zoomOut')"
          :disabled="currentScale <= minScale"
          title="缩小"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <div class="scale-input-group">
          <input
            type="number"
            class="scale-input"
            v-model.number="inputScaleProxy"
            @blur="onScaleInputBlur"
            @keydown.enter="onScaleInputBlur"
            :min="minScale"
            :max="maxScale"
          />
          <span class="scale-unit">%</span>
        </div>
        <button
          class="zoom-btn"
          @click="emit('zoomIn')"
          :disabled="currentScale >= maxScale"
          title="放大"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div class="controls-divider"></div>

      <div class="page-controls">
        <span class="page-label">Page</span>
        <input
          type="number"
          class="page-input"
          v-model.number="inputPageProxy"
          @blur="onPageInputBlur"
          @keydown.enter="onPageInputBlur"
          :min="1"
          :max="totalPages"
        />
        <span class="page-label">of {{ totalPages }}</span>
      </div>
    </div>
    <div class="w-36"></div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import { watch, ref } from 'vue'
const props = defineProps<{
  currentScale: number
  minScale: number
  maxScale: number
  inputScale: number
  totalPages: number
  currentPage: number
  inputPage: number
}>()
const emit = defineEmits([
  'zoomIn',
  'zoomOut',
  'update:inputScale',
  'update:inputPage',
])

const inputScaleProxy = ref(props.inputScale)
const inputPageProxy = ref(props.inputPage)

watch(
  () => props.inputScale,
  (val) => {
    inputScaleProxy.value = val
  }
)
watch(
  () => props.inputPage,
  (val) => {
    inputPageProxy.value = val
  }
)
const onScaleInputBlur = () => emit('update:inputScale', inputScaleProxy.value)
const onPageInputBlur = () => emit('update:inputPage', inputPageProxy.value)
</script>

<style scoped>
.controls {
  @apply w-screen h-14 bg-s-interface-bg dark:bg-s-interface-bg-dark border-b border-s-border dark:border-s-border-dark flex items-center justify-between px-6 relative z-10 transition-colors duration-200;
}

.logo-section {
  @apply flex items-center text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors;
}

.center-controls {
  @apply flex items-center gap-8;
}

.zoom-controls {
  @apply flex items-center gap-3;
}

.zoom-btn {
  @apply w-8 h-8 border-2 border-s-border-secondary dark:border-s-border-secondary-dark bg-s-interface-bg dark:bg-s-interface-bg-dark text-s-text-brand dark:text-s-text-brand-dark rounded-md cursor-pointer flex items-center justify-center transition-all duration-200;
}

.zoom-btn:hover:not(:disabled) {
  @apply text-s-hover-primary dark:text-s-hover-primary-dark border-s-text-brand dark:border-s-text-brand-dark;
}

.zoom-btn:active:not(:disabled) {
  @apply border-s-hover-primary dark:border-s-hover-primary-dark;
}

.zoom-btn:disabled {
  @apply bg-s-disable-bg dark:bg-s-disable-bg-dark text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark cursor-not-allowed border-s-border dark:border-s-border-dark;
}

.scale-input-group {
  @apply flex items-center border-2 border-s-border-secondary dark:border-s-border-secondary-dark rounded-md p-1 px-2 bg-s-interface-bg dark:bg-s-interface-bg-dark transition-colors duration-200;
}

.scale-input-group:focus-within {
  @apply border-s-text-brand dark:border-s-text-brand-dark;
}

.scale-input {
  @apply w-[60px] border-none bg-transparent text-center text-sm font-medium text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark outline-none transition-colors duration-200;
}

.scale-input::-webkit-outer-spin-button,
.scale-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.scale-input[type='number'] {
  appearance: textfield;
}

.scale-unit {
  @apply text-s-text-brand dark:text-s-text-brand-dark font-medium text-sm ml-1 transition-colors duration-200;
}

.controls-divider {
  @apply w-px h-6 bg-s-border dark:bg-s-border-dark transition-colors duration-200;
}

.page-controls {
  @apply flex items-center gap-2;
}

.page-label {
  @apply text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-sm font-medium transition-colors duration-200;
}

.page-input {
  @apply w-12 border-2 border-s-border-secondary dark:border-s-border-secondary-dark bg-s-interface-bg dark:bg-s-interface-bg-dark text-center text-sm font-medium text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark rounded-md p-1 outline-none transition-colors duration-200;
}

.page-input:focus {
  @apply border-s-text-brand dark:border-s-text-brand-dark;
}

.page-input::-webkit-outer-spin-button,
.page-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.page-input[type='number'] {
  appearance: textfield;
}
</style>
