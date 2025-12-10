// src/composables/content/useToast.ts 提示

import { ref } from 'vue'

// ================= Toast 控制逻辑 =================
type ToastType = 'error' | 'success' | 'warning' | 'info'


/**
 * 提示组合式函数
 */
export const useToast = () => {
  const toast = ref('')
  const toastType = ref<ToastType>('info')
  let timeoutId: NodeJS.Timeout | null = null

  const sendToast = (message: string, type: ToastType = 'error') => {
    toast.value = message
    toastType.value = type
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      toast.value = ''
      toastType.value = 'info'
    }, 3000)
  }

  const hideToast = () => {
    toast.value = ''
    toastType.value = 'info'
    if (timeoutId) clearTimeout(timeoutId)
  }

  return {
    toast,
    toastType,
    sendToast,
    hideToast,
  }
}