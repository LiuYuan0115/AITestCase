import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface Position {
  x: number
  y: number
  z?: number
}

interface UseDragOptions {
  initialPosition?: Position
  boundToWindow?: boolean
}

/**
 * 拖拽组件
 * @param elementRef 被拖拽的元素
 * @param options 选项
 * @param options.initialPosition 初始位置
 * @param options.boundToWindow 是否绑定到窗口, 不可超出窗口范围
 */
export function useDrag(elementRef: Ref<HTMLElement | null>, options: UseDragOptions = {}) {
  // 默认位置
  const position = ref<Position>(options.initialPosition || { x: 100, y: 20, z: 30000000 })
  
  // 拖拽状态变量
  let isDragging = false
  let startX = 0
  let startY = 0
  let startPosX = 0
  let startPosY = 0

  // 开始拖拽
  const startDrag = (e: MouseEvent) => {
    isDragging = true
    startX = e.clientX
    startY = e.clientY
    startPosX = position.value.x
    startPosY = position.value.y
  }

  // 拖拽过程
  const doDrag = (e: MouseEvent) => {
    if (!isDragging) return

    const newX = startPosX - (e.clientX - startX)
    const newY = startPosY + (e.clientY - startY)

    if (options.boundToWindow) {
      updatePositionWithinWindow(newX, newY)
    } else {
      position.value.x = newX
      position.value.y = newY
    }
  }

  // 结束拖拽
  const stopDrag = () => {
    isDragging = false
  }

  // 确保元素在窗口范围内
  const updatePositionWithinWindow = (newX: number, newY: number) => {
    if (!elementRef.value) return

    const elementRect = elementRef.value.getBoundingClientRect()
    const maxX = document.documentElement.clientWidth - elementRect.width
    const maxY = window.innerHeight - elementRect.height

    position.value.x = Math.min(Math.max(0, newX), maxX)
    position.value.y = Math.min(Math.max(0, newY), maxY)
  }

  // 检查并更新当前位置，确保面板在视窗内
  const checkAndUpdatePosition = () => {
    if (options.boundToWindow) {
      updatePositionWithinWindow(position.value.x, position.value.y)
    }
  }

  // 处理窗口大小变化
  const handleResize = () => checkAndUpdatePosition()

  onMounted(() => {
    // 添加全局事件监听
    document.addEventListener('mousemove', doDrag)
    document.addEventListener('mouseup', stopDrag)
    
    if (options.boundToWindow) {
      window.addEventListener('resize', handleResize)
      // 初始化位置
      checkAndUpdatePosition()
    }
  })

  onUnmounted(() => {
    // 移除全局事件监听
    document.removeEventListener('mousemove', doDrag)
    document.removeEventListener('mouseup', stopDrag)
    
    if (options.boundToWindow) {
      window.removeEventListener('resize', handleResize)
    }
  })

  return {
    position,
    startDrag,
    checkAndUpdatePosition
  }
} 