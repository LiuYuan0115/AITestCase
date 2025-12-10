// plugins/firebase.client.ts
import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getAnalytics, logEvent } from 'firebase/analytics'
import type { Analytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { firebaseConfig } from '~/config/firebase'
import { getUrlParams, isProd } from '~/utils'

// Firebase 实例容器
const firebaseInstance = () => {
  let app: FirebaseApp
  let auth: Auth
  let analytics: Analytics | null = null

  const initialize = () => {
    if (!app) {
      app = initializeApp(firebaseConfig)
      auth = getAuth(app)
      // 只在客户端（浏览器）环境初始化Analytics
      if (typeof window !== 'undefined') {
        analytics = getAnalytics(app)
      }
    }
    return { app, auth, analytics }
  }

  return { initialize }
}

// 创建单例
const { initialize } = firebaseInstance()
const { auth } = initialize()

export default defineNuxtPlugin((nuxtApp) => {
  // 确保初始化
  const { analytics } = initialize()

  const firebaseLogEvent = (eventName: string, eventParams?: Record<string, any>) => {
    // 检查analytics是否已初始化（仅在客户端环境）
    if (!analytics) {
      console.warn('Firebase Analytics not initialized - event not logged:', eventName)
      return
    }
    const finalEventName = isProd() ? eventName : `${eventName}_T`
    console.log('Firebase Event:', finalEventName, eventParams)
    return logEvent(analytics, finalEventName, eventParams)
  }

  const pageViewEvent = (pageName: string) => {
    const urlParams = getUrlParams()
    return firebaseLogEvent(pageName, urlParams)
  }

  // 提供所有需要的实例和方法
  nuxtApp.provide('firebaseLogEvent', firebaseLogEvent)
  nuxtApp.provide('pageViewEvent', pageViewEvent)
  nuxtApp.provide('auth', auth)
})

// 导出不可变的单例实例
export { auth }
