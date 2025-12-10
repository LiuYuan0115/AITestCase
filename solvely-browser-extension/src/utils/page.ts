/**
 * DOM 到 Markdown 转换工具
 * 将网页内容转换为 Markdown 格式，保持内容顺序和结构
 */
interface ProcessContext {
  depth: number // 嵌套深度
  listType?: 'ul' | 'ol' // 列表类型
  listIndex?: number // 有序列表索引
  inPreBlock?: boolean // 是否在代码块中
  imageCollector: ImageInfo[] // 图片收集器
}

/**
 * 图片信息接口
 */
interface ImageInfo {
  url: string
  width: number
  height: number
}

/**
 * 转换结果接口
 */
interface ConvertResult {
  markdown: string
  images: ImageInfo[]
}

/**
 * 主入口函数：将 DOM 节点转换为 Markdown
 * @param rootNode 根节点，如 document.body
 * @returns 包含 markdown 和图片列表的对象
 */
function convertDOMToMarkdown(rootNode: Node): ConvertResult {
  const imageCollector: ImageInfo[] = []
  const context: ProcessContext = {
    depth: 0,
    imageCollector,
  }

  const result = processNode(rootNode, context)
  const markdown = result.replace(/\n{3,}/g, '\n\n').trim()

  return {
    markdown,
    images: imageCollector.map((item) => {
      if (!item.url.startsWith('data:') && !item.url.startsWith('http')) {
        return {
          ...item,
          url: location.origin + item.url,
        }
      }
      return item
    }),
  }
}

/**
 * 主处理函数：递归处理节点
 * @param node 当前节点
 * @param context 处理上下文
 * @returns 处理后的字符串
 */
function processNode(
  node: Node,
  context: ProcessContext = { depth: 0, imageCollector: [] }
): string {
  if (shouldIgnoreNode(node)) return ''

  if (node.nodeType === Node.TEXT_NODE) {
    return context.inPreBlock
      ? node.textContent || ''
      : normalizeWhitespace(node.textContent || '')
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tagName = element.tagName.toLowerCase()
    // p 元素总是按块级处理，确保段落分隔
    if (tagName === 'p') {
      return processBlockElement(element, context)
    }

    if (hasDirectTextNodes(element)) {
      // 包含文本节点，处理混合内容
      return processChildNodes(element, context)
    } else {
      // 不包含文本节点，按元素类型处理
      return processBlockElement(element, context)
    }
  }

  return ''
}

/**
 * 检测是否为辅助性内容（屏幕阅读器专用）
 * @param element 元素节点
 * @returns 是否为辅助性内容
 */
function isAssistiveContent(element: Element): boolean {
  const className = getElementClassName(element)

  // 常见的辅助性内容class模式
  const assistivePatterns = [
    'assistive',
    'sr-only',
    'screen-reader',
    'visually-hidden',
    'mjx_assistive',
    'mjx-assistive',
  ]

  if (assistivePatterns.some((pattern) => className.includes(pattern))) {
    return true
  }

  // MathJax v3 的辅助节点标签
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'mjx-assistive-mml') {
    return true
  }

  return false
}

/**
 * 检测CSS裁剪是否隐藏元素
 * @param clipValue CSS clip 属性值
 * @returns 是否被裁剪隐藏
 */
function isClippedToTiny(clipValue: string): boolean {
  // 匹配 rect(1px, 1px, 1px, 1px) 或类似的极小裁剪
  const rectMatch = clipValue.match(/rect\(([^)]+)\)/)
  if (rectMatch) {
    const values = rectMatch[1].split(',').map((v) => v.trim())
    // 检查是否所有值都是很小的像素值
    return values.every((v) => {
      const px = parseFloat(v)
      return !isNaN(px) && px <= 2
    })
  }
  return false
}

/**
 * 检测元素是否通过CSS技术隐藏
 * @param element 元素节点
 * @returns 是否被CSS隐藏
 */
function isCSSHidden(element: Element): boolean {
  const style = window.getComputedStyle(element)

  // 特定的辅助性内容class检测
  const className = getElementClassName(element)
  if (className.includes('mjx_assistive') || className.includes('assistive')) {
    return true
  }

  // clip 裁剪检测
  const clip = style.clip
  if (clip && clip !== 'auto' && isClippedToTiny(clip)) {
    return true
  }

  // 极小尺寸检测（更精确的条件）
  const rect = element.getBoundingClientRect()

  // 1px尺寸 + overflow hidden 的特殊组合
  if (rect.width <= 2 && rect.height <= 2 && style.overflow === 'hidden') {
    return true
  }

  // 屏幕外定位（简单检测）
  if (style.position === 'absolute') {
    const left = parseFloat(style.left || '0')
    const top = parseFloat(style.top || '0')
    // 检测是否定位到屏幕外
    if (left < -9999 || top < -9999) {
      return true
    }
  }

  return false
}

/**
 * 检查元素是否可见
 * @param element 元素节点
 * @returns 是否可见
 */
function isElementVisible(element: Element): boolean {
  // 特殊标签检查
  const tagName = element.tagName.toLowerCase()
  if (['template'].includes(tagName)) return false

  // 辅助性/无障碍内容统一视为不可见
  if (isAssistiveContent(element)) return false

  // CSS隐藏技术检查
  if (isCSSHidden(element)) return false

  // 基础CSS样式检查
  const style = window.getComputedStyle(element)
  if (style.display === 'none') return false
  if (style.visibility === 'hidden') return false
  if (style.opacity === '0') return false

  // 尺寸检查
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false

  return true
}

/**
 * 检查是否应该忽略该节点
 * @param node 节点
 * @returns 是否应该忽略
 */
function shouldIgnoreNode(node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tagName = element.tagName.toLowerCase()

    // 基础标签过滤
    if (['script', 'style', 'iframe', 'noscript', 'embed'].includes(tagName)) {
      return true
    }

    // 可见性检查
    if (!isElementVisible(element)) {
      return true
    }
  }
  return false
}

/**
 * 处理包含文本节点的混合内容
 * @param element 元素节点
 * @param context 处理上下文
 * @returns 处理后的字符串
 */
function processChildNodes(element: Element, context: ProcessContext): string {
  let result = ''

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = context.inPreBlock
        ? child.textContent || ''
        : normalizeWhitespace(child.textContent || '')
      result += text
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childElement = child as Element
      const tagName = childElement.tagName.toLowerCase()
      switch (tagName) {
        case 'img':
          result += processImage(childElement, context)
          break
        case 'object':
          result += processObject(childElement, context)
          break
        case 'svg':
          result += processSVG(childElement, context)
          break
        case 'a':
          result += processLink(childElement)
          break
        case 'br':
          result += '\n'
          break
        default:
          result += childElement.textContent || ''
      }
    }
  }

  return result
}

/**
 * 处理子节点列表（用于块级元素）
 * @param element 元素节点
 * @param context 处理上下文
 * @returns 处理后的字符串
 */
function processChildrenNodes(
  element: Element,
  context: ProcessContext
): string {
  let result = ''

  for (const child of element.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childElement = child as Element
      const tagName = childElement.tagName.toLowerCase()
      // 特殊处理媒体元素
      if (tagName === 'img') {
        result += processImage(childElement, context)
        continue
      }
      if (tagName === 'svg') {
        result += processSVG(childElement, context)
        continue
      }
      if (tagName === 'object') {
        result += processObject(childElement, context)
        continue
      }

      // 过滤空元素
      if (!hasValidContent(childElement)) {
        continue
      }
    }

    result += processNode(child, context)
  }

  return result
}

/**
 * 处理块级元素
 * @param element 元素节点
 * @param context 处理上下文
 * @returns 处理后的字符串
 */
function processBlockElement(
  element: Element,
  context: ProcessContext
): string {
  const tagName = element.tagName.toLowerCase()
  let result = ''
  switch (tagName) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      const level = parseInt(tagName[1])
      const heading = processChildrenNodes(element, context)
      result = '\n\n' + '#'.repeat(level) + ' ' + heading + '\n\n'
      break

    case 'p':
      // p 元素根据是否包含文本节点选择处理方式
      if (hasDirectTextNodes(element)) {
        result = '\n\n' + processChildNodes(element, context) + '\n\n'
      } else {
        result = '\n\n' + processChildrenNodes(element, context) + '\n\n'
      }
      break

    case 'blockquote':
      // 简化：当作普通容器处理，不添加 > 前缀
      result = processChildrenNodes(element, context)
      break

    case 'ul':
      result = '\n\n' + processUL(element, context) + '\n\n'
      break

    case 'ol':
      result = '\n\n' + processOL(element, context) + '\n\n'
      break

    case 'li':
      result = processChildrenNodes(element, context)
      break

    case 'pre':
    case 'label':
      result = '\n\n' + (element.textContent?.trim() || '') + '\n\n'
      break

    case 'code':
      if (context.inPreBlock) {
        result = element.textContent || ''
      } else {
        result = '`' + (element.textContent || '') + '`'
      }
      break

    case 'div':
      // div 作为通用容器处理
      result = processChildrenNodes(element, context)
      if (isBlockContext(element)) {
        result = '\n\n' + result + '\n\n'
      }
      break

    case 'table':
      // 表格作为容器，前后加双换行确保与其他内容分隔
      result = '\n\n' + processChildrenNodes(element, context) + '\n\n'
      break

    case 'thead':
    case 'tbody':
    case 'tfoot':
      // 表格区域作为容器处理，不额外添加换行
      result = processChildrenNodes(element, context)
      break

    case 'tr':
      // 表格行处理，行间添加单换行作为分隔
      result = processChildrenNodes(element, context) + '\n'
      break

    case 'th':
    case 'td':
      // 按div方式处理：使用processChildrenNodes + 块级上下文换行
      result = processChildrenNodes(element, context)
      // th和td总是被当作块级上下文，确保单元格内容独立成段
      result = '\n\n' + result + '\n\n'
      break

    default:
      // 其他块级元素或自定义元素
      result = processChildrenNodes(element, context)
      if (isBlockContext(element)) {
        result = '\n\n' + result + '\n\n'
      }
  }

  return result
}

/**
 * 处理图片元素
 * @param img 图片元素
 * @param context 处理上下文
 * @returns Markdown 图片语法
 */
function processImage(img: Element, context: ProcessContext): string {
  // 获取图片尺寸和有效性信息
  const imageInfo = getImageSizeAndValidity(img)

  // 如果图片无效，直接返回
  if (!imageInfo.isValid) {
    return ''
  }

  let src = img.getAttribute('src') || ''
  const alt = img.getAttribute('alt') || ''

  if (!src.startsWith('http') && !src.startsWith('data:')) {
    src = location.origin + src
  }

  // 如果是外部URL，添加到收集器
  if (isExternalUrl(src)) {
    context.imageCollector.push({
      url: src,
      width: imageInfo.width,
      height: imageInfo.height,
    })
  }

  return `![${alt}](${src})`
}

/**
 * 处理 SVG 元素
 * @param svg SVG 元素
 * @param context 处理上下文
 * @returns SVG 代码或空字符串
 */
function processSVG(svg: Element, context: ProcessContext): string {
  // 检查渲染尺寸，忽略宽度或高度小于 100 的 SVG
  const rect = svg.getBoundingClientRect()
  if (rect.width < 100 || rect.height < 100) {
    return ''
  }

  // 获取完整的 SVG 代码
  const svgCode = svg.outerHTML

  // 在前后添加换行符，确保在 Markdown 中正确渲染
  return '\n\n' + svgCode + '\n\n'
}

/**
 * 处理 object 元素（图片类型）
 * @param obj object 元素
 * @returns Markdown 图片语法
 */
function processObject(obj: Element, context: ProcessContext): string {
  const type = obj.getAttribute('type') || ''
  let data = obj.getAttribute('data') || ''

  if (!data.startsWith('http') && !data.startsWith('data:')) {
    data = location.origin + data
  }

  // 只处理图片类型的 object
  if (type.startsWith('image/')) {
    // 获取 alt 文本的优先级：
    // 1. object 的 aria-label
    // 2. 父容器的 aria-label
    // 3. 内部 img 的 alt
    // 4. 空字符串
    const alt =
      obj.getAttribute('aria-label') ||
      obj.closest('[aria-label]')?.getAttribute('aria-label') ||
      obj.querySelector('img')?.getAttribute('alt') ||
      ''

    const imageInfo = getImageSizeAndValidity(obj)

    if (isExternalUrl(data)) {
      context.imageCollector.push({
        url: data,
        width: imageInfo.width,
        height: imageInfo.height,
      })
    }

    return `![${alt}](${data})`
  }

  return '' // 非图片类型的 object 不处理
}

/**
 * 处理链接元素
 * @param a 链接元素
 * @returns Markdown 链接语法
 */
function processLink(a: Element): string {
  const href = a.getAttribute('href') || ''
  const text = a.textContent || ''
  return `[${text}](${href})`
}

/**
 * 处理列表项内容（扁平化处理，所有内容在一行）
 * @param element 列表项元素
 * @param context 处理上下文
 * @returns 处理后的字符串
 */
function processListItemContent(
  element: Element,
  context: ProcessContext
): string {
  let result = ''

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(child.textContent || '')
      result += text
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childElement = child as Element
      const tagName = childElement.tagName.toLowerCase()

      switch (tagName) {
        case 'img':
          result += processImage(childElement, context)
          break
        case 'object':
          result += processObject(childElement, context)
          break
        case 'a':
          result += processLink(childElement)
          break
        case 'br':
          result += ' ' // br在列表中转为空格，不换行
          break
        default:
          // 所有其他元素（包括div），递归获取文本内容
          result += processListItemContent(childElement, context)
      }
    }
  }

  return result.trim() // 清理首尾空白
}

/**
 * 处理无序列表
 * @param ul 无序列表元素
 * @param context 处理上下文
 * @returns Markdown 列表语法
 */
function processUL(ul: Element, context: ProcessContext): string {
  let result = ''
  for (const li of ul.children) {
    if (li.tagName.toLowerCase() === 'li') {
      const content = processListItemContent(li, { ...context, listType: 'ul' })
      if (content) {
        // 只输出有内容的列表项
        result += '- ' + content + '\n'
      }
    }
  }
  return result
}

/**
 * 处理有序列表
 * @param ol 有序列表元素
 * @param context 处理上下文
 * @returns Markdown 列表语法
 */
function processOL(ol: Element, context: ProcessContext): string {
  let result = ''
  let index = 1
  for (const li of ol.children) {
    if (li.tagName.toLowerCase() === 'li') {
      const content = processListItemContent(li, {
        ...context,
        listType: 'ol',
        listIndex: index,
      })
      if (content) {
        // 只输出有内容的列表项
        result += `${index}. ` + content + '\n'
        index++
      }
    }
  }
  return result
}

/**
 * 处理列表项
 * @param li 列表项元素
 * @param context 处理上下文
 * @returns 处理后的字符串
 */
function processLI(li: Element, context: ProcessContext): string {
  return processListItemContent(li, context)
}

/**
 * 规范化空白字符
 * @param text 文本内容
 * @returns 规范化后的文本
 */
function normalizeWhitespace(text: string): string {
  // 移除零宽字符与 BOM，再进行空白归一
  const cleaned = text.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '')
  return cleaned.replace(/\s+/g, ' ')
}

/**
 * 检查元素是否包含直接文本节点
 * @param element 元素节点
 * @returns 是否包含文本节点
 */
function hasDirectTextNodes(element: Element): boolean {
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return true
    }
  }
  return false
}

/**
 * 检查元素是否包含有效内容
 * @param element 元素节点
 * @returns 是否包含有效内容
 */
function hasValidContent(element: Element): boolean {
  const tagName = element.tagName.toLowerCase()

  // 媒体元素即使没有文本内容也认为是有效的
  if (['img', 'video', 'audio', 'svg', 'object'].includes(tagName)) {
    return true
  }

  if (element.querySelector('img')) {
    return true
  }

  const text = element.textContent?.trim()
  return Boolean(text && text.length > 0)
}

/**
 * 判断是否为块级上下文
 * @param element 元素节点
 * @returns 是否为块级元素
 */
function isBlockContext(element: Element): boolean {
  const blockTags = [
    'div',
    'section',
    'article',
    'main',
    'aside',
    'header',
    'footer',
    'nav',
    'table',
    'th',
    'td',
  ]
  const tagName = element.tagName.toLowerCase()

  // 明确的块级标签
  if (blockTags.includes(tagName)) return true

  // 数学公式容器等特殊情况，当作内联处理
  if (tagName.startsWith('mjx-') || tagName.includes('math')) {
    return false
  }

  // 其他自定义元素默认当作内联
  return false
}

/**
 * 图片尺寸和有效性信息
 */
interface ImageSizeInfo {
  isValid: boolean
  width: number
  height: number
}

/**
 * 获取图片尺寸和有效性信息
 * @param img 图片元素
 * @returns 包含有效性和尺寸的信息对象
 */
function getImageSizeAndValidity(img: Element): ImageSizeInfo {
  // 1. 基础检查
  const src = img.getAttribute('src') || img.getAttribute('data')
  if (!src?.trim()) return { isValid: false, width: 0, height: 0 }
  if (src.startsWith('data:') && src.length < 200)
    return { isValid: false, width: 0, height: 0 }

  // 2. 获取实际渲染尺寸
  const rect = img.getBoundingClientRect()
  const width = rect.width
  const height = rect.height

  // 过滤追踪像素
  if (width === 1 && height === 1) return { isValid: false, width, height }

  // 过滤过小的图片
  const MIN_RENDER_SIZE = 50
  if (width < MIN_RENDER_SIZE || height < MIN_RENDER_SIZE)
    return { isValid: false, width, height }

  // 3. 可见性检查已在 shouldIgnoreNode 中处理，这里不需要重复检查

  // 4. 装饰性关键词过滤
  const decorativeKeywords = [
    'icon',
    'logo',
    'bullet',
    'arrow',
    'divider',
    'spacer',
    'pixel',
    'banner',
  ]
  if (
    decorativeKeywords.some((keyword) => src.toLowerCase().includes(keyword))
  ) {
    return { isValid: false, width, height }
  }

  // 5. 内容相关性检查
  const alt = img.getAttribute('alt') || ''
  if (alt.trim() && alt.length > 2) return { isValid: true, width, height }

  // 6. 大图片优先
  if (width >= 100 && height >= 100) return { isValid: true, width, height }

  return { isValid: false, width, height }
}

/**
 * 检查图片是否有效（基于渲染尺寸和内容相关性）
 * @param img 图片元素
 * @returns 是否为有效图片
 */
function isValidImage(img: Element): boolean {
  return getImageSizeAndValidity(img).isValid
}

/**
 * 判断是否为外部URL
 * @param url URL地址
 * @returns 是否为外部URL
 */
function isExternalUrl(url: string): boolean {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('/') ||
    url.startsWith('./')
  )
}

/**
 * 目标尺寸接口
 */
interface TargetSize {
  width: number
  height: number
}

/**
 * 计算结果尺寸接口
 */
interface CalculatedSize {
  width: number
  height: number
}

/**
 * 将图片URL转换为data URL
 * @param imageUrl 图片URL地址
 * @param targetSize 目标尺寸（可选），保持宽高比缩放
 * @param quality 输出质量 0.1-1.0，默认0.7
 * @returns Promise<string> data URL字符串
 */
async function convertImageToDataURL(
  imageUrl: string,
  targetSize?: TargetSize,
  quality: number = 0.7
): Promise<string> {
  try {
    // 1. 使用 fetch 获取图片数据（利用浏览器缓存）
    const response = await fetch(imageUrl)

    // 检查是否为 SVG 文件
    const contentType = response.headers.get('content-type') || ''
    const isSvg =
      contentType.includes('svg') || imageUrl.toLowerCase().endsWith('.svg')

    if (isSvg) {
      // 直接返回 SVG 文本内容
      return await response.text()
    }

    const blob = await response.blob()

    // 验证是否为图片类型
    if (!blob.type.startsWith('image/')) {
      throw new Error(`Invalid image type: ${blob.type}`)
    }

    // 2. 创建 ObjectURL 避免 CORS 问题
    const objectUrl = URL.createObjectURL(blob)

    try {
      // 3. 创建离屏 Image 对象并获取原始尺寸
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = objectUrl
      })

      // 4. 智能路径选择
      const needsResize =
        targetSize &&
        (img.naturalWidth > targetSize.width ||
          img.naturalHeight > targetSize.height)

      if (!needsResize) {
        // 路径A: 直接转换（保持原格式+原质量）
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } else {
        // 路径B: Canvas处理（调整尺寸）
        const finalSize = calculateTargetSize(
          img.naturalWidth,
          img.naturalHeight,
          targetSize!
        )

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          throw new Error('Failed to get canvas context')
        }

        canvas.width = finalSize.width
        canvas.height = finalSize.height
        ctx.drawImage(img, 0, 0, finalSize.width, finalSize.height)

        return canvas.toDataURL('image/jpeg', quality)
      }
    } finally {
      // 5. 清理资源
      URL.revokeObjectURL(objectUrl)
    }
  } catch (error) {
    return ''
  }
}

/**
 * 计算保持宽高比的目标尺寸
 * @param originalWidth 原始宽度
 * @param originalHeight 原始高度
 * @param targetSize 目标尺寸约束
 * @returns 计算后的实际尺寸
 */
function calculateTargetSize(
  originalWidth: number,
  originalHeight: number,
  targetSize: TargetSize
): CalculatedSize {
  // 计算缩放比例，选择较小的比例以确保图片完全适应目标尺寸
  const scaleX = targetSize.width / originalWidth
  const scaleY = targetSize.height / originalHeight
  const scale = Math.min(scaleX, scaleY)

  // 应用缩放并四舍五入到整数像素
  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  }
}

/**
 * 视觉渲染类型
 */
type VisualRenderType = 'block' | 'inline'

/**
 * 视觉间距信息
 */
interface VisualSpacing {
  before: boolean
  after: boolean
}

/**
 * 视觉处理上下文
 */
interface VisualProcessContext extends ProcessContext {
  inInlineFlow?: boolean // 是否在内联流中
  needsSpacing?: boolean // 是否需要添加间距
}

/**
 * 判断元素的视觉渲染类型
 * @param element 元素节点
 * @returns 渲染类型：'block' 或 'inline'
 */
function getVisualRenderType(element: Element): VisualRenderType {
  const style = window.getComputedStyle(element)
  const display = style.display.toLowerCase()

  // 语义容器（如数学）统一按内联处理，避免误触发段落冲刷
  if (isSemanticContainer(element)) {
    return 'inline'
  }

  // 块级显示类型
  const blockDisplayTypes = [
    'block',
    'flex',
    'grid',
    'table',
    'table-row',
    'table-cell',
    'table-header-group',
    'table-row-group',
    'table-footer-group',
    'list-item',
    'flow-root',
  ]

  // 检查是否为块级显示
  if (blockDisplayTypes.some((type) => display.includes(type))) {
    return 'block'
  }

  // 其他情况（inline, inline-block, inline-flex等）视为内联
  return 'inline'
}

/**
 * 安全获取元素的class名称
 * @param element 元素节点
 * @returns 小写的class名称字符串
 */
function getElementClassName(element: Element): string {
  try {
    // 处理普通HTML元素
    if (typeof element.className === 'string') {
      return element.className.toLowerCase()
    }

    // 处理SVG元素（className是SVGAnimatedString对象）
    const className = element.className as any
    if (className && typeof className.baseVal === 'string') {
      return className.baseVal.toLowerCase()
    }

    // 回退到getAttribute
    const classAttr = element.getAttribute('class')
    return classAttr ? classAttr.toLowerCase() : ''
  } catch (error) {
    return ''
  }
}

/**
 * 检测是否为语义整体容器（如数学公式）
 * @param element 元素节点
 * @returns 是否为语义容器
 */
function isSemanticContainer(element: Element): boolean {
  const className = getElementClassName(element)
  const tagName = element.tagName.toLowerCase()

  // 数学公式容器
  const mathClasses = ['mathjax', 'katex', 'math']
  if (mathClasses.some((cls) => className.includes(cls))) {
    return true
  }

  // MathML 元素
  if (
    tagName === 'math' ||
    element.namespaceURI === 'http://www.w3.org/1998/Math/MathML'
  ) {
    return true
  }

  // 有数学相关属性
  if (
    element.hasAttribute('data-mathml') ||
    element.querySelector('script[type="math/tex"]')
  ) {
    return true
  }

  return false
}

/**
 * 提取元素的可见文本内容（排除隐藏元素）
 * @param element 元素节点
 * @returns 可见的文本内容
 */
function getVisibleTextContent(element: Element): string {
  let result = ''

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent || ''
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childElement = child as Element

      // 使用现有的可见性检测
      if (!isAssistiveContent(childElement) && isElementVisible(childElement)) {
        result += getVisibleTextContent(childElement)
      }
    }
  }

  return normalizeWhitespace(result).trim()
}

/**
 * 提取语义容器的整体内容
 * @param element 语义容器元素
 * @returns 提取的文本内容
 */
function extractSemanticContent(element: Element): string {
  // 优先使用 TeX 源码
  const texScript = element.querySelector('script[type="math/tex"]')
  if (texScript?.textContent?.trim()) {
    return texScript.textContent.trim()
  }

  // 尝试 MathML 数据
  const mathml = element.getAttribute('data-mathml')
  if (mathml) {
    // 先尝试可见文本
    const visibleText = getVisibleTextContent(element)
    if (visibleText.trim()) {
      return visibleText
    }
    // 如果可见文本为空，回退到全部文本（可能CSS检测过严）
    const allText = element.textContent?.trim() || ''
    return allText.replace(/\s+/g, ' ')
  }

  // MathJax v3: 从辅助 MML 节点读取纯文本
  const assistiveMml = element.querySelector('mjx-assistive-mml')
  const assistiveText = assistiveMml?.textContent?.trim()
  if (assistiveText) {
    return normalizeWhitespace(assistiveText).trim()
  }

  // 回退到可见文本内容
  const visibleText = getVisibleTextContent(element)
  if (visibleText.trim()) {
    return visibleText
  }

  // 最终回退：如果可见文本为空，使用全部文本
  const allText = element.textContent?.trim() || ''
  return allText.replace(/\s+/g, ' ')
}

/**
 * 检测元素前后是否有视觉间距
 * @param element 元素节点
 * @returns 视觉间距信息
 */
function hasVisualSpacing(element: Element): VisualSpacing {
  const style = window.getComputedStyle(element)

  // 解析CSS值为数字（去掉px等单位）
  const parseValue = (value: string): number => {
    const num = parseFloat(value)
    return isNaN(num) ? 0 : num
  }

  // 检查margin和padding
  const marginLeft = parseValue(style.marginLeft)
  const marginRight = parseValue(style.marginRight)
  const paddingLeft = parseValue(style.paddingLeft)
  const paddingRight = parseValue(style.paddingRight)

  // 检查前后是否有间距（margin或padding > 0）
  const before = marginLeft > 0 || paddingLeft > 0
  const after = marginRight > 0 || paddingRight > 0

  return { before, after }
}

/**
 * 按视觉流程处理元素内容
 * @param element 元素节点
 * @param context 视觉处理上下文
 * @returns 处理后的字符串
 */
function processVisualFlow(
  element: Element,
  context: VisualProcessContext
): string {
  let result = ''
  let inlineBuffer = '' // 内联内容缓冲区

  for (const child of element.childNodes) {
    if (shouldIgnoreNode(child)) continue

    if (child.nodeType === Node.TEXT_NODE) {
      // 文本节点，添加到内联缓冲区
      const text = context.inPreBlock
        ? child.textContent || ''
        : normalizeWhitespace(child.textContent || '')
      if (text.trim()) {
        inlineBuffer += text
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childElement = child as Element
      const renderType = getVisualRenderType(childElement)

      if (renderType === 'block') {
        // 块级元素：先输出内联缓冲区，然后处理块级元素
        if (inlineBuffer.trim()) {
          result += inlineBuffer.trim() + '\n\n'
          inlineBuffer = ''
        }

        // 递归处理块级元素
        result += processVisualNode(childElement, {
          ...context,
          inInlineFlow: false,
        })
      } else {
        // 内联元素：先检查是否为语义容器
        if (isSemanticContainer(childElement)) {
          // 语义容器：直接提取整体内容，不递归处理
          const spacing = hasVisualSpacing(childElement)

          if (spacing.before && inlineBuffer && !inlineBuffer.endsWith(' ')) {
            inlineBuffer += ' '
          }

          const semanticContent = extractSemanticContent(childElement)
          inlineBuffer += semanticContent

          if (spacing.after && !inlineBuffer.endsWith(' ')) {
            inlineBuffer += ' '
          }
        } else {
          // 普通内联元素：继续现有逻辑
          const spacing = hasVisualSpacing(childElement)

          if (spacing.before && inlineBuffer && !inlineBuffer.endsWith(' ')) {
            inlineBuffer += ' '
          }

          // 处理特殊内联元素
          const tagName = childElement.tagName.toLowerCase()
          let inlineContent = ''

          // 1. 优先处理已知的原子元素
          switch (tagName) {
            case 'img':
              inlineContent = processImage(childElement, context)
              break
            case 'object':
              inlineContent = processObject(childElement, context)
              break
            case 'svg':
              inlineContent = processSVG(childElement, context)
              break
            case 'a':
              inlineContent = processLink(childElement)
              break
            case 'br':
              inlineContent = '\n'
              break
            default:
              // 2. 通用处理：有子元素就递归，没有就提取文本
              if (childElement.children.length > 0) {
                // 容器元素：递归处理子元素
                inlineContent = processVisualFlow(childElement, {
                  ...context,
                  inInlineFlow: true,
                })
              } else {
                // 叶子元素：提取文本内容
                inlineContent = childElement.textContent || ''
              }
          }

          inlineBuffer += inlineContent

          if (spacing.after && !inlineBuffer.endsWith(' ')) {
            inlineBuffer += ' '
          }
        }
      }
    }
  }

  // 输出剩余的内联内容
  if (inlineBuffer.trim()) {
    result += inlineBuffer.trim()
  }

  return result
}

/**
 * 按视觉渲染处理单个节点
 * @param node 节点
 * @param context 视觉处理上下文
 * @returns 处理后的字符串
 */
function processVisualNode(
  node: Node,
  context: VisualProcessContext = { depth: 0, imageCollector: [] }
): string {
  if (shouldIgnoreNode(node)) return ''

  if (node.nodeType === Node.TEXT_NODE) {
    return context.inPreBlock
      ? node.textContent || ''
      : normalizeWhitespace(node.textContent || '')
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tagName = element.tagName.toLowerCase()

    // 优先处理原子元素（无论是块级还是内联）
    switch (tagName) {
      case 'img':
        return processImage(element, context)
      case 'object':
        return processObject(element, context)
      case 'svg':
        return processSVG(element, context)
      case 'br':
        return '\n'
    }

    const renderType = getVisualRenderType(element)

    if (renderType === 'block') {
      // 块级元素：前后加换行，内部使用视觉流程处理
      const content = processVisualFlow(element, context)
      if (content.trim()) {
        return context.inInlineFlow ? content : '\n\n' + content.trim() + '\n\n'
      }
    } else {
      // 内联元素：使用视觉流程处理，不添加换行
      return processVisualFlow(element, { ...context, inInlineFlow: true })
    }
  }

  return ''
}

/**
 * 基于视觉渲染的DOM到Markdown转换函数
 * @param rootNode 根节点，如 document.body
 * @returns 包含 markdown 和图片列表的对象
 */
function convertDOMToMarkdownByVisual(rootNode: Node): ConvertResult {
  const imageCollector: ImageInfo[] = []
  const context: VisualProcessContext = {
    depth: 0,
    imageCollector,
    inInlineFlow: false,
  }

  const result = processVisualNode(rootNode, context)
  const markdown = result.replace(/\n{3,}/g, '\n\n').trim()

  return {
    markdown,
    images: imageCollector.map((item) => {
      if (!item.url.startsWith('data:') && !item.url.startsWith('http')) {
        return {
          ...item,
          url: location.origin + item.url,
        }
      }
      return item
    }),
  }
}

// 导出主函数和接口
export {
  convertDOMToMarkdown,
  convertDOMToMarkdownByVisual,
  isValidImage,
  convertImageToDataURL,
  type ImageInfo,
  type ConvertResult,
  type VisualRenderType,
  type VisualSpacing,
}
