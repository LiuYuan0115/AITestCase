<template>
  <div class="w-full h-full flex flex-col items-center justify-start pb-[17px]">
    <SvgIcon
      name="robot"
      :size="36"
    />
    <p
      class="mt-[6px] text-center max-w-[328px] text-[16px] font-bold text-t_1 dark:text-t_1_dk leading-[18.2px] color-transition"
    >
      Welcome! What would you like to learn today?
    </p>

    <!-- Panel Content -->
    <div
      class="w-[315px] rounded-xl bg-b_panel dark:bg-b_panel_dk border border-d_2 dark:border-d_2_dk flex flex-col gap-2 p-3 mt-3 color-transition"
    >
      <!-- Website Information -->
      <div class="flex items-center justify-start gap-2">
        <span
          class="w-[24px] h-[24px] rounded-[6px] bg-center bg-cover bg-no-repeat shrink-0 color-transition"
          :style="faviconStyle"
        />
        <div class="flex-1 min-w-0 flex flex-col items-start justify-start">
          <div
            class="text-[12px] font-normal leading-3 text-t_2 dark:text-t_2_dk max-w-[260px] truncate color-transition"
          >
            {{ currentWebsite.title }}
          </div>
          <div
            class="text-[10px] font-normal leading-[10px] text-t_3 dark:text-t_3_dk max-w-[260px] truncate color-transition"
          >
            {{ currentWebsite.url }}
          </div>
        </div>
      </div>

      <!-- Options -->
      <div class="flex flex-col gap-2">
        <button
          v-for="option in options"
          :key="option.title"
          class="flex flex-row items-center justify-start bg-b_1 dark:bg-b_1_dk rounded-xl pl-3 py-2 h-[36px] outline-none focus:outline-none border border-d_1 dark:border-d_1_dk hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk text-t_1 dark:text-t_1_dk cursor-pointer color-transition"
          @click="option.click"
        >
          <SvgIcon
            :name="option.icon"
            :size="16"
            class="mr-2"
          />
          <div class="text-[14px] font-normal leading-[1.4]">
            {{ option.title }}
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '~/components/common/SvgIcon.vue'
import useCurrentWebsite from '~/entrypoints/sidepanel/composables/useCurrentWebSite'
import useMessages from '../composables/useMessages'
import trackEvent from '~/utils/trackEvent'
import contentScriptChecker from '../composables/useContentScriptChecker'

const { currentWebsite, handleSummarizePage, handleQuizPage, getFaviconBase64 } = useCurrentWebsite()

const props = defineProps<{
  messageStore: ReturnType<typeof useMessages>
}>()

const { addUserMessage } = props.messageStore

// 处理截图 - 保留在组件中，因为这是截图解题功能，不属于网站信息管理
async function handleSolveAll() {
  trackEvent.track('Plugin_sidebar_greeting_solve')
  props.messageStore.addPageSolveMessage()
}

const handleSummarizeClick = () => {
  trackEvent.track('Plugin_sidebar_greeting_summarize')
  contentScriptChecker.setCurrentActionType('summary')
  contentScriptChecker.checkAndShowModalIfUnavailable(() => handleSummarizePage(addUserMessage), {
    requireNonFileContext: true,
  })
}

const handleQuizClick = () => {
  trackEvent.track('Plugin_sidebar_greeting_quiz')
  contentScriptChecker.setCurrentActionType('quiz')
  contentScriptChecker.checkAndShowModalIfUnavailable(() => handleQuizPage(addUserMessage), {
    requireNonFileContext: true,
  })
}

const options = [
  {
    title: 'Solve this page',
    icon: 'sidepanel/ai-edit',
    click: contentScriptChecker.withContentScriptCheck(handleSolveAll),
  },
  {
    title: 'Summarize this page',
    icon: 'sidepanel/summarize-page',
    click: handleSummarizeClick,
  },
  {
    title: 'Generate quiz from this page',
    icon: 'sidepanel/generate-quiz',
    click: handleQuizClick,
  },
]

const faviconDataUrl = ref<string>('')
const faviconStyle = computed(() => (faviconDataUrl.value ? { backgroundImage: `url('${faviconDataUrl.value}')` } : {}))

let ongoing: AbortController | null = null
async function refreshFavicon() {
  ongoing?.abort()
  ongoing = new AbortController()
  try {
    const dataUrl = await getFaviconBase64(ongoing.signal)
    faviconDataUrl.value = dataUrl
  } catch {}
}

onMounted(async () => {
  trackEvent.track('Plugin_sidebar_greeting_show')
  await refreshFavicon()
})

watch(
  () => currentWebsite.url,
  () => {
    refreshFavicon()
  }
)
</script>
