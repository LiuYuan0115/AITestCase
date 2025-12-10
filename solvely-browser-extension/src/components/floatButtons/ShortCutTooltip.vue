<template>
  <div class="relative">
    <slot
      @mouseenter.self="handleMouseEnter"
      @mouseleave.self="handleMouseLeave"
    ></slot>

    <!-- Tooltip -->
    <div
      v-show="showTooltip"
      class="absolute z-50 px-2 py-1 text-sm text-white bg-black rounded shadow-md whitespace-nowrap pointer-events-none"
      :class="[
        position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-4' : '',
        position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-4' : '',
        position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-4' : '',
        position === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-4' : '',
      ]"
    >
      {{ content }}
    </div>
    <SvgIcon
      v-show="showTooltip"
      name="tooltip/arrow-scrubber"
      size="28"
      class="absolute pointer-events-none"
      :class="[
        position === 'top'
          ? 'bottom-full left-1/2 -translate-x-1/2 rotate-90'
          : '',
        position === 'bottom'
          ? 'top-full left-1/2 -translate-x-1/2  -rotate-90'
          : '',
        position === 'left' ? 'right-full top-1/2 -translate-y-1/2 ' : '',
        position === 'right'
          ? 'left-full top-1/2 -translate-y-1/2 rotate-180'
          : '',
      ]"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'

const props = defineProps({
  content: {
    type: String,
    required: true,
    default: '',
  },
  position: {
    type: String,
    default: 'top',
    validator: (value: string) =>
      ['top', 'bottom', 'left', 'right'].includes(value),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const showTooltip = ref(false)

const handleMouseEnter = () => {
  if (!props.disabled) {
    showTooltip.value = true
  }
}

const handleMouseLeave = () => {
  if (!props.disabled) {
    showTooltip.value = false
  }
}
</script>

<style lang="less" scoped></style>
