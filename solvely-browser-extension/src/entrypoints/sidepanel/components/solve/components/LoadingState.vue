<template>
  <div class="pb-[20px]">
    <Vue3Lottie
      :animation-data="animationData"
      :width="257"
      :height="20"
      :loop="true"
      :autoplay="true"
      :style="{ margin: 0, height: '20px', width: '257px' }"
    />
  </div>
</template>

<script setup lang="ts">
import { Vue3Lottie } from 'vue3-lottie'
import animationData from '@/assets/animations/message-loading.json'
</script>
