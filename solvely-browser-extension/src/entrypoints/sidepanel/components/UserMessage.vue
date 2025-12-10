<template>
  <div class="flex justify-end">
    <div class="pl-[70px]">
      <!-- 文本消息（包括划词搜索） -->
      <div
        v-if="
          message.content.type === QuestionType.TEXT ||
          message.content.type === QuestionType.TEXT_SOLVE
        "
        class="bg-[#ECF5FF] text-[#111] p-[8px] rounded-[12px] text-[14px] font-[300] leading-[140%]"
      >
        {{ message.content.value }}
      </div>
      <!-- 图片消息 -->
      <div
        v-else-if="message.content.type === QuestionType.PHOTO"
        class="w-[218px] h-[112px] overflow-hidden flex items-center justify-end"
      >
        <img
          :src="message.content.value"
          class="max-w-full max-h-full border border-[#ccc] rounded-[16px]"
        />
      </div>
      <!-- 站点消息 -->
      <UserSiteMessage
        v-else-if="shouldShowSiteMessage"
        v-bind="siteMessageProps"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UserMessage } from '../types/message'
import { QuestionType } from '../types/question'
import UserSiteMessage from './UserSiteMessage.vue'
import iconPdf from '@/assets/icons/sidepanel/pdf.webp'

const props = defineProps<{
  message: UserMessage
}>()

const webSite = computed(() => {
  const { pageTitle, pageUrl } = JSON.parse(props.message.content.value)
  const favicon = `https://www.google.com/s2/favicons?domain=${pageUrl}&sz=32`
  return {
    pageTitle,
    pageUrl,
    favicon,
  }
})

// 判断是否应该显示 UserSiteMessage 组件
const shouldShowSiteMessage = computed(() => {
  return (
    props.message.content.type === QuestionType.SUMMARY ||
    props.message.content.type === QuestionType.QUIZ ||
    props.message.content.type === QuestionType.SOLVE_ALL
  )
})

// 根据消息类型生成 UserSiteMessage 的 props
const siteMessageProps = computed(() => {
  const { type, attachments } = props.message.content

  if (type === QuestionType.SUMMARY) {
    // 划词 explain 附件
    if (attachments?.selection) {
      return {
        // 临时修改为Summarize
        text: 'Summarize this text',
        desc: attachments.selection.content,
      }
    }
    return {
      text: 'Summarize this page',
      icon: webSite.value.favicon,
      title: webSite.value.pageTitle,
      url: webSite.value.pageUrl,
    }
  }

  if (type === QuestionType.QUIZ) {
    // PDF 附件
    if (attachments?.pdf) {
      return {
        text: 'Generate quiz from this page',
        icon: iconPdf,
        title: attachments.pdf.title || '',
        url: attachments.pdf.url || '',
      }
    }

    // 页面附件
    if (attachments?.page) {
      return {
        text: 'Generate quiz from this page',
        icon: `https://www.google.com/s2/favicons?domain=${attachments.page.url}&sz=32`,
        title: attachments.page.title || '',
        url: attachments.page.url || '',
      }
    }
    // 划词 Quiz附件
    if (
      props.message.content.type === QuestionType.QUIZ &&
      attachments?.selection
    ) {
      return {
        text: 'Generate quiz from this text',
        desc: attachments.selection.content || '',
      }
    }

    // Quizlet 附件
    if (attachments?.quizlet) {
      return {
        text: 'Generate quiz from Quizlet',
        icon: `https://www.google.com/s2/favicons?domain=quizlet.com&sz=32`,
        title: attachments.quizlet.title || '',
        url: attachments.quizlet.url || '',
      }
    }

    // YouTube 附件
    if (attachments?.youtube) {
      return {
        text: 'Generate quiz from this page',
        icon: `https://www.google.com/s2/favicons?domain=${attachments.youtube.url}&sz=32`,
        title: attachments.youtube.title || '',
        url: attachments.youtube.url || '',
      }
    }
    // 0.2.9版本从文件暂存框生成 Quiz 请求
    if (attachments?.chatWithPdf) {
      return {
        text: 'Generate quiz from this PDF',
        icon: iconPdf,
        title: attachments.chatWithPdf.fileName || '',
        url: attachments.chatWithPdf.fileUrl || '',
      }
    }
  }

  if (type === QuestionType.SOLVE_ALL && attachments?.page) {
    return {
      text: '',
      icon: `https://www.google.com/s2/favicons?domain=${attachments.page.url}&sz=32`,
      title: attachments.page.title,
      url: attachments.page.url,
    }
  }

  return {
    text: '',
    icon: '',
    title: '',
    url: '',
  }
})

onMounted(() => {
  trackEvent.track('Plugin_sidebar_user_message_mounted')
})
</script>
