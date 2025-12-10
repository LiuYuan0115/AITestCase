<template>
  <Transition name="toast">
    <div v-if="visible"
      class="fixed flex justify-center items-center z-[9999] top-[50%] left-0 right-0 translate-y-[-50%]">
      <div
        class="max-w-auto px-3 py-2 bg-b_tip dark:bg-b_tip_dk text-white rounded-[8px] text-[14px] min-w-[68px] max-w-[220px] break-words whitespace-normal transition-colors duration-200 backdrop-blur-[6px]">
        {{ message }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  duration?: number
}>()

const message = ref('')
const visible = ref(false)

const show = (msg: string) => {
  message.value = msg
  visible.value = true
  if (props.duration) {
    setTimeout(() => {
      visible.value = false
    }, props.duration)
  }
}

defineExpose({
  show
})
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>