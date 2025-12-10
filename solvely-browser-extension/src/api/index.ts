import http from './axios'
import { getPluginUuid } from '~/utils/pluginUuid'

/**
 * 上报事件
 * @param {string} eventName 事件名称
 * @param {object} eventParams 事件参数
 * @param {string} id 用户id
 * @returns {Promise} response
 * @description 因为firebase的埋点功能不支持在插件环境中运行（试过内容脚本、background脚本都不行），所以采用把事件上报给web server的方式，然后由web server转发给firebase
 */
export const point = (
  eventName: string,
  eventParams: object,
  id: string,
  cid?: string
) => {
  const params: any = {
    name: eventName,
    params: eventParams,
    id,
  }
  if (cid) {
    params.cid = cid
  }
  return http.post(`/v8/report/browser-ext/event`, params)
}

// 获取s3上传URL
export const getUploadUrl = (params: object) => http.post(`/uploadurl`, params)

// 获取flashcards上传URL
export const getFlashcardsUploadUrl = (params: object) =>
  http.post(`/flashcards/uploadurl`, params)

// 获取PDF预先上传URL
export const getPdfUploadUrl = (params: object) =>
  http.post(`/uploadurl/file`, params)

// 入库
// deviceId
// platform
// pdfUrl (可选) - PDF文件URL，与 pictures 二选一
// pictures (可选) - 图片URL列表，与 pdfUrl 二选一
// sessionId
export const postRetrieve = (params: object) =>
  http.post(`/chat/pdf/context/cache`, params)

// 上传s3
export const uploadS3 = (url: string, file: Blob, md5: string) => {
  return http.put(url, file, {
    headers: {
      'Content-MD5': md5,
      /**
       * 必须加上这个头，否则传给S3的图片的`Content-Type:application/json`，
       * S3就会按照json格式存这个图片，例如：https://static.justsolvely.com/questionImage/1727601325816-cropped-image.webp
       * `Content-Type:application/json`的原因是在`./index.js`中对axios初始化时，做了统一的`Content-Type:application/json`配置
       * @TODO 更好的做法是，不信任返回值，根据文件后缀添加MIME（目前服务端写死的上传到S3的都是webp）
       */
      'Content-Type': 'image/webp',
    },
    skipAuth: true, // 自定义标志，用于跳过添加特定头, 有多个验证头的时候 s3 上传会失败
  })
}

// 获取token
export const getToken = (uid: string) => http.get(`/token`, { uid })

// 获取 idToken
export const getIdToken = () => http.get(`/auth/idToken`)

// 获取用户信息
export const getUser = () => http.get(`/user`)

// 获取用户余额
export const getUserBalance = () => http.get(`/user/balance`)

// 获取用户扩展信息
export const getUserExtendInfo = () => http.get(`/user/extend`)

// 上传用户信息
export const postUserInfo = (params: object) => http.post(`/userinfo`, params)
// 插件上报新用户信息
export const postPluginUserInfo = (params: object) => http.post(`/plugin/userinfo`, params)

// 获取用户订阅信息
export const getUserSubscription = () => http.get(`/pricing/subscription`)

// youtube
// 获取 YouTube 摘要, 支持取消
export const getYouTubeOutline = (
  subtitles: any,
  videoId: string,
  lang = 'en',
  signal?: AbortSignal
) =>
  http.post(
    `/plugin/youtube/summaryOutline`,
    { subtitles, videoId, lang },
    { signal }
  )

// 获取 YouTube 详细信息, 支持取消
export const getYouTubeDetails = (
  subtitles: any,
  videoId: string,
  lang = 'en',
  signal?: AbortSignal
) =>
  http.post(
    `/plugin/youtube/summaryDetails`,
    { subtitles, videoId, lang },
    { signal }
  )

// 创建付款链接
export const createPricingCheckout = (params: object) => {
  return http.post('/pricing/checkout', params)
}

// 获取订阅商品列表
export const getPricingProducts = () => http.get('/product?source=plugin')

// ABTest: 获取服务端实验分配标签字符串
export const getAbtestAssignmentsRemote = async (): Promise<string> => {
  const res = await http.get(`/abtest/assignments`)
  return (res && res.abTestAssignments) || ''
}

// ABTest: 全量替换服务端实验分配标签
export const replaceAbtestAssignmentsRemote = async (
  assignmentsString: string
): Promise<string> => {
  const res = await http.put(`/abtest/assignments`, { assignmentsString })
  return (res && res.abTestAssignments) || ''
}

// 插件登录事件上报
export const reportPluginLogin = () =>
  http.post(`/plugin/rengage/pluginLogin`, {})
// 扣减免费插件使用次数
export const decrementPluginUsage = (amount: number) =>
  http.post(`/plugin/usage/decrement`, { amount })
// 完成插件试用订阅（freeTrialCount + 1）
export const completePluginTrial = () =>
  http.post(`/plugin/trial/complete`, {})

// 发送验证码
export const sendVerificationCodeFromApi = (email: string) =>
  http.post('/auth/email/code/send', { email })

// 验证验证码
export const verifyVerificationCodeFromApi = (email: string, code: string) =>
  http.post('/auth/email/code/verify', { email, code })

// 更新用户年级
export const updateUserGrade = (grade: string) =>
  http.put('/user/grade', { grade })

/**
 * 创建 Flashcards Deck
 * @param deckData - Deck 数据
 * 
 * @description
 * - 自动获取 idToken
 * - 内容脚本环境：自动通过 tRPC 转发到 background（绕过 CORS）
 * - 侧边栏环境：直接走原生 HTTP
 */
export const createFlashcardsDeck = async (deckData: {
  name: string
  style: string
  resources: any[]
}) => {
  // 获取 idToken
  const { idToken } = await getIdToken()
  
  if (!idToken) {
    throw new Error('No idToken available')
  }

  return http.post(
    import.meta.env.VITE_FLASHCARDS_API_DECKS,
    deckData,
    {
      headers: {
        'Authorization': `Bearer ${idToken}`,  // 大写 A（与 router.ts 保持一致）
        'solvely-platform': 'plugin',
        'x-plugin-uuid': await getPluginUuid() || '',
      },
      skipAuth: true,  // 禁用 autoAuth，避免重复添加 Authorization
    }
  )
}

// ========== 反馈相关 API ==========

/**
 * Answer 消息反馈（点赞/点踩）
 * @param questionId - 问题 ID
 * @param answerId - 答案 ID
 * @param like - 0: 点踩, 1: 点赞
 */
export const feedbackAnswer = (questionId: string, answerId: string, like: 0 | 1) =>
  http.post(`/question/${questionId}/like`, { like, answerId })

/**
 * Ask 消息反馈（Follow-up 点赞/点踩）
 * @param questionId - 问题 ID
 * @param answerId - 答案 ID（作为 sessionId）
 * @param messageId - 消息 ID
 * @param feedback - 0: 点踩, 1: 点赞
 */
export const feedbackAsk = (questionId: string, answerId: string, messageId: string, feedback: 0 | 1) =>
  http.post(`/question/follow/${questionId}/like`, {
    followFeedBack: feedback,
    messageId,
    sessionId: answerId,
  })

/**
 * Summary 消息反馈（Summary/PDF Summary 点赞/点踩）
 * @param sessionId - 会话 ID
 * @param feedback - 0: 点踩, 1: 点赞
 */
export const feedbackSummary = (sessionId: string, feedback: 0 | 1) =>
  http.post(`/plugin/summary/${sessionId}/feedback`, { feedback })
