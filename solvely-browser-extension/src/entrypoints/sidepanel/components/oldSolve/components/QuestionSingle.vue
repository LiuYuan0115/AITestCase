<template>
  <div class="flex flex-col gap-[16px] w-full">
    <div class="flex items-center justify-between gap-[12px]">
      <h3
        class="text-[16px] font-[700] leading-[150%] tracking-[0.32px] text-s-function-success dark:text-s-function-success-dark transition-colors duration-200"
      >
        Final Answer
      </h3>
    </div>

    <ul
      v-if="data.options?.length"
      class="flex flex-col gap-[12px]"
    >
      <li
        v-for="(option, index) in data.options"
        :key="option.label || index"
        class="flex items-center gap-[12px] text-[14px] leading-[140%]"
      >
        <span
          class="flex items-center justify-center w-[32px] h-[32px] rounded-full text-[12px] transition-all duration-200"
          :class="
            option.isCorrect === 'yes'
              ? 'bg-s-function-success dark:bg-s-function-success-dark text-s-foundation-white dark:text-s-foundation-white-dark font-[700]'
              : 'bg-disabled-bg dark:bg-disabled-bg-dark text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark font-[400]'
          "
        >
          {{ option.label }}
        </span>
        <span
          class="flex-1 overflow-x-auto transition-all duration-200"
          :class="
            option.isCorrect === 'yes'
              ? 'text-s-function-success dark:text-s-function-success-dark font-[700]'
              : 'text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark font-[400]'
          "
        >
          <LatexFormat :text="option.text" />
        </span>
      </li>
    </ul>

    <div
      v-if="data.explanation"
      class="flex flex-col gap-[12px]"
    >
      <h4 class="text-[16px] font-[700] leading-[140%] text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200">Explanation</h4>
      <div class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200">
        <LatexFormat :text="data.explanation" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LatexFormat from '@/components/common/LatexFormat.vue'
import type { QuestionSingleData } from '../composables/types'

defineProps<{
  data: QuestionSingleData
  componentId?: string
}>()
</script>
