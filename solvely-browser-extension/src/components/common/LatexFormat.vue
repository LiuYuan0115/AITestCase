<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useLatexSandbox } from '~/composables/content/useLatexSandbox'
import emitter from '@/utils/eventBus'
import trackEvent from '@/utils/trackEvent'
import GeoRender from '@/entrypoints/sidepanel/components/solvingMessage/AnswerInfo/GeoRender.vue'

const props = defineProps({
  text: {
    type: String,
    default: '',
  },
})

const latexHtml = ref('')
const lastRenderTime = ref(0)
const pendingText = ref('')
const isRendering = ref(false)
const lastProcessedText = ref('')
const graphData = ref(null)
const { parseLatex } = useLatexSandbox()
let renderTimer = null

// 解析 graph 标签
const extractGraphData = (text) => {
  const graphRegex = /<graph>(.*?)<\/graph>/
  const match = text.match(graphRegex)

  if (match) {
    try {
      const graphJson = match[1]
      const data = JSON.parse(graphJson)
      graphData.value = data
      // 移除 graph 标签内容，只保留其他文本
      console.log('graphData', graphData.value)
      return text.replace(graphRegex, '')
    } catch (error) {
      console.error('解析 graph 数据失败:', error)
      return text
    }
  }

  return text
}

// 处理数学公式文本
const processMathText = (text) => {
  if (!text) return ''

  // 先提取 graph 数据
  text = extractGraphData(text)

  let processedText = text.replace(/\n---\n/g, '\n\n')
  const regex = /\\\[(.*?)\\\]/gs
  processedText = processedText.replace(regex, (match, p1) => {
    return `\\[${p1.replace(/\n/g, ' ')}\\]`
  })
  return processedText
}

// 处理MathML输出 - 强制修改display属性
const adjustMathJaxSize = (html) => {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  // // 调整 MathJax 元素大小
  // const mathJaxElements = tempDiv.querySelectorAll('.MathJax')
  // mathJaxElements.forEach((mathJaxElement) => {
  //   const svgElement = mathJaxElement.querySelector('svg')
  //   if (svgElement) {
  //     // 获取当前尺寸并调整
  //     let currentWidth = parseFloat(svgElement.getAttribute('width'))
  //     let currentHeight = parseFloat(svgElement.getAttribute('height'))

  //     let newWidth = currentWidth * 0.9 + 'ex'
  //     let newHeight = currentHeight * 0.9 + 'ex'

  //     svgElement.setAttribute('width', newWidth)
  //     svgElement.setAttribute('height', newHeight)

  //     // 调整垂直对齐
  //     let currentVerticalAlign = parseFloat(svgElement.style.verticalAlign || 0)
  //     svgElement.style.verticalAlign =
  //       currentVerticalAlign + currentHeight * 0.2 + 'ex'
  //   }
  // })

  // 找到所有隐藏的MathML标签并显示它们
  const hiddenMathmlTags = tempDiv.querySelectorAll(
    'mathml[style*="display: none"]'
  )
  hiddenMathmlTags.forEach((mathmlTag) => {
    // 只移除隐藏样式，让Mathpix原生样式生效
    mathmlTag.style.display = ''
  })

  // 强制修改MathML的display属性
  const blockMathElements = tempDiv.querySelectorAll('math[display="block"]')
  blockMathElements.forEach((mathElement) => {
    // 强制设置为inline，让它变成行内显示
    mathElement.setAttribute('display', 'inline-block')
  })

  // 为数学公式添加语义信息
  const mathContainers = tempDiv.querySelectorAll('.math-inline, .math-block')
  mathContainers.forEach((container) => {
    const latexElement = container.querySelector('latex')
    const mathElement = container.querySelector('math')
    
    if (latexElement && mathElement) {
      const latexText = latexElement.textContent || ''
      // 只在math标签上添加LaTeX源码，用于后续渲染
      mathElement.setAttribute('data-latex', latexText)
    }
  })

  return tempDiv.innerHTML
}

// 内部渲染函数
const renderMath = async (text) => {
  if (!text) return ''

  try {
    const processedText = processMathText(text)
    const result = await parseLatex(processedText)
    return adjustMathJaxSize(result.data)
  } catch (error) {
    console.error('LaTeX渲染失败:', error)
    // 上报 renderMath 运行失败
    trackEvent.track('Plugin_renderMath_error', {
      text,
      processedText,
      error,
    })
    return text
  }
}

// 改进后的节流渲染方案
const throttledRender = async () => {
  if (isRendering.value) return

  // 检查是否有新内容需要处理
  if (pendingText.value === lastProcessedText.value) {
    renderTimer = null
    return
  }

  const now = Date.now()
  // 控制渲染频率，中间状态最多300ms渲染一次
  if (now - lastRenderTime.value < 300 && renderTimer) return

  isRendering.value = true
  const textToRender = pendingText.value
  lastProcessedText.value = textToRender // 记录此次处理的文本
  lastRenderTime.value = now

  try {
    const result = await renderMath(textToRender)
    if (result) {
      latexHtml.value = result
    }
  } catch (error) {
    console.error('render Math 运行失败:', error)
  } finally {
    isRendering.value = false

    // 检查是否有新的文本需要渲染（与已处理文本不同）, 为了保证最后一次的内容一定要被渲染
    if (pendingText.value !== lastProcessedText.value) {
      renderTimer = setTimeout(() => {
        throttledRender()
      }, Math.max(0, 300 - (Date.now() - lastRenderTime.value)))
    } else {
      renderTimer = null
    }
  }
}

// watch逻辑
watch(
  () => props.text,
  (newText) => {
    if (!newText) {
      latexHtml.value = ''
      pendingText.value = ''
      lastProcessedText.value = ''
      clearTimeout(renderTimer)
      renderTimer = null
      return
    }

    pendingText.value = newText

    // 如果没有渲染正在进行，立即开始渲染
    if (!isRendering.value && !renderTimer) {
      throttledRender()
    }
    // 如果上一次渲染已经超过1秒，也立即开始新的渲染
    else if (Date.now() - lastRenderTime.value > 1000) {
      clearTimeout(renderTimer)
      throttledRender()
    }
    // 如果当前值与上次处理的值不同且超过3秒没更新，强制更新一次
    else if (
      pendingText.value !== lastProcessedText.value &&
      Date.now() - lastRenderTime.value > 3000
    ) {
      clearTimeout(renderTimer)
      throttledRender()
    }
    // 其它情况让定时器等待合适的时间开始下一次渲染
  },
  { immediate: true }
)

// 这个 done 的消息会延迟 15 秒收到
const checkRenderResult = async (data) => {
  const { questionId, cdnUrl } = data

  // 延迟 10 秒后检查渲染结果
  await new Promise((resolve) => setTimeout(resolve, 1000 * 10))

  const trackParams = {
    text: props.text,
    latexHtml: latexHtml.value,
    questionId,
    cdnUrl,
  }

  // 记录检查结果
  // console.log('[checkRenderResult] 检查渲染结果: ', trackParams)

  // 检查是否有文本但渲染结果为空
  if (props.text.trim() && !latexHtml.value.trim()) {
    // 说明渲染失败, 上报
    trackEvent.track('Plugin_Solve_Render_Error', trackParams)
  }
}

onMounted(() => {
  emitter.on('solve:done', checkRenderResult)
})

// 确保组件卸载时清理定时器
onUnmounted(() => {
  emitter.off('solve:done', checkRenderResult)
  clearTimeout(renderTimer)
})
</script>

<template>
  <div v-if="text">
    <div class="markdown-answer-content" v-html="latexHtml"></div>
    <GeoRender v-if="graphData" :graph-data="graphData" />
  </div>
</template>

<style scoped lang="less">
.markdown-answer-content {  
  @font-family: Inter;
  @base-font-size: 14px;
  @line-height-base: 130%;

  :deep(ul),
  :deep(ol) {
    padding-left: 22px;
    font-family: @font-family;
    font-size: @base-font-size;
  }

  :deep(li) {
    display: list-item;
    font-family: @font-family;
    font-size: @base-font-size;
  }
  :deep(ul > li) {
    list-style-type: disc;
  }

  :deep(ol > li) {
    list-style-type: decimal;
  }
  :deep(table) {
    margin: 1em auto;
  }

  div {
    line-height: @line-height-base;
    font-family: @font-family;
    font-size: @base-font-size;
  }

  :deep(mjx-container[jax='SVG'][display='true']) {
    margin: 7px 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  :deep(.math-block) {
    display: block;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 0 4px 0;
  }

  // 增大MathML元素的字体大小
  :deep(math) {
    font-size: 1.15em !important;
  }

  :deep(#preview) {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden !important;
    padding: 0 0 4px 0;
  }

  :deep(#setText > div) {
    margin-bottom: 7px;
  }

  :deep(#setText > table) {
    display: block;
  }

  :deep(#setText li) {
    margin-bottom: 7px;
  }

  :deep(h1) {
    font-weight: 900 !important;
  }

  :deep(h2) {
    font-weight: 900 !important;
  }

  :deep(h3) {
    font-weight: 900 !important;
  }

  :deep(h4) {
    font-weight: 900 !important;
  }

  :deep(code) {
    @apply dark:!bg-s-border-secondary-dark transition-colors duration-200;
    @apply text-s-text-high-emphasis dark:!text-s-text-high-emphasis-dark;
  }

  :deep(table) {
    @apply dark:!bg-s-interface-bg-dark transition-colors duration-200;
    @apply text-s-text-high-emphasis;
  }
}
</style>
