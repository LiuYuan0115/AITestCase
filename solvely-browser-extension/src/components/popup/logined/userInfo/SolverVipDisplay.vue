<template>
  <div class="flex items-center justify-start gap-1">
    <img :src="solverVip" class="w-4 h-4" />
    <div
      class="justify-center text-Text-colors-Medium-Emphasis text-sm font-medium font-['Inter'] leading-tight"
    >
      Unlimited Solver
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  solverVip: string
}>()
</script> 