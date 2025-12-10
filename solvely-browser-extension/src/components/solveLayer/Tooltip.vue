<template>
  <Transition
    name="tooltip"
    enter-active-class="transition-all duration-200 ease-out"
    leave-active-class="transition-all duration-150 ease-in"
    enter-from-class="opacity-0 scale-95 translate-y-1"
    enter-to-class="opacity-100 scale-100 translate-y-0"
    leave-from-class="opacity-100 scale-100 translate-y-0"
    leave-to-class="opacity-0 scale-95 translate-y-1"
  >
    <div
      v-show="show"
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-[10px] z-[999999999] whitespace-nowrap pointer-events-none"
    >
      <div class="px-2 py-1 text-sm text-white bg-[#334255] rounded shadow-md">
        {{ text }}
      </div>
      <!-- 向下箭头 -->
      <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#334255]"></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  text: string
}>()
</script>
