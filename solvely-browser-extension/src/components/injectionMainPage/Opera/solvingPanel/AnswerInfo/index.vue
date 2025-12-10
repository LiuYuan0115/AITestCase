<template>
  <div class="answer-info">
    <!-- 加载中和完成状态 -->
    <div v-for="(item, index) in answerData" :key="index" class="answer-block">
      <div class="answer-block-wrapper">
        <!-- 主要内容 -->
        <component
          :is="componentMap[item.type as keyof typeof componentMap]"
          :data="item"
          :showType="showType"
        >
          <template v-if="item.type === 'step'" #index>
            {{ getStepNumber(index) }}
          </template>
        </component>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import StepBlock from './StepBlock.vue'
import BodyBlock from './BodyBlock.vue'
import FinalAnswerBlock from './FinalAnswerBlock.vue'
//---------------------------------------声明属性
const props = defineProps(['data'])

// 定义内容类型接口
interface ContentItem {
  type: string;
  text: string;
}

interface GraphContentItem {
  type: string;
  content: string;
}

type ContentItemTypes = ContentItem | GraphContentItem;

interface AnswerBlockItem {
  type: string;
  contents: ContentItemTypes[];
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
}

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
const createFinalAnswerBlock = (content: string | string[], language = 'en'): AnswerBlockItem => {
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
  questionStepTitle: string;
  questionStepBody: string;
}

interface Question {
  questionSteps: QuestionStep[];
}

const parseQuestionSteps = (questions: Question[]): AnswerBlockItem[] =>
  questions.flatMap((question) =>
    question.questionSteps.map((step) =>
      createStepBlock(step.questionStepTitle, step.questionStepBody)
    )
  )

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
    // graph的解题走dsl会出现other为```的情况，需要特殊处理，graph占比总解题的1%
    const hasOther = parsedData.other && parsedData.other.trim() !== '```'
    if (hasOther) {
      result.push(...parseContent(parsedData.other))
    }

    if (parsedData.questions) {
      result.push(...parseQuestionSteps(parsedData.questions))
    }

    if (parsedData.finalAnswer) {
      result.push(
        createFinalAnswerBlock(parsedData.finalAnswer, props.data.language)
      )
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
  // 从语言配置中查找对应的语言文本
  // const language = translateLanguageMap.languages.find(
  //   (item: any) => item.code === languageI18nCode
  // )

  // 如果找到对应语言则返回其最终答案文本,否则返回默认值
  // return language?.finalAnswer || ['Final Answer']
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

// 步骤序号管理 - 为每个步骤生成序号
const stepNumbers = computed(() => {
  const numbers = new Map()
  answerData.value.forEach((item: any, index: number) => {
    if (item.type === 'step') {
      numbers.set(index, numbers.size + 1)
    }
  })
  return numbers
})

const getStepNumber = (index: number) => stepNumbers.value.get(index) || 0

//---------------------------------------数据监听
</script>

<style scoped>
.answer-info {
  @apply flex flex-col gap-[18px];
}

.answer-info :deep(p), 
.answer-info :deep(div) {
  @apply !text-sm;
}

.answer-block {
  @apply rounded-lg;
}

.answer-block-wrapper {
  @apply relative;
}

:deep(.answer-block-wrapper h3, .answer-block-wrapper h2) {
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: 130%;
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
  @apply absolute bottom-0 left-0 h-[4px] w-[20px] bg-primary ;
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
