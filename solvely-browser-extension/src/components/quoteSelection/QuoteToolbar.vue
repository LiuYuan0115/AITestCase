<template>
  <div
    :style="toolbarStyle"
    v-show="shouldShow"
    ref="toolbarRef"
    @mousedown="(e) => e.stopPropagation()"
    class="z-50 w-fit transition-colors duration-200 cursor-auto flex items-center justify-between gap-[6px] shadow-[0_1px_12px_1px_rgba(0,0,0,0.12)] relative rounded-[6px]"
  >
    <!-- Quote按钮 -->
    <button
      type="button"
      :class="[
        'px-[10px] py-[6px] rounded-[6px] text-sm font-normal cursor-pointer flex justify-center',
        'place-items-center',
        'transition-all duration-200',
        'bg-s-interface-bg dark:bg-[#252D3E] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200',
        'hover:bg-[#ECF5FF] dark:hover:bg-[#314B68]',
        'border border-white dark:border-[#767A81] hover:border-[#ECF5FF]'
      ]"
      @click="toQuote"
    >
      <SvgIcon name="quote/quote" size="20" class="mr-1" />
      <span class="text-[14px] font-[400] leading-[20px]">Quote & Ask</span>
    </button>
  </div>
</template>

<script lang="ts" setup>
import SvgIcon from '@/components/common/SvgIcon.vue'
import { computed } from 'vue'

const props = defineProps<{
  shouldShow: boolean
  position: {
    left: string
    top: string
  }
}>()

const toolbarStyle = computed(() => {
  return {
    position: 'absolute' as const,
    left: props.position.left,
    top: props.position.top,
    pointerEvents: 'auto' as const,
  }
})

const emit = defineEmits<{
  (e: 'toQuote'): void
}>()

const toQuote = () => {
  emit('toQuote')
}
</script> 