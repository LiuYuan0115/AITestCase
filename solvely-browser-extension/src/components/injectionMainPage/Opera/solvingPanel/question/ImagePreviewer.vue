<template>
  <div v-if="modelValue" class="preview-container" @click="close">
    <div class="preview-content" @click.stop>
      <img
        ref="previewImageRef"
        :src="imageUrl"
        class="preview-image"
        :style="{
          transform: `scale(${scale})`,
          transition: 'transform 0.2s ease',
        }"
        @wheel="handleWheel"
      />
      <button class="preview-close" @click="close">
        <SvgIcon name="preview-close" size="36" />
      </button>
      <div class="zoom-controls">
        <button class="zoom-btn" @click="zoom(0.1)">+</button>
        <button class="zoom-btn" @click="zoom(-0.1)">-</button>
        <button class="zoom-btn" @click="resetZoom">
          <SvgIcon name="retry" size="36" fill="white" />
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  imageUrl: string
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const previewImageRef = ref<HTMLImageElement | null>(null)
const scale = ref(1)
const scrollPosition = ref(0) // 存储滚动位置

// 统一关闭方法
const close = () => {
  emit('update:modelValue', false)
}

// 自动打开逻辑（可选）
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      // 保存当前滚动位置
      scrollPosition.value =
        window.scrollY || document.documentElement.scrollTop
      // 初始化缩放比例
      scale.value = 1
      // 添加滚动锁定
      document.body.style.overflow = 'hidden'
    } else {
      // 恢复页面滚动
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.body.style.paddingRight = ''

      // 恢复到原来的滚动位置
      setTimeout(() => {
        window.scrollTo({
          top: scrollPosition.value,
          behavior: 'auto',
        })
      }, 0)
    }
  }
)

// 缩放功能
const zoom = (delta: number) => {
  // 根据缩放等级调整灵敏度：极端缩放时降低变化幅度
  const MIN_SLOW_SCALE = 0.6
  const MAX_SLOW_SCALE = 1.4
  const SENSITIVITY_FACTORS = {
    LOW: 0.5,
    HIGH: 2,
  }

  const deltaFactor =
    scale.value <= MIN_SLOW_SCALE
      ? SENSITIVITY_FACTORS.LOW
      : scale.value >= MAX_SLOW_SCALE
      ? SENSITIVITY_FACTORS.HIGH
      : 1
  delta *= deltaFactor

  const newScale = scale.value + delta
  scale.value = Math.max(0.1, Math.min(newScale, 5))
}

// 重置缩放
const resetZoom = () => {
  scale.value = 1
}

// 处理鼠标滚轮缩放
const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  zoom(delta)
}

// 处理ESC键关闭预览
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)

  document.body.style.overflow = '' // 确保离开组件时恢复滚动
})
</script>

<style lang="less" scoped>
.preview-container {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.36);
  display: flex;
  justify-content: center;
  align-items: center;

  .preview-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;

    .preview-image {
      transform-origin: center center;
      cursor: zoom-in;
      max-width: 100%;
      max-height: 90vh;
      z-index: 1;
    }
  }

  .preview-close {
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    padding: 0;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;

    &:hover {
      background: rgba(0, 0, 0, 0.8);
    }
  }

  .zoom-controls {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 16px;
    z-index: 10000;
    padding: 8px 16px;

    .zoom-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      font-size: 18px;
      font-weight: normal;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: rgba(0, 0, 0, 0.8);
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }
    }
  }
}
</style>
