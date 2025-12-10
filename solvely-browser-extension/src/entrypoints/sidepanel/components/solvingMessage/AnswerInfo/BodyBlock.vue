<script setup>
import LatexFormat from '@/components/common/LatexFormat.vue'
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
  showType: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div
    class="body-block"
    :class="{ 'is-active': isActive, 'is-hover': isHover }"
  >
    <!-- 左侧指示器：包含空心圆和竖线 -->
    <div class="step-indicator">
      <div class="circle-index"></div>
      <div class="vertical-line"></div>
    </div>

    <!-- 右侧内容区域 -->
    <div class="content-wrapper">
      <div class="content" :class="{ 'is-active': isActive }">
        <template v-if="data.contents">
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
        </template>
        <p v-else class="text">
          <LatexFormat :text="data.text" />
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.body-block {
  @apply relative z-0 flex rounded-lg p-0 w-full;
}

.body-block.is-active {
  @apply z-10;
}

/* 左侧指示器样式 */
.step-indicator {
  @apply flex w-5 flex-shrink-0 select-none flex-col items-center;
}

/* 竖线样式 */
.vertical-line {
  @apply relative mt-[5px] w-[1px] flex-1 bg-s-border-secondary dark:bg-s-border-secondary-dark transition-colors duration-200;
}

/* 空心圆角标样式 */
.circle-index {
  @apply relative flex h-[20px] w-[20px] items-center justify-center;
}

.circle-index::before {
  @apply absolute h-[14px] w-[14px] rounded-full border-[4px] border-s-border-secondary dark:border-s-border-secondary-dark bg-s-disable-bg dark:bg-s-disable-bg-dark transition-colors duration-200 content-[''];
}

/* 内容区域样式 */
.content-wrapper {
  @apply relative min-w-0 flex-1 overflow-hidden pl-[8px] w-full overflow-x-auto;
}

/* hover 和 active 状态样式 */
.body-block:hover .vertical-line,
.body-block.is-active .vertical-line,
.body-block.is-hover .vertical-line {
  @apply bg-s-text-brand dark:bg-s-text-brand-dark;
}

.body-block:hover .circle-index::before,
.body-block.is-active .circle-index::before,
.body-block.is-hover .circle-index::before {
  @apply border-s-text-brand dark:border-s-text-brand-dark bg-s-interface-bg dark:bg-s-interface-bg-dark;
}

/* 内容容器样式 */
.content {
  @apply rounded-[4px] transition-all duration-200;
}

.content.is-active {
  @apply bg-s-panel-bg dark:bg-s-panel-bg-dark;
}

.content-inner {
  @apply flex flex-col gap-[15px];
}

/* 文本样式 */
.title {
  @apply font-sans text-base font-bold leading-[130%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors;
}

.text {
  @apply font-[400] text-[14px] leading-[160%];
}
</style>
