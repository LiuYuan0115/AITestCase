<script setup>
import { onMounted, ref, reactive, onUnmounted } from 'vue'
import { loadScript } from '@/utils'
import { getUrlParam } from '@/utils'

const graphLineColors = [
  [0, 122, 255],
  [0, 201, 201],
  [240, 136, 77],
  [213, 128, 255],
  [120, 99, 255],
  [96, 196, 45],
  [189, 143, 36],
  [255, 128, 202],
  [36, 145, 179],
]

const props = defineProps({
  jsonData: {
    type: Object,
    required: true,
  },
  answerStatus: {
    type: Number,
    default: 0,
  },
  fullScreen: {
    type: Boolean,
    default: false,
  },
})
const loading = ref(true)
const state = reactive({
  applet: null,
  initialCoords: null,
  api: null,
})
const elementId = ref(`ggb-element-${Math.random().toString(36).substr(2, 9)}`)

const initGraph = () => {
  if (props.answerStatus === 1) {
    return
  }
  const isFullScreen = props.fullScreen
  let width = 300
  let height = 300
  if (isFullScreen) {
    width = window.innerWidth
    height = window.innerHeight - 80 - 8 * 2
  }
  loadScript('https://cdn.geogebra.org/apps/deployggb.js')
    .then(() => {
      const params = {
        id: elementId.value,
        appName: 'graphing',
        width,
        height,
        showToolBar: false,
        showMenuBar: false,
        allowStyleBar: false,
        showAlgebraInput: false,
        enableLabelDrags: false,
        enableShiftDragZoom: true,
        capturingThreshold: null,
        showToolBarHelp: false,
        errorDialogsActive: false,
        showTutorialLink: false,
        enableRightClick: false,
        scaleContainerClass: 'tex-view-graph',
        showLogging: false,
        useBrowserForJS: true,
        language: 'en',
        borderColor: '#FFFFFF',
        gridType: 3,
        gridVisible: false,
        ggbbase64:
          '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',
      }
      params.appletOnLoad = function (api) {
        state.api = api
        let data
        if (isFullScreen) {
          try {
            data = JSON.parse(decodeURIComponent(getUrlParam('graph') || '{}'))
          } catch (error) {
            console.error('Failed to parse graph data:', error)
            return
          }
        } else {
          data = props.jsonData
        }
        api.setGraphicsOptions(1, { gridType: data.axisType })
        data.commands.forEach((command, index) => {
          const line = api.evalCommandGetLabels(command)
          api.setLabelStyle(line, 2)
          api.setColor(line, ...graphLineColors[index % graphLineColors.length])
        })
        let coordSystem = {}
        if (isFullScreen) {
          const { xmin, xmax, ymin, ymax } = adjustCoordSystem(
            width,
            height,
            data.coordSystem
          )
          coordSystem = { xmin, xmax, ymin, ymax }
        } else {
          const { xmin, xmax, ymin, ymax } = data.coordSystem
          coordSystem = { xmin, xmax, ymin, ymax }
        }
        api.setCoordSystem(
          coordSystem.xmin,
          coordSystem.xmax,
          coordSystem.ymin,
          coordSystem.ymax
        )
        state.initialCoords = {
          xmin: coordSystem.xmin,
          xmax: coordSystem.xmax,
          ymin: coordSystem.ymin,
          ymax: coordSystem.ymax,
        }
        loading.value = false
      }
      // eslint-disable-next-line no-undef
      state.applet = new GGBApplet(params, true)
      state.applet.inject(elementId.value)
    })
    .catch((error) => {
      console.error('Failed to load GeoGebra script:', error)
    })
}

const adjustCoordSystem = (viewWidth, viewHeight, coordSystem) => {
  // 解析原始的坐标系统值
  let xmin = eval(coordSystem['xmin'])
  let xmax = eval(coordSystem['xmax'])
  let ymin = eval(coordSystem['ymin'])
  let ymax = eval(coordSystem['ymax'])
  // 计算当前的 x 轴和 y 轴范围
  let x_range = xmax - xmin
  let y_range = ymax - ymin
  // 检查 viewHeight 和 y_range 防止除以零
  if (viewHeight === 0 || y_range === 0) {
    console.error('viewHeight and y_range must not be zero.')
    return coordSystem
  }
  // 计算视图的宽高比
  let aspect_ratio = viewWidth / viewHeight
  // 调整坐标范围以保持形状不变形
  if (x_range / y_range < aspect_ratio) {
    // x 轴过短，需要增加 x 轴范围
    let new_x_range = y_range * aspect_ratio
    let x_center = (xmin + xmax) / 2
    xmin = x_center - new_x_range / 2
    xmax = x_center + new_x_range / 2
  } else if (x_range / y_range > aspect_ratio) {
    // x 轴过长，需要增加 y 轴范围
    let new_y_range = x_range / aspect_ratio
    let y_center = (ymin + ymax) / 2
    ymin = y_center - new_y_range / 2
    ymax = y_center + new_y_range / 2
  }
  // 返回调整后的坐标系
  return {
    xmin: xmin.toString(),
    xmax: xmax.toString(),
    ymin: ymin.toString(),
    ymax: ymax.toString(),
  }
}

onMounted(() => {
  initGraph()
})

onUnmounted(() => {
  if (state.api && state.api.remove) {
    state.api.remove()
  }
})
</script>

<template>
  <div class="graph-content">
    <div v-if="loading || answerStatus === 1" class="graph-loading">
      <div class="loading-container">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
      <p class="loading-text">{{ $t('graph_is_loading') }}</p>
    </div>
    <div
      v-if="answerStatus === 0"
      :style="{ display: loading ? 'none' : 'block' }"
    >
      <p v-if="!fullScreen" class="graph-title text-neutral-1">Graph</p>
      <p v-if="!fullScreen" class="graph-latex flex items-center gap-4">
        Plotting
        <span
          v-for="item in jsonData.latex_expressions || []"
          :key="item"
          class="text-neutral-1"
        >
          <LatexFormat :text="item" />
        </span>
      </p>
      <div class="graph-view">
        <div :id="elementId" class="tex-view-graph"></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.graph-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 16px auto;
  .graph-loading {
    .loading-text {
      margin-top: 20px;
      text-align: center;
      color: #555;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 150%; /* 21px */
    }
    @keyframes changeColor {
      0%,
      100% {
        background-color: #0078ff;
      }
      33% {
        background-color: #bcd5fd;
      }
      66% {
        background-color: #bcd5fd;
      }
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .loading-dot {
      width: 10px;
      height: 10px;
      margin: 0 5px;
      border-radius: 50%;
      background-color: #333;
      animation: changeColor 1s infinite ease-in-out both;
    }

    .loading-dot:nth-child(1) {
      animation-delay: 0s;
    }
    .loading-dot:nth-child(2) {
      animation-delay: 0.3s;
    }
    .loading-dot:nth-child(3) {
      animation-delay: 0.6s;
    }
  }
  .graph-title {
    display: flex;
    align-items: center;
    gap: 20px;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: 150%; /* 24px */
    svg {
      cursor: pointer;
    }
  }
  .graph-latex {
    margin-top: 4px;
    color: #999;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 400;
    line-height: 150%; /* 24px */
  }
  .graph-view {
    position: relative;
    margin: 12px 0;
    :deep(canvas) {
      box-sizing: border-box;
      border: 1px solid #ccc;
    }
    .tool-bar {
      display: flex;
      flex-direction: column;
      gap: 24px;
      position: absolute;
      left: 312px;
      top: 0;
      user-select: none;
      svg {
        cursor: pointer;
      }
      .top-btn {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 16px;
        width: 32px;
        height: 72px;
        border-radius: 2px;
        border: 1px solid #ccc;
        background: #fff;
      }
      .bottom-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 2px;
        border: 1px solid #ccc;
        background: #fff;
      }
    }
  }
  .view-on-full-screen {
    margin: 12px 0;
    width: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: #007aff;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 400;
    line-height: 150%; /* 24px */
    cursor: pointer;
  }
}
</style>
