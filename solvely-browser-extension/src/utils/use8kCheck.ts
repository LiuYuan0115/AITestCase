/**
 * 根据选取文本在全量文本中的位置，动态截取8k字符的窗口
 * @param fullText 全量文本
 * @param selectedText 选取的文本（小于2k）
 * @param maxWindowSize 最大窗口大小，默认8k字符
 * @returns 截取后的文本片段
 */
export function use8kCheck(
  fullText: string,
  selectedText: string,
  maxWindowSize: number = 8000
): string {
  console.log('🔍 ===== use8kCheck 调试信息开始 =====')
  console.log('📋 输入参数:', {
    fullTextLength: fullText?.length || 0,
    selectedTextLength: selectedText?.length || 0,
    maxWindowSize,
    selectedTextPreview: selectedText?.slice(0, 100) + (selectedText?.length > 100 ? '...' : '')
  })

  // 检查选中文本是否包含换行符或特殊字符
  if (selectedText) {
    const hasNewlines = selectedText.includes('\n')
    const hasSpecialChars = /[–—'""]/.test(selectedText)
    const hasMultipleSpaces = /\s{2,}/.test(selectedText)
    
    console.log('🔍 选中文本格式检查:', {
      hasNewlines,
      hasSpecialChars,
      hasMultipleSpaces,
      originalLength: selectedText.length,
      normalizedPreview: selectedText.replace(/\s+/g, ' ').slice(0, 100)
    })
  }

  // 参数验证
  if (!fullText || !selectedText) {
    console.log('❌ 参数验证失败: 文本内容为空')
    console.log('✅ ===== use8kCheck 调试信息结束 =====')
    return fullText || '';
  }

  if (selectedText.length >= 2000) {
    console.warn('⚠️ 选取文本长度超过2k，可能导致性能问题')
  }

  // 精确匹配路径已移除，直接进入分析与模糊匹配

  // 兜底：旧逻辑（包含分析与模糊匹配），或当规范化精确匹配未命中时继续
  console.log('🔍 开始分析选择文本位置...')
  const positionInfo = analyzeSelectionPosition(fullText, selectedText)
  console.log('📍 位置分析结果:', positionInfo)
  
  // 在全量文本中查找选取文本的位置
  let selectedTextIndex = fullText.indexOf(selectedText);
  console.log('🔍 精确匹配结果:', {
    found: selectedTextIndex !== -1,
    index: selectedTextIndex,
    matchType: selectedTextIndex !== -1 ? '精确匹配' : '未找到精确匹配'
  })
  
  if (selectedTextIndex === -1) {
    // 如果找不到选取文本，检查模糊匹配结果
    if ((positionInfo as any).found && !(positionInfo as any).exactMatch) {
      console.log('🎯 使用模糊匹配结果进行定位...')
      // 使用模糊匹配的结果
      let fuzzyIndex: number | undefined;
      
      // 检查是否有startIndex（模糊匹配成功的情况）
      if ('startIndex' in (positionInfo as any) && (positionInfo as any).startIndex !== undefined) {
        fuzzyIndex = (positionInfo as any).startIndex;
        console.log('📍 使用 startIndex 模糊定位:', fuzzyIndex)
      }
      // 检查是否有estimatedIndex（直接模糊匹配的情况）
      else if ('estimatedIndex' in (positionInfo as any) && (positionInfo as any).estimatedIndex !== undefined) {
        fuzzyIndex = (positionInfo as any).estimatedIndex;
        console.log('📍 使用 estimatedIndex 模糊定位:', fuzzyIndex)
      }
      
      if (fuzzyIndex !== undefined) {
        selectedTextIndex = fuzzyIndex;
        console.log('✅ 模糊定位成功，设置 selectedTextIndex:', selectedTextIndex)
      } else {
        // 如果模糊匹配结果无效，返回前8k字符
        console.log('❌ 模糊定位失败，返回前8k字符')
        console.log('✅ ===== use8kCheck 调试信息结束 =====')
        return fullText.slice(0, maxWindowSize);
      }
    } else {
      // 如果模糊匹配也失败，返回全量文本的前8k字符
      console.log('❌ 所有定位方式都失败，返回前8k字符')
      console.log('✅ ===== use8kCheck 调试信息结束 =====')
      return fullText.slice(0, maxWindowSize);
    }
  }

  // 计算选取文本的中心位置（在原文上）
  const selectedTextCenter = selectedTextIndex + Math.floor(selectedText.length / 2);
  console.log('🎯 选取文本中心位置:', {
    startIndex: selectedTextIndex,
    endIndex: selectedTextIndex + selectedText.length,
    centerIndex: selectedTextCenter,
    centerPercentage: ((selectedTextCenter / fullText.length) * 100).toFixed(2) + '%'
  })
  
  // 计算窗口的起始和结束位置（在原文上）
  const halfWindowSize = Math.floor(maxWindowSize / 2);
  let windowStart = selectedTextCenter - halfWindowSize;
  let windowEnd = selectedTextCenter + halfWindowSize;

  console.log('🪟 初始窗口计算:', {
    halfWindowSize,
    windowStart,
    windowEnd,
    windowSize: windowEnd - windowStart
  })

  // 确保窗口不超出文本边界
  if (windowStart < 0) {
    console.log('⚠️ 窗口超出左边界，调整窗口起始位置')
    windowStart = 0;
    windowEnd = Math.min(maxWindowSize, fullText.length);
    console.log('🔄 调整后窗口:', { windowStart, windowEnd, windowSize: windowEnd - windowStart })
  }

  if (windowEnd > fullText.length) {
    console.log('⚠️ 窗口超出右边界，调整窗口结束位置')
    windowEnd = fullText.length;
    windowStart = Math.max(0, fullText.length - maxWindowSize);
    console.log('🔄 调整后窗口:', { windowStart, windowEnd, windowSize: windowEnd - windowStart })
  }

  // 如果窗口大小小于最大窗口大小，尝试扩展窗口
  const currentWindowSize = windowEnd - windowStart;
  console.log('📏 当前窗口大小:', currentWindowSize, '目标大小:', maxWindowSize)
  
  if (currentWindowSize < maxWindowSize) {
    console.log('🔧 尝试扩展窗口...')
    const remainingSpace = maxWindowSize - currentWindowSize;
    
    // 优先向后扩展
    const canExtendBack = windowStart > 0;
    const canExtendForward = windowEnd < fullText.length;
    
    console.log('🔍 扩展可能性:', {
      canExtendBack,
      canExtendForward,
      remainingSpace
    })
    
    if (canExtendBack && canExtendForward) {
      // 两边都可以扩展，平均分配剩余空间
      const extendAmount = Math.floor(remainingSpace / 2);
      windowStart = Math.max(0, windowStart - extendAmount);
      windowEnd = Math.min(fullText.length, windowEnd + extendAmount);
      console.log('🔄 双向扩展窗口:', { 
        extendAmount, 
        windowStart, 
        windowEnd, 
        windowSize: windowEnd - windowStart 
      })
    } else if (canExtendBack) {
      // 只能向后扩展
      windowStart = Math.max(0, windowStart - remainingSpace);
      console.log('🔄 向后扩展窗口:', { 
        remainingSpace, 
        windowStart, 
        windowEnd, 
        windowSize: windowEnd - windowStart 
      })
    } else if (canExtendForward) {
      // 只能向前扩展
      windowEnd = Math.min(fullText.length, windowEnd + remainingSpace);
      console.log('🔄 向前扩展窗口:', { 
        remainingSpace, 
        windowStart, 
        windowEnd, 
        windowSize: windowEnd - windowStart 
      })
    }
  }

  // 截取文本片段（原文上）
  const result = fullText.slice(windowStart, windowEnd);
  
  // 确保结果不超过最大窗口大小
  const finalResult = result.length > maxWindowSize ? result.slice(0, maxWindowSize) : result;
  
  console.log('✂️ 最终截取结果:', {
    originalLength: fullText.length,
    windowStart,
    windowEnd,
    windowSize: windowEnd - windowStart,
    resultLength: finalResult.length,
    reductionRatio: ((1 - finalResult.length / fullText.length) * 100).toFixed(2) + '%',
    resultPreview: finalResult.slice(0, 200) + (finalResult.length > 200 ? '...' : '')
  })
  
  console.log('✅ ===== use8kCheck 调试信息结束 =====')
  return finalResult;
}

/**
 * 分析选择文本在网页内容中的位置
 * @param fullText 完整文本内容
 * @param selectedText 选择的文本
 * @returns 位置分析结果
 */
function analyzeSelectionPosition(fullText: string, selectedText: string) {
  console.log('🔍 ===== analyzeSelectionPosition 开始 =====')
  console.log('📋 分析参数:', {
    fullTextLength: fullText?.length || 0,
    selectedTextLength: selectedText?.length || 0,
    selectedTextPreview: selectedText?.slice(0, 100) + (selectedText?.length > 100 ? '...' : '')
  })
  
  if (!fullText || !selectedText) {
    console.log('❌ 文本内容为空，分析失败')
    console.log('✅ ===== analyzeSelectionPosition 结束 =====')
    return { found: false, message: '文本内容为空' }
  }
  
  try {
    // 1. 查找选择文本在完整内容中的位置
    const startIndex = fullText.indexOf(selectedText)
    console.log('🔍 精确匹配查找:', {
      startIndex,
      found: startIndex !== -1,
      matchType: startIndex !== -1 ? '精确匹配' : '未找到'
    })
    
    // 如果精确匹配失败，显示详细的对比信息
    if (startIndex === -1) {
      console.log('❌ 精确匹配失败，显示详细对比信息:')
      console.log('📝 选中文本:', {
        text: selectedText,
        length: selectedText.length,
        preview: selectedText.slice(0, 100)
      })
      console.log('📄 全量文本片段 (前200字符):', fullText.slice(0, 200))
      console.log('🔍 尝试查找部分匹配...')
      
      // 尝试查找部分匹配（去掉首尾空格后）
      const trimmedSelected = selectedText.trim()
      const trimmedIndex = fullText.indexOf(trimmedSelected)
      if (trimmedIndex !== -1) {
        console.log('✅ 去除首尾空格后匹配成功:', {
          index: trimmedIndex,
          message: '可能是首尾空格问题'
        })
      }
      
      // 尝试查找去掉所有多余空格后的匹配
      const normalizedSelected = selectedText.replace(/\s+/g, ' ')
      const normalizedIndex = fullText.indexOf(normalizedSelected)
      if (normalizedIndex !== -1) {
        console.log('✅ 标准化空格后匹配成功:', {
          index: normalizedIndex,
          message: '空格格式不一致导致匹配失败'
        })
      }
    }
    
    if (startIndex === -1) {
      // 如果没找到完全匹配，尝试模糊匹配
      console.log('🔍 精确匹配失败，开始模糊匹配...')
      const fuzzyResult = findFuzzyMatch(fullText, selectedText)
      console.log('🎯 模糊匹配结果:', fuzzyResult)
      
      if (fuzzyResult.found && (fuzzyResult as any).estimatedIndex !== undefined) {
        // 使用模糊匹配的结果
        const estimatedIndex = (fuzzyResult as any).estimatedIndex
        const beforeText = fullText.substring(0, estimatedIndex)
        const afterText = fullText.substring(estimatedIndex)
        
        const beforeLines = beforeText.split('\n').length
        const selectedLines = selectedText.split('\n').length
        const beforeChars = beforeText.length
        const selectedChars = selectedText.length
        const percentage = ((estimatedIndex / fullText.length) * 100).toFixed(2)
        
        const contextBefore = beforeText.slice(-100)
        const contextAfter = afterText.slice(0, 100)
        
        const result = {
          found: true,
          exactMatch: false,
          matchScore: (fuzzyResult as any).matchScore,
          startIndex: estimatedIndex,
          endIndex: estimatedIndex + selectedText.length,
          beforeLines,
          selectedLines,
          beforeChars,
          selectedChars,
          percentage: `${percentage}%`,
          contextBefore: contextBefore.length > 0 ? `...${contextBefore}` : '',
          contextAfter: contextAfter.length > 0 ? `${contextAfter}...` : '',
          message: `模糊匹配成功，选择文本位于第${beforeLines}行，第${beforeChars}个字符，占总内容的${percentage}%，匹配度: ${(fuzzyResult as any).matchScore}`
        }
        
        console.log('✅ 模糊匹配分析完成:', result)
        console.log('✅ ===== analyzeSelectionPosition 结束 =====')
        return result
      }
      
      console.log('❌ 模糊匹配也失败')
      console.log('✅ ===== analyzeSelectionPosition 结束 =====')
      return fuzzyResult
    }
    
    // 2. 计算位置信息
    const endIndex = startIndex + selectedText.length
    const beforeText = fullText.substring(0, startIndex)
    const afterText = fullText.substring(endIndex)
    
    // 3. 计算行数和字符位置
    const beforeLines = beforeText.split('\n').length
    const selectedLines = selectedText.split('\n').length
    const beforeChars = beforeText.length
    const selectedChars = selectedText.length
    
    // 4. 获取上下文（前后各100个字符）
    const contextBefore = beforeText.slice(-100)
    const contextAfter = afterText.slice(0, 100)
    
    // 5. 计算百分比位置
    const percentage = ((startIndex / fullText.length) * 100).toFixed(2)
    
    const result = {
      found: true,
      exactMatch: true,
      startIndex,
      endIndex,
      beforeLines,
      selectedLines,
      beforeChars,
      selectedChars,
      percentage: `${percentage}%`,
      contextBefore: contextBefore.length > 0 ? `...${contextBefore}` : '',
      contextAfter: contextAfter.length > 0 ? `${contextAfter}...` : '',
      message: `选择文本位于第${beforeLines}行，第${beforeChars}个字符，占总内容的${percentage}%`
    }
    
    console.log('✅ 精确匹配分析完成:', result)
    console.log('✅ ===== analyzeSelectionPosition 结束 =====')
    return result
    
  } catch (error) {
    console.error('❌ 位置分析失败:', error)
    console.log('✅ ===== analyzeSelectionPosition 结束 =====')
    return { found: false, message: `分析失败: ${error}` }
  }
}

/**
 * 模糊匹配：当完全匹配失败时，尝试找到最相似的部分
 * @param fullText 完整文本
 * @param selectedText 选择的文本
 * @returns 模糊匹配结果
 */
function findFuzzyMatch(fullText: string, selectedText: string) {
  console.log('🔍 ===== findFuzzyMatch 开始 =====')
  console.log('📋 模糊匹配参数:', {
    fullTextLength: fullText?.length || 0,
    selectedTextLength: selectedText?.length || 0,
    selectedTextPreview: selectedText?.slice(0, 100) + (selectedText?.length > 100 ? '...' : '')
  })
  
  try {
    const words = selectedText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    console.log('🔤 提取的关键词:', words)
    
    if (words.length === 0) {
      console.log('❌ 选择文本太短，无法进行模糊匹配')
      console.log('✅ ===== findFuzzyMatch 结束 =====')
      return { found: false, message: '选择文本太短，无法进行模糊匹配' }
    }
    
    // 1. 快速找到所有关键词位置
    console.log('🔍 开始查找关键词位置...')
    const wordPositions = new Map<string, number[]>()
    for (const word of words) {
      const positions: number[] = []
      let pos = 0
      while ((pos = fullText.toLowerCase().indexOf(word, pos)) !== -1) {
        positions.push(pos)
        pos += word.length // 跳过已匹配的单词，避免重复
      }
      wordPositions.set(word, positions)
    }
    
    // 2. 找到关键词最集中的区域（使用更大的步长）
    console.log('🎯 开始寻找关键词最集中的区域...')
    let bestRegion = { center: 0, score: 0 }
    const searchStep = 200 // 200字符步长，大幅减少计算，适合"大概范围"需求
    const windowSize = 500 // 500字符窗口，覆盖更大范围，减少重叠
    
    console.log('🔧 搜索参数:', { searchStep, windowSize })
    
    for (let center = 0; center < fullText.length; center += searchStep) {
      let localScore = 0
      const windowStart = Math.max(0, center - windowSize/2)
      const windowEnd = Math.min(fullText.length, center + windowSize/2)
      
      for (const [word, positions] of wordPositions) {
        const inWindow = positions.filter(p => p >= windowStart && p < windowEnd)
        localScore += inWindow.length * word.length
      }
      
      if (localScore > bestRegion.score) {
        bestRegion = { center, score: localScore }
        console.log(`🎯 发现更好的区域: center=${center}, score=${localScore}`)
      }
    }
    
    const result = bestRegion.score > 0 ? {
      found: true,
      exactMatch: false,
      matchScore: bestRegion.score,
      estimatedIndex: bestRegion.center,
      message: `找到模糊匹配，匹配度: ${bestRegion.score}，估计位置: ${bestRegion.center}`
    } : { found: false, message: '未找到匹配的文本内容' }
    
    console.log('✅ 模糊匹配结果:', result)
    console.log('✅ ===== findFuzzyMatch 结束 =====')
    return result
    
  } catch (error) {
    console.error('❌ 模糊匹配失败:', error)
    console.log('✅ ===== findFuzzyMatch 结束 =====')
    return { found: false, message: `模糊匹配失败: ${error}` }
  }
}
