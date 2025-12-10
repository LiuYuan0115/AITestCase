import { getTrpc } from '~/lib/trpc/client'
import type { YouTubePanelState } from './useYouTubePanelProvider'
import { YouTubePanelStateEnum } from './useYouTubePanelProvider'
import { youtubeSummaryStorageCache } from '~/utils/youtubeSummaryStorageCache'
import trackEvent from '~/utils/trackEvent'

const MAX_VIDEO_TIME = 3 * 60 * 60 // (s) 3 hours
const MAX_SUBTITLES_WORDS = 30000 // 3w words

// 防抖函数
const debounce = (func: Function, delay: number) => {
  let timerId: NodeJS.Timeout
  return (...args: any[]) => {
    clearTimeout(timerId)
    timerId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

export const useYouTubeVideoObserver = (
  onVideoIdChange: (videoId: string) => void,
  onStateChange: (state: YouTubePanelState,modal?:'1'|'2'|'3') => void,
  onSubtitlesDataChange: (data: any) => void,
  onSummaryDataChange?: (outline: string, details: any[]) => void,
  onVideoIdChangeCallback?: (videoId: string) => void // 新增：视频ID变化时的回调，用于中断之前的生成
) => {
  let observer: MutationObserver | null = null
  let currentVideoId = ''
  let isObserverRunning = false
  let fetchInProgress = false

  // 检查字幕按钮可用性的函数
  const checkSubtitleButtonAvailability = async (): Promise<boolean> => {
    try {
      // 等待字幕按钮出现
      const subtitleButton = await waitForSubtitleButton()
      if (!subtitleButton) {
        console.log('[字幕按钮检测] 未找到字幕按钮')
        return false
      }

      const fillOpacity = subtitleButton.querySelector('svg')?.getAttribute('fill-opacity')
      console.log(`[字幕按钮检测] fill-opacity: ${fillOpacity}`)

      const isAvailable = fillOpacity !== '0.3'
      console.log(`[字幕按钮检测] 按钮${isAvailable ? '可用' : '不可用'}`)
      
      return isAvailable
    } catch (error) {
      console.error('[字幕按钮检测] 检测过程中发生错误:', error)
      return false
    }
  }

  // 等待字幕按钮出现的函数
  const waitForSubtitleButton = (timeout = 5000): Promise<HTMLElement | null> => {
    return new Promise((resolve) => {
      // 先检查是否已经存在
      const existingButton = document.querySelector('button.ytp-subtitles-button[aria-keyshortcuts="c"]') as HTMLElement
      if (existingButton) {
        resolve(existingButton)
        return
      }

      // 如果不存在，等待出现
      const observer = new MutationObserver((mutations) => {
        const button = document.querySelector('button.ytp-subtitles-button[aria-keyshortcuts="c"]') as HTMLElement
        if (button) {
          observer.disconnect()
          resolve(button)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      // 设置超时
      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, timeout)
    })
  }

  // 异步函数：检查缓存并获取视频数据
  const fetchVideoData = async () => {
    // 防止重复请求
    if (fetchInProgress) {
      console.log('[VideoObserver] 已有请求进行中，跳过')
      return
    }

    // 从当前 URL 的查询参数中获取视频 ID
    const queryString = window.location.search
    const urlParams = new URLSearchParams(queryString)
    const videoId = urlParams.get('v')

    // 如果没有获取到视频 ID 或者视频 ID 与当前已处理的相同，则不执行后续操作
    if (!videoId || videoId === currentVideoId) {
      return
    }

    fetchInProgress = true

    try {
      // 更新当前视频 ID，并重置状态
      const oldVideoId = currentVideoId
      currentVideoId = videoId
      onVideoIdChange(videoId)
      
      // 调用视频ID变化回调，中断之前的生成过程
      if (onVideoIdChangeCallback) {
        console.log('[VideoObserver] 调用视频ID变化回调，中断之前的生成过程')
        onVideoIdChangeCallback(videoId)
      }
      
      onStateChange(YouTubePanelStateEnum.INITIAL)

      console.log(`[VideoObserver] 检测到视频ID变化: ${oldVideoId} -> ${videoId}`)

      // 前置检测：检查字幕按钮是否可用
      const isSubtitleButtonAvailable = await checkSubtitleButtonAvailability()
      console.log(`[VideoObserver] 字幕按钮检测结果: ${isSubtitleButtonAvailable}`)
      
      if (!isSubtitleButtonAvailable) {
        console.log('[VideoObserver] 字幕按钮不可用，设置为无字幕状态')
        
        // 添加埋点：前置检测字幕按钮不可用
        trackEvent.track('Plugin_Sidebar_YouTube_Generate_Summary_Failed', {
          videoId: videoId,
          caption: 'none',
          player: 'other',
          reason: '前置检测字幕按钮不可用',
        })
        
        onStateChange(YouTubePanelStateEnum.SUBTITLES_NO,'3')
        return
      }

      // 优先检查缓存中是否有摘要数据
      try {
        const cachedSummaryData = await youtubeSummaryStorageCache.get(videoId)
        if (
          cachedSummaryData &&
          cachedSummaryData.outline &&
          cachedSummaryData.details?.length > 0
        ) {
          console.log('[VideoObserver] 发现缓存的摘要数据，直接加载:', videoId)

          // 直接设置摘要数据并跳转到完成状态
          if (onSummaryDataChange) {
            onSummaryDataChange(
              cachedSummaryData.outline,
              cachedSummaryData.details
            )
          }
          onStateChange(YouTubePanelStateEnum.SUMMARY_COMPLETE)

          // 即使有缓存数据，也需要获取字幕数据用于重试功能
          console.log('[VideoObserver] 有缓存数据，但仍需要获取字幕数据用于重试:', videoId)
          await fetchSubtitles(videoId, true) // 传入true表示跳过状态改变
          return
        }
      } catch (error) {
        console.error('[VideoObserver] 检查缓存时发生错误:', error)
        // 缓存检查失败时继续正常流程
      }

      // 没有缓存数据时，继续原有的字幕获取流程
      console.log('[VideoObserver] 未找到缓存数据，开始获取字幕:', videoId)
      await fetchSubtitles(videoId, false) // 传入false表示正常改变状态
    } finally {
      fetchInProgress = false
    }
  }

  // 获取字幕数据的函数（修改为优先使用缓存的 URL）
  const fetchSubtitles = async (videoId: string, skipStateChange: boolean = false) => {
    try {
      if (!skipStateChange) {
        onStateChange(YouTubePanelStateEnum.SUBTITLES_LOADING)
      }

      // 首先尝试获取缓存的字幕URL
      console.log('[VideoObserver] 尝试获取缓存的字幕URL:', videoId)
      const cachedUrlRes = await getTrpc().getSubtitleUrlByVideoId.query(
        videoId
      )

      if (cachedUrlRes.success && cachedUrlRes.url) {
        console.log('[VideoObserver] 找到缓存的字幕URL，开始获取字幕内容:', cachedUrlRes.url)

        // 使用缓存的 URL 获取字幕数据
        const subtitleResponse = await fetch(cachedUrlRes.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://www.youtube.com/',
          },
        })

        if (subtitleResponse.ok) {
          const rawSubtitleData = await subtitleResponse.text()
          console.log(
            '[VideoObserver] 使用缓存URL获取字幕原始数据成功，长度:',
            rawSubtitleData.length
          )

          // 检查原始字幕数据是否为空
          if (rawSubtitleData.length === 0) {
            console.log('[VideoObserver] 缓存URL返回的字幕数据为空，跳过处理')
          } else {
            // 使用后台脚本的预处理功能
            const processedResult = await getTrpc().processSubtitleData.query({
              rawData: rawSubtitleData,
              videoId: videoId,
            })

            if (processedResult.success) {
              const { subtitles, meta } = JSON.parse(processedResult.data ?? '{}')
              console.log('[VideoObserver] 解析后的字幕数据:', subtitles.length, '条')
              console.log('[VideoObserver] 计算的元数据:', meta)

              // 根据获取到的数据判断状态
              if (subtitles.length > 0) {
                // 成功获取到字幕数据
                if (
                  meta.wordCount > MAX_SUBTITLES_WORDS ||
                  meta.videoDuration >= MAX_VIDEO_TIME
                ) {
                  if (!skipStateChange) {
                    onStateChange(YouTubePanelStateEnum.SUBTITLES_TOO_LONG)
                    console.log('[VideoObserver] 字幕过长，状态设置为 SUBTITLES_TOO_LONG')
                  }
                } else {
                  if (!skipStateChange) {
                    onStateChange(YouTubePanelStateEnum.SUBTITLES_HAS)
                    console.log(
                      '[VideoObserver] 字幕获取成功（使用缓存URL），状态设置为 SUBTITLES_HAS'
                    )
                  }
                  // 无论是否跳过状态改变，都要设置字幕数据
                  onSubtitlesDataChange(subtitles)
                  console.log('[VideoObserver] 字幕数据已设置，用于重试功能')
                }
              } else {
                // 字幕数据为空，无论 meta.subtitleCount 是否为 0，都视为无字幕
                if (!skipStateChange) {
                  onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
                  console.log('[VideoObserver] 字幕数据为空或处理失败，状态设置为 SUBTITLES_NO')
                }
              }

              // 成功处理后应该 return，避免继续执行 YouTube API 调用
              return
            } else {
              console.error('[VideoObserver] 字幕数据处理失败:', processedResult.error)
            }
          }
        } else {
          console.error(
            '[VideoObserver] 使用缓存URL获取字幕失败:',
            subtitleResponse.status,
            subtitleResponse.statusText
          )
        }
      }

      // 如果没有缓存URL或使用缓存URL失败，则回退到直接调用 YouTube API
      console.log('[VideoObserver] 缓存URL不可用，回退到直接调用 YouTube 播放器 API:', videoId)

      // 构建 YouTube 内部 API 请求
      const playerApiUrl = `https://www.youtube.com/youtubei/v1/player`
      const requestBody = {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231219.04.00',
          },
        },
        videoId: videoId,
      }

      const response = await fetch(playerApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://www.youtube.com/',
          Origin: 'https://www.youtube.com',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const playerData = await response.json()
        console.log('[VideoObserver] YouTube 播放器数据获取成功:', playerData)

        // 检查是否有字幕轨道
        const captions =
          playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
        console.log('[VideoObserver] captions', captions)

        if (captions && captions.length > 0) {
          // 优先选择英文字幕，如果没有则选择第一个
          let selectedCaption =
            captions.find(
              (track: any) =>
                track.languageCode === 'en' || track.languageCode === 'en-US'
            ) || captions[0]

          if (selectedCaption?.baseUrl) {
            console.log(
              '[VideoObserver] 找到字幕轨道，开始获取字幕内容:',
              selectedCaption.baseUrl
            )
            console.log('[VideoObserver] 选中的字幕语言:', selectedCaption.languageCode)

            // 直接在 content script 中发起 fetch 请求获取字幕
            const subtitleResponse = await fetch(selectedCaption.baseUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: 'https://www.youtube.com/',
              },
            })

            if (subtitleResponse.ok) {
              const rawSubtitleData = await subtitleResponse.text()
              console.log('[VideoObserver] 字幕原始数据获取成功，长度:', rawSubtitleData.length)

              // 检查原始字幕数据是否为空
              if (rawSubtitleData.length === 0) {
                console.log('[VideoObserver] YouTube API返回的字幕数据为空')
                onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
              } else {
                // 使用后台脚本的预处理功能
                const processedResult = await getTrpc().processSubtitleData.query(
                  {
                    rawData: rawSubtitleData,
                    videoId: videoId,
                  }
                )

                if (processedResult.success) {
                  const { subtitles, meta } = JSON.parse(
                    processedResult.data ?? '{}'
                  )
                  console.log('[VideoObserver] 解析后的字幕数据:', subtitles.length, '条')
                  console.log('[VideoObserver] 计算的元数据:', meta)

                  // 根据获取到的数据判断状态
                  if (subtitles.length > 0) {
                    // 成功获取到字幕数据
                    if (
                      meta.wordCount > MAX_SUBTITLES_WORDS ||
                      meta.videoDuration >= MAX_VIDEO_TIME
                    ) {
                      onStateChange(YouTubePanelStateEnum.SUBTITLES_TOO_LONG)
                      console.log('[VideoObserver] 字幕过长，状态设置为 SUBTITLES_TOO_LONG')
                    } else {
                      onStateChange(YouTubePanelStateEnum.SUBTITLES_HAS)
                      onSubtitlesDataChange(subtitles)
                      console.log(
                        '[VideoObserver] 字幕获取成功（直接API调用），状态设置为 SUBTITLES_HAS'
                      )
                    }
                  } else {
                    // 字幕数据为空，无论 meta.subtitleCount 是否为 0，都视为无字幕
                    onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
                    console.log('[VideoObserver] 字幕数据为空或处理失败，状态设置为 SUBTITLES_NO')
                  }
                } else {
                  console.error('[VideoObserver] 字幕数据处理失败:', processedResult.error)
                  onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
                }
              }
            } else {
              console.error(
                '[VideoObserver] 获取字幕失败:',
                subtitleResponse.status,
                subtitleResponse.statusText
              )
              onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
            }
          } else {
            console.log('[VideoObserver] 字幕轨道没有 baseUrl')
            onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
          }
        } else {
          console.log('[VideoObserver] 播放器数据中没有找到字幕轨道')
          onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
        }
      } else {
        console.error(
          '[VideoObserver] YouTube 播放器 API 请求失败:',
          response.status,
          response.statusText
        )
        onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
      }
    } catch (error) {
      console.error('[VideoObserver] 获取字幕时发生错误:', error)
      onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
    }
  }

  // 创建防抖版本的函数
  const debouncedFetchVideoData = debounce(fetchVideoData, 300)

  // 启动观察器
  const startObserver = () => {
    // 如果观察器已经在运行，先停止它
    if (isObserverRunning) {
      console.log('[VideoObserver] 观察器已在运行，先停止现有观察器')
      stopObserver()
    }

    // 查找 YouTube 页面中代表主要视频区域的元素
    const targetNode = document.querySelector('#above-the-fold')
    if (targetNode) {
      // 创建 MutationObserver 实例
      observer = new MutationObserver((mutationsList, observer) => {
        console.log('[VideoObserver] DOM变化，检查新的视频ID...')
        debouncedFetchVideoData()
      })

      // 配置观察选项
      const config = { childList: true, subtree: true, attributes: true }

      // 开始观察
      observer.observe(targetNode, config)
      isObserverRunning = true
      console.log('[VideoObserver] MutationObserver 已在 #above-the-fold 上启动')
    } else {
      console.warn('[VideoObserver] #above-the-fold 元素未找到，无法设置 MutationObserver')
      onStateChange(YouTubePanelStateEnum.SUBTITLES_NO)
    }
  }

  // 停止观察器
  const stopObserver = () => {
    if (observer) {
      observer.disconnect()
      observer = null
      isObserverRunning = false
      console.log('[VideoObserver] MutationObserver 已断开连接')
    }
    // 重置状态
    fetchInProgress = false
  }

  // 手动触发获取视频数据（用于初始化）
  const manualFetch = () => {
    console.log('[VideoObserver] 手动触发获取视频数据')
    fetchVideoData()
  }

  // 重置状态（用于新的页面导航）
  const resetState = () => {
    console.log('[VideoObserver] 重置观察器状态')
    currentVideoId = ''
    fetchInProgress = false
  }

  return {
    startObserver,
    stopObserver,
    manualFetch,
    resetState,
  }
}
