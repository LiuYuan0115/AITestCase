<template>
  <!-- 背景模糊层 - 独立于Transition组件，立即显示 -->
  <div
    v-show="isDragActive"
    class="fixed inset-0 top-12 p-2 z-50 bg-[rgba(0,122,255,0.03)] backdrop-blur-md rounded-2xl"
  ></div>

  <!-- 内容层 - 使用Transition组件实现平滑过渡 -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition-all duration-100 ease-in"
    leave-from-class="opacity-100 scale-95"
    leave-to-class="opacity-0 scale-100"
  >
    <div
      v-show="isDragActive"
      class="fixed inset-0 top-12 p-2 z-50 flex items-center justify-center"
      @drop="handleDrop"
      @dragover.prevent
    >
      <!-- 内容层 -->
      <div
        class="rounded-2xl p-8 w-full h-full border-2 border-dashed border-primary flex items-center justify-center"
      >
        <div class="text-center flex flex-col items-center gap-4">
          <!-- 拖拽图标 -->
          <div class="flex items-center justify-center gap-4">
            <SvgIcon name="input/pdf-line" size="56" class="!text-primary" />
            <SvgIcon name="input/image-line" size="56" class="!text-primary" />
          </div>
          <!-- 拖拽文本 -->
          <div class="text-lg leading-[1.4] font-[700] text-primary">
            Drop here to send to solvely
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import trackEvent from '~/utils/trackEvent'
import useFileStagingUIStatus from '@/entrypoints/sidepanel/composables/useFileStagingUIStatus'
const { addFileOrUrl } = useFileStagingUIStatus()
const auth = inject('auth') as ReturnType<any>

// 拖拽状态管理
const isDragActive = ref(false)
let dragCounter = 0

// 全局拖拽处理函数
const handleGlobalDragEnter = (event: DragEvent) => {
  event.preventDefault()

  // 检查是否拖拽的是文件
  if (event.dataTransfer?.types.includes('Files')) {
    dragCounter++
    if (dragCounter === 1) {
      isDragActive.value = true
    }
  }
}

const handleGlobalDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleGlobalDragLeave = (event: DragEvent) => {
  event.preventDefault()

  // 检查是否真的离开了窗口
  if (event.relatedTarget === null) {
    dragCounter = 0
    isDragActive.value = false
  } else {
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      isDragActive.value = false
    }
  }
}

const handleGlobalDrop = (event: DragEvent) => {
  event.preventDefault()
  // 重置状态
  dragCounter = 0
  isDragActive.value = false
}

// 处理文件拖拽
const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // 重置拖拽状态
  dragCounter = 0
  isDragActive.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]

    // 检查登录状态
    if (!auth.isAuthenticated.value) {
      // 弹出登录框，使用回调方式
      auth.showLoginModal(
        () => {
          // 登录成功回调，执行上传逻辑
          addFileOrUrl(file, false, undefined, undefined, 'Upload_Drag')
          trackEvent.track('Plugin_Sidebar_FileUpload_Drag')
        },
        () => {
          // 登录取消回调，什么都不做
        }
      )
      return
    }

    addFileOrUrl(file, false, undefined, undefined, 'Upload_Drag')
    trackEvent.track('Plugin_Sidebar_FileUpload_Drag')
  }
}

// 组件挂载时添加全局拖拽监听器
onMounted(() => {
  document.addEventListener('dragenter', handleGlobalDragEnter)
  document.addEventListener('dragover', handleGlobalDragOver)
  document.addEventListener('dragleave', handleGlobalDragLeave)
  document.addEventListener('drop', handleGlobalDrop)
})

// 组件卸载时移除全局拖拽监听器
onUnmounted(() => {
  document.removeEventListener('dragenter', handleGlobalDragEnter)
  document.removeEventListener('dragover', handleGlobalDragOver)
  document.removeEventListener('dragleave', handleGlobalDragLeave)
  document.removeEventListener('drop', handleGlobalDrop)
})
</script>

<style scoped></style>
