<template>
  <div
    v-if="contentScriptChecker.showModal.value"
    class="fixed inset-0 flex items-center justify-center z-50 modal"
  >
    <div class="absolute inset-0 bg-[#555] dark:opacity-80 dark:bg-black opacity-60"></div>
    <div
      class="modal-content relative w-[328px] rounded-[12px] bg-s-interface-bg dark:bg-s-interface-bg-dark flex flex-col items-center p-[20px_34px_24px] z-10 text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
    >
      <SvgIcon name="error" :size="32" class="!text-[#F6A507]" />
      <div class="mt-[10px] text-[16px] font-bold leading-[130%]">
        Can't run on this page
      </div>
      <div class="mt-[6px] text-[14px] leading-[140%] text-center">
        Unable to read PDF from local storage. You can upload pdf file to plugin and chat with it.
      </div>
      
      <!-- 按钮区域 -->
      <div class="mt-[12px] w-full flex gap-[8px]">
        <button
          class="flex-1 h-[32px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border dark:border-s-border-dark rounded-[6px] text-[14px] font-normal cursor-pointer hover:bg-s-hover-bg dark:hover:bg-s-hover-bg-dark transition-colors duration-200"
          @click="handleClose"
        >
          Got it
        </button>
        <button
          v-if="contentScriptChecker.currentTabUrl.value?.startsWith('file://')"
          class="flex-1 h-[32px] text-white bg-s-text-brand dark:bg-s-text-brand-dark rounded-[6px] text-[14px] font-normal cursor-pointer hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark transition-colors duration-200"
          @click="handleUpload"
        >
          Upload
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import contentScriptChecker from '../composables/useContentScriptChecker'
import trackEvent from '~/utils/trackEvent'
import { watch } from 'vue'

const handleClose = () => {
  contentScriptChecker.closeModal()
  trackEvent.track('Plugin_Sidebar_LocalPDF_Got_it')
}

const handleUpload = async () => {
  trackEvent.track('Plugin_Sidebar_LocalPDF_Upload')
  await contentScriptChecker.handleUpload()
}

watch(contentScriptChecker.showModal, (newVal) => {
  if (newVal) {
    trackEvent.track('Plugin_Sidebar_LocalPDF_Show')
  } else {
    trackEvent.track('Plugin_nosupport_close')
  }
})
</script>

<style scoped>
.modal {
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  animation: scaleIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
