import EVENT from '~/utils/event'
import {
  type User,
  type Subscriptions,
  type UserAndSubscriptions,
  type Message,
} from '~/types'
import { checkIfHasRejectImage } from './screenshot'
import { STORAGE_KEY } from '~/config'
import {
  getToken as getTokenFromApi,
  getUserBalance as getUserBalanceFromApi,
  getUserExtendInfo as getUserExtendInfoFromApi,
} from '@/api'

// API 端点常量
export const USER = '/user'
export const SUBSCRIPTION = '/pricing/subscription'
export const WEB_ADJUST_USER_ID = 'web_adjust_user_id'
export const WEB_GA_CID = 'web_ga_cid'
export const WEB_ANON_DEVICE_ID = 'web_anon_device_id'
export const PENDING_GRADE = 'pending_grade'
export const SHOW_EXAMPLE_QUESTION = 'show_example_question'

/**
 * 数据同步相关函数===============================================================================
 */

/**
 * 保存从主站接收到的数据
 * @param message 包含 api 和数据的消息对象
 */
export const saveDataFromSolvely = async (message: Message) => {
  const { api, data } = message

  // 如果没有数据，清除所有用户相关信息
  if (!data) {
    return clearUserAndSubscriptionInfo()
  }

  switch (api) {
    case WEB_ADJUST_USER_ID:
      // 保存 adjust uuid
      await browser.storage.local.set({
        [STORAGE_KEY.WEB_ADJUST_USER_ID]: data.webAdjustUserId,
      })
      break

    case WEB_GA_CID:
      // 保存 web ga cid
      await browser.storage.local.set({
        [STORAGE_KEY.WEB_GA_CID]: data.cid,
      })
      break

    case WEB_ANON_DEVICE_ID:
      // 保存 web anon device id
      await browser.storage.local.set({
        [STORAGE_KEY.WEB_ANON_DEVICE_ID]: data.webAnonDeviceId,
      })
      break

    case PENDING_GRADE:
      // 保存待同步的教育等级
      await browser.storage.local.set({
        [STORAGE_KEY.PENDING_GRADE]: data.pendingGrade,
      })
      break

    case SHOW_EXAMPLE_QUESTION:
      // 保存示例题目显示
      await browser.storage.local.set({
        [STORAGE_KEY.SHOW_EXAMPLE_QUESTION]: data.type,
      })
      break

    case USER:
      // 保存用户信息
      await browser.storage.local.set({ [STORAGE_KEY.USER]: data })
      const uid = data?.deviceId
      await browser.storage.local.set({ [STORAGE_KEY.USER_ID_KEY]: uid })

      // 获取并保存token
      const token = await getTokenFromApi(uid)
      await setToken(token)
      notifyPopup({
        type: EVENT.SOLVELY_DATA_SYNC,
        api,
        data,
      })
      notifyTabs({
        type: EVENT.SOLVELY_DATA_SYNC,
        api,
        data,
      })

      // 获取并保存用户扩展信息
      const userExtendInfo = await getUserExtendInfoFromApi()
      if (userExtendInfo) {
        await browser.storage.local.set({
          [STORAGE_KEY.USER_EXTEND_INFO]: userExtendInfo,
        })
      }
      break

    case SUBSCRIPTION:
      // 保存订阅信息
      await browser.storage.local.set({
        [STORAGE_KEY.SUBSCRIPTION]: data?.data,
      })
      notifyPopup({
        type: EVENT.SOLVELY_DATA_SYNC,
        api,
        data: data?.data,
      })
      notifyTabs({
        type: EVENT.SOLVELY_DATA_SYNC,
        api,
        data,
      })
      checkIfHasRejectImage(data?.data)
      break
  }
}

/**
 * 用户信息相关函数===============================================================================
 */

/**
 * 获取用户信息
 */
export const getUser = async (): Promise<User> => {
  const result = await browser.storage.local.get(STORAGE_KEY.USER)
  return result[STORAGE_KEY.USER]
}

/**
 * 获取用户ID
 */
export const getUserId = async (): Promise<string> => {
  const result = await browser.storage.local.get(STORAGE_KEY.USER_ID_KEY)
  return result[STORAGE_KEY.USER_ID_KEY]
}

/**
 * 检查用户是否已登录
 */
export const isLogin = async (): Promise<boolean> => {
  const user = await getUser()
  return !!user
}

/**
 * 获取用户余额
 * 余额在使用的时候会多次变化, 通过接口获取
 */
export const getUserBalance = async () => {
  const res = await getUserBalanceFromApi()
  return res.data
}

/**
 * 获取用户扩展信息
 */
export const getUserExtendInfo = async () => {
  const res = await getUserExtendInfoFromApi()
  return res
}

/**
 * 获取用户实验标签
 */
export const getUserAbTestTagsFromLocal = async () => {
  const res = await browser.storage.local.get(STORAGE_KEY.USER_EXTEND_INFO)
  return res[STORAGE_KEY.USER_EXTEND_INFO]?.abTestTags || []
}

/**
 * 获取示例题目显示
 */
export const getShowExampleQuestion = async () => {
  const res = await browser.storage.local.get(STORAGE_KEY.SHOW_EXAMPLE_QUESTION)
  return res[STORAGE_KEY.SHOW_EXAMPLE_QUESTION] || null
}

/**
 * 订阅相关函数===============================================================================
 */

/**
 * 获取订阅信息
 */
export const getSubscription = async (): Promise<Subscriptions> => {
  const result = await browser.storage.local.get(STORAGE_KEY.SUBSCRIPTION)
  return result[STORAGE_KEY.SUBSCRIPTION]
}

/**
 * 获取完整的用户和订阅信息
 */
export const getUserAndSubscriptionInfo =
  async (): Promise<UserAndSubscriptions> => {
    const [user, subscriptions] = await Promise.all([
      getUser(),
      getSubscription(),
    ])
    const result = Object.create(null)
    result.user = user
    result.subscriptions = subscriptions
    return result
  }

export const getSubscriptionStatus = async (): Promise<boolean> => {
  const subscriptions = (await getSubscription()) || []
  return subscriptions.some((s) => s.subscriptionType === 'solver')
}

/**
 * Token 相关函数===============================================================================
 */

export const getToken = async (): Promise<string> => {
  const result = await browser.storage.local.get(STORAGE_KEY.TOKEN_KEY)
  return result[STORAGE_KEY.TOKEN_KEY]
}

export const setToken = async (token: string) => {
  return browser.storage.local.set({ [STORAGE_KEY.TOKEN_KEY]: token })
}

/**
 * 清除相关函数===============================================================================
 */

/**
 * 清除用户信息
 */
export const clearUser = () => {
  return Promise.all([
    browser.storage.local.remove(STORAGE_KEY.USER_ID_KEY),
    browser.storage.local.remove(STORAGE_KEY.USER),
  ])
}

/**
 * 清除订阅信息
 */
export const clearSubscription = () => {
  return browser.storage.local.remove(STORAGE_KEY.SUBSCRIPTION)
}

/**
 * 清除token
 */
export const clearToken = () => {
  return browser.storage.local.remove(STORAGE_KEY.TOKEN_KEY)
}

/**
 * 清除所有用户相关信息（用户信息、订阅信息和token）
 */
export const clearUserAndSubscriptionInfo = () => {
  console.log(
    '清除 solvely-browser-extension-data-async [user, subscription, token] info'
  )
  notifyPopup()
  return Promise.all([clearUser(), clearSubscription(), clearToken()])
}

/**
 * 通知相关函数===============================================================================
 */

/**
 * 通知popup更新状态
 * @param message 消息
 */
export const notifyPopup = async (message?: Message) => {
  if (!message) {
    message = {
      type: EVENT.SOLVELY_DATA_SYNC,
      data: null,
    }
  }
  browser.runtime.sendMessage(message)
}

/**
 * 通知所有标签页更新状态
 * 此函数会向所有标签页发送消息，内容脚本可以通过监听这些消息检测登录状态变化
 */
export const notifyTabs = async (message: Message) => {
  try {
    // 获取所有标签页
    const tabs = await browser.tabs.query({})

    // 向每个标签页发送消息
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await browser.tabs.sendMessage(tab.id, message)
        } catch (error) {
          // 忽略错误，因为有些标签页可能没有内容脚本或无法接收消息
        }
      }
    }
  } catch (error) {
    console.error('向标签页发送登录状态消息失败:', error)
  }
}
