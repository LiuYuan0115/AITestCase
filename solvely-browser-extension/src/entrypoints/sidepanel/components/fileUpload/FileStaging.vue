<template>
  <!-- 如果是pdf就是80,否则108 -->
  <div
    :class="[
      'w-full',
      stagingType === 'image' || stagingFileInfo?.imageSlices ? 'h-[108px]' : 'h-[80px]',
      'bg-input-bg dark:bg-input-bg-dark transition-colors duration-200 mb-5 rounded-[12px] p-3 flex flex-col justify-between relative group',
    ]"
    v-if="stagingIsShow"
  >
    <!-- 上部 -->
    <div
      :class="[
        'flex items-center justify-start gap-[6px]',
        stagingType === 'pdf' && stagingStatus === 'loaded'
          ? 'cursor-pointer group/pdf-btn'
          : '',
      ]"
      @click="handlePdfClick"
    >
      <!-- 圆形进度条或文件图标 -->
      <div class="relative flex-shrink-0">
        <!-- 上传中的圆形进度条 -->
        <template v-if="stagingStatus === 'uploading'">
          <div v-if="stagingType === 'image'" class="relative">
            <LoadingCycle
              class="absolute top-0 left-0 z-10"
              :progress="stagingProgress"
              :w="52"
              :h="52"
              :r="16"
              :strokeWidth="4"
            />
            <img
              v-if="stagingFileInfo?.imageBase64"
              :src="stagingFileInfo?.imageBase64"
              alt="thumbnail"
              class="object-cover rounded-md absolute top-0 left-0 opacity-50"
              :style="{ width: '52px', height: '52px' }"
            />
          </div>

          <LoadingCycle
            v-else
            :progress="stagingProgress"
            :w="24"
            :h="24"
            :r="9"
            :strokeWidth="3"
          />
        </template>
        <!-- 文件类型图标 -->
        <template v-else>
          <!-- 网页模式：显示 favicon -->
          <img
            v-if="stagingType === 'web' && !stagingFileInfo?.imageSlices"
            :src="stagingFileInfo?.icon"
            alt="favicon"
            class="w-6 h-6 rounded-sm flex-shrink-0"
            @error="handleFaviconError"
          />
          <!-- 文件模式：原有图标逻辑 -->
          <SvgIcon
            v-if="stagingType === 'pdf'"
            :name="'input/pdf'"
            :size="24"
            class="flex-shrink-0"
          />
          <!-- 图片模式 -->
          <template
            v-if="stagingType === 'image' || stagingFileInfo?.imageSlices"
          >
            <img
              v-if="
                stagingFileInfo?.imageBase64 || stagingFileInfo?.imageSlices
              "
              :src="
                stagingFileInfo?.imageBase64 ||
                stagingFileInfo?.imageSlices.longImage
              "
              alt="thumbnail"
              class="object-cover rounded-md"
              :style="{ width: '52px', height: '52px' }"
            />
            <SvgIcon
              v-else
              :name="'input/image'"
              :size="52"
              class="flex-shrink-0"
            />
          </template>
        </template>
      </div>
      <div
        v-if="stagingType !== 'image' && !stagingFileInfo?.imageSlices"
        class="w-[calc(100%-30px)] flex flex-col justify-between gap-[2px]"
      >
        <div
          class="text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200 text-xs leading-[1] truncate group-hover/pdf-btn:text-s-text-brand dark:group-hover/pdf-btn:text-s-text-brand-dark"
        >
          {{
            stagingType === 'pdf' //   ? decodeURIComponent(stagingFileInfo?.fileName!)
              ? stagingFileInfo?.fileName!
              : stagingFileInfo?.webName || 'Document'
          }}
        </div>
        <div
          class="text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark transition-colors duration-200 text-[10px] leading-[1] truncate"
        >
          {{
            stagingType === 'pdf' ? 'PDF' : stagingFileInfo?.webUrl || 'Unknown'
          }}
        </div>
      </div>
    </div>
    <!-- 底部操作按钮 -->
    <div class="flex justify-start items-center gap-2">
      <button
        class="w-[78px] h-[24px] bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border-secondary dark:border-s-border-secondary-dark transition-colors duration-200 text-primary text-sm leading-[1] rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hover-on-white dark:hover:bg-hover-on-white-dark"
        @click="onSolve"
        :disabled="stagingStatus === 'uploading'"
      >
        <SvgIcon name="userMessage/solve" size="20" class="mr-0.5" />
        Solve
      </button>
      <button
        class="w-[108px] h-[24px] bg-s-interface-bg dark:bg-s-interface-bg-dark text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark text-sm leading-[1] rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hover-on-white dark:hover:bg-hover-on-white-dark transition-colors duration-200"
        @click="onSummarize"
        :disabled="stagingStatus === 'uploading'"
      >
        <SvgIcon name="userMessage/summarize" size="20" class="mr-0.5" />
        Summarize
      </button>
      <button
        class="w-[78px] h-[24px] bg-s-interface-bg dark:bg-s-interface-bg-dark text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark text-sm leading-[1] rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hover-on-white dark:hover:bg-hover-on-white-dark transition-colors duration-200"
        @click="onQuiz"
        :disabled="stagingStatus === 'uploading'"
      >
        <SvgIcon name="userMessage/quiz" size="20" class="mr-0.5" />
        Quiz
      </button>
    </div>
    <!-- 关闭按钮 -->
    <button
      class="w-5 h-5 absolute top-[-10px] right-[-10px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      @click="handleCancel"
    >
      <SvgIcon
        :name="'textSelection/select-close'"
        size="20"
        class="text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark transition-colors duration-200"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import LoadingCycle from './LoadingCycle.vue'
import { inject, onMounted, onUnmounted } from 'vue'
import useFileStagingUIStatus from '@/entrypoints/sidepanel/composables/useFileStagingUIStatus'
import emitter from '@/utils/eventBus'
import globalUpload from '@/entrypoints/sidepanel/composables/useGlobalUpload'
import { ABTestState } from '@/composables/useABTest'

// 注入 auth 实例
const auth = inject<any>('auth')!
const abTest = inject<ABTestState>('abTest')!
// import useFileStagingUIStatus from '@/entrypoints/sidepanel/composables/useFileStagingUIStatus'
// const globalUpload = inject('globalUpload') as GlobalUploadType
// const {
//   currentFileStackKey,
//   fileStack,
//   clearFile2Staging,
// } = globalUpload
const {
  handleFaviconError,
  stagingIsShow,
  stagingStatus,
  stagingType,
  stagingFileInfo,
  stagingProgress,
  clearStaging,
  currentFileStackKey,
} = useFileStagingUIStatus()

// 底部操作按钮 emit 事件
const onSolve = () => {
  emit('onSolve')
}

const onSummarize = () => {
  emit('onSummarize')
}

const onQuiz = () => {
  emit('onQuiz')
}

const handleCancel = () => {
  clearStaging()
  // 为了让内容脚本接收到这个取消事件，需要触发一个事件，这边相当于广播
  trackEvent.track('Plugin_Sidebar_Uploadchat_Cancel', {
    fileType: stagingType.value,
  })
  // webpage的文件暂存区关闭
  if (stagingType.value === 'web')
    trackEvent.track('Plugin_Sidebar_Webpagechat_Close')
  emitter.emit('upload-cancel')
}

const handlePdfClick = () => {
  if (
    stagingType.value === 'pdf' &&
    stagingStatus.value === 'loaded' &&
    stagingFileInfo.value?.file
  ) {
    trackEvent.track('Plugin_Sidebar_PDFpage_Show_Click')
    globalUpload.openPDFDView(
      stagingFileInfo.value.cdnUrl,
      stagingFileInfo.value.file,
      currentFileStackKey.value
    )
  }
}

// 暴露onSolve点击事件，onSummarize点击事件，onQuiz点击事件
const emit = defineEmits<{
  (e: 'onSolve'): void
  (e: 'onSummarize'): void
  (e: 'onQuiz'): void
}>()

// 监听全局关闭事件
const handleGlobalClose = () => {
  if (stagingIsShow.value) {
    clearStaging()
    console.log('FileStaging: 收到全局关闭事件，已清除暂存')
  }
}

onMounted(() => {
  // 监听全局关闭事件
  emitter.on('close-file-staging', handleGlobalClose)
})

onUnmounted(() => {
  // 移除事件监听
  emitter.off('close-file-staging', handleGlobalClose)
})
</script>
