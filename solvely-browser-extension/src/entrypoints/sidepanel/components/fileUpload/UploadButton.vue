<template>
  <div class="relative group">
    <CustomTooltip text="Support image or PDF files" position="top">
      <Button
        icon="upload-file"
        class="w-[32px] rounded-[16px] border border-s-border-secondary dark:border-s-border-secondary-dark"
        @click="$emit('click')"
      />
    </CustomTooltip>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/common/Button.vue'
import CustomTooltip from '@/components/common/CustomTooltip.vue'

defineEmits<{
  click: []
}>()
</script>
