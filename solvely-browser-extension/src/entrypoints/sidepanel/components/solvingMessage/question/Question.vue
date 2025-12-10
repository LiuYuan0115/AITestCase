<template>
  <div
    class="self-stretch h-fit pt-[8px] bg-[#F3F6FF] rounded-[16px] border-[1px] border-white flex flex-col justify-start items-start gap-[8px] overflow-hidden"
  >
    <div
      class="self-stretch px-[16px] inline-flex justify-between items-center"
    >
      <span
        class="justify-center text-[#474A7E] text-[16px] font-bold font-['Inter'] leading-[20px]"
      >
        Question
      </span>
      <button @click="clickExpand" class="text-[#474A7E] text-sm">
        <SvgIcon
          name="arrow-up"
          size="28"
          fill="none"
          :style="{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)' }"
        />
      </button>
    </div>

    <div
      class="self-stretch relative bg-white rounded-[12px] overflow-hidden transition-all duration-300"
      :class="isExpanded ? 'h-[96px]' : 'h-0'"
      @transitionend="handleTransitionEnd"
    >
      <div
        class="question-img-wrapper w-full h-full overflow-y-auto overflow-x-hidden"
      >
        <img
          v-if="previewImageSrc"
          :src="previewImageSrc"
          alt="Preview image"
          class="w-full object-contain cursor-pointer"
          @click="openPreview"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center text-emph-3"
        >
          Currently No Image
        </div>
      </div>
    </div>

    <!-- 简易的全屏预览 -->
    <ImagePreviewer v-model="isPreviewOpen" :image-url="previewImageSrc" />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, inject, onMounted } from 'vue'
import ImagePreviewer from './ImagePreviewer.vue'
import type { PanelControls } from '../types'
import { STORAGE_KEY } from '@/config/storage'
import trackEvent from '@/utils/trackEvent'

// 接收外部传入的图片URL
const props = defineProps<{
  imageUrl?: string
  isLogin?: boolean
}>()

// 定义 emit
const emit = defineEmits<{
  (e: 'updateQuestionExpanded', isExpanded: boolean): void
}>()

// 获取面板控制器
const panelControls = inject<PanelControls>('panelControls') as PanelControls

// 是否展开
const isExpanded = ref(false)
// 是否打开预览
const isPreviewOpen = ref(false)
// 预览图片URL
const previewImageSrc = computed(() => props.imageUrl || '')

// 点击展开
const clickExpand = () => {
  isExpanded.value = !isExpanded.value
  // 保存状态到 localStorage
  localStorage.setItem(
    STORAGE_KEY.QUESTION_EXPANDED_KEY,
    String(isExpanded.value)
  )

  emit('updateQuestionExpanded', isExpanded.value)

  // 上报事件
  trackEvent.track('Plugin_Solve_panel_open', {
    isExpanded: isExpanded.value,
  })
}

// 使用 transition 组件的事件来精确地知道动画何时完成
// 必须等待动画完成再去触发函数检测边界
const handleTransitionEnd = () => {
  panelControls.updatePanelPosition()
}

// 打开预览
const openPreview = () => {
  if (previewImageSrc.value) {
    isPreviewOpen.value = true
  }
}

// 组件加载时读取存储的状态
onMounted(() => {
  const storedState = localStorage.getItem(STORAGE_KEY.QUESTION_EXPANDED_KEY)
  const status = props.isLogin
    ? storedState !== null && storedState === 'true'
    : true
  isExpanded.value = status
  emit('updateQuestionExpanded', isExpanded.value)
})
</script>

<style lang="less" scoped>
:deep(.question-img-wrapper) {
  &::-webkit-scrollbar-track {
    margin: 8px 0;
  }

  overscroll-behavior: contain;
}
</style>
