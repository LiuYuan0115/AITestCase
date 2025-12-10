<template>
  <div class="follow-mouse-box">
    <div class="bg-secondary dark:bg-secondary-dark shadow-sm follow-mouse text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors" :style="mouseStyle">
      Capture 1 question
    </div>
  </div>
</template>

<script lang="ts" setup>
const mouseStyle = ref({});

const updateMousePosition = (event: MouseEvent) => {
  mouseStyle.value = {
    left: `${event.clientX}px`,
    top: `${event.clientY + 10}px`,
  };
};

onMounted(() => {
  window.addEventListener("mousemove", updateMousePosition);
});

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", updateMousePosition);
});
</script>

<style lang="less">
.follow-mouse-box {
  .follow-mouse {
    position: fixed;
    // pointer-events: none; /* 防止元素干扰鼠标事件 */
    z-index: 230000;
    padding: 1px 12px;
    border-radius: 14px;
    font-size: 13px;
    border-top-left-radius: 0;
  }
}
</style>
