<template>
  <div class="flex flex-col gap-[8px] mb-[11px] w-full">
    <template v-for="(content, index) in data.contents" :key="index">
      <h3
        v-if="content.type === 'title'"
        class="title text-[16px] font-[700] leading-[140%] text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200"
      >
        <span 
          class="title-unnumbered"
          :class="{ 'hidden': shouldShowNumbered }"
        >Explanation</span>
        <span 
          class="title-numbered"
          :class="{ 'hidden': !shouldShowNumbered }"
        >{{ content.text }}</span>
      </h3>
      <p
        v-else-if="content.type === 'body' && content.text && shouldShowBody"
        class="body text-[14px] font-[600] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200 w-full overflow-x-auto"
      >
        <LatexFormat :text="content.text" />
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import LatexFormat from '@/components/common/LatexFormat.vue'

defineProps({
  data: {
    type: Object,
    required: true,
  },
  shouldShowNumbered: {
    type: Boolean,
    default: false,
  },
  shouldShowBody: {
    type: Boolean,
    default: true,
  }
})
</script>
