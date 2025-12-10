import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { useSetting } from '@/composables/content/useSetting'
import { modalService } from '@/services/modal/closeModalService'
import trackEvent from '@/utils/trackEvent'
import { ThrottledTrackEvent } from '@/utils/throttledTrackEvent'
import { QuestionType } from '@/entrypoints/sidepanel/types/question'
import { textSelectionDisabledSiteManager } from '~/utils/disabledSites'
import { STORAGE_KEY } from '~/config'

const TOOLBAR_WIDTH = 425
const TOOLBAR_HEIGHT = 36

const MAX_TEXT_LENGTH = 2000
const MIN_QUIZ_TEXT_LENGTH = 20
const MAX_QUIZ_TEXT_LENGTH = 100000

/**
 * 获取页面全量文本（使用 Readability 提取）
 * 用于提供 8k 上下文
 */
export const getPageFullText = async (): Promise<string> => {
  try {
    const htmlContent = document.documentElement.outerHTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')

    let totalText = ''
    
    if (window.location.href.includes('khanacademy')) {
      // Khan Academy 特殊处理
      totalText = doc.body?.textContent || ''
    } else {
      try {
        const { Readability } = await import('@mozilla/readability')
        const reader = new Readability(doc)
        const parsedArticle = reader.parse()
        totalText = parsedArticle?.textContent || ''
      } catch (importError) {
        // 降级到原生方法
        totalText = doc.body?.textContent || ''
      }
    }
    
    return totalText.trim()
  } catch (error) {
    console.error('Failed to get page full text:', error)
    return ''
  }
}

/**
 * 获取页面 8k 窗口文本（使用 use8kCheck 智能截取）
 * @param selectedText 选中的文本，用于定位 8k 窗口的中心位置
 * @returns 8k 窗口文本
 */
export const get8kText = async (selectedText: string): Promise<string> => {
  try {
    // 获取全量文本
    const fullText = await getPageFullText()
    
    if (!fullText) {
      return ''
    }
    
    // 使用 use8kCheck 截取 8k 窗口
    try {
      const { use8kCheck } = await import('@/utils/use8kCheck')
      return use8kCheck(fullText, selectedText, 8000)
    } catch (error) {
      console.error('use8kCheck 导入失败:', error)
      // 降级：直接返回前 8k 字符
      return fullText.slice(0, 8000)
    }
  } catch (error) {
    console.error('Failed to get 8k text:', error)
    return ''
  }
}

/**
 * 约束 Toolbar 位置到当前视口范围
 * 确保 Toolbar 在用户当前可见的视口内
 * 
 * 注意：Toolbar 使用 absolute 定位，位置是文档坐标
 * 
 * @param documentLeft - 文档坐标 left
 * @param documentTop - 文档坐标 top
 * @param padding - 边距（默认 20px）
 * @returns 约束后的文档坐标
 */
const constrainToolbarToViewport = (
  documentLeft: number,
  documentTop: number,
  padding: number = 20
): { left: number; top: number } => {
  // 获取当前视口信息
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  
  // 计算当前可见区域在文档中的范围
  // 这是用户能看到的区域在整个文档中的绝对位置
  const visibleLeft = scrollX + padding
  const visibleRight = scrollX + vw - TOOLBAR_WIDTH - padding
  const visibleTop = scrollY + padding
  const visibleBottom = scrollY + vh - TOOLBAR_HEIGHT - padding
  
  // 直接在文档坐标系下约束（约束在可见区域内）
  let left = documentLeft
  let top = documentTop
  
  // 水平方向约束
  if (left + TOOLBAR_WIDTH <= visibleLeft) {
    // 完全超出左边（Toolbar 完全在可见区域左侧）
    left = visibleLeft
  } else if (left >= visibleRight + TOOLBAR_WIDTH) {
    // 完全超出右边（Toolbar 完全在可见区域右侧）
    left = Math.max(visibleLeft, visibleRight)
  } else {
    // 部分可见或完全可见
    left = Math.max(visibleLeft, Math.min(left, visibleRight))
  }
  
  // 垂直方向约束
  if (top + TOOLBAR_HEIGHT <= visibleTop) {
    // 完全超出上边（Toolbar 完全在可见区域上方）
    top = visibleTop
  } else if (top >= visibleBottom + TOOLBAR_HEIGHT) {
    // 完全超出下边（Toolbar 完全在可见区域下方）
    top = Math.max(visibleTop, visibleBottom)
  } else {
    // 部分可见或完全可见
    top = Math.max(visibleTop, Math.min(top, visibleBottom))
  }
  
  return { left, top }
}

export function useTextSelection(
  selectionText: Ref<string>,
  selectionPosition: Ref<{ x: number; y: number; width: number; height: number }>,
  hasSelection: Ref<boolean>,
  toolbarPreference: Ref<'top' | 'bottom'>
) {
  
  // 是否显示工具栏
  const shouldShow = ref(false)
  // 悬浮栏位置计算结果
  const toolbarPosition = ref({ left: '0px', top: '0px' })
  // 用户是否手动拖拽过（拖拽后不再自动重新计算位置）
  const hasManuallyDragged = ref(false)
  // 全局开关响应式
  const { isEnable, closeInThisPage, closeInGlobal } = useSetting('text-selection')

  // 划词禁用站点检查状态
  const isTextSelectionSiteDisabled = ref(false)

  // 记录是否已经上报过展示埋点，避免重复上报
  let hasTrackedShow = false

  // 清理函数引用
  const cleanupUrlListener = ref<(() => void) | null>(null)

  // 检查当前页面是否被划词禁用
  const checkTextSelectionSiteDisabled = async () => {
    try {
      const currentUrl = window.location.href
      const disabled = await textSelectionDisabledSiteManager.isSiteDisabledAsync(currentUrl)
      isTextSelectionSiteDisabled.value = disabled
      console.log(`[TextSelection] 当前页面划词禁用状态: ${disabled}`)
    } catch (error) {
      console.error('[TextSelection] 检查划词禁用状态失败:', error)
      isTextSelectionSiteDisabled.value = false
    }
  }

  // 监听地址栏 URL 变化
  const handleUrlChange = () => {
    console.log('[TextSelection] 地址栏变化，重新检查划词禁用状态')
    checkTextSelectionSiteDisabled()
  }

  // 设置地址栏变化监听器
  const setupUrlChangeListener = () => {
    let currentUrl = window.location.href

    // ===== 第一层：popstate 事件监听 =====
    // 监听浏览器前进/后退按钮和传统页面跳转
    window.addEventListener('popstate', handleUrlChange)

    // ===== 第二层：pushState/replaceState 拦截 =====
    // 拦截 SPA 应用的路由变化，适用于现代单页应用
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    // 拦截 pushState 方法（SPA 路由跳转）
    history.pushState = function (...args) {
      originalPushState.apply(history, args)
      // 延迟检查，确保 URL 已更新
      setTimeout(handleUrlChange, 0)
    }

    // 拦截 replaceState 方法（SPA 路由替换）
    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args)
      // 延迟检查，确保 URL 已更新
      setTimeout(handleUrlChange, 0)
    }

    // ===== 第三层：MutationObserver 备用监听 =====
    // 监听 DOM 变化作为备用机制，防止前两层遗漏
    const observer = new MutationObserver(() => {
      const newUrl = window.location.href
      if (newUrl !== currentUrl) {
        currentUrl = newUrl
        handleUrlChange()
      }
    })

    // 监听整个 document 的变化
    observer.observe(document, {
      subtree: true, // 监听所有子节点变化
      childList: true, // 监听子节点增删变化
    })

    // 返回清理函数，确保组件卸载时清理所有监听器
    return () => {
      // 清理第一层：popstate 事件监听
      window.removeEventListener('popstate', handleUrlChange)
      // 清理第二层：恢复原始的 pushState/replaceState 方法
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      // 清理第三层：断开 MutationObserver 连接
      observer.disconnect()
    }
  }

  // 监听选区变化，控制工具栏显示
  watch(hasSelection, (newValue) => {
    if (newValue && isEnable.value && !isTextSelectionSiteDisabled.value) {
      // 新的选区，重置手动拖拽标记
      hasManuallyDragged.value = false
      calculateToolbarPosition()
      shouldShow.value = true
      
      // 埋点：划词工具栏展示（24小时内只上报一次）
      if (!hasTrackedShow) {
        ThrottledTrackEvent.track('Plugin_Quickaction_Show')
        hasTrackedShow = true
      }
    } else {
      hideToolbar()
    }
  })
  
  // 监听选区位置变化，重新计算工具栏位置
  // 但如果用户手动拖拽过，则不再自动重新计算（保持用户拖拽后的位置）
  watch(selectionPosition, () => {
    if (shouldShow.value && !hasManuallyDragged.value) {
      calculateToolbarPosition()
    }
  })
  
  // 计算悬浮栏位置
  const calculateToolbarPosition = () => {
    const { x, y, width, height } = selectionPosition.value
    // 获取当前视口尺寸
    const currentWindowWidth = window.innerWidth
    const currentWindowHeight = window.innerHeight
    // 计算居中位置
    let left = x + width / 2 - TOOLBAR_WIDTH / 2 + window.scrollX
    let top = 0

    // 计算上下方空间
    const topSpace = y
    const bottomSpace = currentWindowHeight - (y + height)

    // 根据偏好和空间决定位置
    if (toolbarPreference.value === 'top') {
      // 优先上方
      if (topSpace >= TOOLBAR_HEIGHT + 16) {
        // 上方空间足够，显示在上方
        top = y - TOOLBAR_HEIGHT - 8 + window.scrollY
      } else {
        // 上方空间不够，显示在下方
        top = y + height + 8 + window.scrollY
      }
    } else {
      // 优先下方（默认）
      if (bottomSpace >= TOOLBAR_HEIGHT + 16) {
        // 下方空间足够，显示在下方
        top = y + height + 8 + window.scrollY
      } else {
        // 下方空间不够，显示在上方
        top = y - TOOLBAR_HEIGHT - 8 + window.scrollY
        // 防止超出顶部
        if (top < 8 + window.scrollY) {
          top = 8 + window.scrollY
        }
      }
    }

    // 边界处理 - 确保不超出视口
    left = Math.max(8 + window.scrollX, Math.min(left, currentWindowWidth - TOOLBAR_WIDTH - 8 + window.scrollX))

    toolbarPosition.value = {
      left: `${left}px`,
      top: `${top}px`,
    }
  }

  // 隐藏划词工具栏
  function hideToolbar() {
    shouldShow.value = false
    // 重置埋点标记，下次显示时可以重新上报
    hasTrackedShow = false
    // 重置手动拖拽标记，下次显示新选区时可以自动计算位置
    hasManuallyDragged.value = false
  }

  /**
   * 处理 Toolbar 拖拽结束
   * 约束在当前视口范围内并更新偏好
   */
  const handleToolbarDragEnd = (draggedPosition: { left: string; top: string }) => {
    // 🎯 P2-2: 快捷按钮拖动埋点
    trackEvent.track('Plugin_Quickaction_Drag')
    
    // 1. 解析拖拽后的位置（文档坐标）
    const left = parseFloat(draggedPosition.left)
    const top = parseFloat(draggedPosition.top)
    
    // 2. 约束在当前视口范围内
    const constrained = constrainToolbarToViewport(left, top, 20)
    
    // 3. 更新位置
    toolbarPosition.value = {
      left: `${constrained.left}px`,
      top: `${constrained.top}px`,
    }
    
    // 4. 标记为手动拖拽（防止选区变化时重新计算位置）
    hasManuallyDragged.value = true
    
    // 5. 更新偏好（基于约束后位置与选区中心的关系）
    // 选区中心在文档中的位置
    const selectionCenterY = selectionPosition.value.y + selectionPosition.value.height / 2 + window.scrollY
    
    toolbarPreference.value = constrained.top < selectionCenterY ? 'top' : 'bottom'
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

    // 🎯 埋点已移至 textSelection/index.vue 的 handleSolve 中，避免 AB 测试导致埋点丢失

    // 限制文本长度0-2000
    // 去掉前后空格
    const text = selectionText.value.trim().slice(0, MAX_TEXT_LENGTH)
    browser.runtime.sendMessage({
      type: 'SIDEPANEL:SOLVE_FROM_CONTENT',
      data: {
        content: text,
        type: QuestionType.TEXT_SOLVE,
      },
    })
    hideToolbar()
  }

  // 划词 summarize 逻辑
  function summarizeSelection() {
    if (!selectionText.value) return

    // 🎯 埋点已移至 textSelection/index.vue 的 handleSummarize 中，避免 AB 测试导致埋点丢失

    // 限制文本长度0-2000
    const text = selectionText.value.trim().slice(0, MAX_TEXT_LENGTH)
    browser.runtime.sendMessage({
      type: 'SIDEPANEL:GENERATE_SUMMARIZE_FROM_SELECTION',
      data: {
        content: text,
        url: window.location.href,
      },
    })
    hideToolbar()
  }

  // 划词 quiz 逻辑
  function quizSelection() {
    if (!selectionText.value) return

    // 🎯 埋点已移至 textSelection/index.vue 的 handleQuiz 中，避免 AB 测试导致埋点丢失

    const text = selectionText.value

    // 只有在超过限制时才进行slice操作，节省性能
    const content = text.trim().length > MAX_QUIZ_TEXT_LENGTH ? text.trim().slice(0, MAX_QUIZ_TEXT_LENGTH) : text.trim()

    // 统一的消息数据结构
    const messageData = {
      type: 'SIDEPANEL:GENERATE_QUIZ_FROM_SELECTION',
      data: {
        content,
        url: window.location.href,
      },
    }

    browser.runtime.sendMessage(messageData)
    hideToolbar()
  }

  // 划词 chat 逻辑
  const chatSelection = async () => {
    if (!selectionText.value) return

    // 🎯 埋点已移至 textSelection/index.vue 的 handleChat 中，避免 AB 测试导致埋点丢失

    const selectedText = selectionText.value
    
    // 使用统一的方法获取 8k 窗口文本
    const windowContent = await get8kText(selectedText)

    const messageData = {
      type: 'SIDEPANEL:GENERATE_CHAT_FROM_SELECTION',
      data: {
        totalText: windowContent, // 直接使用提取的上下文
        selectedText: selectedText,
        content: windowContent, // 已经是智能截取后的内容
        url: window.location.href,
        source: 'content',
        from: 'page',
      },
    }

    browser.runtime.sendMessage(messageData)
    hideToolbar()
  }

  // 处理Explain按钮点击，抓取网页内容并使用use8kCheck获取8k窗口内容
  const explainSelection = async () => {
    if (!selectionText.value) return

    // 🎯 埋点已移至 textSelection/index.vue 的 handleExplain 中，避免 AB 测试导致埋点丢失

    const selectedText = selectionText.value
    
    // 使用统一的方法获取 8k 窗口文本
    const windowContent = await get8kText(selectedText)

    const messageData = {
      type: 'SIDEPANEL:GENERATE_EXPLAIN_FROM_SELECTION',
      data: {
        totalText: windowContent,
        selectedText: selectedText,
        url: window.location.href,
        from: 'page',
      },
    }

    browser.runtime.sendMessage(messageData)
    hideToolbar()
  }

  // 关闭划词工具栏
  function handleClose() {
    trackEvent.track('Plugin_Quickaction_Close')

    // 定义划词组件专用的关闭选项
    const textSelectionCloseOptions = [
      {
        label: 'Disable until next visit',
        value: 'next-visit',
      },
      {
        label: 'Disable on this page',
        value: 'this-page',
      },
      {
        label: 'Disable on this website',
        value: 'this-website',
      },
      {
        label: 'Disable globally',
        value: 'global',
      },
    ]

    modalService.showModal({
      title: 'Disable',
      content: 'You can re-enable in settings',
      onConfirm: async (confirmValue) => {
        if (confirmValue === 'next-visit') {
          closeInThisPage()
          hideToolbar()
        } else if (confirmValue === 'global') {
          closeInGlobal()
          hideToolbar()
        } else if (confirmValue === 'this-page') {
          // 禁用当前页面
          const currentUrl = window.location.href
          await textSelectionDisabledSiteManager.addDisabledSite(currentUrl, 'page')
          console.log(`[TextSelection] 已禁用当前页面: ${currentUrl}`)

          // 发送禁用埋点
          trackEvent.track('Plugin_Sidebar_TextSelection_Disabled', {
            type: 'page',
            url: currentUrl,
          })
          hideToolbar()
        } else if (confirmValue === 'this-website') {
          // 禁用当前网站
          const currentUrl = window.location.href
          const domain = textSelectionDisabledSiteManager.getDomainFromUrl(currentUrl)
          await textSelectionDisabledSiteManager.addDisabledSite(domain, 'website')
          console.log(`[TextSelection] 已禁用当前网站: ${domain}`)

          // 发送禁用埋点
          trackEvent.track('Plugin_Sidebar_TextSelection_Disabled', {
            type: 'website',
            url: domain,
          })
          hideToolbar()
        }
      },
      onCancel: () => {
        hideToolbar()
      },
      customOptions: textSelectionCloseOptions,
    })
  }

  onMounted(() => {
    window.addEventListener('solvely-hide-text-selection-toolbar', hideToolbar)
    document.addEventListener('keydown', handleKeyDown)

    // 初始检查划词禁用状态
    checkTextSelectionSiteDisabled()
    // 设置地址栏变化监听器
    cleanupUrlListener.value = setupUrlChangeListener()

    // 监听划词禁用站点存储变化
    browser.storage.onChanged.addListener((changes: any, area: string) => {
      if (area === 'local' && changes[STORAGE_KEY.TEXT_SELECTION_DISABLED_SITES]) {
        console.log('[TextSelection] 检测到划词禁用站点变化，重新检查')
        checkTextSelectionSiteDisabled()
      }
    })
  })

  onUnmounted(() => {
    window.removeEventListener('solvely-hide-text-selection-toolbar', hideToolbar)
    document.removeEventListener('keydown', handleKeyDown)

    // 清理地址栏变化监听器
    if (cleanupUrlListener.value) {
      cleanupUrlListener.value()
      cleanupUrlListener.value = null
    }

    // 移除存储监听器
    browser.storage.onChanged.removeListener((changes: any, area: string) => {
      if (area === 'local' && changes[STORAGE_KEY.TEXT_SELECTION_DISABLED_SITES]) {
        checkTextSelectionSiteDisabled()
      }
    })
  })

  return {
    shouldShow,
    selectionText,
    selectionPosition,
    toolbarPosition,
    solveSelection,
    summarizeSelection,
    quizSelection,
    chatSelection,
    hideToolbar,
    handleClose,
    explainSelection,
    handleToolbarDragEnd,
  }
}
