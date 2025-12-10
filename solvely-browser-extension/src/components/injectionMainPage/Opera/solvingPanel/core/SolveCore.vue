<template>
  <div>
    <SolvingPanel
      ref="solvingPanelRef"
      :is-loading="isLoading"
      :is-out-limit="isOutLimit"
      :is-answering="isAnswering"
      :is-network-error="isNetworkError"
      :current-answer="currentAnswerData"
      @retry="userActions.retry"
      @refresh="userActions.refresh"
      @close="userActions.close"
      @toCut="emit('toCut')"
    />
    <Reactive :message="toast" :type="toastType" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SolvingPanel from '../SolvingPanel.vue'
import Reactive from '@/components/screenshot/Reactive.vue'
import { uploadFileToS3 } from '@/utils/fileUpload'
import { getTrpc } from '@/lib/trpc/client'
import { generateQuestionId } from '@/utils/common'
import { useSolve } from '../useSolve'
import { useToast } from '../useToast'
import trackEvent from '~/utils/trackEvent'
import emitter from '@/utils/eventBus'

const emit = defineEmits(['toCut'])

// ================= 状态管理 =================
const solvingPanelRef = ref<InstanceType<typeof SolvingPanel> | null>(null)
const imgDataRef = ref()
const totalStartTime = ref()

// 解题 loading 状态, 现在的 loading 状态是包含图片上传的
const isLoading = ref(false)
const isOutLimit = ref(false)
const isNetworkError = ref(false)

// toast 状态
const { toast, toastType, sendToast } = useToast()

// ================= 解题核心逻辑 =================
const { currentAnswer, isAnswering, startAnswer, retryAnswer, closeAnswer } =
  useSolve()
const questionIdRef = ref('')

const currentAnswerData = computed(() => {
  return {
    language: 'en',
    questionId: questionIdRef.value,
    answer: currentAnswer.content,
    answerJsonObject: currentAnswer.answerJsonObject,
  }
})

// ================= 业务逻辑聚合 =================
// 限制检查相关
const limitChecker = {
  async check() {
    isOutLimit.value = false
    const [balanceData, hasSolverVip] = await Promise.all([
      getTrpc().getUserBalance.query(),
      getTrpc().getSubscriptionStatus.query(),
    ])

    const available =
      balanceData.plugin! > 0 || balanceData.balance! >= 10 || hasSolverVip
    isOutLimit.value = !available
  },
}

// 图片处理相关
const imageProcessor = {
  async upload(imgData: { canvas: HTMLCanvasElement; cutDataUrl: string }) {
    try {
      return await uploadFileToS3(imgData.cutDataUrl)
    } catch (error) {
      sendToast(
        'We encountered an issue with uploading your screenshot. Please try again.'
      )
      panelControl.close()
      throw error
    }
  },
}

// ================= 用户操作响应 =================
const userActions = {
  // 解题
  async solve(imgData: any) {
    try {
      panelControl.open(imgData)
      imgDataRef.value = imgData
      isNetworkError.value = false
      // 打点 解题浮窗成功弹出, 无论什么情况都打这个点
      trackEvent.track('Plugin_Solve_panel_show')

      // 余额不足检查
      await limitChecker.check()
      if (isOutLimit.value) {
        // 打点 余额不足
        trackEvent.track('Plugin_Solve_no_attempt')
        return
      }

      // 上传开始计时
      totalStartTime.value = Date.now()
      isLoading.value = true
      const cdnUrl = await imageProcessor.upload(imgData)

      // 打点 上传时长
      trackEvent.track('Plugin_Solve_loading_upload', {
        duration: (Date.now() - totalStartTime.value) / 1000,
        durationMS: Date.now() - totalStartTime.value,
        cdnUrl: cdnUrl,
      })

      // 开启算法解题流程
      await solvingFlow.start(cdnUrl)
    } catch (error) {
      // 打点 网络错误
      trackEvent.track('Plugin_Solve_connect_fail')
      isNetworkError.value = true
    }
  },

  // 网络错误刷新
  refresh: () => {
    if (!imgDataRef.value) {
      sendToast('缺少解题数据，请重新截图')
      return
    }
    userActions.solve(imgDataRef.value)
  },

  // 重试
  async retry() {
    try {
      isLoading.value = true
      isNetworkError.value = false
      const retryStartTime = Date.now()
      await retryAnswer({
        onStartOutput: () => {
          isLoading.value = false
          trackEvent.track('Plugin_Solve_Success', {
            isRetry: true,
          })
        },
        successCallback: () => {
          trackEvent.track('Plugin_Solve_loading_retry', {
            duration: (Date.now() - retryStartTime) / 1000,
            durationMS: Date.now() - retryStartTime,
            isRetry: true,
          })
        },
        errorCallback: () => {
          isLoading.value = false
        },
      })
    } catch (error) {
      isNetworkError.value = true
      // 打点 网络错误
      trackEvent.track('Plugin_Solve_connect_fail')
    }
  },

  // 关闭
  close() {
    closeAnswer()
  },
}

// ================= 解题流程控制 =================
const solvingFlow = {
  async start(cdnUrl: string) {
    const questionId = questionIdRef.value = generateQuestionId()
    let questionInfo = {
      mode: 'plugin', // 插件解题专门的模式
      language: 'en',
      subject: 'math',
      instructions: '',
      type: 'photo',
      time: Date.now(),
      files: [
        {
          processed: cdnUrl,
        },
      ],
      questionId: questionId,
      answerId: `${questionId}#${Date.now()}`,
      answerStyle: 'standard',
      answerLanguage: 'en-us',
      answerType: 'generation',
    }

    // 开启算法解题
    console.log('[solvingFlow] 开启算法解题 questionInfo 参数: ', questionInfo)

    const startAnswerTime = Date.now()

    await startAnswer(questionInfo, {
      onStartOutput: () => {
        isLoading.value = false
        trackEvent.track('Plugin_Solve_Success', {
          questionId: questionId,
          cdnUrl: cdnUrl,
        })
        trackEvent.track('Plugin_Solve_loading_solve', {
          duration: (Date.now() - startAnswerTime) / 1000,
          durationMS: Date.now() - startAnswerTime,
          questionId: questionId,
          cdnUrl: cdnUrl,
        })
      },
      successCallback: () => {
        trackEvent.track('Plugin_Solve_loading_total', {
          duration: (Date.now() - totalStartTime.value) / 1000,
          durationMS: Date.now() - totalStartTime.value,
          questionId: questionId,
          cdnUrl: cdnUrl,
        })

        // 推送解题完成的消息
        emitter.emit('solve:done', {
          questionId: questionId,
          cdnUrl: cdnUrl,
        })
      },
      errorCallback: () => {
        trackEvent.track('Plugin_Solve_Error', {
          questionId: questionId,
          cdnUrl: cdnUrl,
        })
        isLoading.value = false
      },
    })
  },
}

// ================= 对等操作 =================
// 面板控制
const panelControl = {
  open: (imgData: any) => solvingPanelRef.value?.openPanel(imgData),
  openExamplePanel: () => solvingPanelRef.value?.openExamplePanel(),
  openNoLoginPanel: (imgData: any) => solvingPanelRef.value?.openNoLoginPanel(imgData),
  close: () => solvingPanelRef.value?.closePanel(),
}

// ================= 暴露方法 =================
defineExpose({
  solveInExtension: userActions.solve,
  closeSolvingPanel: panelControl.close,
  openSolvingPanel: panelControl.open,
  openExamplePanel: panelControl.openExamplePanel,
  openNoLoginPanel: panelControl.openNoLoginPanel,
})
</script>

<style lang="less"></style>
