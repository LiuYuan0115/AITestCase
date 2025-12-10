<template>
  <div
    class="fixed inset-0 flex items-center justify-center z-[999] animate-[fadeIn_0.2s_ease-out]"
  >
    <!-- 弹窗内容 -->
    <div
      class="w-[768px] h-[584px] p-5 relative animate-[scaleIn_0.2s_ease-out] border border-s-border-secondary dark:border-s-border-secondary-dark rounded-[24px] flex flex-col items-center justify-center"
    >
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

      <div v-else>
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
          <form @submit.prevent="handleSubmit" class="w-full">
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
                }"
                required
                @focus="isPasswordFocused = true"
                @blur="isPasswordFocused = false"
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
      </div>
    </div>
  </div>

  <!-- 验证码覆盖层 -->
  <VerificationCodePanel
    ref="verificationCodePanelRef"
    :email="email"
    @verify-code="handleVerificationCode"
  />

  <!-- 新增独立的Toast提示组件 -->
  <Transition name="toast-fade">
    <div
      v-if="toastVisible"
      class="fixed top-5 left-1/2 w-80 transform -translate-x-1/2 p-2.5 px-5 rounded-lg text-sm font-medium shadow-lg z-[1000] transition-all duration-300"
      :class="[
        messageType === 'error'
          ? 'bg-s-function-erro/10 dark:bg-s-function-erro-dark/10 text-s-function-erro dark:text-s-function-erro-dark border border-s-function-erro/20 dark:border-s-function-erro-dark/20'
          : 'bg-s-function-success/10 dark:bg-s-function-success-dark/10 text-s-function-success dark:text-s-function-success-dark border border-s-function-success/20 dark:border-s-function-success-dark/20',
      ]"
    >
      {{ message }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { getTrpc } from '~/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'
import { Vue3Lottie } from 'vue3-lottie'
import loadingAnimation from '@/assets/animations/loading-ring.json'
import loadingAnimationDark from '@/assets/animations/loading-ring-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import SvgIcon from '@/components/common/SvgIcon.vue'
import VerificationCodePanel from './VerificationCodePanel.vue'
import { AuthState } from '../../sidepanel/types/auth'

// 状态变量
const email = ref('')
const password = ref('')
const isLoginLoading = ref(false)
const isNextLoading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const toastVisible = ref(false)
const isRegisterMode = ref(false)
const isFocused = ref(false)
const isPasswordFocused = ref(false)
const loginMethod = ref<'password' | 'link' | 'code' | '' | null | undefined>(
  ''
)
const verificationCodePanelRef = ref()
const emailError = ref('')
const passwordError = ref('')

const { isDark } = useDarkMode()

// 注入 auth 状态
const auth = inject<AuthState>('auth')

// 处理关闭弹窗
const handleClose = () => {
  resetFormState()
  // 不再需要 emit 事件，直接调用 auth 方法
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

  if (verificationCodePanelRef.value) {
    verificationCodePanelRef.value.hide()
  }
}

// 显示消息
const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
  message.value = text
  messageType.value = type
  toastVisible.value = true

  setTimeout(() => {
    toastVisible.value = false
  }, 3000)
}

const loginSuccess = () => {
  // 调用 auth 的 handleLoginSuccess 方法，与 authModal 保持一致
  if (auth) {
    auth.handleLoginSuccess()
  }
  handleClose()
}

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

const handleSubmit = async () => {
  trackEvent.track('Plugin_Sidebar_EmailLogin_Click', {
    from: 'options',
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

  await handleVerifyLoginMethod()
}

// 验证邮箱登录方式
const handleVerifyLoginMethod = async () => {
  isNextLoading.value = true
  try {
    const result = await getTrpc().verifyLoginMethod.mutate(email.value)
    loginMethod.value = result
    console.log('验证邮箱登录方式结果:', result)

    if (result === 'code') {
      await handleEmailCodeLogin()
    }

    if (result === 'password') {
      await handleEmailLogin()
    }

    // if (result === 'link') {
    //   showMessage(
    //     `Login link has been sent to ${email.value}. Please check your inbox.`,
    //     'success'
    //   )
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

// 邮箱链接登录
// const handleEmailLinkLogin = async () => {
//   trackEvent.track('Plugin_options_authModal_email_link_login')
//   isLoginLoading.value = true
//   try {
//     const result = await getTrpc().loginWithEmailLink.mutate(email.value)
//     loginSuccess()
//     trackEvent.track('Plugin_options_authModal_email_link_login_success')
//   } catch (error: any) {
//     trackEvent.track('Plugin_options_authModal_email_link_login_error')
//   } finally {
//     isLoginLoading.value = false
//   }
// }

// 邮箱验证码登录
const handleEmailCodeLogin = async () => {
  // 开启邮箱验证码登录的流程
  // 跳转到验证码页面
  if (email.value && verificationCodePanelRef.value) {
    await verificationCodePanelRef.value.show()
    trackEvent.track('Plugin_Sidebar_CheckEmail_Show',{
      from: 'options',
    })
  }
}

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
  } finally {
    isLoginLoading.value = false
  }
}

// 第三方登录
const handleProviderLogin = async (provider: string) => {
  trackEvent.track('Plugin_options_authModal_provider_login', {
    provider,
  })

  isLoginLoading.value = true
  try {
    const result = await getTrpc().loginWithProvider.mutate({
      provider,
    })

    loginSuccess()
    trackEvent.track('Plugin_options_authModal_provider_login_success', {
      provider,
    })
  } catch (error: any) {
    trackEvent.track('Plugin_options_authModal_provider_login_error', {
      provider,
    })
  } finally {
    isLoginLoading.value = false
  }
}

const handleVerificationCode = async (code: string) => {
  trackEvent.track('Plugin_options_verification_login', {
    email: email.value,
  })

  // 设置验证码组件为验证中状态
  if (verificationCodePanelRef.value) {
    verificationCodePanelRef.value.setVerifying(true)
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
    if (verificationCodePanelRef.value) {
      verificationCodePanelRef.value.hide()
    }

    // 埋点：验证码验证成功
    trackEvent.track('Plugin_Sidebar_CheckEmail_Verified', {
      form: 'options'
    })

    trackEvent.track('Plugin_options_verification_login_success', {
      email: email.value,
    })
  } catch (error: any) {
    console.error('验证码登录失败:', error)
    trackEvent.track('Plugin_options_verification_login_error', {
      email: email.value,
    })

    // 设置验证码组件显示错误（验证码组件已有底部错误提示，不需要顶部弹窗）
    if (verificationCodePanelRef.value) {
      verificationCodePanelRef.value.setError(true)
    }
  } finally {
    // 结束验证状态
    if (verificationCodePanelRef.value) {
      verificationCodePanelRef.value.setVerifying(false)
    }
  }
}

// 组件挂载时初始化登录服务
onMounted(async () => {
  await getTrpc().initLoginService.mutate()
  trackEvent.track('Plugin_options_authModal_mounted')
})
</script>

<style scoped>
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

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
