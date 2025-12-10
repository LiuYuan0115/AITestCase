<template>
  <div class="answer-info" :data-structured-answer="structuredAnswerText">
    <!-- 加载中和完成状态 -->
    <template v-for="(item, index) in answerData" :key="index">
      <div
        class="answer-block"
        v-if="
          boundaryItemIndex === -1 ||
          index < boundaryItemIndex ||
          (index === boundaryItemIndex && item.type === 'question')
        "
        :class="
          item.type === 'question' && index !== firstQuestionIndex
            ? 'mt-[18px] pt-[18px] border-t border-s-border dark:border-s-border-dark duration-200 transition-colors'
            : ''
        "
      >
        <div class="answer-block-wrapper">
          <!-- 主要内容 -->
          <component
            :is="componentMap[item.type as keyof typeof componentMap]"
            :data="item"
            :total-data="props.data"
            :step-index="index"
            :showType="showType"
            :shouldShowNumbered="
              (item.type === 'question' || item.type === 'final_answer') &&
              questionCount > 1
            "
            :shouldShowBody="
              boundaryItemIndex !== -1 &&
              index === boundaryItemIndex &&
              item.type === 'question'
                ? false
                : true
            "
            :shouldClose="props.isStop && item.type === 'thinking'"
          >
            <template v-if="item.type === 'step'" #index>
              {{ getStepNumber(index) }}
            </template>
          </component>

          <!-- 在 final_answer 后插入 ModelPopUp -->
          <ModelPopUp
            v-if="
              item.type === 'final_answer' &&
              shouldShowModelPopUp &&
              isMutipleModel
            "
            class="my-2 mb-1"
          />
          <NoBalanceSubscriptionPrompt
            v-if="
              boundaryItemIndex !== -1 &&
              index === boundaryItemIndex &&
              item.type === 'question'
            "
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, onMounted } from 'vue'
import { AuthState } from '~/entrypoints/sidepanel/types/auth'
import StepBlock from './StepBlock.vue'
import BodyBlock from './BodyBlock.vue'
import FinalAnswerBlock from './FinalAnswerBlock.vue'
import ThinkingBlock from './ThinkingBlock.vue'
import QuestionBlock from './QuestionBlock.vue'
import GMATBlock from './GMATBlock.vue'
import subscription from '@/entrypoints/sidepanel/composables/useSubscription'
import NoBalanceSubscriptionPrompt from '../../NoBalanceSubscriptionPrompt.vue'
import ModelPopUp from '@/entrypoints/sidepanel/components/models/ModelPopUp.vue'
import useABTest from '@/composables/useABTest'

//---------------------------------------声明属性
const props = defineProps<{
  data: any
  isExample?: boolean
  isStop?: boolean
}>()
const auth = inject<AuthState>('auth')!
// 添加缓存变量
const cachedGMATInfo = ref<GmatInfo | null>(null)
const setDisabledStop = inject<(disabled: boolean) => void>('setDisabledStop',() => {})
// 注入余额不足通知方法
const onInsufficientBalance = inject<() => void>('on-insufficient-balance',() => {})

// AB 测试控制
const { isMutipleModel } = useABTest()

// 标记当前答案是否已经埋点过
const hasTrackedQuoteShow = ref(false)
// 定义内容类型接口
interface ContentItem {
  type: string
  text: string
}

interface GraphContentItem {
  type: string
  content: string
}

interface ThinkingContentItem {
  content: string
  duration: number
  isDone: boolean
}

interface GmatInfo {
  examName: string
  sourceReference: string
  targetUrl: string
}

type ContentItemTypes =
  | ContentItem
  | GraphContentItem
  | ThinkingContentItem
  | GmatInfo

interface AnswerBlockItem {
  type: string
  contents: ContentItemTypes[]
}

/**
 * 答案状态枚举值定义
 * COMPLETED: 已完成
 * PROCESSING: 处理中
 * FAILED: 失败
 */
const AnswerStatus = {
  COMPLETED: 0,
  PROCESSING: 1,
  FAILED: 3,
}

// 组件类型映射表 - 根据内容类型选择对应的显示组件
const componentMap = {
  step: StepBlock,
  body: BodyBlock,
  final_answer: FinalAnswerBlock,
  thinking: ThinkingBlock,
  question: QuestionBlock,
  gmat_information: GMATBlock,
}

// 第一个question元素的索引
const firstQuestionIndex = computed(() => {
  return answerData.value.findIndex((item: any) => item.type === 'question')
})

//---------------------------------------数据
// 显示类型：markdown/json
const showType = ref<string | null>(null)
//---------------------------------------方法
/**
 * 解析文本内容
 * 将原始文本解析为结构化数据，分离正文和最终答案
 * 处理 Markdown 格式的标题和内容
 */
const parseContent = (text: string) => {
  const result: AnswerBlockItem[] = []
  const lines = text.split('\n')
  let isFinalAnswer = false
  let finalAnswerContent: string[] = []
  let bodyContent: string[] = []
  const language = props.data.language

  lines.forEach((line) => {
    const trimmedLine = line

    if (trimmedLine.startsWith('###')) {
      const title = trimmedLine.replace(/^###\s*/, '')
      isFinalAnswer = isFinalAnswerTitle(title, language)

      if (!isFinalAnswer) {
        bodyContent.push(trimmedLine)
      }
      return
    }

    if (trimmedLine) {
      ;(isFinalAnswer ? finalAnswerContent : bodyContent).push(trimmedLine)
    }
  })

  if (bodyContent.length > 0) {
    result.push(createBodyBlock(bodyContent))
  }

  if (finalAnswerContent.length > 0) {
    result.push(createFinalAnswerBlock(finalAnswerContent, language))
  }
  return result
}

/**
 * 创建正文内容块
 * 处理普通文本内容，确保输出统一的格式
 */
const createBodyBlock = (content: string | string[]): AnswerBlockItem => ({
  type: 'body',
  contents: [
    {
      type: 'body',
      text: Array.isArray(content) ? content.join('\n').trim() : content,
    },
  ],
})

// 创建GMAT块
const createGMATBlock = (content: GmatInfo): AnswerBlockItem => ({
  type: 'gmat_information',
  contents: [
    {
      type: 'gmat_information',
      examName: content.examName,
      sourceReference: content.sourceReference,
      targetUrl: content.targetUrl,
    },
  ],
})

/**
 * 创建步骤块
 * 用于显示解题步骤，包含步骤标题和具体内容
 */
const createStepBlock = (title: string, body: string): AnswerBlockItem => ({
  type: 'step',
  contents: [
    { type: 'title', text: title },
    { type: 'body', text: body },
  ],
})

/**
 * 创建最终答案块
 * 将内容格式化为统一的数据结构，包含标题、正文和图形
 */
const createFinalAnswerBlock = (
  content: string | string[],
  language = 'en'
): AnswerBlockItem => {
  const contents: ContentItemTypes[] = [
    { type: 'title', text: translateFinalAnswerLanguage(language)[0] },
  ]

  // 处理内容字符串
  const contentStr = Array.isArray(content)
    ? content.join('\n').trim()
    : content

  // 查找图形标签内容
  const graphMatch = contentStr.match(/<graph>(.*?)<\/graph>/s)

  if (graphMatch) {
    // 移除图形标签内容，保留纯文本
    const textContent = contentStr.replace(/<graph>.*?<\/graph>/s, '').trim()
    if (textContent) {
      contents.push({ type: 'body', text: textContent })
    }
    // 添加图形内容
    contents.push({ type: 'graph', content: graphMatch[1].trim() })
  } else {
    // 没有图形内容时，直接添加文本
    contents.push({ type: 'body', text: contentStr })
  }

  return {
    type: 'final_answer',
    contents,
  }
}

/**
 * 检查标题是否为最终答案标题
 * 支持多语言匹配，根据当前语言进行判断
 */
const isFinalAnswerTitle = (title: string, language?: string): boolean => {
  const finalAnswerTextList = translateFinalAnswerLanguage(language)
  return finalAnswerTextList.some((text) =>
    new RegExp(`^\\s*${text}\\s*$`, 'i').test(title)
  )
}

/**
 * 解析问题步骤
 * 将问题的步骤信息转换为统一的数据结构
 */
interface QuestionStep {
  questionStepTitle: string
  questionStepBody: string
}

interface Question {
  question: string
  questionSteps: QuestionStep[]
  questionAnswer?: string
}

const parseQuestionSteps = (questions: Question[]): AnswerBlockItem[] => {
  if (questions.length === 1 && questions[0].questionSteps.length === 0) {
    return []
  }
  return questions.flatMap((question, index) => {
    const result = [
      ...question.questionSteps.map((step) =>
        createStepBlock(step.questionStepTitle, step.questionStepBody)
      ),
    ]
    result.unshift({
      type: 'question',
      contents: [
        {
          type: 'title',
          text: `Question ${index + 1}`,
        },
        {
          type: 'body',
          text: question.question,
        },
      ],
    })
    if (question.questionAnswer) {
      result.push(createStepBlock('Answer', question.questionAnswer))
    }
    return result
  })
}
/**
 * 解析 Markdown 文本为结构化数据
 * 支持两种格式：
 * 1. JSON 格式：包含 questions、other 和 finalAnswer
 * 2. 纯文本格式：直接解析 Markdown 内容
 * 判断markdownText的数据类型进行不同的渲染
 */
const parseMarkdownToStructure = (markdownText: any): AnswerBlockItem[] => {
  if (!markdownText) return []

  if (typeof markdownText === 'string') {
    return parseContent(markdownText)
  }

  try {
    const parsedData = markdownText

    // 如果没有步骤内容但有答案内容,则直接解析答案内容，可能是走了dsl但算法判断不走dsl
    // 这个逻辑现在不会走, 在外面判断了
    // if (
    //   !parsedData.questions?.[0]?.questionSteps?.length &&
    //   props.data?.answer
    // ) {
    //   showType.value = 'markdown'
    //   return parseContent(props.data.answer)
    // }
    const result: AnswerBlockItem[] = []

    // 如果是gmat消息则存入缓存
    if (parsedData.gmatInfo) {
      cachedGMATInfo.value = parsedData.gmatInfo
    }

    // 1. 处理其他内容
    const hasOther = parsedData.other && parsedData.other.trim() !== '```'
    if (hasOther) {
      result.push(...parseContent(parsedData.other))
    }

    // 2. 处理问题步骤
    if (parsedData.questions) {
      result.push(...parseQuestionSteps(parsedData.questions))
    }

    // 3. 处理最终答案 (unshift)
    if (parsedData.finalAnswer) {
      result.unshift(
        createFinalAnswerBlock(parsedData.finalAnswer, props.data.language)
      )
    }

    // 4. 处理 thinking (unshift)
    if (parsedData.thinking) {
      result.unshift({
        type: 'thinking',
        contents: [
          {
            content: parsedData.thinking.content,
            duration:
              (parsedData.thinking.endTime || Date.now()) -
              parsedData.thinking.startTime,
            isDone: !!parsedData.thinking.endTime,
          },
        ],
      })
      // 如果 thinking 完成了且有 GMAT 信息，直接插入，不和unshift挤一起
      if (parsedData.thinking.endTime && cachedGMATInfo.value) {
        result.splice(1, 0, createGMATBlock(cachedGMATInfo.value))
        cachedGMATInfo.value = null // 清除缓存
      }
    }

    return result
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return parseContent(markdownText)
  }
}

/**
 * 翻译最终答案语言
 * @param {string} languageI18nCode - 语言代码
 * @returns {string[]} 翻译后的最终回答文本数组,默认返回['Final Answer']
 */
const translateFinalAnswerLanguage = (languageI18nCode = 'en-us'): string[] => {
  return ['Final Answer']
}

//---------------------------------------计算属性
// 答案数据处理 - 将原始答案转换为可显示的格式
const answerData = computed(() => {
  const answerJson = props.data.answerJsonObject
  if (!answerJson) {
    showType.value = 'json'
    return parseMarkdownToStructure(props.data.answer)
  }
  try {
    showType.value = 'json'
    let result = parseMarkdownToStructure(answerJson)
    return result
  } catch (error) {
    return []
  }
})

// 统计问题数量 - 用于判断是否需要显示序号
const questionCount = computed(() => {
  return answerData.value.filter((item: any) => item.type === 'question').length
})

// 步骤序号管理 - 为每个步骤生成序号，每个question后重新开始计数
const stepNumbers = computed(() => {
  const numbers = new Map()
  let currentStepNumber = 0
  answerData.value.forEach((item: any, index: number) => {
    if (item.type === 'question') {
      currentStepNumber = 0 // 重置计数器
    }
    if (item.type === 'step') {
      currentStepNumber++ // 递增计数器
      numbers.set(index, currentStepNumber)
    }
  })
  return numbers
})

const getStepNumber = (index: number) => stepNumbers.value.get(index) || 0

const isShowQuestionMultiple = ref(false)

// 仅在本组件实例内冻结一次可用题量，避免全局余额变化影响历史消息
const snapshotAvailable = ref<number | null>(null)

watch(questionCount, (newVal) => {
  if (newVal > 1 && !isShowQuestionMultiple.value) {
    isShowQuestionMultiple.value = true
  }
})

//---------------------------------------数据监听

// 订阅与余额计算
const isSubscribed = computed(() => subscription.isSubscribed.value)
const pluginBalance = computed(() => {
  if (snapshotAvailable.value !== null) return snapshotAvailable.value
  const ub = subscription.userBalance.value
  const plugin = Number(ub?.plugin ?? 0)
  const accountBalance = Number(ub?.balance ?? 0)
  const walletCredits = Math.floor(accountBalance / 10)
  return Math.max(0, plugin + walletCredits)
})

// 在首次出现题目时冻结一次可用题量（非订阅、非示例）。
watch(
  questionCount,
  (newVal) => {
    if (snapshotAvailable.value !== null) return
    if (props.isExample || isSubscribed.value) return
    if (newVal > 0) {
      const ub = subscription.userBalance.value
      const plugin = Number(ub?.plugin ?? 0)
      const accountBalance = Number(ub?.balance ?? 0)
      const walletCredits = Math.floor(accountBalance / 10)
      snapshotAvailable.value = Math.max(0, plugin + walletCredits)
    }
  },
  { immediate: true }
)

// 需要插入订阅提示的题目序号（基于 0 的题号）。订阅用户或余额足够则为 -1。
const promptQuestionIndex = computed(() => {
  if (props.isExample || isSubscribed.value) return -1
  const bal = Number(pluginBalance.value) || 0
  return bal < questionCount.value ? bal : -1
})

// 边界项索引：answerData 内与 promptQuestionIndex 对应的第一个 question 的实际索引
const boundaryItemIndex = computed(() => {
  if (promptQuestionIndex.value === -1) return -1
  let qIndex = -1
  for (let i = 0; i < answerData.value.length; i++) {
    if ((answerData.value[i] as any).type === 'question') {
      qIndex += 1
      if (qIndex === promptQuestionIndex.value) return i
    }
  }
  return -1
})

// 将渲染使用的块转换为纯文本（排除 thinking）的计算属性
const structuredAnswerText = computed(() => {
  const lines: string[] = []
  const data = answerData.value

  data.forEach((item: any, index: number) => {
    // 同模板条件保持一致
    const include =
      boundaryItemIndex.value === -1 ||
      index < boundaryItemIndex.value ||
      (index === boundaryItemIndex.value && item.type === 'question')
    if (!include) return
    if (item.type === 'thinking') return

    if (Array.isArray(item.contents)) {
      item.contents.forEach((c: any) => {
        if (c?.text && (c.type === 'title' || c.type === 'body')) {
          lines.push(String(c.text))
        }
      })
    }
    // 块之间空行
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('')
    }
  })

  // 规范空行并返回文本
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
})

// 控制 ModelPopUp 显示的逻辑
const shouldShowModelPopUp = computed(() => {
  // 示例模式不显示
  if (props.isExample) return false

  // 检查是否有 final_answer 类型的内容
  const hasFinalAnswer = answerData.value.some(
    (item: any) => item.type === 'final_answer'
  )

  // 可以根据需要添加更多条件，比如用户权限、AB测试等
  return hasFinalAnswer
})

/**
 * 处理问号按钮显示埋点
 */
const handleQuoteShow = () => {
  // 检查是否有步骤内容，且每个答案只埋点一次
  const hasSteps = answerData.value.some((item: any) => item.type === 'step')
  if (!hasTrackedQuoteShow.value && hasSteps) {
    trackEvent.track('Plugin_Sidebar_Quote_Show', {
      from: 'step',
    })
    hasTrackedQuoteShow.value = true
  }
}

// 监听 answerData 变化，当 AB 测试数据加载完成且有步骤内容时触发埋点
watch(
  [answerData],
  () => {
    handleQuoteShow()
  },
  { immediate: true }
)

// 组件内部维护余额状态
let internalBalance = 0
let isInitialized = false
// 余额不足通知锁，防止重复通知
let hasNotifiedInsufficientBalance = false

// 初始化内部余额
watch(
  () => pluginBalance.value,
  (balance) => {
    if (!isInitialized && balance > 0) {
      internalBalance = balance
      isInitialized = true
    }
  },
  { immediate: true }
)

// 监听题目生成，进行扣减（仅非订阅用户）
watch(
  () => questionCount.value,
  (newLength, oldLength) => {
    // 订阅用户不需要扣减逻辑
    if (isSubscribed.value) return
    if (newLength > oldLength && newLength > 0) {
      // 第一题略过，从第二题开始扣减
      if (newLength > 1) {
        if (internalBalance > 0) {
          // 扣减内部余额
          internalBalance--

          // 调用减扣队列（从第二题开始）
          subscription.addDeductionToQueue(1)

        } else {
          // 余额不足时通知父组件（只通知一次）
          if (onInsufficientBalance && !hasNotifiedInsufficientBalance) {

            hasNotifiedInsufficientBalance = true
            onInsufficientBalance()
          }
        }
      }else{
        internalBalance--
      }
    }
  }
)

// 监听 boundaryItemIndex 变化，控制暂停按钮状态（仅非订阅用户）
watch(
  () => boundaryItemIndex.value,
  (newBoundaryIndex) => {
    // 订阅用户不需要暂停按钮控制逻辑
    if (isSubscribed.value) return

    if (setDisabledStop) {
      if (newBoundaryIndex !== -1) {
        setDisabledStop?.(true)
      }
    }
  }
)

onMounted(() => {
  if (!isSubscribed.value) {
    setDisabledStop?.(false)
  }
})
</script>

<style scoped>
.answer-info {
  @apply flex flex-col gap-[10px] w-full;
}

.answer-block {
  @apply rounded-lg;
}

.answer-block-wrapper {
  @apply relative;
}

.hoverable:hover .pill-button {
  @apply opacity-100;
}

.hoverable {
  @apply transition-colors duration-200;
}

.blinking-cursor {
  animation: blink-animation 1s steps(2, start) infinite;
  position: relative;
  display: inline-block;
  height: 24px;
}

.blinking-cursor::after {
  content: '';
  @apply absolute bottom-0 left-0 h-[4px] w-[20px] bg-s-text-brand dark:bg-s-text-brand-dark duration-200 transition-colors;
}

@keyframes blink-animation {
  to {
    visibility: hidden;
  }
}

:deep(.n-skeleton) {
  border-radius: 4px;
}
</style>
