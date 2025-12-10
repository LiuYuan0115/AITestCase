<template>
  <div class="flex flex-col gap-[10px] overflow-x-auto">
    <div class="flex items-center justify-between">
      <h3
        class="text-[16px] font-bold leading-[150%] tracking-[0.32px] text-s-function-success dark:text-s-function-success-dark transition-colors duration-200"
      >
        Final Answer
      </h3>
    </div>

    <div class="flex flex-col gap-[12px]">
      <div
        v-for="(item, index) in data.questions"
        :key="index"
        class="flex items-start gap-[12px]"
      >
        <span class="text-[14px] font-semibold text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200">
          {{ item.number }}.
        </span>
        <div class="text-[14px] font-semibold leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200">
          <LatexFormat :text="item.answer" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LatexFormat from '@/components/common/LatexFormat.vue'
import type { FinalAnswerData } from '../composables/types'

defineProps<{
  data: FinalAnswerData
  componentId?: string
}>()
</script>
