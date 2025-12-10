<template>
  <div class="markdown-block relative z-0 flex rounded-lg p-0 w-full">
    <!-- 左侧指示器：包含空心圆和竖线 -->
    <div class="step-indicator flex w-5 flex-shrink-0 select-none flex-col items-center">
      <div class="circle-index relative flex h-[20px] w-[20px] items-center justify-center"></div>
      <div class="vertical-line relative mt-[5px] w-[1px] flex-1 bg-s-border-secondary dark:bg-s-border-secondary-dark color-transition"></div>
    </div>

    <!-- 右侧内容区域 -->
    <div class="content-wrapper relative min-w-0 flex-1 overflow-hidden pl-[8px] w-full overflow-x-auto text-t_1 dark:text-t_1_dk">
      <div class="content rounded-[4px] transition-all duration-200 font-[400] text-[14px] leading-[160%]">
        <LatexFormat :text="data.content" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LatexFormat from '@/components/common/LatexFormat.vue'
import type { MarkdownData } from '../composables/types'

defineProps<{
  data: MarkdownData
  componentId?: string
}>()
</script>

<style scoped>
/* 空心圆角标样式 */
.circle-index::before {
  @apply absolute h-[14px] w-[14px] rounded-full border-[4px] border-s-border-secondary dark:border-s-border-secondary-dark bg-b_card dark:bg-b_card_dk transition-colors duration-200 content-[''];
}

/* hover 状态样式 */
.markdown-block:hover .vertical-line {
  @apply bg-t_brand dark:bg-t_brand_dk;
}

.markdown-block:hover .circle-index::before {
  @apply border-t_brand dark:border-t_brand_dk bg-white;
}
</style>
