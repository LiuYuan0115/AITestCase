<template>
  <button
    :class="[
      'inline-flex items-center justify-center gap-[4px] h-[32px] text-[14px] font-normal whitespace-nowrap color-transition cursor-pointer',
      {
        'rounded-[18px] bg-b_brand dark:bg-b_brand_dk hover:bg-b_brand_hov dark:hover:bg-b_brand_hov_dk text-t_btn dark:text-t_btn':
          type === 'submit',
        'rounded-[18px] hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk text-t_2 dark:text-t_2_dk': 
          type === 'normal',
        'w-[32px] rounded-[16px] hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk text-t_2 dark:text-t_2_dk':
          type === 'icon-only',
        'rounded-[18px] opacity-60 cursor-not-allowed': 
          disabled,
      },
    ]"
    :disabled="disabled"
    :type="type === 'submit' ? 'submit' : 'button'"
  >
    <SvgIcon
      v-if="icon"
      :name="icon"
      class="inline-flex"
      :size="iconSize"
    />
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'

defineProps({
  /**
   * 图标名称
   */
  icon: {
    type: String,
    default: '',
  },
  iconSize: {
    type: Number,
    default: 20,
  },
  /**
   * 按钮类型：普通按钮、提交按钮或纯图标按钮
   */
  type: {
    type: String as () => 'normal' | 'submit' | 'icon-only' | 'link',
    default: 'normal',
    validator: (value: string) => ['normal', 'submit', 'icon-only', 'link'].includes(value),
  },
  /**
   * 是否禁用
   */
  disabled: {
    type: Boolean,
    default: false,
  },
})
</script>
