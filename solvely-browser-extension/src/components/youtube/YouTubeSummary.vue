<template>
  <div
    class="ytb-result-container"
    :class="{
      'complete-result': panelState === YouTubePanelStateEnum.SUMMARY_COMPLETE,
    }"
  >
    <!-- Loading 状态 -->
    <div
      v-if="panelState === YouTubePanelStateEnum.SUMMARY_LOADING"
      class="ytb-content-with-button"
    >
      <div class="ytb-loading-skeleton">
        <div v-for="i in 4" :key="i" class="ytb-loading-skeleton-bar"></div>
      </div>
      <button
        class="ytb-button ytb-button-generating"
        @click="handleStopSummary"
      >
        <SvgIcon name="stop" size="16" /> Generating
      </button>
    </div>

    <!-- 摘要内容 -->
    <div v-else class="ytb-content-container">
      <!-- Summary -->
      <div class="ytb-summary-container">
        <div
          class="ytb-summary-header"
          v-if="panelState === YouTubePanelStateEnum.SUMMARY_COMPLETE"
        >
          <span>Summary</span>
        </div>
        <div class="ytb-summary-content">
          <span>
            {{ summaryData?.outline }}
          </span>
        </div>
      </div>

      <div
        v-if="
          panelState === YouTubePanelStateEnum.SUMMARY_LOADING_OUTLINE_COMPLETE
        "
        class="ytb-content-with-button outline-complete"
      >
        <div class="ytb-loading-skeleton">
          <div v-for="i in 4" :key="i" class="ytb-loading-skeleton-bar"></div>
        </div>
        <button
          class="ytb-button ytb-button-generating"
          @click="handleStopSummary"
        >
          <SvgIcon name="stop" size="16" /> Generating
        </button>
      </div>

      <!-- Highlight -->
      <div
        class="ytb-highlight-container"
        v-if="panelState === YouTubePanelStateEnum.SUMMARY_COMPLETE"
      >
        <TimelineContainer :data="summaryData?.details || []" />
      </div>
    </div>

    <!-- Footer -->
    <div
      class="ytb-result-footer"
      v-if="panelState === YouTubePanelStateEnum.SUMMARY_COMPLETE"
    >
      <!-- retry -->
      <div class="ytb-tooltip-container">
        <Button
          icon="retry"
          :iconSize="16"
          type="icon-only"
          class="w-[32px] rounded-[16px] border border-[#E6E8EA] hover:border-[#F0F2F4] hover:bg-[#fff] dark:border-[#474C58] dark:hover:border-[#2F3543] dark:hover:bg-[#1B212D]"
          @click="handleRetry"
        />
        <div class="ytb-tooltip">
          <div class="ytb-tooltip-arrow"></div>
          <div class="ytb-tooltip-content">Retry</div>
        </div>
      </div>

      <!-- 生成 quiz -->
      <div class="ytb-tooltip-container"
      v-if="isSidePanelSupported()"
      >
        <Button
          icon="generate-quiz"
          :iconSize="16"
          type="icon-only"
          class="w-[32px] rounded-[16px] border border-[#E6E8EA] hover:border-[#F0F2F4] hover:bg-[#fff] dark:border-[#474C58] dark:hover:border-[#2F3543] dark:hover:bg-[#1B212D]"
          @click="handleGenerateQuiz"
        />
        <div class="ytb-tooltip">
          <div class="ytb-tooltip-arrow"></div>
          <div class="ytb-tooltip-content">Generate Quiz</div>
        </div>
      </div>

      <!-- copy 按钮-->
      <div class="ytb-tooltip-container">
        <Button
          icon="copy2"
          :iconSize="16"
          type="icon-only"
          class="w-[32px] rounded-[16px] border border-[#E6E8EA] hover:border-[#F0F2F4] hover:bg-[#fff] dark:border-[#474C58] dark:hover:border-[#2F3543] dark:hover:bg-[#1B212D]"
          @click="handleCopy"
        />
        <div class="ytb-tooltip">
          <div class="ytb-tooltip-arrow"></div>
          <div class="ytb-tooltip-content">Copy</div>
        </div>
      </div>
    </div>

    <!-- Toast 提示 -->
    <Toast
      ref="toastRef"
      :duration="2000"
      style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "
    />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import TimelineContainer from './TimelineContainer.vue'
import Button from '@/components/common/Button.vue'
import Toast from '@/entrypoints/sidepanel/components/Toast.vue'
import { useYouTubePanel } from '~/composables/content/useYouTubePanelProvider'
import { YouTubePanelStateEnum } from '~/composables/content/useYouTubePanelProvider'
import trackEvent from '~/utils/trackEvent'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
const {
  summaryData,
  generateSummary,
  panelState,
  clearSummary,
  setState,
  currentVideoId,
} = useYouTubePanel()

const toastRef = ref<InstanceType<typeof Toast> | null>(null)

// 重试生成
const handleRetry = () => {
  trackEvent.track('Plugin_Youtubepanel_Regenerate', {
    videoId: currentVideoId.value,
  })
  generateSummary()
}

// 停止生成
const handleStopSummary = async () => {
  trackEvent.track('Plugin_Youtubepanel_Stop', {
    videoId: currentVideoId.value,
  })
  clearSummary()
}

// 生成 quiz
const handleGenerateQuiz = () => {
  browser.runtime.sendMessage({
    type: SidepanelEventType.GENERATE_QUIZ_FROM_YOUTUBE,
    data: {
      url: window.location.href,
      title: document.title,
    },
  })

  trackEvent.track('Plugin_Youtubepanel_Quiz', {
    videoId: currentVideoId.value,
  })
}

// 复制 Youtube 总结内容
const handleCopy = async () => {
  trackEvent.track('Plugin_Youtubepanel_Copy', {
    videoId: currentVideoId.value,
  })

  /**
   * 辅助函数：将秒数转换为 "MM:SS" 格式
   * @param {number} seconds - 需要转换的秒数
   * @returns {string} 格式化后的时间字符串
   */
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60) // 计算分钟数
    const remainingSeconds = seconds % 60 // 计算剩余秒数
    // 使用 padStart 确保秒数始终是两位，例如 5 -> "05"
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const { outline, details } = summaryData
  const outlineText = `Summary: \n${outline}`

  // 遍历 details 数组，将每个详情项转换为 "MM:SS : 文本" 格式
  const detailsText = details
    .map((detail) => {
      // 格式化时间戳
      const formattedTime = formatTime(detail.start_time)
      return `${formattedTime}  :  ${detail.text}`
    })
    .join('\n') // 使用换行符连接所有详情项

  const copyText = `${outlineText} \nHighlights: \n${detailsText}`

  try {
    await navigator.clipboard.writeText(copyText)
    toastRef.value?.show('copied')
    console.log('内容已成功复制到剪贴板！')
  } catch (err) {
    console.error('复制到剪贴板失败:', err)
  }
}

onMounted(() => {
  trackEvent.track('Plugin_Youtubepanel_Summary_Mounted', {
    url: window.location.href,
  })
})
</script>

<style lang="less" scoped>
.ytb-result-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;

  &.complete-result {
    padding-bottom: 48px;
  }
}

.ytb-content-container {
  margin-top: 15px;
  max-height: 476px;
  overflow-y: auto;
}

.ytb-summary-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;

  & .ytb-summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 20px;
    width: 100%;
    padding: 0 20px;

    & span {
      font-size: 14px;
      font-style: normal;
      font-weight: 600;
      line-height: 130%; /* 18.2px */
      color: #111111;
      
      .dark & {
        color: #FFFFFF;
      }
    }
  }

  & .ytb-summary-content {
    width: 100%;
    padding: 0 16px 0 20px;
    scrollbar-width: thin;
    scrollbar-color: #E6E8EA #fff;

    .dark & {
      scrollbar-color: #474C58 #1B212D;
    }

    & span {
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 130%; /* 18.2px */
      color: #111111;
      
      .dark & {
        color: #FFFFFF;
      }
    }
  }
}

.ytb-highlight-container {
  margin-top: 12px;
  width: 100%;
}

.ytb-result-footer {
  position: absolute;
  bottom: 0;
  padding: 8px calc(12px + 8px);
  width: 100%;
  display: flex;
  justify-content: end;
  align-items: center;
  color: #595C60;
  gap: 8px;
  
  .dark & {
    color: #D1D3D5;
  }
}

/* ytb panel content 下面有button 的样式 */
.ytb-content-with-button {
  width: 100%;
  padding-top: 20px;
  padding-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;

  & .ytb-button {
    margin-top: 20px;
    height: 32px;
    border-radius: 6px;
    border: 0;
    background: var(--Foundation-colors-Primary, #007aff);
    cursor: pointer;
    color: #fff;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 140%; /* 19.6px */
  }

  & .ytb-button:disabled {
    cursor: default;
  }

  & .ytb-button-generating {
    width: 120px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
}

/* 加载骨架屏的样式 */
.ytb-loading-skeleton {
  padding-left: 20px;
  padding-right: 20px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: start;
  gap: 10px;

  & .ytb-loading-skeleton-bar {
    width: 100%;
    height: 16px;
    border-radius: 4px;
    // 使用线性渐变作为背景，创建更自然的光泽效果
    background: linear-gradient(
      90deg,
      var(--Component-Background-Disabled-BG, #ddd) 25%,
      var(--Component-Background-Disabled-BG, #E6E8EA) 50%,
      var(--Component-Background-Disabled-BG, #ddd) 75%
    );
    background-size: 200% 100%; /* 设置背景大小以便于动画 */
    background-position: 200% 0; /* 设置初始位置在右侧外部 */
    animation: skeletonShine 2s linear infinite; /* 使用 linear 保持匀速 */

    .dark & {
      background: linear-gradient(
        90deg,
        #2f3543 25%,
        #585d68 50%,
        #2f3543 75%
      );
    background-size: 200% 100%; /* 设置背景大小以便于动画 */
    background-position: 200% 0; /* 设置初始位置在右侧外部 */
    animation: skeletonShine 2s linear infinite; /* 使用 linear 保持匀速 */
    }

    &:nth-last-child(1) {
      width: 45%;
    }
  }
}

/* 加载骨架屏的闪烁动画 */
@keyframes skeletonShine {
  0% {
    background-position: 200% 0; /* 从右侧外部开始 */
  }
  100% {
    background-position: -200% 0; /* 移动到左侧外部 */
  }
}

/* Tooltip 样式 */
.ytb-tooltip-container {
  position: relative;
  display: inline-block;
}

.ytb-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  z-index: 1000;
}

.ytb-tooltip-container:hover .ytb-tooltip {
  opacity: 1;
  visibility: visible;
}

.ytb-tooltip-content {
  background-color: #333;
  color: #fff;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  
  .dark & {
    background-color: #1B212D;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}

.ytb-tooltip-arrow {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid #333;
  
  .dark & {
    border-top: 4px solid #1B212D;
  }
}
</style>
