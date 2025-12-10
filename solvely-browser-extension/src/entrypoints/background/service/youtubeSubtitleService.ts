// 字幕 URL 缓存存储 - 使用 Map 结构实现 LRU 缓存，key 为 videoId，value 为 {url, timestamp, validated}
const MAX_URL_CACHE_SIZE = 100
const subtitleUrlCache = new Map<string, {url: string, timestamp: number, validated: boolean}>()

// 正在验证的URL集合，用于去重
const pendingValidationUrls = new Set<string>()

// 缓存验证有效期（30分钟）
const CACHE_VALIDATION_DURATION = 30 * 60 * 1000

// LRU 缓存管理函数
const manageCacheSize = () => {
  if (subtitleUrlCache.size > MAX_URL_CACHE_SIZE) {
    const firstKey = subtitleUrlCache.keys().next().value
    if (firstKey) {
      subtitleUrlCache.delete(firstKey)
      console.log(`[字幕URL缓存] LRU 清理：删除最久未使用的缓存 - VideoID: ${firstKey}`)
    }
  }
}

// 更新缓存访问顺序（LRU 策略）
const updateCacheAccess = (videoId: string) => {
  const cacheEntry = subtitleUrlCache.get(videoId)
  if (cacheEntry) {
    subtitleUrlCache.delete(videoId)
    subtitleUrlCache.set(videoId, cacheEntry)
  }
}

// 从 YouTube URL 中提取 videoId
const extractVideoIdFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname === 'www.youtube.com') {
      return urlObj.searchParams.get('v')
    }
    return null
  } catch {
    return null
  }
}

// 验证字幕URL是否有效，并返回完整内容
const validateSubtitleUrl = async (url: string): Promise<{isValid: boolean, content?: string}> => {
  try {
    console.log(`[字幕URL验证] 开始验证URL: ${url}...`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
      },
      signal: AbortSignal.timeout(60000), // 增加到60秒超时
    })
    
    if (!response.ok) {
      console.warn(`[字幕URL验证] HTTP状态码错误: ${response.status}`)
      return { isValid: false }
    }

    // 获取完整内容进行格式验证
    const content = await response.text()
    console.log(`[字幕URL验证] 获取到内容长度: ${content.length}`)
    
    // 验证内容是否像字幕数据
    const isValidSubtitle = validateSubtitleContent(content)
    
    if (isValidSubtitle) {
      console.log(`[字幕URL验证] URL和内容验证成功: ${url}`)
      return { isValid: true, content }
    } else {
      console.warn(`[字幕URL验证] 内容格式不正确: ${url}`)
      console.warn(`[字幕URL验证] 内容预览: ${content.substring(0, 200)}`)
      return { isValid: false }
    }
    
  } catch (error) {
    console.warn(`[字幕URL验证] URL验证失败: ${url}`, error)
    return { isValid: false }
  }
}

// 验证字幕内容格式
const validateSubtitleContent = (content: string): boolean => {
  if (!content || content.trim().length === 0) {
    console.warn('[字幕内容验证] 内容为空')
    return false
  }

  const trimmedContent = content.trim()
  
  // 检查是否是XML格式的字幕
  if (trimmedContent.startsWith('<?xml') || trimmedContent.includes('<transcript>') || trimmedContent.includes('<text ')) {
    console.log('[字幕内容验证] 检测到XML格式字幕')
    return true
  }
  
  // 检查是否是JSON格式的字幕
  try {
    const parsed = JSON.parse(trimmedContent)
    if (parsed && (parsed.events || parsed.wireMagic)) {
      console.log('[字幕内容验证] 检测到JSON格式字幕')
      return true
    }
  } catch {
    // 可能是部分JSON，检查是否包含字幕相关字段
    if (trimmedContent.includes('"events"') || 
        trimmedContent.includes('"tStartMs"') || 
        trimmedContent.includes('"dDurationMs"') ||
        trimmedContent.includes('<text')) {
      console.log('[字幕内容验证] 检测到部分JSON格式字幕')
      return true
    }
  }
  
  // 检查是否包含字幕时间标记
  if (/start="\d+\.?\d*"/.test(trimmedContent) || 
      /"tStartMs":\s*\d+/.test(trimmedContent)) {
    console.log('[字幕内容验证] 检测到时间标记')
    return true
  }
  
  // 检查是否是错误响应
  if (trimmedContent.includes('error') || 
      trimmedContent.includes('Error') ||
      trimmedContent.includes('not found') ||
      trimmedContent.includes('404')) {
    console.warn('[字幕内容验证] 检测到错误响应')
    return false
  }
  
  console.warn('[字幕内容验证] 无法识别的字幕格式')
  return false
}

/**
 * 检测字幕数据格式（JSON 或 XML）
 */
const detectSubtitleFormat = (rawData: string): 'json' | 'xml' | 'unknown' => {
  const trimmedData = rawData.trim()
  
  if (trimmedData.startsWith('<?xml') || trimmedData.startsWith('<transcript')) {
    return 'xml'
  }
  
  try {
    const parsed = JSON.parse(trimmedData)
    if (parsed && typeof parsed === 'object') {
      return 'json'
    }
  } catch {
    // JSON 解析失败
  }
  
  return 'unknown'
}

/**
 * 解析 XML 格式的字幕数据
 */
const parseXmlSubtitles = (xmlData: string): any[] => {
  try {
    const textRegex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>(.*?)<\/text>/gs
    const matches = []
    let match

    while ((match = textRegex.exec(xmlData)) !== null) {
      const start = parseFloat(match[1] || '0')
      const dur = parseFloat(match[2] || '0')
      let text = match[3] || ''
      
      // 清理文本内容
      text = text
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()

      if (text) {
        matches.push({ start, dur, text })
      }
    }

    return matches
  } catch (error) {
    console.error('[字幕解析] XML 解析异常:', error)
    return []
  }
}

/**
 * 解析 JSON 格式的字幕数据
 */
const parseJsonSubtitles = (jsonData: string): any[] => {
  try {
    const parsedData = JSON.parse(jsonData)

    if (!parsedData.events || !Array.isArray(parsedData.events)) {
      return []
    }

    return parsedData.events.map((event: any) => {
      const transformedEvent: any = {}
      
      if (event.tStartMs !== undefined) {
        transformedEvent.start = event.tStartMs / 1000
      }
      
      if (event.dDurationMs !== undefined) {
        transformedEvent.dur = event.dDurationMs / 1000
      }
      
      if (event.segs && Array.isArray(event.segs)) {
        const textParts = event.segs
          .map((seg: any) => seg.utf8)
          .filter((text: string) => text)
        transformedEvent.text = textParts.join('')
      }
      
      return transformedEvent
    }).filter((event: any) => event.text)
  } catch (error) {
    console.error('[字幕解析] JSON 解析异常:', error)
    return []
  }
}

/**
 * 转换 YouTube 字幕数据格式并计算元数据
 */
const transformSubtitleDataAndCalculateMeta = (rawSubtitleData: string): { subtitles: any[], meta: any } => {
  const format = detectSubtitleFormat(rawSubtitleData)
  
  let transformedEvents: any[] = []
  
  switch (format) {
    case 'json':
      transformedEvents = parseJsonSubtitles(rawSubtitleData)
      break
    case 'xml':
      transformedEvents = parseXmlSubtitles(rawSubtitleData)
      break
    default:
      return { 
        subtitles: [], 
        meta: { videoDuration: 0, totalTextLength: 0, wordCount: 0, subtitleCount: 0 } 
      }
  }

  // 计算元数据
  let videoDuration = 0
  let totalTextLength = 0
  let fullText = ''
  let wordCount = 0

  if (transformedEvents.length > 0) {
    const lastSubtitle = transformedEvents[transformedEvents.length - 1]
    const lastStart = parseFloat(lastSubtitle.start || 0)
    const lastDur = parseFloat(lastSubtitle.dur || 0)
    videoDuration = lastStart + lastDur

    fullText = transformedEvents.map((item: any) => item.text || '').join(' ')
    totalTextLength = fullText.length
    wordCount = fullText.trim().split(/\s+/).filter((word) => word.length > 0).length
  }

  const meta = {
    videoDuration: Math.round(videoDuration),
    totalTextLength,
    wordCount,
    subtitleCount: transformedEvents.length,
    format
  }
  
  return { subtitles: transformedEvents, meta }
}

/**
 * 初始化 YouTube 字幕服务 - 监听并验证字幕URL
 */
const initYoutubeSubtitleService = () => {
  chrome.webRequest.onCompleted.addListener(
    async (details) => {
      // 跳过扩展自己发起的请求
      if (details.initiator?.includes('chrome-extension://')) {
        return
      }

      if (details.statusCode === 200) {
        try {
          const videoId = extractVideoIdFromUrl(details.url)
          if (!videoId) return

          // 如果已经有这个videoId的缓存，跳过验证
          if (subtitleUrlCache.has(videoId)) {
            updateCacheAccess(videoId)
            return
          }

          // 去重：如果这个URL正在验证中，跳过
          if (pendingValidationUrls.has(details.url)) {
            console.log(`[字幕URL缓存] URL正在验证中，跳过重复请求 - VideoID: ${videoId}`)
            return
          }

                    // 立即发送TIMEDTEXT_LISTEN信号，通知content script可以关闭字幕按钮
          chrome.tabs.query({ url: '*://www.youtube.com/*' }, (tabs) => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'TIMEDTEXT_LISTEN',
                  videoId: videoId,
                }).catch(() => {
                  // 忽略无法发送消息的tab
                })
              }
            })
          })
          
          // 标记为正在验证
          pendingValidationUrls.add(details.url)

          try {
            // 验证URL是否有效并获取内容
            console.log(`[字幕URL缓存] 开始验证URL - VideoID: ${videoId}`)
            const validationResult = await validateSubtitleUrl(details.url)

            if (validationResult.isValid && validationResult.content) {
              // 存储原始URL
              const originalUrl = details.url
              console.log(`[字幕URL缓存] 验证成功，存储原始URL长度: ${originalUrl.length}`)
              subtitleUrlCache.set(videoId, { url: originalUrl, timestamp: Date.now(), validated: true })
              manageCacheSize()
              console.log(`[字幕URL缓存] URL验证成功，已缓存原始URL - VideoID: ${videoId}`)
              
              // 直接使用验证时获取的内容，避免重复请求
              const subtitleData = validationResult.content
              
              // 发送消息到所有content script
              chrome.tabs.query({ url: '*://www.youtube.com/*' }, (tabs) => {
                tabs.forEach(tab => {
                  if (tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                      type: 'TIMEDTEXT_INTERCEPTED',
                      videoId: videoId,
                      url: originalUrl, // 使用原始URL
                      data: subtitleData
                    }).catch(() => {
                      // 忽略无法发送消息的tab
                    })
                  }
                })
              })
            } else {
              console.warn(`[字幕URL缓存] URL验证失败，不缓存 - VideoID: ${videoId}`)
            }
          } finally {
            // 无论验证成功或失败，都要移除pending标记
            pendingValidationUrls.delete(details.url)
          }

        } catch (error) {
          console.error('[字幕URL缓存] 处理失败:', error)
        }
      }
    },
    { urls: ['*://www.youtube.com/api/timedtext*'] }
  )
}

/**
 * 手动存储字幕URL到缓存（用于模拟点击流程）
 */
export const storeSubtitleUrlToCache = (videoId: string, url: string) => {
  try {
    console.log(`[字幕URL缓存] 接收到的URL长度: ${url.length}`)
    console.log(`[字幕URL缓存] 接收到的URL: ${url}`)
    
    const cacheEntry = {
      url,
      timestamp: Date.now(),
      validated: true // 手动存储的URL认为是已验证的
    }
    
    subtitleUrlCache.set(videoId, cacheEntry)
    manageCacheSize()
    
    // 验证存储后的URL
    const storedEntry = subtitleUrlCache.get(videoId)
    console.log(`[字幕URL缓存] 存储后的URL长度: ${storedEntry?.url.length || 0}`)
    console.log(`[字幕URL缓存] 存储后的URL: ${storedEntry?.url}`)
    
    console.log(`[字幕URL缓存] 手动存储URL - VideoID: ${videoId}`)
    return { success: true }
  } catch (error) {
    console.error('[字幕URL缓存] 手动存储失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 获取缓存的字幕 URL
 */
export const getSubtitleUrlByVideoId = async (
  videoId: string
): Promise<{ success: boolean; url?: string; videoId?: string; error?: string }> => {
  if (!videoId) {
    return { success: false, error: 'videoId is required' }
  }

  // 由于现在只缓存经过验证的URL，减少重试次数和延迟
  const MAX_RETRIES = 3
  const RETRY_DELAY = 200

  for (let i = 0; i < MAX_RETRIES; i++) {
    const cacheEntry = subtitleUrlCache.get(videoId)
    if (cacheEntry) {
      const now = Date.now()
      const isExpired = now - cacheEntry.timestamp > CACHE_VALIDATION_DURATION
      
      // 如果缓存未过期且已验证，直接返回
      if (!isExpired && cacheEntry.validated) {
        updateCacheAccess(videoId)
        console.log(`[字幕URL缓存] 使用已验证的缓存URL - VideoID: ${videoId}`)
        return { success: true, url: cacheEntry.url, videoId }
      }
      
      // 如果缓存过期或未验证，需要重新验证
      console.log(`[字幕URL缓存] 找到缓存的URL，验证有效性 - VideoID: ${videoId}`)
      const validationResult = await validateSubtitleUrl(cacheEntry.url)
      
      if (validationResult.isValid) {
        // 更新缓存条目，标记为已验证
        cacheEntry.validated = true
        cacheEntry.timestamp = now
        updateCacheAccess(videoId)
        console.log(`[字幕URL缓存] 缓存URL验证成功 - VideoID: ${videoId}`)
        return { success: true, url: cacheEntry.url, videoId }
      } else {
        console.warn(`[字幕URL缓存] 缓存URL验证失败，清理无效缓存 - VideoID: ${videoId}`)
        subtitleUrlCache.delete(videoId)
        // 继续重试，不返回失败
      }
    }
    
    // 检查是否有正在验证的URL
    const pendingUrls = Array.from(pendingValidationUrls)
    const isPending = pendingUrls.some(url => url.includes(`v=${videoId}`))
    
    if (isPending) {
      console.log(`[字幕URL缓存] 检测到正在验证的URL，等待... - VideoID: ${videoId}`)
      // 如果有正在验证的URL，等待更长时间
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * 2))
    } else if (i < MAX_RETRIES - 1) {
      // 如果没有pending且还有重试次数，短暂等待
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    }
  }

  return {
    success: false,
    error: 'Subtitle URL not found in cache after validation',
    videoId,
  }
}

/**
 * 处理原始字幕数据（仅用于内容脚本处理数据，不缓存）
 */
export const processSubtitleData = async (
  rawData: string,
  videoId: string
): Promise<{ success: boolean; data?: string; error?: string }> => {
  try {
    if (!rawData || !videoId) {
      return { success: false, error: '原始数据和视频ID都是必需的' }
    }

    // 处理数据
    const { subtitles, meta } = transformSubtitleDataAndCalculateMeta(rawData)

    if (!subtitles || subtitles.length === 0) {
      return { success: false, error: '转换后的字幕数据为空或无效' }
    }

    const processedData = JSON.stringify({ subtitles, meta })

    console.log(`[字幕处理] 处理完成 - VideoID: ${videoId}, 字幕条数: ${subtitles.length}`)
    return { success: true, data: processedData }

  } catch (error: any) {
    console.error('[字幕处理] 处理失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取缓存信息（调试用）
 */
export const getSubtitleCacheInfo = () => {
  return {
    success: true as const,
    data: {
      totalVideos: subtitleUrlCache.size,
      videoIds: Array.from(subtitleUrlCache.keys()),
    }
  }
}

/**
 * 清除缓存
 */
export const clearSubtitleCache = (videoId?: string) => {
  if (videoId) {
    const deleted = subtitleUrlCache.delete(videoId)
    return { success: true, deleted, videoId }
  } else {
    const totalCleared = subtitleUrlCache.size
    subtitleUrlCache.clear()
    return { success: true, clearedCount: totalCleared }
  }
}

export default {
  init: initYoutubeSubtitleService,
  getSubtitleUrlByVideoId,
  getSubtitleCacheInfo,
  clearSubtitleCache,
  processSubtitleData, // 保留这个用于内容脚本处理数据
  storeSubtitleUrlToCache, // 添加手动存储功能
}
