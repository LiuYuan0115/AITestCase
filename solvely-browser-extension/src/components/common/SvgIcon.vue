<template>
  <component
    :is="iconComponent"
    :class="customClass"
    :style="{
      width: validSize,
      height: validSize,
      color: fill,
    }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 },
  fill: { type: String, default: 'currentColor' },
  customClass: { type: String, default: '' },
})

// 动态加载 SVG 组件
const iconComponent = computed(() => {
  // 如果 name 为空，返回 null 避免动态导入错误
  if (!props.name || props.name.trim() === '') {
    return null
  }

  // 解析目录和文件名
  if (props.name.includes('/')) {
    const [dir, iconName] = props.name.split('/', 2)
    // 检查分割后的名称是否有效
    if (!dir || !iconName || iconName.trim() === '') {
      return null
    }

    return defineAsyncComponent(
      () => import(`~/assets/icons/${dir}/${iconName}.svg`)
    )
  }

  // 默认根目录的图标
  return defineAsyncComponent(() => import(`~/assets/icons/${props.name}.svg`))
})

// 处理尺寸单位
const validSize = computed(() =>
  typeof props.size === 'number' ? `${props.size}px` : props.size
)
</script>

<style>
</style>
