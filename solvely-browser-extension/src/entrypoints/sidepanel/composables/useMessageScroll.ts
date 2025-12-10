import { ref, onUnmounted, nextTick } from 'vue'

export interface MessageScrollState {
  hasScrolled: boolean
  updateCount: number
  lastScrollTime: number
  contentLength: number
  scrollTimer: NodeJS.Timeout | null
  isUserInterrupted: boolean
}

export function useMessageScroll(messageId: string) {
  const scrollState = ref<MessageScrollState>({
    hasScrolled: false,
    updateCount: 0,
    lastScrollTime: 0,
    contentLength: 0,
    scrollTimer: null,
    isUserInterrupted: false
  })

  // 🔧 修复：存储监听器清理函数，避免内存泄漏
  let cleanupListener: (() => void) | null = null

  // 获取消息容器引用
  const getMessageContainer = () => {
    return document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement
  }

  // 获取滚动容器
  const getScrollContainer = () => {
    return document.querySelector('.overflow-y-auto') as HTMLElement
  }

  // 滚动到消息顶部
  const scrollToMessageTop = () => {
    const messageElement = getMessageContainer()
    const scrollContainer = getScrollContainer()
    if (!messageElement || !scrollContainer) return

    scrollContainer.scrollTo({
      top: Math.max(0, messageElement.offsetTop),
      behavior: 'smooth'
    })
  }

  // 检测用户是否干预了滚动
  const detectUserInterruption = () => {
    const scrollContainer = getScrollContainer()
    if (!scrollContainer) return
    
    // 🔧 修复：先清理旧的监听器，避免重复添加
    if (cleanupListener) {
      cleanupListener()
      cleanupListener = null
    }
    
    const handleUserScroll = () => {
      if (scrollState.value.scrollTimer) {
        clearTimeout(scrollState.value.scrollTimer)
        scrollState.value.scrollTimer = null
      }
      scrollState.value.isUserInterrupted = true
      scrollContainer.removeEventListener('wheel', handleUserWheel)
      // 🔧 修复：清理后重置清理函数引用
      cleanupListener = null
    }
    const handleUserWheel = () => {
      handleUserScroll()
    }
    scrollContainer.addEventListener('wheel', handleUserWheel)
    
    // 🔧 修复：存储清理函数，确保可以在组件卸载时清理
    cleanupListener = () => {
      scrollContainer.removeEventListener('wheel', handleUserWheel)
    }
  }

  // 智能滚动函数
  const smartScroll = async () => {
    await nextTick()
    
    const messageElement = getMessageContainer()
    if (!messageElement) return

    const currentLength = messageElement.textContent?.length || 0
    const now = Date.now()

    // 如果用户已经干预过，不再滚动
    if (scrollState.value.isUserInterrupted) {
      console.log(`消息 ${messageId} 用户已干预，停止滚动`)
      return
    }

    // 判断是否需要滚动
    const shouldScroll = 
      !scrollState.value.hasScrolled || // 从未滚动过
      (scrollState.value.updateCount === 0 && currentLength - scrollState.value.contentLength > 100) || // 第一次更新且内容显著增加
      (now - scrollState.value.lastScrollTime > 3000); // 距离上次滚动超过3秒

    if (!shouldScroll) {
      // 更新状态但不滚动
      scrollState.value.updateCount++
      scrollState.value.contentLength = currentLength
      return
    }
    // 执行滚动
    scrollState.value.hasScrolled = true
    scrollState.value.updateCount++
    scrollState.value.lastScrollTime = now
    scrollState.value.contentLength = currentLength

    // 立即滚动到消息顶部
    scrollToMessageTop()

    // 设置1秒后再次滚动的定时器
    if (scrollState.value.scrollTimer) {
      clearTimeout(scrollState.value.scrollTimer)
    }

    scrollState.value.scrollTimer = setTimeout(() => {
      if (!scrollState.value.isUserInterrupted) {
        scrollToMessageTop()
      }
    }, 1000)

    // 检测用户干预
    detectUserInterruption()
  }

  // 清理函数
  const cleanup = () => {
    // 🔧 修复：清理定时器
    if (scrollState.value.scrollTimer) {
      clearTimeout(scrollState.value.scrollTimer)
      scrollState.value.scrollTimer = null
    }
    // 🔧 修复：清理事件监听器，避免内存泄漏
    if (cleanupListener) {
      cleanupListener()
      cleanupListener = null
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    cleanup()
  })

  return {
    smartScroll,
    cleanup,
    scrollState
  }
} 