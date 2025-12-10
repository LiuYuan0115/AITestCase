import {
  getYouTubeOutline as getYouTubeOutlineFromApi,
  getYouTubeDetails as getYouTubeDetailsFromApi,
} from '@/api'

// 管理正在进行的请求
class YouTubeRequestManager {
  // 使用 Map 来管理多个 AbortController，key 是任务组ID
  private taskControllers = new Map<string, AbortController[]>()

  // 为任务组创建新的 AbortController
  createControllersForTask(
    taskId: string,
    count: number = 2
  ): AbortController[] {
    // 如果已存在，先取消之前的请求
    this.cancelTask(taskId)

    const controllers: AbortController[] = []
    for (let i = 0; i < count; i++) {
      controllers.push(new AbortController())
    }

    this.taskControllers.set(taskId, controllers)
    return controllers
  }

  // 取消特定任务的所有请求
  cancelTask(taskId: string): boolean {
    const controllers = this.taskControllers.get(taskId)
    if (controllers) {
      controllers.forEach((controller) => {
        if (!controller.signal.aborted) {
          controller.abort()
        }
      })
      this.taskControllers.delete(taskId)
      return true
    }
    return false
  }

  // 清理完成的任务
  cleanupTask(taskId: string): void {
    this.taskControllers.delete(taskId)
  }

  // 取消所有任务
  cancelAllTasks(): void {
    this.taskControllers.forEach((controllers) => {
      controllers.forEach((controller) => {
        if (!controller.signal.aborted) {
          controller.abort()
        }
      })
    })
    this.taskControllers.clear()
  }

  // 检查任务是否被取消
  isTaskCancelled(taskId: string): boolean {
    const controllers = this.taskControllers.get(taskId)
    if (!controllers || controllers.length === 0) return true

    // 如果所有控制器都被取消了，认为任务被取消
    return controllers.every((controller) => controller.signal.aborted)
  }
}

// 创建全局请求管理器实例
export const youtubeRequestManager = new YouTubeRequestManager()

/**
 * 获取 YouTube 摘要
 * @param subtitles 字幕
 * @param lang 语言
 * @returns 摘要
 */
export const getYouTubeOutline = async (
  subtitles: any,
  videoId: string,
  lang = 'en',
  signal?: AbortSignal
) => {
  try {
    // 确保 subtitles 是一个数组，并且将字幕文本压缩为单行字符串
    // 如果 subtitles 不是数组，则假定它已经是可接受的字符串格式
    const compressedSubtitles = Array.isArray(subtitles)
      ? subtitles.map((s: { text: string }) => s.text).join(' ')
      : JSON.stringify(subtitles)

    const response = await getYouTubeOutlineFromApi(
      compressedSubtitles,
      videoId,
      lang,
      signal
    )
    return response
  } catch (error) {
    // 如果是取消错误，不要抛出异常
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[getYouTubeOutline]: Request was cancelled')
      return null
    }

    console.error(
      '[getYouTubeOutline error]: api fetch getYouTubeOutline',
      error
    )
    throw new Error('api fetch error getYouTubeOutline: ' + error)
  }
}

/**
 * 获取 YouTube 详细信息
 * @param subtitles 字幕
 * @param lang 语言
 * @returns 详细信息
 */
export const getYouTubeDetails = async (
  subtitles: any,
  videoId: string,
  lang = 'en',
  signal?: AbortSignal
) => {
  try {
    let serializedSubtitles: string

    // 根据 subtitles 的类型进行序列化，以确保它是一个字符串，同时保留时间信息和最小化 token。
    if (
      Array.isArray(subtitles) ||
      (typeof subtitles === 'object' && subtitles !== null)
    ) {
      // 如果是数组或非空对象，进行 JSON 序列化
      serializedSubtitles = JSON.stringify(subtitles)
    } else if (typeof subtitles === 'string') {
      // 如果已经是字符串，则直接使用
      serializedSubtitles = subtitles
    } else {
      serializedSubtitles = ''
    }

    // 移除所有换行符 (包括 \n, \r, \r\n) 以进一步压缩字符串
    // 同时将多个连续空格替换为单个空格，并移除首尾空格
    serializedSubtitles = serializedSubtitles
      .replace(/[\r\n]+/g, '') // 移除所有换行符和回车符
      .replace(/\s{2,}/g, ' ') // 将多个连续空格替换为单个空格
      .trim() // 移除首尾空格，确保字符串更紧凑

    console.log('serializedSubtitles----', serializedSubtitles)

    const response = await getYouTubeDetailsFromApi(
      serializedSubtitles,
      videoId,
      lang,
      signal
    )
    return response
  } catch (error) {
    // 如果是取消错误，不要抛出异常
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[getYouTubeDetails]: Request was cancelled')
      return null
    }

    console.error(
      '[getYouTubeDetails error]: api fetch getYouTubeDetails',
      error
    )
    const errorMessage = (error as any)?.response?.data?.error || String(error)
    throw new Error(errorMessage)
  }
}
