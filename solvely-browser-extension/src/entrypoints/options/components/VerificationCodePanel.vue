<template>
  <div v-show="isVisible"
    class="fixed inset-0 flex flex-col items-center justify-center z-[999] bg-[#FFFFFFCC] dark:bg-[#1B212DCC] backdrop-blur-[20px] animate-[fadeIn_0.2s_ease-out]">
    <!-- 弹窗内容 -->
    <div
      class="w-[768px] h-[584px] p-5 relative animate-[scaleIn_0.2s_ease-out] border border-s-border-secondary dark:border-s-border-secondary-dark rounded-[12px] flex flex-col items-center justify-center">
      <!-- 关闭按钮 -->
      <button @click="handleClose"
        class="absolute top-4 right-4 p-1 rounded-full border-none bg-transparent cursor-pointer text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark hover:bg-s-hover-on-white dark:hover:bg-s-hover-on-white-dark transition-colors duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="flex-[0.4]"></div>
      <div class="text-center relative animate-[scaleIn_0.2s_ease-out] flex flex-col items-center">

        <!-- 邮箱图标 -->
        <div class="mb-7">
          <img src="@/assets/images/login/login-email.webp" alt="email"
            class="w-[99px] h-[87px] object-contain mx-auto" />
        </div>

        <!-- 标题 -->
        <h2
          class="text-[24px] h-[29px] font-bold text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-3 leading-normal transition-colors duration-200">
          Check your email
        </h2>

        <!-- 说明文字 -->
        <p
          class="text-[16px] h-[22px] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark leading-[1.5] transition-colors duration-200">
          Enter the 4-digit code sent to
        </p>

        <!-- 邮箱地址 -->
        <p
          class="text-[16px] h-[22px] mt-[2px] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark mb-8 leading-[1.5] font-medium transition-colors duration-200">
          {{ email || 'abc@gmail.com' }}
        </p>

        <!-- 验证码输入框 -->
        <div class=" custom_input_otp w-fit">
          <InputOtp v-model="verificationCode" :length="4" :integerOnly="true"
            :class="{ error_code_verification: showError }" />
        </div>

        <!-- 验证中状态 -->
        <div v-if="isVerifying" class="flex items-center justify-center gap-2 mt-3">
          <SvgIcon name="login/verify-loading" size="16" class="animate-spin" />
          <span class="text-[14px] font-normal text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark">
            Verifying the code...
          </span>
        </div>

        <!-- 错误提示 -->
        <div v-else-if="showError"
          class="text-[14px] font-normal text-s-function-erro dark:text-s-function-erro-dark mt-3">
          Incorrect verification code
        </div>

        <!-- 重新发送 -->
        <div class="flex flex-col items-center justify-center gap-[2px] flex-wrap mt-8">
          <span
            class="text-[16px] h-[24px] leading-[1.5] font-[400] font-[Inter] text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark transition-colors duration-200">
            Didn't get the code? Check your spam folder.
          </span>
          <button @click="handleResend" :disabled="!canResend"
            class="text-[16px] h-[24px] leading-[1.5] font-[400] font-[Inter] bg-none border-none text-s-text-brand dark:text-s-text-brand-dark cursor-pointer hover:underline transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-s-text-low-emphasis dark:disabled:text-s-text-low-emphasis-dark disabled:hover:no-underline">
            {{ resendButtonText }}
          </button>
        </div>
      </div>
      <div class="flex-[0.6]"></div>
    </div>

  </div>

  <!-- Toast提示组件 -->
  <Transition name="toast-fade">
    <div v-if="toastVisible"
      class="fixed top-5 left-1/2 w-80 transform -translate-x-1/2 p-2.5 px-5 rounded-lg text-sm font-medium shadow-lg z-[1000] transition-all duration-300"
      :class="[
        messageType === 'error'
          ? 'bg-s-function-erro/10 dark:bg-s-function-erro-dark/10 text-s-function-erro dark:text-s-function-erro-dark border border-s-function-erro/20 dark:border-s-function-erro-dark/20'
          : 'bg-s-function-success/10 dark:bg-s-function-success-dark/10 text-s-function-success dark:text-s-function-success-dark border border-s-function-success/20 dark:border-s-function-success-dark/20',
      ]">
      {{ message }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch, nextTick } from 'vue'
import InputOtp from 'primevue/inputotp'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { getTrpc } from '~/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'
import { debounce } from 'lodash-es'

// Props
interface Props {
  email?: string
}

const props = withDefaults(defineProps<Props>(), {
  email: '',
})

// Emits
const emit = defineEmits(['close', 'verify-code'])

// 响应式数据
const isVisible = ref(false) // 控制组件显示隐藏
const verificationCode = ref('')
const resendCooldown = ref(0)
const canResend = ref(true)
// 移除 hasSentCode，完全依赖计时器状态
const showError = ref(false) // 是否显示错误提示
const isVerifying = ref(false) // 是否正在验证中
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const toastVisible = ref(false)

let resendTimer: NodeJS.Timeout | null = null
let cooldownEndTime = 0 // 倒计时结束的时间戳

// 方法
const handleClose = () => {
  isVisible.value = false
  resetInputState() // 只重置输入状态，不清除计时器
  emit('close')
}

// 重发验证码的实际逻辑
const handleResendLogic = async () => {
  if (!canResend.value || !props.email) return

  try {
    // 调用发送验证码的 API
    console.log('重发验证码到:', props.email)
    // 埋点：重新发送邮件
    trackEvent.track('Plugin_Sidebar_CheckEmail_Resend', {
      form: 'options'
    })


    // 重新开始倒计时
    startResendCooldown()

    getTrpc().sendVerificationCode.mutate(props.email)


    // 显示成功提示
    showMessage('Verification code resent successfully', 'success')
    console.log('验证码重发成功')
  } catch (error) {
    console.error('重发验证码失败:', error)
    showMessage('Network error, please try again later.', 'error')
  }
}

// 使用防抖包装重发逻辑，500ms内只执行一次
const handleResend = debounce(handleResendLogic, 500)

// 显示验证码组件并发送验证码
const show = async () => {
  isVisible.value = true
  resetInputState() // 重置输入状态但保留计时器

  // 如果可以发送验证码（不在计时中），则发送
  if (canResend.value && props.email) {
    console.log('发送验证码到:', props.email)
    await sendVerificationCode()
  }

  // 自动聚焦到验证码输入框的第一位
  nextTick(() => {
    const firstInput = document.querySelector(
      '.custom_input_otp .p-inputotp-input'
    )
    if (firstInput) {
      ; (firstInput as HTMLInputElement).focus()
    }
  })
}

// 隐藏验证码组件（完全重置状态）
const hide = () => {
  isVisible.value = false
  resetState() // 只有LoginPanel关闭时才完全重置
}

// 发送验证码
const sendVerificationCode = async () => {
  if (!props.email) return

  try {
    console.log('发送验证码到:', props.email)

    startResendCooldown()

    // 调用真实的发送验证码接口
    await getTrpc().sendVerificationCode.mutate(props.email)

    console.log('验证码发送成功')
  } catch (error) {
    console.error('发送验证码失败:', error)
    showMessage('Network error, please try again later.', 'error')
  }
}

// 开始重发倒计时
const startResendCooldown = () => {
  const cooldownDuration = 60 // 60秒
  cooldownEndTime = Date.now() + cooldownDuration * 1000
  canResend.value = false

  // 立即更新一次显示
  updateCooldownDisplay()

  // 启动定时器，每秒更新显示
  resendTimer = setInterval(updateCooldownDisplay, 1000)
}

// 更新倒计时显示
const updateCooldownDisplay = () => {
  const now = Date.now()
  const remainingTime = Math.max(0, Math.ceil((cooldownEndTime - now) / 1000))

  resendCooldown.value = remainingTime

  if (remainingTime <= 0) {
    canResend.value = true
    clearResendTimer()
  }
}

// 清理倒计时定时器
const clearResendTimer = () => {
  if (resendTimer) {
    clearInterval(resendTimer)
    resendTimer = null
  }
  cooldownEndTime = 0
  resendCooldown.value = 0
  canResend.value = true
}

// 重置输入状态（不清除计时器）
const resetInputState = () => {
  verificationCode.value = ''
  showError.value = false
  isVerifying.value = false
  toastVisible.value = false
}

// 完全重置状态（包括计时器）
const resetState = () => {
  isVisible.value = false
  verificationCode.value = ''
  showError.value = false
  isVerifying.value = false
  toastVisible.value = false
  clearResendTimer()
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

// 验证验证码
const verifyCode = async (code: string) => {
  if (code.length !== 4) return

  // 隐藏之前的错误提示
  showError.value = false

  // 立即触发验证事件，让父组件处理实际的API调用
  emit('verify-code', code)
}

// 监听验证码输入
watch(verificationCode, (newCode) => {
  if (newCode.length === 4) {
    verifyCode(newCode)
  }
})

// 验证状态控制方法
const setVerifying = (verifying: boolean) => {
  isVerifying.value = verifying
}

const setError = (error: boolean) => {
  showError.value = error
  if (error) {
    verificationCode.value = '' // 清空验证码
  }
}

// 暴露方法给父组件
defineExpose({
  show,
  hide,
  setVerifying,
  setError,
})

// 计算属性
const resendButtonText = computed(() => {
  if (resendCooldown.value > 0) {
    return `Resend (${resendCooldown.value}s)`
  }
  return 'Resend'
})

// 组件挂载时自动显示
// 组件卸载时清理定时器和防抖
onUnmounted(() => {
  clearResendTimer()
  handleResend.cancel() // 取消防抖
})
</script>

<style scoped>
/* 动画定义 */
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

/* InputOtp 自定义样式 */
:deep(.custom_input_otp .p-inputotp-input) {
  @apply w-10 h-[50px] border rounded-lg text-center text-xl font-semibold text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark bg-white dark:bg-[#1B212D] focus:outline-none border-s-text-brand dark:border-s-text-brand-dark focus:border-s-text-brand dark:focus:border-s-text-brand-dark hover:border-s-text-brand dark:hover:border-s-text-brand-dark;
  caret-color: rgb(0, 122, 255);
  caret-shape: block;
}

:deep(.custom_input_otp .p-inputotp-input:focus) {
  caret-color: rgb(0, 122, 255);
  caret-shape: block;
}

:deep(.custom_input_otp .error_code_verification .p-inputotp-input) {
  @apply border-s-function-erro dark:border-s-function-erro-dark;
}

/* Toast动画 */
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
