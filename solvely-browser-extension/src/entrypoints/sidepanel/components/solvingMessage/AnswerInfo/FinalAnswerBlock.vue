<script setup lang="ts">
import LatexFormat from '@/components/common/LatexFormat.vue'

// 定义组件属性
defineProps({
  data: {
    type: Object,
    required: true,
  },
  shouldShowNumbered: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <div class="final-answer">
    <!-- 内容区域 -->
    <div class="content-wrapper">
      <div class="content-inner">
        <template v-for="(content, index) in data.contents" :key="index">
          <!-- 标题部分 -->
          <h3 v-if="content.type === 'title'" class="title flex">
            <span>Final Answer</span>
          </h3>
          <!-- 正文部分 -->
          <p
            v-else-if="content.type === 'body'"
            class="body question-list"
            :class="{ 'show-numbers': shouldShowNumbered }"
          >
            <LatexFormat :text="content.text" :key="index" />
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-inner {
  @apply flex flex-col gap-[10px] overflow-x-auto;
}

.final-answer {
  @apply mb-[6px] w-full;

  .title {
    @apply text-[16px] font-[700] leading-[150%] text-s-function-success dark:text-s-function-success-dark duration-200 transition-colors tracking-[0.32px] justify-between items-center;
  }

  .body {
    @apply text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors;
  }
}

.final-answer-old {
  @apply rounded-lg px-4 py-0 pl-0 transition-colors duration-200 mt-[8px];

  .content-wrapper {
    @apply overflow-hidden pl-[28px] w-full overflow-x-auto;
  }

  .content-inner {
    @apply flex flex-col gap-[7px] overflow-x-auto;
  }

  .title {
    @apply font-[600] text-[14px] leading-[140%] text-s-text-brand dark:text-s-text-brand-dark duration-200 transition-colors;
  }

  .body {
    @apply font-[400] text-[14px] leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors;
  }
}

/* 自定义列表样式 - 只在 show-numbers 类存在时显示序号 */
.question-list {
  /* 重置计数器 */
  :deep(ol) {
    counter-reset: question-counter;
    @apply list-none pl-0 flex flex-col gap-[12px];
  }

  :deep(ol li) {
    counter-increment: question-counter;
    @apply flex items-center gap-[12px] !mb-0;
    > * {
      @apply flex-1;
    }
  }

  /* 自定义序号样式 */
  :deep(ol li::before) {
    content: 'Q' counter(question-counter);
    @apply w-9 h-9 bg-disabled-bg dark:bg-disabled-bg-dark text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors rounded-full flex items-center justify-center text-xs font-bold;
  }

  /* 隐藏唯一子元素的序号 */
  :deep(ol li:only-child::before) {
    display: none;
  }
}

/* 无序号状态 - 使用普通列表样式 */
.question-list:not(.show-numbers) {
  :deep(ol) {
    @apply list-none pl-0 flex flex-col gap-[12px];
  }

  :deep(ol li) {
    @apply flex items-center gap-[12px] !mb-0;
  }
}
</style>
