<template>
  <div
    v-if="isShowModal"
    class="fixed inset-0 bg-s-foundation-white/50 dark:bg-s-foundation-white-dark/50 backdrop-blur-[13px] transition-opacity duration-200 z-[999]"
  ></div>
  <div
    v-if="isShowModal"
    class="fixed inset-0 flex items-center justify-center z-[999] animate-[fadeIn_0.2s_ease-out]"
  >
    <!-- 按钮以及隐私 -->
    <div class="absolute inset-0">
      <!-- 关闭按钮 -->
      <button
        @click="showConfirmDialogMethod"
        class="absolute top-4 right-4 p-1 rounded-full border-none bg-transparent cursor-pointer text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- 隐私政策 -->
      <div
        class="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-full px-4 flex justify-center"
      >
        <p
          class="text-[11px] font-normal leading-[130%] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark"
        >
          By continuing, you confirm that you are at least 13 years old and
          agree to our
          <a
            href="https://solvely.ai/term"
            class="underline"
            target="_blank"
            rel="noopener noreferrer"
            >Terms & Conditions</a
          >
          and
          <a
            href="https://solvely.ai/privacy-policy"
            class="underline"
            target="_blank"
            rel="noopener noreferrer"
            >Privacy Policy</a
          >.
        </p>
      </div>
    </div>

    <!-- 弹窗内容 -->
    <div class="w-[330px] p-5 relative animate-[scaleIn_0.2s_ease-out]">
      <!-- Logo和页面标题 -->
      <div class="flex flex-col items-center justify-center gap-4 mb-6">
        <div
          class="flex items-center gap-1 text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-colors h-6"
        >
          <SvgIcon name="login/logo-icon" size="24" />
          <SvgIcon name="login/logo-text" size="78" />
        </div>
        <h1
          class="text-2xl font-bold leading-[120%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark transition-colors duration-200"
        >
          Log in to see answers
        </h1>
      </div>

      <div
        v-if="isLoginLoading"
        class="h-[336px] flex items-center justify-center"
      >
        <Vue3Lottie
          :animation-data="isDark ? loadingAnimationDark : loadingAnimation"
          :width="40"
          :height="40"
          :loop="true"
          :autoplay="true"
          :style="{ margin: 0 }"
        />
      </div>

      <template v-else>
        <div class="w-[290px] mx-auto">
          <!-- Google 登录按钮 -->
          <div>
            <button
              @click.prevent="handleProviderLogin('google')"
              :disabled="isLoginLoading"
              class="w-full h-11 rounded-[28px] border border-[#c0d8ff] dark:border-[#2F3543] bg-gradient-to-r bg-clip-content border-box flex items-center justify-center gap-1 cursor-pointer text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark text-sm font-bold leading-[130%] mb-2 transition-colors duration-200"
            >
              <img
                src="@/assets/images/login/google-icon.webp"
                alt="google"
                class="w-[18px] h-[18px]"
              />
              Continue with Google
            </button>
          </div>

          <!-- 第三方登录按钮 -->
          <div class="flex justify-between gap-2">
            <!-- Apple 登录按钮 -->
            <button
              v-if="!isRegisterMode"
              @click.prevent="handleProviderLogin('apple')"
              :disabled="isLoginLoading"
              class="flex-1 h-11 rounded-[28px] border border-[#c0d8ff] dark:border-[#2F3543] flex items-center justify-center cursor-pointer text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-sm font-bold leading-[130%] gap-1 transition-all duration-200 hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark"
            >
              <!-- <img
                src="@/assets/images/login/apple-icon.webp"
                alt="apple"
                class="w-[18px] h-[18px]"
              /> -->
              <SvgIcon name="login/logo-apple" size="18" />
            </button>

            <!-- Facebook 登录按钮 -->
            <button
              @click.prevent="handleProviderLogin('facebook')"
              :disabled="isLoginLoading"
              class="flex-1 h-11 rounded-[28px] border border-[#c0d8ff] dark:border-[#2F3543] flex items-center justify-center cursor-pointer text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark text-sm font-bold leading-[130%] gap-1 transition-all duration-200 hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark"
            >
              <img
                src="@/assets/images/login/facebook-icon.webp"
                alt="facebook"
                class="w-[18px] h-[18px]"
              />
              {{ isRegisterMode ? 'Continue with Facebook' : '' }}
            </button>
          </div>

          <!-- 分隔线 -->
          <div class="my-3 h-5 relative text-center">
            <span
              class="inline-block px-4 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-base font-normal relative z-10"
              >or</span
            >
            <div
              class="absolute w-[122px] h-px top-1/2 left-0 bg-s-border dark:bg-s-border-dark z-0"
            ></div>
            <div
              class="absolute w-[122px] h-px top-1/2 right-0 bg-s-border dark:bg-s-border-dark z-0"
            ></div>
          </div>

          <!-- 登录表单 -->
          <form
            @submit.prevent="handleSubmit"
            class="w-full custom_auth_form"
            novalidate
          >
            <!-- 邮箱输入字段 -->
            <div class="mb-3">
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                id="email"
                name="email"
                placeholder="abc@example.com"
                class="border border-s-border dark:border-s-border-dark w-full h-11 rounded-[28px] bg-secondary dark:bg-secondary-dark p-4 outline-none text-base font-normal leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark placeholder:text-s-text-low-emphasis dark:placeholder:text-s-text-low-emphasis-dark transition-colors duration-200"
                :class="{
                  'border-s-text-brand dark:border-s-text-brand-dark':
                    isFocused,
                  'border-s-function-erro dark:border-s-function-erro-dark':
                    emailError,
                }"
                required
                @focus="isFocused = true"
                @blur="isFocused = false"
              />
              <!-- 邮箱错误提示 -->
              <div
                v-if="emailError"
                class="mt-[9px] text-[12px] ml-[21px] leading-[16px] text-s-function-erro dark:text-s-function-erro-dark"
              >
                {{ emailError }}
              </div>
            </div>

            <!-- 密码输入字段 -->
            <div v-if="loginMethod === 'password'" class="mb-3">
              <input
                v-model="password"
                type="password"
                placeholder="password"
                maxlength="32"
                class="w-full h-11 rounded-[28px] bg-hover-on-gray dark:bg-hover-on-gray-dark p-4 outline-none text-base font-normal leading-[140%] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark placeholder:text-s-text-low-emphasis dark:placeholder:text-s-text-low-emphasis-dark transition-colors duration-200"
                :class="{
                  'outline outline-1 outline-s-text-brand dark:outline-s-text-brand-dark':
                    isPasswordFocused,
                  'border-s-function-erro dark:border-s-function-erro-dark':
                    passwordError,
                }"
                required
                @focus="isPasswordFocused = true"
              />
              <!-- 密码错误提示 -->
              <div
                v-if="passwordError"
                class="mt-[9px] text-[12px] ml-[21px] leading-[16px] text-s-function-erro dark:text-s-function-erro-dark"
              >
                {{ passwordError }}
              </div>
            </div>

            <!-- 登录按钮 -->
            <button
              type="submit"
              class="w-full h-11 rounded-[28px] bg-s-text-brand dark:bg-s-text-brand-dark text-s-interface-bg font-bold text-base border-none cursor-pointer flex items-center justify-center gap-1 hover:bg-s-hover-primary dark:hover:bg-s-hover-primary-dark transition-colors duration-200"
              :disabled="isNextLoading"
            >
              <div
                class="relative w-[18px] h-[18px] flex items-center justify-center"
              >
                <Transition name="icon-fade" mode="out-in">
                  <SvgIcon
                    v-if="isNextLoading"
                    key="loading"
                    name="login/login-loading"
                    size="18"
                    class="animate-spin"
                  />
                  <SvgIcon
                    v-else
                    key="next"
                    name="login/login-next"
                    size="18"
                  />
                </Transition>
              </div>
              Next
            </button>
          </form>
        </div>

        <!-- 注册链接 -->
        <div class="text-center mt-4">
          <span
            class="text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-sm transition-colors duration-200"
            >{{
              isRegisterMode
                ? 'Already have an account?'
                : "Don't have an account?"
            }}</span
          >
          <button
            @click="isRegisterMode = !isRegisterMode"
            class="text-s-text-brand dark:text-s-text-brand-dark text-sm font-bold ml-1 bg-none border-none cursor-pointer hover:underline transition-colors duration-200"
            :disabled="isLoginLoading"
          >
            {{ isRegisterMode ? 'Login' : 'Sign up' }}
          </button>
        </div>
      </template>
    </div>
  </div>

  <!-- 验证码覆盖层 -->
  <VerificationCode
    ref="verificationCodeRef"
    :email="email"
    @verify-code="handleVerificationCode"
    @error="handleVerificationCodeError"
  />

  <!-- Loading 遮罩层，独立由 isWaitingAutoLogin 控制 -->
  <!-- <div v-if="isWaitingAutoLogin" class="modal-loading">
    <img
      src="@/assets/images/login/login-loading.webp"
      alt="loading"
      class="modal-form-loading-img"
    />
  </div> -->

  <!-- 新增独立的Toast提示组件 -->
  <Transition name="toast-fade">
    <div
      v-if="toastVisible"
      class="fixed top-5 left-1/2 w-80 transform -translate-x-1/2 p-2.5 px-5 rounded-lg text-sm font-medium shadow-lg z-[9999] transition-all duration-300"
      :class="[
        messageType === 'error'
          ? 'bg-s-function-erro/10 dark:bg-s-function-erro-dark/10 text-s-function-erro dark:text-s-function-erro-dark border border-s-function-erro/20 dark:border-s-function-erro-dark/20'
          : 'bg-s-function-success/10 dark:bg-s-function-success-dark/10 text-s-function-success dark:text-s-function-success-dark border border-s-function-success/20 dark:border-s-function-success-dark/20',
      ]"
    >
      {{ message }}
    </div>
  </Transition>

  <!-- 黑色遮罩加弹窗 -->
  <div
    class="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center"
    v-if="showConfirmDialog"
  >
    <ConfirmDialog
      :show="showConfirmDialog"
      title="Leave login?"
      content="If you exit now, you won't be able to view the answer."
      :buttons="dialogButtons"
      @action="handleDialogAction"
      @close="handleDialogClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, inject } from 'vue'
import { getTrpc } from '~/lib/trpc/client'
import { AuthState } from '../../types/auth'
import trackEvent from '~/utils/trackEvent'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { DialogButton } from '@/components/common/ConfirmDialog.vue'
import { Vue3Lottie } from 'vue3-lottie'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import SvgIcon from '@/components/common/SvgIcon.vue'
import VerificationCode from './VerificationCode.vue'

// 事件
defineEmits<{
  (e: 'login-success', user: any): void
}>()

// 状态变量
const email = ref('')
const password = ref('')
const isLoginLoading = ref(false)
const isNextLoading = ref(false) // Next 按钮的加载状态
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const toastVisible = ref(false) // 新增 toast 显示状态
const isRegisterMode = ref(false)
const auth = inject<AuthState>('auth')!
const isFocused = ref(false)
const isPasswordFocused = ref(false)
const loginMethod = ref<'password' | 'link' | 'code' | '' | null | undefined>(
  ''
)
const emailError = ref('')
const passwordError = ref('')

// 验证码组件引用
const verificationCodeRef = ref()

// 邮箱格式验证函数
const validateEmail = (email: string): boolean => {
  // 基本格式验证：用户名@域名.顶级域
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return false
  }

  // 验证TLD长度：顶级域名应该至少2个字符
  const parts = email.split('@')
  if (parts.length !== 2) {
    return false
  }

  const domainParts = parts[1].split('.')
  if (domainParts.length < 2) {
    return false
  }

  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2) {
    return false
  }

  return true
}

// 密码验证函数
const validatePassword = (password: string): boolean => {
  return password.length >= 6
}

const { isShowModal, closeLoginModal } = auth
const { isDark } = useDarkMode()

// 确认弹窗相关状态
const showConfirmDialog = ref(false)
const dialogButtons: DialogButton[] = [
  {
    text: 'Leave',
    action: 'leave',
    type: 'secondary',
  },
  {
    text: 'Stay',
    action: 'stay',
    type: 'primary',
  },
]

// 处理确认弹窗按钮点击
const handleDialogAction = (action: string) => {
  console.log('Dialog action:', action)

  switch (action) {
    case 'leave':
      // 处理离开逻辑
      trackEvent.track('Plugin_Sidebar_Login_Doublecheck_Leave')
      handleClose()
      break
    case 'stay':
      // 处理停留逻辑
      trackEvent.track('Plugin_Sidebar_Login_Doublecheck_Stay')
      break
  }

  // 关闭弹窗
  showConfirmDialog.value = false
}

// 处理确认弹窗关闭
const handleDialogClose = () => {
  showConfirmDialog.value = false
}

// 显示确认弹窗的方法
const showConfirmDialogMethod = () => {
  trackEvent.track('Plugin_Sidebar_Login_Doublecheck')
  showConfirmDialog.value = true
}

// 处理关闭弹窗
const handleClose = () => {
  console.log('handleCloseClicked')

  // 重置表单状态
  resetFormState()

  closeLoginModal()
  console.log(isShowModal.value)
}

// 静默关闭弹窗（不触发埋点）
const silentClose = () => {
  console.log('Silent close auth modal')

  // 重置表单状态
  resetFormState()

  // 直接设置状态，不调用 closeLoginModal
  isShowModal.value = false
}

// 重置表单状态的方法
const resetFormState = () => {
  email.value = ''
  password.value = ''
  isLoginLoading.value = false
  isNextLoading.value = false
  message.value = ''
  messageType.value = 'success'
  isRegisterMode.value = false
  isFocused.value = false
  isPasswordFocused.value = false
  toastVisible.value = false
  loginMethod.value = ''
  emailError.value = ''
  passwordError.value = ''
  password.value = ''

  // 关闭验证码组件
  if (verificationCodeRef.value) {
    verificationCodeRef.value.hide()
  }
}

// 显示消息 - 修改为使用独立 Toast
const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
  message.value = text
  messageType.value = type
  toastVisible.value = true

  // 3秒后自动隐藏
  setTimeout(() => {
    toastVisible.value = false
  }, 3000)
}

const loginSuccess = () => {
  // emit('login-success', response.data) // 登录成功，发送事件通知
  auth.handleLoginSuccess()
  // TODO: 登录成功后，需要处理一些事情，需要调用一个新事件通知extension-login.vue并带入uuid，然后注入主站界面的localstorage，
  handleClose() // 自动关闭弹窗
}

const handleSubmit = async () => {
  trackEvent.track('Plugin_Sidebar_EmailLogin_Click', {
    from: 'sidepanel',
  })
  // 验证邮箱
  if (!email.value || !validateEmail(email.value)) {
    emailError.value = 'Invalid email format'
    return
  }
  emailError.value = ''

  // 如果有密码字段，验证密码
  if (loginMethod.value === 'password') {
    if (!password.value || !validatePassword(password.value)) {
      passwordError.value = 'Please enter at least 6 digits'
      return
    }
    passwordError.value = ''
  }
  // 所有验证通过，执行登录逻辑
  // 注册模式下, 直接走链接登录的逻辑
  // TODO: 后续修复老用户问题

  await handleVerifyLoginMethod()
}

// 验证邮箱登录方式
const handleVerifyLoginMethod = async () => {
  isNextLoading.value = true

  try {
    const result = await getTrpc().verifyLoginMethod.mutate(email.value)
    loginMethod.value = result
    console.log('验证邮箱登录方式结果:', result)

    // 如果是验证码走这个流程
    if (result === 'code') {
      // 如果是 code 登录，则开启验证码流程
      await handleEmailCodeLogin()
    }
    if (result === 'password') {
      await handleEmailLogin()
    }

    // 如果登录方式是链接登录，显示邮件已发送的提示, 并开启邮箱链接登录的流程
    // if (result === 'link') {
    //   showMessage(
    //     `Login link has been sent to ${email.value}. Please check your inbox.`,
    //     'success'
    //   )
    //   // 如果是 link 登录，则开启邮箱链接登录的流程
    //   handleEmailLinkLogin()
    // }
  } catch (error: any) {
    console.error('验证邮箱登录方式失败:', error)
    
    // 检查是否为网络错误
    const isNetworkError = error.message?.includes('network') || 
                         error.message?.includes('timeout') ||
                         error.message?.includes('fetch')
    
    if (isNetworkError) {
      showMessage('Network error, please try again later.', 'error')
    } else {
      // 所有其他错误统一显示
      showMessage('Failed. Try again later.', 'error')
    }
  } finally {
    isNextLoading.value = false
  }
}

// 邮箱验证码登录
const handleEmailCodeLogin = async () => {
  // 开启邮箱验证码登录的流程
  // 跳转到验证码页面
  if (email.value && verificationCodeRef.value) {
    await verificationCodeRef.value.show()
    trackEvent.track('Plugin_Sidebar_CheckEmail_Show',{
      from: 'sidepanel',
    })
  }
}

// 处理验证码验证
const handleVerificationCode = async (code: string) => {
  trackEvent.track('Plugin_sidebar_verification_login', {
    email: email.value,
  })

  // 设置验证码组件为验证中状态
  if (verificationCodeRef.value) {
    verificationCodeRef.value.setVerifying(true)
  }

  try {
    // 调用验证码登录接口（这里会调用真实的后端API）
    const result = await getTrpc().loginWithVerificationCode.mutate({
      email: email.value,
      code: code,
    })

    // 登录成功，调用与邮箱链接登录相同的成功处理
    loginSuccess()

    // 登录成功后完全重置验证码组件
    if (verificationCodeRef.value) {
      verificationCodeRef.value.hide()
    }

    // 埋点：验证码验证成功
    trackEvent.track('Plugin_Sidebar_CheckEmail_Verified', {
      from: 'sidepanel'
    })

    trackEvent.track('Plugin_sidebar_verification_login_success', {
      email: email.value,
    })
  } catch (error: any) {
    console.error('验证码登录失败:', error)
    trackEvent.track('Plugin_sidebar_verification_login_error', {
      email: email.value,
    })

    // 设置验证码组件显示错误（验证码组件已有底部错误提示，不需要顶部弹窗）
    if (verificationCodeRef.value) {
      verificationCodeRef.value.setError(true)
    }
  } finally {
    // 结束验证状态
    if (verificationCodeRef.value) {
      verificationCodeRef.value.setVerifying(false)
    }
  }
}

// 处理验证码验证错误
const handleVerificationCodeError = (error: any) => {
  showMessage(error.message + ' Please try later.', 'error')
}

// 监听 isNextLoading 状态，超时自动重置
let nextLoadingTimer: NodeJS.Timeout | null = null
watch(isNextLoading, (newValue) => {
  if (newValue) {
    // 开始加载时，设置40秒超时
    nextLoadingTimer = setTimeout(() => {
      if (isNextLoading.value) {
        isNextLoading.value = false
        showMessage('Network error, please try again later.', 'error')
      }
    }, 30000) // 40秒
  } else {
    // 停止加载时，清除定时器
    if (nextLoadingTimer) {
      clearTimeout(nextLoadingTimer)
      nextLoadingTimer = null
    }
  }
})

// 邮箱链接登录
// const handleEmailLinkLogin = async () => {
//   trackEvent.track('Plugin_sidebar_authModal_email_link_login', {
//     email: email.value,
//   })
//   isLoginLoading.value = true
//   try {
//     const result = await getTrpc().loginWithEmailLink.mutate(email.value)
//     loginSuccess()
//     trackEvent.track('Plugin_sidebar_authModal_email_link_login_success', {
//       email: email.value,
//     })
//   } catch (error: any) {
//     trackEvent.track('Plugin_sidebar_authModal_email_link_login_error', {
//       email: email.value,
//     })
//     // showMessage(error.message || 'Failed to login with email link', 'error')
//   } finally {
//     isLoginLoading.value = false
//   }
// }

// 邮箱密码登录
const handleEmailLogin = async () => {
  if (!email.value || !password.value) {
    return
  }

  isLoginLoading.value = true
  try {
    const result = await getTrpc().loginWithEmailPassword.mutate({
      email: email.value,
      password: password.value,
    })

    loginSuccess()
  } catch (error: any) {
    console.error('登录失败:', error)
    // showMessage(
    //   error.message || 'Login failed. Please check your credentials',
    //   'error'
    // )
  } finally {
    isLoginLoading.value = false
  }
}

// 第三方登录
const handleProviderLogin = async (provider: string) => {
  trackEvent.track('Plugin_sidebar_authModal_provider_login', {
    provider,
  })

  isLoginLoading.value = true
  try {
    const result = await getTrpc().loginWithProvider.mutate({
      provider,
    })

    loginSuccess()
    trackEvent.track('Plugin_sidebar_authModal_provider_login_success', {
      provider,
    })
  } catch (error: any) {
    trackEvent.track('Plugin_sidebar_authModal_provider_login_error', {
      provider,
    })
    // showMessage(error.message || `Login with ${provider} failed`, 'error')
  } finally {
    isLoginLoading.value = false
  }
}

// 监听modal打开状态，阻止背景滚动
// modal 打开时初始化登录 offscreen 页面
watch(
  () => isShowModal.value,
  (newVal) => {
    if (newVal) {
      document.body.style.overflow = 'hidden'
      // 初始化登录 offscreen 页面
      getTrpc().initLoginService.mutate()
    } else {
      document.body.style.overflow = ''
    }
  }
)

// 监听用户登录状态变化，登录成功时自动关闭弹窗
watch(
  () => auth.isAuthenticated.value,
  (isAuthenticated) => {
    if (isAuthenticated && isShowModal.value) {
      console.log('User logged in, auto-closing auth modal')
      silentClose()
    }
  }
)

// 监听扩展存储变化，检测用户登录状态
const handleStorageChange = (changes: any, area: string) => {
  if (area === 'local' && changes['user']) {
    const newUser = changes['user'].newValue
    if (newUser && isShowModal.value) {
      console.log('User logged in from storage change, auto-closing auth modal')
      silentClose()
    }
  }
}

// 组件挂载时获取当前用户
onMounted(async () => {
  // 监听存储变化
  browser.storage.onChanged.addListener(handleStorageChange)
})

onUnmounted(async () => {
  await getTrpc().closeOffscreenDocument.mutate()
  // 移除存储监听器
  browser.storage.onChanged.removeListener(handleStorageChange)
})
</script>

<style scoped>
/* 等待 offscreen 静默登录的 loading 遮罩层 */
.modal-loading {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.6);
  z-index: 999;
  animation: fadeIn 0.2s ease-out;

  & .modal-form-loading-img {
    width: 42px;
    height: 42px;
    animation: spin 2s linear infinite;
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.1s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

/* 图标切换动画 */
.icon-fade-enter-active,
.icon-fade-leave-active {
  transition: all 0.1s ease;
}

.icon-fade-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.icon-fade-leave-to {
  opacity: 0;
  transform: scale(1.2);
}

.custom_auth_form input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px #ecf5ff inset !important;
  -webkit-text-fill-color: #111 !important;
  transition: background-color 9999s ease-in-out 0s; /* 防止背景闪烁 */
  appearance: menulist-button;
  caret-color: #111;
}

.dark .custom_auth_form input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px #273340 inset !important;
  -webkit-text-fill-color: #fff !important;
  transition: background-color 9999s ease-in-out 0s; /* 防止背景闪烁 */
  appearance: menulist-button;
  caret-color: #fff;
}
</style>
