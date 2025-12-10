// src/types/user.ts 用户信息类型定义

// 用户个人信息
export type User = {
  abTestTags: string[]
  balance: number
  country: string
  deviceId: string
  email: string
  fast: number
  fastTotal: number
  isSigned: number
  point: string[]
  role: number
  teach: number
  teachTotal: number
  plugin: number
  pluginTotal: number
  userName: string
  webAdjustUserId: string
  userPicture?: string // 用户头像URL，Google登录时会有值
}

// 用户订阅信息
export type Subscription = {
  discount?: string
  expireTimestamp: number
  hasUnredeemedGems: boolean
  isGrant?: boolean
  isBundle?: boolean
  isCancelled: boolean
  isExpired: boolean
  isTrialPeriod: number
  nextPlan: string | null
  nextRedeemGems?: number
  pauseCollection?: any
  period: number
  productId: string
  redeemGemsRemainDays: number
  redeemedGems: number
  refund: number
  regular: number
  subscribePlan: string
  subscriptionChannel: string
  subscriptionType: string
  transactionId: string
}

// 用户订阅信息列表
export type Subscriptions = Array<Subscription>

// 用户个人信息和订阅信息
export type UserAndSubscriptions = {
  user: User
  subscriptions: Subscriptions
  userBalance: UserBalance
}

// 用户余额信息
export type UserBalance = {
  plugin?: number | null
  balance?: number | null
}

// 用户的扩展信息
export type UserExtendInfo = {
  bucketId?: string
  abTestTags?: string[]
}
