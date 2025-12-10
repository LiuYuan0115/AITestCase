/**
 * PDF上下文提取工具
 * 高性能地从PDF中提取选定文本周围的上下文内容
 */

export interface PdfContextConfig {
  /** 初始范围：当前页 ± initialPageRange 页 */
  initialPageRange: number
  /** 最大文本长度限制 */
  maxLength: number
}

export interface PdfContextResult {
  /** 截断后的文本 */
  extractedText: string
  /** 实际使用的页码范围 */
  pageRange: { start: number; end: number }
  /** 是否找到了选中文本 */
  foundSelection: boolean
  /** 最终文本长度 */
  finalLength: number
}

/**
 * 从PDF中提取选中文本周围的上下文
 * @param selectedText 选中的文本
 * @param currentPageNum 选中文本所在的页码（1-based）
 * @param pdfDocument PDF文档对象
 * @param config 配置选项
 */
export async function extractPdfContext(
  selectedText: string,
  currentPageNum: number,
  pdfDocument: any,
  config: Partial<PdfContextConfig> = {}
): Promise<PdfContextResult> {
  const {
    initialPageRange = 2,
    maxLength = 8000
  } = config

  console.log('🔍 PDF上下文提取开始:', {
    selectedText: selectedText.slice(0, 50) + '...',
    currentPageNum,
    totalPages: pdfDocument.numPages,
    initialPageRange,
    maxLength
  })

  // 预处理选中文本
  const normalizedSelectedText = normalizeText(selectedText)

  // 1. 确定初始页面范围
  const startPage = Math.max(1, currentPageNum - initialPageRange)
  const endPage = Math.min(pdfDocument.numPages, currentPageNum + initialPageRange)

  console.log(`📄 初始页面范围: ${startPage}-${endPage}`)

  // 2. 提取初始范围内的文本
  let extractedPages = await extractPagesText(pdfDocument, startPage, endPage)
  let combinedText = combinePageTexts(extractedPages)

  console.log(`📊 初始范围文本长度: ${combinedText.length}`)

  // 3. 检查是否找到选中文本
  const foundSelection = findTextInContent(combinedText, normalizedSelectedText)
  
  if (!foundSelection) {
    console.warn('⚠️ 在初始范围内未找到选中文本，将扩大搜索范围')
  }

  // 4. 如果文本长度未超过限制，尝试交替扩展范围
  let currentStartPage = startPage
  let currentEndPage = endPage

  if (combinedText.length < maxLength) {
    console.log('📈 文本长度未达到限制，开始交替扩展范围...')

    // 交替向上和向下扩展，确保上下文均匀分布
    let expandUp = true // 从向上开始扩展
    
    while ((currentStartPage > 1 || currentEndPage < pdfDocument.numPages) && combinedText.length < maxLength) {
      let expanded = false

      if (expandUp && currentStartPage > 1) {
        // 向上扩展一页
        currentStartPage--
        const newPage = await extractPageText(pdfDocument, currentStartPage)
        const testText = newPage.text + '\n\n' + combinedText
        
        if (testText.length > maxLength) {
          // 如果加上这页会超出限制，尝试部分添加
          const availableSpace = maxLength - combinedText.length - 2 // 2 for '\n\n'
          if (availableSpace > 0) {
            const partialText = newPage.text.slice(-availableSpace)
            combinedText = partialText + '\n\n' + combinedText
          }
          break
        }
        
        combinedText = testText
        expanded = true
        console.log(`📄 向上扩展到第${currentStartPage}页，当前长度: ${combinedText.length}`)
      } else if (!expandUp && currentEndPage < pdfDocument.numPages) {
        // 向下扩展一页
        currentEndPage++
        const newPage = await extractPageText(pdfDocument, currentEndPage)
        const testText = combinedText + '\n\n' + newPage.text
        
        if (testText.length > maxLength) {
          // 如果加上这页会超出限制，尝试部分添加
          const availableSpace = maxLength - combinedText.length - 2 // 2 for '\n\n'
          if (availableSpace > 0) {
            const partialText = newPage.text.slice(0, availableSpace)
            combinedText = combinedText + '\n\n' + partialText
          }
          break
        }
        
        combinedText = testText
        expanded = true
        console.log(`📄 向下扩展到第${currentEndPage}页，当前长度: ${combinedText.length}`)
      }

      // 如果当前方向无法扩展，尝试另一个方向
      if (!expanded) {
        if (expandUp && currentEndPage < pdfDocument.numPages) {
          expandUp = false // 切换到向下扩展
          continue
        } else if (!expandUp && currentStartPage > 1) {
          expandUp = true // 切换到向上扩展
          continue
        } else {
          // 两个方向都无法扩展，退出
          break
        }
      }

      // 交替切换扩展方向
      expandUp = !expandUp
    }
  }

  // 5. 如果仍然超出限制，进行智能截断
  if (combinedText.length > maxLength) {
    combinedText = smartTruncate(combinedText, normalizedSelectedText, maxLength)
  }

  const result: PdfContextResult = {
    extractedText: combinedText,
    pageRange: { start: currentStartPage, end: currentEndPage },
    foundSelection,
    finalLength: combinedText.length
  }

  console.log('✅ PDF上下文提取完成:', {
    pageRange: `${result.pageRange.start}-${result.pageRange.end}`,
    finalLength: result.finalLength,
    foundSelection: result.foundSelection
  })

  return result
}

/**
 * 提取单页文本
 */
async function extractPageText(pdfDocument: any, pageNum: number): Promise<{ pageNum: number; text: string }> {
  try {
    const page = await pdfDocument.getPage(pageNum)
    const textContent = await page.getTextContent()
    
    const text = textContent.items
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ')
    
    return { pageNum, text }
  } catch (error) {
    console.error(`❌ 提取第${pageNum}页失败:`, error)
    return { pageNum, text: '' }
  }
}

/**
 * 提取多页文本
 */
async function extractPagesText(pdfDocument: any, startPage: number, endPage: number): Promise<Array<{ pageNum: number; text: string }>> {
  const promises = []
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    promises.push(extractPageText(pdfDocument, pageNum))
  }
  return Promise.all(promises)
}

/**
 * 合并页面文本
 */
function combinePageTexts(pages: Array<{ pageNum: number; text: string }>): string {
  return pages
    .filter(page => page.text.trim())
    .map(page => page.text)
    .join('\n\n')
}

/**
 * 文本规范化
 */
function normalizeText(text: string): string {
  return text
    .replace(/\u00AD/g, '') // 移除软连字符
    .replace(/[\u00A0\u2007\u202F]/g, ' ') // 替换特殊空格
    .replace(/\s+/g, ' ') // 合并空白字符
    .trim()
}

/**
 * 在内容中查找文本
 */
function findTextInContent(content: string, searchText: string): boolean {
  const normalizedContent = normalizeText(content)
  const normalizedSearch = normalizeText(searchText)
  
  // 精确匹配
  if (normalizedContent.includes(normalizedSearch)) {
    return true
  }
  
  // 模糊匹配 - 允许一些字符差异
  const words = normalizedSearch.split(' ').filter(w => w.length > 2)
  if (words.length === 0) return false
  
  const foundWords = words.filter(word => normalizedContent.includes(word))
  return foundWords.length >= Math.ceil(words.length * 0.7) // 70%的词匹配即可
}

/**
 * 智能截断文本，尽量保持选中文本在中心位置
 */
function smartTruncate(text: string, selectedText: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  
  const normalizedText = normalizeText(text)
  const normalizedSelected = normalizeText(selectedText)
  
  // 查找选中文本的位置
  const selectedIndex = normalizedText.indexOf(normalizedSelected)
  
  if (selectedIndex === -1) {
    // 如果找不到选中文本，从开头截断
    return text.slice(0, maxLength)
  }
  
  // 计算窗口位置，尽量让选中文本居中
  const selectedCenter = selectedIndex + normalizedSelected.length / 2
  const windowStart = Math.max(0, Math.floor(selectedCenter - maxLength / 2))
  const windowEnd = Math.min(text.length, windowStart + maxLength)
  
  // 调整开始位置，确保不超出范围
  const adjustedStart = Math.max(0, windowEnd - maxLength)
  
  return text.slice(adjustedStart, windowEnd)
} 