<template>
  <button
    class="icon-btn"
    :class="[variant, { active, disabled }]"
    v-tooltip="tooltip"
    :disabled="disabled"
    @click="handleClick"
  >
    <component :is="icon" :size="size" :stroke-width="strokeWidth" />
  </button>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

const props = withDefaults(defineProps<{
  icon: Component;
  tooltip: string;
  variant?: 'default' | 'danger' | 'primary' | 'ghost' | 'success';
  size?: number;
  strokeWidth?: number;
  active?: boolean;
  disabled?: boolean;
}>(), {
  variant: 'default',
  size: 18,
  strokeWidth: 2,
  active: false,
  disabled: false
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

function handleClick(event: MouseEvent) {
  if (!props.disabled) {
    emit('click', event);
  }
}
</script>

<style scoped>
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  background: var(--neo-white, #FFFEF9);
  color: var(--neo-black, #232323);
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.icon-btn:hover:not(.disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
}

.icon-btn:active:not(.disabled) {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--neo-black, #232323);
}

.icon-btn.active {
  background: var(--neo-primary, #5D6AB4);
  color: white;
}

/* Variant: danger */
.icon-btn.danger:hover:not(.disabled) {
  background: var(--neo-red, #E86F68);
  color: white;
}

/* Variant: primary */
.icon-btn.primary {
  background: var(--neo-primary, #5D6AB4);
  color: white;
}

.icon-btn.primary:hover:not(.disabled) {
  background: #4a5699;
}

/* Variant: success */
.icon-btn.success {
  background: var(--neo-green, #90EE90);
}

.icon-btn.success:hover:not(.disabled) {
  background: #7bd97b;
}

/* Variant: ghost */
.icon-btn.ghost {
  border: none;
  box-shadow: none;
  background: transparent;
}

.icon-btn.ghost:hover:not(.disabled) {
  background: var(--neo-cream, #FFF9E6);
  transform: none;
  box-shadow: none;
}

/* Disabled state */
.icon-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: 2px 2px 0 var(--neo-black, #232323) !important;
}
</style>
