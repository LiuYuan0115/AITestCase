<template>
  <div class="question-single flex flex-col gap-[16px]">
    <div class="flex flex-col gap-[12px]">
      <h3
        class="text-[16px] font-[700] leading-[150%] text-s-function-success dark:text-s-function-success-dark duration-200 transition-colors tracking-[0.32px] flex justify-between items-center"
      >
        <span>Final Answer</span>
      </h3>
      <ul v-if="componentJson?.data?.options" class="flex flex-col gap-[12px]">
        <li
          v-for="(option, index) in componentJson?.data?.options"
          :key="index"
          class="flex items-center gap-[12px] text-[14px] font-[400] leading-[140%]"
        >
          <span
            class="flex items-center justify-center w-[32px] h-[32px] rounded-full text-[12px]"
            :class="
              option.isCorrect === 'yes'
                ? 'bg-s-function-success dark:bg-s-function-success-dark text-s-foundation-white dark:text-s-foundation-white-dark font-[700] duration-200 transition-all'
                : 'bg-disabled-bg dark:bg-disabled-bg-dark text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark font-[400] duration-200 transition-all'
            "
          >
            {{ option.label }}
          </span>
          <span
            class="flex-1 overflow-x-auto"
            :class="
              option.isCorrect === 'yes'
                ? 'text-s-function-success dark:text-s-function-success-dark font-[700] duration-200 transition-all'
                : 'text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark font-[400] duration-200 transition-all'
            "
          >
            <LatexFormat :text="option.text" />
          </span>
        </li>
      </ul>
    </div>
    <ModelPopUp v-if="componentJson?.data?.options && isMutipleModel" />
    <div
      v-if="componentJson?.data?.explanation"
      class="flex flex-col gap-[12px]"
    >
      <h3
        class="title text-[16px] font-[700] leading-[140%] text-s-text-brand dark:text-s-text-brand-dark duration-200 transition-colors"
      >
        Explanation
      </h3>
      <div
        class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors"
      >
        <LatexFormat :text="componentJson?.data?.explanation" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { InjectionTokens } from '@/entrypoints/sidepanel/types/token'
import LatexFormat from '@/components/common/LatexFormat.vue'
import ModelPopUp from '../../models/ModelPopUp.vue'
import useABTest from '@/composables/useABTest'

defineProps(['componentJson'])

const { isMutipleModel } = useABTest()
</script>
