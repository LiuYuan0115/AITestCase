import { ref, onUnmounted } from 'vue'

/**
 * 可拖拽功能的 composable
 * 按下即可拖拽，提供流畅的拖拽体验
 * 通过回调函数方式让外部控制事件监听
 */
export function useToolbarDraggable() {
  // 本次拖拽的位置偏移
  const dragOffset = ref({ x: 0, y: 0 })
  // 拖拽状态
  const isDragging = ref(false)
  // 拖拽开始时的鼠标位置
  let dragStartMousePos = { x: 0, y: 0 }
  // 拖拽开始时的偏移位置
  let dragStartOffset = { x: 0, y: 0 }

  /**
   * 处理鼠标移动事件（私有方法）
   */
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return

    // 计算鼠标移动的距离
    const deltaX = e.clientX - dragStartMousePos.x
    const deltaY = e.clientY - dragStartMousePos.y

    // 基于拖拽开始时的偏移量，叠加鼠标移动距离
    dragOffset.value = {
      x: dragStartOffset.x + deltaX,
      y: dragStartOffset.y + deltaY,
    }
  }

  /**
   * 处理鼠标释放事件（私有方法）
   */
  const onMouseUp = () => {
    isDragging.value = false
    
    // 移除文档级别的监听器
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  /**
   * 处理拖拽手柄的 mousedown 事件
   */
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 记录鼠标按下时的位置（相对于视口）
    dragStartMousePos = { x: e.clientX, y: e.clientY }
    // 记录当前的偏移量
    dragStartOffset = { x: dragOffset.value.x, y: dragOffset.value.y }

    // 启动拖拽
    isDragging.value = true
    
    // 添加文档级别的监听器（确保鼠标移出元素时仍能拖拽）
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  /**
   * 重置拖拽偏移量
   */
  const resetOffset = () => {
    dragOffset.value = { x: 0, y: 0 }
  }

  // 组件卸载时清理事件监听器
  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    // 状态
    dragOffset,
    isDragging,

    // 方法
    handleMouseDown,
    resetOffset,
  }
}

