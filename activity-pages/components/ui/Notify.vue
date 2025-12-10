<template>
  <transition name="slide">
    <div v-if="show" class="notify">{{ message }}</div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const show = ref(false)
const message = ref('')

const showNotify = (newMessage: string, duration = 3000) => {
  message.value = newMessage
  show.value = true

  setTimeout(() => {
    show.value = false
  }, duration)
}

defineExpose({
  showNotify
})
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.5s;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateY(-100%);
}
.notify {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background-color: #007aff;
  color: #fff;
  text-align: center;
  padding: 10px;
  z-index: 999;
}
</style>
