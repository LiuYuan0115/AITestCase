<script setup>
import LatexFormat from '@/components/common/LatexFormat.vue'

// 定义组件属性
defineProps({
  data: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="final-answer">
    <!-- 内容区域 -->
    <div class="content-wrapper">
      <div class="content-inner">
        <template v-for="(content, index) in data.contents" :key="index">
          <!-- 标题部分 -->
          <h3 v-if="content.type === 'title'" class="title">
            <LatexFormat :text="content.text" :key="index"/>
          </h3>
          <!-- 正文部分 -->
          <p v-else-if="content.type === 'body'" class="text">
            <LatexFormat :text="content.text" :key="index"/>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.final-answer {
  @apply rounded-lg px-4 py-0 pl-0 transition-colors duration-200;
}

/* 内容区域布局 */
.content-wrapper {
  @apply overflow-hidden pl-[28px];
}

.content-inner {
  @apply flex flex-col gap-[15px] overflow-x-auto;
}

/* 标题样式 */
.title {
  @apply font-sans text-base font-bold leading-[130%] text-primary ;
}

/* 正文样式 */
.text {
  @apply font-sans text-base font-normal leading-[140%] text-emph-1 ;
}
</style>
