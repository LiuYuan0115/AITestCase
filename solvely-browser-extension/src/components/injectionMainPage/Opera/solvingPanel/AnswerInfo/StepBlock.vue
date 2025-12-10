<script setup>
import LatexFormat from '@/components/common/LatexFormat.vue'
// 定义组件属性
defineProps({
  data: {
    type: Object,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isHover: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <div
    class="step-block"
    :class="{ 'is-active': isActive, 'is-hover': isHover }"
  >
    <!-- 左侧指示器：包含数字角标和竖线 -->
    <div class="step-indicator">
      <div class="step-index">
        <slot name="index">1</slot>
      </div>
      <div class="vertical-line"></div>
    </div>

    <!-- 右侧内容区域 -->
    <div class="content-wrapper">
      <div class="content" :class="{ 'is-active': isActive }">
        <div class="content-inner">
          <template v-for="(content, index) in data.contents" :key="index">
            <h3 v-if="content.type === 'title'" class="title">
              <LatexFormat :text="content.text" :key="index"/>
            </h3>
            <p v-else-if="content.type === 'body'" class="text">
              <LatexFormat :text="content.text" :key="index"/>
            </p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.step-block {
  @apply relative z-0 flex rounded-lg p-0;
}

.step-block.is-active {
  @apply z-10;
}

/* 左侧指示器样式 */
.step-indicator {
  @apply flex w-5 flex-shrink-0 select-none flex-col items-center;
}

/* 竖线样式 */
.vertical-line {
  @apply relative mt-[5px] w-[1px] flex-1 bg-gray-200 transition-colors duration-200;
}

/* 数字角标样式 */
.step-index {
  @apply flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#F0F2F4] font-sans text-xs font-medium leading-[130%] text-emph-1 transition-colors duration-200;
}

/* 内容区域样式 */
.content-wrapper {
  @apply relative min-w-0 flex-1 pl-[8px];
}

/* hover 和 active 状态样式 */
.step-block:hover .vertical-line,
.step-block.is-active .vertical-line,
.step-block.is-hover .vertical-line {
  @apply bg-primary text-white;
}

.step-block:hover .step-index,
.step-block.is-active .step-index,
.step-block.is-hover .step-index {
  @apply bg-primary text-white;
}

/* 内容容器样式 */
.content {
  @apply w-full overflow-hidden rounded-[4px] transition-all duration-200;
}

.content.is-active {
  @apply bg-panel-bg;
}

.content-inner {
  @apply flex w-full flex-col gap-[15px] overflow-hidden;
}

/* 文本样式 */
.title {
  @apply flex flex-col justify-center overflow-hidden text-ellipsis font-sans text-base font-bold leading-[130%] text-emph-1;
}

:deep(.title mjx-container) {
  @apply m-0;
}

.text {
  @apply break-words font-sans text-base font-normal leading-[180%] text-emph-1;
}
</style>
