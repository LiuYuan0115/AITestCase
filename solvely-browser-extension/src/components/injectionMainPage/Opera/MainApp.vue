<template>
    <div>
      <FloatBtns @toCut="openCut" v-show="!isShowScreenshot" />
      <Screenshot ref="screenshotRef" @toSolve="handleClickSolve" @close="closeScreenshot" />
      <SolveCore ref="solveCoreRef" @toCut="openCut" />
      <LatexSandbox />
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'
  import FloatBtns from '~/components/floatButtons/FloatBtns.vue'
  import SolveCore from './solvingPanel/core/SolveCore.vue'
  import Screenshot from '~/components/screenshot/index.vue'
  import LatexSandbox from '~/components/common/LatexSandbox.vue'
  import { getTrpc } from '~/lib/trpc/client'
  import EVENT from '~/utils/event'
  import trackEvent from '~/utils/trackEvent'
  
  // 定义面板类型枚举
  enum PanelType {
    NONE = 'none', // 未打开任何面板
    NORMAL = 'normal', // 正常解题面板
    EXAMPLE = 'example', // 示例解题面板
    NO_LOGIN = 'no_login', // 未登录解题面板
  }
  
  // 点击解题, 按钮, emit 出来的是截图的图片数据
  interface SolveImageData {
    canvas: HTMLCanvasElement
    cutDataUrl: string
  }
  
  // 组件引用
  const screenshotRef = ref<InstanceType<typeof Screenshot> | null>(null)
  const solveCoreRef = ref<InstanceType<typeof SolveCore> | null>(null)
  
  // 截图显示状态
  const isShowScreenshot = ref(false)
  
  // 当前面板状态
  const currentPanelType = ref<PanelType>(PanelType.NONE)
  const currentImageData = ref<SolveImageData | null>(null)
  
  // 监听登录状态变化继续执行未完成的解题流程
  const subscriptionLoaded = ref(false)
  const isLoggedIn = ref(false)
  const handleLoginStatusChange = (message: any) => {
    if (
      message.type !== EVENT.SOLVELY_DATA_SYNC ||
      currentPanelType.value !== PanelType.NO_LOGIN
    )
      return
  
    // 解题流程依赖从主站同步过来的两个请求数据
    if (message.api === '/user') {
      if (subscriptionLoaded.value) {
        continueSolving()
      } else {
        isLoggedIn.value = true
      }
    } else if (message.api === '/pricing/subscription') {
      subscriptionLoaded.value = true
      if (isLoggedIn.value) {
        continueSolving()
      }
    }
  }
  
  const continueSolving = () => {
    if (currentImageData.value) {
      // 未登录状态下，solution区域展示遮蔽状态，用户成功login，并开始展示答案
      trackEvent.track('Plugin_Solve_login_success')
      currentPanelType.value = PanelType.NORMAL
      executeSolving(currentImageData.value)
    }
  }
  
  onMounted(() => {
    // 添加消息监听器
    browser.runtime.onMessage.addListener(handleLoginStatusChange)
  })
  
  onUnmounted(() => {
    // 移除消息监听器
    browser.runtime.onMessage.removeListener(handleLoginStatusChange)
  })
  
  // 开启截图组件
  const openCut = () => {
    // 有可能在截图的时候，已经打开了solvingPanel，所以需要先关闭solvingPanel
    currentPanelType.value = PanelType.NONE
    solveCoreRef.value?.closeSolvingPanel()
    screenshotRef.value?.toShow()
    isShowScreenshot.value = true
  }
  
  // 关闭截图组件
  const closeScreenshot = () => {
    isShowScreenshot.value = false
  }
  
  // 点击 solve 按钮, 进入解题流程
  const handleClickSolve = async ({ canvas, cutDataUrl }: SolveImageData) => {
    try {
      // 保存当前截图数据
      currentImageData.value = { canvas, cutDataUrl }
  
      if (
        window.location.href.split('?')[0] ===
        import.meta.env.VITE_ONBOARDING_PAGE_URL
      ) {
        // onboarding 页面始终为假解题
        currentPanelType.value = PanelType.EXAMPLE
        solveCoreRef.value?.openExamplePanel()
        window.dispatchEvent(new Event('onboarding'))
        return
      }
  
      const isLogin = await getTrpc().isLogin.query()
  
      // 未登录先显示未登录状态的解题面板
      if (!isLogin) {
        currentPanelType.value = PanelType.NO_LOGIN
        solveCoreRef.value?.openNoLoginPanel({ canvas, cutDataUrl })
        return
      }
  
      // 安全调用解题核心逻辑
      currentPanelType.value = PanelType.NORMAL
      executeSolving({ canvas, cutDataUrl })
    } catch (error) {
      handleSolvingError(error)
    }
  }
  
  // 独立解题执行方法
  const executeSolving = (imgData: SolveImageData) => {
    if (!solveCoreRef.value) {
      throw new Error('解题核心组件未正确初始化')
    }
    solveCoreRef.value.solveInExtension(imgData)
  }
  
  // 统一错误处理方法
  const handleSolvingError = (error: unknown) => {
    console.error('解题流程异常:', error)
    // 可扩展添加错误上报或用户提示
  }
  </script>
  