<template>
  <div class="pdf-app-root" :class="isDark ? 'dark' : ''">
    <PdfViewer />
  </div>
</template>

<script setup lang="ts">
import PdfViewer from './components/PdfViewer.vue'
import { useDarkMode } from '@/composables/useDarkMode'
const { isDark } = useDarkMode()
</script>

<style>
.pdf-app-root {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
