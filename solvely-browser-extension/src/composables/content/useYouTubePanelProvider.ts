import {
  ref,
  computed,
  provide,
  inject,
  onMounted,
  onUnmounted,
  reactive,
} from 'vue'
import type { InjectionKey } from 'vue'
import { useYouTubeVideoObserver } from './useYouTubeVideoObserver'
import { useYouTubeSummaryHandler } from './useYouTubeSummaryHandler'
import type { TimelineItemData } from '~/components/youtube/TimelineItem.vue'
import { youtubeSummaryStorageCache } from '~/utils/youtubeSummaryStorageCache'

export enum YouTubePanelStateEnum {
  INITIAL = '', // 初始状态
  READY_TO_GENERATE = 'ready-to-generate', // 准备生成总结（默认显示生成按钮）
  SUBTITLES_LOADING = 'subtitles-loading', // 获取字幕中
  SUBTITLES_HAS = 'subtitles-has', // 有字幕
  SUBTITLES_NO = 'subtitles-no', // 无字幕
  SUBTITLES_TOO_LONG = 'subtitles-tooLong', // 字幕过长
  SUMMARY_LOADING = 'summary-loading', // 总结加载中
  SUMMARY_LOADING_OUTLINE_COMPLETE = 'summary-loading:outline-complete', // 总结加载中:大纲完成
  SUMMARY_COMPLETE = 'summary-complete', // 总结完成
  SUMMARY_ERROR = 'summary-error', // 总结错误
  OUT_LIMIT = 'out-limit', // 余额不足
  CONTENT_POLICY_ERROR = 'content-policy-error', // 内容政策错误
}

// 面板状态类型定义
export type YouTubePanelState =
  (typeof YouTubePanelStateEnum)[keyof typeof YouTubePanelStateEnum]

// 摘要数据类型定义
export type SummaryData = {
  outline: string
  details: TimelineItemData[]
}

// 定义注入键
export const YouTubePanelKey: InjectionKey<
  ReturnType<typeof createYouTubePanelState>
> = Symbol('youtube-panel')

// 创建状态
export const createYouTubePanelState = () => {
  // 响应式状态
  const panelState = ref<YouTubePanelState>(YouTubePanelStateEnum.READY_TO_GENERATE) // 默认显示生成按钮
  const currentVideoId = ref('')
  const subtitlesData = ref<any>(null)
  const summaryData = reactive<SummaryData>({
    outline: '',
    details: [],
  })

  // 内部状态：跟踪字幕检查的实际结果（不直接影响UI显示）
  const internalSubtitleState = ref<YouTubePanelState>(YouTubePanelStateEnum.INITIAL)

  // 状态更新方法
  const setState = (state: YouTubePanelState) => {
    console.log(`[YouTubePanel] setState 被调用: ${panelState.value} -> ${state}`)
    panelState.value = state
  }

  // 设置内部字幕状态（用于后台字幕检查）
  const setInternalSubtitleState = (state: YouTubePanelState) => {
    internalSubtitleState.value = state
    console.log(`[YouTubePanel] 内部字幕状态更新: ${state}`)
  }

  // 获取实际的字幕状态（用于生成时检查）
  const getActualSubtitleState = () => {
    return internalSubtitleState.value
  }

  const setCurrentVideoId = (videoId: string) => {
    console.log(`[YouTubePanel] setCurrentVideoId 被调用: ${currentVideoId.value} -> ${videoId}`)
    currentVideoId.value = videoId
    // 视频ID变化时，重置为准备生成状态
    panelState.value = YouTubePanelStateEnum.READY_TO_GENERATE
    internalSubtitleState.value = YouTubePanelStateEnum.INITIAL
    console.log(`[YouTubePanel] setCurrentVideoId 完成，当前 panelState: ${panelState.value}`)
  }

  const setSummaryOutline = (outline: string) => {
    summaryData.outline = outline
  }

  const setSummaryDetails = (details: any[]) => {
    summaryData.details = details
  }

  const setSummaryData = async (outline: string, details: any[]) => {
    summaryData.outline = outline
    summaryData.details = details
  }

  const setSubtitlesData = (data: any) => {
    subtitlesData.value = data
  }

  const resetAllState = () => {
    panelState.value = YouTubePanelStateEnum.READY_TO_GENERATE
    internalSubtitleState.value = YouTubePanelStateEnum.INITIAL
    summaryData.outline = ''
    summaryData.details = []
    subtitlesData.value = null
  }

  // 缓存相关方法
  const loadSummaryFromCache = async (videoId: string): Promise<boolean> => {
    try {
      const cachedData = await youtubeSummaryStorageCache.get(videoId)
      if (cachedData) {
        summaryData.outline = cachedData.outline
        summaryData.details = cachedData.details
        setState(YouTubePanelStateEnum.SUMMARY_COMPLETE)
        console.log(`[YouTubePanel] 从存储缓存加载摘要数据: ${videoId}`)
        return true
      }
    } catch (error) {
      console.error('[YouTubePanel] 从存储缓存加载摘要数据失败:', error)
    }
    return false
  }

  const saveSummaryToCache = async (videoId: string): Promise<void> => {
    try {
      // 只有当数据完整时才保存到缓存
      if (
        summaryData.outline &&
        summaryData.details &&
        summaryData.details.length > 0
      ) {
        await youtubeSummaryStorageCache.set(videoId, summaryData)
        console.log(`[YouTubePanel] 摘要数据已保存到存储缓存: ${videoId}`)
      }
    } catch (error) {
      console.error('[YouTubePanel] 保存摘要数据到存储缓存失败:', error)
    }
  }

  const clearSummaryCache = async (videoId?: string): Promise<void> => {
    try {
      if (videoId) {
        await youtubeSummaryStorageCache.delete(videoId)
      } else {
        await youtubeSummaryStorageCache.clear()
      }
      console.log(`[YouTubePanel] 存储缓存已清理: ${videoId || 'all'}`)
    } catch (error) {
      console.error('[YouTubePanel] 清理存储缓存失败:', error)
    }
  }

  const getCacheStats = async () => {
    return await youtubeSummaryStorageCache.getStats()
  }

  // 创建同时更新两个状态的包装函数
  const updateBothStates = (state: YouTubePanelState,modal?:'1'|'2'|'3') => {
    console.log(`[YouTubePanel] 同时更新两个状态: ${state} ${modal}`)
    if(modal === '1'){
      setState(state)
    }else if(modal === '2'){
      setInternalSubtitleState(state)
    }else if(modal === '3'){
      setState(state)
      setInternalSubtitleState(state)
    }else{
      setInternalSubtitleState(state)
    }
  }

  // 创建中断生成过程的函数
  const interruptGeneration = (videoId: string) => {
    console.log(`[YouTubePanel] 中断生成过程，当前视频ID: ${videoId}`)
    // 调用 summaryHandler 的中断方法
    summaryHandler.resetTaskState()
    summaryHandler.clearSummary()
    // 重置状态
    setState(YouTubePanelStateEnum.READY_TO_GENERATE)
    setInternalSubtitleState(YouTubePanelStateEnum.INITIAL)
  }

  // 使用视频观察器，传递摘要数据设置回调
  const videoObserver = useYouTubeVideoObserver(
    setCurrentVideoId,
    updateBothStates, // 使用包装函数同时更新两个状态
    setSubtitlesData,
    // 新增：传递摘要数据设置回调，用于从缓存加载数据时直接设置摘要
    (outline: string, details: any[]) => {
      setSummaryOutline(outline)
      setSummaryDetails(details)
      // 如果有缓存的摘要数据，直接显示完成状态
      setState(YouTubePanelStateEnum.SUMMARY_COMPLETE)
    },
    interruptGeneration // 传递中断生成的回调
  )

  // 使用摘要处理器
  const summaryHandler = useYouTubeSummaryHandler(
    setState,
    setSummaryOutline,
    setSummaryDetails,
    saveSummaryToCache,
    currentVideoId,
    subtitlesData,
    summaryData,
    getActualSubtitleState, // 传递获取实际字幕状态的方法
    setInternalSubtitleState // 传递设置内部字幕状态的方法
  )

  return {
    // 状态
    panelState,
    currentVideoId,
    summaryData,
    subtitlesData,

    // 基础方法
    resetAllState,
    setState,
    setCurrentVideoId,
    setSummaryOutline,
    setSummaryDetails,
    setSummaryData,
    setSubtitlesData,

    // 新增：内部状态管理
    setInternalSubtitleState,
    getActualSubtitleState,

    // 缓存相关方法
    loadSummaryFromCache,
    saveSummaryToCache,
    clearSummaryCache,
    getCacheStats,

    // 视频观察相关方法
    startVideoObserver: videoObserver.startObserver,
    stopVideoObserver: videoObserver.stopObserver,
    manualFetchSubtitles: videoObserver.manualFetch,

    // 摘要处理相关方法
    generateSummary: summaryHandler.generateSummary,
    clearSummary: summaryHandler.clearSummary,
    getSummaryData: summaryHandler.getSummaryData,
    getSummaryOutline: summaryHandler.getSummaryOutline,
    getSummaryDetails: summaryHandler.getSummaryDetails,
    startSummaryMessageListener: summaryHandler.startMessageListener,
    stopSummaryMessageListener: summaryHandler.stopMessageListener,
  }
}

// Provider Hook - 在根组件中使用
export const useYouTubePanelProvider = () => {
  const state = createYouTubePanelState()

  // 自动启动视频观察器和消息监听器
  onMounted(() => {
    state.startVideoObserver()
    state.startSummaryMessageListener()
    // 可选：组件挂载时手动获取一次字幕
    state.manualFetchSubtitles()
  })

  // 自动清理
  onUnmounted(() => {
    state.stopVideoObserver()
    state.stopSummaryMessageListener()
  })

  provide(YouTubePanelKey, state)
  return state
}

// Consumer Hook - 在子组件中使用
export const useYouTubePanel = () => {
  const state = inject(YouTubePanelKey)
  if (!state) {
    throw new Error('useYouTubePanel 必须在 YouTubePanel provider 内部使用')
  }
  return state
}
