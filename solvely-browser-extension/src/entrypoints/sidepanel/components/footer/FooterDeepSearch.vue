<template>
  <div
    class="relative"
    @mouseleave="startCloseTimer"
    @mouseenter="clearCloseTimer"
  >
    <!-- 触发按钮 -->
    <Button
      icon="sidepanel/deep-search"
      class="w-[56px] rounded-[24px] border border-[#eee] hover:border-[#ccc] hover:bg-[#fff]"
      @mouseenter.stop="showPopup"
    >
      <SvgIcon name="arrow-down" size="10" />
    </Button>

    <!-- 弹出面板 -->
    <Transition name="popup">
      <div
        v-if="isPopupVisible"
        class="popup-panel absolute bottom-[40px] left-1/2 -translate-x-1/2 bg-white rounded-[12px] shadow-md py-1 w-[253px] border border-[#eee] z-10 overflow-hidden"
        @mouseenter="clearCloseTimer"
        @mouseleave="startCloseTimer"
      >
        <div class="flex flex-col">
          <button
            v-for="option in options"
            :key="option.label"
            :class="[
              'cursor-pointer flex items-center gap-[6px] leading-tight font-normal text-sm text-emph-1 whitespace-nowrap',
              'px-4 py-2 hover:bg-hover-on-white',
              'transition-colors duration-200',
            ]"
            @click="handleSelect(option)"
          >
            <SvgIcon v-if="option.icon" :name="option.icon" size="16" />
            {{ option.label }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Toast 提示 -->
    <Toast ref="toastRef" :duration="2000" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Button from '@/components/common/Button.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import useMessages from '../../composables/useMessages'
import Toast from '../Toast.vue'
import useCurrentWebsite from '../../composables/useCurrentWebSite'
import trackEvent from '~/utils/trackEvent'
import contentScriptChecker from '../../composables/useContentScriptChecker'

const props = defineProps<{
  messageStore: ReturnType<typeof useMessages>
}>()

const { addUserMessage, canSendMessage } = props.messageStore
const { handleSummarizePage, handleQuizPage } = useCurrentWebsite()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)
// 选项接口定义
interface PopupOption {
  label: string
  icon?: string
  click?: () => void
}

// 默认选项
const options = [
  {
    label: 'Solve this page',
    icon: 'sidepanel/ai-edit',
    click: contentScriptChecker.withContentScriptCheck(handleSolveAll),
  },
  {
    label: 'Summarize this page',
    icon: 'sidepanel/summarize-page',
    click: handleSummarizePageClick,
  },
  {
    label: 'Generate quiz from this page',
    icon: 'sidepanel/generate-quiz',
    click: handleQuizPageClick,
  },
]

const isPopupVisible = ref(false)
const closeTimer = ref<number | null>(null)
const closeDelay = 300 // 关闭延迟时间，单位毫秒

// 选项选择事件
const emit = defineEmits<{
  (e: 'select', option: PopupOption): void
}>()

// 显示弹出面板
const showPopup = () => {
  clearCloseTimer()
  isPopupVisible.value = true
}

// 关闭弹出面板
const closePopup = () => {
  isPopupVisible.value = false
}

// 开始关闭计时器
const startCloseTimer = () => {
  clearCloseTimer()
  closeTimer.value = window.setTimeout(() => {
    closePopup()
  }, closeDelay)
}

// 清除关闭计时器
const clearCloseTimer = () => {
  if (closeTimer.value !== null) {
    clearTimeout(closeTimer.value)
    closeTimer.value = null
  }
}

// 处理选项选择
const handleSelect = (option: PopupOption) => {
  if (!canSendMessage.value) {
    toastRef.value?.show('Let me finish first')
    return
  }
  emit('select', option)
  option.click?.()
  closePopup()
}

// 处理总结页面
async function handleSummarizePageClick() {
  contentScriptChecker.setCurrentActionType('summary')
  trackEvent.track('Plugin_sidebar_summarize')
  contentScriptChecker.checkAndShowModalIfUnavailable(() => handleSummarizePage(addUserMessage), { requireNonFileContext: true })
}

async function handleQuizPageClick() {
  contentScriptChecker.setCurrentActionType('quiz')
  trackEvent.track('Plugin_sidebar_quiz')
  contentScriptChecker.checkAndShowModalIfUnavailable(() => handleQuizPage(addUserMessage), { requireNonFileContext: true })
}

async function handleSolveAll() {
  try {
    props.messageStore.addPageSolveMessage()
  } catch (error) {
    console.error('Failed to send screenshot message:', error)
  }
}

// 生命周期钩子
onMounted(() => {
  // 不再需要点击事件监听
})

onUnmounted(() => {
  // 清除可能存在的定时器
  clearCloseTimer()
})
</script>

<style scoped lang="less">
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
}
</style>
