import { ref, onMounted, onUnmounted } from 'vue'
import { debounce } from 'lodash-es'
import type { LayerUploadResult } from '@/utils/layerImageUploader'

// 单例实例（模块级别，只创建一次）
let instance: ReturnType<typeof createSolveLayerInstance> | null = null

/**
 * 创建浮窗实例
 */
function createSolveLayerInstance() {
  // ==================== 基础状态 ====================
  const layerVisible = ref(false)
  const position = ref({ left: '0px', top: '0px' })
  const layerType = ref('Solve')
  const isPinned = ref(false)
  const isShowExample = ref(false)
  const layerData = ref<{
    selectionText: string
    userInput: string
    base64: string  
    fullText: string
    uploadPromise?: Promise<LayerUploadResult>  // 新增
  }>({
    selectionText: '',
    userInput: '',
    base64: '',
    fullText: '',
  })
  const isSuspended = ref(false) // 是否被临时挂起（截图中）
  const refreshKey = ref(0) // 刷新 key，用于强制重新挂载组件
  
  // ==================== 拖拽相关状态 ====================
  const dragOffset = ref({ x: 0, y: 0 })
  const isDragging = ref(false)
  let dragStartMousePos = { x: 0, y: 0 }
  let dragStartOffset = { x: 0, y: 0 }
  
  // ==================== 尺寸管理 ====================
  // 浮窗尺寸：宽度固定 400px，最小高度 300px
  const layerSize = ref({ width: 400, height: 300 })
  // 高度锁：首次达到 500px 时锁定
  const isHeightLocked = ref(false)
  const lockedHeight = ref<number | null>(null)
  
  // ==================== 事件监听管理 ====================
  let isEventListenersInitialized = false

  /**
   * 计算约束后的位置（纯函数）
   * @param left - 原始 left 位置
   * @param top - 原始 top 位置  
   * @param width - 浮窗宽度
   * @param height - 浮窗高度
   * @param rightPadding - 右侧边距（默认 20px）
   * @returns 约束后的位置
   */
  const constrainToViewport = (
    left: number,
    top: number,
    width: number,
    height: number,
    rightPadding: number = 20
  ): { left: number; top: number } => {
    const vw = window.innerWidth
    const vh = window.innerHeight

    // 水平方向约束 - 只有右侧有边距
    if (left < 0) {
      // 超出左边，设置为0
      left = 0
    } else if (left + width > vw - rightPadding) {
      // 超出右边，保持右侧边距
      left = Math.max(0, vw - width - rightPadding)
    }

    // 垂直方向约束 - 上下都没有边距
    if (top < 0) {
      // 超出上边，设置为0
      top = 0
    } else if (top + height > vh) {
      // 超出下边，设置为最大可能位置
      top = Math.max(0, vh - height)
    }

    return { left, top }
  }

  /**
   * 应用约束到当前位置
   * 统一的约束入口，在四个时机调用：
   * 1. 初始显示时（showLayer 中使用 fallback 尺寸）
   * 2. 尺寸变化时（updateLayerSize）
   * 3. 拖拽结束时（handleDragEnd）
   * 4. 窗口大小变化时（handleResize）
   */
  const applyConstraint = () => {
    // 只在浮窗可见时约束
    if (!layerVisible.value) return

    const currentLeft = parseFloat(position.value.left)
    const currentTop = parseFloat(position.value.top)
    
    const constrained = constrainToViewport(
      currentLeft,
      currentTop,
      layerSize.value.width,
      layerSize.value.height,
      20 // 右侧边距 20px
    )
    
    position.value = {
      left: `${constrained.left}px`,
      top: `${constrained.top}px`,
    }
  }

  /**
   * 处理窗口大小变化（防抖处理）
   * 使用 lodash debounce，300ms 内只执行最后一次
   */
  const handleResize = debounce(() => {
    if (layerVisible.value) {
      console.log('[SolveLayer] 窗口大小变化，重新约束位置')
      applyConstraint()
    }
  }, 300)

  /**
   * 更新浮窗尺寸（由组件调用）
   * 时机2: 任何尺寸变化都触发约束
   */
  const updateLayerSize = (width: number, height: number) => {
    layerSize.value = { width, height }
    
    // 尺寸变化时统一应用约束
    applyConstraint()
  }

  /**
   * 当高度首次达到阈值（500px）时锁定高度
   */
  const maybeLockHeight = (currentHeight: number) => {
    if (!isHeightLocked.value && currentHeight >= 500) {
      isHeightLocked.value = true
      lockedHeight.value = 500
    }
  }

  /** 解除高度锁 */
  const unlockHeightLock = () => {
    console.log('[useSolveLayer] 🔓 Unlocking height lock')
    isHeightLocked.value = false
    lockedHeight.value = null
  }

  /**
   * 开始拖拽
   */
  const handleDragStart = (e: MouseEvent) => {
    // 记录鼠标按下时的位置（相对于视口）
    dragStartMousePos = { x: e.clientX, y: e.clientY }
    // 记录当前的偏移量
    dragStartOffset = { x: dragOffset.value.x, y: dragOffset.value.y }

    // 启动拖拽
    isDragging.value = true
  }

  /**
   * 拖拽移动（由组件的 document 监听器调用）
   */
  const handleDragMove = (e: MouseEvent) => {
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
   * 拖拽结束（由组件的 document 监听器调用）
   * 时机3: 拖拽结束后约束
   */
  const handleDragEnd = () => {
    if (!isDragging.value) return
    
    isDragging.value = false

    // 1. 合并拖拽偏移到 position
    const leftValue = parseFloat(position.value.left) + dragOffset.value.x
    const topValue = parseFloat(position.value.top) + dragOffset.value.y

    // 2. 更新 position（不约束）
    position.value = {
      left: `${leftValue}px`,
      top: `${topValue}px`,
    }

    // 3. 重置拖拽偏移
    dragOffset.value = { x: 0, y: 0 }
    
    // 4. 应用约束
    applyConstraint()
  }

  /**
   * 处理 Pin/Unpin
   */
  const handlePin = () => {
    if (!isPinned.value) {
      // 合并拖拽偏移
      const leftValue = parseFloat(position.value.left) + dragOffset.value.x
      const topValue = parseFloat(position.value.top) + dragOffset.value.y

      // 更新 position
      position.value = {
        left: `${leftValue}px`,
        top: `${topValue}px`,
      }

      // 重置拖拽偏移
      dragOffset.value = { x: 0, y: 0 }
      
      // 应用约束
      applyConstraint()
    }

    // 切换 pin 状态
    isPinned.value = !isPinned.value
  }

  /**
   * 显示浮窗
   * 时机1: 初始显示时使用 fallback 尺寸进行约束
   */
  const showLayer = (
    type: string = 'Solve', 
    customPosition?: { left: string; top: string },
    data?: { selectionText?: string; userInput?: string; base64?: string; fullText?: string },
    uploadPromise?: Promise<LayerUploadResult>  // 新增参数
  ) => {
    // 显示前解除高度锁（满足解锁条件 1）
    unlockHeightLock()
    layerType.value = type
    
    // 重置 isShowExample（显示普通 layer 时，不是 example）
    isShowExample.value = false
    console.log('[useSolveLayer] isShowExample 重置为:', isShowExample.value)
    
    // 保存数据
    if (data) {
      layerData.value = {
        selectionText: data.selectionText || '',
        userInput: data.userInput || '',
        base64: data.base64 || '',
        fullText: data.fullText || '',
        uploadPromise  // 新增：存储上传 Promise
      }
    }
    
    // 增加 refreshKey，强制重新挂载组件（即使是 pin 状态）
    refreshKey.value++
    
    // 重置 layerSize 为初始值（非 pin 状态下）
    if (!isPinned.value) {
      layerSize.value = { width: 400, height: 300 }
    }
    
    // 未 pin 才更新位置
    if (!isPinned.value && customPosition) {
      // 将 absolute 位置转换为 fixed 位置
      const leftValue = parseFloat(customPosition.left) - window.scrollX
      const topValue = parseFloat(customPosition.top) - window.scrollY
      
      // 使用初始尺寸 (400x300) 进行初步约束
      const constrained = constrainToViewport(
        leftValue,
        topValue,
        400,  // 固定使用初始宽度
        300,  // 固定使用初始最小高度
        20 // 右侧边距
      )
      
      position.value = {
        left: `${constrained.left}px`,
        top: `${constrained.top}px`,
      }
    }
    
    layerVisible.value = true
    
    // 注意：显示后，组件 onMounted 会调用 updateLayerSize
    // updateLayerSize 会用真实高度重新约束一次
  }

  /**
   * 隐藏浮窗，看需求是否需要每次隐藏就重置（目前看起来没要）
   */
  const hideLayer = () => {
    layerVisible.value = false
  }

  /**
   * 挂起 solveLayer（临时隐藏，用于截图）
   * 只在 layerVisible=true 时生效
   */
  const suspend = () => {
    if (layerVisible.value) {
      isSuspended.value = true
    }
  }

  /**
   * 恢复 solveLayer 显示
   */
  const resume = () => {
    isSuspended.value = false
  }

  /**
   * 显示示例题目
   */
  const showExample = (customPosition?: { left: string; top: string }) => {
    showLayer('Solve', customPosition, undefined, undefined)
    isShowExample.value = true
  }

  /**
   * 重置浮窗状态（登出时调用）
   */
  const resetLayer = () => {
    console.log('[useSolveLayer] 🔄 Resetting layer state on logout')
    // 隐藏浮窗
    layerVisible.value = false
    // 重置位置
    position.value = { left: '0px', top: '0px' }
    // 重置 pin 状态
    isPinned.value = false
    // 重置数据
    layerData.value = {
      selectionText: '',
      userInput: '',
      base64: '',
      fullText: '',
    }
    // 重置高度锁
    unlockHeightLock()
    // 重置拖拽状态
    dragOffset.value = { x: 0, y: 0 }
    isDragging.value = false
    // 重置尺寸
    layerSize.value = { width: 400, height: 300 }
    // 重置挂起状态
    isSuspended.value = false
    // 重置示例状态
    isShowExample.value = false
    // 重置 refreshKey
    refreshKey.value = 0
  }

  // ==================== 全局事件监听 ====================
  
  // 监听 ESC 键关闭浮窗
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && layerVisible.value && !isPinned.value) hideLayer()
  }

  // 监听点击外部区域关闭浮窗
  const handleDocumentClick = (e: MouseEvent) => {
    if (!layerVisible.value || isPinned.value) return
    const target = e.target as HTMLElement
    if (target.tagName === 'SOLVELY-TEXT-SELECTION') return
    hideLayer()
  }

  // 初始化事件监听
  const initEventListeners = () => {
    if (!isEventListenersInitialized) {
      onMounted(() => {
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('mousedown', handleDocumentClick)
        // 监听窗口大小变化
        window.addEventListener('resize', handleResize)
        
        // 手动截图生命周期（3个入口收敛）
        window.addEventListener('solvely-screenshot-suspend', suspend)
        window.addEventListener('solvely-screenshot-resume', resume)
        
        // 整页截图生命周期（Solve All）
        window.addEventListener('solvely-page-screenshot-suspend', suspend)
        window.addEventListener('solvely-page-screenshot-resume', resume)
        
        isEventListenersInitialized = true
      })

      onUnmounted(() => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('mousedown', handleDocumentClick)
        window.removeEventListener('resize', handleResize)
        
        // 清理防抖函数
        handleResize.cancel()
        
        window.removeEventListener('solvely-screenshot-suspend', suspend)
        window.removeEventListener('solvely-screenshot-resume', resume)
        window.removeEventListener('solvely-page-screenshot-suspend', suspend)
        window.removeEventListener('solvely-page-screenshot-resume', resume)
        
        isEventListenersInitialized = false
      })
    }
  }

  return {
    // 基础状态
    layerVisible,
    position,
    layerType,
    isPinned,
    isShowExample,
    layerData,
    isSuspended,
    refreshKey,
    
    // 拖拽状态
    dragOffset,
    isDragging,
    
    // 基础方法
    showLayer,
    hideLayer,
    suspend,
    resume,
    showExample,
    resetLayer,
    
    // 拖拽方法
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    
    // Pin 方法
    handlePin,
    
    // 尺寸管理
    updateLayerSize,
    isHeightLocked,
    lockedHeight,
    maybeLockHeight,
    unlockHeightLock,
    
    // 事件监听
    initEventListeners,
  }
}

/**
 * 浮窗管理 composable（单例模式）
 */
export default function useSolveLayer() {
  // 第一次调用时创建实例
  if (!instance) {
    instance = createSolveLayerInstance()
  }

  // 初始化事件监听
  instance.initEventListeners()

  // 始终返回同一个实例
  return instance
}
