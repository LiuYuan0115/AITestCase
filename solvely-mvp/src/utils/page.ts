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
  imageCollector: ImageInfo[]
  onlyInViewport?: boolean
  // 用于追踪提取的内容数量，帮助调试
  extractedCount?: number
}

export interface ImageInfo {
  url: string
  width: number
  height: number
}

export interface ConvertResult {
  markdown: string
  images: ImageInfo[]
}

/**
 * 核心入口函数
 * @param rootNode 文档根节点 (通常是 document.body)
 * @param options 配置项
 */
export function convertDOMToMarkdown(rootNode: Node, options: { checkSelectors?: boolean, onlyInViewport?: boolean } = { checkSelectors: true, onlyInViewport: false }): ConvertResult {
  const imageCollector: ImageInfo[] = []
  const context: ProcessContext = {
    depth: 0,
    imageCollector,
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
        images: imageCollector.map((item) => {
          if (!item.url.startsWith('data:') && !item.url.startsWith('http') && !item.url.startsWith('blob:')) {
            return {
              ...item,
              url: window.location.origin + item.url,
            }
          }
          return item
        }),
      }
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
                return '\n\n# ' + processNode(content, context).trim() + '\n\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n\n# ' + text + '\n\n';
            return '\n\n# ' + processChildrenNodes(element, context) + '\n\n';
        }
        if (className.includes('docx-heading2-block') || className.includes('heading-h2')) {
            const content = element.querySelector('.heading-content, .text-container, [data-content-editable-leaf]');
            if (content) {
                return '\n\n## ' + processNode(content, context).trim() + '\n\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n\n## ' + text + '\n\n';
            return '\n\n## ' + processChildrenNodes(element, context) + '\n\n';
        }
        if (className.includes('docx-heading3-block') || className.includes('heading-h3')) {
            const content = element.querySelector('.heading-content, .text-container, [data-content-editable-leaf]');
            if (content) {
                return '\n\n### ' + processNode(content, context).trim() + '\n\n';
            }
            const text = element.textContent?.trim() || '';
            if (text) return '\n\n### ' + text + '\n\n';
            return '\n\n### ' + processChildrenNodes(element, context) + '\n\n';
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
             const img = element.querySelector('img');
             if (img) {
                 const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                 const alt = img.getAttribute('alt') || 'Image';
                 if (src) {
                     context.imageCollector.push({ url: src, width: img.width || 0, height: img.height || 0 });
                     return `\n![${alt}](${src})\n`;
                 }
             }
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
             // These are usually handled by the block processor, but if we are here, it might be a loose button.
             // However, context would be needed. For now, let's keep numbers if they look like list markers.
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
        if (!orderText) orderText = '1.';
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
    // 尝试多种表格行选择器
    const rowSelectors = ['.docx-table-tr', 'tr', '.table-row', '[data-row]'];
    let rows: Element[] = [];
    
    for (const sel of rowSelectors) {
        const found = Array.from(element.querySelectorAll(sel));
        if (found.length > 0) {
            rows = found;
            break;
        }
    }
    
    if (rows.length === 0) {
        // 如果没找到行，直接提取表格内所有文本
        const text = element.textContent?.trim() || '';
        return text ? `\n${text}\n` : '';
    }

    let result = '\n';
    const allRowData: string[][] = [];
    let maxCols = 0;
    
    // 第一遍：收集所有单元格数据
    for (const row of rows) {
        const cellSelectors = ['.docx-table_cell-block', 'td', 'th', '.table-cell', '[data-cell]'];
        let cells: Element[] = [];
        
        for (const sel of cellSelectors) {
            const found = Array.from(row.querySelectorAll(sel));
            if (found.length > 0) {
                cells = found;
                break;
            }
        }
        
        const rowData: string[] = [];
        for (const cell of cells) {
            const cellContent = processNode(cell, context).trim().replace(/\n+/g, ' ');
            rowData.push(cellContent || '');
        }
        
        if (rowData.length > maxCols) maxCols = rowData.length;
        allRowData.push(rowData);
    }
    
    // 第二遍：生成 Markdown 表格（如果数据规整）
    if (maxCols > 0 && allRowData.length > 0) {
        // 尝试生成 Markdown 表格
        // 第一行作为表头
        const header = allRowData[0];
        result += '| ' + header.map(c => c || ' ').join(' | ') + ' |\n';
        result += '| ' + header.map(() => '---').join(' | ') + ' |\n';
        
        // 剩余行作为数据
        for (let i = 1; i < allRowData.length; i++) {
            const rowData = allRowData[i];
            // 补齐列数
            while (rowData.length < maxCols) {
                rowData.push('');
            }
            result += '| ' + rowData.map(c => c || ' ').join(' | ') + ' |\n';
        }
        result += '\n';
    }

    return result;
}

function processBlockElement(element: Element, context: ProcessContext): string {
  const tagName = element.tagName.toLowerCase()
  let result = ''
  switch (tagName) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      const level = parseInt(tagName[1])
      result = '\n\n' + '#'.repeat(level) + ' ' + processChildrenNodes(element, context) + '\n\n'
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
