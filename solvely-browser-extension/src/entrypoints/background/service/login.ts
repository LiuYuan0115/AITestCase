import type { User } from '~/types'
import {
  getToken as getTokenFromApi,
  getUserBalance as getUserBalanceFromApi,
  getUserExtendInfo as getUserExtendInfoFromApi,
  getUser as getUserFromApi,
  postUserInfo as postUserInfoFromApi,
  getUserSubscription as getUserSubscriptionFromApi,
  reportPluginLogin,
  verifyVerificationCodeFromApi,
  updateUserGrade,
  postPluginUserInfo,
} from '@/api'
import { setToken } from './datasync'
import { STORAGE_KEY } from '~/config'
import { notifyPopup, notifyTabs } from './datasync'
import EVENT from '@/utils/event'
import trackEvent from '@/utils/trackEvent'
import { pointError } from './point'
import { syncAssignmentsWithServer } from '~/utils/abtestAssignments'
import { getPluginUuid, updatePluginUuid } from '~/utils/pluginUuid'

// Offscreen 文档路径
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html'

// 确保只有一个创建 offscreen 文档的Promise
let creatingOffscreenDocument: Promise<void> | null = null
// 标记iframe是否已经准备好
let iframeReady = false

// 监听 tab 更新事件, 保持登录窗口在顶层, 第三方登录窗口由于缺乏激活态可能会被遮挡
chrome.tabs.onUpdated.addListener((_, __, tab) => {
  // firebase 登录
  if (tab.url?.includes('solvely-a3b82.firebaseapp.com')) {
    chrome.windows.update(tab.windowId, { focused: true })
  }
  // // Google 登录
  // if (tab.url?.startsWith('https://accounts.google.com/o/oauth2/')) {
  //   chrome.windows.update(tab.windowId, {focused: true});
  // }
  // // Apple 登录
  // else if (tab.url?.startsWith('https://appleid.apple.com/auth/')) {
  //   chrome.windows.update(tab.windowId, {focused: true});
  // }
  // // Facebook 登录
  // else if (tab.url?.startsWith('https://www.facebook.com/v') && tab.url?.includes('/dialog/oauth')) {
  //   chrome.windows.update(tab.windowId, {focused: true});
  // }
})

//
// 初始化与文档管理
//

/**
 * 初始化登录服务
 * 预先创建offscreen文档和加载iframe，以便后续登录操作能够立即执行
 */
export async function initLoginService(): Promise<void> {
  await setupOffscreenDocument()
}

/**
 * 检查是否已存在 offscreen 文档
 */
async function hasOffscreenDocument(): Promise<boolean> {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'] as chrome.runtime.ContextType[],
    })
    return existingContexts.length > 0
  } catch (error) {
    console.error('检查offscreen文档失败:', error)
    return false
  }
}

/**
 * 设置 offscreen 文档
 */
async function setupOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return
  }

  if (creatingOffscreenDocument) {
    try {
      await creatingOffscreenDocument
      return
    } catch (error) {}
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
    reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
    justification: 'Firebase authentication',
  })

  await creatingOffscreenDocument
  creatingOffscreenDocument = null

  // 等待iframe准备完成
  await checkIframeStatus()
}

/**
 * 检查iframe状态
 */
async function checkIframeStatus(): Promise<void> {
  if (iframeReady) return

  return new Promise((resolve) => {
    const checkStatus = () => {
      sendMessageToOffscreen({
        type: 'iframe:status-check',
      })
        .then((response) => {
          if (response?.ready) {
            iframeReady = true
            resolve()
          } else {
            // 如果iframe还没准备好，等待200ms后再次检查
            setTimeout(checkStatus, 200)
          }
        })
        .catch(() => {
          // 如果发送消息失败，等待500ms后再次检查
          setTimeout(checkStatus, 500)
        })
    }

    // 开始检查
    setTimeout(checkStatus, 500) // 给予初始加载时间
  })
}

/**
 * 关闭 offscreen 文档
 */
export async function closeOffscreenDocument(): Promise<void> {
  if (!(await hasOffscreenDocument())) {
    return
  }

  await chrome.offscreen.closeDocument()
  iframeReady = false
}

//
// 消息传递
//

/**
 * 发送消息到 offscreen 文档并等待响应
 */
async function sendMessageToOffscreen(message: any): Promise<any> {
  // 如果是登录相关操作且iframe未准备好，先检查状态
  if (!iframeReady && message.type && (message.type.startsWith('login:') || message.type === 'iframe:status-check')) {
    // 对于状态检查消息，不进行递归检查，避免死循环
    if (message.type !== 'iframe:status-check') {
      await checkIframeStatus()
    }
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ ...message, target: 'offscreen' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (response?.error) {
        reject(new Error(response.error))
        return
      }

      resolve(response)
    })
  })
}

//
// 用户认证功能
//

/**
 * 检查本地存储并自动登录（独立调用版本）
 * 适用场景：
 * - 其他需要单独检查自动登录的场景
 *
 * @returns 用户信息，未登录返回 null
 */
export async function checkLocalStorageAndAutoLogin(): Promise<any> {
  await setupOffscreenDocument()

  try {
    const user = await doAutoLogin()
    return user
  } catch (error) {
    console.error('[Login] 自动登录检查失败:', error)
    return null
  } finally {
    await closeOffscreenDocument()
  }
}

/**
 * 验证登录方式
 * password: 密码登录
 * link: 链接登录
 * code: 验证码登录
 */
export async function verifyLoginMethod(email: string): Promise<'password' | 'link' | 'code'> {
  await setupOffscreenDocument()
  console.log('verifyLoginMethod', email)

  const verifyNew = (email: string) => {
    //检测邮箱后缀是否是@solvely.ai,是的话直接返回password，否则就code
    if (email.endsWith('@solvely.ai')) {
      return 'password'
    } else {
      return 'code'
    }
  }

  const loginMethod = verifyNew(email)

  // const response = await sendMessageToOffscreen({
  //   type: 'login:email-verify-v2',
  //   email,
  // })
  // 旧版邮箱链接登录
  // const response = await sendMessageToOffscreen({
  //   type: 'login:email-verify',
  //   email,
  // })

  // if (response.type === 'login:email-verify-success') {
  //   console.log('verifyLoginMethod success', response.loginMethod)
  //   return response.loginMethod
  // } else {
  //   console.log('verifyLoginMethod error', response.error)
  //   throw new Error(response.error || 'email verify failed')
  // }
  return loginMethod
}

/**
 * 使用邮箱密码登录
 */
export async function loginWithEmailPassword(email: string, password: string): Promise<User> {
  try {
    await setupOffscreenDocument()

    const response = await sendMessageToOffscreen({
      type: 'login:email-password-login',
      email,
      password,
    })

    console.log('loginWithEmailPassword response', response)

    if (response.type === 'login:auth-success') {
      // 存储用户数据
      await getUserInfoAndUpload(response.user)
      return response.user
    } else {
      throw new Error(response.error || '登录失败')
    }
  } finally {
    await closeOffscreenDocument()
  }
}

/**
 * 使用邮箱链接登录
 */
export async function loginWithEmailLink(email: string): Promise<User> {
  try {
    await setupOffscreenDocument()

    // 创建Promise，监听登录结果
    return new Promise<User>((resolve, reject) => {
      // 创建消息监听器
      const authListener = (message: any) => {
        // 只处理登录相关消息
        console.log('background 收到登录消息', message)
        if (message.type && message.type === EVENT.SOLVELY_EMAIL_LINK_LOGIN) {
          // 登录成功
          const data = message.data
          if (data.status === 'success') {
            // 移除监听器
            chrome.runtime.onMessage.removeListener(authListener)
            // 处理用户数据并返回
            getUserInfoAndUpload(data.user)
              .then(() => resolve(data.user))
              .catch((error) => reject(error))
          }
          // 登录失败或超时
          else if (data.status === 'error') {
            chrome.runtime.onMessage.removeListener(authListener)
            reject(new Error(data.error || '邮箱链接登录失败'))
          }
        }
      }

      // 添加监听器
      console.log('background 添加监听器')
      chrome.runtime.onMessage.addListener(authListener)

      // 设置超时，防止无限等待
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(authListener)
        reject(new Error('邮箱链接登录超时，请重试'))
      }, 5 * 60 * 1000) // 5分钟超时
    })
  } finally {
    await closeOffscreenDocument()
  }
}

/**
 * 使用邮箱密码注册
 */
export async function signupWithEmailPassword(email: string, password: string): Promise<User> {
  try {
    await setupOffscreenDocument()

    const response = await sendMessageToOffscreen({
      type: 'login:email-password-signup',
      email,
      password,
    })

    if (response.type === 'login:auth-success') {
      // 存储用户数据
      await getUserInfoAndUpload(response.user)
      return response.user
    } else {
      throw new Error(response.error || '注册失败')
    }
  } finally {
    await closeOffscreenDocument()
  }
}

/**
 * 第三方登录
 */
export async function loginWithProvider(provider: 'google' | 'apple' | 'facebook'): Promise<User> {
  try {
    await setupOffscreenDocument()

    const response = await sendMessageToOffscreen({
      type: 'login:auth-request',
      provider,
    })

    console.log('loginWithProvider response', response)

    if (response.type === 'login:auth-success') {
      // 存储用户数据
      await getUserInfoAndUpload(response.user)
      return response.user
    } else {
      throw new Error(response.error || '第三方登录失败')
    }
  } finally {
    await closeOffscreenDocument()
  }
}

/**
 * 使用验证码登录
 */
export async function loginWithVerificationCode(email: string, code: string): Promise<User> {
  try {
    console.log('验证验证码:', email, code)

    // 调用真实的后端验证码验证接口
    const response = await verifyVerificationCodeFromApi(email, code)

    // 检查响应状态
    if (response.code !== 0) {
      throw new Error('验证码验证失败')
    }

    console.log('验证码验证成功:', response.data)

    // 使用后端返回的真实用户数据构造 firebaseUser
    const firebaseUser = {
      uid: response.data.uid,
      email: response.data.email,
      displayName: response.data.displayName || '',
      photoURL: response.data.photoURL,
      emailVerified: true,
      providerId: 'email-verification',
      isAnonymous: false,
      loginType: 'email', // 标记为验证码登录
    }

    // 调用与邮箱链接登录相同的用户数据处理流程
    sendMessageToOffscreen({
      type: 'login:sync-to-web',
      user: response.data,
    })

    // 直接处理用户数据，不需要监听消息
    await getUserInfoAndUpload(firebaseUser)
    console.log('验证码登录成功', firebaseUser)

    // 返回后端API的用户数据，与其他登录方式保持一致
    return response.data
  } catch (error) {
    console.error('验证码登录失败:', error)
    throw new Error(error instanceof Error ? error.message : '验证码登录失败')
  }
}

// 用户 firebase 登录后, 需要调用 /user 和 /subscription 等来获取其他用户信息
// 新用户需要将基本信息上传
async function getUserInfoAndUpload(firebaseUser: any): Promise<void> {
  // 保存 firebase 用户信息
  await chrome.storage.local.set({ ['/firebase_user']: firebaseUser })

  // 获取 jwt token 并保存到本地, jwt token 的更新必须在获取用户信息之前, 否则无权限
  const token = await getTokenFromApi(firebaseUser.uid)
  await setToken(token)

  // 获取用户信息
  const { isSigned } = await getUserFromApi()

  if (isSigned === 0) {
    // 新用户
    const uploadUserInfoParams = {
      userName: firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      userPicture: firebaseUser.photoURL,
      role: 1,
      loginType: firebaseUser.loginType,
      webVersion: '3.0.0',
    }

    // 从本地读取 ABTest assignments 并在非空时追加
    try {
      const res = await browser.storage.local.get([STORAGE_KEY.ABTEST_ASSIGNMENTS, STORAGE_KEY.AD_REFERRER])
      const assignments = res?.[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}
      if (assignments && Object.keys(assignments).length > 0) {
        ;(uploadUserInfoParams as any).assignments = assignments
      }
      const adReferrer = res?.[STORAGE_KEY.AD_REFERRER] || ''
      const isSEM = adReferrer.includes('adjust_external_click_id')
      ;(uploadUserInfoParams as any).source = isSEM ? 'plugin_sem' : 'plugin'
      trackEvent.backgroundTrack('Plugin_User_Channel', {
        from: isSEM ? 'SEM' : 'organic',
      })
    } catch (e) {
      // 读取失败不影响主流程
      console.warn('读取 ABTest assignments 失败：', e)
    }

    // 从本地读取 pending_grade 并在非空时追加
    try {
      const res = await browser.storage.local.get([STORAGE_KEY.PENDING_GRADE, STORAGE_KEY.WEB_GA_CID])
      const pendingGrade = res?.[STORAGE_KEY.PENDING_GRADE]
      if (pendingGrade) {
        ;(uploadUserInfoParams as any).grade = pendingGrade
        // 清空 pending_grade
        await browser.storage.local.remove(STORAGE_KEY.PENDING_GRADE)
      }

      // 读取 WEB_GA_CID 并添加到 uploadUserInfoParams
      const webGaCid = res?.[STORAGE_KEY.WEB_GA_CID]
      if (webGaCid) {
        ;(uploadUserInfoParams as any).userPseudoId = webGaCid
      }
    } catch (e) {
      // 读取失败不影响主流程
      console.warn('读取 pending_grade 或 WEB_GA_CID 失败：', e)
    }

    // 需要上传新用户的 userInfo
    await postUserInfoFromApi(uploadUserInfoParams)

    // 【新增】新用户上报 pluginUserInfo（isSigned = 0）
    try {
      const assignmentsResult = await browser.storage.local.get(STORAGE_KEY.ABTEST_ASSIGNMENTS)
      const assignments = assignmentsResult[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}

      const result = await postPluginUserInfo({
        assignments,
        isSigned: 0, // 明确传递新用户标识
      })

      // 缓存 isNewUser 标识（用于 PostHog）
      if (result?.data?.isNewUser !== undefined) {
        await browser.storage.local.set({
          [STORAGE_KEY.PLUGIN_UUID_IS_NEW_USER]: result.data.isNewUser === 1,
        })
      }

      console.log('[Login] 新用户 pluginUserInfo 上报成功')
    } catch (error) {
      console.warn('[Login] 新用户 pluginUserInfo 上报失败:', error)
    }
  } else {
    // 老用户分支

    // 【新增】检查是否首次安装后登录的老用户
    try {
      const storageResult = await browser.storage.local.get(STORAGE_KEY.PLUGIN_UUID_IS_NEW_USER)
      const hasReported = storageResult[STORAGE_KEY.PLUGIN_UUID_IS_NEW_USER] !== undefined

      if (!hasReported) {
        // 首次安装后登录的老用户，需要上报 pluginUserInfo
        const assignmentsResult = await browser.storage.local.get(STORAGE_KEY.ABTEST_ASSIGNMENTS)
        const assignments = assignmentsResult[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}

        const result = await postPluginUserInfo({
          assignments,
          isSigned: 1, // 老用户标识
        })

        // 缓存 isNewUser 标识（用于 PostHog）
        if (result?.data?.isNewUser !== undefined) {
          await browser.storage.local.set({
            [STORAGE_KEY.PLUGIN_UUID_IS_NEW_USER]: result.data.isNewUser === 1,
          })
        }

        console.log('[Login] 首次安装-老用户登录 pluginUserInfo 上报成功')
      }
    } catch (error) {
      console.warn('[Login] 首次安装-老用户登录 pluginUserInfo 上报失败:', error)
    }

    // 如果localstorage有pending_grade，则调用/user/grade接口上传
    const res = await browser.storage.local.get(STORAGE_KEY.PENDING_GRADE)
    const pendingGrade = res?.[STORAGE_KEY.PENDING_GRADE]
    if (pendingGrade) {
      await updateUserGrade(pendingGrade)
    }
    // 清空pending_grade
    await browser.storage.local.remove(STORAGE_KEY.PENDING_GRADE)
  }

  // 并行获取用户信息、实验标签、余额和订阅信息
  const [user, extendInfo, userBalance, { data: userSubscription }] = await Promise.all([
    getUserFromApi(),
    getUserExtendInfoFromApi(),
    getUserBalanceFromApi(),
    getUserSubscriptionFromApi(),
  ])

  console.log('[service in background] get user info from api', user)
  console.log('[service in background] user and extend info', user, extendInfo)
  console.log('[service in background] user balance', userBalance)
  console.log('[service in background] get user subscription', userSubscription)

  // set to local storage
  await browser.storage.local.set({
    [STORAGE_KEY.USER]: user,
    [STORAGE_KEY.USER_ID_KEY]: firebaseUser.uid,
    [STORAGE_KEY.SUBSCRIPTION]: userSubscription,
    [STORAGE_KEY.USER_EXTEND_INFO]: extendInfo,
  })

  // notify to sidebar popup user info
  notifyPopup({
    type: EVENT.SOLVELY_DATA_SYNC,
    api: '/user',
    data: user,
  })
  notifyPopup({
    type: EVENT.SOLVELY_DATA_SYNC,
    api: '/pricing/subscription',
    data: userSubscription,
  })
}

/**
 * 清除用户数据
 */
async function clearUserData(): Promise<void> {
  try {
    await chrome.storage.local.remove('user')
  } catch (error) {
    console.error('清除用户数据失败:', error)
    throw new Error('清除用户数据失败')
  }
}

//
// 核心逻辑层（私有函数）
//

/**
 * UUID 同步的核心逻辑（不管理 offscreen document）
 * @private
 */
async function doUuidSync(): Promise<boolean> {
  try {
    const localUuid = await getPluginUuid()
    console.log(`[UuidSync] 本地 UUID: ${localUuid}`)

    // 请求 solvely.ai 域的 UUID
    const response = await sendMessageToOffscreen({
      type: 'plugin:uuid:request',
      localUuid,
    })

    if (response.type === 'plugin:uuid:response') {
      const webUuid = response.uuid

      // 如果 solvely.ai 有 UUID，使用它（重装恢复）
      if (webUuid && webUuid !== localUuid) {
        console.log('[UuidSync] 从 solvely.ai 恢复 UUID:', webUuid)
        await updatePluginUuid(webUuid)
        return true
      }
      // 如果 solvely.ai 没有 UUID，保存本地 UUID
      else if (!webUuid) {
        console.log('[UuidSync] 保存本地 UUID 到 solvely.ai:', localUuid)
        await sendMessageToOffscreen({
          type: 'plugin:uuid:save',
          uuid: localUuid,
        })
        return true
      }
      return true
    }

    return false
  } catch (error) {
    console.error('[UuidSync] UUID 同步失败:', error)
    pointError('Plugin_uuid_sync_error', error)
    return false
  }
}

/**
 * 自动登录检查的核心逻辑（不管理 offscreen document）
 * @private
 */
async function doAutoLogin(): Promise<any> {
  try {
    const response = await sendMessageToOffscreen({
      type: 'login:localStorage-check',
    })

    if (response.type === 'login:localStorage-check-success') {
      // 自动登录成功, 存储用户数据
      await getUserInfoAndUpload(response.user)
      console.log('offscreen本地存储自动登录成功, 存储用户数据', response.user)

      trackEvent.backgroundTrack('Plugin_sidebar_login_success', {
        loginMethod: 'autoLoginFromWeb',
      })

      syncAssignmentsWithServer()

      // 上报主站同步登录事件（不阻塞主流程）
      reportPluginLogin()
        .then(() => {
          console.log('reportPluginLogin success')
        })
        .catch((error: any) => {
          console.error('reportPluginLogin failed:', error)
        })

      // 老用户上报 pluginUserInfo（isSigned = 1）
      try {
        const res = await browser.storage.local.get([STORAGE_KEY.ABTEST_ASSIGNMENTS])
        const assignments = res?.[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}

        const result = await postPluginUserInfo({
          assignments,
          isSigned: 1,
        })

        // 缓存 isNewUser 标识（用于 PostHog）
        if (result?.data?.isNewUser !== undefined) {
          await browser.storage.local.set({
            [STORAGE_KEY.PLUGIN_UUID_IS_NEW_USER]: result.data.isNewUser === 1,
          })
        }

        console.log('[Login] 老用户 pluginUserInfo 上报成功')

        setTimeout(async () => {
          const userBalance = await getUserBalanceFromApi()
          await browser.storage.local.set({
            [STORAGE_KEY.USER_BALANCE]: userBalance?.data,
          })
        }, 100)
      } catch (error) {
        console.warn('[Login] 老用户 pluginUserInfo 上报失败:', error)
      }

      return response.user
    } else {
      // 未自动登录, 静默处理, 有可能 localStorage 无用户登录记录
    }

    trackEvent.backgroundTrack('plugin_sidebar_login_status', {
      isAutoLogin: response.type === 'login:localStorage-check-success',
    })
  } catch (error) {
    // pointError('service_login_checkLocalStorageAndAutoLogin_error', error)
  }

  return null
}

//
// 公共接口层（导出函数）
//

/**
 * 插件安装时的初始化流程
 * 包括：UUID 同步 + 自动登录检查
 * 在同一个 offscreen 生命周期内完成，避免并发冲突
 *
 * @returns {uuidSynced: boolean, user: any} UUID同步结果和用户信息
 */
export async function initPluginOnInstall(): Promise<{
  uuidSynced: boolean
  user: any
}> {
  await setupOffscreenDocument()

  try {
    console.log('[Plugin Init] 开始初始化流程')

    // 1️⃣ 先执行 UUID 同步
    console.log('[Plugin Init] 步骤1: UUID 同步')
    const uuidSynced = await doUuidSync()
    console.log(`[Plugin Init] UUID 同步${uuidSynced ? '成功' : '失败'}`)

    // 2️⃣ 再执行自动登录检查
    console.log('[Plugin Init] 步骤2: 自动登录检查')
    const user = await doAutoLogin()
    console.log(`[Plugin Init] 自动登录${user ? '成功' : '失败'}`)

    return { uuidSynced, user }
  } catch (error) {
    console.error('[Plugin Init] 初始化流程失败:', error)
    pointError('Plugin_init_error', error)
    return { uuidSynced: false, user: null }
  } finally {
    // 3️⃣ 统一关闭 offscreen document
    await closeOffscreenDocument()
    console.log('[Plugin Init] 初始化流程完成')
  }
}

/**
 * 同步 Plugin UUID（独立调用版本）
 * 适用场景：
 * - 扩展更新时（update 事件）
 * - 其他需要单独同步 UUID 的场景
 *
 * @returns 是否同步成功
 */
export async function syncPluginUuidFromWeb(): Promise<boolean> {
  try {
    await setupOffscreenDocument()

    const success = await doUuidSync()

    return success
  } catch (error) {
    console.error('[UuidSync] UUID 同步失败:', error)
    pointError('Plugin_uuid_sync_error', error)
    return false
  } finally {
    try {
      await closeOffscreenDocument()
    } catch (e) {
      // 忽略关闭失败
    }
  }
}

/**
 * 获取用户 firebase idToken
 */
export async function getUserFirebaseIdToken(): Promise<string> {
  await setupOffscreenDocument()
  try {
    const response = await sendMessageToOffscreen({
      type: 'login:get-firebase-idToken',
    })

    if (response.type === 'login:get-firebase-idToken-success') {
      return response.idToken
    } else {
      console.error('获取用户 firebase idToken 失败', response)
      return ''
    }
  } catch (error) {
    console.error('获取用户 firebase idToken 失败', error)
    return ''
  }
}
