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

      <div class="flex flex-col gap-[12px] overflow-x-auto">
        <div
          v-for="(item, index) in data.questions"
          :key="index"
          class="flex items-start gap-[12px]"
        >
          <span
            v-if="data.questions.length > 1"
            class="text-[14px] font-semibold text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200"
          >
            {{ item.number }}.
          </span>
          <div
            class="text-[14px] font-semibold leading-[160%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
          >
            <LatexFormat :text="item.answer" />
          </div>
        </div>
      </div>

      <!-- 使用 ModelCompareButton 组件 -->
      <ModelCompareButton
        v-if="shouldShowCompare"
        @switch-model="handleModelSwitch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, type ComputedRef } from 'vue'
import LatexFormat from '@/components/common/LatexFormat.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ModelCompareButton from './ModelCompareButton.vue'
import type { FinalAnswerData } from '../composables/types'
import { InjectionTokens } from '@/entrypoints/sidepanel/types/token'

defineProps<{
  data: FinalAnswerData
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

const showModelNavigator = inject<ComputedRef<boolean>>(InjectionTokens.SHOW_MODEL_NAVIGATOR)
const shouldShowCompare = computed(() => showModelNavigator?.value ?? true)
</script>
