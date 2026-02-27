/**
 * DOM 到 Markdown 转换工具 (MVP 增强版)
 * 包含针对飞书文档等特定场景的降噪逻辑
 * 
 * 懒加载问题说明：
 * 飞书等 SPA 使用懒加载，只有滚动到视口才会渲染 DOM。
 * 需要配合 content.ts 的 SCROLL_AND_EXTRACT 消息先滚动页面触发加载。
 */

interface ProcessContext {
  depth: number
  listType?: 'ul' | 'ol'
  listIndex?: number
  inPreBlock?: boolean
  onlyInViewport?: boolean
  // 用于追踪提取的内容数量，帮助调试
  extractedCount?: number
  // 图片提取相关
  extractImages?: boolean
  images?: ExtractedImage[]
  imageIndex?: number
}

export interface ImageInfo {
  url: string
  width: number
  height: number
}

/** 提取的图片信息（用于 PDF 合成） */
export interface ExtractedImage {
  /** 占位符，如 "[IMAGE_001]" */
  placeholder: string;
  /** 原始 src URL */
  src: string;
  /** alt 文本 */
  alt: string;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 位置类型 */
  position: 'inline' | 'block';
  /** 在文档中的顺序 */
  index: number;
}

export interface ConvertResult {
  markdown: string
}

/** 扩展的转换结果（包含图片信息） */
export interface ConvertResultWithImages extends ConvertResult {
  /** 提取的图片列表 */
  images: ExtractedImage[];
}

/**
 * 核心入口函数
 * @param rootNode 文档根节点 (通常是 document.body)
 * @param options 配置项
 */
export function convertDOMToMarkdown(rootNode: Node, options: { checkSelectors?: boolean, onlyInViewport?: boolean } = { checkSelectors: true, onlyInViewport: false }): ConvertResult {
  const context: ProcessContext = {
    depth: 0,
    onlyInViewport: options.onlyInViewport
  }

  // 1. 智能容器定位 (针对飞书文档等)
  let targetNode = rootNode;
  if (options.checkSelectors && rootNode instanceof Element) {
     // 飞书文档专用选择器（按优先级排列，从最具体到最通用）
     const feishuSelectors = [
         // 新版飞书文档结构
         '.docs-reader-root',                    // 飞书文档阅读器根节点
         '.docs-reader-container',               // 飞书文档阅读器容器
         '.docs-reader',                         // 飞书文档阅读模式
         '.wiki-content',                        // 飞书 Wiki 主内容区
         '.doc-render-container',                // 飞书文档渲染容器
         '.docx-block-container',                // 飞书 Docx 块容器
         '.docx-core-block',                     // 飞书文档核心块
         '.page-main-in-wiki-md',                // 飞书 Wiki Markdown
         '.page-main',                           // 飞书文档主区域
         '[data-page-id]',                       // 飞书页面 ID 属性
         '.docx-container',                      // 飞书 Docx 容器
         '.lark-editor',                         // Lark 编辑器
         '.editor-content-container',            // 编辑器内容容器
         '.fe-render-container',                 // 飞书渲染容器
         '.render-container',                    // 通用渲染容器
         // 飞书文档内容滚动区
         '.page-block-children',                 // 页面子块
         '.block-container',                     // 块容器
         '[data-block-type]',                    // 飞书块类型属性
     ];
     
     // 通用选择器
     const genericSelectors = [
         'article',                              // 语义化标签
         '[role="main"]',                        // ARIA main
         'main',                                 // 主内容标签
         '#content',                             // 通用 ID
         '.content',                             // 通用 class
         '.main-content',                        // 通用 class
         '.article-content',                     // 文章内容
         '.post-content',                        // 帖子内容
     ];
     
     const allSelectors = [...feishuSelectors, ...genericSelectors];

     for (const selector of allSelectors) {
         try {
             const found = (rootNode as Element).querySelector(selector);
             if (found && found.textContent && found.textContent.trim().length > 100) {
                 console.log(`[DOM Extractor] Located main container: ${selector} (${found.textContent.length} chars)`);
                 targetNode = found;
                 break;
             }
         } catch (e) {
             // 某些选择器可能无效，忽略
             continue;
         }
     }
     
     // 如果没找到合适的容器，尝试找最大的文本块
     if (targetNode === rootNode) {
         const candidates = (rootNode as Element).querySelectorAll('div, section, article');
         let best: Element | null = null;
         let bestLength = 0;
         
         candidates.forEach(el => {
             const text = el.textContent || '';
             // 即使元素不在视口中（可能是懒加载后的内容），也要考虑
             // 选择文本内容最多的元素
             if (text.length > bestLength) {
                 // 确保不是整个 body 或太浅的容器
                 if (el !== rootNode && !el.querySelector('body')) {
                     // 确保有实质内容（排除只有空白的元素）
                     const cleanText = text.replace(/\s+/g, '');
                     if (cleanText.length > 50) {
                         bestLength = text.length;
                         best = el;
                     }
                 }
             }
         });
         
         if (best && bestLength > 200) {
             console.log(`[DOM Extractor] Fallback to largest text block (${bestLength} chars)`);
             targetNode = best;
         }
     }
     
     // 调试输出：显示找到的容器信息
     if (targetNode !== rootNode) {
         const tagName = (targetNode as Element).tagName?.toLowerCase() || 'unknown';
         const className = (targetNode as Element).className || '';
         console.log(`[DOM Extractor] Final container: <${tagName} class="${className}">`);
     }
  }

  // 2. 递归处理
  const result = processNode(targetNode, context)
  const markdown = result.replace(/\n{3,}/g, '\n\n').trim()

    return {
        markdown,
      }
}

/**
 * 带图片提取的 DOM 转 Markdown
 * 图片会被替换为占位符 [IMAGE_001]，并收集图片信息用于后续下载和 PDF 合成
 *
 * @param rootNode 文档根节点
 * @param options 配置项
 * @returns 包含 markdown 和提取的图片列表
 */
export function convertDOMToMarkdownWithImages(
  rootNode: Node,
  options: { checkSelectors?: boolean; onlyInViewport?: boolean } = {
    checkSelectors: true,
    onlyInViewport: false,
  }
): ConvertResultWithImages {
  const images: ExtractedImage[] = [];

  const context: ProcessContext = {
    depth: 0,
    onlyInViewport: options.onlyInViewport,
    extractImages: true,
    images,
    imageIndex: 0,
  };

  // 1. 智能容器定位 (复用现有逻辑)
  let targetNode = rootNode;
  if (options.checkSelectors && rootNode instanceof Element) {
    const feishuSelectors = [
      '.docs-reader-root',
      '.docs-reader-container',
      '.docs-reader',
      '.wiki-content',
      '.doc-render-container',
      '.docx-block-container',
      '.docx-core-block',
      '.page-main-in-wiki-md',
      '.page-main',
      '[data-page-id]',
      '.docx-container',
      '.lark-editor',
      '.editor-content-container',
      '.fe-render-container',
      '.render-container',
      '.page-block-children',
      '.block-container',
      '[data-block-type]',
    ];

    const genericSelectors = [
      'article',
      '[role="main"]',
      'main',
      '#content',
      '.content',
      '.main-content',
      '.article-content',
      '.post-content',
    ];

    const allSelectors = [...feishuSelectors, ...genericSelectors];

    for (const selector of allSelectors) {
      try {
        const found = (rootNode as Element).querySelector(selector);
        if (found && found.textContent && found.textContent.trim().length > 100) {
          console.log(
            `[DOM Extractor] Located main container: ${selector} (${found.textContent.length} chars)`
          );
          targetNode = found;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (targetNode === rootNode) {
      const candidates = (rootNode as Element).querySelectorAll('div, section, article');
      let best: Element | null = null;
      let bestLength = 0;

      candidates.forEach((el) => {
        const text = el.textContent || '';
        if (text.length > bestLength) {
          if (el !== rootNode && !el.querySelector('body')) {
            const cleanText = text.replace(/\s+/g, '');
            if (cleanText.length > 50) {
              bestLength = text.length;
              best = el;
            }
          }
        }
      });

      if (best && bestLength > 200) {
        console.log(`[DOM Extractor] Fallback to largest text block (${bestLength} chars)`);
        targetNode = best;
      }
    }

    if (targetNode !== rootNode) {
      const tagName = (targetNode as Element).tagName?.toLowerCase() || 'unknown';
      const className = (targetNode as Element).className || '';
      console.log(`[DOM Extractor] Final container: <${tagName} class="${className}">`);
    }
  }

  // 2. 递归处理
  const result = processNode(targetNode, context);
  const markdown = result.replace(/\n{3,}/g, '\n\n').trim();

  console.log(`[DOM Extractor] Extracted ${images.length} images`);

  return {
    markdown,
    images,
  };
}

function isElementInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    // 只要有一部分在视口内，或者完全包围了视口，都算
    // 包围视口：top < 0 && bottom > window.innerHeight
    // 在视口内：bottom > 0 && top < window.innerHeight
    return (
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth
    );
}

function processNode(
  node: Node,
  context: ProcessContext
): string {
  if (shouldIgnoreNode(node, context)) return ''

  if (node.nodeType === Node.TEXT_NODE) {
    // 文本节点本身没有 bounding rect，通常依赖父元素判断
    return context.inPreBlock
      ? node.textContent || ''
      : normalizeWhitespace(node.textContent || '')
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    
    // 视口过滤 (如果开启)
    if (context.onlyInViewport && !isElementInViewport(element)) {
        // 如果元素很大（比如容器），它虽然 bounding rect 符合条件，但我们可能还要递归
        // 如果元素完全在视口外，直接忽略
        // 但是 processNode 是递归调用的。如果父元素在视口内，子元素可能不在。
        // 简单起见：如果该元素完全不在视口内，则跳过。
        // 注意：isElementInViewport 已经处理了“部分在视口内”的情况。
        return '';
    }

    const tagName = element.tagName.toLowerCase()

    // ========== 通用表格：不保留表格结构，转为列表/文本 ==========
    // 目标：只保留标题、文本、列表、序列、图片等信息，不输出 Markdown 表格语法。
    if (tagName === 'table') {
      return processHtmlTableAsList(element, context)
    }
    
    // 处理段落
    if (tagName === 'p') {
      return '\n\n' + processChildrenNodes(element, context) + '\n\n'
    }
    
    // Feishu Specific: Headers
    // e.g. <div class="block docx-heading1-block">
    const className = element.className;
    if (typeof className === 'string') {
        // ========== 飞书标题块 ==========
        if (className.includes('docx-heading1-block') || className.includes('heading-h1')) {
            const content = element.querySelector('.heading-content, .text-container, [data-content-editable-leaf]');
            if (content) {
                return '\n\n---\n\n# ' + processNode(content, context).trim() + '\n\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n\n---\n\n# ' + text + '\n\n';
            return '\n\n---\n\n# ' + processChildrenNodes(element, context) + '\n\n';
        }
        if (className.includes('docx-heading2-block') || className.includes('heading-h2')) {
            const content = element.querySelector('.heading-content, .text-container, [data-content-editable-leaf]');
            if (content) {
                return '\n\n---\n\n## ' + processNode(content, context).trim() + '\n\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n\n---\n\n## ' + text + '\n\n';
            return '\n\n---\n\n## ' + processChildrenNodes(element, context) + '\n\n';
        }
        if (className.includes('docx-heading3-block') || className.includes('heading-h3')) {
            const content = element.querySelector('.heading-content, .text-container, [data-content-editable-leaf]');
            if (content) {
                return '\n\n---\n\n### ' + processNode(content, context).trim() + '\n\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n\n---\n\n### ' + text + '\n\n';
            return '\n\n---\n\n### ' + processChildrenNodes(element, context) + '\n\n';
        }
        if (className.includes('docx-heading4-block') || className.includes('heading-h4')) {
            const content = element.querySelector('.heading-content, .text-container, [data-content-editable-leaf]');
            if (content) {
                return '\n\n#### ' + processNode(content, context).trim() + '\n\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n\n#### ' + text + '\n\n';
            return '\n\n#### ' + processChildrenNodes(element, context) + '\n\n';
        }
        if (className.includes('docx-heading5-block') || className.includes('heading-h5')) {
            const content = element.querySelector('.heading-content, .text-container');
            if (content) {
                return '\n\n##### ' + processNode(content, context).trim() + '\n\n';
            }
            return '\n\n##### ' + processChildrenNodes(element, context) + '\n\n';
        }
        
        // ========== 飞书表格块 ==========
        if (className.includes('docx-table-block') || className.includes('table-block')) {
            return processFeishuTable(element, context);
        }

        // ========== 飞书列表块 ==========
        if (className.includes('docx-ordered-block') || className.includes('ordered-list-block')) {
            return processFeishuList(element, context, 'ordered');
        }
        if (className.includes('docx-bullet-block') || className.includes('bullet-list-block') || className.includes('unordered-list-block')) {
            return processFeishuList(element, context, 'unordered');
        }
        
        // ========== 飞书图片块 ==========
        if (className.includes('docx-image-block') || className.includes('image-block')) {
            // 如果启用图片提取，查找块内的 img 元素
            if (context.extractImages && context.images) {
                const imgElement = element.querySelector('img') as HTMLImageElement | null;
                if (imgElement) {
                    const src = imgElement.src || imgElement.getAttribute('data-src') || '';
                    if (src && !(src.startsWith('data:') && src.length < 1000)) {
                        const index = context.imageIndex ?? 0;
                        context.imageIndex = index + 1;

                        const placeholder = `[IMAGE_${String(index + 1).padStart(3, '0')}]`;
                        const extractedImage: ExtractedImage = {
                            placeholder,
                            src,
                            alt: imgElement.alt || '',
                            width: imgElement.naturalWidth || imgElement.width || 0,
                            height: imgElement.naturalHeight || imgElement.height || 0,
                            position: 'block',
                            index,
                        };

                        context.images.push(extractedImage);
                        return `\n${placeholder}\n`;
                    }
                }
            }
            return '';
        }
        
        // ========== 飞书代码块 ==========
        if (className.includes('docx-code-block') || className.includes('code-block')) {
            const codeContent = element.querySelector('code, pre, .code-content');
            if (codeContent) {
                const lang = element.getAttribute('data-language') || '';
                return `\n\`\`\`${lang}\n${codeContent.textContent || ''}\n\`\`\`\n`;
            }
        }
        
        // ========== 飞书引用块 ==========
        if (className.includes('docx-quote-block') || className.includes('quote-block') || className.includes('blockquote')) {
            const quoteContent = element.textContent?.trim() || '';
            if (quoteContent) {
                return `\n> ${quoteContent.replace(/\n/g, '\n> ')}\n`;
            }
        }
        
        // ========== 飞书分割线 ==========
        if (className.includes('docx-divider-block') || className.includes('divider-block') || className.includes('hr-block')) {
            return '\n---\n';
        }
        
        // ========== 飞书普通文本块 ==========
        if (className.includes('docx-text-block') || className.includes('text-block') || className.includes('docx-paragraph')) {
            const textContent = element.querySelector('.text-container, [data-content-editable-leaf], .render-unit');
            if (textContent) {
                const text = processNode(textContent, context).trim();
                if (text) return '\n' + text + '\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n' + text + '\n';
        }
        
        // ========== 飞书待办/任务块 ==========
        if (className.includes('docx-todo-block') || className.includes('todo-block') || className.includes('task-block')) {
            const checkbox = element.querySelector('[type="checkbox"], .checkbox, .todo-checkbox');
            const isChecked = checkbox?.hasAttribute('checked') || checkbox?.classList.contains('checked');
            const content = element.textContent?.trim() || '';
            return `\n- [${isChecked ? 'x' : ' '}] ${content}\n`;
        }
        
        // ========== 飞书折叠块（展开提取内容）==========
        if (className.includes('docx-toggle-block') || className.includes('toggle-block') || className.includes('collapsible-block')) {
            // 折叠块可能有标题和内容两部分
            const title = element.querySelector('.toggle-title, .collapse-title')?.textContent?.trim() || '';
            const content = element.querySelector('.toggle-content, .collapse-content');
            let result = title ? `\n**${title}**\n` : '';
            if (content) {
                result += processNode(content, context);
            }
            return result;
        }
    }
    
    // 增强：处理交互元素，保留语义
    if (tagName === 'button') {
        const text = element.textContent?.trim() || '';
        // Ignore generic buttons or empty buttons or specific UI buttons
        if (!text || text === 'Button' || element.classList.contains('comment-btn') || element.querySelector('svg')) {
             return '';
        }
        
        // Ignore list order buttons if they are being handled by processFeishuList
        if (element.classList.contains('order') || element.classList.contains('heading-order')) {
             if (/^\d+\.$/.test(text)) return text + ' ';
             return '';
        }

        const id = element.id ? `(#${element.id})` : '';
        return ` [BUTTON: ${text}${id}] `;
    }
    if (tagName === 'a') {
        const text = element.textContent?.trim() || 'Link';
        const href = element.getAttribute('href') || '#';
        return ` [LINK: ${text}](${href}) `;
    }
    if (tagName === 'input') {
        const type = element.getAttribute('type') || 'text';
        const placeholder = element.getAttribute('placeholder') || '';
        return ` [INPUT: ${type} | ${placeholder}] `;
    }
    if (tagName === 'img') {
        // 如果启用图片提取，生成占位符并收集图片信息
        if (context.extractImages && context.images) {
            const imgElement = element as HTMLImageElement;
            const src = imgElement.src || imgElement.getAttribute('data-src') || '';

            // 跳过空 src 或 data URI（太小的图片）
            if (!src || (src.startsWith('data:') && src.length < 1000)) {
                return '';
            }

            // 跳过太小的图片（可能是图标）
            const width = imgElement.naturalWidth || imgElement.width || 0;
            const height = imgElement.naturalHeight || imgElement.height || 0;
            if (width > 0 && height > 0 && width < 50 && height < 50) {
                return '';
            }

            const index = context.imageIndex ?? 0;
            context.imageIndex = index + 1;

            const placeholder = `[IMAGE_${String(index + 1).padStart(3, '0')}]`;
            const extractedImage: ExtractedImage = {
                placeholder,
                src,
                alt: imgElement.alt || '',
                width,
                height,
                position: 'block',
                index,
            };

            context.images.push(extractedImage);
            return `\n${placeholder}\n`;
        }

        // 不提取图片时跳过
        return '';
    }

    if (hasDirectTextNodes(element)) {
      return processChildNodes(element, context)
    } else {
      return processBlockElement(element, context)
    }
  }

  return ''
}

function shouldIgnoreNode(node: Node, context: ProcessContext): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tagName = element.tagName.toLowerCase()
    if (['script', 'style', 'iframe', 'noscript', 'embed', 'template', 'svg', 'path'].includes(tagName)) {
      return true
    }
    
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return true
    }
    
    // ========== 过滤评论/批注相关元素 ==========
    // 飞书、Notion、Google Docs 等平台的评论元素
    const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';
    const id = element.id ? element.id.toLowerCase() : '';
    
    // 评论相关的 class 关键词
    const commentKeywords = [
      // ========== 飞书文档特有 ==========
      'suspension-comment',     // 悬浮评论区域
      'doccommentcontainer',    // 评论容器 (id)
      'docx-comment',           // 飞书文档评论
      'docs-comment',           // 飞书评论
      'global-comment',         // 全局评论
      'comment-numbers',        // 评论数字标记
      'first-comment-btn',      // 第一条评论按钮
      'comment-image-viewer',   // 评论图片查看器
      'copilot-chat',           // Copilot 聊天框
      'ai-suggestion',          // AI 建议
      'docs-reminder',          // 提醒
      'page-main-footer',       // 页脚（通常包含评论入口）
      'help-block',             // 帮助块
      'wiki-popover',           // Wiki 弹出框
      
      // ========== 通用评论关键词 ==========
      'comment',           // 通用评论
      'annotation',        // 批注
      'remark',            // 备注
      'note-popup',        // 弹出批注
      'discuss',           // 讨论
      'reply',             // 回复 (注意：不要匹配到正常内容)
      'feedback',          // 反馈
      'sidebar-comment',   // 侧边栏评论
      'comment-panel',     // 评论面板
      'comment-list',      // 评论列表
      'comment-thread',    // 评论线程
      'comment-container', // 评论容器
      'comment-wrapper',   // 评论包装
      'comment-content',   // 评论内容
      'comment-body',      // 评论主体
      'comment-item',      // 评论项
      'comment-block',     // 评论块
      'comment-box',       // 评论框
      'comment-card',      // 评论卡片
      'popover-comment',   // 弹出评论
      'inline-comment',    // 行内评论
      'doc-comment',       // 文档评论
      'lark-comment',      // 飞书评论
      'feishu-comment',    // 飞书评论
      'comment-anchor',    // 评论锚点
      'comment-highlight', // 评论高亮
      'comment-mark',      // 评论标记
      'resolved-comment',  // 已解决评论
      'quote-comment',     // 引用评论
    ];
    
    // 检查 class 是否包含评论关键词
    for (const keyword of commentKeywords) {
      if (className.includes(keyword) || id.includes(keyword)) {
        console.log(`[DOM Extractor] Ignoring comment element: class="${element.className}", id="${element.id}"`);
        return true;
      }
    }
    
    // 检查特定 ID（飞书评论容器等）
    const ignoreIds = [
      'doccommentcontainer',
      'docs-poll-date-picker-container',
      'page-main-footer-placeholder',
      'link-editor-container',
      'pp_popupcontainer',
    ];
    if (id && ignoreIds.some(ignoreId => id.includes(ignoreId))) {
      console.log(`[DOM Extractor] Ignoring element by ID: ${element.id}`);
      return true;
    }
    
    // 检查 data 属性（飞书可能使用 data-comment-id 等）
    const dataAttributes = ['data-comment', 'data-comment-id', 'data-annotation', 'data-remark', 'data-selection-node'];
    for (const attr of dataAttributes) {
      if (element.hasAttribute(attr)) {
        console.log(`[DOM Extractor] Ignoring element with ${attr} attribute`);
        return true;
      }
    }
    
    // 检查 lazy-selection-node（飞书评论锚点）
    if (element.classList.contains('lazy-selection-node')) {
      return true;
    }
    
    // 检查 role 属性（可能是评论对话框）
    const role = element.getAttribute('role');
    if (role === 'dialog' || role === 'tooltip' || role === 'alertdialog') {
      // 判断内容是否与评论相关
      const textContent = element.textContent?.toLowerCase() || '';
      if (textContent.includes('评论') || textContent.includes('comment') || 
          textContent.includes('回复') || textContent.includes('reply')) {
        return true;
      }
    }
  }
  return false
}

function processChildNodes(element: Element, context: ProcessContext): string {
  let result = ''
  for (const child of element.childNodes) {
    result += processNode(child, context)
  }
  return result
}

function processChildrenNodes(element: Element, context: ProcessContext): string {
    return processChildNodes(element, context);
}

function processFeishuList(element: Element, context: ProcessContext, type: 'ordered' | 'unordered'): string {
    // 飞书列表结构变体较多，需要兼容处理
    // 常见结构:
    // 1. <div class="block docx-ordered-block">
    //       <button class="order">1.</button>
    //       <div class="list-content">...</div>
    //       <div class="list-children">...</div>
    //    </div>
    // 2. 新版结构可能使用 data-* 属性
    
    // 1. 尝试获取列表序号 (ordered only)
    let orderText = '';
    if (type === 'ordered') {
        // 尝试多种序号选择器
        const orderSelectors = ['.order', '.list-order', '.order-text', '[data-order]', '.marker'];
        for (const sel of orderSelectors) {
            const orderEl = element.querySelector(sel);
            if (orderEl) {
                orderText = orderEl.textContent?.trim() || '';
                if (orderText) break;
            }
        }
        // 如果还是空的，尝试从 data 属性获取
        if (!orderText) {
            const dataOrder = element.getAttribute('data-list-order') || element.getAttribute('data-order');
            if (dataOrder) {
                orderText = dataOrder + '.';
            }
        }
        // 最后的默认值
        // If we can't find the order number, fallback to a bullet to avoid misleading "1. 1. 1." sequences
        if (!orderText) orderText = '-';
    } else {
        orderText = '-';
    }

    // 2. 获取列表内容（尝试多种选择器）
    let contentText = '';
    const contentSelectors = [
        '.list-content',
        '.list-item-content',
        '.text-container',
        '.render-unit-wrapper',
        '.render-unit',
        '[data-content-editable-leaf]',
        '.content'
    ];
    
    for (const sel of contentSelectors) {
        const contentEl = element.querySelector(sel);
        if (contentEl) {
            contentText = processNode(contentEl, context).trim();
            if (contentText) break;
        }
    }
    
    // 如果所有选择器都找不到，直接提取元素的文本（排除子列表和序号）
    if (!contentText) {
        // 克隆元素以避免修改原 DOM
        const clone = element.cloneNode(true) as Element;
        // 移除序号和子列表部分
        clone.querySelectorAll('.order, .list-order, .list-children, .list-child, .nested-list').forEach(el => el.remove());
        contentText = (clone.textContent || '').trim();
    }
    
    // 3. 处理子列表 (Nested Lists)
    let childrenText = '';
    const childrenSelectors = ['.list-children', '.list-child', '.nested-list', '.sub-list'];
    for (const sel of childrenSelectors) {
        const childrenEl = element.querySelector(sel);
        if (childrenEl) {
            // 增加缩进深度
            const childContext = { ...context, depth: context.depth + 1 };
            childrenText = processChildrenNodes(childrenEl, childContext);
            if (childrenText) break;
        }
    }
    
    // 4. 组合结果
    // 添加适当的缩进（如果有嵌套层级）
    const indent = '  '.repeat(context.depth || 0);
    let result = `\n${indent}${orderText} ${contentText}\n`;
    
    if (childrenText) {
        result += childrenText;
    }
    
    return result;
}

function processFeishuTable(element: Element, context: ProcessContext): string {
    // 简化表格提取：只保留内容，不添加额外格式标记
    
    const rowCandidates = Array.from(element.querySelectorAll('.docx-table-tr, tr, .table-row, [data-row]'));
    if (rowCandidates.length === 0) {
        const text = element.textContent?.trim() || '';
        return text ? `\n${text}\n` : '';
    }

    // 只保留顶层行
    const rows = rowCandidates.filter((row) => {
        let parent = row.parentElement;
        while (parent && parent !== element) {
            if (rowCandidates.includes(parent as Element)) return false;
            parent = parent.parentElement;
        }
        return true;
    });

    // 提取每行的单元格内容
    const allRows: string[][] = [];
    for (const row of rows) {
        const cellCandidates = Array.from(
            row.querySelectorAll('.docx-table_cell-block, td, th, .table-cell, [data-cell]')
        );
        const cells = cellCandidates.filter((cell) => {
            let p = cell.parentElement;
            while (p && p !== row) {
                if (p.matches('.docx-table-tr, tr, .table-row')) return false;
                p = p.parentElement;
            }
            return p === row;
        });

        const rowData: string[] = [];
        for (const cell of cells) {
            const cellContext = { ...context, depth: 0 };
            let cellText = processNode(cell, cellContext).trim();
            cellText = cellText.replace(/飞书文档\s*-\s*图片/g, '').trim();
            if (cellText) rowData.push(cellText);
        }
        if (rowData.length > 0) allRows.push(rowData);
    }

    if (allRows.length === 0) return '';

    // 判断表头
    const header = allRows[0];
    const looksLikeHeader =
        header.length >= 2 &&
        header.every((c) => !!c && c.length <= 40 && !c.includes('http'));

    let result = '\n\n';

    if (looksLikeHeader && allRows.length > 1) {
        // 有表头：每行按"字段: 值"格式输出，每个字段换行
        for (let i = 1; i < allRows.length; i++) {
            const row = allRows[i];
            for (let j = 0; j < header.length; j++) {
                const key = header[j] || '';
                const val = row[j] || '';
                if (val) {
                    result += `**${key}**:\n${val}\n\n`;
                }
            }
            result += '\n'; // 每条记录之间空行
        }
    } else {
        // 无表头：直接逐行输出，每行换行
        for (const row of allRows) {
            result += row.join('\n') + '\n\n';
        }
    }

    return result;
}

function processHtmlTableAsList(tableEl: Element, context: ProcessContext): string {
    const rows = Array.from(tableEl.querySelectorAll('tr'));
    if (rows.length === 0) {
        const text = tableEl.textContent?.trim() || '';
        return text ? `\n${text}\n` : '';
            }

    const parsed: string[][] = [];
    for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('th, td'));
        const rowData: string[] = [];
        for (const cell of cells) {
            const cellText = processNode(cell, context).trim();
            if (cellText) rowData.push(cellText);
        }
        if (rowData.length) parsed.push(rowData);
    }
    if (parsed.length === 0) return '';

    const header = parsed[0];
    const looksLikeHeader =
        header.length >= 2 &&
        header.every((c) => !!c && c.length <= 40 && !c.includes('http'));

    let result = '\n\n';

    if (looksLikeHeader && parsed.length > 1) {
        for (let i = 1; i < parsed.length; i++) {
            const row = parsed[i];
            for (let j = 0; j < header.length; j++) {
                const key = header[j] || '';
                const val = row[j] || '';
                if (val) {
                    result += `**${key}**:\n${val}\n\n`;
                }
            }
            result += '\n';
        }
    } else {
        for (const row of parsed) {
            result += row.join('\n') + '\n\n';
        }
    }

    return result;
}

function processBlockElement(element: Element, context: ProcessContext): string {
  const tagName = element.tagName.toLowerCase()
  let result = ''
  switch (tagName) {
    case 'h1': case 'h2': case 'h3':
      const bigLevel = parseInt(tagName[1])
      result = '\n\n---\n\n' + '#'.repeat(bigLevel) + ' ' + processChildrenNodes(element, context) + '\n\n'
      break
    case 'h4': case 'h5': case 'h6':
      const smallLevel = parseInt(tagName[1])
      result = '\n\n' + '#'.repeat(smallLevel) + ' ' + processChildrenNodes(element, context) + '\n\n'
      break
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'ul':
    case 'ol':
    case 'li':
      result = '\n' + processChildrenNodes(element, context) + '\n'
      break
    case 'br':
      result = '\n';
      break;
    default:
      result = processChildrenNodes(element, context)
  }
  return result
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ')
}

function hasDirectTextNodes(element: Element): boolean {
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return true
    }
  }
  return false
}
