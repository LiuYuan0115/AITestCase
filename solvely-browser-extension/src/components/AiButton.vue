<template>
  <button
    v-if="visible"
    :class="[
      'flex items-center justify-center gap-[5px] fixed text-s-interface-bg text-[14px] font-[400] border-none rounded-[6px] h-[30px] px-[12px] z-max transition-colors duration-200',
      browserClass,
      loading
        ? 'bg-[#c4c6c9] cursor-not-allowed'
        : 'bg-s-text-brand dark:bg-s-text-brand-dark hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark cursor-pointer',
    ]"
    :disabled="loading"
    @click="
      () => {
        handleClick()
      }
    "
  >
    <div class="w-[20px] h-[20px]" v-if="loading">
      <Vue3Lottie
        :animation-data="isDark ? loadingRingDark : loadingRing"
        :width="20"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{
          margin: 0,
        }"
      />
    </div>
    <SvgIcon v-else name="open-book" size="20" />
    <span>Chat with PDF</span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import SvgIcon from './common/SvgIcon.vue'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import { getTrpc } from '~/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'
import { Vue3Lottie } from 'vue3-lottie'
import loadingRing from '@/assets/animations/loading-ring.json'
import loadingRingDark from '@/assets/animations/loading-ring-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'

const visible = ref(false)
const loading = ref(false)
const { isDark } = useDarkMode()
const timestamp = ref<number | null>(null)
const sidepanelCheckInterval = ref<NodeJS.Timeout | null>(null)
let loadingTimeout: ReturnType<typeof setTimeout> | null = null

function getBrowser() {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'edge'
  if (/Chrome\//.test(ua)) return 'chrome'
  return 'other'
}

const browserClass = computed(() => {
  const browser = getBrowser()
  if (browser === 'chrome') {
    return 'top-[13px] right-[128px]'
  } else if (browser === 'edge') {
    return 'top-[5px] right-[202px]'
  } else {
    return 'top-[13px] right-[128px]'
  }
})

// 检查侧栏状态的函数
async function checkSidepanelStatus() {
  try {
    const status = await getTrpc().getSidepanelStatus.query()
    if (!status && loading.value) {
      loading.value = false
      clearSidepanelCheckInterval()
    }
  } catch (error) {
    console.error('Failed to check sidepanel status:', error)
    // 如果检查失败，也停止 loading 状态
    if (loading.value) {
      loading.value = false
      clearSidepanelCheckInterval()
    }
  }
}

// 清除定时器
function clearSidepanelCheckInterval() {
  if (sidepanelCheckInterval.value) {
    clearInterval(sidepanelCheckInterval.value)
    sidepanelCheckInterval.value = null
  }
}

// 启动定时器
function startSidepanelCheck() {
  clearSidepanelCheckInterval()
  sidepanelCheckInterval.value = setInterval(checkSidepanelStatus, 3000)
}

// 监听 loading 状态变化
watch(loading, (newLoading) => {
  if (newLoading) {
    // 开始 loading 时启动定时器
    startSidepanelCheck()
  } else {
    // 停止 loading 时清除定时器
    clearSidepanelCheckInterval()
  }
  trackEvent.track('Plugin_sidebar_AiButton_loading', {
    status: newLoading,
  })
})

async function handleClick() {
  trackEvent.track('Plugin_pdfbutton_click',{
    type: 'online_pdf',
  })
  loading.value = true
  timestamp.value = Date.now()
  // 启动30秒超时定时器
  if (loadingTimeout) clearTimeout(loadingTimeout)
  loadingTimeout = setTimeout(() => {
    if (loading.value) loading.value = false
  }, 30000)

  browser.runtime.sendMessage({
    // feature: 发送 Chat with PDF 请求
    // type: SidepanelEventType.GENERATE_QUIZ_FROM_CONTENT,
    type: SidepanelEventType.GENERATE_FROM_CHAT_WITH_PDF,
    data: {
      url: window.location.href,
      pdfId: timestamp.value,
    },
  })
}

function onMessageListener(message: any) {
  // 监听Chat-with-pdf-upload-success
  if (message?.type === SidepanelEventType.CHAT_WITH_PDF_UPLOAD_SUCCESS) {
    loading.value = false
    if (loadingTimeout) {
      clearTimeout(loadingTimeout)
      loadingTimeout = null
    }
    return
  }
}

onMounted(async () => {
  if (
    document.contentType === 'application/pdf' &&
    location.protocol !== 'file:'
  ) {
    visible.value = true
    trackEvent.track('Plugin_pdfbutton_show',{
      type: 'online_pdf',
    })
    browser.runtime.onMessage.addListener(onMessageListener)
  }
})

onBeforeUnmount(() => {
  browser.runtime.onMessage.removeListener(onMessageListener)
  // 清理定时器
  clearSidepanelCheckInterval()
  if (loadingTimeout) {
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }
})
</script>
