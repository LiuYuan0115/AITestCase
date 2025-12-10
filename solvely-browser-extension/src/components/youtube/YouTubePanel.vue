<template>
  <div v-if="panelShow" class="youtube-panel" :class="{ dark: isDark }">
    <div class="youtube-panel-title">
      <!-- <img src="@/assets/images/logo-title.webp" alt="Solvely" /> -->
      <div class="youtube-panel-title-logo">
        <SvgIcon name="logo" size="24" />
        <SvgIcon name="solvelyAi" size="78" />
      </div>
    </div>

    <!-- 摘要组件 - 包含loading和完成状态 -->
    <YouTubeSummary v-if="shouldShowSummaryComponent" />

    <div class="youtube-panel-content" v-else>
      <!-- ready to generate - 默认显示生成按钮 -->
      <div
        class="ytb-content-with-button"
        v-if="panelState === YouTubePanelStateEnum.READY_TO_GENERATE"
      >
        <div class="ytb-content-container">
          <div class="ytb-logo">
            <img src="@/assets/images/robot.webp" alt="Youtube" />
            <span>Generate video summary</span>
          </div>
          <span class="ytb-description">
            Get video summary and outline with just one click
          </span>
        </div>

        <button
          class="ytb-button ytb-button-generate"
          @click.stop="clickGenerateSummary"
        >
          Generate summary
        </button>
      </div>

      <!-- has subtitles TODO:后续需要移除-->
      <!-- <div
        class="ytb-content-with-button"
        v-if="panelState === YouTubePanelStateEnum.SUBTITLES_HAS"
      >
        <div class="ytb-content-container">
          <div class="ytb-logo">
            <img src="@/assets/images/robot.webp" alt="Youtube" />
            <span>Generate video summary</span>
          </div>
          <span class="ytb-description">
            Get video summary and outline with just one click
          </span>
        </div>

        <button
          class="ytb-button ytb-button-generate"
          @click.stop="clickGenerateSummary"
        >
          Generate summary
        </button>
      </div> -->

      <!-- network error -->
      <div
        class="ytb-content-with-button"
        v-if="panelState === YouTubePanelStateEnum.SUMMARY_ERROR"
      >
        <div class="ytb-content-container">
          <div class="ytb-logo">
            <img src="@/assets/images/robot.webp" alt="Youtube" />
            <span>Generate video summary</span>
          </div>
          <span class="ytb-description error">
            Network error, please try again later.
          </span>
        </div>

        <button
          class="ytb-button ytb-button-generate"
          @click.stop="clickGenerateSummary"
        >
          Generate summary
        </button>
      </div>

      <!-- network error -->
      <div
        class="ytb-content-with-button"
        v-if="panelState === YouTubePanelStateEnum.CONTENT_POLICY_ERROR"
      >
        <div class="ytb-content-container">
          <div class="ytb-logo">
            <img src="@/assets/images/robot.webp" alt="Youtube" />
            <span>Generate video summary</span>
          </div>
          <span class="ytb-description error">
            Sorry, this video can’t be summarized due to content policy
            restrictions. Please try another one.
          </span>
        </div>

        <button
          class="ytb-button ytb-button-generate"
          @click.stop="clickGenerateSummary"
        >
          Generate summary
        </button>
      </div>

      <!-- out limit TODO:目前不会出现，后续需要删除-->
      <div
        class="ytb-content-with-button out-limit"
        v-if="panelState === YouTubePanelStateEnum.OUT_LIMIT"
      >
        <div class="ytb-content-container">
          <div class="ytb-logo">
            <img src="@/assets/images/robot.webp" alt="Youtube" />
            <span>Generate video summary</span>
          </div>
          <span class="ytb-description text-[#111]">
            You've reached your free usage limit. Enjoy a 3-Day Free Trial with
            unlimited access to all features.
          </span>
        </div>

        <button
          class="ytb-button ytb-button-generate"
          @click.stop="goToFreeTrail"
        >
          Start 3-Day Free Trial
        </button>
      </div>

      <!-- no subtitles or too long subtitles -->
      <div
        class="ytb-content-no-button"
        v-if="
          panelState === YouTubePanelStateEnum.SUBTITLES_NO ||
          panelState === YouTubePanelStateEnum.SUBTITLES_TOO_LONG
        "
      >
        <div class="ytb-logo">
          <img src="@/assets/images/robot.webp" alt="Youtube" />
          <span>Generate video summary</span>
        </div>
        <span class="ytb-description">
          {{
            panelState === YouTubePanelStateEnum.SUBTITLES_NO
              ? 'Only videos with subtitles are supported for generating summary'
              : 'Solvely is currently unable to summarize videos that exceed 3 hours.'
          }}
        </span>
      </div>
    </div>

    <SvgIcon
      name="close-button"
      size="24"
      class="ytb-panel-close-button"
      @click="handleClosePanel"
    />
  </div>
</template>

<script lang="ts" setup>
import YouTubeSummary from './YouTubeSummary.vue'
import { useYouTubePanelProvider } from '~/composables/content/useYouTubePanelProvider'
import { modalService } from '@/services/modal/closeModalService'
import trackEvent from '~/utils/trackEvent'
import { ThrottledTrackEvent } from '~/utils/throttledTrackEvent'
import type { RadioOption as CloseModalRadioOption } from '@/components/common/CloseModal.vue'
import { useSetting } from '@/composables/content/useSetting'
import { YouTubePanelStateEnum } from '~/composables/content/useYouTubePanelProvider'
import { getPricingPath } from '@/utils'
import { getTrpc } from '@/lib/trpc/client'
import { onMounted, computed, watch } from 'vue'
import SvgIcon from '../common/SvgIcon.vue'
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark } = useDarkMode()

// 状态
const {
  isEnable: youtubePanelEnable,
  closeInThisPage,
  closeInGlobal,
} = useSetting('youtube-panel')
const { panelState, setState, generateSummary, currentVideoId } =
  useYouTubePanelProvider()

const panelShow = computed(() => {
  return (
    youtubePanelEnable.value &&
    panelState.value !== YouTubePanelStateEnum.INITIAL // 只有在INITIAL状态下才隐藏
  )
})

// 注释掉原来的面板显示埋点（不适用于当前实现）
// watch(
//   panelShow,
//   (newVal, oldVal) => {
//     if (newVal && !oldVal) {
//       // 面板从隐藏变为显示时打点
//       trackEvent.track('Plugin_Youtubepanel_Show', {
//         panelState: panelState.value,
//         videoId: currentVideoId.value,
//       })
//     }
//   },
//   { immediate: false }
// ) // 不需要立即执行，只监听变化

// 新的埋点：监听视频ID变化，每次视频切换时触发show埋点
watch(
  currentVideoId,
  (newVideoId, oldVideoId) => {
    if (newVideoId && newVideoId !== oldVideoId) {
      // 只有当面板真正显示时才触发埋点
      if (panelShow.value) {
        ThrottledTrackEvent.track('Plugin_Youtubepanel_Show', {
          panelState: panelState.value,
          videoId: newVideoId,
        })
      }
    }
  },
  { immediate: false }
) // 不需要立即执行，只监听变化

// 监听面板显示状态变化，处理用户启用面板和首次挂载的情况
watch(
  panelShow,
  (newVal, oldVal) => {
    if (newVal && !oldVal && currentVideoId.value) {
      // 面板从隐藏变为显示，且有视频ID时触发埋点
      // 这种情况包括：
      // 1. 用户重新启用面板
      // 2. 首次挂载面板
      ThrottledTrackEvent.track('Plugin_Youtubepanel_Show', {
        panelState: panelState.value,
        videoId: currentVideoId.value,
      })
    }
  },
  { immediate: false }
) // 不需要立即执行，只监听变化

// 计算是否应该显示摘要组件（包括loading和完成状态）
const shouldShowSummaryComponent = computed(() => {
  return (
    panelState.value === YouTubePanelStateEnum.SUMMARY_LOADING ||
    panelState.value ===
      YouTubePanelStateEnum.SUMMARY_LOADING_OUTLINE_COMPLETE ||
    panelState.value === YouTubePanelStateEnum.SUMMARY_COMPLETE
  )
})

// 操作
// 弹窗相关
const handleClosePanel = () => {
  trackEvent.track('Plugin_Youtubepanel_Close', {
    videoId: currentVideoId.value,
  })
  modalService.showModal({
    title: 'Disable',
    content: 'You can re-enable in settings',
    onConfirm: handleModalConfirm,
    onCancel: handleModalCancel,
  })
}
// 点击弹窗取消按钮
const handleModalCancel = () => {
  trackEvent.track('Plugin_Disable_cancel', {
    from: 'youtube-panel',
  })
}
// 点击弹窗确认按钮
const handleModalConfirm = (confirmValue: CloseModalRadioOption['value']) => {
  trackEvent.track('Plugin_Disable_confirm', {
    from: 'youtube-panel',
    confirmValue,
  })
  if (confirmValue === 'next-visit') {
    closeInThisPage()
  } else if (confirmValue === 'global') {
    closeInGlobal()
  }
}

// 点击生成摘要
const clickGenerateSummary = async () => {
  trackEvent.track('Plugin_Youtubepanel_Generate', {
    videoId: currentVideoId.value,
  })
  
  try {
    const result = await generateSummary()
    // 如果生成失败，确保UI状态正确
    if (result === false) {
      console.log('[YouTubePanel] 生成摘要失败，检查当前状态')
      // 状态已经在generateSummary中更新，这里不需要额外处理
    }
  } catch (error) {
    console.error('[YouTubePanel] 生成摘要时发生错误:', error)
  }
}

// 监听面板状态变化并打点
watch(panelState, (newVal, oldVal) => {
  //  Youtube付费展示
  if (newVal === YouTubePanelStateEnum.OUT_LIMIT) {
    trackEvent.track('Plugin_Panel_Startfree_Show', {
      videoId: currentVideoId.value,
    })
  }

  // Youtube panel无字幕状态展示
  if (newVal === YouTubePanelStateEnum.SUBTITLES_NO) {
    ThrottledTrackEvent.track('Plugin_Youtubepanel_Nosubtitle', {
      videoId: currentVideoId.value,
    })
  }

  // 超过3小时
  if (newVal === YouTubePanelStateEnum.SUBTITLES_TOO_LONG) {
    trackEvent.track('Plugin_Youtubepanel_Hour_Exceed', {
      videoId: currentVideoId.value,
    })
  }
})

// 跳转至免费试用页面
const goToFreeTrail = async () => {
  setState(YouTubePanelStateEnum.SUBTITLES_HAS)
  const queryString = '?portal=freeTrail_click_youtube'
  const pricingPath = await getPricingPath()
  trackEvent.track('Plugin_Panel_Startfree', {
    videoId: currentVideoId.value,
  })
  getTrpc().goToSolvely.query(`${pricingPath}${queryString}`)
}

onMounted(() => {
  trackEvent.track('Plugin_Youtubepanel_Mounted', {
    url: window.location.href,
  })
})
</script>

<style lang="less" scoped>
/* 整个 YouTube 面板的样式 */
.youtube-panel {
  position: relative;
  width: 404px;
  background-color: var(--panel-bg, #fff);
  border-radius: 16px;
  padding-top: 20px;
  border: 1px solid var(--panel-border, #eee);
  margin-bottom: 16px;
  transition: background-color 0.2s, border-color 0.2s;

  &.summary-complete {
    padding: 8px;
  }

  & img {
    height: 24px;
  }

  // 当 .youtube-panel 被 hover 时，设置 .close-button 的样式
  &:hover {
    .ytb-panel-close-button {
      position: absolute;
      top: -12px;
      right: -12px;
      cursor: pointer;
      display: block;
    }
  }

  // 默认情况下隐藏关闭按钮
  .ytb-panel-close-button {
    display: none;
  }

  // 暗黑模式
  &.dark {
    --panel-bg: #161b26;
    --panel-border: #2f3543;
    --logo-text-color: #ffffff;
    --button-bg: #1d8eff;
    --button-text-color: #161b26;
    --button-gradient: linear-gradient(94deg, #1d8eff -13.1%, #a620ff 144.89%);
    --description-color: #a4a6ab;
    --out-limit-description-color: #ffffff;
    --error-color: #ff4d6a;
  }
}

/* 面板标题样式 */
.youtube-panel-title {
  padding: 0 20px;
  color: var(--logo-text-color, #111);
}

.youtube-panel-title-logo {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  transition: color 0.2s;
}

/* 面板内容区域样式 */
.youtube-panel-content {
  width: 100%;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: center;
}

/* 机器人 logo 和标题文本的容器样式 */
.ytb-logo {
  display: flex;
  flex-direction: column;
  align-items: center;

  & img {
    width: 36px;
    height: 36px;
  }

  & span {
    margin-top: 6px;
    color: var(--logo-text-color, #111);
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: 130%;
    transition: color 0.2s;
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
    background: var(--button-bg, #007aff);
    cursor: pointer;
    color: #fff;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 140%;
    transition: background-color 0.2s, color 0.2s;
  }

  &.out-limit .ytb-button {
    font-size: 12px;
    font-style: italic;
    font-weight: 800;
    line-height: 150%;
    background: var(
      --button-gradient,
      linear-gradient(94deg, #007aff -13.1%, #a620ff 144.89%)
    );
  }

  & .ytb-button:disabled {
    cursor: default;
  }

  & .ytb-button-generate {
    width: 100%;
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

/* ytb logo 下面内容的容器样式 */
.ytb-content-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: center;
  gap: 6px;
}

/* ytb panel content 下面没有 button 的样式 */
.ytb-content-no-button {
  padding-top: 20px;
  padding-bottom: 32px;
  gap: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 描述文本样式 */
.ytb-description {
  color: var(--description-color, #999);
  text-align: center;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 140%;
  transition: color 0.2s;
}

.out-limit .ytb-description {
  color: var(--out-limit-description-color, #111);
}

.ytb-description.error {
  color: var(--error-color, #ff0000);
}
</style>
