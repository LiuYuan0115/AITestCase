import { getTrpc } from '~/lib/trpc/client'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import type { YouTubePanelState } from './useYouTubePanelProvider'
import type { Ref, Reactive } from 'vue'
import {
  YouTubePanelStateEnum,
  type SummaryData,
} from './useYouTubePanelProvider'
import trackEvent from '~/utils/trackEvent'

/**
 * 检查 YouTube 字幕按钮是否可用（通过 fill-opacity 判断）
 * @param subtitleButton 字幕按钮元素
 * @returns boolean 是否可用
 */
const checkSubtitleButtonAvailability = (subtitleButton: HTMLElement): boolean => {
  try {
    const svgElement = subtitleButton.querySelector('svg')
    const fillOpacity = svgElement?.getAttribute('fill-opacity')

    // 不可用时通常为 0.3，可用为 1
    const isAvailable = fillOpacity !== '0.3'
    console.log(`[字幕按钮检测] 按钮${isAvailable ? '可用' : '不可用'} (fill-opacity=${fillOpacity})`)
    
    return isAvailable
  } catch (error) {
    console.error('[字幕按钮检测] 检测过程中发生错误:', error)
    return false
  }
}


/**
 * 生成摘要, 调用大模型接口, 进行字幕总结功能, 并返回摘要大纲和摘要详情, 如果未登录会先进行登录, 登录成功会进行消息监听并继续总结生成的流程
 * @param {function(): boolean} canGenerateSummary 回调:是否可以生成摘要
 * @param {function(boolean): void} onLoadingChange 回调:加载状态变化
 * @param {function(any): void} onStateChange 回调:状态变化
 * @param {function(string): void} onSummaryOutlineChange 回调:摘要大纲变化
 * @param {function(any[]): void} onSummaryDetailsChange 回调:摘要详情变化
 * @param {Ref<string | null>} currentVideoId 当前视频ID
 * @param {Ref<any>} subtitlesData 字幕数据
 * @param {Reactive<SummaryData>} summaryData 摘要数据
 * @returns
 */
export const useYouTubeSummaryHandler = (
  onStateChange: (state: YouTubePanelState) => void,
  onSummaryOutlineChange: (outline: string) => void,
  onSummaryDetailsChange: (details: any[]) => void,
  onSaveSummaryToCache: (videoId: string) => void,
  currentVideoId: Ref<string | null>,
  subtitlesData: Ref<any>,
  summaryData: Reactive<SummaryData>,
  getActualSubtitleState?: () => YouTubePanelState, // 新增：获取实际字幕状态的方法
  setInternalSubtitleState?: (state: YouTubePanelState) => void // 新增：设置内部字幕状态的方法
) => {
  // 任务管理 - 直接在这里管理 AbortController
  let currentAbortController: AbortController | null = null
  let isGenerating = false
  let messageListenerAdded = false

  // 重置任务状态 - 用于节点复用时清理任务状态
  const resetTaskState = () => {
    console.log('[SummaryHandler] 重置任务状态')
    if (currentAbortController && isGenerating) {
      currentAbortController.abort()
    }
    currentAbortController = null
    isGenerating = false
  }

  // 检查登录状态
  const checkLogin = async () => {
    const isLogin = await getTrpc().isLogin.query()
    if (isLogin) {
      return true
    } else {
      // 如果未登录，发送登录请求到 sidepanel
      browser.runtime.sendMessage({
        type: SidepanelEventType.LOGIN_REQUEST_FROM_CONTENT,
        data: {
          source: 'youtube-panel',
          action: 'generate-summary',
        },
      })
      return false
    }
  }

  // 检查余额和订阅状态
  const checkLimit = async () => {
    try {
      const [balanceData, hasSolverVip] = await Promise.all([
        getTrpc().getUserBalance.query(),
        getTrpc().getSubscriptionStatus.query(),
      ])

      // 检查返回值是否符合预期
      if (!balanceData) return false

      const pluginBalance = balanceData.plugin ?? 0
      const accountBalance = balanceData.balance ?? 0

      return pluginBalance > 0 || accountBalance >= 10 || !!hasSolverVip
    } catch (error) {
      console.error('[SummaryHandler] Error checking limits:', error)
      // 将网络错误抛出到调用方，由调用方决定UI
      throw error
    }
  }

  // 获取视频时长
  const getVideoDuration = async (): Promise<number | null> => {
    try {
      // 从YouTube播放器获取视频时长
      const videoElement = document.querySelector('video')
      if (videoElement && videoElement.duration && !isNaN(videoElement.duration)) {
        return videoElement.duration
      }
      
      // 如果video元素不可用，尝试从页面信息获取
      const durationText = document.querySelector('.ytp-time-duration')?.textContent
      if (durationText) {
        const timeParts = durationText.split(':').map(Number)
        if (timeParts.length === 3) {
          // HH:MM:SS 格式
          return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]
        } else if (timeParts.length === 2) {
          // MM:SS 格式
          return timeParts[0] * 60 + timeParts[1]
        }
      }
      
      // 尝试从meta标签获取
      const durationMeta = document.querySelector('meta[itemprop="duration"]')
      if (durationMeta) {
        const content = durationMeta.getAttribute('content')
        if (content) {
          // ISO 8601 格式: PT1H2M3S
          const match = content.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
          if (match) {
            const hours = parseInt(match[1] || '0')
            const minutes = parseInt(match[2] || '0')
            const seconds = parseInt(match[3] || '0')
            return hours * 3600 + minutes * 60 + seconds
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('[SummaryHandler] 获取视频时长失败:', error)
      return null
    }
  }

  // 取消当前任务（同时取消摘要和详情请求）
  const cancelCurrentTask = () => {
    if (currentAbortController && isGenerating) {
      console.log('[SummaryHandler] 取消当前摘要生成任务')
      currentAbortController.abort()
      currentAbortController = null
      isGenerating = false
      return true
    }
    return false
  }

  // 模拟点击字幕按钮获取字幕
  const attemptSubtitleButtonClick = async (videoId: string): Promise<{success: boolean, error?: string, data?: string}> => {
    // 添加onStateChange参数，用于更新UI状态
    const updateState = (state: any) => {
      if (onStateChange) {
        onStateChange(state)
      }
    }
    try {
      console.log('[SummaryHandler] 开始查找字幕按钮...')
      
      // 查找字幕按钮的多种可能选择器（基于DOM结构特征，不依赖语言）
      const subtitleSelectors = [
        // 1. 最可靠：class组合 + aria-keyshortcuts
        'button.ytp-subtitles-button[aria-keyshortcuts="c"]',
        // 2. 备用：class组合
        'button.ytp-subtitles-button',
        // 3. 备用：通过aria-keyshortcuts定位
        'button[aria-keyshortcuts="c"]',
        // 4. 备用：通过data-priority定位
        'button[data-priority="5"]',
        // 5. 备用：通过SVG图标内容定位（如果其他方法都失败）
        'button svg path[d*="M11,11 C9.9,11 9,11.9 9,13"]',
        // 6. 备用：通过aria-label包含特定关键词（多语言支持）
        'button[aria-label*="subtitle"]',
        'button[aria-label*="caption"]',
        'button[aria-label*="字幕"]',
        'button[aria-label*="cc"]',
        // 7. 备用：通过data属性
        'button[data-title-no-tooltip*="subtitle"]',
        'button[data-title-no-tooltip*="caption"]',
        'button[data-title-no-tooltip*="字幕"]',
        'button[data-tooltip-title*="subtitle"]',
        'button[data-tooltip-title*="caption"]',
        'button[data-tooltip-title*="字幕"]'
      ]
      
      let subtitleButton: HTMLElement | null = null

      let isClick = false
      
      // 尝试找到字幕按钮
      for (const selector of subtitleSelectors) {
        subtitleButton = document.querySelector(selector) as HTMLElement
        if (subtitleButton) {
          console.log(`[SummaryHandler] 找到字幕按钮: ${selector}`)
          break
        }
      }
      
      if (!subtitleButton) {
        return { success: false, error: '未找到字幕按钮' }
      }
      
      // 检查字幕按钮是否可用
      const isSubtitleButtonAvailable = checkSubtitleButtonAvailability(subtitleButton)
      if (!isSubtitleButtonAvailable) {
        console.log('[SummaryHandler] 字幕按钮不可用，中断YouTube总结流程')
        return { success: false, error: '字幕按钮不可用' }
      }
      
      // 设置监听器来捕获timedtext请求
      const timedTextPromise = new Promise<{url: string, data: string}>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('等待timedtext请求超时'))
          //UI状态设置为网络错误
          updateState(YouTubePanelStateEnum.SUMMARY_ERROR)
        }, 60000) // 60秒超时
        
        // 监听后台消息
        const messageListener = (message: any) => {
          if (message.type === 'TIMEDTEXT_LISTEN' && message.videoId === videoId) {
            // 立即点击关闭字幕按钮
            console.log('[SummaryHandler] 监听到TIMEDTEXT_LISTEN信号，立即点击关闭字幕按钮...')
            if (isClick ) {
              subtitleButton.click()
              isClick = false
            }
          } else if (message.type === 'TIMEDTEXT_INTERCEPTED' && message.videoId === videoId) {
            clearTimeout(timeout)
            browser.runtime.onMessage.removeListener(messageListener)
            resolve({ url: message.url, data: message.data })
          }
        }
        
        browser.runtime.onMessage.addListener(messageListener)
      })
      
      // 点击字幕按钮
      console.log('[SummaryHandler] 点击字幕按钮...')
      subtitleButton.click()
      isClick = true
      
      // 等待timedtext请求后再点击关闭
      try {
        // 等待timedtext请求
        const timedTextResult = await timedTextPromise
        console.log('[SummaryHandler] 捕获到timedtext请求:', timedTextResult.url)
        
        // 监听到timedtext请求后，点击关闭字幕
        console.log('[SummaryHandler] 监听到timedtext请求，点击关闭字幕按钮...')
        if(isClick){
          subtitleButton.click()
          isClick = false
        }
        
        // 验证获取到的字幕数据
        if (timedTextResult.data && timedTextResult.data.length > 0) {
          // 处理字幕数据
          const processedResult = await getTrpc().processSubtitleData.query({
            rawData: timedTextResult.data,
            videoId: videoId,
          })

          if (processedResult.success) {
            const { subtitles, meta } = JSON.parse(processedResult.data ?? '{}')
            
            // 检查字幕长度限制
            const MAX_SUBTITLES_WORDS = 30000
            const MAX_VIDEO_TIME = 3 * 60 * 60
            
            if (meta.wordCount > MAX_SUBTITLES_WORDS || meta.videoDuration >= MAX_VIDEO_TIME) {
              console.log('[SummaryHandler] 字幕过长，更新UI状态')
              updateState(YouTubePanelStateEnum.SUBTITLES_TOO_LONG)
              return { success: false, error: '字幕过长' }
            } else if (subtitles.length > 0) {
              // 字幕验证成功，现在手动触发缓存存储
              try {
                // 使用原始URL，不进行任何修改以避免截断
                const originalUrl = timedTextResult.url
                console.log('[SummaryHandler] 存储原始URL到缓存:', originalUrl.substring(0, 200) + '...')
                
                // 直接调用后台服务存储到缓存
                await getTrpc().storeSubtitleUrlToCache.query({
                  videoId: videoId,
                  url: originalUrl
                })
                
                console.log('[SummaryHandler] 字幕URL已存储到缓存')
                return { success: true, data: timedTextResult.data }
              } catch (cacheError) {
                console.warn('[SummaryHandler] 存储缓存失败，但字幕数据有效:', cacheError)
                return { success: true, data: timedTextResult.data } // 即使缓存失败，字幕数据仍然有效
              }
            } else {
              return { success: false, error: '字幕数据为空' }
            }
          } else {
            return { success: false, error: '字幕数据处理失败' }
          }
        } else {
          return { success: false, error: '未获取到字幕数据' }
        }
      } catch (timeoutError) {
        if(isClick) {
          subtitleButton.click()
          isClick = false
        } 
        console.warn('[SummaryHandler] 等待timedtext请求超时:', timeoutError)
        return { success: false, error: '等待字幕请求超时' }
      }
      
    } catch (error) {
      console.error('[SummaryHandler] 模拟点击字幕按钮失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  }

  // 检测当前是否是广告
  const isYouTubeAdPlaying = (): boolean => {
    const player = document.querySelector('.html5-video-player')
    return !!(player && player.classList.contains('ad-showing'))
  }

  // 监听广告结束
  const waitForAdToEnd = (callback: () => void): void => {
    const player = document.querySelector('.html5-video-player')
    if (!player) {
      console.warn('[SummaryHandler] 未找到播放器')
      callback()
      return
    }

    const observer = new MutationObserver(() => {
      if (!isYouTubeAdPlaying()) {
        observer.disconnect()
        console.log('[SummaryHandler] 广告结束，继续执行生成')
        callback()
      }
    })

    observer.observe(player, { attributes: true, attributeFilter: ['class'] })
    console.log('[SummaryHandler] 正在等待广告结束...')
  }

  // 生成摘要
  const generateSummary = async () => {
    // 添加点击埋点
    trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary', {
      videoId: currentVideoId.value ?? '',
    })
    // 如果正在生成，先取消当前任务
    if (isGenerating) {
      console.log('[SummaryHandler] 检测到正在生成中的任务，先取消')
      cancelCurrentTask()
      trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
        state: 'test the task is generating, cancel it',
      })
    }

    // 检查是否是广告页面
    if (isYouTubeAdPlaying()) {
      console.log('[SummaryHandler] 检测到广告，挂起请求等待广告结束')
      onStateChange(YouTubePanelStateEnum.SUMMARY_LOADING) // 先显示鱼骨图

      trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
        state: 'detect the ad, wait for the ad to end',
        adStartTime: new Date().getTime(),
      })
      return new Promise((resolve) => {
        waitForAdToEnd(() => {
          // 广告结束后继续执行生成
          trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
            state: 'the ad is end, continue to generate',
            adEndTime: new Date().getTime(),
          })
          executeGeneration().then(resolve)
        })
      })
    }

    // 没有广告，直接执行生成
    trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
      state: 'no ad, continue to generate',
    })
    return executeGeneration()
  }

  // 实际的生成逻辑
  const executeGeneration = async (): Promise<boolean> => {

    // 0. 检查视频时长（在开始生成前先检查）
    try {
      console.log('[SummaryHandler] 0. 检查视频时长...')
      
      // 获取视频时长信息
      const videoDuration = await getVideoDuration()
      console.log('[SummaryHandler] 视频时长:', videoDuration, '秒')
      
      if (videoDuration && videoDuration >= 3 * 60 * 60) { // 3小时 = 10800秒
        console.log('[SummaryHandler] 视频超过3小时，直接显示字幕过长状态')
        onStateChange(YouTubePanelStateEnum.SUBTITLES_TOO_LONG)
        
        // 添加埋点
        trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
          videoId: currentVideoId.value ?? '',
          caption: 'none',
          player: 'other',
          reason: '视频超过3小时',
          videoDuration: videoDuration,
        })
        
        return false
      }
    } catch (error) {
      trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
        state: 'get the video duration failed, continue to generate',
      })
      console.warn('[SummaryHandler] 获取视频时长失败，继续执行:', error)
      // 如果获取视频时长失败，继续执行，不阻止用户尝试
    }

    // 立即显示加载状态，避免UI空白
    console.log('[SummaryHandler] 开始生成摘要')
    onStateChange(YouTubePanelStateEnum.SUMMARY_LOADING)

    // 跟踪字幕来源类型
    let subtitleSource: 'auto' | 'player' | 'simulate' = 'simulate'

    // 1. 检查登录状态
    const isLogin = await checkLogin()
    console.log('[SummaryHandler] 1. 检查登录状态: ', isLogin)
    if (!isLogin) {
      trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
        state: 'check the login failed, continue to generate',
      })
      onStateChange(YouTubePanelStateEnum.READY_TO_GENERATE) // 回到准备状态
      return false
    }

    // 2. 检查余额（替换原有逻辑，直接发送三包请求到sidepanel，而不是更新OUT_LIMIT的组件）
    let isLimit = false
    try {
      isLimit = await checkLimit()
      console.log('[SummaryHandler] 2. 检查余额: ', isLimit)
    } catch (limitError) {
      console.error('[SummaryHandler] 检查额度网络错误:', limitError)
      onStateChange(YouTubePanelStateEnum.SUMMARY_ERROR)
      trackEvent.trackError('Plugin_Youtubepanel_Check_Limit_Error', limitError, {
        videoId: currentVideoId.value ?? '',
        errorInfo: String(limitError),
      })
      return false
    }
    trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
      state: 'check the limit, isLimit',
      isLimit: isLimit,
    })

    if (!isLimit) {
      // onStateChange(YouTubePanelStateEnum.OUT_LIMIT)
      browser.runtime.sendMessage({
        type: SidepanelEventType.YOUTUBE_OUT_LIMIT_TO_SIDEPANEL,
        data: {
          videoId: currentVideoId.value ?? '',
        },
      })
      trackEvent.track('Plugin_Youtubepanel_Out_Limit', {
        videoId: currentVideoId.value ?? '',
      })
      onStateChange(YouTubePanelStateEnum.READY_TO_GENERATE) // 回到准备状态
      return false
    }

    // 3. 检查实际的字幕状态（登录和余额都OK后才检查）
    // 重新获取字幕状态，因为用户可能在页面加载后手动开启了字幕
    const actualSubtitleState = getActualSubtitleState?.() || YouTubePanelStateEnum.INITIAL
    console.log('[SummaryHandler] 3. 当前字幕状态:', actualSubtitleState)
    trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
      state: 'get the actual subtitle state',
      actualSubtitleState: actualSubtitleState.toString(),
    })

    // 如果字幕状态已经是SUBTITLES_HAS，说明用户原先就打开了字幕
    if (actualSubtitleState === YouTubePanelStateEnum.SUBTITLES_HAS) {
      console.log('[SummaryHandler] 字幕状态已经是SUBTITLES_HAS，用户原先打开了字幕')
      subtitleSource = 'auto' // 标记为自动获取（用户原先打开字幕）
      trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
        state: 'the subtitle state is SUBTITLES_HAS, user has opened the subtitle',
        subtitleSource: subtitleSource.toString(),
      })
    }

    // 如果字幕状态不是SUBTITLES_HAS，尝试重新检查
    if (actualSubtitleState !== YouTubePanelStateEnum.SUBTITLES_HAS) {
      console.log('[SummaryHandler] 字幕状态不可用，尝试重新获取字幕...')
      trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
        state: 'the subtitle state is not SUBTITLES_HAS, try to get the subtitle',
      })
      // 保持SUMMARY_LOADING状态，不切换到SUBTITLES_LOADING
      
      try {
        // 重新尝试获取缓存的字幕URL
        const cachedUrlRes = await getTrpc().getSubtitleUrlByVideoId.query(currentVideoId.value ?? '')
        
        if (cachedUrlRes.success && cachedUrlRes.url) {
          console.log('[SummaryHandler] 找到缓存的字幕URL，尝试获取字幕内容')
          trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
            state: 'find the cached subtitle url, try to get the subtitle content',
          })
          // 使用缓存的URL获取字幕数据
          const subtitleResponse = await fetch(cachedUrlRes.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.youtube.com/',
            },
          })

          if (subtitleResponse.ok) {
            const rawSubtitleData = await subtitleResponse.text()
            
            if (rawSubtitleData.length > 0) {
              // 处理字幕数据
              const processedResult = await getTrpc().processSubtitleData.query({
                rawData: rawSubtitleData,
                videoId: currentVideoId.value ?? '',
              })

              if (processedResult.success) {
                const { subtitles, meta } = JSON.parse(processedResult.data ?? '{}')
                
                // 检查字幕长度限制
                const MAX_SUBTITLES_WORDS = 30000
                const MAX_VIDEO_TIME = 3 * 60 * 60
                
                if (meta.wordCount > MAX_SUBTITLES_WORDS || meta.videoDuration >= MAX_VIDEO_TIME) {
                  console.log('[SummaryHandler] 字幕过长')
                  onStateChange(YouTubePanelStateEnum.SUBTITLES_TOO_LONG)
                  // 添加失败埋点 - 字幕过长
                  trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                    videoId: currentVideoId.value ?? '',
                    caption: 'failed',
                    player: 'other',
                    reason: '字幕过长',
                  })
                  return false
                } else if (subtitles.length > 0) {
                  console.log('[SummaryHandler] 字幕获取成功，继续生成流程')
                  // 更新字幕数据，继续执行
                  // 注意：这里不更新subtitlesData，因为这个检查只是为了验证
                  subtitleSource = 'player' // 标记为player接口获取（缓存URL）
                } else {
                  console.log('[SummaryHandler] 字幕数据为空')
                  onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
                  // 添加失败埋点 - 无字幕
                  trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                    videoId: currentVideoId.value ?? '',
                    caption: 'none',
                    player: 'other',
                    reason: '字幕数据为空',
                  })
                  return false
                }
              } else {
                console.log('[SummaryHandler] 字幕数据处理失败')
                onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
                // 添加失败埋点 - 字幕处理失败
                trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                  videoId: currentVideoId.value ?? '',
                  caption: 'failed',
                  player: 'other',
                  reason: '字幕数据处理失败',
                })
                return false
              }
            } else {
              console.log('[SummaryHandler] 字幕内容为空')
              onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
              return false
            }
          } else {
            console.log('[SummaryHandler] 字幕URL请求失败')
            onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
            // 添加失败埋点 - 字幕URL请求失败
            trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
              videoId: currentVideoId.value ?? '',
              caption: 'failed',
              player: 'other',
              reason: '字幕URL请求失败',
            })
            return false
          }
        } else {
          console.log('[SummaryHandler] 未找到缓存的字幕URL')
          trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
            state: 'not find the cached subtitle url, try to click the subtitle button',
          })
          // 最后的兜底方案：尝试模拟点击字幕按钮
          console.log('[SummaryHandler] 尝试模拟点击字幕按钮...')
          const subtitleClickResult = await attemptSubtitleButtonClick(currentVideoId.value ?? '')
          
          if (subtitleClickResult.success) {
            console.log('[SummaryHandler] 模拟点击成功，获取到字幕数据')
            trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
              state: 'click the subtitle button success, get the subtitle data',
            })
            // 字幕获取成功，继续执行
            // 注意：这里需要更新字幕数据，因为模拟点击获取的字幕数据已经在后台处理过了
            // 我们需要重新获取处理后的字幕数据
            try {
              const processedResult = await getTrpc().processSubtitleData.query({
                rawData: subtitleClickResult.data || '', // 使用模拟点击获取的原始数据
                videoId: currentVideoId.value ?? '',
              })

              if (processedResult.success) {
                const { subtitles, meta } = JSON.parse(processedResult.data ?? '{}')
                
                // 检查字幕长度限制
                const MAX_SUBTITLES_WORDS = 30000
                const MAX_VIDEO_TIME = 3 * 60 * 60
                
                if (meta.wordCount > MAX_SUBTITLES_WORDS || meta.videoDuration >= MAX_VIDEO_TIME) {
                  console.log('[SummaryHandler] 字幕过长')
                  onStateChange(YouTubePanelStateEnum.SUBTITLES_TOO_LONG)
                  // 添加失败埋点 - 模拟点击获取字幕过长
                  trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                    videoId: currentVideoId.value ?? '',
                    caption: 'failed',
                    player: 'other',
                    reason: '模拟点击获取字幕过长',
                  })
                  return false
                } else if (subtitles.length > 0) {
                  console.log('[SummaryHandler] 模拟点击获取的字幕数据有效，更新字幕数据')
                  // 更新字幕数据
                  subtitlesData.value = subtitles
                  // 更新内部状态
                  if (setInternalSubtitleState) {
                    setInternalSubtitleState(YouTubePanelStateEnum.SUBTITLES_HAS)
                  }
                  subtitleSource = 'simulate' // 标记为模拟点击获取
                } else {
                  console.log('[SummaryHandler] 模拟点击获取的字幕数据为空')
                  onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
                  // 添加失败埋点 - 模拟点击获取字幕为空
                  trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                    videoId: currentVideoId.value ?? '',
                    caption: 'failed',
                    player: 'other',
                    reason: '模拟点击获取字幕为空',
                  })
                  return false
                }
              } else {
                console.log('[SummaryHandler] 模拟点击获取的字幕数据处理失败')
                onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
                // 添加失败埋点 - 模拟点击获取字幕处理失败
                trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                  videoId: currentVideoId.value ?? '',
                  caption: 'failed',
                  player: 'other',
                  reason: '模拟点击获取字幕处理失败',
                })
                return false
              }
            } catch (processError) {
              console.error('[SummaryHandler] 处理模拟点击获取的字幕数据时出错:', processError)
              onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
              // 添加失败埋点 - 处理模拟点击获取的字幕数据时出错
              trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                videoId: currentVideoId.value ?? '',
                caption: 'failed',
                player: 'other',
                reason: '处理模拟点击获取的字幕数据时出错',
              })
              return false
            }
          } else {
            console.log('[SummaryHandler] 模拟点击失败:', subtitleClickResult.error)
            
            // 检查是否是字幕过长的错误
            if (subtitleClickResult.error === '字幕过长') {
              console.log('[SummaryHandler] 检测到字幕过长错误，更新UI状态')
              onStateChange(YouTubePanelStateEnum.SUBTITLES_TOO_LONG)
              // 添加失败埋点 - 字幕过长
              trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
                videoId: currentVideoId.value ?? '',
                caption: 'failed',
                player: 'other',
                reason: '字幕过长',
              })
              return false
            }
            
            // 其他错误按无字幕处理
            onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
            // 添加失败埋点 - 模拟点击失败
            // 模拟点击失败说明按钮是可点击的，所以caption是failed
            trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
              videoId: currentVideoId.value ?? '',
              caption: 'failed',
              player: 'other',
              reason: '模拟点击失败',
            })
            return false
          }
        }
      } catch (error) {
        console.error('[SummaryHandler] 重新检查字幕时发生错误:', error)
        onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
        // 添加失败埋点 - 重新检查字幕时发生错误
        trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
          videoId: currentVideoId.value ?? '',
          caption: 'failed',
          player: 'other',
          reason: '重新检查字幕时发生错误',
        })
        return false
      }
    }

    trackEvent.track('Plugin_Sidebar_Hjh_Summary', {
      state: 'get the subtitle success',
    })

  // 60秒全局超时兜底
  let globalTimeout: NodeJS.Timeout | null = null
  
  try {
      // 保存生成开始时的视频ID，防止视频切换时缓存错乱
      const generationStartVideoId = currentVideoId.value ?? ''
      
      // 创建新的 AbortController
      currentAbortController = new AbortController()
      isGenerating = true

      const startTimestamp = Date.now()

      trackEvent.track('Plugin_Youtubepanel_Generate_Start', {
        videoId: generationStartVideoId,
      })

      console.log('[SummaryHandler] 开始生成摘要，视频ID:', generationStartVideoId)
      onStateChange(YouTubePanelStateEnum.SUMMARY_LOADING)

      // 清空摘要和详情的缓存
      onSummaryOutlineChange('')
      onSummaryDetailsChange([])

      const trpc = getTrpc()

      // 用于跟踪完成状态
      let outlineSuccess = false
      let detailsSuccess = false
      let hasSetPartialComplete = false
      
      // 用于跟踪错误信息
      let outlineErrorMessage = ''
      let detailsErrorMessage = ''
      
      // 启动60秒全局超时兜底
      globalTimeout = setTimeout(() => {
        if (isGenerating && !outlineSuccess) {
          console.log('[SummaryHandler] 60秒超时，没有收到summaryOutline成功响应，切换到网络错误状态')
          onStateChange(YouTubePanelStateEnum.SUMMARY_ERROR)
          isGenerating = false
          currentAbortController = null
          
          // 添加超时埋点
          trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Timeout', {
            videoId: generationStartVideoId,
            duration: 60000,
            reason: '60秒超时未收到summaryOutline响应'
          })
        }
      }, 60000) // 60秒超时

      // 并行启动两个请求，任何一个成功就先展示内容
      const outlinePromise = trpc.getYouTubeOutline
        .query(
          {
            subtitles: subtitlesData.value,
            videoId: generationStartVideoId,
          },
          {
            signal: currentAbortController.signal,
          }
        )
        .then((result) => {
          // 检查是否被取消
          if (!isGenerating) return

          if (result?.data?.outline) {
            console.log('[SummaryHandler] 大纲生成完成')
            onSummaryOutlineChange(result.data.outline)
            outlineSuccess = true
            
            // 清除60秒超时定时器
            if (globalTimeout) {
              clearTimeout(globalTimeout)
            }

            // 如果这是第一个完成的请求，先设置完成状态让用户看到内容
            if (!hasSetPartialComplete) {
              hasSetPartialComplete = true
              console.log('[SummaryHandler] 大纲先完成，先设置完成状态展示内容')
              onStateChange(
                YouTubePanelStateEnum.SUMMARY_LOADING_OUTLINE_COMPLETE
              )
            }
          }

          try {
            browser.runtime.sendMessage({
              type: SidepanelEventType.YOUTUBE_SUMMARY_COMPLETED_TO_SIDEPANEL,
            })
          } catch (e) {
            console.warn('[SummaryHandler] 发送完成事件失败:', e)
          }

          trackEvent.track('Plugin_Youtubepanel_Generate_Outline_Success', {
            videoId: generationStartVideoId,
            duration: Date.now() - startTimestamp,
            outline: !!result?.data?.outline,
          })
        })
        .catch((error) => {
          if (!isGenerating) return
          
          // 更健壮的错误信息提取
          let errorMessage = 'Unknown error'
          try {
            if (error?.message) {
              errorMessage = error.message
            } else if (error?.response?.data?.message) {
              errorMessage = error.response.data.message
            } else if (error?.response?.data?.error) {
              errorMessage = error.response.data.error
            } else if (typeof error === 'string') {
              errorMessage = error
            } else if (error?.toString) {
              errorMessage = error.toString()
            }
          } catch (extractError) {
            console.warn('[SummaryHandler] 错误信息提取失败:', extractError)
            errorMessage = 'Error message extraction failed'
          }
          
          outlineErrorMessage = errorMessage
          trackEvent.trackError(
            'Plugin_Youtubepanel_Generate_Outline_Error',
            error,
            {
              videoId: generationStartVideoId,
              duration: Date.now() - startTimestamp,
            }
          )
          console.error('[SummaryHandler] 大纲生成失败:', error)
          console.error('[SummaryHandler] 大纲错误详情:', {
            message: errorMessage,
            name: error?.name,
            stack: error?.stack,
            fullError: error
          })
        })

      const detailsPromise = trpc.getYouTubeDetails
        .query(
          {
            subtitles: subtitlesData.value,
            videoId: generationStartVideoId,
          },
          {
            signal: currentAbortController.signal,
          }
        )
        .then((result) => {
          // 检查是否被取消
          if (!isGenerating) return

          if (result?.data?.details) {
            console.log('[SummaryHandler] 详情生成完成')
            onSummaryDetailsChange(result.data.details)
            detailsSuccess = true

            // 如果这是第一个完成的请求，先设置完成状态让用户看到内容
            if (!hasSetPartialComplete) {
              hasSetPartialComplete = true
              console.log('[SummaryHandler] 详情先完成，先设置完成状态展示内容')
              onStateChange(YouTubePanelStateEnum.SUMMARY_COMPLETE)
            }
          }

          try {
            browser.runtime.sendMessage({
              type: SidepanelEventType.YOUTUBE_SUMMARY_COMPLETED_TO_SIDEPANEL,
            })
          } catch (e) {
            console.warn('[SummaryHandler] 发送完成事件失败:', e)
          }

          trackEvent.track('Plugin_Youtubepanel_Generate_Details_Success', {
            videoId: generationStartVideoId,
            duration: Date.now() - startTimestamp,
            details: !!result?.data?.details,
          })
        })
        .catch((error) => {
          if (!isGenerating) return
          
          // 更健壮的错误信息提取
          let errorMessage = 'Unknown error'
          try {
            if (error?.message) {
              errorMessage = error.message
            } else if (error?.response?.data?.message) {
              errorMessage = error.response.data.message
            } else if (error?.response?.data?.error) {
              errorMessage = error.response.data.error
            } else if (typeof error === 'string') {
              errorMessage = error
            } else if (error?.toString) {
              errorMessage = error.toString()
            }
          } catch (extractError) {
            console.warn('[SummaryHandler] 错误信息提取失败:', extractError)
            errorMessage = 'Error message extraction failed'
          }
          
          detailsErrorMessage = errorMessage
          trackEvent.trackError(
            'Plugin_Youtubepanel_Generate_Details_Error',
            error,
            {
              videoId: generationStartVideoId,
              duration: Date.now() - startTimestamp,
            }
          )
          console.error('[SummaryHandler] 详情生成失败:', error)
          console.error('[SummaryHandler] 详情错误详情:', {
            message: errorMessage,
            name: error?.name,
            stack: error?.stack,
            fullError: error
          })
        })

      // 等待两个请求都完成
      await Promise.allSettled([outlinePromise, detailsPromise])

      // 检查是否被取消
      if (!isGenerating) {
        console.log('[SummaryHandler] 任务在完成前被取消')
        return false
      }

      // 最终状态判断：优化处理逻辑
      if (outlineSuccess && detailsSuccess) {
        console.log('[SummaryHandler] 两个接口都成功，确认完成状态')
        trackEvent.track('Plugin_Youtubepanel_Success', {
          videoId: generationStartVideoId,
          duration: Date.now() - startTimestamp,
        })
        // 添加新的成功埋点
        trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Success', {
          videoId: generationStartVideoId,
          type: subtitleSource,
        })
        onStateChange(YouTubePanelStateEnum.SUMMARY_COMPLETE)
        // 缓存摘要内容(summaryData.outline)以及详情内容(summaryData.details)
        onSaveSummaryToCache(generationStartVideoId)
      } else if (outlineSuccess || detailsSuccess) {
        // 部分成功：至少有一个接口成功
        console.log('[SummaryHandler] 部分成功，检查是否有足够内容显示')
        const hasOutline = summaryData.outline && summaryData.outline.trim().length > 0
        const hasDetails = summaryData.details && summaryData.details.length > 0
        
        if (hasOutline || hasDetails) {
          console.log('[SummaryHandler] 有部分内容，显示部分结果')
          trackEvent.track('Plugin_Youtubepanel_Partial_Success', {
            videoId: generationStartVideoId,
            duration: Date.now() - startTimestamp,
            hasOutline,
            hasDetails,
          })
          // 添加新的成功埋点（部分成功）
          trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Success', {
            videoId: generationStartVideoId,
            type: subtitleSource,
          })
          onStateChange(YouTubePanelStateEnum.SUMMARY_COMPLETE)
          // 即使是部分成功，也尝试缓存已有内容
          onSaveSummaryToCache(generationStartVideoId)
        } else {
          console.log('[SummaryHandler] 虽然部分成功但没有有效内容，显示错误状态')
          handleGenerationError(outlineErrorMessage, detailsErrorMessage, startTimestamp, subtitleSource)
        }
      } else {
        console.log('[SummaryHandler] 两个接口都失败，设置错误状态')
        handleGenerationError(outlineErrorMessage, detailsErrorMessage, startTimestamp, subtitleSource)
      }
      
      // 清理状态
      if (globalTimeout) {
        clearTimeout(globalTimeout) // 清除60秒超时定时器
      }
      isGenerating = false
      currentAbortController = null

      return true
    } catch (error) {
      // 只有在仍在生成状态时才处理错误
      if (isGenerating) {
        console.error('[SummaryHandler] 生成摘要时发生错误:', error)
        if (globalTimeout) {
          clearTimeout(globalTimeout) // 清除60秒超时定时器
        }
        onStateChange(YouTubePanelStateEnum.SUMMARY_ERROR)
        isGenerating = false
        currentAbortController = null
        trackEvent.trackError('Plugin_Youtubepanel_Generate_Error', error, {
          videoId: currentVideoId.value ?? '',
        })
        // 添加新的失败埋点
        trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
          videoId: currentVideoId.value ?? '',
          caption: 'failed',
          player: 'other',
          reason: '生成摘要时发生错误',
        })
      }

      try {
        browser.runtime.sendMessage({
          type: SidepanelEventType.YOUTUBE_SUMMARY_COMPLETED_TO_SIDEPANEL,
        })
      } catch (e) {
        console.warn('[SummaryHandler] 发送完成事件失败:', e)
      }

      return false
    }
  }

  // 监听登录成功的消息
  const handleLoginSuccess = (message: any) => {
    if (message.type === SidepanelEventType.LOGIN_SUCCESS_TO_CONTENT) {
      console.log('[SummaryHandler] YouTube面板收到登录成功消息', message.data)
      // 登录成功后，继续执行生成摘要的操作
      if (
        message.data?.source === 'youtube-panel' &&
        message.data?.action === 'generate-summary'
      ) {
        // 重新执行生成摘要
        generateSummary()
      }
    }
  }

  // 清空摘要，回到初始状态
  const clearSummary = () => {
    // 先取消当前任务
    cancelCurrentTask()

    onSummaryOutlineChange('')
    onSummaryDetailsChange([])
    onStateChange(YouTubePanelStateEnum.READY_TO_GENERATE)
  }

  // 启动消息监听
  const startMessageListener = () => {
    if (!messageListenerAdded) {
      console.log('[SummaryHandler] 启动消息监听器')
      browser.runtime.onMessage.addListener(handleLoginSuccess)
      messageListenerAdded = true
    } else {
      console.log('[SummaryHandler] 消息监听器已经启动，跳过')
    }
  }

  // 停止消息监听
  const stopMessageListener = () => {
    if (messageListenerAdded) {
      console.log('[SummaryHandler] 停止消息监听器')
      browser.runtime.onMessage.removeListener(handleLoginSuccess)
      messageListenerAdded = false
    }
  }

  // 获取当前任务状态
  const getTaskStatus = () => {
    return {
      isGenerating,
      canCancel: !!currentAbortController,
    }
  }

  // 新增：获取当前摘要数据的方法
  const getSummaryData = () => {
    return {
      outline: summaryData.outline,
      details: summaryData.details,
    }
  }

  // 新增：获取摘要大纲的方法
  const getSummaryOutline = () => {
    return summaryData.outline
  }

  // 新增：获取摘要详情的方法
  const getSummaryDetails = () => {
    return summaryData.details
  }

  // 处理生成错误的辅助函数
  const handleGenerationError = (outlineError: string, detailsError: string, startTime: number, subtitleSource: 'auto' | 'player' | 'simulate') => {
    // 改进余额不足错误检测逻辑，更加健壮
    const checkOutOfBalance = (errorMessage: string): boolean => {
      if (!errorMessage || typeof errorMessage !== 'string') {
        return false
      }
      
      const lowerError = errorMessage.toLowerCase()
      return lowerError.includes('余额不足') || 
             lowerError.includes('insufficient balance') ||
             lowerError.includes('out of balance') ||
             lowerError.includes('用户余额不足') ||
             lowerError.includes('balance insufficient')
    }
    
    // 检查player API返回的playabilityStatus
    const checkPlayerStatus = (errorMessage: string): 'robot' | 'unplayable' | 'login_required' | 'other' => {
      if (!errorMessage || typeof errorMessage !== 'string') {
        return 'other'
      }
      
      const lowerError = errorMessage.toLowerCase()
      
      // 检查机器人验证
      if (lowerError.includes('bot') || 
          lowerError.includes('robot') || 
          lowerError.includes('sign in to confirm') ||
          lowerError.includes('login required')) {
        return 'robot'
      }
      
      // 检查视频不可播放
      if (lowerError.includes('unplayable') || 
          lowerError.includes('video unavailable') ||
          lowerError.includes('playback on other websites has been disabled') ||
          lowerError.includes('video owner')) {
        return 'unplayable'
      }
      
      // 检查需要登录
      if (lowerError.includes('login required') || 
          lowerError.includes('sign in to confirm')) {
        return 'login_required'
      }
      
      return 'other'
    }
    
    const isOutOfBalance = checkOutOfBalance(outlineError) || checkOutOfBalance(detailsError)
    const playerStatus = checkPlayerStatus(outlineError) || checkPlayerStatus(detailsError)
    
    if (isOutOfBalance) {
      console.log('[SummaryHandler] 检测到余额不足错误，跳转到三包')
      // 发送余额不足消息到sidepanel
      browser.runtime.sendMessage({
        type: SidepanelEventType.YOUTUBE_OUT_LIMIT_TO_SIDEPANEL,
        data: {
          videoId: currentVideoId.value ?? '',
        },
      })
      trackEvent.track('Plugin_Youtubepanel_Out_Limit', {
        videoId: currentVideoId.value ?? '',
      })
      return false
    } else {
      // 其他错误按原来的逻辑处理
      onStateChange(
        outlineError === 'ResponsibleAIPolicyViolation' ||
        detailsError === 'ResponsibleAIPolicyViolation'
          ? YouTubePanelStateEnum.CONTENT_POLICY_ERROR
          : YouTubePanelStateEnum.SUMMARY_ERROR
      )
      trackEvent.track('Plugin_Youtubepanel_Generate_Error', {
        videoId: currentVideoId.value ?? '',
        duration: Date.now() - startTime,
        outlineError,
        detailsError,
      })
      
      // 添加新的失败埋点
      const failureReason = outlineError === 'ResponsibleAIPolicyViolation' || detailsError === 'ResponsibleAIPolicyViolation' 
        ? 'content_policy' 
        : 'failed'
      
      // 根据subtitleSource判断caption状态
      // 如果是simulate，说明用户原先没有打开字幕，按钮是可点击的，所以是failed
      // 如果是auto，说明用户原先打开了字幕，但最终失败，所以是failed
      const captionStatus = 'failed' // 因为走到了这里说明最终是失败状态
      
      trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
        videoId: currentVideoId.value ?? '',
        caption: captionStatus,
        player: playerStatus,
        reason: failureReason,
      })
    }
  }

  return {
    generateSummary,
    clearSummary,
    cancelCurrentTask,
    resetTaskState,
    getTaskStatus,
    getSummaryData,
    getSummaryOutline,
    getSummaryDetails,
    startMessageListener,
    stopMessageListener,
  }
}
