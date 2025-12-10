<template>
  <div
    v-if="isViewportBorderVisible"
    class="fixed inset-0 pointer-events-none bg-transparent border-l-[3px] border-r-[3px] border-[#007AFF] z-[2147483647]"
  ></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
const isViewportBorderVisible = ref(false)
const isPreparedForScreenshot = ref(false)
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'

const props = defineProps<{ hideFloatBtns: boolean }>()
const emit = defineEmits<{
  (e: 'update:hideFloatBtns', v: boolean): void
  (e: 'update:hideSolveLayer', v: boolean): void
}>()

type ScrollTargetCache = {
  type: 'window' | 'element'
  el: HTMLElement | null
  originalTop: number
}

let scrollTarget: ScrollTargetCache | null = null
const SCROLLBAR_STYLE_ID = '__solvely_scrollbar_style__'
let scrollbarMarkedEls: HTMLElement[] = []

function isScrollableElement(el: HTMLElement): boolean {
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

function detectAndCacheScrollTarget(): void {
  const docEl = document.documentElement
  if (docEl.scrollHeight > window.innerHeight) {
    scrollTarget = {
      type: 'window',
      el: null,
      originalTop: window.scrollY,
    }
    return
  }

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('body, body *')
  ).filter((el) => isScrollableElement(el))

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

  const pool =
    filtered.length > 0
      ? filtered
      : candidates.map((el) => ({ el, rect: el.getBoundingClientRect() }))

  const getDepth = (el: HTMLElement): number => {
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
    const interH = Math.max(
      0,
      Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
    )
    const interW = Math.max(
      0,
      Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
    )
    const interArea = interW * interH
    const widthRatio = rect.width / window.innerWidth
    const heightRatio = rect.height / window.innerHeight
    const boost = widthRatio >= 0.6 && heightRatio >= 0.6 ? 2 : 1
    const depth = getDepth(el)
    const score = interArea * boost
    if (
      !best ||
      score > best.score ||
      (score === best.score && depth < best.depth)
    ) {
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
  if (!scrollTarget) {
    return {
      totalHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      currentScrollY: window.scrollY,
      targetType: 'window',
      innerWidthCss: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
      containerRectCss: null,
    }
  }

  if (scrollTarget.type === 'window') {
    return {
      totalHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      currentScrollY: window.scrollY,
      targetType: 'window',
      innerWidthCss: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
      containerRectCss: null,
    }
  } else {
    const el = scrollTarget.el!
    if (!document.body.contains(el) || el.scrollHeight <= el.clientHeight) {
      detectAndCacheScrollTarget()
      return getScrollInfo()
    }
    const rect = el.getBoundingClientRect()
    return {
      totalHeight: el.scrollHeight,
      viewportHeight: el.clientHeight,
      currentScrollY: el.scrollTop,
      targetType: 'element',
      innerWidthCss: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
      containerRectCss: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    }
  }
}

function scrollToPositionInternal(position: number): boolean {
  if (!scrollTarget) detectAndCacheScrollTarget()
  if (!scrollTarget) return false
  if (scrollTarget.type === 'window') {
    window.scrollTo(0, position)
    return true
  }
  const el = scrollTarget.el!
  if (!document.body.contains(el)) {
    detectAndCacheScrollTarget()
    if (scrollTarget?.type === 'element' && scrollTarget.el)
      scrollTarget.el.scrollTo(0, position)
    else window.scrollTo(0, position)
    return true
  }
  el.scrollTo(0, position)
  return true
}

function restoreScrollInternal(originalPosition: number): boolean {
  if (!scrollTarget) detectAndCacheScrollTarget()
  if (!scrollTarget) return false
  if (scrollTarget.type === 'window') {
    window.scrollTo(0, originalPosition)
    return true
  }
  const el = scrollTarget.el!
  if (!document.body.contains(el)) return false
  el.scrollTo(0, originalPosition)
  return true
}

function clearScrollTargetCache() {
  scrollTarget = null
}

async function restorePageAfterScreenshotInternal(): Promise<boolean> {
  try {
    const all = Array.from(document.querySelectorAll<HTMLElement>('body *'))
    for (const el of all) {
      const snap = (el as any).__solvely_pre_screenshot
      if (!snap) continue
      try {
        if (snap.opacity !== undefined) el.style.opacity = snap.opacity
        if (snap.pointerEvents !== undefined)
          el.style.pointerEvents = snap.pointerEvents
        if (snap.position !== undefined) el.style.position = snap.position
        if (snap.top !== undefined) el.style.top = snap.top
        if (snap.bottom !== undefined) el.style.bottom = snap.bottom
        if (snap.zIndex !== undefined) el.style.zIndex = snap.zIndex
        if (snap.transform !== undefined) el.style.transform = snap.transform
      } finally {
        delete (el as any).__solvely_pre_screenshot
      }
    }
    emit('update:hideFloatBtns', false)
    emit('update:hideSolveLayer', false)
    isViewportBorderVisible.value = false
    try {
      const styleEl = document.getElementById(SCROLLBAR_STYLE_ID)
      if (styleEl?.parentNode) styleEl.parentNode.removeChild(styleEl)
      if (scrollbarMarkedEls.length) {
        scrollbarMarkedEls.forEach((el) =>
          el.removeAttribute('data-solvely-scrolltarget')
        )
        scrollbarMarkedEls = []
      }
    } catch {}
    clearScrollTargetCache()
    isPreparedForScreenshot.value = false
    return true
  } catch {
    return false
  }
}

const handleMessage = (message: any, sender: any, sendResponse: any) => {
  switch (message.type) {
    case SidepanelEventType.GET_PAGE_SCROLL_INFO: {
      const info = getScrollInfo()
      sendResponse(info)
      break
    }

    case SidepanelEventType.SCROLL_TO_POSITION: {
      const success = scrollToPositionInternal(message.position)
      sendResponse({ success })
      break
    }

    case SidepanelEventType.RESTORE_SCROLL_POSITION: {
      const success = restoreScrollInternal(message.originalPosition || 0)
      sendResponse({ success })
      break
    }

    case SidepanelEventType.PREPARE_PAGE_FOR_SCREENSHOT: {
      try {
        emit('update:hideFloatBtns', true)
        emit('update:hideSolveLayer', true)
        isViewportBorderVisible.value = true

        const all = Array.from(document.querySelectorAll<HTMLElement>('body *'))
        const fixed: HTMLElement[] = []
        const sticky: HTMLElement[] = []

        for (const el of all) {
          const style = window.getComputedStyle(el)
          if (style.position === 'fixed') {
            const topPx = parseFloat(style.top || '')
            const bottomPx = parseFloat(style.bottom || '')
            const isTopZero = !Number.isNaN(topPx) && Math.abs(topPx) <= 0.5
            const isBottomZero =
              !Number.isNaN(bottomPx) && Math.abs(bottomPx) <= 0.5
            if (isTopZero || isBottomZero) {
              const rect = el.getBoundingClientRect()
              const viewportArea = window.innerWidth * window.innerHeight
              const elementArea =
                Math.max(0, rect.width) * Math.max(0, rect.height)
              const coverage = viewportArea > 0 ? elementArea / viewportArea : 0
              if (coverage <= 0.5) fixed.push(el)
            }
          }
          if (style.position === 'sticky') sticky.push(el)
        }

        fixed.forEach((el) => {
          const snap = (el as any).__solvely_pre_screenshot
          if (!snap) {
            ;(el as any).__solvely_pre_screenshot = {
              opacity: el.style.opacity,
              pointerEvents: el.style.pointerEvents,
            }
          }
          el.style.setProperty('opacity', '0', 'important')
          el.style.setProperty('pointer-events', 'none', 'important')
        })

        sticky.forEach((el) => {
          const snap = (el as any).__solvely_pre_screenshot
          if (!snap) {
            ;(el as any).__solvely_pre_screenshot = {
              position: el.style.position,
              top: el.style.top,
              bottom: el.style.bottom,
              zIndex: el.style.zIndex,
              transform: el.style.transform,
            }
          }
          el.style.setProperty('position', 'static', 'important')
          el.style.setProperty('top', 'auto', 'important')
          el.style.setProperty('bottom', 'auto', 'important')
          el.style.setProperty('z-index', 'auto', 'important')
          el.style.setProperty('transform', 'none', 'important')
        })

        detectAndCacheScrollTarget()

        try {
          let styleEl = document.getElementById(
            SCROLLBAR_STYLE_ID
          ) as HTMLStyleElement | null
          if (!styleEl) {
            styleEl = document.createElement('style')
            styleEl.id = SCROLLBAR_STYLE_ID
            styleEl.type = 'text/css'
            styleEl.appendChild(
              document.createTextNode(`
                [data-solvely-scrolltarget]::-webkit-scrollbar { background: transparent !important; }
                [data-solvely-scrolltarget]::-webkit-scrollbar-thumb { background: transparent !important; }
                [data-solvely-scrolltarget]::-webkit-scrollbar-track { background: transparent !important; }
                [data-solvely-scrolltarget] { scrollbar-color: transparent transparent !important; }
              `)
            )
            document.head.appendChild(styleEl)
          }

          const targets: HTMLElement[] =
            scrollTarget?.type === 'element' && scrollTarget.el
              ? [scrollTarget.el]
              : [document.documentElement, document.body]
          targets.forEach((el) => {
            if (!el.hasAttribute('data-solvely-scrolltarget')) {
              el.setAttribute('data-solvely-scrolltarget', '1')
              scrollbarMarkedEls.push(el)
            }
          })
        } catch {}

        setTimeout(() => {
          isPreparedForScreenshot.value = true
          sendResponse({
            success: true,
            fixedCount: fixed.length,
            stickyCount: sticky.length,
          })
        }, 100)
      } catch (e) {
        sendResponse({ success: false, error: (e as Error)?.message })
      }
      return true
    }

    case SidepanelEventType.RESTORE_PAGE_AFTER_SCREENSHOT: {
      try {
        restorePageAfterScreenshotInternal().then((ok) => {
          sendResponse({ success: ok })
        })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error)?.message })
      }
      return true
    }

    case SidepanelEventType.STATUS_CHANGED: {
      try {
        if (message?.data?.isOpen === false && isPreparedForScreenshot.value) {
          restorePageAfterScreenshotInternal()
        }
      } catch {}
      break
    }
  }
}

onMounted(() => {
  browser.runtime.onMessage.addListener(handleMessage)
})

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(handleMessage)
  isViewportBorderVisible.value = false
})
</script>
