<template>
  <div
    :style="toolbarStyle"
    v-show="shouldShow && selectionText"
    ref="toolbarRef"
    @mousedown="(e) => e.stopPropagation()"
    class="h-[36px] w-fit bg-[#fff] dark:bg-[#222A38] transition-colors duration-200 rounded-[12px] cursor-auto flex items-center justify-between gap-[6px] pl-[7px] pr-[7px] shadow-[0_0_24px_rgba(0,0,0,0.12)] relative group box-border border border-[#fff] dark:border-[#2C3649]"
  >
    <SvgIcon
      name="logo"
      size="22"
    />

    <!-- 按钮列表 -->
    <button
      v-for="btn in actionButtons"
      :key="btn.key"
      type="button"
      :class="[
        'pl-1 pr-1.5 h-[28px] rounded-[6px] flex items-center text-[14px] font-[400] cursor-pointer transition-colors duration-200 hover:bg-[#ECF5FF] dark:hover:bg-[#303A52]',
        btn.textColor,
        btn.width
      ]"
      @click="btn.handler"
    >
      <SvgIcon
        :name="btn.icon"
        :size="btn.iconSize"
        class="mr-0.5"
      />
      {{ btn.label }}
    </button>

    <i class="w-[1px] h-[16px] bg-[#E6E8EA] dark:bg-[#474C58] transition-colors duration-200"></i>

    <!-- Chat按钮 -->
    <button
      type="button"
      class="p-1 h-[28px] rounded-[6px] text-sm font-normal cursor-pointer flex justify-center transition-colors duration-200 hover:bg-[#ECF5FF] dark:hover:bg-[#303A52] text-s-text-brand dark:text-s-text-brand-dark"
      @click="toChat"
    >
      <SvgIcon
        name="textSelection/select-chat"
        size="20"
      />
    </button>

    <!-- 右上角关闭按钮 改成始终不关闭-->
    <!-- <button
      class="absolute right-[-8px] top-[-8px] rounded-full cursor-pointer transition-colors duration-200 hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark opacity-0 invisible group-hover:visible group-hover:opacity-100"
      @click.stop="toClose"
      style="padding:0;border:none;background:transparent;"
    >
      <SvgIcon
        name="textSelection/select-close"
        size="16"
      />
    </button> -->
  </div>

  <!-- 关闭确认Modal -->
  <PdfCloseModal
    :show="showCloseModal"
    title="Disable"
    content="You can re-enable in settings"
    @confirm="handleModalConfirm"
    @cancel="handleModalCancel"
  />
</template>

<script lang="ts" setup>
import SvgIcon from '@/components/common/SvgIcon.vue'
import { computed, ref } from 'vue'
import { usePdfTextSelection } from '../composables/usePdfTextSelection'
import PdfCloseModal from './PdfCloseModal.vue'
// 使用划词逻辑
const {
  shouldShow,
  selectionText,
  toolbarPosition,
  solveSelection,
  summarizeSelection,
  quizSelection,
  explainSelection,
  chatSelection,
  closeInThisPage,
  closeInGlobal,
} = usePdfTextSelection()

// Modal状态
const showCloseModal = ref(false)

const toSolve = () => solveSelection()
const toExplain = () => explainSelection()
const toSummarize = () => summarizeSelection()
const toQuiz = () => quizSelection()
const toChat = () => chatSelection()
// const toClose = () => showCloseModal.value = true

// 按钮配置映射表
const actionButtons = computed(() => [
  {
    key: 'solve',
    label: 'Solve',
    icon: 'textSelection/select-solve',
    iconSize: 20,
    textColor: 'text-s-text-brand dark:text-s-text-brand-dark',
    width: 'w-[69px]',
    handler: toSolve,
  },
  {
    key: 'explain',
    label: 'Explain',
    icon: 'textSelection/select-explain',
    iconSize: 20,
    textColor: 'text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark',
    width: 'w-[80px]',
    handler: toExplain,
  },
  {
    key: 'summarize',
    label: 'Summarize',
    icon: 'textSelection/select-summarize',
    iconSize: 20,
    textColor: 'text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark',
    width: 'w-[106px]',
    handler: toSummarize,
  },
  {
    key: 'quiz',
    label: 'Quiz',
    icon: 'textSelection/select-quiz',
    iconSize: 20,
    textColor: 'text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark',
    width: 'w-[62px]',
    handler: toQuiz,
  },
])

const toolbarStyle = computed(() => {
  return {
    position: 'absolute' as const,
    left: toolbarPosition.value.left,
    top: toolbarPosition.value.top,
    zIndex: 99999999 as const,
    pointerEvents: 'auto' as const,
  }
})

const handleModalConfirm = (value: 'next-visit' | 'global') => {
  if (value === 'next-visit') {
    closeInThisPage()
  } else if (value === 'global') {
    closeInGlobal()
  }
  showCloseModal.value = false
}
const handleModalCancel = () => (showCloseModal.value = false)
</script>
