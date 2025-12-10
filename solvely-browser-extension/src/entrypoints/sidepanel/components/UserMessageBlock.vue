<template>
  <div class="w-full flex flex-col justify-end items-end">
    <div class="flex justify-end w-full max-w-[75%]">
      <!-- 1.纯文本 -->
      <div
        v-if="titleType === 'text'"
        class="p-2 bg-s-foundation-tertiary max-w-[243px] dark:bg-s-foundation-tertiary-dark border border-s-border dark:border-s-border-dark rounded-xl text-[14px] font-[400] leading-[1.4] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200 break-words"
      >
        {{ message.content.value }}
      </div>
      <div
        v-else
        class="w-[243px] max-w-[243px] bg-s-panel-bg dark:bg-s-panel-bg-dark border border-s-border dark:border-s-border-dark text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark p-3 rounded-xl flex flex-col gap-2 duration-200 transition-colors"
      >
        <!-- 头部 -->
        <div>
          <!-- 文字标题（其他情况） -->
          <div
            v-if="titleType === 'prompt'"
            class="text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark text-[14px] font-[400] leading-[1.4] line-clamp-3 duration-200 transition-colors"
          >
            {{ message.content.prompt }}
          </div>
          <!-- 交互标题（quiz image） -->
          <div
            v-else
            class="h-5 w-full flex items-center justify-start gap-1.5 text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
          >
            <SvgIcon :name="currentUserMessage.icon" size="20" />
            <div class="text-[14px] font-[600] leading-[1.4]">
              {{ currentUserMessage.title }}
            </div>
          </div>
        </div>
        <!-- 内容 -->
        <div class="relative w-full">
          <!-- 2.pdf -->
          <div
            v-if="showType === 'chatWithPdf'"
            class="w-full bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border-secondary dark:border-s-border-secondary-dark transition-colors duration-200 rounded-md flex items-center justify-start gap-2 p-2 h-[46px] cursor-pointer hover:bg-s-foundation-tertiary dark:hover:bg-s-foundation-tertiary-dark"
            @click="handlePdfClick"
          >
            <SvgIcon name="userMessage/pdf" size="30" />
            <div
              class="w-[167px] flex flex-col items-start justify-between h-full"
            >
              <div
                class="text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200 text-[14px] font-[400] leading-[1.1] w-full"
              >
                <div class="truncate">
                  {{ message.content.attachments?.chatWithPdf?.fileName }}
                </div>
              </div>
              <div
                class="text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark transition-colors duration-200 text-[12px] font-[400] leading-[1.1] w-full"
              >
                <div class="truncate">PDF</div>
              </div>
            </div>
          </div>
          <!-- 3.站点 -->
          <div
            v-if="showType === 'page'"
            class="w-full bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border-secondary dark:border-s-border-secondary-dark transition-colors duration-200 rounded-md flex items-center justify-start gap-2 p-2 h-[46px]"
          >
            <img
              :src="webSite.favicon"
              class="w-[30px] h-[30px] rounded-[6px]"
              alt="website favicon"
            />
            <div
              class="w-[167px] flex flex-col items-start justify-between h-full overflow-hidden"
            >
              <div
                class="w-full text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200 text-[14px] font-[400] leading-[1.1]"
              >
                <div class="!truncate">{{ webSite.pageTitle }}</div>
              </div>
              <div
                class="w-full text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark transition-colors duration-200 text-[12px] font-[400] leading-[1.1]"
              >
                <div class="!truncate">{{ webSite.pageUrl }}</div>
              </div>
            </div>
          </div>
          <!-- 4.划词搜索 -->
          <div
            v-if="showType === 'selection'"
            class="bg-s-interface-bg dark:bg-s-interface-bg-dark border hover:border-s-border hover:dark:border-s-border-dark border-s-border-secondary dark:border-s-border-secondary-dark rounded-md p-2 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-[14px] font-[400] leading-[1.4] cursor-pointer transition-all duration-200"
            :class="isSelectionExpanded ? 'overflow-y-auto' : ''"
            @click="handleClickSellction"
            :style="{
              maxHeight: isSelectionExpanded ? '158px' : '77px',
            }"
          >
            <div
              class="select-none"
              :class="isSelectionExpanded ? 'whitespace-normal' : 'line-clamp-3 whitespace-normal'"
            >
              {{
                message.content.attachments?.selection?.content ??
                message.content.value
              }}
            </div>
          </div>
          <!-- 5.图片 -->
          <div
            v-if="showType === 'image'"
            class="w-full overflow-hidden h-[106px] flex items-center justify-center border border-s-border dark:border-s-border-dark bg-b_1 dark:bg-b_1_dk transition-colors duration-200 rounded-lg cursor-zoom-in"
            @click="openViewer"
          >
            <img :src="imageSrc" alt="" class="max-h-[106px] max-w-[219px]" />
          </div>
          <!-- 6.引用 -->
          <div
            v-if="showType === 'quote'"
            class="w-full"
          >
            <!-- 有公式时：滚动区域 -->
            <div 
              v-if="hasQuoteFormula"
              class="w-full bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border-secondary dark:border-s-border-secondary-dark transition-colors duration-200 rounded-md flex items-center justify-start gap-2 p-2 pr-1 max-h-[84px] relative"
            >
              <div class="flex-1 overflow-hidden">
                <div class="overflow-y-auto max-h-[57px] quote-scroll text-[14px] font-[400] leading-[1.4]  text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark ">
                  <LatexFormat 
                    v-if="message.content.attachments?.quote?.highlighted_text" 
                    :text="message.content.attachments.quote.highlighted_text" 
                    ref="quoteLatexFormatRef"
                  />
                </div>
              </div>
            </div>
            
            <!-- 无公式时：可展开/折叠 -->
            <div 
              v-else
              class="bg-s-interface-bg dark:bg-s-interface-bg-dark border hover:border-s-border hover:dark:border-s-border-dark border-s-border-secondary dark:border-s-border-secondary-dark rounded-md p-2 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-[14px] font-[400] leading-[1.4] cursor-pointer transition-all duration-200"
              :class="isQuoteExpanded ? 'overflow-y-auto' : ''"
              @click="handleQuoteClick"
              :style="{
                maxHeight: isQuoteExpanded ? '158px' : '77px',
              }"
            >
              <div
                class="select-none"
                :class="isQuoteExpanded ? 'whitespace-normal' : 'line-clamp-3 whitespace-normal'"
              >
                {{ message.content.attachments?.quote?.highlighted_text }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Image Viewer -->
    <Viewer v-model="viewerVisible" :src="viewerSrc" alt="image preview" />
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import Viewer from './Viewer.vue'
import { QuestionType } from '../types/question'
import globalUpload from '../composables/useGlobalUpload'
import trackEvent from '~/utils/trackEvent'
import LatexFormat from '@/components/common/LatexFormat.vue'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps<{
  message: any
}>()

const isSelectionExpanded = ref(false)
const viewerVisible = ref(false)
const viewerSrc = ref('')
const quoteLatexFormatRef = ref<InstanceType<typeof LatexFormat>>()

// 引用文本相关状态
const hasQuoteFormula = ref(false)
const isQuoteExpanded = ref(false)

// 处理引用文本点击
const handleQuoteClick = () => {
  isQuoteExpanded.value = !isQuoteExpanded.value
}

/**
 * 检查文本中是否包含公式的函数
 * 通过检测常见的数学公式标记来判断
 */
const checkTextHasFormula = (text: string) => {
  if (!text) return false
  
  // 检测常见的数学公式标记
  const formulaPatterns = [
    /\$.*?\$/g,           // $...$ 格式
    /\$\$.*?\$\$/g,       // $$...$$ 格式
    /\\[a-zA-Z]+/g,       // LaTeX 命令
    /\\\(.*?\\\)/g,       // \(...\) 格式
    /\\\[.*?\\\]/g,       // \[...\] 格式
    /<math.*?<\/math>/gi, // MathML 标签
    /<mathml.*?<\/mathml>/gi, // MathML 标签
    /<strong.*?<\/strong>/gi, // <strong> 标签
    /∑|∫|∂|∇|∞|±|×|÷|≤|≥|≠|≈|∈|∉|∪|∩|⊂|⊃|∅|∀|∃/g, // 数学符号
    /\\frac\{[^}]+\}\{[^}]+\}/g, // \frac{}{} 格式
    /\\[a-zA-Z]+\{[^}]*\}/g, // \command{} 格式
    /[α-ωΑ-Ω]/g, // 希腊字母
    /[√∛∜]/g, // 根号
    /[∠⊥∥]/g, // 几何符号
  ]
  
  return formulaPatterns.some(pattern => pattern.test(text))
}


// 监听引用文本变化
watch(() => props.message.content.attachments?.quote?.highlighted_text, (newValue) => {
  // 检测文本是否包含公式
  hasQuoteFormula.value = checkTextHasFormula(newValue)
  // 重置展开状态
  isQuoteExpanded.value = false
})

// 组件挂载后检测公式
onMounted(() => {
  // 如果是引用类型，立即检测公式
  if (showType.value === 'quote') {
    const quoteText = props.message.content.attachments?.quote?.highlighted_text
    if (quoteText) {
      hasQuoteFormula.value = checkTextHasFormula(quoteText)
    }
  }
})

// 五种类型
// 1.纯文本
// 2.划词搜索
// 3.图片
// 4.站点
// 5.PDF
// 6.划词提问

// TitleType 枚举
enum TitleType {
  SOLVE = 'solve',
  SUMMARIZE = 'summarize',
  QUIZ = 'quiz',
  PROMPT = 'prompt',
  TEXT = 'text',
  EXPLAIN = 'explain',
}

// 映射表
const userMessageMap = {
  [TitleType.SOLVE]: {
    title: 'Solve it',
    icon: 'userMessage/solve',
  },
  [TitleType.SUMMARIZE]: {
    title: 'Summarize',
    icon: 'userMessage/summarize',
  },
  [TitleType.QUIZ]: {
    title: 'Generate Quiz',
    icon: 'userMessage/quiz',
  },
  [TitleType.PROMPT]: {
    title: 'Prompt',
    icon: 'userMessage/prompt',
  },
  [TitleType.TEXT]: {
    title: 'Text',
    icon: 'userMessage/text',
  },
  [TitleType.EXPLAIN]: {
    title: 'Explain',
    icon: 'userMessage/explain',
  },
}

const currentUserMessage = computed(
  () => userMessageMap[(titleType.value ?? TitleType.TEXT) as TitleType]
)

const webSite = computed(() => {
  try {
    if (
      props.message.content.attachments?.page ||
      props.message.content.attachments?.youtube ||
      props.message.content.attachments?.quizlet
    ) {
      return {
        pageTitle:
          props.message.content.attachments?.page?.title ||
          props.message.content.attachments?.youtube?.title ||
          props.message.content.attachments?.quizlet?.title,
        pageUrl:
          props.message.content.attachments?.page?.url ||
          props.message.content.attachments?.youtube?.url ||
          props.message.content.attachments?.quizlet?.url,
        favicon: `https://www.google.com/s2/favicons?domain=${
          props.message.content.attachments?.page?.url ||
          props.message.content.attachments?.youtube?.url ||
          props.message.content.attachments?.quizlet?.url
        }&sz=32`,
      }
    }
    const { pageTitle, pageUrl } = JSON.parse(props.message.content.value)
    const favicon = `https://www.google.com/s2/favicons?domain=${pageUrl}&sz=32`
    return {
      pageTitle,
      pageUrl,
      favicon,
    }
  } catch (e) {
    return {
      pageTitle: '',
      pageUrl: '',
      favicon: '',
    }
  }
})

const titleType = computed(() => {
  if (props.message.content.type === QuestionType.QUIZ) {
    return TitleType.QUIZ
  } else if (props.message.content.prompt) {
    return TitleType.PROMPT
  } else if (
    props.message.content.type === QuestionType.SUMMARY ||
    (props.message.content.type === QuestionType.PDF_SUMMARIZE &&
      !props.message.content.prompt)
  ) {
    return TitleType.SUMMARIZE
  } else if (
    props.message.content.type === QuestionType.PAGE_SOLVE_ALL ||
    props.message.content.type === QuestionType.PAGE_SCREENSHOT_SOLVE ||
    props.message.content.type === QuestionType.PDF_SOLVE_ALL ||
    props.message.content.type === QuestionType.TEXT_SOLVE ||
    props.message.content.type === QuestionType.PHOTO
  ) {
    return TitleType.SOLVE
  } else if (props.message.content.type === 'text') {
    return TitleType.TEXT
  } else if (props.message.content.type === QuestionType.EXPLAIN) {
    return TitleType.EXPLAIN
  }
})

// ShowType 枚举
enum ShowType {
  PAGE = 'page',
  SELECTION = 'selection',
  IMAGE = 'image',
  CHAT_WITH_PDF = 'chatWithPdf',
  QUOTE = 'quote',
}

const showType = computed(() => {
  if (props.message.content.type === QuestionType.QUOTE || props.message.content.type === QuestionType.HIGHLIGHT_CHAT) {
    return ShowType.QUOTE
  }
  // 优先检查 selection（Explain 和带 selection 的 Summary/Quiz）
  if (
    props.message.content.attachments?.selection ||
    props.message.content.type === QuestionType.TEXT_SOLVE
  ) {
    return ShowType.SELECTION
  }
  // 然后检查 page（Quiz/Summary 等）
  if (
    props.message.content.attachments?.page ||
    props.message.content.attachments?.youtube ||
    props.message.content.attachments?.quizlet
  ) {
    return ShowType.PAGE
  }
  // 最后检查 webSite.pageUrl（从 value 解析的，仅用于无 selection 的 Summary）
  if (webSite.value.pageUrl && props.message.content.type === QuestionType.SUMMARY) {
    return ShowType.PAGE
  }
  if (
    props.message.content.attachments?.image ||
    props.message.content.type === QuestionType.PHOTO ||
    props.message.content.attachments?.pageScreenshot?.longImage
  ) {
    return ShowType.IMAGE
  } else if (
    props.message.content.attachments?.chatWithPdf ||
    props.message.content.type === QuestionType.PDF_SUMMARIZE ||
    props.message.content.type === QuestionType.PDF_SOLVE_ALL
  ) {
    return ShowType.CHAT_WITH_PDF
  } else if (
    props.message.content.attachments?.pageScreenshot ||
    props.message.content.type === QuestionType.PAGE_SCREENSHOT_SOLVE
  ) {
    return ShowType.IMAGE
  }
})

// 统一图片地址
const imageSrc = computed(
  () =>
    props.message.content.attachments?.image?.base64 ??
    props.message.content.attachments?.pageScreenshot?.longImage ??
    props.message.content.value
)

// 站点信息

const handleClickSellction = () => {
  isSelectionExpanded.value = !isSelectionExpanded.value
}

// 打开图片查看器
const openViewer = () => {
  if (!imageSrc.value) return
  viewerSrc.value = imageSrc.value
  viewerVisible.value = true
  trackEvent.track('Plugin_Sidebar_Message_Pic_Click')
}

const handlePdfClick = () => {
  const fileStackKey = props.message.content.fileStackKey
  const chatWithPdf = props.message.content.attachments?.chatWithPdf

  if (fileStackKey && globalUpload.fileStack.value[fileStackKey]) {
    const fileInfo = globalUpload.fileStack.value[fileStackKey]
    if (fileInfo?.file && fileInfo?.cdnUrl) {
      trackEvent.track('Plugin_Sidebar_PDFpage_Show_Click')
      globalUpload.openPDFDView(
        fileInfo.cdnUrl,
        fileInfo.file,
        fileStackKey,
        true
      )
    }
  } else if (chatWithPdf?.fileUrl) {
    // 如果没有fileStackKey但有fileUrl，尝试直接打开
    trackEvent.track('Plugin_Sidebar_PDFpage_Show_Click_Error')
    // 这里可以添加直接打开URL的逻辑，或者提示用户文件不可用
    console.log(
      'PDF file not available in fileStack, fileUrl:',
      chatWithPdf.fileUrl
    )
  }
}
</script>

<style scoped>
/* 自定义滚动条样式 */
.quote-scroll::-webkit-scrollbar {
  width: 4px;
}

.quote-scroll::-webkit-scrollbar-track {
  background: transparent;
  margin: 2px -2px 0 0; /* 增加上下间距 */
}

.quote-scroll::-webkit-scrollbar-thumb {
  background: #C4C6C9;
  border-radius: 2px;
}

.quote-scroll::-webkit-scrollbar-thumb:hover {
  background: #A0A3A7;
}

/* 深色模式滚动条 */
.dark .quote-scroll::-webkit-scrollbar-thumb {
  background: #2F3543;
}

.dark .quote-scroll::-webkit-scrollbar-thumb:hover {
  background: #3F4758;
}

/* 划词搜索和引用的滚动条样式 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #C4C6C9;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #A0A3A7;
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background: #2F3543;
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #3F4758;
}
</style>

