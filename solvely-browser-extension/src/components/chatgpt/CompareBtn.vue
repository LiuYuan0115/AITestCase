<template>
<div :class="isDarkSystem ? 'dark' : ''">
   <div
    v-if="showCompareTip"
    class="flex h-[27px] select-none overflow-hidden transition-all hover:bg-[#eee] dark:hover:bg-[#303030] rounded-[6px] ml-2 group"
  >
    <!-- 左侧文字区域 -->
    <div
      class="flex flex-1 items-center px-[6px] transition-all cursor-pointer rounded-r-[6px] group-hover:rounded-r-none"
      @click="handleClick"
      @mouseenter="textHover = true"
      @mouseleave="textHover = false"
    >
      <span
        class="font-sans text-[14px] font-normal leading-[1.4] text-[#5D5D5D] dark:text-[#fff]"
      >
        Compare with Solvely
      </span>
    </div>
    <!-- 右侧关闭按钮区域 -->
    <div
      class="flex h-full w-[26px] cursor-pointer items-center justify-center bg-[#F6F8FA] dark:bg-[#414141] transition-all opacity-0 group-hover:opacity-100 hover:bg-[#E5E5E5] dark:hover:bg-[#5c5c5c]"
      @click="handleClose"
      @mouseenter="closeHover = true"
      @mouseleave="closeHover = false"
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        <line
          x1="4"
          y1="4"
          x2="12"
          y2="12"
          stroke="#555"
          stroke-width="1.5"
          stroke-linecap="round"
          class="dark:stroke-[#fff]"
        />
        <line
          x1="12"
          y1="4"
          x2="4"
          y2="12"
          stroke="#555"
          stroke-width="1.5"
          stroke-linecap="round"
          class="dark:stroke-[#fff]"
        />
      </svg>
    </div>
  </div>
</div>
 
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { modalService } from '@/services/modal/closeModalService'
import trackEvent from '@/utils/trackEvent'
import { ThrottledTrackEvent } from '@/utils/throttledTrackEvent'
import { STORAGE_KEY } from '~/config'
import { useDarkMode } from '@/composables/useDarkMode'
const { isDarkSystem } = useDarkMode()

const showCompareTip = ref(true)
const textHover = ref(false)
const closeHover = ref(false)

const handleClick = (event: Event) => {
  // 埋点：ChatGPT按钮点击
  trackEvent.track('Plugin_ChatGPT_Click')
}

// 在全局设置中关闭ChatGPT Compare开关
const closeInGlobal = async () => {
  try {
    await browser.storage.local.set({
      [STORAGE_KEY.CHATGPT_BTN_ENABLED]: false,
    })
    document
      .querySelectorAll('solvely-chatgpt-compare-btn')
      ?.forEach((item) => {
        item.remove()
      })
  } catch (error) {
    console.error('关闭ChatGPT Compare全局设置失败:', error)
  }
}

const handleClose = (event: Event) => {
  event.stopImmediatePropagation()
  event.preventDefault()

  // 埋点：ChatGPT按钮关闭
  trackEvent.track('Plugin_ChatGPT_Close')

  modalService.showModal({
    title: 'Disable',
    content: 'You can re-enable in settings',
    onConfirm: (selected: string) => {
      showCompareTip.value = false
      if (selected === 'global') {
        closeInGlobal()
      }
    },
  })
}

onMounted(() => {
  // 埋点：ChatGPT按钮显示（24小时内只上报一次）
  ThrottledTrackEvent.track('Plugin_ChatGPT_Show')
})
</script>
