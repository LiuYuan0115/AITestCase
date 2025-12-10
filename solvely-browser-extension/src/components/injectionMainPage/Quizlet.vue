<template>
  <div
    v-if="isReady"
    :class="
      isABTestOn
        ? 'absolute top-0 left-0 w-full h-full group'
        : 'relative group'
    "
  >
    <div
      class="flex items-center justify-center gap-2 max-h-[6.25rem] rounded-lg cursor-pointer border-b-4 border-transparent bg-[#f6f7fb] shadow-[0_1px_3px_0_rgba(40,46,62,0.1)] cursor hover:shadow-[0_.25rem_1rem_0_#282e3e1a] hover:border-b-[#a8b1ff]"
      :class="
        isLoginQuizlet && !isNarrowScreen
          ? 'flex-row p-[0.5rem]'
          : 'flex-col py-4 px-2'
      "
      @click="handleClick"
    >
      <div class="flex items-center justify-center h-[32px]">
        <SvgIcon v-if="loading" name="loading" size="20" class="animate-spin" />
        <quizletEntryIcon v-else />
      </div>
      <div class="text-[16px] font-[600]">AI Quiz</div>
    </div>
    <div
      class="absolute -top-[12px] -right-[12px] w-[24px] h-[24px] flex items-center justify-center rounded-full bg-[#999] text-[#ffffff] opacity-0 group-hover:opacity-60 cursor-pointer transition-opacity duration-200"
      @click.stop="handleClose"
    >
      <SvgIcon name="close2" size="10" />
    </div>
    <CloseModal />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import trackEvent from '~/utils/trackEvent'
import { isQuizletABTestOn } from '~/utils/abtest'
import quizletEntryIcon from '~/assets/icons/quizlet-entry-icon.svg'
import CloseModal from '~/components/common/CloseModal.vue'
import { modalService } from '~/services/modal/closeModalService'
import type { RadioOption as CloseModalRadioOption } from '~/components/common/CloseModal.vue'
import { useSetting } from '@/composables/content/useSetting'
import { QUIZLET_SELECTORS, QUIZLET_EVENTS } from '~/types/content'

const isReady = ref(false)
const isABTestOn = ref(false)
const loading = ref(false)
const isLoginQuizlet = ref(false)
const isNarrowScreen = ref(false)

const { closeInThisPage, closeInGlobal } = useSetting('quizlet-btn')

async function handleClick() {
  if (loading.value) return

  loading.value = true

  try {
    const titleElement = document.querySelector(QUIZLET_SELECTORS.title)
    const title = titleElement?.textContent?.trim()

    browser.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_QUIZ_FROM_QUIZLET,
      data: {
        url: window.location.href,
        title: title,
      },
    })

    trackEvent.track(QUIZLET_EVENTS.BUTTON_CLICK, {
      url: window.location.href,
      isABTestOn: isABTestOn.value,
    })
  } catch (err) {
    loading.value = false
    trackEvent.trackError('Plugin_Quizletbutton_Click_Error', err)
  }
}

function onMessageListener(message: any): void {
  if (
    message.type === SidepanelEventType.GENERATE_QUIZ_SUCCESS ||
    message.type === SidepanelEventType.GENERATE_QUIZ_FAIL ||
    (message.type === SidepanelEventType.STATUS_CHANGED &&
      message.data.isOpen === false)
  ) {
    loading.value = false
  }
  // 处理从侧边栏触发的 Quizlet 按钮点击
  if (message?.type === SidepanelEventType.GENERATE_QUIZ_TO_CONTENT) {
    handleClick()
  }
}

const handleClose = (e: MouseEvent) => {
  modalService.showModal({
    title: 'Disable',
    content: 'You can re-enable in settings',
    onConfirm: (confirmValue: CloseModalRadioOption['value']) => {
      if (confirmValue === 'next-visit') {
        closeInThisPage()
        // 发送消息通知内容脚本销毁UI
        window.postMessage(
          {
            type: 'QUIZLET_CLOSE_IN_THIS_PAGE',
            source: 'solvely-quizlet-component',
            timestamp: Date.now(),
          },
          '*'
        )
      } else if (confirmValue === 'global') {
        closeInGlobal()
      }
    },
  })
  trackEvent.track('Plugin_Quizletbutton_Close', {
    url: window.location.href,
    isABTestOn: isABTestOn.value,
  })
}

onMounted(async () => {
  isLoginQuizlet.value = !!document.querySelector(
    QUIZLET_SELECTORS.loginContainer
  )
  isABTestOn.value = await isQuizletABTestOn()

  // 检查是否为窄屏
  const targetElements = document.querySelectorAll(QUIZLET_SELECTORS.container)
  if (targetElements.length >= 2) {
    const secondElement = targetElements[1]
    const hasQuizletButton = secondElement.querySelector(
      'quizlet-ai-quiz-button'
    )
    isNarrowScreen.value = !!hasQuizletButton
  }

  isReady.value = true

  trackEvent.track(QUIZLET_EVENTS.BUTTON_SHOW, {
    url: window.location.href,
    isABTestOn: isABTestOn.value,
  })

  browser.runtime.onMessage.addListener(onMessageListener)
})

onBeforeUnmount(() => {
  browser.runtime.onMessage.removeListener(onMessageListener)
})
</script>
