export interface CanvasDetectionResult {
  isCanvas: boolean
  score: number
  reasons: string[]
}

export interface CanvasPageContext extends CanvasDetectionResult {
  currentUrl: string
  hasPreview: boolean
  sniffedPdfUrl: string | null
}

export interface SniffedPdfInfo {
  url: string | null
  fileName: string | null
}

/**
 * 检测当前页面是否为 Canvas 环境的多信号评分器。
 * - 依据 ENV、全局导航、应用根、body 类名、OG 元信息、URL 结构累加分数
 * - score ≥ 2 时 isCanvas=true
 */
export function detectCanvasEnvironment(
  doc: Document = document,
  win: Window = window
): CanvasDetectionResult {
  const reasons: string[] = []
  let score = 0

  const env = (win as any).ENV
  if (env && typeof env === 'object') {
    score++
    reasons.push('ENV')
    if (
      'current_user_id' in env ||
      'LOCALE' in env ||
      'context_asset_string' in env
    ) {
      score++
      reasons.push('ENV:keys')
    }
  }

  if (doc.getElementById('global_nav')) {
    score++
    reasons.push('#global_nav')
  }

  if (doc.getElementById('application')) {
    score++
    reasons.push('#application')
  }
  const bodyClass = doc.body?.className || ''
  if (/\bic-[A-Za-z_-]+/.test(bodyClass)) {
    score++
    reasons.push('body.ic-*')
  }

  const ogSite = doc.querySelector(
    'meta[property="og:site_name"][content*="Canvas" i]'
  )
  if (ogSite) {
    score++
    reasons.push('og:site_name=Canvas')
  }

  const href = win.location.href
  if (/\/(courses|groups)\//i.test(href)) {
    score++
    reasons.push('url:courses|groups')
  }
  if (/\/(files)(\/|\?|$)/i.test(href) || /[?&]preview=\d+/i.test(href)) {
    score++
    reasons.push('url:files|preview')
  }

  return { isCanvas: score >= 2, score, reasons }
}

/**
 * 当前 URL 是否包含 preview= 参数
 */
export function hasPreviewParam(href: string = window.location.href): boolean {
  return /[?&]preview=/.test(href)
}

/**
 * 多信号、分层嗅探 PDF 链接。
 * 优先级：
 * 1) 带下载语义的 a[href] (+ .pdf 或 /files/)
 * 2) <link> 声明的 pdf
 * 3) embed/object/iframe 等承载标签
 * 4) Canvas ENV.FILES 兜底
 */
export function sniffPdfUrlFromDocument(
  doc: Document = document,
  win: Window = window
): string | null {
  try {
    const candidates: string[] = []
    doc.querySelectorAll('a[href]').forEach((a) => {
      const href = (a as HTMLAnchorElement).href
      const txt = (a.textContent || '').toLowerCase()
      if (!href) return
      const isDownloadHint =
        a.hasAttribute('download') ||
        /download/i.test(a.getAttribute('aria-label') || '') ||
        /download/.test(href) ||
        txt.includes('download') ||
        txt.includes('下载')
      const looksPdf = /\.pdf(\?|#|$)/i.test(href)
      const looksFiles = /\/files\//i.test(href)
      if (isDownloadHint && (looksPdf || looksFiles)) {
        candidates.push(href)
      }
    })
    if (candidates.length > 0) return candidates[0]

    const linkPdf = doc.querySelector(
      'link[type="application/pdf"], link[as="document"][href*=".pdf"]'
    ) as HTMLLinkElement | null
    if (linkPdf?.href) return linkPdf.href

    const embed = doc.querySelector(
      'embed[type="application/pdf"]'
    ) as HTMLEmbedElement | null
    if (embed?.src) return embed.src
    const obj = doc.querySelector(
      'object[type="application/pdf"]'
    ) as HTMLObjectElement | null
    if (obj?.data) return obj.data
    const iframe = doc.querySelector(
      '#file-preview-modal-drawer-layout iframe[src], iframe[src*=".pdf" i]'
    ) as HTMLIFrameElement | null
    if (iframe?.src) return iframe.src

    const env = (win as any).ENV
    if (env && env?.FILES && Array.isArray(env.FILES)) {
      const firstPdf = env.FILES.find(
        (f: any) => typeof f?.url === 'string' && /\.pdf(\?|#|$)/i.test(f.url)
      )
      if (firstPdf?.url) {
        return firstPdf.url
      }
    }
  } catch (e) {
    console.warn('[Solvely][Canvas][sniff] error=', e)
  }
  return null
}

/**
 * 从文档中嗅探 PDF 的 url 与文件名。
 * - 文件名优先来源：
 *   1) tooltip 类的节点文本（示例：span[role="tooltip"].css-cfm3yr-tooltip）
 *   2) a[download] 的 download 属性或可读文本
 *   3) url 路径末段
 *   4) ENV.FILES[x].display_name / name / filename
 */
export function sniffPdfInfoFromDocument(
  doc: Document = document,
  win: Window = window
): SniffedPdfInfo {
  let url: string | null = null
  let fileName: string | null = null
  try {
    // 先尝试 URL
    url = sniffPdfUrlFromDocument(doc, win)

    // 1) 明确的 tooltip 文本（更宽松：role、class、id 中包含 tooltip；遍历所有候选）
    try {
      const tooltipCandidates = Array.from(
        doc.querySelectorAll('[role="tooltip"], [class*="tooltip" i], [id*="tooltip" i]')
      ) as HTMLElement[]
      for (const el of tooltipCandidates) {
        const text = (el.textContent || '').trim()
        if (!text) continue
        
        // 直接检查是否包含 .pdf 文件名
        if (text.includes('.pdf')) {
          // 提取完整的文件名（包含空格）
          const pdfMatch = text.match(/[^<>"']*\.pdf\b/i)
          if (pdfMatch) {
            const fullFileName = pdfMatch[0].trim()
            console.log('[Canvas Debug] Tooltip提取:', { text, fullFileName })
            if (!fileName) {
              fileName = fullFileName
              console.log('[Canvas Debug] 设置文件名:', fileName)
            }
            break
          }
        }
      }
    } catch {}

    // 2) a[download] 或带下载语义的链接（仅在尚未命名时尝试赋值）
    try {
      const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[]
      for (const a of anchors) {
        const href = a.href
        if (!href) continue
        const txt = (a.textContent || '').trim()
        const isDownloadHint =
          a.hasAttribute('download') ||
          /download/i.test(a.getAttribute('aria-label') || '') ||
          /download/i.test(href) ||
          txt.toLowerCase().includes('download') ||
          txt.includes('下载')
        const looksPdf = /\.pdf(\?|#|$)/i.test(href)
        const looksFiles = /\/files\//i.test(href)
        if (isDownloadHint && (looksPdf || looksFiles)) {
          if (!url) url = href
          if (!fileName) {
            const dl = a.getAttribute('download')?.trim()
            const nameFromText = txt.split('\n').map(s => s.trim()).find(s => /\.pdf$/i.test(s))
            const nameFromHref = href.split('?')[0].split('#')[0].split('/').pop()
            fileName = (dl || nameFromText || nameFromHref || null) as string | null
          }
          if (fileName) break
        }
      }
    } catch {}

    // 3) 从 url 推导文件名（仅在尚未命名时）
    if (!fileName && url) {
      try {
        const u = new URL(url, (win as any).location?.href || undefined)
        const last = u.pathname.split('/').pop() || ''
        if (last) fileName = last
      } catch {
        const last = url.split('?')[0].split('#')[0].split('/').pop() || ''
        if (last) fileName = last
      }
    }

    // 4) ENV.FILES 兜底（仅在尚未命名时）
    try {
      const env = (win as any).ENV
      const files = env?.FILES
      if (Array.isArray(files) && files.length > 0) {
        const firstPdf = files.find((f: any) => typeof f?.url === 'string' && /\.pdf(\?|#|$)/i.test(f.url))
        if (firstPdf) {
          if (!url && firstPdf.url) url = firstPdf.url
          const nameFromEnv = firstPdf.display_name || firstPdf.filename || firstPdf.name
          if (nameFromEnv && !fileName) fileName = nameFromEnv
        }
      }
    } catch {}
  } catch (e) {
    console.warn('[Solvely][Canvas][sniffInfo] error=', e)
  }
  return { url, fileName }
}

/**
 * 返回当前页面 URL（可按需扩展做规范化）
 */
export function getCurrentUrl(win: Window = window): string {
  return win.location.href
}

/**
 * 便捷封装：直接检测 Canvas（无参）
 */
export function detectCanvas(): CanvasDetectionResult {
  return detectCanvasEnvironment(document, window)
}

/**
 * 便捷封装：直接判断是否包含 preview=（无参）
 */
export function hasPreview(): boolean {
  return hasPreviewParam(window.location.href)
}

/**
 * 便捷封装：直接嗅探 PDF URL（无参）
 */
export function sniffPdfUrl(): string | null {
  return sniffPdfUrlFromDocument(document, window)
}

/**
 * 便捷封装：直接嗅探 PDF url 与文件名（无参）
 */
export function sniffPdfInfo(): SniffedPdfInfo {
  return sniffPdfInfoFromDocument(document, window)
}