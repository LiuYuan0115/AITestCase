<template>
  <div class="relative">
    <!-- 浮窗内容 -->
    <Transition name="float-modal">
      <div
        v-if="popUpShowInThisPage"
        class="float-modal absolute bottom-0 left-0 bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border dark:border-s-border-dark rounded-[12px] shadow-dropdown z-10 overflow-hidden w-[328px] duration-200 transition-colors"
      >
        <div class="flex flex-col p-3 relative">
          <!-- 关闭按钮 -->
          <button
            class="absolute top-3 right-3 w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-s-hover-bg dark:hover:bg-s-hover-bg-dark text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark rounded-full transition-colors duration-200"
            @click="handleClose"
          >
            <SvgIcon name="ic_close" :size="10" />
          </button>

          <!-- 标题和图标 -->
          <div class="flex items-center mb-3">
            <img
              :src="currentWebsite.favicon"
              class="w-6 h-6 rounded-md mr-2"
              alt="website favicon"
              @error="handleFaviconError"
            />
            <span
              class="text-sm font-normal leading-[14px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark max-w-[248px] truncate transition-colors duration-200"
              >{{ currentWebsite.title }}
            </span>
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-[10px]">
            <button
              v-for="option in options"
              :key="option.key"
              :disabled="!canSendMessage"
              :class="[
                'border border-s-border dark:border-s-border-dark h-[24px] bg-s-interface-bg dark:bg-s-interface-bg-dark text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark text-sm leading-[1] rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-s-hover-bg dark:hover:bg-s-hover-bg-dark transition-colors duration-200',
                option.key === 'summarize' ? 'w-[108px]' : 'w-[87px]',
              ]"
              @click="handleOptionClick(option)"
            >
              <SvgIcon
                :name="option.icon"
                :size="option.key === 'solve' ? 20 : 16"
                class="mr-[4px] text-white"
              />
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import useCurrentWebsite from '~/entrypoints/sidepanel/composables/useCurrentWebSite'
import useMessages from '../../composables/useMessages'
import useSetting from '~/composables/content/useSetting'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import trackEvent from '~/utils/trackEvent'
import contentScriptChecker from '../../composables/useContentScriptChecker'
import { AuthState } from '@/entrypoints/sidepanel/types/auth'
import { getConfigValue } from '~/utils/config'
import { ABTestState } from '@/composables/useABTest'

const auth = inject<AuthState>('auth')!
const abTest = inject<ABTestState>('abTest')!

// 选项接口定义
interface ModalOption {
  key: string
  label: string
  icon: string
  click: () => void
}

// 目标域名
const ignoreDomains = [
  'dev.solvely.ai',
  'solvely.ai',
  'dev-activity.solvely.ai',
  'https://chromewebstore.google.com',
  'https://microsoftedge.microsoft.com/addons',
  'chrome://',
  'edge://',
  'about:blank',
  'moz-extension://',
  'chrome-extension://',
  'extension://',
]

const props = defineProps<{
  messageStore: ReturnType<typeof useMessages>
}>()
const { addUserMessage, addPageSolveMessage, isMessageEmpty, messages, canSendMessage } =
  props.messageStore

const popUpShowInThisPage = ref(false)
const isOneClickSolveFull = ref(false)

const { globalEnable, closeInGlobal } = useSetting('sidebar-popup-panel')

const {
  currentWebsite,
  handleFaviconError,
  handleSummarizePage,
  handleQuizPage,
} = useCurrentWebsite()

// 默认选项
const options: ModalOption[] = [
  {
    key: 'solve',
    label: 'Solve',
    icon: 'sidepanel/solve-page',
    click: contentScriptChecker.withContentScriptCheck(handleSolvePageClick, {
      requireNonFileContext: true,
    }),
  },
  {
    key: 'summarize',
    label: 'Summarize',
    icon: 'sidepanel/summarize-page',
    click: contentScriptChecker.withContentScriptCheck(
      handleSummarizePageClick,
      {
        requireNonFileContext: true,
      }
    ),
  },
  {
    key: 'generate-quiz',
    label: 'Quiz',
    icon: 'sidepanel/generate-quiz',
    click: contentScriptChecker.withContentScriptCheck(handleQuizPageClick, {
      requireNonFileContext: true,
    }),
  },
]

// 检查URL是否有效且不应该显示弹窗
function shouldShowPopup(url: string | undefined): boolean {
  // 如果URL不存在、为空字符串或只包含空白字符，不显示弹窗
  if (!url || !url.trim()) {
    return false
  }

  // 检查是否为内部页面或特殊协议
  const internalProtocols = [
    'chrome:',
    'edge:',
    'about:',
    'moz-extension:',
    'chrome-extension:',
    'extension:',
  ]
  if (internalProtocols.some((protocol) => url.startsWith(protocol))) {
    return false
  }

  // 检查是否在忽略域名列表中
  if (ignoreDomains.some((domain) => url.includes(domain))) {
    return false
  }

  // 检查是否为有效的HTTP/HTTPS URL
  try {
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false
    }
  } catch {
    // 如果URL格式无效，不显示弹窗
    return false
  }

  return true
}

async function handleTabChange() {
  try {
    // 查询当前窗口中激活的标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const currentTabUrl = tabs[0]?.url // 获取第一个（即当前激活的）标签页的URL

    // 使用新的判断逻辑
    if (
      !isMessageEmpty.value &&
      shouldShowPopup(currentTabUrl) &&
      globalEnable.value
    ) {
      popUpShowInThisPage.value = true
    } else {
      popUpShowInThisPage.value = false
    }
  } catch (error) {
    console.error(
      'Failed to get current tab info using chrome.tabs.query:',
      error
    )
    popUpShowInThisPage.value = false // 发生错误时也隐藏弹窗
  }
}

watch(popUpShowInThisPage, (newValue) => {
  if (newValue) {
    trackEvent.track('Plugin_sidebar_popup_show')
  }
})

watch(messages.value, (newValue) => {
  popUpShowInThisPage.value = false
})

// 全局关闭的时候, 浮窗也关闭
watch(globalEnable, (isOpen) => {
  if (!isOpen) {
    popUpShowInThisPage.value = false
  }
})

// 处理关闭按钮点击调起浮窗确认
const handleClose = async () => {
  try {
    // 获取当前活动标签页
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.id) {
      console.error('No active tab found')
      return
    }
    trackEvent.track('Plugin_sidebar_popup_close', {
      tabId: tab.id,
      tabUrl: tab.url,
    })
    // 发送消息到当前活动标签页
    const response = await browser.tabs.sendMessage(tab.id, {
      type: SidepanelEventType.SHOW_CLOSE_MODAL,
    })
    console.log('response', response)

    if (response.isConfirmClose) {
      if (response.closeType === 'next-visit') {
        popUpShowInThisPage.value = false
      } else if (response.closeType === 'global') {
        closeInGlobal()
      }
    }
  } catch (error) {
    console.error('Failed to send Close Modal Message to current tab:', error)
  }
}

function handleSolvePageClick() {
  trackEvent.track('Plugin_sidebar_popup_solve')
  popUpShowInThisPage.value = false
  addPageSolveMessage()
}

function handleSummarizePageClick() {
  trackEvent.track('Plugin_sidebar_popup_summarize')
  popUpShowInThisPage.value = false
  handleSummarizePage(addUserMessage)
}

function handleQuizPageClick() {
  trackEvent.track('Plugin_sidebar_popup_quiz')
  popUpShowInThisPage.value = false
  handleQuizPage(addUserMessage)
}

// 处理选项点击（统一入口）
const handleOptionClick = (option: ModalOption) => {
  // 🔧 前驱检查：是否有消息正在处理中
  if (!canSendMessage.value) {
    console.warn('已有消息正在处理中，请稍后再试')
    return
  }
  option.click?.()
  console.log('click', option.label)
}

onMounted(async () => {
  browser.tabs.onActivated.addListener(handleTabChange)
  const features: any = await getConfigValue('features')
  if (features?.oneClickSolve === 'full') {
    isOneClickSolveFull.value = true
  }
})

onUnmounted(() => {
  browser.tabs.onActivated.removeListener(handleTabChange)
})
</script>

<style scoped lang="less">
.float-modal-enter-active,
.float-modal-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.float-modal-enter-from,
.float-modal-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
