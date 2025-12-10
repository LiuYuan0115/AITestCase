<template>
  <button
    type="button"
    :class="[
      'relative inline-flex h-[18px] w-[32px] flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
      modelValue ? 'bg-primary' : 'bg-gray-200',
    ]"
    role="switch"
    :aria-checked="modelValue"
    @click="toggle"
  >
    <span
      :class="[
        'pointer-events-none inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow transition duration-200 ease-in-out',
        modelValue ? 'translate-x-[14px]' : 'translate-x-0',
      ]"
    />
  </button>
</template>

<script setup lang="ts">
const modelValue = defineModel<boolean>()

const emit = defineEmits<{
  (e: 'toggle', value: boolean): void
}>()

const toggle = () => {
  modelValue.value = !modelValue.value
  emit('toggle', modelValue.value)
}
</script>
