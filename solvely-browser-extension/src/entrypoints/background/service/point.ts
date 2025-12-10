// import { initializeApp } from 'firebase/app'
import PostHog from 'posthog-js-lite'
import { getUser } from '~/entrypoints/background/service/datasync'
import { type User } from '~/types'
import { point as pointApi } from '@/api'
import { Buffer } from 'buffer'
import { STORAGE_KEY } from '@/config/storage'
import { getPluginUuid } from '~/utils/pluginUuid'
;(globalThis as any).Buffer = Buffer

let isPosthogInit = false
let isPosthogIdentify = false
let posthog: PostHog
let isAliasAnonUser = false

const manifest = chrome.runtime.getManifest()

// PostHog 事件黑名单：不需要上报到 PostHog 的事件
const POSTHOG_EXCLUDE_EVENTS = new Set<string>([
  // 可在此添加不需要上报到 PostHog 的事件名称
  'Plugin_Performance_Metrics',
  'Plugin_sidepanel_statusChanged',
  'Plugin_Solve_loading_total',
  'Plugin_Solve_loading_solve',
  'Plugin_Solve_loading_upload',
  'Plugin_sidebar_addUserMessage',
  'Plugin_sidebar_mounted',
  'Plugin_sidebar_unmounted',
  'Plugin_sidebar_AiButton_loading',
  'Plugin_renderMath_error',
  'Plugin_Solve_Render_Error',
  'solvely_plugin_float_btn_position',
  'Plugin_Quizletbutton_Click_Error',
  'Plugin_Solve_loading_retry',
  'Plugin_Solve_connect_fail',
  'Plugin_Solve_Error',
  'Plugin_Sidebar_Paywall_Mount',
  'Plugin_sidebar_QuizPDFMessage_mounted',
  'Plugin_Youtubepanel_Mounted',
  'Plugin_search_query',
  'Plugin_Sidebar_capturePageScreenshots',
  'Plugin_sidebar_addPageSolveMessage_imageProcess',
  'Plugin_sidebar_addPageSolveMessage',
  'Plugin_Sidebar_processPageScreenshotSolve',
  'Plugin_sidepanel_processPendingTasks',
  'Plugin_sidebar_user_message_mounted',
  'Plugin_SolveV9_ImageUpload',
  'Plugin_Solve_Done',
  'Extension_University_Solve_Success',
  'Plugin_Sidebar_processPageScreenshotSolve_streamingUpload',
  'Plugin_Sidebar_captureWithStreamingUpload',
  'Plugin_sidebar_addPageSolveMessage_streamingUpload',
  'Plugin_sidebar_createMultiPagePdf_upload',
  'Plugin_sidebar_createMultiPagePdf',
])

// 序列化错误对象
function serializeError(error: any): Record<string, any> {
  if (error instanceof Error) {
    const result: Record<string, any> = {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 2000), // 限制栈信息长度避免数据过大
    }

    if (error.cause) {
      result.cause = String(error.cause)
    }

    return result
  }

  // 处理非 Error 对象
  if (typeof error === 'string') {
    return { message: error }
  }

  // 处理其他类型的错误
  try {
    return { message: String(error) }
  } catch {
    return { message: 'Unknown error' }
  }
}

// 专门用于上报 JS 错误的方法
export const pointError = (type: string, error: any, params: any = {}) => {
  const errorInfo = serializeError(error)

  point('Plugin_JS_Error', {
    type,
    ...errorInfo,
    ...params,
    errorString: String(error),
  })
}

/**
 * 判断是否为新用户（基于本地缓存）
 */
async function checkIsNewUser(): Promise<boolean> {
  try {
    // 从 localStorage 读取缓存（由 postPluginUserInfo 接口返回后缓存）
    const cacheKey = STORAGE_KEY.PLUGIN_UUID_IS_NEW_USER
    const cache = await browser.storage.local.get(cacheKey)

    if (typeof cache[cacheKey] === 'boolean') {
      return cache[cacheKey]
    }

    // 没有缓存，默认认为是老用户
    return false
  } catch (error) {
    console.error('[checkIsNewUser] 判断失败:', error)
    return false
  }
}

export const point = async (name: string, _params = {}) => {
  if (!name) return
  let userInfo: User | null = null
  let adReferrer = ''
  let cid = ''
  let isSubscribed = false
  let anonDeviceId = ''
  let webAnonDeviceId = ''
  let pluginUuid = ''

  try {
    // 在service中无法使用trpc，所以这里使用getUser，因为从逻辑上来说，router要早于service，是router调用service，而不是反过来
    // userInfo = await getTrpc().getUserInfo.query();
    userInfo = await getUser()

    if (!isPosthogInit) {
      posthog = new PostHog(import.meta.env.VITE_POSTHOG_KEY, {
        host: 'https://us.i.posthog.com',
      })
      isPosthogInit = true
    }

    // 获取 pluginUuid
    pluginUuid = await getPluginUuid()

    // PostHog identify 逻辑（新老用户不同策略）
    if (!isPosthogIdentify && userInfo?.deviceId) {
      // 从本地缓存判断是否新用户
      const isNewUser = await checkIsNewUser()

      // 新用户使用 pluginUuid，老用户使用 deviceId
      const identifyId = isNewUser ? pluginUuid : userInfo.deviceId

      posthog.identify(identifyId, {
        email: userInfo.email,
        name: userInfo.userName,
        deviceId: userInfo.deviceId,
        pluginUuid: pluginUuid,
        isNewUser: isNewUser,
      })
      isPosthogIdentify = true

      console.log(`[PostHog] identify ${isNewUser ? '新用户' : '老用户'} - ID: ${identifyId}`)
    }

    // 优化：一次性读取所有需要的 storage 数据，减少 I/O 操作
    const storageData = await browser.storage.local.get([
      STORAGE_KEY.AD_REFERRER,
      STORAGE_KEY.WEB_GA_CID,
      STORAGE_KEY.SUBSCRIPTION,
      STORAGE_KEY.WEB_ANON_DEVICE_ID,
      STORAGE_KEY.ANON_DEVICE_ID,
    ])

    adReferrer = storageData[STORAGE_KEY.AD_REFERRER] || ''
    cid = storageData[STORAGE_KEY.WEB_GA_CID] || ''
    webAnonDeviceId = storageData[STORAGE_KEY.WEB_ANON_DEVICE_ID] || ''
    anonDeviceId = storageData[STORAGE_KEY.ANON_DEVICE_ID] || ''

    // 检查订阅状态（原 checkIsSubscribedFromStorage 逻辑）
    const subscriptions = storageData[STORAGE_KEY.SUBSCRIPTION] || null
    if (subscriptions) {
      const arr = Array.isArray(subscriptions) ? subscriptions : []
      isSubscribed = arr.some((s: any) => s?.subscriptionType === 'solver')
    }

    // 关联 SEO 页面的匿名用户
    if (!isAliasAnonUser && userInfo?.deviceId && webAnonDeviceId) {
      pointApi(
        'anon_user_alias',
        {
          deviceId: userInfo?.deviceId,
          anonDeviceId: webAnonDeviceId,
        },
        userInfo?.deviceId,
        cid
      )
      isAliasAnonUser = true
      browser.storage.local.remove(STORAGE_KEY.WEB_ANON_DEVICE_ID)
    }
  } catch (error) {
    console.error(error)
  }

  // 添加版本信息到参数中
  const params = {
    ..._params,
    version: manifest.version,
    adReferrer,
    isSubscribed,
    isLoggedIn: !!userInfo?.deviceId,
  }

  if (userInfo?.deviceId) {
    pointApi(
      name,
      {
        ...params,
        pluginUuid,
        anonDeviceId,
      },
      userInfo.deviceId,
      cid
    )
  } else {
    pointApi(
      name,
      {
        ...params,
        pluginUuid,
        anonDeviceId,
      },
      '',
      cid
    ) // 使用空字符串替代null
  }

  // 检查黑名单，排除不需要上报到 PostHog 的事件
  if (!POSTHOG_EXCLUDE_EVENTS.has(name)) {
    posthog.capture(name, params)
  }
}
