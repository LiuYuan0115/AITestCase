<template>
  <div class="bg-[#F0F2F4] w-[228px] text-[#111] p-[10px] rounded-[12px]">
    <h3
      v-if="text"
      class="text-emph-1 text-sm font-bold leading-tight mb-[5px]"
    >
      {{ text }}
    </h3>
    <div
      class="flex flex-row items-center justify-start gap-[6px] mt-[2px]"
      v-if="url"
    >
      <img :src="icon" class="w-6 h-6 rounded-[6px]" alt="website favicon" />
      <div class="flex flex-col items-start justify-start">
        <div
          class="text-sm font-normal leading-[14px] text-emph-2 max-w-[178px] truncate"
        >
          {{ title }}
        </div>
        <div
          class="text-xs font-normal leading-[14px] text-emph-3 max-w-[178px] truncate"
        >
          {{ url }}
        </div>
      </div>
    </div>
    <!-- 简洁模式：无url时只显示desc -->
    <div
      v-if="desc"
      class="text-xs font-normal leading-[18px] text-emph-3 whitespace-pre-line break-words line-clamp-3"
    >
      {{ desc }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text: string
  icon?: string
  title?: string
  url?: string
  desc?: string
}>()
</script>
