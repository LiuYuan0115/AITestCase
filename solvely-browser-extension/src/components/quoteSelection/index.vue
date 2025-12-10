<template>
  <div id="solvely-quote-selection-root" style="pointer-events: none;">
    <QuoteToolbar
      :shouldShow="shouldShowQuoteBtn"
      :position="quoteBtnPosition"
      @toQuote="handleQuoteClick"
    />
  </div>
</template>

<script setup lang="ts">
import { inject, watch } from 'vue'
import { useQuoteSelection } from '@/composables/content/useQuoteSelection'
import { useQuoteManager } from '@/composables/content/useQuoteManager'
import QuoteToolbar from './QuoteToolbar.vue'
import trackEvent from '@/utils/trackEvent'

// 挂载选区监听中间件（默认不启用复制功能）
const { shouldShowQuoteBtn, quoteBtnPosition, getStatus, hideQuoteBtn } =
  useQuoteSelection({
    enableCopyOverride: true, // 默认关闭复制功能
  })

const quoteManager = useQuoteManager()

// 🎯 尝试注入浮层的Quote回调
const handleLayerQuote = inject<((highlightedText: string) => void) | null>('handleLayerQuote', null)

// 处理引用按钮点击事件
const handleQuoteClick = () => {
  const selection = window.getSelection()
  const status = getStatus()

  const selectedText =
    selection && !selection.isCollapsed ? selection.toString().trim() : ''
  const highlightedText = status.lastSelectedContent || selectedText || ''

  if (!highlightedText) {
    hideQuoteBtn()
    return
  }

  // 🎯 判断环境：如果能 inject 到浮层回调，说明在浮层中
  if (handleLayerQuote) {
    // 浮层模式：只传高亮文本，上下文由浮层统一获取
    trackEvent.track('Plugin_Sidebar_Quote_Click')
    handleLayerQuote(highlightedText)
  } else {
    // 🎯 侧边栏模式：走原逻辑
    trackEvent.track('Plugin_Sidebar_Quote_Click')
    
    // 从 data-context-text 读取上下文
    const context = status.lastContextText || ''
    
    // 更新 QuoteManager
    quoteManager.updateContext({
      allText: context || highlightedText,
      stepText: highlightedText,
      stepTitleAndText: highlightedText,
      from: 'quote',
    })
  }

  hideQuoteBtn()
}

// 当他展示的时候上报埋点Plugin_Sidebar_Quote_Show
watch(shouldShowQuoteBtn, (newVal) => {
  if (newVal) {
    trackEvent.track('Plugin_Sidebar_Quote_Show', {
      from: 'quote',
    })
  }
})
</script>
