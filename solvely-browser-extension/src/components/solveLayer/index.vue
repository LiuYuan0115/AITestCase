<template>
  <Transition name="layer">
    <div
      v-if="layerVisible"
      v-show="!isSuspended"
      ref="layerRef"
      :style="layerStyle"
      class="w-[400px] min-h-[300px] max-h-[500px] rounded-[24px] bg-b_card dark:bg-b_card_dk shadow-[0_0_16px_#78768029] p-[15px] pr-0 border border-white dark:border-f_card_2_dk pt-0 flex flex-col justify-between z-50 color-transition"
      @mousedown="handleMouseDown"
    >
      <!-- Toast 提示 - 相对于浮层容器居中 -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        leave-active-class="transition-opacity duration-300 ease-in"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showToast"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none"
        >
          <div class="px-2 py-1 text-[14px] text-white bg-[#334255] rounded-[6px] shadow-md whitespace-nowrap">
            {{ toastMessage }}
          </div>
        </div>
      </Transition>
      <!-- header -->
      <div class="flex flex-col pb-4 pr-[15px]">
        <!-- control handle -->
        <div
          class="h-[15px] flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing"
          @mousedown="handleDragMouseDown"
        >
          <i class="h-0.5 w-[14px] bg-d_1 dark:bg-d_1_dk rounded-full mt-[7px] color-transition"></i>
          <i class="h-0.5 w-[14px] bg-d_1 dark:bg-d_1_dk rounded-full color-transition"></i>
        </div>
        <!-- title -->
        <div class="flex justify-between items-center">
          <div class="text-t_1 dark:text-t_1_dk color-transition">
            <SvgIcon
              :name="LAYER_TYPE_MAP.find((item) => item.type === layerType)?.icon || 'textSelection/select-solve'"
              size="24"
            />
          </div>
          <div
            class="ml-[6px] font-[700] text-[18px] leading-[1.3] font-['Inter'] text-t_1 dark:text-t_1_dk color-transition"
          >
            {{ LAYER_TYPE_MAP.find((item) => item.type === layerType)?.type || 'Solve' }}
          </div>
          <div class="flex-1"></div>
          <div class="mr-1.5 h-6 w-6">
            <CustomTooltip
              :text="isPinned ? 'Unpin' : 'Pin'"
              position="top"
            >
              <div
                class="text-t_2 dark:text-t_2_dk cursor-pointer h-6 w-6 rounded-full bg-transparent hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk color-transition flex items-center justify-center"
                @click="handlePinClick"
              >
                <SvgIcon
                  name="textSelection/layer-pin"
                  size="24"
                  v-if="!isPinned"
                />
                <SvgIcon
                  name="textSelection/layer-pin-active"
                  size="24"
                  v-else
                />
              </div>
            </CustomTooltip>
          </div>
          <div
            class="text-t_2 dark:text-t_2_dk cursor-pointer flex items-center justify-center h-6 w-6 rounded-full bg-transparent hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk color-transition"
            @click="handleCloseClick"
          >
            <SvgIcon
              name="textSelection/layer-close"
              size="12"
            />
          </div>
        </div>
      </div>
      <!-- body -->
      <div
        ref="scrollContainerRef"
        class="overflow-y-auto flex-1 max-h-[476px] pr-[12px] box-border scrollbar-gutter"
      >
        <ExampleMessage v-if="isShowExample" />
        <template v-else>
          <layerUserMessage
            :data="{
              text: layerData.userInput,
              selection: layerData.selectionText,
              base64: layerData.base64,
            }"
            :type="layerType"
          />

          <!-- Service Message 组件 -->
          <layerServiceMessage
            ref="layerServiceMessageRef"
            :key="refreshKey"
            :layer-type="layerType"
            :layer-data="layerData"
            @status-change="handleStatusChange"
            @message-update="handleMessageUpdate"
          />
        </template>
      </div>

      <!-- 🎯 滚动到底部按钮 - 和 header/body/footer 平级 -->
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        leave-active-class="transition-opacity duration-200 ease-in"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showToBottom"
          @click="handleToBottomClick"
          class="to-bottom absolute bottom-[70px] left-[50%] z-[10] translate-x-[-50%] w-[32px] h-[32px] flex items-center justify-center border border-s-border dark:border-s-border-dark rounded-[12px] cursor-pointer bg-b_card dark:bg-b_card_dk text-t_1 dark:text-t_1_dk color-transition"
        >
          <SvgIcon name="arrow-down3" />
        </div>
      </Transition>
      <!-- footer -->
      <div
        class="min-h-9 h-9 mt-4 pr-[15px]"
        v-if="!showNoLogin && !isShowExample"
      >
        <!-- stop button - example 模式下隐藏 -->
        <div
          v-if="isAnswering && !isShowExample"
          @click="handleStop"
          class="text-t_brand dark:text-t_brand_dk mx-auto flex items-center gap-[5px] justify-center h-full px-3 w-fit rounded-full cursor-pointer color-transition"
        >
          <div
            class="flex justify-center items-center rounded-full w-[14px] h-[14px] color-transition bg-t_brand dark:bg-t_brand_dk"
          >
            <i class="w-[6px] h-[6px] bg-white rounded-[1.4px]"></i>
          </div>
          <span class="text-[14px] font-[500] leading-[1.4] font-['Inter']">Stop</span>
        </div>
        <!-- ask follow-up button - 只在支持侧边栏时显示 -->
        <div
          v-else-if="isSidePanelSupported()"
          class="flex items-center justify-between h-full gap-3"
        >
          <!-- ask follow-up button - 只在 COMPLETED 状态且未显示付费弹窗时显示 -->
          <div
            v-if="messageStatus === MessageStatus.COMPLETED && conversationData && !isShowingPaywall"
            @click="handleAskFollowup"
            class="w-[178px] box-border flex items-center gap-[6px] justify-center h-full border border-d_1 dark:border-d_1_dk rounded-full cursor-pointer hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk color-transition"
          >
            <SvgIcon
              name="logo"
              size="16"
            />
            <span
              class="text-t_1 dark:text-t_1_dk text-[16px] font-[500] leading-[1.4] font-['Inter'] text-nowrap color-transition"
              >Ask follow-up</span
            >
          </div>
          <!-- next question button - 只在未显示付费弹窗且未显示未登录界面时显示 -->
          <div
            v-if="layerData.base64 && !showNoLogin"
            class="flex-1 flex items-center justify-center"
          >
            <div
              @click="handleNextQuestion"
              class="flex items-center gap-1 justify-center h-full px-8 bg-transparent rounded-full cursor-pointer color-transition text-t_brand dark:text-t_brand_dk"
            >
              <SvgIcon
                name="textSelection/layer-cut"
                size="16"
              />
              <span
                class="text-t_brand dark:text-t_brand_dk text-[14px] font-[500] leading-[1.4] font-['Inter'] text-nowrap color-transition"
                >Next question</span
              >
            </div>
          </div>
        </div>
        <!-- ask follow-up button - 只在不支持侧边栏时显示 -->
        <div
          v-else-if="!isSidePanelSupported()"
          class="flex items-center h-full gap-[12px]"
        >
          <!-- next question button - 只在未显示付费弹窗且未显示未登录界面时显示 -->
          <div
            v-if="layerData.base64 && !showNoLogin"
            class="flex-1 h-9"
          >
            <div
              @click="handleNextQuestion"
              class="text-t_1 dark:text-t_1_dk flex items-center gap-[6px] justify-center h-full px-6 border border-d_1 dark:border-d_1_dk rounded-full cursor-pointer hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk color-transition"
            >
              <SvgIcon
                name="textSelection/layer-cut"
                size="16"
              />
              <span class="text-[16px] font-[500] leading-[1.4] font-['Inter'] text-nowrap color-transition"
                >Next question</span
              >
            </div>
          </div>
          <!-- history button - 只在解题完成后显示，同时必须满足不支持侧栏 -->
          <div
            v-if="layerData.base64 && !showNoLogin && !isSidePanelSupported()"
            class="flex items-center justify-center"
          >
            <CustomTooltip
              text="History"
              position="top"
              :offset="{ x: -16, y: 0 }"
            >
              <div
                @click="handleHistoryClick"
                class="flex items-center justify-center h-[36px] w-[36px] rounded-full cursor-pointer color-transition text-t_brand dark:text-t_brand_dk"
              >
                <SvgIcon
                  name="textSelection/layer-history"
                  size="20"
                />
              </div>
            </CustomTooltip>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted, provide, nextTick, watch } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import layerUserMessage from './layerUserMessage.vue'
import layerServiceMessage from './layerServiceMessage.vue'
import useSolveLayer from '@/composables/useSolveLayer'
import useABTest from '@/composables/useABTest'
import useAuth from '@/entrypoints/sidepanel/composables/useAuth'
import CustomTooltip from '@/components/common/CustomTooltip.vue'
import { InjectionTokens, type CancelRegistry } from '@/entrypoints/sidepanel/types/token'
import { MessageStatus } from '@/entrypoints/sidepanel/types/message'
import { LAYER_TYPE_MAP } from '@/utils/layerConversationBuilder'
import { useAnswerFormatter } from '@/entrypoints/sidepanel/components/solve/composables/useAnswerFormatter'
import { isSidePanelSupported } from '@/utils/common'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import usePaywall from '@/composables/usePaywall'
import { debounce } from 'lodash-es'
import trackEvent from '@/utils/trackEvent'
import ExampleMessage from '@/entrypoints/sidepanel/components/ExampleMessage.vue'

const { formatForCopy } = useAnswerFormatter()

// ✅ 提供 ABTest（V9 AnswerMessage 需要）============================================
const abTest = useABTest()
provide('abTest', abTest)

// ✅ 提供 Auth（NoBalanceSubscriptionPrompt 需要）============================================
const auth = useAuth()
provide('auth', auth)

// ✅ 提供 Subscription（V9 AnswerMessage 需要）============================================
provide('subscription', useSubscription)

// ✅ 使用 Paywall 单例
const paywall = usePaywall()

// ✅ 提供 isLayer（环境判断中转）
provide('isLayer', true)

// ✅ 余额不足状态（控制 footer 按钮显示）
const isShowingPaywall = ref(false)

// ✅ 提供 showOutLimit（环境判断中转）
const setNoAskFollowup = async (show: boolean) => {
  // 更新余额不足状态
  isShowingPaywall.value = show
}

const showOutLimit = async (show: boolean, from: string) => {
  if (show) {
    if (!isSidePanelSupported()) {
      paywall.show({
        from: from || 'unknown',
      })
      return
    }

    // 支持侧边栏时，转发到侧边栏
    try {
      await browser.runtime.sendMessage({
        type: 'SIDEPANEL:SHOW_PAYWALL_FROM_LAYER',
        data: {
          source: 'layer',
          from: from || 'unknown',
        },
      })
    } catch (error) {
      console.error('[Layer] Failed to request paywall:', error)
    }
  }
}
provide('showOutLimit', showOutLimit)

provide('setNoAskFollowup', setNoAskFollowup)

const handleHistoryClick = () => {
  // 答案面板，用户点击历史
  trackEvent.track('Plugin_NewPanel_History')
  window.open(`${import.meta.env.VITE_SOLVELY_URL}/history`, '_blank', 'noreferrer')
  hideLayer()
}

// ✅ 提供 thinking 限高滚动开关
provide('enable-thinking-scroll-limit', true)

// ✅ 提供 ExampleMessage 组件需要的依赖（example 模式下）
// user-content - 用户消息内容（example 模式下提供空对象）
provide('user-content', {})

// ✅ 创建 CancelRegistry 并 provide（简化版：浮层只会有一个消息）============================================
let currentCancelFn: (() => void) | null = null
const cancelRegistry: CancelRegistry = {
  registerCancelable: (messageId: string, cancelFn: () => void) => {
    currentCancelFn = cancelFn
  },
  unregisterCancelable: (messageId: string) => {
    currentCancelFn = null
  },
}
provide(InjectionTokens.CANCEL_REGISTRY, cancelRegistry)

// ✅ 提供统一的Quote方法 ============================================
// 接收高亮文本，内部统一获取上下文并流转到侧边栏
const handleLayerQuote = async (highlightedText: string) => {
  await useSubscription.refreshBalance()
  const isLimit = await useSubscription.limitCheck()
  if (!isLimit) {
    showOutLimit(true, 'MultipleQuestion')
    return
  }
  // 1. 检查 ref 是否存在
  if (!layerServiceMessageRef.value) {
    console.warn('[Layer] Quote failed: layerServiceMessageRef is null')
    return
  }

  // 2. 获取对话数据
  const conversationData = layerServiceMessageRef.value.getConversationData()
  if (!conversationData) {
    console.warn('[Layer] Quote failed: No conversation data available')
    return
  }

  // 🎯 3. 提取用户消息内容
  let userMessage = ''
  const userContent = conversationData.userMessage?.content
  if (userContent) {
    // 从 attachments.selection 提取（Summarize/Explain）
    if (userContent.attachments?.selection?.content) {
      userMessage = userContent.attachments.selection.content.trim()
    }
    // 从 attachments.quote 提取（Quote 消息）
    else if (userContent.attachments?.quote) {
      const parts: string[] = []
      if (userContent.attachments.quote.user_question) {
        parts.push(userContent.attachments.quote.user_question.trim())
      }
      if (userContent.attachments.quote.highlighted_text) {
        parts.push(userContent.attachments.quote.highlighted_text.trim())
      }
      userMessage = parts.join('\n').trim()
    }
    // 从 prompt 和 value 提取（Solve/Chat）
    else {
      const parts: string[] = []
      if (userContent.prompt && typeof userContent.prompt === 'string') {
        parts.push(userContent.prompt.trim())
      }
      const textTypes = ['text', 'text_solve', 'selection']
      if (textTypes.includes(userContent.type) && userContent.value && typeof userContent.value === 'string') {
        parts.push(userContent.value.trim())
      }
      userMessage = parts.join('\n').trim()
    }
  }

  // 4. 获取答案上下文（统一从 messageData 获取）
  let serviceContext = ''
  const messageData = layerServiceMessageRef.value.messageData

  if (messageData && typeof messageData === 'object') {
    // 🎯 多模型场景：从当前模型的 components 中获取（排除 thinking，保留 LaTeX）
    if (messageData.modelId && messageData.modelResults && Array.isArray(messageData.modelResults)) {
      try {
        const currentModel = messageData.modelResults.find((r: any) => r.modelId === messageData.modelId)
        if (currentModel && currentModel.components) {
          // 过滤掉 thinking 组件，使用 formatForCopy（已保留 LaTeX）
          const componentsWithoutThinking = currentModel.components.filter((c: any) => c.type !== 'question_thinking')
          serviceContext = formatForCopy(componentsWithoutThinking)
        }
      } catch (error) {
        console.error('[Layer] Error formatting multi-model components:', error)
        serviceContext = ''
      }
    }
    // Answer 类型：格式化 components（单模型场景，也需要排除 thinking，保留 LaTeX）
    else if (messageData.components && Array.isArray(messageData.components) && messageData.components.length > 0) {
      try {
        // 过滤掉 thinking 组件，使用 formatForCopy（已保留 LaTeX）
        const componentsWithoutThinking = messageData.components.filter((c: any) => c.type !== 'question_thinking')
        serviceContext = formatForCopy(componentsWithoutThinking)
      } catch (error) {
        console.error('[Layer] Error formatting components:', error)
        serviceContext = ''
      }
    }
    // 其他类型：使用 content
    else if (messageData.content && typeof messageData.content === 'string') {
      serviceContext = messageData.content
    } else {
      console.warn('[Layer] Quote failed: No valid context source found')
    }

    // 统一的文本清理
    if (serviceContext) {
      serviceContext = serviceContext
        .replace(/<graph>.*?<\/graph>/gs, '')
        .replace(/\n{4,}/g, '\n\n')
        .replace(/```[\s\S]*?```/g, '')
        .trim()
    }
  }

  // 5. 拼接完整上下文：用户消息 + 答案内容
  const fullContext = [userMessage, serviceContext].filter(Boolean).join('\n\n').trim().slice(0, 8000) // 🎯 8k限制

  try {
    // 6. 先推送对话到侧边栏
    await browser.runtime.sendMessage({
      type: 'SIDEPANEL:LAYER_TO_SIDEPANEL_PUSH_MESSAGES',
      data: conversationData,
    })

    // 7. 再发送 quote 唤醒信号
    await browser.runtime.sendMessage({
      type: 'SIDEPANEL:ACTIVATE_QUOTE_STAGING',
      data: {
        highlighted_text: highlightedText,
        context: fullContext, // 🎯 使用完整上下文（用户消息 + 答案）
        from: 'layer',
      },
    })

    // 8. 关闭浮层
    hideLayer()
  } catch (error) {
    console.error('[Layer] Failed to push quote:', error)
  }
}
provide('handleLayerQuote', handleLayerQuote)
// 使用浮窗状态管理（现在包含所有逻辑）
const {
  layerVisible,
  position,
  layerType,
  isPinned,
  layerData,
  isSuspended,
  refreshKey,
  dragOffset,
  isDragging,
  hideLayer,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handlePin,
  updateLayerSize,
  isHeightLocked,
  lockedHeight,
  maybeLockHeight,
  unlockHeightLock,
  isShowExample,
} = useSolveLayer()

// 🎯 P0-1: 浮层展示埋点
// 监听 refreshKey 变化（每次新解题都会更新，包括 Pin 后的新解题）
watch(refreshKey, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    trackEvent.track('Plugin_NewPanel_Show', {
      layerType: layerType.value,
    })
  }
})

// 提供高度锁解锁方法，供子组件（非 V9 重试）调用
provide('unlockHeightLock', unlockHeightLock)

// 浮窗 DOM 引用
const layerRef = ref<HTMLElement>()
// 🎯 layerServiceMessage 组件引用
const layerServiceMessageRef = ref<any>(null)
// 🎯 滚动容器引用
const scrollContainerRef = ref<HTMLElement>()

// 消息状态管理
const messageStatus = ref<MessageStatus>(MessageStatus.PENDING)
const isAnswering = computed(() => {
  return messageStatus.value === MessageStatus.PENDING || messageStatus.value === MessageStatus.RESPONDING
})

const handleStatusChange = (status: MessageStatus) => {
  messageStatus.value = status

  // 流式完成时，手动触发一次最终尺寸检查
  if (status === MessageStatus.COMPLETED || status === MessageStatus.STOP || status === MessageStatus.ERROR) {
    // 延迟检查确保 LatexFormat 异步渲染完成
    setTimeout(() => {
      if (layerRef.value) {
        const height = layerRef.value.offsetHeight
        updateLayerSize(layerRef.value.offsetWidth, height)
        // 检查是否需要锁定高度
        maybeLockHeight(height)
      }
      // 状态变化时也检查滚动位置
      debouncedCheckScrollPosition()
    }, 100)
  }
}

// 🎯 判断是否有对话数据（用于显示 Ask follow-up 按钮）
const conversationData = computed(() => layerServiceMessageRef.value?.getConversationData() || null)

// 🎯 判断是否显示未登录界面（用于隐藏 Next question 按钮）
const showNoLogin = computed(() => layerServiceMessageRef.value?.showNoLogin || false)

// 🔓 监听高度锁状态，解锁时清除 style.height
watch(isHeightLocked, (locked) => {
  if (!locked && layerRef.value) {
    layerRef.value.style.height = ''
  }
})

// 处理消息更新
const handleMessageUpdate = () => {
  // 流式内容更新时，手动触发一次尺寸更新和约束
  nextTick(() => {
    if (layerRef.value) {
      const height = layerRef.value.offsetHeight
      updateLayerSize(layerRef.value.offsetWidth, height)

      // 🔒 检查高度，如果达到 500px 就锁定
      if (!isHeightLocked.value && height >= 500) {
        maybeLockHeight(height)
        // 直接通过 style 锁定高度
        layerRef.value.style.height = '500px'
      }
    }
    // 内容更新时也检查滚动位置（使用防抖）
    debouncedCheckScrollPosition()
  })
}

// 🎯 P1-3: Stop 按钮处理
const handleStop = () => {
  unlockHeightLock()
  if (currentCancelFn) {
    currentCancelFn()
    currentCancelFn = null
  }
  messageStatus.value = MessageStatus.STOP

  trackEvent.track('Plugin_NewPanel_Stop')
}

// 🎯 P2-1: 处理拖拽手柄的 mousedown 事件
const handleDragMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  // 调用 composable 的拖拽开始方法
  handleDragStart(e)

  // 在组件层管理 document 事件监听
  const onMove = (e: MouseEvent) => {
    handleDragMove(e)
  }

  const onUp = () => {
    handleDragEnd()
    // 🎯 P2-1: 拖拽结束埋点
    trackEvent.track('Plugin_NewPanel_Drag')
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// 处理浮窗的 mousedown，阻止清除选区和关闭浮窗
const handleMouseDown = (e: MouseEvent) => {
  e.stopPropagation()
}

// 🎯 P0-2: 处理关闭按钮点击
const handleCloseClick = () => {
  trackEvent.track('Plugin_NewPanel_Close')
  hideLayer()
}

// 🎯 P1-1: 处理 Pin 按钮点击
const handlePinClick = () => {
  trackEvent.track('Plugin_NewPanel_Pin', {
    action: isPinned.value ? 'unpin' : 'pin',
  })
  handlePin()
}

// Toast 状态
const showToast = ref(false)
const toastMessage = ref('')
let toastTimer: NodeJS.Timeout | null = null

const showLayerToast = (message: string, duration: number = 2000) => {
  toastMessage.value = message
  showToast.value = true

  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    showToast.value = false
  }, duration)
}

// 检查侧边栏是否正在解题
const checkSidepanelSolving = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const requestId = `check-solving-${Date.now()}`

    const timeout = setTimeout(() => {
      cleanup()
      resolve(false) // 超时默认认为侧边栏不忙
    }, 1000)

    const messageListener = (message: any) => {
      if (message.type === 'SIDEPANEL:CHECK_SIDEPANEL_SOLVING_RESPONSE' && message.data?.requestId === requestId) {
        cleanup()
        resolve(message.data.isSolving || false)
      }
    }

    const cleanup = () => {
      clearTimeout(timeout)
      browser.runtime.onMessage.removeListener(messageListener)
    }

    browser.runtime.onMessage.addListener(messageListener)

    browser.runtime
      .sendMessage({
        type: 'SIDEPANEL:CHECK_SIDEPANEL_SOLVING',
        data: { requestId },
      })
      .catch(() => {
        cleanup()
        resolve(false)
      })
  })
}

// 处理 Ask follow-up 按钮点击
const handleAskFollowup = async () => {
  // 先检查侧边栏是否正在解题
  const isSidepanelSolving = await checkSidepanelSolving()

  // 🎯 P0-3: Ask follow-up 埋点
  const latestConversationData = layerServiceMessageRef.value?.getConversationData()
  trackEvent.track('Plugin_NewPanel_Askfollowup', {
    sidepanelBusy: isSidepanelSolving,
    layerType: layerType.value,
  })

  if (isSidepanelSolving) {
    showLayerToast('Let me finish first')
    return
  }

  await useSubscription.refreshBalance()
  const isLimit = await useSubscription.limitCheck()
  if (!isLimit) {
    showOutLimit(true, 'MultipleQuestion')
    return
  }
  // 🔑 动态获取最新的对话数据（包含用户的点赞点踩）
  if (!latestConversationData) return

  // 🔴 其他派降级处理：跳转网页TODO:重点支持下
  if (!isSidePanelSupported()) {
    const questionId = latestConversationData.messages?.[0]?.questionId
    if (questionId) {
      window.open(`${import.meta.env.VITE_SOLVELY_URL}/history/${questionId}`, '_blank', 'noreferrer')
    }
    hideLayer()
    return
  }

  // 可用派：推送到sidepanel
  try {
    // 发送消息到侧边栏
    await browser.runtime.sendMessage({
      type: 'SIDEPANEL:LAYER_TO_SIDEPANEL_PUSH_MESSAGES',
      data: latestConversationData, // ✅ 使用最新数据
    })

    // 关闭浮层（统一关闭，不管是否 pin）
    hideLayer()
  } catch (error) {
    console.error('[Layer] Failed to push to sidepanel:', error)
  }
}

// 🎯 P1-2: 处理 Next question 按钮点击
const handleNextQuestion = () => {
  trackEvent.track('Plugin_NewPanel_Nextquestion')

  // 1. 隐藏当前 solveLayer（如果未 pin）
  if (!isPinned.value) {
    hideLayer()
  }

  // 2. 派发全局事件打开截图（跨 Shadow DOM 通信）
  window.dispatchEvent(new Event('solvely-open-screenshot'))
}

// 计算浮窗样式（使用 fixed 定位）
const layerStyle = computed(() => {
  const leftValue = parseFloat(position.value.left)
  const topValue = parseFloat(position.value.top)

  return {
    position: 'fixed' as const,
    left: `${leftValue + dragOffset.value.x}px`,
    top: `${topValue + dragOffset.value.y}px`,
    pointerEvents: 'auto' as const,
    cursor: isDragging.value ? 'grabbing' : 'auto',
  }
})

// 🎯 滚动到底部按钮逻辑
const showToBottom = ref(false)

// 检测滚动位置
const checkScrollPosition = () => {
  if (!scrollContainerRef.value) return

  const { scrollTop, clientHeight, scrollHeight } = scrollContainerRef.value
  const distanceFromBottom = scrollHeight - clientHeight - scrollTop

  // 只要不在底部就显示按钮（距离底部超过 1px，避免浮点数误差）
  showToBottom.value = distanceFromBottom > 4
}

// 防抖的滚动检测（避免频繁触发）
const debouncedCheckScrollPosition = debounce(checkScrollPosition, 150)

// 处理点击滚动到底部按钮
const handleToBottomClick = () => {
  if (!scrollContainerRef.value) return

  scrollContainerRef.value.scrollTo({
    top: scrollContainerRef.value.scrollHeight,
    behavior: 'smooth',
  })
}

// 监听浮窗尺寸变化并通知 composable
onMounted(() => {
  if (layerRef.value) {
    // 获取真实尺寸并触发约束
    updateLayerSize(layerRef.value.offsetWidth, layerRef.value.offsetHeight)

    // 监听尺寸变化（主要是高度变化，如 layerUserMessage 展开/收起）
    const resizeObserver = new ResizeObserver((entries) => {
      const target = entries[0].target as HTMLElement
      const height = target.offsetHeight
      updateLayerSize(target.offsetWidth, height)

      // 🔒 检查高度，如果达到 500px 就锁定
      if (!isHeightLocked.value && height >= 500) {
        maybeLockHeight(height)
        // 直接通过 style 锁定高度
        target.style.height = '500px'
      }
    })

    resizeObserver.observe(layerRef.value)

    onUnmounted(() => {
      resizeObserver.disconnect()
    })
  }
})

// 🎯 使用 watch 监听 scrollContainerRef 何时被赋值（适配 Shadow DOM）
watch(
  scrollContainerRef,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      // 添加滚动监听（passive: true 提升性能）
      newVal.addEventListener('scroll', debouncedCheckScrollPosition, { passive: true })

      // 初始检查滚动位置（延迟确保内容已渲染）
      setTimeout(checkScrollPosition, 300)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.removeEventListener('scroll', debouncedCheckScrollPosition)
  }
  // 清理 toast 定时器
  if (toastTimer) clearTimeout(toastTimer)
  // 卸载时解除高度锁（解锁条件 3）
  unlockHeightLock()
})
</script>
<style scoped>
/* 进入动画 */
.layer-enter-active {
  transition: all 0.1s ease-out;
  transform-origin: top left;
}

/* 离开动画 */
.layer-leave-active {
  transition: all 0.1s ease-in;
  transform-origin: top left;
}

/* 进入的初始状态：从上方 + 缩小（Y轴缩放幅度大，X轴小） + 透明 */
.layer-enter-from {
  opacity: 0;
  transform: translateY(0) scaleX(0.97) scaleY(0.75);
}

/* 离开的最终状态：到上方 + 缩小（Y轴缩放幅度大，X轴小） + 透明 */
.layer-leave-to {
  opacity: 0;
  transform: translateY(0) scaleX(1) scaleY(1);
}

/* 进入和离开的正常状态（可选，Vue会自动处理） */
.layer-enter-to,
.layer-leave-from {
  opacity: 1;
  transform: translateY(0) scaleX(1) scaleY(1);
}

.scrollbar-gutter {
  scrollbar-gutter: stable;
}
</style>
