// 状态
// 1.empty
// 2.loaded
import emitter from '@/utils/eventBus'
// 创建单例实例
let instance: ReturnType<typeof createQuoteStaging> | null = null

enum QuoteStagingStatus {
  Empty = 'empty',
  Loaded = 'loaded',
}

function createQuoteStaging() {
  const quoteIsShow = ref(false)
  const quoteStagingStatus = ref(QuoteStagingStatus.Empty)
  const quoteText = ref('')

  const addQuoteText = (text: string) => {
    emitter.emit('close-file-staging')

    quoteStagingStatus.value = QuoteStagingStatus.Loaded
    quoteText.value = text
  }

  const clearQuoteText = () => {
    quoteStagingStatus.value = QuoteStagingStatus.Empty
    quoteText.value = ''
  }

  watch(quoteStagingStatus, (newVal) => {
    quoteIsShow.value = newVal === QuoteStagingStatus.Loaded
  })

  return {
    quoteIsShow,
    quoteText,
    addQuoteText,
    clearQuoteText,
  }
}

export const useQuoteStaging = () => {
  if (!instance) {
    instance = createQuoteStaging()
  }
  return instance
}
