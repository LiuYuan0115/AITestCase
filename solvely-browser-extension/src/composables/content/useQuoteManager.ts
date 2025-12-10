// 单例模式，管理Quote，统一控制Quote的更新和清空以及UI状态
// 暴露可读参数currentContext，暴露更新方法updateContext，暴露清空方法clearContext

import { ref, readonly } from 'vue'
import { useQuoteStaging } from '@/entrypoints/sidepanel/composables/useQuoteStaging'
import emitter from '@/utils/eventBus'
const quoteStaging = useQuoteStaging()

// 当前上下文数据接口
interface QuoteContext {
  allText: string // 全量文本（问题 + 答案）
  stepText: string // 选取的步骤内容（不包括标题）
  stepTitleAndText: string // 选取的步骤标题 + 步骤内容
  from: 'step' | 'quote' | 'page' | 'pdf'
  messageId?: string
}

// 单例实例
let instance: ReturnType<typeof createQuoteManager> | null = null

/**
 * 创建 Quote 管理器
 */
function createQuoteManager() {
  // 当前上下文数据
  const currentContext = ref<QuoteContext | null>(null)

  /**
   * 更新step quote上下文
   */
  const updateContext = (
    context: Omit<
      QuoteContext,
      'newContext' | 'isTruncated' | 'originalLength' | 'finalLength'
    >
  ) => {
    // 选取文字强制截断到2000字符（与useTextSelection和usePdfTextSelection保持一致）
    const MAX_QUOTE_TEXT_LENGTH = 2000

    // 去除 br 标签并截断文本
    const cleanStepText = context.stepText.replace(/<br\s*\/?>/gi, '')
    const cleanStepTitleAndText = context.stepTitleAndText.replace(
      /<br\s*\/?>/gi,
      ''
    )

    const truncatedStepText =
      cleanStepText.length > MAX_QUOTE_TEXT_LENGTH
        ? cleanStepText.slice(0, MAX_QUOTE_TEXT_LENGTH)
        : cleanStepText
    const truncatedStepTitleAndText =
      cleanStepTitleAndText.length > MAX_QUOTE_TEXT_LENGTH
        ? cleanStepTitleAndText.slice(0, MAX_QUOTE_TEXT_LENGTH)
        : cleanStepTitleAndText

    // 构建处理后的上下文对象
    const processedContext = {
      allText: context.allText, // 全量文本保持8k限制不变
      stepText: truncatedStepText, // 选取文字截断到2000字符
      stepTitleAndText: truncatedStepTitleAndText, // 选取文字截断到2000字符
      from: context.from,
      messageId: context.messageId,
    }

    console.log(
      `1. [allText 上下文]============================\n`,
      processedContext.allText
    )
    console.log(
      `2. [stepText 选取的步骤内容] (截断到${MAX_QUOTE_TEXT_LENGTH}字符)============================\n`,
      processedContext.stepText
    )
    console.log(
      `3. [stepTitleAndText 选取的步骤标题 + 步骤内容] (截断到${MAX_QUOTE_TEXT_LENGTH}字符)============================\n`,
      processedContext.stepTitleAndText
    )

    // 更新当前上下文
    currentContext.value = { ...processedContext }

    // 直接调用 useQuoteStaging 的 addQuoteText 方法，传递截断后的步骤文本
    quoteStaging.addQuoteText(processedContext.stepTitleAndText)

    // 通知 Footer 聚焦输入框
    emitter.emit('focus-footer-input')

    return currentContext.value
  }

  // 获取当前上下文
  const getCurrentContext = () => currentContext.value

  // 清空当前上下文
  const clearContext = () => {
    currentContext.value = null
    quoteStaging.clearQuoteText()
  }
  return {
    // 状态，只读
    currentContext: readonly(currentContext),
    // 方法，更新，获取，清空
    updateContext,
    getCurrentContext,
    clearContext,
  }
}

/**
 * 获取step quote管理器单例
 */
export function useQuoteManager() {
  if (!instance) {
    instance = createQuoteManager()
  }
  return instance
}

export default useQuoteManager
