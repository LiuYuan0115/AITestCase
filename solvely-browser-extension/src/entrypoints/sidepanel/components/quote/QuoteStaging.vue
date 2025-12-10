<template>
  <div
    class="p-2 mb-4 min-w-[304px] border rounded-[12px] border-[#C4C6C9] dark:border-[#2F3543] bg-transparent relative group"
    v-if="quoteIsShow"
  >
    <div
      class="text-[12px] mb-[6px] leading-[15px] font-normal text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark"
    >
      Quote text
    </div>
    <div
      class="text-[12px] max-h-9 font-normal text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark break-all relative"
    >
      <!-- 有公式时：使用 LatexFormat 和滚动 -->
      <div v-if="hasFormula" class="overflow-y-auto max-h-[38px] quote-scroll">
        <LatexFormat
          v-if="quoteText"
          :text="quoteText"
          ref="quoteLatexFormatRef"
        />
      </div>

      <!-- 无公式时：直接显示文本，使用 CSS line-clamp -->
      <div v-else class="line-clamp-2">
        {{ quoteText }}
      </div>
    </div>

    <!-- 关闭按钮 -->
    <button
      class="w-5 h-5 absolute top-[-10px] right-[-10px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      @click="handleClose"
    >
      <SvgIcon
        :name="'textSelection/select-close'"
        size="20"
        class="text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import { useQuoteStaging } from '@/entrypoints/sidepanel/composables/useQuoteStaging'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import emitter from '@/utils/eventBus'
import trackEvent from '~/utils/trackEvent'
import { useQuoteManager } from '@/composables/content/useQuoteManager'

const { quoteText, quoteIsShow } = useQuoteStaging()
const { clearContext, currentContext } = useQuoteManager()

const quoteLatexFormatRef = ref<InstanceType<typeof LatexFormat>>()

// 判断文本是否含有公式
const hasFormula = ref(false)

/**
 * 检查文本中是否包含公式的函数
 * 通过检测常见的数学公式标记来判断
 */
const checkTextHasFormula = (text: string) => {
  if (!text) return false

  // 检测常见的数学公式标记
  const formulaPatterns = [
    /\$.*?\$/g, // $...$ 格式
    /\$\$.*?\$\$/g, // $$...$$ 格式
    /\\[a-zA-Z]+/g, // LaTeX 命令
    /\\\(.*?\\\)/g, // \(...\) 格式
    /\\\[.*?\\\]/g, // \[...\] 格式
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

  return formulaPatterns.some((pattern) => pattern.test(text))
}

/**
 * 监听引用文本变化
 * 当文本变化时检测是否包含公式
 */
watch(
  () => quoteText.value,
  (newValue) => {
    // 检测文本是否包含公式
    hasFormula.value = checkTextHasFormula(newValue)
  }
)

/**
 * 处理取消按钮点击事件
 */
const handleCancel = () => clearContext()
const handleClose = () => {
  trackEvent.track('Plugin_Sidebar_Quote_Close', {
    from: currentContext.value?.from,
  })
  clearContext()
}

/**
 * 组件挂载时设置全局事件监听
 */
onMounted(() => {
  // 监听全局关闭事件
  emitter.on('close-quote-staging', handleCancel)
})

/**
 * 组件卸载时清理事件监听
 */
onUnmounted(() => {
  // 移除事件监听
  emitter.off('close-quote-staging', handleCancel)
})
</script>

<style scoped>
/* 自定义滚动条样式 */
.quote-scroll::-webkit-scrollbar {
  width: 4px;
}

.quote-scroll::-webkit-scrollbar-track {
  background: transparent;
  margin: 2px 0; /* 增加上下间距 */
}

.quote-scroll::-webkit-scrollbar-thumb {
  background: #c4c6c9;
  border-radius: 2px;
}

.quote-scroll::-webkit-scrollbar-thumb:hover {
  background: #a0a3a7;
}

/* 深色模式滚动条 */
.dark .quote-scroll::-webkit-scrollbar-thumb {
  background: #2f3543;
}

.dark .quote-scroll::-webkit-scrollbar-thumb:hover {
  background: #3f4758;
}
</style>
