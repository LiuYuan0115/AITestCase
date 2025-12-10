import { ref, onMounted, onUnmounted } from 'vue'
import SidepanelEventType from '@/entrypoints/sidepanel/types/eventTypes'
import { QuestionType } from '@/entrypoints/sidepanel/types/question'
import { useSetting } from '@/composables/content/useSetting'
import trackEvent from '@/utils/trackEvent'
import { ThrottledTrackEvent } from '@/utils/throttledTrackEvent'

const TOOLBAR_WIDTH = 400
const TOOLBAR_HEIGHT = 36

const MAX_TEXT_LENGTH = 2000
const MIN_QUIZ_TEXT_LENGTH = 20
const MAX_QUIZ_TEXT_LENGTH = 100000

export function usePdfTextSelection() {
  // 是否显示工具栏
  const shouldShow = ref(false)
  // 选中的文本
  const selectionText = ref('')
  // 选中的文本位置
  const selectionPosition = ref({ x: 0, y: 0, width: 0, height: 0 })
  // 悬浮栏位置计算结果
  const toolbarPosition = ref({ left: '0px', top: '0px' })
  // 全局开关响应式
  const { isEnable, closeInThisPage, closeInGlobal } =
    useSetting('text-selection')
  // 记录上一次rect缓存，避免重复刷新
  let lastRect = { x: 0, y: 0, width: 0, height: 0 }

  // 记录是否已经上报过展示埋点，避免重复上报
  let hasTrackedShow = false

  // 计算悬浮栏位置
  const calculateToolbarPosition = () => {
    const { x, y, width, height } = selectionPosition.value
    // 获取当前视口尺寸
    const currentWindowWidth = window.innerWidth
    const currentWindowHeight = window.innerHeight
    // 计算居中位置
    let left = x + width / 2 - TOOLBAR_WIDTH / 2 + window.scrollX
    let top = y + height + 8 + window.scrollY // 8px 间距

    // 判断下方空间是否足够
    const bottomSpace = currentWindowHeight - (y + height)
    if (bottomSpace < TOOLBAR_HEIGHT + 16) {
      // 增加一点余量
      // 下方空间不足，显示在上方
      top = y - TOOLBAR_HEIGHT - 8 + window.scrollY
      // 防止超出顶部
      if (top < 8 + window.scrollY) {
        top = 8 + window.scrollY
      }
    }

    // 边界处理 - 确保不超出视口
    left = Math.max(
      8 + window.scrollX,
      Math.min(left, currentWindowWidth - TOOLBAR_WIDTH - 8 + window.scrollX)
    )

    toolbarPosition.value = {
      left: `${left}px`,
      top: `${top}px`,
    }
  }

  // 当窗口大小变化时重新计算选区位置和悬浮栏位置
  const handleWindowResize = () => {
    if (shouldShow.value) {
      // 重新获取当前选区位置
      try {
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()

          if (rect && selection.toString().trim()) {
            // 只有rect真正变化时才刷新
            if (
              rect.left !== lastRect.x ||
              rect.top !== lastRect.y ||
              rect.width !== lastRect.width ||
              rect.height !== lastRect.height
            ) {
              selectionPosition.value = {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
              }
              calculateToolbarPosition()
              lastRect = {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
              }
            }
          }
        }
      } catch (error) {
        // 如果获取选区失败，隐藏工具栏
        hideToolbar()
      }
    }
  }

  // 监听鼠标抬起事件，只在划词时计算一次位置
  const handleMouseUp = () => {
    try {
      // 每次划词都用响应式的isEnable判断
      // 现在改成永不关闭
      // if (!isEnable.value) {
      //   hideToolbar()
      //   return
      // }
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        hideToolbar()
        return
      }
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (!rect || !selection.toString().trim()) {
        hideToolbar()
        return
      }
      selectionText.value = selection.toString()
      selectionPosition.value = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }
      // 计算悬浮栏位置
      calculateToolbarPosition()
      shouldShow.value = true
      
      // 埋点：划词工具栏展示（24小时内只上报一次）
      if (!hasTrackedShow) {
        ThrottledTrackEvent.track('Plugin_Quickaction_Show')
        hasTrackedShow = true
      }
    } catch (error) {
      console.error('PDF划词工具栏显示错误:', error)
      hideToolbar()
    }
  }

  // 隐藏划词工具栏
  function hideToolbar() {
    shouldShow.value = false
    selectionText.value = ''
    // 重置埋点标记，下次显示时可以重新上报
    hasTrackedShow = false
  }

  // 监听 selection 变化（选区消失时自动隐藏工具栏）
  const handleSelectionChange = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      hideToolbar()
    }
  }

  // 监听 Esc 键（快捷关闭工具栏）
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideToolbar()
    }
  }

  // 划词搜题通信逻辑
  function solveSelection() {
    if (!selectionText.value) return

    // 埋点
    trackEvent.track('Plugin_Quickaction_Solve', {
      text: selectionText.value,
      from: 'pdf',
    })

    // 限制文本长度0-2000
    const text = selectionText.value.slice(0, MAX_TEXT_LENGTH)
    chrome.runtime.sendMessage({
      type: SidepanelEventType.SOLVE_FROM_CONTENT,
      data: {
        content: text,
        type: QuestionType.TEXT_SOLVE,
        source: 'pdf-viewer',
      },
    })
    hideToolbar()
  }

  // 划词 summarize 逻辑
  function summarizeSelection() {
    if (!selectionText.value) return

    // 埋点
    trackEvent.track('Plugin_Quickaction_Summarize', {
      text: selectionText.value,
      from: 'pdf',
    })

    // 限制文本长度0-2000
    const text = selectionText.value.slice(0, MAX_TEXT_LENGTH)
    chrome.runtime.sendMessage({
      type: SidepanelEventType.GENERATE_SUMMARIZE_FROM_SELECTION,
      data: {
        content: text,
        url: window.location.href,
        source: 'pdf-viewer',
      },
    })
    hideToolbar()
  }

  // 划词 quiz 逻辑
  function quizSelection() {
    if (!selectionText.value) return

    // 埋点
    trackEvent.track('Plugin_Quickaction_Quiz', {
      text: selectionText.value,
      from: 'pdf',
    })

    const text = selectionText.value

    // 只有在超过限制时才进行slice操作，节省性能
    const content =
      text.length > MAX_QUIZ_TEXT_LENGTH
        ? text.slice(0, MAX_QUIZ_TEXT_LENGTH)
        : text

    // 统一的消息数据结构
    const messageData = {
      type: SidepanelEventType.GENERATE_QUIZ_FROM_SELECTION,
      data: {
        content,
        url: window.location.href,
        source: 'pdf-viewer',
      },
    }

    chrome.runtime.sendMessage(messageData)
    hideToolbar()
  }

  // 处理Explain按钮点击，使用高性能PDF上下文提取
  const explainSelection = async () => {
    if (!selectionText.value) return

    console.log(
      '🚀 ===== PDF高性能Explain开始 =====,当前时间是',
      `${new Date().toLocaleString()}:${new Date()
        .getMilliseconds()
        .toString()
        .padStart(3, '0')}`
    )

    // 埋点（新增 Quickaction 埋点 + 保留 PDFpage 埋点）
    trackEvent.track('Plugin_Quickaction_Explain', {
      selectionLength: selectionText.value.length,
      from: 'pdf',
    })

    try {
      // 获取PDF文档实例
      const pdfDocument =
        (window as any).pdfDocument || (globalThis as any).pdfDocument

      if (!pdfDocument) {
        console.error('PDF文档未找到，请确保在PDF查看器组件内使用')
        return
      }

      // 获取当前页码（假设选中文本在当前显示页）
      const currentPageNum =
        (window as any).currentPage || (globalThis as any).currentPage || 1

      console.log('🚀 ===== PDF高性能Explain开始 =====')
      console.log(`📄 PDF文档信息:`, {
        numPages: pdfDocument.numPages,
        currentPage: currentPageNum,
        selectedTextLength: selectionText.value.length,
      })

      // 使用新的高性能PDF上下文提取工具
      const { extractPdfContext } = await import('@/utils/pdfContextExtractor')
      const result = await extractPdfContext(
        selectionText.value,
        currentPageNum,
        pdfDocument,
        {
          initialPageRange: 2, // 当前页 ± 2页
          maxLength: 8000, // 8k限制
        }
      )

      console.log(
        '🚀 ===== PDF高性能Explain完成 =====,当前时间是',
        `${new Date().toLocaleString()}:${new Date()
          .getMilliseconds()
          .toString()
          .padStart(3, '0')}`
      )

      console.log('✅ PDF上下文提取结果:', {
        pageRange: `${result.pageRange.start}-${result.pageRange.end}`,
        extractedLength: result.finalLength,
        foundSelection: result.foundSelection,
        reductionRatio:
          pdfDocument.numPages > 5
            ? `约 ${Math.round(
                ((result.pageRange.end - result.pageRange.start + 1) /
                  pdfDocument.numPages) *
                  100
              )}% 页面`
            : '全文档',
      })

      // 发送消息到侧边栏，走转发流程
      const messageData = {
        type: SidepanelEventType.GENERATE_EXPLAIN_FROM_SELECTION,
        data: {
          totalText: result.extractedText, // 直接使用提取的上下文
          selectedText: selectionText.value,
          content: result.extractedText, // 已经是智能截取后的内容
          url: window.location.href,
          source: 'pdf-viewer',
          pageRange: result.pageRange, // 额外信息：使用的页面范围
          from: 'pdf',
        },
      }

      console.log(
        '📤 发送消息到侧边栏,当前时间是',
        `${new Date().toLocaleString()}:${new Date()
          .getMilliseconds()
          .toString()
          .padStart(3, '0')}`
      )

      chrome.runtime.sendMessage(messageData)
      hideToolbar()
    } catch (error) {
      console.error('❌ PDF高性能上下文提取失败:', error)
      hideToolbar()
    }
  }

  // 处理Chat按钮点击，使用高性能PDF上下文提取
  const chatSelection = async () => {
    if (!selectionText.value) return

    // 埋点（新增 Quickaction 埋点 + 保留 PDFpage 埋点）
    trackEvent.track('Plugin_Quickaction_Chat', {
      selectionLength: selectionText.value.length,
      from: 'pdf',
    })

    try {
      // 获取PDF文档实例
      const pdfDocument =
        (window as any).pdfDocument || (globalThis as any).pdfDocument

      if (!pdfDocument) {
        console.error('PDF文档未找到，请确保在PDF查看器组件内使用')
        return
      }

      // 获取当前页码（假设选中文本在当前显示页）
      const currentPageNum =
        (window as any).currentPage || (globalThis as any).currentPage || 1

      console.log('🚀 ===== PDF高性能Chat开始 =====')
      console.log(`📄 PDF文档信息:`, {
        numPages: pdfDocument.numPages,
        currentPage: currentPageNum,
        selectedTextLength: selectionText.value.length,
      })

      // 使用新的高性能PDF上下文提取工具
      const { extractPdfContext } = await import('@/utils/pdfContextExtractor')
      const result = await extractPdfContext(
        selectionText.value,
        currentPageNum,
        pdfDocument,
        {
          initialPageRange: 2, // 当前页 ± 2页
          maxLength: 8000, // 8k限制
        }
      )

      console.log('✅ PDF上下文提取结果:', {
        pageRange: `${result.pageRange.start}-${result.pageRange.end}`,
        extractedLength: result.finalLength,
        foundSelection: result.foundSelection,
        reductionRatio:
          pdfDocument.numPages > 5
            ? `约 ${Math.round(
                ((result.pageRange.end - result.pageRange.start + 1) /
                  pdfDocument.numPages) *
                  100
              )}% 页面`
            : '全文档',
      })

      // 发送消息到侧边栏，走转发流程
      const messageData = {
        type: SidepanelEventType.GENERATE_CHAT_FROM_SELECTION,
        data: {
          totalText: result.extractedText, // 直接使用提取的上下文
          selectedText: selectionText.value,
          content: result.extractedText, // 已经是智能截取后的内容
          url: window.location.href,
          source: 'pdf-viewer',
          pageRange: result.pageRange, // 额外信息：使用的页面范围
          from: 'pdf',
        },
      }

      console.log('📤 发送消息到侧边栏')
      chrome.runtime.sendMessage(messageData)
      hideToolbar()

      console.log('✅ ===== PDF高性能Chat完成 =====')
    } catch (error) {
      console.error('❌ PDF高性能上下文提取失败:', error)
      hideToolbar()
    }
  }

  // 关闭划词工具栏 - 现在由组件处理modal显示
  function handleClose() {
    hideToolbar()
  }

  onMounted(() => {
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleWindowResize)
  })

  onUnmounted(() => {
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('selectionchange', handleSelectionChange)
    document.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('resize', handleWindowResize)
  })

  return {
    shouldShow,
    selectionText,
    selectionPosition,
    toolbarPosition,
    solveSelection,
    summarizeSelection,
    quizSelection,
    explainSelection,
    chatSelection,
    hideToolbar,
    handleClose,
    // isEnable,
    closeInThisPage,
    closeInGlobal,
  }
}
