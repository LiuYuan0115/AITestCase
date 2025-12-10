<template>
  <div class="ext-login flex h-screen flex-col items-center justify-center">
    <img src="~/assets/app/ext-login-success/ok.svg" alt="success" class="h-[70px] w-[70px]" />
    <p class="pb-[109px] pt-[29px] text-[34px] font-bold leading-[1.3] text-[#111]">
      You're logged in!
    </p>
    <img src="@/assets/app/ext-onboarding/logo.webp" alt="Solvely" class="h-[40px]" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
  FacebookAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  signOut,
  signInWithCustomToken,
  getAuth
} from 'firebase/auth'
import { auth } from '~/plugins/firebase.client'
import { STORAGE_KEYS } from '~/config/storage'

useHead({
  script: [
    {
      innerHTML: `
        window.messageQueue = [];
        window.earlyMessageListener = function(event) {
          window.messageQueue.push(event)
        };
        window.addEventListener('message', window.earlyMessageListener);
      `
    }
  ]
})

// Declare window.messageQueue type
declare global {
  interface Window {
    messageQueue?: MessageEvent[]
    earlyMessageListener?: (event: MessageEvent) => void
  }
}

// 定义通信消息类型
type AuthMessageType =
  | 'login:email-verify' // 邮箱验证请求
  | 'login:email-verify-v2' // 邮箱验证请求code版本
  | 'login:email-password-login' // 邮箱密码登录请求
  | 'login:email-link-login' // 邮箱链接登录请求
  | 'login:auth-request' // 第三方登录/注册请求
  | 'login:email-verify-success' // 邮箱验证成功
  | 'login:auth-success' // 登录/注册成功
  | 'login:auth-error' // 登录/注册失败
  | 'login:localStorage-check' // 本地存储检查请求
  | 'login:localStorage-check-success' // 本地存储检查成功
  | 'login:localStorage-check-error' // 本地存储检查失败
  | 'login:get-firebase-idToken' // 获取 firebase idToken 请求
  | 'login:get-firebase-idToken-success' // 获取 firebase idToken 成功
  | 'login:get-firebase-idToken-error' // 获取 firebase idToken 失败
  | 'login:logout' // 退出登录请求
  | 'login:logout-success' // 退出登录成功
  | 'login:logout-error' // 退出登录失败
  | 'login:sync-to-web' // 同步到web请求
  | 'plugin:uuid:request' // 插件 UUID 请求
  | 'plugin:uuid:response' // 插件 UUID 响应
  | 'plugin:uuid:save' // 插件 UUID 保存
  | 'plugin:uuid:save-result' // 插件 UUID 保存结果

type AuthMessage = {
  type: AuthMessageType
  loginMethod?: 'password' | 'link' | 'code'
  email?: string
  password?: string
  provider?: string
  user?: any
  error?: string
  idToken?: string
  uuid?: string | null
  localUuid?: string
  success?: boolean
}

// 获取父窗口源，如果无法获取则使用通配符
const PARENT_FRAME = (() => {
  try {
    // 尝试获取父窗口源
    if (document.location?.ancestorOrigins?.length > 0) {
      return document.location.ancestorOrigins[0]
    }
    // 如果在 iframe 中，尝试获取父窗口的源
    if (window.parent !== window) {
      return window.parent.location.origin
    }
    // 如果都不行，使用通配符
    return '*'
  } catch (error) {
    console.warn('无法获取父窗口源，使用通配符:', error)
    return '*'
  }
})()

// 发送消息到父窗口的辅助函数
const sendMessageToParent = (message: AuthMessage) => {
  try {
    console.log('发送消息到父窗口:', message, PARENT_FRAME)
    window.parent.postMessage(message, PARENT_FRAME)
  } catch (error) {
    console.error('发送消息到父窗口失败:', error)
  }
}

const email = ref('')
const password = ref('')
const emailVerified = ref(false)
const loginMethod = ref<'password' | 'link' | 'code'>('password')
const emailLinkSent = ref(false)

// 邮件链接设置
const actionCodeSettings = {
  // URL需要包含域名，生产环境使用实际URL
  url: process.client ? window.location.href : '',
  // 此链接将在同一个页面中打开
  handleCodeInApp: true
}

// 格式化用户数据，移除敏感信息
const formatUserData = (user: any) => {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    providerId: user.providerId,
    isAnonymous: user.isAnonymous
  }
}

// 处理登录成功
const handleAuthSuccess = async (user: any, provider: string) => {
  // 格式化用户数据
  const formattedUser = formatUserData(user)
  // 保存用户到本地存储
  await saveUserToLocalStorage(user)

  // 发送成功消息
  sendMessageToParent({
    type: 'login:auth-success',
    user: formattedUser,
    provider
  })
  console.log(`${provider}登录成功:`, formattedUser)
}

// 处理登录失败
const handleAuthError = (error: any, provider: string) => {
  console.error(`${provider}登录失败:`, error.message)
  sendMessageToParent({
    type: 'login:auth-error',
    error: error.message,
    provider
  })
}

const signInWithEmailCode = (user: any) => {
  const auth = getAuth()
  if (user) {
    signInWithCustomToken(auth, user.customToken)
      .then((userCredential) => {
        const user = userCredential.user
        saveUserToLocalStorage(user)
      })
      .catch((error) => {
        console.error('signInWithEmailCode error:', error)
      })
  }
}

// 保存用户到本地存储
const saveUserToLocalStorage = async (user: any) => {
  // 保存用户 uid 到本地存储
  const uid = user.uid
  window.localStorage.setItem(STORAGE_KEYS.UID, uid)

  // 获取 jwt token 并存入当前源地址的 localStorage 中
  // 获取请求 api 的实例
  const { $api, $posthog } = useNuxtApp()

  try {
    $posthog.identify(uid, {
      email: user.email,
      name: user.displayName
    })
  } catch (error) {
    console.error('identify posthog error:', error)
  }

  try {
    // 使用 $api 实例调用接口
    const data = await $api('/token', {
      method: 'GET',
      params: {
        uid
      }
    })
    console.log('jwt token from $api:', data)
    if (data) {
      // 保存 jwt token 到本地存储
      window.localStorage.setItem(STORAGE_KEYS.TOKEN, data)
    } else {
      throw new Error('获取 jwt token 失败')
    }
  } catch (error) {
    console.error('get JWT token error:', error)
  }
}

/**
 * 登录逻辑
 * */
// 处理邮箱密码登录
const handleEmailPasswordLogin = async () => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value)
    await handleAuthSuccess(userCredential.user, 'email-password')
  } catch (error: any) {
    handleAuthError(error, 'email-password')
  }
}
// 处理 Google 登录/注册
const handleGoogleLogin = async () => {
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account',
      display: 'popup'
    })
    const userCredential = await signInWithPopup(auth, provider)
    await handleAuthSuccess(userCredential.user, 'google')
  } catch (error: any) {
    handleAuthError(error, 'google')
  }
}
// 处理 Apple 登录/注册
const handleAppleLogin = async () => {
  try {
    const provider = new OAuthProvider('apple.com')
    const userCredential = await signInWithPopup(auth, provider)
    console.log('Apple 登录成功:', userCredential.user)
    await handleAuthSuccess(userCredential.user, 'apple')
  } catch (error: any) {
    console.log('Apple 登录失败:', error.message)
    handleAuthError(error, 'apple')
  }
}
// 处理 Facebook 登录/注册
const handleFacebookLogin = async () => {
  try {
    const provider = new FacebookAuthProvider()
    const userCredential = await signInWithPopup(auth, provider)
    await handleAuthSuccess(userCredential.user, 'facebook')
  } catch (error: any) {
    handleAuthError(error, 'facebook')
  }
}
// 处理邮件链接登录
const handleEmailLinkLogin = async () => {
  try {
    // 从localStorage获取保存的邮箱
    let savedEmail = process.client ? window.localStorage.getItem('emailForSignIn') : null

    // 如果没有保存的邮箱，使用用户输入的邮箱
    if (!savedEmail) {
      // 如果用户在不同设备打开链接，将使用已验证的邮箱
      if (email.value) {
        savedEmail = email.value
      } else {
        throw new Error('无法验证您的邮箱，请重试或使用其他登录方式')
      }
    }
    // 使用邮箱链接进行登录
    const userCredential = await signInWithEmailLink(auth, savedEmail, window.location.href)
    const user = userCredential.user

    // 清除保存的邮箱
    if (process.client) {
      window.localStorage.removeItem('emailForSignIn')
    }

    // 向页面广播登录成功的消息, content 脚本监听到后会转发给 service worker
    window.postMessage(
      {
        type: 'solvely-email-link-login',
        status: 'success',
        user: formatUserData(user),
        provider: 'email-link'
      },
      '*'
    )
    console.log('邮件链接登录成功:', formatUserData(user))

    await saveUserToLocalStorage(user)
  } catch (error: any) {
    console.error('邮件链接登录失败:', error.message)
    // 向页面广播登录失败的消息, content 脚本监听到后会转发给 service worker
    window.postMessage(
      {
        type: 'solvely-email-link-login',
        status: 'error',
        error: error.message
      },
      '*'
    )
  }
}
// 处理自动登录的逻辑
const handleLocalStorageAutoLogin = () => {
  // 从本地存储获取用户 uid
  const uid = window.localStorage.getItem(STORAGE_KEYS.UID)
  if (uid) {
    const user = { uid }
    sendMessageToParent({
      type: 'login:localStorage-check-success',
      user
    })
    console.log('[active pages] find user in local storage autoLogin success', user)
  } else {
    sendMessageToParent({
      type: 'login:localStorage-check-error',
      error: 'not found user in local storage'
    })
    console.log('[active pages] not found user in local storage autoLogin')
  }
}

/**
 * 邮箱验证
 * 邮件链接发送等逻辑
 * */
// 处理邮箱验证
const handleEmailVerification = async () => {
  if (!email.value) return

  try {
    // 检查用户之前的登录方式
    const signInMethods = await fetchSignInMethodsForEmail(auth, email.value).catch(() => [])

    // @ts-ignore
    if (signInMethods.includes(EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD)) {
      // 邮箱+密码登录方式
      loginMethod.value = 'password'
      emailVerified.value = true
    } else {
      // 邮箱链接登录方式或新用户
      loginMethod.value = 'link'
      await sendEmailLink()
    }
    // 发送验证结果消息给父窗口
    sendMessageToParent({
      type: 'login:email-verify-success',
      loginMethod: loginMethod.value,
      provider: 'email-verify'
    })
  } catch (error: any) {
    console.error('验证邮箱失败:', error.message)
    sendMessageToParent({
      type: 'login:auth-error',
      error: error.message,
      provider: 'email-link'
    })
  }
}

const handleEmailVerificationV2 = async () => {
  if (!email.value) return

  try {
    // 检查用户之前的登录方式
    const signInMethods = await fetchSignInMethodsForEmail(auth, email.value).catch(() => [])

    // @ts-ignore
    if (signInMethods.includes(EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD)) {
      // 邮箱+密码登录方式
      loginMethod.value = 'password'
      emailVerified.value = true
    } else {
      // 邮箱链接登录方式或新用户
      loginMethod.value = 'code'
    }
    // 发送验证结果消息给父窗口
    sendMessageToParent({
      type: 'login:email-verify-success',
      loginMethod: loginMethod.value,
      provider: 'email-verify'
    })
  } catch (error: any) {
    console.error('验证邮箱失败:', error.message)
    sendMessageToParent({
      type: 'login:auth-error',
      error: error.message,
      provider: 'email-code'
    })
  }
}

// 发送邮件链接
const sendEmailLink = async () => {
  try {
    if (!process.client) {
      throw new Error('只能在客户端发送邮件链接')
    }

    await sendSignInLinkToEmail(auth, email.value, actionCodeSettings)
    // 本地保存邮箱，以便用户在同一设备打开链接时使用
    window.localStorage.setItem('emailForSignIn', email.value)
    emailLinkSent.value = true
    console.log('登录链接已发送到邮箱:', email.value)
  } catch (error: any) {
    console.error('发送邮件链接失败:', error.message)
    sendMessageToParent({
      type: 'login:auth-error',
      error: error.message,
      provider: 'email-link'
    })
  }
}
// 检查是否有邮件链接登录
const checkEmailLink = () => {
  if (process.client && isSignInWithEmailLink(auth, window.location.href)) {
    console.log('检测到邮件登录链接')
    // 处理邮件链接登录
    handleEmailLinkLogin()
  }
}

// 获取 firebase idToken
const getFirebaseIdToken = async () => {
  try {
    // 等待 Firebase Auth 初始化完成
    let currentUser = auth.currentUser

    // 如果当前用户为空，等待认证状态变化
    if (!currentUser) {
      // 使用 Promise 等待认证状态变化
      currentUser = await new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe() // 取消监听

          if (user) {
            resolve(user)
          } else {
            reject(new Error('用户未登录或认证失败'))
          }
        })

        // 设置超时，避免无限等待
        setTimeout(() => {
          unsubscribe()
          reject(new Error('等待认证状态超时'))
        }, 5000) // 5秒超时
      })
    }

    // 再次检查确保用户存在
    if (!currentUser) {
      throw new Error('无法获取当前用户')
    }
    const idToken = await currentUser.getIdToken()
    console.log('获取 firebase idToken 成功:', idToken)
    sendMessageToParent({
      type: 'login:get-firebase-idToken-success',
      idToken
    })
  } catch (error: any) {
    console.error('获取 firebase idToken 失败:', error)
    sendMessageToParent({
      type: 'login:get-firebase-idToken-error',
      error: error.message || 'get firebase idToken error'
    })
  }
}

const handleLogout = async () => {
  try {
    // Firebase 退出登录
    await signOut(auth)
    // 清除本地存储中的相关缓存
    if (process.client) {
      window.localStorage.removeItem(STORAGE_KEYS.UID)
      window.localStorage.removeItem(STORAGE_KEYS.TOKEN)
      window.localStorage.removeItem('emailForSignIn') // 邮件链接登录的缓存
    }
    // 发送退出成功消息给父窗口
    sendMessageToParent({
      type: 'login:logout-success'
    })
    console.log('用户已成功退出登录并清除了本地缓存')
  } catch (error: any) {
    console.error('退出登录失败:', error.message)
    // 发送退出失败消息给父窗口
    sendMessageToParent({
      type: 'login:logout-error',
      error: error.message,
      provider: 'logout'
    })
  }
}

// 处理 Plugin UUID 请求
const handlePluginUuidRequest = (localUuid: string) => {
  try {
    const STORAGE_KEY = 'solvely_plugin_uuid'
    const storedUuid = localStorage.getItem(STORAGE_KEY)

    console.log('[UUID] 请求 UUID - 本地:', localUuid, '存储:', storedUuid)

    sendMessageToParent({
      type: 'plugin:uuid:response',
      uuid: storedUuid
    })
  } catch (error: any) {
    console.error('[UUID] 读取失败:', error)
    sendMessageToParent({
      type: 'plugin:uuid:response',
      uuid: null,
      error: error.message
    })
  }
}

// 处理 Plugin UUID 保存
const handlePluginUuidSave = (uuid: string) => {
  try {
    const STORAGE_KEY = 'solvely_plugin_uuid'
    localStorage.setItem(STORAGE_KEY, uuid)

    console.log('[UUID] 保存成功:', uuid)

    sendMessageToParent({
      type: 'plugin:uuid:save-result',
      success: true
    })
  } catch (error: any) {
    console.error('[UUID] 保存失败:', error)
    sendMessageToParent({
      type: 'plugin:uuid:save-result',
      success: false,
      error: error.message
    })
  }
}

// 处理来自扩展程序的消息
const login = (event: MessageEvent) => {
  const { data } = event as { data: AuthMessage }
  console.log('收到消息:', data)

  // 处理 Plugin UUID 请求
  if (data.type === 'plugin:uuid:request') {
    handlePluginUuidRequest(data.localUuid || '')
    return
  }
  // 处理 Plugin UUID 保存
  if (data.type === 'plugin:uuid:save') {
    handlePluginUuidSave(data.uuid || '')
    return
  }

  // 处理不同类型的消息
  if (data.type === 'login:email-verify-v2' && data.email) {
    // 处理邮箱验证请求
    email.value = data.email
    handleEmailVerificationV2()
  } else if (data.type === 'login:sync-to-web') {
    signInWithEmailCode(data.user)
  } else if (data.type === 'login:email-verify' && data.email) {
    // 处理邮箱验证请求
    email.value = data.email
    handleEmailVerification()
  } else if (data.type === 'login:email-password-login' && data.email && data.password) {
    // 直接使用传入的邮箱和密码进行登录
    email.value = data.email
    password.value = data.password
    emailVerified.value = true
    loginMethod.value = 'password'
    handleEmailPasswordLogin()
  } else if (data.type === 'login:email-link-login' && data.email) {
    // 处理邮件链接登录请求
    email.value = data.email
    sendEmailLink()
  } else if (data.type === 'login:auth-request') {
    // 根据指定的提供商进行登录/注册
    if (data.provider === 'google') {
      handleGoogleLogin()
    } else if (data.provider === 'apple') {
      handleAppleLogin()
    } else if (data.provider === 'facebook') {
      handleFacebookLogin()
    } else {
      console.error('未知的登录提供商:', data.provider)
      sendMessageToParent({
        type: 'login:auth-error',
        error: '未知的登录提供商',
        provider: data.provider
      })
    }
  } else if (data.type === 'login:localStorage-check') {
    handleLocalStorageAutoLogin()
  } else if (data.type === 'login:get-firebase-idToken') {
    getFirebaseIdToken()
  } else if (data.type === 'login:logout') {
    handleLogout()
  }
}

// 监听消息并检查邮件链接登录
onMounted(() => {
  if (window.messageQueue && window.messageQueue.length > 0) {
    window.messageQueue.forEach((message) => {
      login(message)
    })
    window.messageQueue = [] // Clear the queue
  }

  // Remove the early listener
  if (window.earlyMessageListener) {
    window.removeEventListener('message', window.earlyMessageListener)
  }

  window.addEventListener('message', login)

  checkEmailLink()
})
</script>

<style scoped>
.ext-login {
  background-image: url('@/assets/app/ext-onboarding/bg.webp');
  background-size: cover;
  background-position: center;
}
</style>
