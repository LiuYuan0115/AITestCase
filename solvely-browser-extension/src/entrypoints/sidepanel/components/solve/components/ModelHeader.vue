<template>
  <div
    class="flex items-center gap-[4px] mb-[4px] text-[14px] font-[400] leading-[140%] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200"
  >
    <SvgIcon
      :name="modelIcon"
      size="19"
      class="mb-[2px]"
    />
    <span class="text-t_1 dark:text-t_1_dk font-[500]">{{ modelName }}</span>
    <!-- 插槽：用于插入 ThinkingBlock 的 thinking 状态 -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useModelConfig } from '../composables'
import { useDarkMode } from '@/composables/useDarkMode'

const props = defineProps<{
  modelId: string // 直接接收 modelId，不使用 inject
}>()

const { isDark } = useDarkMode()
const { getModelIcon, getButtonDisplayName } = useModelConfig()

const modelIcon = computed(() => {
  return getModelIcon(props.modelId) || 'models/solvely-auto-active'
})

const modelName = computed(() => {
  return getButtonDisplayName(props.modelId)
})
</script>

