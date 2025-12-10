import { marked } from 'marked'
import type { ImageInfo, DisplaySize } from './types'

class MarkdownRenderer {
  private renderer: InstanceType<typeof marked.Renderer>
  private imageInfo: Map<string, ImageInfo> = new Map()

  constructor() {
    this.renderer = new marked.Renderer()
    this.setupImageRenderer()
  }

  private setupImageRenderer(): void {
    // 只自定义图片渲染为占位符
    this.renderer.image = ({ href, title, text }) => {
      const placeholderId = this.generatePlaceholderId(href)
      const image = this.imageInfo.get(href)
      return `<div 
        id="${placeholderId}" 
        class="image-placeholder" 
        data-src="${href}"
        data-alt="${text || ''}"
        style="width:${image?.width},height:${image?.height}"
      >
        <span class="loading-text">Loading image...</span>
      </div>`
    }

    // 自定义代码块渲染为div直接显示内容
    this.renderer.code = ({ text }) => {
      return `<div>${text}</div>`
    }
  }

  async render(
    markdown: string,
    imageInfo: Map<string, ImageInfo>
  ): Promise<string> {
    this.imageInfo = imageInfo
    return await marked(markdown, {
      renderer: this.renderer,
      breaks: true,
      gfm: true,
    })
  }

  generatePlaceholderId(imageUrl: string): string {
    // 生成安全的HTML ID
    return `img-placeholder-${btoa(imageUrl)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16)}`
  }
}

class ProgressiveRenderer {
  private markdownRenderer: MarkdownRenderer
  private container: HTMLElement | null = null
  private imageInfoMap: Map<string, ImageInfo> = new Map()

  constructor() {
    this.markdownRenderer = new MarkdownRenderer()
  }

  async renderInitial(
    markdown: string,
    images: ImageInfo[]
  ): Promise<HTMLElement> {
    // 设置容器
    this.container = this.setupContainer()

    // 存储图片信息
    this.imageInfoMap.clear()
    images.forEach((img) => this.imageInfoMap.set(img.url, img))

    // 渲染markdown
    const html = await this.markdownRenderer.render(markdown, this.imageInfoMap)
    this.container.innerHTML = html

    // 设置占位符尺寸
    this.setupPlaceholderSizes()

    return this.container
  }

  async updateImage(imageUrl: string, base64Data: string): Promise<boolean> {
    if (!this.container) {
      console.warn('Container not initialized')
      return false
    }

    const placeholders = document.querySelectorAll(
      `div[data-src="${imageUrl}"]`
    )

    if (placeholders.length === 0) {
      console.warn(`Placeholder not found for: ${imageUrl}`)
      return false
    }

    try {
      // 检测是否为 SVG 文本
      const isSvg = base64Data.trim().includes('<svg')

      let element: HTMLElement

      if (isSvg) {
        // SVG 处理：直接创建 div 容器
        element = document.createElement('div')
        element.innerHTML = base64Data
        element.style.display = 'inline-block'

        // 设置尺寸
        const info = this.imageInfoMap.get(imageUrl)
        element.style.width = info?.width + 'px'
        element.style.height = info?.height + 'px'
      } else {
        // 原有的 img 处理逻辑
        const img = await this.createImageElement(base64Data, imageUrl)
        const info = this.imageInfoMap.get(imageUrl)
        img.style.width = info?.width + 'px'
        img.style.height = info?.height + 'px'
        element = img
      }

      // 统一的替换逻辑
      placeholders.forEach((placeholder, index) => {
        try {
          // 1. 获取 data-alt 属性值
          const altText = placeholder.getAttribute('data-alt') || ''

          // 2. 创建容器元素
          const container = document.createElement('div')
          container.className = 'image-container'

          // 3. 添加图片元素
          const imageElement = element.cloneNode(true) as HTMLElement
          container.appendChild(imageElement)

          // 4. 添加文本元素（如果有alt文本）
          if (altText.trim()) {
            const caption = document.createElement('p')
            caption.className = 'image-caption'
            caption.textContent = altText
            container.appendChild(caption)
          }

          // 5. 替换占位符
          placeholder.parentNode?.replaceChild(container, placeholder)
        } catch (error) {
          console.warn(
            `Failed to process placeholder ${index} for ${imageUrl}:`,
            error
          )
          // 降级处理：使用原来的替换方式
          placeholder.parentNode?.replaceChild(
            element.cloneNode(true),
            placeholder
          )
        }
      })
      return true
    } catch (error) {
      console.warn(`Failed to load image: ${imageUrl}`, error)
      return false
    }
  }

  getContainer(): HTMLElement | null {
    return this.container
  }

  cleanup(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
    this.imageInfoMap.clear()
  }

  private setupContainer(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'render-container'
    document.body.appendChild(container)
    return container
  }

  private setupPlaceholderSizes(): void {
    const placeholders = document.querySelectorAll('.image-placeholder')
    placeholders.forEach((placeholder) => {
      const imageUrl = placeholder.getAttribute('data-src')
      if (imageUrl && this.imageInfoMap.has(imageUrl)) {
        const imageInfo = this.imageInfoMap.get(imageUrl)!
        const displaySize = this.calculateDisplaySize(imageInfo)

        ;(placeholder as HTMLElement).style.width = `${displaySize.width}px`
        ;(placeholder as HTMLElement).style.height = `${displaySize.height}px`
      }
    })
  }

  private async createImageElement(
    base64Data: string,
    imageUrl: string
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = base64Data || imageUrl
    })
  }

  private calculateDisplaySize(imageInfo: ImageInfo): DisplaySize {
    const maxWidth = 720 // 为padding留出空间
    const maxHeight = 500

    const { width, height } = imageInfo

    // 计算缩放比例
    const scaleX = maxWidth / width
    const scaleY = maxHeight / height
    const scale = Math.min(scaleX, scaleY, 1) // 不放大

    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    }
  }
}

export class PageRenderer {
  private progressiveRenderer: ProgressiveRenderer

  constructor() {
    this.progressiveRenderer = new ProgressiveRenderer()
  }

  async startRender(
    markdown: string,
    images: ImageInfo[]
  ): Promise<HTMLElement> {
    return this.progressiveRenderer.renderInitial(markdown, images)
  }

  async updateImage(imageUrl: string, base64Data: string): Promise<boolean> {
    return this.progressiveRenderer.updateImage(imageUrl, base64Data)
  }

  getContainer(): HTMLElement | null {
    return this.progressiveRenderer.getContainer()
  }

  cleanup(): void {
    this.progressiveRenderer.cleanup()
  }
}
