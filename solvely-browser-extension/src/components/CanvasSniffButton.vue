<template>
  <button
    :class="[
      'flex items-center justify-center gap-[5px] fixed text-s-interface-bg text-[14px] font-[400] border-none rounded-[6px] h-[30px] px-[12px] z-[999999] transition-colors duration-200',
      'top-[28px] right-[172px]',
      isDark ? 'dark' : '',
      loading
        ? 'bg-[#c4c6c9] cursor-not-allowed'
        : 'bg-s-text-brand dark:bg-s-text-brand-dark hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark cursor-pointer',
    ]"
    :disabled="loading"
    @click="handleClick"
  >
    <div class="w-[20px] h-[20px]" v-if="loading">
      <Vue3Lottie
        :animation-data="isDark ? loadingRingDark : loadingRing"
        :width="20"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{ margin: 0 }"
      />
    </div>
    <SvgIcon v-else name="open-book" size="20" />
    <span>Chat with PDF</span>
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { Vue3Lottie } from 'vue3-lottie'
import loadingRing from '@/assets/animations/loading-ring.json'
import loadingRingDark from '@/assets/animations/loading-ring-dark.json'
import SidepanelEventType from '@/entrypoints/sidepanel/types/eventTypes'
import { sniffPdfInfo } from '@/utils/canvasPageDetector'
import trackEvent from '@/utils/trackEvent'
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark } = useDarkMode()

const loading = ref(false)
let loadingTimeout: ReturnType<typeof setTimeout> | null = null
let timestamp: number | null = null

function endLoading() {
  loading.value = false
  if (loadingTimeout) {
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }
}


function handleClick() {
  if (loading.value) return
  const info = sniffPdfInfo()
  const url = info.url || window.location.href
  if (!url) return

  loading.value = true
  timestamp = Date.now()
  trackEvent.track('Plugin_pdfbutton_click',{
    type: 'canvas_pdf',
  })
  if (loadingTimeout) clearTimeout(loadingTimeout)
  loadingTimeout = setTimeout(() => {
    if (loading.value) loading.value = false
  }, 30000)

  browser.runtime.sendMessage({
    type: SidepanelEventType.GENERATE_FROM_CHAT_WITH_PDF,
    data: {
      url,
      pdfId: timestamp,
    },
  })
}

function onMessageListener(message: any) {
  if (message?.type === SidepanelEventType.CHAT_WITH_PDF_UPLOAD_SUCCESS) {
    endLoading()
    return
  }
}

// 复用 AiButton 的埋点：loading 状态变化
watch(loading, (newLoading) => {
  trackEvent.track('Plugin_sidebar_AiButton_loading', { status: newLoading })
})

onMounted(async () => {
  try {
    browser.runtime.onMessage.addListener(onMessageListener)
  } catch {}
  // 复用 AiButton 的展示埋点
  try {
    trackEvent.track('Plugin_pdfbutton_show',{
      type: 'canvas_pdf',
    })
  } catch {}
})

onBeforeUnmount(() => {
  try {
    browser.runtime.onMessage.removeListener(onMessageListener)
  } catch {}
  if (loadingTimeout) {
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }
})
</script> 