import { ref, onMounted, onUnmounted } from 'vue'
import { debounce } from 'lodash-es'

// 单例类
class QuoteSelectionManager {
  private static instance: QuoteSelectionManager | null = null
  private isListening = false
  private lastSelectedContent = ''
  private enableCopyOverride = false
  private mountedComponents = new Set()

  // 新增：引用按钮相关状态
  private shouldShowQuoteBtn = false
  private quoteBtnPosition = { left: '0px', top: '0px' }
  private selectionPosition = { x: 0, y: 0, width: 0, height: 0 }
  private lastRect = { x: 0, y: 0, width: 0, height: 0 }
  
  // 新增：允许划词的区域
  private allowedQuoteSelectionAreas = new Set<HTMLElement>()
  // 新增：区域元信息（aa容器 -> { index, message }）
  private allowedAreaMeta = new Map<HTMLElement, { index?: number; message?: any }>()

  // 新增：引用按钮尺寸常量
  private readonly QUOTE_BTN_SIZE = 36  // 实际按钮高度
  private readonly QUOTE_BTN_WIDTH = 121  // 实际按钮宽度
  private readonly QUOTE_BTN_OFFSET = 5
  // 新增：跨多题上下文最大长度（8k字符）
  private readonly MAX_CONTEXT_LENGTH = 8000

  // 新增：最后一次构建的上下文文本
  private lastContextText = ''

  // 新增：记录最近一次选区所在的模型 slide（用于多模型上下文精准提取）
  private lastSelectedSlideModelId: string | null = null

  // 新增：静态锚点容器（通常为消息列表的内容层容器，使工具条随内容滚动自然跟随）
  private anchorContainer: HTMLElement | null = null

  // 新增：resize 计算的 rAF id，避免抖动
  private resizeRafId: number | null = null

  private constructor() {}

  static getInstance(): QuoteSelectionManager {
    if (!QuoteSelectionManager.instance) {
      QuoteSelectionManager.instance = new QuoteSelectionManager()
    }
    return QuoteSelectionManager.instance
  }

  // 配置选项
  configure(options?: { enableCopyOverride?: boolean }) {
    this.enableCopyOverride = options?.enableCopyOverride || false
  }

  // 注册组件
  registerComponent(componentId: string) {
    this.mountedComponents.add(componentId)
    if (this.mountedComponents.size === 1) {
      // 第一个组件注册时开始监听
      this.startListening()
    }
  }

  // 注销组件
  unregisterComponent(componentId: string) {
    this.mountedComponents.delete(componentId)
    if (this.mountedComponents.size === 0) {
      // 最后一个组件注销时停止监听
      this.stopListening()
    }
  }

  // 获取状态
  getStatus() {
    return {
      isListening: this.isListening,
      enableCopyOverride: this.enableCopyOverride,
      mountedComponents: this.mountedComponents.size,
      shouldShowQuoteBtn: this.shouldShowQuoteBtn,
      quoteBtnPosition: this.quoteBtnPosition,
      selectionPosition: this.selectionPosition,
      lastSelectedContent: this.lastSelectedContent,
      lastContextText: this.lastContextText,
      anchorContainer: this.anchorContainer,
    }
  }

  // 新增：设置锚点容器（用于静态锚定到滚动内容层）
  setAnchorContainer(container: HTMLElement | null) {
    this.anchorContainer = container
  }

  // 新增：计算引用按钮位置
  private calculateQuoteBtnPosition = () => {
    const { x, y, width, height } = this.selectionPosition

    // 若存在锚点容器，则相对锚点容器（内容层）计算，避免滚动错位
    const anchor = this.anchorContainer
    if (anchor) {
      const containerRect = anchor.getBoundingClientRect()
      const viewRelX = x - containerRect.left
      const viewRelY = y - containerRect.top

      // 水平居中对齐选区，中间偏移
      let left = viewRelX + width / 2 - this.QUOTE_BTN_WIDTH / 2
      // 默认放在上方
      const topSpace = viewRelY
      let top = viewRelY - this.QUOTE_BTN_SIZE - this.QUOTE_BTN_OFFSET
      if (topSpace < this.QUOTE_BTN_SIZE + 16) {
        // 上方空间不足，显示在下方
        top = viewRelY + height + this.QUOTE_BTN_OFFSET
      }

      // 边界处理 - 相对锚点容器的可视区域（client 尺寸）
      left = Math.max(8, Math.min(left, anchor.clientWidth - this.QUOTE_BTN_WIDTH - 8))
      top = Math.max(8, Math.min(top, anchor.clientHeight - this.QUOTE_BTN_SIZE - 8))

      this.quoteBtnPosition = {
        left: `${left}px`,
        top: `${top}px`
      }
      // 位置变化时通知UI更新
      this.updateStateAndNotify()
      return
    }

    // 回退：按视口坐标计算（无锚点容器时）
    const currentWindowWidth = window.innerWidth
    const currentWindowHeight = window.innerHeight
    
    // 计算居中位置 - 使用 absolute 定位
    let left = x + width / 2 - this.QUOTE_BTN_WIDTH / 2
    let top = y - this.QUOTE_BTN_SIZE - this.QUOTE_BTN_OFFSET

    // 判断上方空间是否足够
    const topSpace = y
    
    if (topSpace < this.QUOTE_BTN_SIZE + 16) {
      // 上方空间不足，显示在下方
      top = y + height + this.QUOTE_BTN_OFFSET
      
      // 防止超出底部
      if (top + this.QUOTE_BTN_SIZE > currentWindowHeight) {
        top = currentWindowHeight - this.QUOTE_BTN_SIZE - 8
      }
    } else {
      // 上方空间足够，显示在上方
      // 防止超出顶部
      if (top < 8) {
        top = 8
      }
    }

    // 边界处理 - 确保不超出视口左右边界
    left = Math.max(8, Math.min(left, currentWindowWidth - this.QUOTE_BTN_WIDTH - 8))

    this.quoteBtnPosition = {
      left: `${left}px`,
      top: `${top}px`
    }
    
    // 位置变化时通知UI更新
    this.updateStateAndNotify()
  }

  // 新增：显示引用按钮
  private showQuoteBtn = () => {
    this.shouldShowQuoteBtn = true
    this.calculateQuoteBtnPosition()
    this.updateStateAndNotify()
  }

  // 新增：隐藏引用按钮
  private hideQuoteBtn = () => {
    this.shouldShowQuoteBtn = false
    this.updateStateAndNotify()
  }

  // 新增：处理窗口大小变化（用 rAF 合并多次触发）
  private handleWindowResize = () => {
    if (!this.shouldShowQuoteBtn) return
    if (this.resizeRafId) {
      cancelAnimationFrame(this.resizeRafId)
      this.resizeRafId = null
    }
    this.resizeRafId = requestAnimationFrame(() => {
      try {
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()

          if (rect && selection.toString().trim()) {
            // 只有rect真正变化时才刷新
            if (
              rect.left !== this.lastRect.x ||
              rect.top !== this.lastRect.y ||
              rect.width !== this.lastRect.width ||
              rect.height !== this.lastRect.height
            ) {
              this.selectionPosition = {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
              }
              this.calculateQuoteBtnPosition()
              this.lastRect = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
            }
          }
        }
      } catch (error) {
        this.hideQuoteBtn()
      } finally {
        this.resizeRafId = null
      }
    })
  }

  // 新增：处理选区变化
  private handleSelectionChange = () => {
    // 延迟检查，避免和 mouseup 冲突
    setTimeout(() => {
      // 🎯 兼容 ShadowDOM：尝试从 Shadow Root 获取选区
      let selection: Selection | null = null
      const firstArea = this.allowedQuoteSelectionAreas.values().next().value
      if (firstArea) {
        const root = firstArea.getRootNode()
        if (root !== document) {
          const shadowRoot = root as any
          if (shadowRoot.getSelection && typeof shadowRoot.getSelection === 'function') {
            selection = shadowRoot.getSelection()
          }
        }
      }
      
      if (!selection) {
        selection = window.getSelection()
      }
      
      if (!selection || selection.isCollapsed) {
        this.hideQuoteBtn()
      }
    }, 50)
  }

  // 防抖处理选区变化事件（增加延迟到 300ms，避免快速操作时按钮闪烁）
  private debouncedHandleSelectionChange = debounce(this.handleSelectionChange, 300)

  // 新增：处理键盘事件
  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.hideQuoteBtn()
    }
  }

  // 处理鼠标抬起事件
  private handleMouseUp = () => {
    // 延迟执行，避免点击事件和选区变化冲突
    setTimeout(() => {
      // 🎯 兼容 Shadow DOM：尝试从 Shadow Root 获取选区
      let selection: Selection | null = null
      
      // 检查是否有注册的区域在 Shadow DOM 中
      const firstArea = this.allowedQuoteSelectionAreas.values().next().value
      if (firstArea) {
        const root = firstArea.getRootNode()
        if (root !== document) {
          // 在 Shadow DOM 中
          // 注意：getSelection 不是标准 API，但在某些浏览器中支持
          const shadowRoot = root as any
          if (shadowRoot.getSelection && typeof shadowRoot.getSelection === 'function') {
            selection = shadowRoot.getSelection()
          }
        }
      }
      
      // 回退到主文档选区
      if (!selection) {
        selection = window.getSelection()
      }
      
      if (!selection || selection.rangeCount === 0) {
        this.hideQuoteBtn()
        return
      }

      const selectedText = selection.toString().trim()
      
      if (!selectedText) {
        this.hideQuoteBtn()
        return
      }

      // 获取选中范围
      const range = selection.getRangeAt(0)
      
      // 检查选区是否在允许的区域内
      if (!this.isSelectionInAllowedArea(range)) {
        this.hideQuoteBtn()
        return
      }
      
      // 记录选区所属的模型 slide（若存在）
      try {
        const startEl = (range.startContainer as any).nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : (range.startContainer as any).parentElement
        const endEl = (range.endContainer as any).nodeType === Node.ELEMENT_NODE
          ? (range.endContainer as Element)
          : (range.endContainer as any).parentElement

        const slideFromStart = startEl && (startEl as Element).closest?.('.answer-content-slide')
        const slideFromEnd = endEl && (endEl as Element).closest?.('.answer-content-slide')
        const slideEl = (slideFromStart as HTMLElement) || (slideFromEnd as HTMLElement) || null
        this.lastSelectedSlideModelId = slideEl?.getAttribute?.('data-model-id') || null
      } catch {
        this.lastSelectedSlideModelId = null
      }

      // 基于 aa 祖先容器构建上下文（支持跨多题）
      const startArea = this.getAncestorAllowedArea(range.startContainer)
      const endArea = this.getAncestorAllowedArea(range.endContainer)

      if (!startArea && !endArea) {
        this.hideQuoteBtn()
        return
      }

      // 🎯 优化：浮层环境跳过上下文构建（直接从 messageData 获取）
      const isInLayer = this.anchorContainer && this.anchorContainer.getRootNode() !== document
      
      if (!isInLayer) {
        // 侧边栏：构建跨多消息的上下文
        const anchor = startArea || endArea!
        const focus = endArea || startArea!
        const coveredAreas = this.getAreaRange(anchor, focus)
        this.lastContextText = this.buildContextFromAreas(coveredAreas)
      } else {
        // 浮层：清空上下文（不使用）
        this.lastContextText = ''
      }
      
      const rect = range.getBoundingClientRect()
      
      if (!rect) {
        this.hideQuoteBtn()
        return
      }

      // 更新选区位置
      this.selectionPosition = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }
      this.lastRect = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      
      // 提取数学公式的语义信息
      const selectedElements: Element[] = []
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (range.intersectsNode(node)) {
              selectedElements.push(node as Element)
              return NodeFilter.FILTER_ACCEPT
            }
            return NodeFilter.FILTER_REJECT
          }
        }
      )
      
      while (walker.nextNode()) {
        // 继续遍历
      }
      
      const mathSemantics = this.extractMathSemantics(selectedElements)
      
      // 生成混合的文字+公式串
      const mixedContent = this.generateMixedContent(range, mathSemantics)
      
      // 保存最后选中的混合内容
      this.lastSelectedContent = mixedContent

      // 显示引用按钮
      this.showQuoteBtn()
    }, 10)  // 10ms 延迟，确保选区状态稳定
  }

  // 提取数学公式信息的函数
  private extractMathSemantics = (elements: Element[]): Array<{
    type: 'inline' | 'block',
    latex: string,
    ascii: string,
    mathml: string,
    latexSource: string,
    element: Element
  }> => {
    const mathSemantics: Array<{
      type: 'inline' | 'block',
      latex: string,
      ascii: string,
      mathml: string,
      latexSource: string,
      element: Element
    }> = []

    elements.forEach(element => {
      // 检查是否是数学公式容器
      if (element.classList.contains('math-inline') || element.classList.contains('math-block')) {
        const mathElement = element.querySelector('math')
        
        if (mathElement) {
          const type = element.classList.contains('math-block') ? 'block' : 'inline'
          
          // 从math标签获取LaTeX源码
          const latexSource = mathElement.getAttribute('data-latex') || ''
          
          // 从latex标签获取LaTeX源码
          const latexElement = element.querySelector('latex')
          const latex = latexElement?.textContent || ''
          
          // 从asciimath标签获取ASCII源码
          const asciiElement = element.querySelector('asciimath')
          const ascii = asciiElement?.textContent || ''
          
          // 获取MathML源码
          const mathml = mathElement.outerHTML || ''
          
          mathSemantics.push({
            type,
            latex,
            ascii,
            mathml,
            latexSource,
            element
          })
        }
      }
    })

    return mathSemantics
  }

  // 生成混合的文字+公式串
  private generateMixedContent = (range: Range, _mathSemantics: Array<{
    type: 'inline' | 'block',
    latex: string,
    ascii: string,
    mathml: string,
    latexSource: string,
    element: Element
  }>): string => {
    // 检查选区是否完全在公式内部
    const startContainer = range.startContainer
    const endContainer = range.endContainer
    
    // 找到选区开始和结束位置最近的数学容器
    const startMathContainer = startContainer.nodeType === Node.ELEMENT_NODE 
      ? (startContainer as Element).closest('.math-inline, .math-block')
      : (startContainer as any).parentElement?.closest('.math-inline, .math-block')
    
    const endMathContainer = endContainer.nodeType === Node.ELEMENT_NODE 
      ? (endContainer as Element).closest('.math-inline, .math-block')
      : (endContainer as any).parentElement?.closest('.math-inline, .math-block')
    
    // 如果选区完全在同一个公式内部，直接返回该公式的LaTeX
    if (startMathContainer && endMathContainer && startMathContainer === endMathContainer) {
      const math = startMathContainer.querySelector('math')
      const latex = math?.getAttribute('data-latex') || ''
      return latex ? `$${latex}$` : ''
    }
    
    // 否则按正常逻辑处理混合内容
    let result = ''
    const processedMath = new Set<Element>()

    // 🎯 修复 ShadowDOM：从选区的共同祖先容器查询，而非 document
    const searchRoot = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
      ? range.commonAncestorContainer as Element
      : (range.commonAncestorContainer as any).parentElement || document
    
    const mathContainers = Array.from(searchRoot.querySelectorAll('.math-inline, .math-block'))
      .filter((container): container is Element => range.intersectsNode(container as Node))
      .sort((a, b) => {
        const aPos = a.compareDocumentPosition(b)
        return aPos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })

    // 如果包含数学公式，需要按顺序处理文字和公式
    if (mathContainers.length > 0) {
      // 创建一个临时的文档片段来模拟选区内容
      const tempDiv = document.createElement('div')
      tempDiv.appendChild(range.cloneContents())
      
      // 遍历所有子节点，按顺序处理
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element
              // 只处理数学容器，跳过内部元素
              if (el.classList.contains('math-inline') || el.classList.contains('math-block')) {
                return NodeFilter.FILTER_ACCEPT
              }
              // 跳过MathML内部元素
              if ((el as any).closest && (el as any).closest('.math-inline, .math-block')) {
                return NodeFilter.FILTER_REJECT
              }
            }
            return NodeFilter.FILTER_ACCEPT
          }
        }
      )

      let current = walker.nextNode()
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          result += current.textContent || ''
        } else if (current.nodeType === Node.ELEMENT_NODE) {
          const el = current as Element
          if (el.classList.contains('math-inline') || el.classList.contains('math-block')) {
            if (!processedMath.has(el)) {
              const math = el.querySelector('math')
              const latex = math?.getAttribute('data-latex') || ''
              if (latex) {
                result += `$${latex}$`
                processedMath.add(el)
              }
            }
          }
        }
        current = walker.nextNode()
      }
    } else {
      // 如果不包含数学公式，直接提取文本
      result = range.toString()
    }

    return result.replace(/\s+/g, ' ').trim()
  }

  // 处理复制事件
  private handleCopy = (event: ClipboardEvent) => {
    // 只有在启用复制功能时才处理
    if (!this.enableCopyOverride) {
      return
    }

    const selection = window.getSelection()
    
    if (!selection || selection.rangeCount === 0) {
      return
    }

    const selectedText = selection.toString().trim()
    
    if (!selectedText) {
      return
    }

    // 检查是否有保存的混合内容
    if (this.lastSelectedContent && this.lastSelectedContent !== selectedText) {
      // 阻止默认的复制行为
      event.preventDefault()
      
      // 设置自定义的复制内容
      event.clipboardData?.setData('text/plain', this.lastSelectedContent)
    }
  }

  // 开始监听
  private startListening = () => {
    if (this.isListening) return
    
    document.addEventListener('mouseup', this.handleMouseUp)
    document.addEventListener('selectionchange', this.debouncedHandleSelectionChange)
    document.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('resize', this.handleWindowResize)
    
    // 只有在启用复制功能时才添加复制事件监听
    if (this.enableCopyOverride) {
      document.addEventListener('copy', this.handleCopy)
    }
    
    this.isListening = true
    console.log(`开始监听鼠标选区${this.enableCopyOverride ? '和复制事件' : ''}`)
  }

  // 停止监听
  private stopListening = () => {
    if (!this.isListening) return
    
    document.removeEventListener('mouseup', this.handleMouseUp)
    document.removeEventListener('selectionchange', this.debouncedHandleSelectionChange)
    document.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('resize', this.handleWindowResize)
    
    // 只有在启用复制功能时才移除复制事件监听
    if (this.enableCopyOverride) {
      document.removeEventListener('copy', this.handleCopy)
    }
    
    this.isListening = false
    console.log(`停止监听鼠标选区${this.enableCopyOverride ? '和复制事件' : ''}`)
  }

  // 新增：获取引用按钮状态
  getQuoteBtnState() {
    return {
      shouldShow: this.shouldShowQuoteBtn,
      position: this.quoteBtnPosition,
      selectionPosition: this.selectionPosition
    }
  }

  // 新增：隐藏引用按钮的公共方法
  hideQuoteButton() {
    this.hideQuoteBtn()
  }

  // 新增：区域管理方法
  registerQuoteSelectionArea(element: HTMLElement, index?: number, message?: any) {
    this.allowedQuoteSelectionAreas.add(element)
    this.allowedAreaMeta.set(element, { index, message })
  }

  unregisterQuoteSelectionArea(element: HTMLElement) {
    this.allowedQuoteSelectionAreas.delete(element)
    this.allowedAreaMeta.delete(element)
  }

  clearAllQuoteSelectionAreas() {
    this.allowedQuoteSelectionAreas.clear()
    this.allowedAreaMeta.clear()
  }

  // 新增：检查元素是否仍然存在于 DOM 中（兼容 Shadow DOM）
  private isElementInDOM(element: HTMLElement): boolean {
    // 检查主文档
    if (document.contains(element)) return true
    
    // 检查 Shadow DOM（浮层在 Shadow DOM 中）
    // 通过 getRootNode 获取元素所在的根节点
    const root = element.getRootNode()
    if (root && root !== document) {
      // 如果根节点是 ShadowRoot，检查 host 是否在 DOM 中
      const shadowRoot = root as ShadowRoot
      if (shadowRoot.host && document.contains(shadowRoot.host)) {
        return true
      }
    }
    
    return false
  }

  // 新增：兼容 Shadow DOM 的 contains 检查
  private shadowDOMContains(parent: HTMLElement, child: Element): boolean {
    // 先尝试直接的 contains 检查
    if (parent.contains(child)) {
      return true
    }

    // 检查是否在同一个 Shadow Root 中
    const parentRoot = parent.getRootNode()
    const childRoot = child.getRootNode()

    // 如果在同一个 root 中，使用原生 contains
    if (parentRoot === childRoot) {
      return parent.contains(child)
    }

    // 如果 child 在 Shadow DOM 中，检查其 host 是否在 parent 中
    if (childRoot !== document && childRoot !== child) {
      const shadowRoot = childRoot as ShadowRoot
      if (shadowRoot.host) {
        return this.shadowDOMContains(parent, shadowRoot.host as Element)
      }
    }

    return false
  }

  // 新增：清理无效的区域引用
  private cleanupInvalidAreas() {
    const validAreas = new Set<HTMLElement>()
    
    for (const area of this.allowedQuoteSelectionAreas) {
      if (this.isElementInDOM(area)) {
        validAreas.add(area)
      } else {
        console.warn('[QuoteSelection] 清理无效的划词区域:', area, 'isInDOM:', document.contains(area))
      }
    }
    
    this.allowedQuoteSelectionAreas = validAreas
  }

  // 新增：检测选区是否在允许的区域内
  private isSelectionInAllowedArea(range: Range): boolean {
    // 先清理无效的区域引用
    this.cleanupInvalidAreas()
    
    if (this.allowedQuoteSelectionAreas.size === 0) {
      console.log('没有注册的划词区域，禁用划词功能')
      return false
    }

    // 检查选区的开始和结束节点是否在允许的区域内
    const startContainer = range.startContainer
    const endContainer = range.endContainer

    // 获取节点的实际元素（如果是文本节点，获取其父元素）
    const getElementFromNode = (node: Node): Element | null => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return node as Element
      } else if (node.nodeType === Node.TEXT_NODE) {
        return (node as any).parentElement
      }
      return null
    }

    const startElement = getElementFromNode(startContainer)
    const endElement = getElementFromNode(endContainer)

    if (!startElement || !endElement) {
      return false
    }

    // 放宽规则：起点与终点分别落在任意已注册区域即可（不要求同一容器）
    let startInside = false
    let endInside = false
    for (const allowedArea of this.allowedQuoteSelectionAreas) {
      // 🎯 使用兼容 Shadow DOM 的 contains 检查
      if (!startInside && this.shadowDOMContains(allowedArea, startElement)) {
        startInside = true
      }
      if (!endInside && this.shadowDOMContains(allowedArea, endElement)) {
        endInside = true
      }
      if (startInside && endInside) break
    }

    return startInside && endInside
  }

  // 新增：从节点向上查找所属的 aa 容器
  private getAncestorAllowedArea(node: Node): HTMLElement | null {
    let current: HTMLElement | null = (node as any).nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node as any).parentElement
        while (current) {
      if (this.allowedQuoteSelectionAreas.has(current)) return current
          current = current.parentElement
        }
        return null
      }
      
  // 新增：获取已注册区域的文档顺序数组
  private getOrderedAllowedAreas(): HTMLElement[] {
    return Array.from(this.allowedQuoteSelectionAreas).sort((a, b) => {
      const pos = a.compareDocumentPosition(b)
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
      return 0
    })
  }

  // 新增：获取两区域（含端点）之间覆盖的区域列表（按文档顺序）
  private getAreaRange(startEl: HTMLElement, endEl: HTMLElement): HTMLElement[] {
    const ordered = this.getOrderedAllowedAreas()
    const startIdx = ordered.indexOf(startEl)
    const endIdx = ordered.indexOf(endEl)
    if (startIdx === -1 && endIdx === -1) return []
    if (startIdx === -1) return [endEl]
    if (endIdx === -1) return [startEl]
    const [s, e] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
    return ordered.slice(s, e + 1)
  }

  // 新增：根据消息元数据提取用户文本（参考 StepBlock 规则）
  private extractUserTextFromMessageMeta(metaMessage: any): string {
    try {
      const isUser = metaMessage?.type === 'user'
      const content = isUser ? metaMessage?.content : metaMessage?.userContent
      if (!content) return ''

      // 🎯 优先从 attachments.selection 提取（Summary/Explain 消息）
      if (content.attachments?.selection?.content) {
        return content.attachments.selection.content.trim()
      }
      
      // 🎯 从 attachments.quote 提取（Quote 消息）
      if (content.attachments?.quote) {
        const parts: string[] = []
        // 用户问题
        if (content.attachments.quote.user_question) {
          parts.push(content.attachments.quote.user_question.trim())
        }
        // 高亮文本（上下文）
        if (content.attachments.quote.highlighted_text) {
          parts.push(content.attachments.quote.highlighted_text.trim())
        }
        // 原始上下文
        if (content.attachments.quote.context && !parts.length) {
          parts.push(content.attachments.quote.context.trim())
        }
        if (parts.length > 0) {
          return parts.join('\n').trim()
        }
      }

      const prompt: string | undefined = content.prompt
      const type: string | undefined = content.type
      const value: string | undefined = content.value

      let messageContent = ''
      if (typeof prompt === 'string' && prompt.trim()) {
        messageContent += prompt.trim()
      }

      const TYPES_NEED_VALUE = new Set(['text', 'text_solve', 'selection'])
      if (TYPES_NEED_VALUE.has(type || '') && typeof value === 'string' && value.trim()) {
        if (messageContent) messageContent += '\n'
        messageContent += value.trim()
      }
      
      // 🎯 降级：尝试解析 JSON 格式的 value（Summary 可能这样存储）
      if (!messageContent && typeof value === 'string' && value.trim()) {
        try {
          const parsed = JSON.parse(value)
          if (parsed.content && typeof parsed.content === 'string') {
            messageContent = parsed.content.trim()
          }
        } catch {
          // 不是 JSON，忽略
        }
      }

      return messageContent.trim()
    } catch {
      return ''
    }
  }

  // 优先从 aa 容器属性读取用户文本
  private extractUserTextFromArea(areaEl: HTMLElement, metaMessage: any): string {
    const attr = areaEl.getAttribute('data-user-text')
    if (attr && attr.trim()) return attr.trim()
    return this.extractUserTextFromMessageMeta(metaMessage)
  }

  // 新增：从 aa 容器中提取答案文本（优先容器属性/元数据，回退DOM，排除 thinking）
  private extractAnswerTextFromMetaOrArea(metaMessage: any, areaEl: HTMLElement): string {
    try {
      // 🎯 多模型优先：若已记录选区所在的模型 slide，则优先读取该 slide 的结构化答案
      if (this.lastSelectedSlideModelId) {
        const scopedSlide = areaEl.querySelector(
          `.answer-content-slide[data-model-id="${this.lastSelectedSlideModelId}"]`
        ) as HTMLElement | null
        const scopedAnswer = scopedSlide?.getAttribute('data-structured-answer') || ''
        if (scopedAnswer && scopedAnswer.trim()) return scopedAnswer.trim()
      }

      // 🎯 退化优先：尝试查找最近的 answer-content-slide（作为兜底）
      const slideEl = areaEl.closest('.answer-content-slide') as HTMLElement | null
      if (slideEl) {
        const structuredAnswer = slideEl.getAttribute('data-structured-answer')
        if (structuredAnswer && structuredAnswer.trim()) return structuredAnswer.trim()
      }
      
      // 0) aa 容器 data-structured-answer（与渲染块一致，已排除 thinking）
      const byStructured = areaEl.getAttribute('data-structured-answer')
      if (byStructured && byStructured.trim()) return byStructured.trim()

      // 1) 其次：aa 容器 data-raw-answer（若有，通常也已处理过）
      const byAttr = areaEl.getAttribute('data-raw-answer')
      if (byAttr && byAttr.trim()) return byAttr.trim()

      // 2) 使用 message.answer 原始字符串，移除 thinking 内容
      const originalAnswer: string = metaMessage?.answer || ''
      const thinkingContent: string = metaMessage?.answerJsonObject?.thinking?.content || ''
      if (originalAnswer) {
        const cleaned = thinkingContent
          ? originalAnswer.replace(thinkingContent, '').trim()
          : originalAnswer.trim()
        if (cleaned) return cleaned
      }
    } catch {}

    // 3) 回退：尝试从 aa 子树上暴露的结构化/原始属性读取
    try {
      const rawNode = (areaEl.matches('[data-structured-answer],[data-raw-answer]')
        ? areaEl
        : areaEl.querySelector('[data-structured-answer],[data-raw-answer]')) as HTMLElement | null
      const structured = rawNode?.getAttribute('data-structured-answer') || ''
      if (structured && structured.trim()) return structured.trim()
      const raw = rawNode?.getAttribute('data-raw-answer') || ''
      if (raw && raw.trim()) return raw.trim()
    } catch {}

    // 4) 最后回退：DOM 提取（剔除 thinking 可见块）
    const answerRoot = areaEl.querySelector('.answer-info') as HTMLElement | null

    const collectFromContainer = (container: HTMLElement): string => {
      const blocks = container.querySelectorAll('.answer-block')
      if (blocks.length > 0) {
        const pieces: string[] = []
        blocks.forEach((blk) => {
          if ((blk as HTMLElement).querySelector('.thinking-content')) return
          pieces.push((blk as HTMLElement).innerText.trim())
        })
        return pieces.filter(Boolean).join('\n').trim()
      }
      return container.innerText
        .replace(/Thinking\s+for\s+\d+\s*s?/gi, '')
        .trim()
    }

    if (answerRoot) return collectFromContainer(answerRoot)

    const fallbackBlocks = areaEl.querySelectorAll('.answer-block')
    if (fallbackBlocks.length > 0) {
      const pieces: string[] = []
      fallbackBlocks.forEach((blk) => {
        if ((blk as HTMLElement).querySelector('.thinking-content')) return
        pieces.push((blk as HTMLElement).innerText.trim())
      })
      return pieces.filter(Boolean).join('\n').trim()
    }

    return areaEl.innerText.replace(/Thinking\s+for\s+\d+\s*s?/gi, '').trim()
  }

  // 新增：根据覆盖的 aa 容器构建上下文（用户文本 + 答案文本（优先容器/元数据））
  private buildContextFromAreas(areas: HTMLElement[]): string {
    // 将 areas 按文档顺序处理
    const ordered = areas

    // 全局有序列表（用于用户区未命中时，向后寻找相邻的服务消息）
    const globalOrdered = this.getOrderedAllowedAreas()

    const findNextServiceAreaGlobally = (currentArea: HTMLElement): HTMLElement | null => {
      const gi = globalOrdered.indexOf(currentArea)
      if (gi === -1) return null
      for (let k = gi + 1; k < globalOrdered.length; k++) {
        const meta = this.allowedAreaMeta.get(globalOrdered[k])
        if (meta?.message?.type === 'service') return globalOrdered[k]
      }
      return null
    }

    // 简化：先完整拼接，再统一截断到 8k
    const parts: string[] = []
    // 新增：记录已被用户消息配对过的服务消息容器，避免二次添加
    const pairedServiceAreas = new Set<HTMLElement>()

    for (let i = 0; i < ordered.length; i++) {
      const area = ordered[i]
      const meta = this.allowedAreaMeta.get(area)
      if (!meta) continue

      const msg = meta.message
      if (!msg) continue

      const userText = this.extractUserTextFromArea(area, msg)

      if (msg.type === 'service') {
        // 若该服务消息已被先前的用户消息配对过，则跳过，避免重复
        if (pairedServiceAreas.has(area)) {
          continue
        }
        const answerText = this.extractAnswerTextFromMetaOrArea(msg, area)
        const seg = [userText, answerText].filter(Boolean).join('\n').trim()
        if (seg) parts.push(seg)
        continue
      }

      // user 消息：优先与覆盖范围内的下一个 service 配对
      let nextArea = ordered[i + 1]
      let nextMeta = nextArea ? this.allowedAreaMeta.get(nextArea) : undefined

      // 若覆盖范围内没有 service，则在全局顺序中寻找紧随其后的第一个 service
      if (!(nextMeta?.message?.type === 'service')) {
        const globalNext = findNextServiceAreaGlobally(area)
        if (globalNext) {
          nextArea = globalNext
          nextMeta = this.allowedAreaMeta.get(globalNext)
        } else {
          nextArea = undefined as unknown as HTMLElement
          nextMeta = undefined
        }
      }

      if (nextMeta?.message?.type === 'service' && nextArea) {
        // 记录该服务区已被配对，后续遍历到它时跳过
        pairedServiceAreas.add(nextArea)
        const answerText = this.extractAnswerTextFromMetaOrArea(nextMeta.message, nextArea)
        const seg = [userText, answerText].filter(Boolean).join('\n').trim()
        if (seg) parts.push(seg)
        // 注意：不自增 i，因为全局 nextArea 可能不在本次覆盖范围里
      } else {
        // 仍未找到匹配的 service，仅保留用户文本
        if (userText) parts.push(userText)
      }
    }

    const combined = parts.join('\n\n')
    return combined.slice(0, this.MAX_CONTEXT_LENGTH)
  }

  // 新增：状态变化回调
  private stateChangeCallbacks: Array<() => void> = []

  // 新增：注册状态变化回调
  onStateChange(callback: () => void) {
    this.stateChangeCallbacks.push(callback)
  }

  // 新增：触发状态变化回调
  private triggerStateChange() {
    this.stateChangeCallbacks.forEach(callback => callback())
  }

  // 新增：更新状态并触发回调
  private updateStateAndNotify() {
    this.triggerStateChange()
  }
}

// Vue Composable 包装器
export function useQuoteSelection(options?: {
  enableCopyOverride?: boolean
}) {
  const manager = QuoteSelectionManager.getInstance()
  
  // 配置选项
  if (options) {
    manager.configure(options)
  }
  
  // 生成唯一的组件ID
  const componentId = `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`  // 响应式状态
  const shouldShowQuoteBtn = ref(false)
  const quoteBtnPosition = ref({ left: '0px', top: '0px' })
  const selectionPosition = ref({ x: 0, y: 0, width: 0, height: 0 })
  
  // 更新状态的函数
  const updateState = () => {
    const state = manager.getQuoteBtnState()
    shouldShowQuoteBtn.value = state.shouldShow
    quoteBtnPosition.value = state.position
    selectionPosition.value = state.selectionPosition
  }
  
  // 组件挂载时注册
  onMounted(() => {
    manager.registerComponent(componentId)
    
    // 注册状态变化回调
    manager.onStateChange(updateState)
  })
  
  // 组件卸载时注销
  onUnmounted(() => {
    manager.unregisterComponent(componentId)
  })
  
  return {
    shouldShowQuoteBtn,
    quoteBtnPosition,
    selectionPosition,
    getStatus: () => manager.getStatus(),
    configure: (options: { enableCopyOverride?: boolean }) => manager.configure(options),
    hideQuoteBtn: () => manager.hideQuoteButton(),
    // 新增：区域管理方法，支持传入 index 与 message 元信息
    registerQuoteSelectionArea: (element: HTMLElement, index?: number, message?: any) => manager.registerQuoteSelectionArea(element, index, message),
    unregisterQuoteSelectionArea: (element: HTMLElement) => manager.unregisterQuoteSelectionArea(element),
    clearAllQuoteSelectionAreas: () => manager.clearAllQuoteSelectionAreas(),
    // 新增：设置锚点容器（静态锚点方案）
    setAnchorContainer: (container: HTMLElement | null) => manager.setAnchorContainer(container),
  }
}
