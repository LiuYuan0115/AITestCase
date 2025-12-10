<template>
  <!-- h5页面专属layout，用于适配大尺寸的设备 -->
  <div class="h5-container relative">
    <slot />
  </div>
</template>

<style scoped>
/* 大于500px */
@media (min-width: 500px) {
  .h5-container {
    width: 500px;
    margin: 0 auto;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }
}
</style>
