<template>
  <transition name="dialog-fade">
    <div
      v-if="modalService.state.show"
      class="fixed inset-0 flex items-center justify-center z-[2147483657]"
    >
      <transition name="dialog-backdrop-fade">
        <div
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        ></div>
      </transition>

      <transition name="dialog-slide">
        <div
          class="bg-s-interface-bg dark:bg-s-interface-bg-dark rounded-[20px] overflow-hidden transform transition-all w-[350px] p-[20px] duration-200"
        >
          <button
            class="absolute top-[20px] right-[20px] bg-s-panel-bg dark:bg-s-panel-bg-dark rounded-full p-[6px] flex items-center justify-center hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200"
            @click="handleClose"
          >
            <svgIcon name="close" size="10" />
          </button>
          <h3
            class="text-lg text-center font-bold text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark leading-normal mb-[18px] transition-colors duration-200"
          >
            {{ modalService.state.title }}
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
              <p
                class="text-[15px] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200"
              >
                {{ option.label }}
              </p>
            </div>
          </div>
          <div class="mt-[8px]">
            <p
              class="text-[13px] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark font-normal leading-tight transition-colors duration-200"
            >
              {{ modalService.state.content }}
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
import { modalService } from '@/services/modal/closeModalService'
import { reactive, ref, computed, watch, onMounted } from 'vue'



onMounted(async () => {
  try {
    // 初始化选中选项
    initializeSelectedOption()
  } catch (error) {
    console.error('Failed to initialize dark mode:', error)
  }
})

export interface RadioOption {
  label: string
  value: string
}

// 默认选项（向后兼容）
const defaultRadioOptions = reactive<RadioOption[]>([
  {
    label: 'Disable until next visit',
    value: 'next-visit',
  },
  {
    label: 'Disable globally',
    value: 'global',
  }
])

// 使用传入的选项或默认选项
const radioOptions = computed(() => {
  return modalService.state.customOptions || defaultRadioOptions
})

const selectedOption = ref('')

// 初始化选中的选项
const initializeSelectedOption = () => {
  if (radioOptions.value.length > 0) {
    selectedOption.value = radioOptions.value[0].value
  }
}

const selectOption = (value: string) => {
  selectedOption.value = value
}

// 监听选项变化，重新初始化选中选项
watch(radioOptions, () => {
  initializeSelectedOption()
}, { immediate: true })

const handleClose = () => {
  if (modalService.state.onClose) {
    modalService.state.onClose()
  }
  modalService.closeModal()
}

// 取消关闭, 或者点击右上角关闭
const handleCancel = () => {
  if (modalService.state.onCancel) {
    modalService.state.onCancel()
  }
  // 重置选项
  selectedOption.value = radioOptions.value[0].value
  modalService.closeModal()
}

// 确认关闭
const handleConfirm = () => {
  if (modalService.state.onConfirm) {
    modalService.state.onConfirm(selectedOption.value)
  }
  // 重置选项
  selectedOption.value = radioOptions.value[0].value
  modalService.closeModal()
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
