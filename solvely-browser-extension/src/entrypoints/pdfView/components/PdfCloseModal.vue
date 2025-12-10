<template>
  <transition name="dialog-fade">
    <div
      v-if="show"
      class="fixed inset-0 flex items-center justify-center z-[2147483657]"
    >
      <transition name="dialog-backdrop-fade">
        <div
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          @click="handleCancel"
        ></div>
      </transition>

      <transition name="dialog-slide">
        <div
          class="bg-s-interface-bg dark:bg-s-interface-bg-dark rounded-[20px] overflow-hidden transform transition-all w-[350px] p-[20px] duration-200"
        >
          <button
            class="absolute top-[20px] right-[20px] bg-s-panel-bg dark:bg-s-panel-bg-dark rounded-full p-[6px] flex items-center justify-center hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200"
            @click="handleCancel"
          >
            <SvgIcon name="close" size="10" />
          </button>
          <h3
            class="text-lg text-center font-bold text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark leading-normal mb-[18px] transition-colors duration-200"
          >
            {{ title }}
          </h3>
          <div>
            <div
              v-for="option in radioOptions"
              :key="option.value"
              class="flex items-center justify-start mb-2 py-[7px] gap-3 cursor-pointer"
              @click="selectOption(option.value)"
            >
              <div
                class="w-[14px] h-[14px] rounded-full border border-s-border dark:border-s-border-dark flex items-center justify-center transition-colors duration-200"
              >
                <div
                  v-if="selectedOption === option.value"
                  class="w-[8px] h-[8px] rounded-full bg-s-text-brand dark:bg-s-text-brand-dark transition-colors duration-200"
                ></div>
              </div>
              <p class="text-[15px] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200">{{ option.label }}</p>
            </div>
          </div>
          <div class="mt-[8px]">
            <p class="text-[13px] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark font-normal leading-tight transition-colors duration-200">
              {{ content }}
            </p>
          </div>
          <div class="mt-[18px] flex justify-end space-x-[8px]">
            <button
              @click="handleCancel"
              type="button"
              class="inline-flex justify-center rounded-[6px] border border-s-border-secondary dark:border-s-border-secondary-dark px-[12px] py-[6px] bg-s-interface-bg dark:bg-s-interface-bg-dark text-[13px] font-normal text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              @click="handleConfirm"
              type="button"
              class="inline-flex justify-center rounded-[6px] border border-s-text-brand dark:border-s-text-brand-dark px-[12px] py-[6px] bg-s-text-brand dark:bg-s-text-brand-dark text-[13px] font-normal text-s-interface-bg hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark transition-colors duration-200"
            >
              Confirm
            </button>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script lang="ts" setup>
import SvgIcon from '@/components/common/SvgIcon.vue'
import { reactive, ref } from 'vue'

export interface RadioOption {
  label: string
  value: 'next-visit' | 'global'
}

const props = defineProps<{
  show: boolean
  title: string
  content: string
}>()

const emit = defineEmits<{
  (e: 'confirm', value: RadioOption['value']): void
  (e: 'cancel'): void
}>()

const radioOptions = reactive<RadioOption[]>([
  {
    label: 'Disable until next visit',
    value: 'next-visit',
  },
  {
    label: 'Disable globally',
    value: 'global',
  },
])

const selectedOption = ref(radioOptions[0].value)

const selectOption = (value: RadioOption['value']) => selectedOption.value = value

const handleCancel = () => emit('cancel')

const handleConfirm = () => {
  emit('confirm', selectedOption.value)
  // 重置选项
  selectedOption.value = radioOptions[0].value
}
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-backdrop-fade-enter-active,
.dialog-backdrop-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-backdrop-fade-enter-from,
.dialog-backdrop-fade-leave-to {
  opacity: 0;
}

.dialog-slide-enter-active,
.dialog-slide-leave-active {
  transition: all 0.3s ease;
}

.dialog-slide-enter-from,
.dialog-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style> 