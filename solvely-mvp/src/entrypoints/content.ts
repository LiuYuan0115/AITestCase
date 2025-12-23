import { convertDOMToMarkdown } from '@/utils/page'

type ScrollTarget =
  | { type: 'window'; el: null; originalTop: number }
  | { type: 'element'; el: HTMLElement; originalTop: number }

const SCROLLBAR_STYLE_ID = '__mvp_scrollbar_style__'
const SNAPSHOT_KEY = '__mvp_pre_screenshot__'

let scrollTarget: ScrollTarget | null = null
let overlayEl: HTMLDivElement | null = null
let isPrepared = false
let scrollbarMarkedEls: HTMLElement[] = []
let injectedButton: HTMLButtonElement | null = null

function ensureOverlay() {
  if (overlayEl) return
  overlayEl = document.createElement('div')
  overlayEl.style.position = 'fixed'
  overlayEl.style.inset = '0'
  overlayEl.style.pointerEvents = 'none'
  overlayEl.style.borderLeft = '3px solid #007AFF'
  overlayEl.style.borderRight = '3px solid #007AFF'
  overlayEl.style.zIndex = '2147483647'
  overlayEl.style.display = 'none'
  document.body.appendChild(overlayEl)
}

function showOverlay() {
  ensureOverlay()
  if (overlayEl) overlayEl.style.display = 'block'
}

function hideOverlay() {
  if (overlayEl) overlayEl.style.display = 'none'
}

function isScrollableElement(el: HTMLElement) {
  const style = window.getComputedStyle(el)
  const overflowY = style.overflowY
  if (!(overflowY === 'auto' || overflowY === 'scroll')) return false
  if (style.position === 'fixed') return false
  if (style.opacity === '0' || style.pointerEvents === 'none') return false
  if (el.scrollHeight <= el.clientHeight) return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false
  return true
}

function detectAndCacheScrollTarget() {
  const docEl = document.documentElement
  if (docEl.scrollHeight > window.innerHeight) {
    scrollTarget = {
      type: 'window',
      el: null,
      originalTop: window.scrollY,
    }
    return
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('body, body *')).filter((el) =>
    isScrollableElement(el)
  )

  if (candidates.length === 0) {
    scrollTarget = {
      type: 'window',
      el: null,
      originalTop: window.scrollY,
    }
    return
  }

  const filtered: Array<{ el: HTMLElement; rect: DOMRect }> = []
  for (const el of candidates) {
    const rect = el.getBoundingClientRect()
    const widthRatio = rect.width / window.innerWidth
    const heightRatio = rect.height / window.innerHeight
    const pixelOk = rect.width >= 480 && rect.height >= 320
    const ratioOk = widthRatio >= 0.6 && heightRatio >= 0.6
    if (pixelOk || ratioOk) filtered.push({ el, rect })
  }

  const pool = filtered.length > 0 ? filtered : candidates.map((el) => ({ el, rect: el.getBoundingClientRect() }))

  const getDepth = (el: HTMLElement) => {
    let d = 0
    let cur: Node | null = el
    while (cur && cur !== document.body) {
      d++
      cur = (cur as HTMLElement).parentElement
    }
    return d
  }

  let best: { el: HTMLElement; score: number; depth: number } | null = null
  for (const { el, rect } of pool) {
    const interH = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
    const interW = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
    const interArea = interW * interH
    const widthRatio = rect.width / window.innerWidth
    const heightRatio = rect.height / window.innerHeight
    const boost = widthRatio >= 0.6 && heightRatio >= 0.6 ? 2 : 1
    const depth = getDepth(el)
    const score = interArea * boost
    if (!best || score > best.score || (score === best.score && depth < best.depth)) {
      best = { el, score, depth }
    }
  }

  if (best) {
    scrollTarget = {
      type: 'element',
      el: best.el,
      originalTop: best.el.scrollTop,
    }
  } else {
    scrollTarget = {
      type: 'window',
      el: null,
      originalTop: window.scrollY,
    }
  }
}

function getScrollInfo() {
  if (!scrollTarget) detectAndCacheScrollTarget()
  const innerWidthCss = window.innerWidth
  const devicePixelRatio = window.devicePixelRatio || 1

  if (!scrollTarget || scrollTarget.type === 'window') {
    const totalHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    )
    const viewportHeight = window.innerHeight
    const currentScrollY = window.scrollY
    const scrollSteps = Math.ceil(totalHeight / viewportHeight)
    return {
      totalHeight,
      viewportHeight,
      currentScrollY,
      scrollSteps,
      targetType: 'window',
      innerWidthCss,
      devicePixelRatio,
      containerRectCss: null,
    }
  }

  const el = scrollTarget.el
  if (!document.body.contains(el) || el.scrollHeight <= el.clientHeight) {
    scrollTarget = null
    return getScrollInfo()
  }
  const rect = el.getBoundingClientRect()
  const totalHeight = el.scrollHeight
  const viewportHeight = el.clientHeight
  const currentScrollY = el.scrollTop
  const scrollSteps = Math.ceil(totalHeight / viewportHeight)
  return {
    totalHeight,
    viewportHeight,
    currentScrollY,
    scrollSteps,
    targetType: 'element',
    innerWidthCss,
    devicePixelRatio,
    containerRectCss: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
  }
}

function scrollToPositionInternal(position: number) {
  if (!scrollTarget) detectAndCacheScrollTarget()
  if (!scrollTarget) return false
  if (scrollTarget.type === 'window') {
    window.scrollTo(0, position)
    return true
  }
  const el = scrollTarget.el
  if (!document.body.contains(el)) {
    scrollTarget = null
    detectAndCacheScrollTarget()
    if (scrollTarget?.type === 'element' && scrollTarget.el) {
      scrollTarget.el.scrollTo(0, position)
    } else {
      window.scrollTo(0, position)
    }
    return true
  }
  el.scrollTo(0, position)
  return true
}

function restoreScrollInternal(originalPosition: number) {
  if (!scrollTarget) detectAndCacheScrollTarget()
  if (!scrollTarget) return false
  if (scrollTarget.type === 'window') {
    window.scrollTo(0, originalPosition)
    return true
  }
  const el = scrollTarget.el
  if (!document.body.contains(el)) return false
  el.scrollTo(0, originalPosition)
  return true
}

function clearScrollTargetCache() {
  scrollTarget = null
}

function hideScrollbars(targets: HTMLElement[]) {
  let styleEl = document.getElementById(SCROLLBAR_STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = SCROLLBAR_STYLE_ID
    styleEl.type = 'text/css'
    styleEl.appendChild(
      document.createTextNode(`
        [data-mvp-scrolltarget]::-webkit-scrollbar { background: transparent !important; }
        [data-mvp-scrolltarget]::-webkit-scrollbar-thumb { background: transparent !important; }
        [data-mvp-scrolltarget]::-webkit-scrollbar-track { background: transparent !important; }
        [data-mvp-scrolltarget] { scrollbar-color: transparent transparent !important; }
      `)
    )
    document.head.appendChild(styleEl)
  }

  targets.forEach((el) => {
    if (!el.hasAttribute('data-mvp-scrolltarget')) {
      el.setAttribute('data-mvp-scrolltarget', '1')
      scrollbarMarkedEls.push(el)
    }
  })
}

function restoreScrollbars() {
  const styleEl = document.getElementById(SCROLLBAR_STYLE_ID)
  if (styleEl?.parentNode) styleEl.parentNode.removeChild(styleEl)
  if (scrollbarMarkedEls.length) {
    scrollbarMarkedEls.forEach((el) => el.removeAttribute('data-mvp-scrolltarget'))
    scrollbarMarkedEls = []
  }
}

function preparePageForScreenshot(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    try {
      if (injectedButton) {
        injectedButton.dataset.prevOpacity = injectedButton.style.opacity || ''
        injectedButton.style.opacity = '0'
      }
      showOverlay()

      const all = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      const fixed: HTMLElement[] = []
      const sticky: HTMLElement[] = []

      for (const el of all) {
        const style = window.getComputedStyle(el)
        if (style.position === 'fixed') {
          const topPx = parseFloat(style.top || '')
          const bottomPx = parseFloat(style.bottom || '')
          const isTopZero = !Number.isNaN(topPx) && Math.abs(topPx) <= 0.5
          const isBottomZero = !Number.isNaN(bottomPx) && Math.abs(bottomPx) <= 0.5
          if (isTopZero || isBottomZero) {
            const rect = el.getBoundingClientRect()
            const viewportArea = window.innerWidth * window.innerHeight
            const elementArea = Math.max(0, rect.width) * Math.max(0, rect.height)
            const coverage = viewportArea > 0 ? elementArea / viewportArea : 0
            if (coverage <= 0.5) fixed.push(el)
          }
        }
        if (style.position === 'sticky') sticky.push(el)
      }

      const snapshotElement = (el: HTMLElement) => {
        if (!(SNAPSHOT_KEY in el)) {
          ;(el as any)[SNAPSHOT_KEY] = {
            opacity: el.style.opacity,
            pointerEvents: el.style.pointerEvents,
            position: el.style.position,
            top: el.style.top,
            bottom: el.style.bottom,
            zIndex: el.style.zIndex,
            transform: el.style.transform,
          }
        }
      }

      fixed.forEach((el) => {
        snapshotElement(el)
        el.style.setProperty('opacity', '0', 'important')
        el.style.setProperty('pointer-events', 'none', 'important')
      })

      sticky.forEach((el) => {
        snapshotElement(el)
        el.style.setProperty('position', 'static', 'important')
        el.style.setProperty('top', 'auto', 'important')
        el.style.setProperty('bottom', 'auto', 'important')
        el.style.setProperty('z-index', 'auto', 'important')
        el.style.setProperty('transform', 'none', 'important')
      })

      detectAndCacheScrollTarget()

      try {
        const targets =
          scrollTarget?.type === 'element' && scrollTarget.el
            ? [scrollTarget.el]
            : [document.documentElement, document.body]
        hideScrollbars(targets)
      } catch {}

      isPrepared = true
      setTimeout(() => {
        resolve({ success: true })
      }, 50)
    } catch (error) {
      console.error('preparePageForScreenshot failed', error)
      resolve({ success: false })
    }
  })
}

function restorePageAfterScreenshot(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    try {
      const all = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      for (const el of all) {
        const snapshot = (el as any)[SNAPSHOT_KEY]
        if (!snapshot) continue
        if (snapshot.opacity !== undefined) el.style.opacity = snapshot.opacity
        if (snapshot.pointerEvents !== undefined) el.style.pointerEvents = snapshot.pointerEvents
        if (snapshot.position !== undefined) el.style.position = snapshot.position
        if (snapshot.top !== undefined) el.style.top = snapshot.top
        if (snapshot.bottom !== undefined) el.style.bottom = snapshot.bottom
        if (snapshot.zIndex !== undefined) el.style.zIndex = snapshot.zIndex
        if (snapshot.transform !== undefined) el.style.transform = snapshot.transform
        delete (el as any)[SNAPSHOT_KEY]
      }
      hideOverlay()
      if (injectedButton) {
        injectedButton.style.opacity = injectedButton.dataset.prevOpacity || ''
      }
      restoreScrollbars()
      clearScrollTargetCache()
      isPrepared = false
      resolve({ success: true })
    } catch (error) {
      console.error('restorePageAfterScreenshot failed', error)
      resolve({ success: false })
    }
  })
}

// Content Script Message Listener
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('Solvely MVP Content Script Active')

    // 1. Inject Floating Button
    const button = document.createElement('button')
    button.innerText = '🦄'
    button.style.position = 'fixed'
    button.style.top = '50%'
    button.style.right = '0'
    // button.style.transform = 'translateY(-50%)' // Removed to simplify drag calculation, will handle centering manually or just let it be
    button.style.marginTop = '-25px' // Approximate centering adjustment if we rely on top: 50%
    
    button.style.zIndex = '2147483647'
    // Fixed size styling
    button.style.width = '40px'
    button.style.height = '50px'
    button.style.padding = '0'
    button.style.display = 'flex'
    button.style.alignItems = 'center'
    button.style.justifyContent = 'center'
    
    button.style.backgroundColor = '#646cff'
    button.style.color = 'white'
    button.style.border = 'none'
    button.style.borderTopLeftRadius = '8px'
    button.style.borderBottomLeftRadius = '8px'
    button.style.cursor = 'grab' // Indicate draggable
    button.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)'
    button.style.fontFamily = 'system-ui, sans-serif'
    button.style.fontSize = '20px'
    button.style.userSelect = 'none'

    // Drag Logic
    let isDragging = false
    let startY = 0
    let startTop = 0
    let hasMoved = false

    button.addEventListener('mousedown', (e) => {
      isDragging = true
      hasMoved = false
      startY = e.clientY
      
      // Convert current computed position to absolute pixel top
      const rect = button.getBoundingClientRect()
      button.style.top = `${rect.top}px`
      button.style.marginTop = '0' // Remove centering offset once we take manual control
      button.style.bottom = 'auto'
      
      startTop = rect.top
      button.style.cursor = 'grabbing'
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      const deltaY = e.clientY - startY
      if (Math.abs(deltaY) > 2) hasMoved = true
      
      let newTop = startTop + deltaY
      // Keep within viewport
      const maxTop = window.innerHeight - button.offsetHeight
      newTop = Math.max(0, Math.min(newTop, maxTop))
      
      button.style.top = `${newTop}px`
    })

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false
        button.style.cursor = 'grab'
      }
    })

    button.onclick = () => {
      if (hasMoved) {
        console.log('Button dragged, ignoring click')
        return
      }
      console.log('Button clicked, requesting sidepanel open')
      browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })
    }

    document.body.appendChild(button)
    injectedButton = button
    ensureOverlay()

    // Listen for messages
    browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
      if (message.type === 'GET_DOM') {
        const result = convertDOMToMarkdown(document.body, { 
            checkSelectors: true, 
            onlyInViewport: message.onlyInViewport || false 
        })
        
        sendResponse({
            markdown: result.markdown,
            images: [] // No longer extracting images from DOM
        });
        return false;
      }


      if (message.type === 'GET_PAGE_SCROLL_INFO') {
        const info = getScrollInfo()
        sendResponse(info)
        return false
      }

      if (message.type === 'SCROLL_TO_POSITION') {
        const success = scrollToPositionInternal(message.position)
        sendResponse({ success })
        return false
      }

      if (message.type === 'RESTORE_SCROLL_POSITION') {
        const success = restoreScrollInternal(message.originalPosition)
        sendResponse({ success })
        return false
      }

      if (message.type === 'PREPARE_PAGE_FOR_SCREENSHOT') {
        preparePageForScreenshot().then(sendResponse)
        return true
      }

      if (message.type === 'RESTORE_PAGE_AFTER_SCREENSHOT') {
        restorePageAfterScreenshot().then(sendResponse)
        return true
      }

      // ==================== 自动滚动提取（解决懒加载问题）====================
      if (message.type === 'SCROLL_AND_EXTRACT') {
        (async () => {
          try {
            // 配置项
            const SCROLL_STEP = message.scrollStep || 600;        // 每次滚动的像素
            const DELAY_PER_SCROLL = message.delayPerScroll || 150; // 滚动后的等待时间 (ms)
            const MAX_SCROLL_ATTEMPTS = message.maxScrollAttempts || 80; // 最大滚动次数
            const SETTLE_TIME = message.settleTime || 800;        // 滚动到底后的稳定时间
            
            console.log('[SCROLL_AND_EXTRACT] 开始自动滚动提取', {
              SCROLL_STEP, DELAY_PER_SCROLL, MAX_SCROLL_ATTEMPTS
            });
            
            // 辅助函数：等待
            const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            
            // 获取当前滚动高度的函数
            const getScrollHeight = () => {
              return Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight
              );
            };
            
            // 获取当前滚动位置
            const getScrollPosition = () => window.scrollY + window.innerHeight;
            
            // 1. 检测滚动容器（可能是 body 或特定元素）
            let scrollContainerEl: HTMLElement | null = null;
            
            const feishuContainers = [
              '.page-main', '.docx-container', '.article-content', 
              '.notion-page-content', '[class*="scroll"]', 'main', 'article'
            ];
            
            for (const selector of feishuContainers) {
              const el = document.querySelector<HTMLElement>(selector);
              if (el && el.scrollHeight > el.clientHeight + 100) {
                scrollContainerEl = el;
                console.log(`[SCROLL_AND_EXTRACT] 检测到滚动容器: ${selector}`);
                break;
              }
            }
            
            // 2. 执行自动滚动
            let attempts = 0;
            let stableCount = 0;
            
            while (attempts < MAX_SCROLL_ATTEMPTS) {
              if (scrollContainerEl) {
                scrollContainerEl.scrollBy({ top: SCROLL_STEP, behavior: 'auto' });
              } else {
                window.scrollBy({ top: SCROLL_STEP, behavior: 'auto' });
              }
              
              await wait(DELAY_PER_SCROLL);
              
              const currentHeight = scrollContainerEl ? scrollContainerEl.scrollHeight : getScrollHeight();
              const scrolledAmount = scrollContainerEl ? scrollContainerEl.scrollTop + scrollContainerEl.clientHeight : getScrollPosition();
              const isAtBottom = scrolledAmount >= currentHeight - 50;
              
              if (isAtBottom) {
                await wait(300);
                const newHeight = scrollContainerEl ? scrollContainerEl.scrollHeight : getScrollHeight();
                if (newHeight === currentHeight) {
                  stableCount++;
                  if (stableCount >= 2) break;
                } else {
                  stableCount = 0;
                }
              } else {
                stableCount = 0;
              }
              attempts++;
            }
            
            await wait(SETTLE_TIME);
            
            if (message.scrollBackToTop !== false) {
              if (scrollContainerEl) {
                scrollContainerEl.scrollTo({ top: 0, behavior: 'auto' });
              } else {
                window.scrollTo({ top: 0, behavior: 'auto' });
              }
              await wait(200);
            }
            
            // 5. 执行提取
            const result = convertDOMToMarkdown(document.body, { 
              checkSelectors: true, 
              onlyInViewport: false 
            });
            
            sendResponse({
              success: true,
              markdown: result.markdown,
              images: [], // No images per new policy
              scrollAttempts: attempts
            });
            
          } catch (err: any) {
            console.error('[SCROLL_AND_EXTRACT] 错误:', err);
            sendResponse({
              success: false,
              error: err.message || String(err),
              markdown: '',
              images: []
            });
          }
        })();
        
        return true; // 异步响应
      }

      return false
    })
  },
})
