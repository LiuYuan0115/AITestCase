import { ref, onMounted, onUnmounted } from 'vue'
import { debounce } from 'lodash-es'

// 单例状态 - 确保所有组件使用同一个实例
const selectionText = ref('')
const selectionPosition = ref({ x: 0, y: 0, width: 0, height: 0 })
const hasSelection = ref(false)
let isInitialized = false

/**
 * 选区管理 composable（单例模式）
 * 负责监听和管理页面文本选区状态
 */
export function useSelection() {
  // 更新选区信息
  const updateSelection = () => {
    try {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        clearSelection()
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const text = selection.toString().trim()

      if (!rect || !text) {
        clearSelection()
        return
      }

      selectionText.value = text
      selectionPosition.value = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }
      hasSelection.value = true
    } catch (error) {
      console.error('更新选区失败:', error)
      clearSelection()
    }
  }

  // 清除选区信息
  const clearSelection = () => {
    selectionText.value = ''
    selectionPosition.value = { x: 0, y: 0, width: 0, height: 0 }
    hasSelection.value = false
  }

  // 监听鼠标抬起事件
  const handleMouseUp = () => {
    updateSelection()
  }

  // 监听选区变化
  const handleSelectionChange = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      clearSelection()
    }
  }

  // 防抖处理选区变化
  const debouncedHandleSelectionChange = debounce(handleSelectionChange, 100)

  // 监听窗口大小变化
  const handleWindowResize = () => {
    if (hasSelection.value) {
      updateSelection()
    }
  }

  // 防抖处理窗口大小变化
  const debouncedHandleResize = debounce(handleWindowResize, 200)

  // 只在第一次调用时初始化事件监听
  if (!isInitialized) {
    onMounted(() => {
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('selectionchange', debouncedHandleSelectionChange)
      window.addEventListener('resize', debouncedHandleResize)
      console.log('[useSelection] 事件监听已初始化')
    })

    onUnmounted(() => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('selectionchange', debouncedHandleSelectionChange)
      window.removeEventListener('resize', debouncedHandleResize)

      debouncedHandleSelectionChange.cancel()
      debouncedHandleResize.cancel()

      isInitialized = false
      console.log('[useSelection] 事件监听已清理')
    })

    isInitialized = true
  }

  return {
    selectionText,
    selectionPosition,
    hasSelection,
    updateSelection,
    clearSelection,
  }
}
