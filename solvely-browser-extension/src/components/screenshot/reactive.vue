<template>
  <div class="reactive-wrap">
    <transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="overflow-hidden rounded-lg bg-s-interface-bg dark:bg-s-interface-bg-dark shadow-lg ring-1 ring-s-border/5 dark:ring-s-border-dark/5 notification transition-colors duration-200"
      >
        <div class="flex items-center">
          <div class="shrink-0">
            <ExclamationCircleIcon
              v-if="props.type === 'error'"
              class="size-[20px] text-s-function-erro dark:text-s-function-erro-dark transition-colors duration-200"
              aria-hidden="true"
            />
            <CheckCircleIcon
              v-else
              class="size-[20px] text-s-function-success dark:text-s-function-success-dark transition-colors duration-200"
              aria-hidden="true"
            />
          </div>
          <div class="mx-[8px] flex-1">
            <p class="text-[13px] font-medium text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200">
              {{ props.message }}
            </p>
            <!-- <p class="mt-1 text-sm text-gray-500">
                Anyone with a link can now view this file.
              </p> -->
          </div>
          <div class="ml-[4px] flex shrink-0">
            <button
              type="button"
              @click="show = false"
              class="inline-flex rounded-md bg-s-interface-bg dark:bg-s-interface-bg-dark text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark hover:text-s-text-high-emphasis dark:hover:text-s-text-high-emphasis-dark transition-colors duration-200"
            >
              <span class="sr-only">Close</span>
              <XMarkIcon class="size-[20px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/vue/24/outline";
import { XMarkIcon } from "@heroicons/vue/20/solid";
const props = defineProps<{
  message: string;
  type: string;
}>();
const show = ref(false);
watch(
  () => props.message,
  () => {
    if (!props.message) return;
    show.value = true;
    setTimeout(() => {
      show.value = false;
    }, 3000);
  }
);
</script>

<style lang="less">
.reactive-wrap {
  .notification {
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 12px 16px;
    z-index: 250000;
  }
}
</style>
