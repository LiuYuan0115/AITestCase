<template>
  <div class="flex flex-col gap-[10px] mb-[10px]">
    <div class="flex items-center justify-between">
      <h3
        class="text-[16px] font-bold leading-[150%] tracking-[0.32px] text-s-function-success dark:text-s-function-success-dark transition-colors duration-200"
      >
        Final Answer
      </h3>
    </div>

    <div class="flex flex-col gap-[12px] p-[16px] rounded-[16px] bg-b_final dark:bg-b_final_dk">
      <div
        v-if="modelId === 'MultiModel'"
        class="flex items-center gap-[4px] text-[12px] leading-[130%] font-[500] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark"
      >
        <SvgIcon
          name="star"
          size="30"
        />We ran your question through models and generated an accurate answer for you
      </div>

      <ul
        v-if="data.options?.length"
        class="flex flex-col gap-[10px]"
      >
        <li
          v-for="(option, index) in data.options"
          :key="option.label || index"
          class="flex items-start gap-1 text-[14px] leading-[130%]"
          :class="
            option.isCorrect === 'yes'
              ? 'font-[600] text-[#297D00] dark:text-[#B0F990]'
              : 'text-t_3 dark:text-t_3_dk'
          "
        >
          <span class="uppercase h-[18px] min-w-[18px] leading-[18px]">
            {{ option.label }}
          </span>
          <span>
            <LatexFormat :text="option.text" />
          </span>
        </li>
      </ul>

      <!-- 使用 ModelCompareButton 组件 -->
      <ModelCompareButton
        v-if="shouldShowCompare"
        @switch-model="handleModelSwitch"
      />
    </div>

    <div
      v-if="data.explanation"
      class="flex flex-col gap-[12px]"
    >
      <h4
        class="text-[16px] font-[700] leading-[140%] text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200"
      >
        Explanation
      </h4>
      <div
        class="text-[14px] font-[400] leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
      >
        <LatexFormat :text="data.explanation" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, type ComputedRef } from 'vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ModelCompareButton from './ModelCompareButton.vue'
import type { QuestionSingleData } from '../composables/types'
import { InjectionTokens } from '@/entrypoints/sidepanel/types/token'

defineProps<{
  data: QuestionSingleData
  componentId?: string
  modelId?: string
}>()

const emit = defineEmits<{
  (e: 'switchModel', modelId: string): void
}>()

// 处理模型切换
function handleModelSwitch(modelId: string) {
  emit('switchModel', modelId)
}

const showActions = inject<ComputedRef<boolean>>(InjectionTokens.SHOW_ACTIONS)
const shouldShowCompare = computed(() => showActions?.value ?? true)
</script>
