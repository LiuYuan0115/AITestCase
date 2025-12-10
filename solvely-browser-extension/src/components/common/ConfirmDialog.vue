<template>
  <transition name="dialog-fade">
    <div
      v-if="show"
      class="fixed inset-0 flex items-center justify-center z-[2147483657]"
    >
      <transition name="dialog-backdrop-fade">
        <div
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          @click="handleOverlayClick"
        ></div>
      </transition>

      <transition name="dialog-slide">
        <div
          class="bg-s-interface-bg dark:bg-s-interface-bg-dark rounded-[20px] overflow-hidden transform transition-all w-[305px] p-[16px] duration-200"
        >
          <!-- 标题 -->
          <h3
            class="text-[16px] leading-[1.3] font-[700] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-2 h-[21px] transition-colors duration-200"
          >
            {{ title }}
          </h3>

          <!-- 内容 -->
          <div class="mb-6">
            <p class="text-[14px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark leading-[20px] transition-colors duration-200">
              {{ content }}
            </p>
          </div>

          <!-- 按钮组 -->
          <div class="flex justify-end gap-[10px]">
            <button
              v-for="(button, index) in buttons"
              :key="index"
              @click="handleButtonClick(button.action)"
              :class="[
                'px-[12px] py-[6px] rounded-[6px] text-[14px] font-medium transition-colors leading-[18px]',
                button.type === 'primary'
                  ? 'bg-s-text-brand dark:bg-s-text-brand-dark text-s-interface-bg dark:text-s-interface-bg-dark hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark'
                  : 'bg-s-interface-bg dark:bg-s-interface-bg-dark text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark border border-s-border-secondary dark:border-s-border-secondary-dark hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark',
              ]"
            >
              <div class="w-[50px]">{{ button.text }}</div>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script lang="ts" setup>

export interface DialogButton {
  text: string
  action: string
  type?: 'primary' | 'secondary'
}

interface Props {
  show: boolean
  title: string
  content: string
  buttons: DialogButton[]
  closeOnOverlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  closeOnOverlay: true,
})

const emit = defineEmits<{
  (e: 'action', action: string): void
  (e: 'close'): void
}>()

const handleButtonClick = (action: string) => {
  emit('action', action)
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    emit('close')
  }
}
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-backdrop-fade-enter-active,
.dialog-backdrop-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-backdrop-fade-enter-from,
.dialog-backdrop-fade-leave-to {
  opacity: 0;
}

.dialog-slide-enter-active,
.dialog-slide-leave-active {
  transition: all 0.2s ease;
}

.dialog-slide-enter-from,
.dialog-slide-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
