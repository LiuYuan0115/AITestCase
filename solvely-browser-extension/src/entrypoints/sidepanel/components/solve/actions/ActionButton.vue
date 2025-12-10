<template>
  <CustomTooltip :text="tooltip || ''" position="top" :offset="offset">
    <div
      class="action-button flex items-center justify-center w-[32px] h-[32px] rounded-[16px] cursor-pointer transition-all duration-200 hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark"
      :class="{
        'text-s-text-brand dark:text-s-text-brand-dark': active,
        'text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark': !active,
      }"
      @click="emit('click')"
    >
      <SvgIcon
        :name="icon"
        size="20"
      />
    </div>
  </CustomTooltip>
</template>

<script setup lang="ts">
import SvgIcon from '~/components/common/SvgIcon.vue'
import CustomTooltip from '@/components/common/CustomTooltip.vue'

defineProps<{
  icon: string
  active?: boolean
  tooltip?: string
  offset?: {
    x?: number
    y?: number
  }
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>
<style scoped>
.action-button {
  user-select: none;
}
</style>
