<template>
  <div
    id="solvely-text-selection-root"
    :class="{ dark: isDark }"
  >
    <!-- Toolbar -->
    <Toolbar
      v-if="isSidePanelSupported() && shouldShow && selectionText"
      :shouldShow="shouldShow"
      :position="toolbarPosition"
      :isSolveLayer="isSolveLayer || false"
      @toSolve="handleSolve"
      @toExplain="handleExplain"
      @toSummarize="handleSummarize"
      @toQuiz="handleQuiz"
      @toChat="handleChat"
      @toClose="handlecloseBtn"
      @dragEnd="handleToolbarDragEnd"
    />

    <!-- SolveLayer 浮窗 (仅渲染，不使用 ref) -->
    <SolveLayer v-if="isSolveLayer || !isSidePanelSupported()" />

    <!-- LatexSandbox iframe，用于 LaTeX 渲染 -->
    <LatexSandbox />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTextSelection, get8kText } from '@/composables/content/useTextSelection'
import { useSelection } from '@/composables/content/useSelection'
import Toolbar from './Toolbar.vue'
import SolveLayer from '@/components/solveLayer/index.vue'
import LatexSandbox from '@/components/common/LatexSandbox.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import useABTest from '@/composables/useABTest'
import useContentAuth from '@/composables/content/useContentAuth'
import useSolveLayer from '@/composables/useSolveLayer'
import { isSidePanelSupported } from '@/utils/common'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'
import trackEvent from '@/utils/trackEvent'

const { isDark } = useDarkMode()

const text = ref('')

// 使用 AB Test composable
const { isSolveLayer } = useABTest()

// 使用登录检查中间件
const { checkAndExecute } = useContentAuth()

// 获取 showLayer 方法（用于登录后执行）
const { showLayer } = useSolveLayer()

// 使用选区 composable（顶层统一管理）
const { selectionText, selectionPosition, hasSelection } = useSelection()

// Toolbar 位置偏好（记忆用户拖拽习惯）
const toolbarPreference = ref<'top' | 'bottom'>('bottom')

// 使用工具栏 composable
const {
  shouldShow,
  toolbarPosition,
  solveSelection,
  summarizeSelection,
  quizSelection,
  handleClose,
  explainSelection,
  chatSelection,
  hideToolbar,
  handleToolbarDragEnd: updateToolbarAfterDrag,
} = useTextSelection(selectionText, selectionPosition, hasSelection, toolbarPreference)

// 检查余额并在不足时转发到侧边栏
const checkBalanceAndRequestPaywall = async (): Promise<boolean> => {
  // 要保证余额不足非订阅用户
  const isSubscribed = useSubscription.isSubscribed.value
  const isLimit = await useSubscription.limitCheck()
  console.error('checkBalanceAndRequestPaywall', isLimit, isSubscribed)
  return isLimit || isSubscribed
}

const handleSolve = async (payload: { position: { left: string; top: string } }) => {
  hideToolbar()
  
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Quickaction_Solve', {
    selectionLength: selectionText.value.length,
    from: 'page',
  })
  
  if (isSolveLayer.value) {
    if (!(await checkBalanceAndRequestPaywall())) {
      solveSelection()
      return
    }

    await checkAndExecute(() => showLayer('Solve', payload.position, { selectionText: selectionText.value }), {
      type: 'Solve',
    })
  } else {
    solveSelection()
  }
}

const handleExplain = async (payload: { position: { left: string; top: string } }) => {
  hideToolbar()
  
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Quickaction_Explain', {
    selectionLength: selectionText.value.length,
    from: 'page',
  })
  
  if (isSolveLayer.value) {
    if (!(await checkBalanceAndRequestPaywall())) {
      explainSelection()
      return
    }

    const text8k = await get8kText(selectionText.value)
    await checkAndExecute(
      () => showLayer('Explain', payload.position, { selectionText: selectionText.value, fullText: text8k }),
      { type: 'Explain' }
    )
  } else {
    explainSelection()
  }
}

const handleSummarize = async (payload: { position: { left: string; top: string } }) => {
  hideToolbar()
  
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Quickaction_Summarize', {
    selectionLength: selectionText.value.length,
    from: 'page',
  })
  
  if (isSolveLayer.value) {
    if (!(await checkBalanceAndRequestPaywall())) {
      summarizeSelection()
      return
    }

    await checkAndExecute(() => showLayer('Summarize', payload.position, { selectionText: selectionText.value }), {
      type: 'Summarize',
    })
  } else {
    summarizeSelection()
  }
}

const handleQuiz = async (payload: { position: { left: string; top: string } }) => {
  hideToolbar()
  
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Quickaction_Quiz', {
    selectionLength: selectionText.value.length,
    from: 'page',
  })
  
  if (isSolveLayer.value) {
    if (!(await checkBalanceAndRequestPaywall())) {
      quizSelection()
      return
    }

    await checkAndExecute(() => showLayer('Quiz', payload.position, { selectionText: selectionText.value }), {
      type: 'Quiz',
    })
  } else {
    quizSelection()
  }
}

const handleChat = async (payload: { position: { left: string; top: string }; input: string }) => {
  hideToolbar()
  
  // 🎯 埋点需要在 AB 测试判断之前发送
  trackEvent.track('Plugin_Quickaction_Chat', {
    selectionLength: selectionText.value.length,
    from: 'page',
  })
  
  if (isSolveLayer.value) {
    if (!(await checkBalanceAndRequestPaywall())) {
      chatSelection()
      return
    }

    const text8k = await get8kText(selectionText.value)
    await checkAndExecute(
      () =>
        showLayer('Chat', payload.position, {
          selectionText: selectionText.value,
          userInput: payload.input,
          fullText: text8k,
        }),
      { type: 'Chat' }
    )
  } else {
    text.value = payload.input
    chatSelection()
  }
}

// 处理 Toolbar 拖拽结束，应用约束并更新位置偏好
const handleToolbarDragEnd = (payload: { position: { left: string; top: string } }) => {
  // 调用 composable 方法进行约束和偏好更新
  updateToolbarAfterDrag(payload.position)
}

const handlecloseBtn = () => {
  hideToolbar()
  handleClose()
}
</script>
