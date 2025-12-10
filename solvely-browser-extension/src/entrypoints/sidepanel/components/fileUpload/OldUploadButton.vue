<template>
    <div class="relative group">
      <button 
        class="w-5 h-5  bg-s-input-bg dark:bg-s-input-bg-dark rounded-full border border-s-border-secondary dark:border-s-border-secondary-dark text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200 flex justify-cneter items-center p-[2px]"
        @click="$emit('click')"
      >
        <SvgIcon :name="'upload-file'" size="14" class=" transition-colors duration-200" />
      </button>
      <!-- Hover 提示弹窗 -->
      <div class="absolute bottom-full left-0 mb-[2px] px-3 py-1.5 bg-[#3f3f46] border border-s-border-secondary dark:border-s-border-secondary-dark text-white text-xs leading-[15px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        Support image or PDF files
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import SvgIcon from '@/components/common/SvgIcon.vue'
  
  defineEmits<{
    click: []
  }>()
  </script>
  