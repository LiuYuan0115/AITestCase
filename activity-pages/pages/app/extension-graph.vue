<template>
  <div class="flex h-[220px] w-[270px] items-center justify-between">
    <div
      id="container"
      class="relative flex h-[220px] w-[220px] items-center justify-center rounded-[12px] bg-[#eeeeee]"
    >
      <!-- 渲染窗口 -->
      <div class="h-[200px] w-[200px] overflow-hidden rounded-[6px]">
        <!-- loading -->
        <div
          v-if="isLoading"
          class="pointer-events-none flex h-full w-full items-center justify-center bg-white"
        >
          <div
            class="h-10 w-10 animate-spin rounded-full border-[3px] border-[#e6e8ea] border-t-[rgb(0,122,255)]"
          ></div>
        </div>
        <!-- 渲染失败 -->
        <p
          v-if="renderFailed"
          class="flex h-full w-full items-center justify-center bg-white text-center text-sm text-[#ff4d4f]"
        >
          Network error
        </p>
        <!-- 渲染容器 -->
        <div id="geogebra-container" class="h-[200px] w-[200px]"></div>
      </div>
    </div>
    <!-- 控制按钮 -->
    <div
      class="bg-disabled-bg flex h-full w-[50px] flex-col items-center justify-start gap-4 rounded-[12px]"
    >
      <div
        class="box-border flex h-[71px] w-[32px] flex-col items-center justify-between rounded-[6px] border border-[#E6E8EA] bg-white p-[2px]"
      >
        <div
          class="cursor-pointer rounded-[3px] p-[5px] duration-200 hover:bg-[#F6F8FA]"
          @click="handleZoomIn"
        >
          <img src="~/assets/app/ext-graph/plus.svg" alt="zoom in" class="h-4 w-4 text-[#111111]" />
        </div>
        <div
          class="cursor-pointer rounded-[3px] p-[5px] duration-200 hover:bg-[#F6F8FA]"
          @click="handleZoomOut"
        >
          <img
            src="~/assets/app/ext-graph/minus.svg"
            alt="zoom out"
            class="h-4 w-4 text-[#111111]"
          />
        </div>
      </div>
      <div
        class="box-border flex h-[32px] w-[32px] items-center justify-center rounded-[6px] border border-[#E6E8EA] bg-white p-[2px]"
      >
        <div
          class="cursor-pointer rounded-[3px] p-[5px] duration-200 hover:bg-[#F6F8FA]"
          @click="handleReset"
        >
          <img
            src="~/assets/app/ext-graph/position.svg"
            alt="reset position"
            class="h-4 w-4 text-[#111111]"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { throttle } from '~/utils'

declare global {
  interface Window {
    messageQueue?: MessageEvent[]
    earlyMessageListener?: (event: MessageEvent) => void
    GGBApplet?: any
  }
}

// 获取 PostHog 实例和节流函数
const { $posthog } = useNuxtApp()
// 节流时间，这边设置3秒
const throttleTime = 3000

// 添加 loading 状态和失败状态
const isLoading = ref(true) // 默认显示loading
const renderFailed = ref(false)

// 添加 GeoGebra API 引用
const geogebraApi = ref<any>(null)

// 添加超时检查
let loadingTimeout: NodeJS.Timeout | null = null

// 添加一个变量来存储初始坐标系信息
const initialCoords = ref<{
  xmin: number
  xmax: number
  ymin: number
  ymax: number
} | null>(null)

// 在组件挂载时开始计时
onMounted(() => {
  loadingTimeout = setTimeout(() => {
    if (isLoading.value) {
      console.error('GeoGebra loading timeout after 15s')
      renderFailed.value = true
      isLoading.value = false
    }
  }, 15000)
})

// 在组件卸载时清除计时器
onUnmounted(() => {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }
})

// 处理放大
const handleZoomIn = () => {
  if (!geogebraApi.value) {
    console.warn('GeoGebra API not ready')
    return
  }
  if (isLoading.value) {
    console.warn('GeoGebra is still loading')
    return
  }
  try {
    // 使用 GeoGebra 内置的缩放 API，缩放因子为 1.2
    geogebraApi.value.evalCommand('ZoomIn(1.2)')
    // 添加放大按钮埋点
    $posthog?.capture('Plugin_Sidebar_Picture_Zoomin')
  } catch (error) {
    console.error('Failed to zoom in:', error)
  }
}

// 处理缩小
const handleZoomOut = () => {
  if (!geogebraApi.value) {
    console.warn('GeoGebra API not ready')
    return
  }
  if (isLoading.value) {
    console.warn('GeoGebra is still loading')
    return
  }
  try {
    // 使用 GeoGebra 内置的缩放 API，缩放因子为 0.8 (1/1.2)
    geogebraApi.value.evalCommand('ZoomIn(0.8333333)')
    // 添加缩小按钮埋点
    $posthog?.capture('Plugin_Sidebar_Picture_Zoomout')
  } catch (error) {
    console.error('Failed to zoom out:', error)
  }
}

// 处理重置
const handleReset = () => {
  if (!geogebraApi.value) {
    console.warn('GeoGebra API not ready')
    return
  }
  if (isLoading.value) {
    console.warn('GeoGebra is still loading')
    return
  }
  try {
    // 如果有初始坐标系信息，使用它来重置
    if (initialCoords.value) {
      geogebraApi.value.setCoordSystem(
        initialCoords.value.xmin,
        initialCoords.value.xmax,
        initialCoords.value.ymin,
        initialCoords.value.ymax
      )
    }
    // 添加居中按钮埋点
    $posthog?.capture('Plugin_Sidebar_Picture_Center')
  } catch (error) {
    console.error('Failed to reset view:', error)
  }
}

interface GraphData {
  axisType: number
  coordSystem: {
    xmin: number
    xmax: number
    ymin: number
    ymax: number
  }
  commands: string[]
  width: number
  height: number
}

interface RenderResult {
  success: boolean
  width?: number
  height?: number
  error?: string
}

// 添加拖拽和滚动事件处理（使用2秒节流）
const handleDrag = throttle(() => {
  $posthog?.capture('Plugin_Sidebar_Picture_Drag')
}, throttleTime)

const handleScroll = throttle(() => {
  $posthog?.capture('Plugin_Sidebar_Picture_Scroll')
}, throttleTime)

function renderGraph(graphData: GraphData): Promise<RenderResult> {
  return new Promise((resolve, reject) => {
    let completed = false
    const containerId = 'geogebra-container'

    // 超时保护
    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true
        reject(new Error('渲染超时'))
      }
    }, 15000)

    const params = {
      // 基础配置
      id: containerId, // 容器ID
      appName: 'graphing', // 应用类型：graphing(绘图)、geometry(几何)、3d(3D)、classic(经典)
      width: graphData.width, // 宽度
      height: graphData.height, // 高度

      // 工具栏和菜单配置
      showToolBar: false, // 是否显示工具栏
      showMenuBar: false, // 是否显示菜单栏
      allowStyleBar: false, // 是否允许样式栏
      showAlgebraInput: false, // 是否显示代数输入框
      showAlgebraView: false, // 是否显示代数视图（左侧面板）

      // 交互控制
      enableLabelDrags: false, // 是否允许拖动标签
      enableShiftDragZoom: true, // 是否允许通过Shift+拖动来缩放
      enableRightClick: false, // 是否允许右键菜单
      // preventFocus: true,                // 是否阻止自动获取焦点

      // 网格和坐标轴
      gridType: 3, // 网格类型：0(无)、1(笛卡尔)、2(等距)、3(极坐标)
      gridVisible: false, // 是否显示网格
      // axesVisible: true,                 // 是否显示坐标轴

      // 捕捉和阈值
      // pointCapturing: 3,                 // 点捕捉模式：0(无)、1(网格)、2(点)、3(自动)
      capturingThreshold: null, // 捕捉阈值

      // 显示控制
      showToolBarHelp: false, // 是否显示工具栏帮助
      errorDialogsActive: false, // 是否激活错误对话框
      showTutorialLink: false, // 是否显示教程链接
      showLogging: false, // 是否显示日志

      // 界面定制
      language: 'en', // 界面语言
      borderColor: '#FFFFFF', // 边框颜色
      // buttonShadows: false,              // 是否显示按钮阴影

      // 缩放和尺寸
      // allowUpscale: true, // 是否允许放大
      // autoHeight: true,                  // 是否自动调整高度
      // scaleContainerClass: 'geogebra-scale', // 缩放容器的类名

      // 数字显示
      // rounding: 'decimals',              // 数字显示方式：decimals(小数)、significant(有效数字)

      // 功能按钮
      // showAnimationButton: false,        // 是否显示动画按钮
      // showFullscreenButton: false,       // 是否显示全屏按钮
      // showSuggestionButtons: false,      // 是否显示建议按钮
      // showStartTooltip: false,           // 是否显示开始提示

      // 其他功能
      useBrowserForJS: true, // 是否使用浏览器执行JS
      // enableFileFeatures: false,         // 是否启用文件相关功能

      // 加载完成回调
      appletOnLoad: (api: any) => {
        try {
          const graphLineColors = [
            [0, 122, 255], // 蓝色
            [0, 201, 201], // 青色
            [240, 136, 77], // 橙色
            [213, 128, 255], // 紫色
            [120, 99, 255], // 蓝紫色
            [96, 196, 45], // 绿色
            [189, 143, 36], // 棕色
            [255, 128, 202], // 粉色
            [36, 145, 179] // 深青色
          ]

          // 保存API引用
          geogebraApi.value = api

          // 保存初始坐标系信息
          initialCoords.value = {
            xmin: graphData.coordSystem.xmin,
            xmax: graphData.coordSystem.xmax,
            ymin: graphData.coordSystem.ymin,
            ymax: graphData.coordSystem.ymax
          }

          // 设置图形选项
          api.setGraphicsOptions(1, {
            gridType: graphData.axisType, // 网格类型
            grid: true, // 是否显示网格
            axes: true, // 是否显示坐标轴
            pointCapturing: 3 // 点捕捉模式

            // rightAngleStyle: 1,            // 直角样式：1(简单)、2(方块)
            // gridIsBold: false,             // 网格是否加粗
            // axesStyle: 1,                  // 坐标轴样式：0(无)、1(箭头)、2(无箭头)
          })

          // 隐藏标题栏
          api.setPerspective('G') // 设置为纯图形视图

          graphData.commands.forEach((command: string, index: number) => {
            try {
              const line = api.evalCommandGetLabels(command)
              api.setLabelStyle(line, 2)
              const colorIndex = index % graphLineColors.length
              const [r, g, b] = graphLineColors[colorIndex]
              api.setColor(line, r, g, b)
            } catch (cmdError) {
              console.error('执行命令失败:', command, cmdError)
            }
          })

          // 设置坐标系
          api.setCoordSystem(
            graphData.coordSystem.xmin,
            graphData.coordSystem.xmax,
            graphData.coordSystem.ymin,
            graphData.coordSystem.ymax
          )

          // 添加拖拽和滚动事件监听
          const container = document.getElementById(containerId)

          if (container) {
            let isDragging = false
            let startX = 0
            let startY = 0

            // 鼠标按下时记录起始位置
            container.addEventListener(
              'mousedown',
              (e: Event) => {
                const mouseEvent = e as MouseEvent
                isDragging = true
                startX = mouseEvent.clientX
                startY = mouseEvent.clientY
              },
              true
            ) // 使用捕获阶段

            // 监听鼠标移动
            document.addEventListener('mousemove', (e) => {
              if (isDragging) {
                const deltaX = Math.abs(e.clientX - startX)
                const deltaY = Math.abs(e.clientY - startY)

                // 如果移动超过阈值，触发拖拽事件
                if (deltaX > 10 || deltaY > 10) {
                  handleDrag()
                  // 更新起始位置，这样可以继续检测新的移动
                  startX = e.clientX
                  startY = e.clientY
                }
              }
            })

            // 监听鼠标抬起
            document.addEventListener('mouseup', () => {
              isDragging = false
            })

            // 监听滚动事件
            container.addEventListener('wheel', handleScroll, { passive: true })
          }

          // 添加实例成功展示的埋点
          $posthog?.capture('Plugin_Sidebar_Picture_Show')

          // 直接返回成功，不生成图片数据
          completed = true
          clearTimeout(timeout)
          resolve({
            success: true,
            width: graphData.width,
            height: graphData.height
          })
        } catch (error) {
          if (!completed) {
            completed = true
            clearTimeout(timeout)
            reject(error instanceof Error ? error : new Error('渲染失败'))
          }
        }
      }
    }

    try {
      if (window.GGBApplet) {
        const applet = new window.GGBApplet(params, true)
        applet.inject(containerId)
      } else {
        throw new Error('GeoGebra not loaded')
      }
    } catch (error) {
      completed = true
      clearTimeout(timeout)
      reject(error instanceof Error ? error : new Error('初始化失败'))
    }
  })
}

// 设置 GeoGebra 脚本
useHead({
  script: [
    {
      src: 'https://cdn.geogebra.org/apps/deployggb.js'
    },
    {
      innerHTML: `
        // 初始化消息队列系统
        window.messageQueue = [];
        window.earlyMessageListener = function(event) {
          console.log('Early message received:', event.data);
          window.messageQueue.push(event);
        };
        // 立即开始监听消息
        window.addEventListener('message', window.earlyMessageListener);
      `
    }
  ]
})

// 处理来自父窗口的消息
const handleMessage = async (event: MessageEvent) => {
  try {
    const messageData = JSON.parse(event.data)
    if (messageData) {
      isLoading.value = true // 设置加载状态
      await renderGraph(messageData)
      // 加载成功时清除超时计时器
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
        loadingTimeout = null
      }
    }
  } catch (error) {
    console.error('Failed to handle message:', error)
    renderFailed.value = true
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  try {
    // 处理早期消息队列
    if (window.messageQueue && window.messageQueue.length > 0) {
      const messages = Array.from(window.messageQueue)
      window.messageQueue = []
      for (const message of messages) {
        await handleMessage(message)
      }
    }

    // 移除早期监听器，设置正式监听器
    if (window.earlyMessageListener) {
      window.removeEventListener('message', window.earlyMessageListener)
    }
    window.addEventListener('message', handleMessage)
  } catch (error) {
    renderFailed.value = true
    isLoading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
})
</script>
