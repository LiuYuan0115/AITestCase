// src/services/modal/closeModalService.ts
import { reactive, shallowRef } from 'vue'
import type { RadioOption as CloseModalRadioOption } from '@/components/common/CloseModal.vue' // 引入类型定义
import trackEvent from '~/utils/trackEvent'

interface CloseModalService {
  show: boolean
  title: string
  content: string
  // 使用 shallowRef 存储回调函数，避免 Vue 响应式系统对其进行深度代理
  // 深度代理函数可能会导致不必要的问题或性能开销
  onConfirm?: ((value: string) => void) | null
  onCancel?: (() => void) | null
  onClose?: (() => void) | null
  // 自定义选项配置
  customOptions?: CloseModalRadioOption[]
}

// 创建一个响应式对象来存储模态框的状态
const state = reactive<CloseModalService>({
  show: false,
  title: '',
  content: '',
  onConfirm: null,
  onCancel: null,
  onClose: null,
  customOptions: undefined,
})

/**
 * 显示模态框
 * @param options 模态框的配置选项
 */
function showModal(options: {
  title?: string
  content?: string
  onConfirm?: (value: string) => void
  onCancel?: () => void
  onClose?: () => void
  customOptions?: CloseModalRadioOption[]
}) {
  // 如果模态框已经显示，则直接返回，避免重复打开
  if (state.show) {
    return;
  }
  state.title = options.title || ''
  state.content = options.content || ''
  state.customOptions = options.customOptions
  // 使用 shallowRef 包裹回调函数
  state.onConfirm = options.onConfirm
    ? shallowRef(options.onConfirm).value
    : null
  state.onCancel = options.onCancel ? shallowRef(options.onCancel).value : null
  state.onClose = options.onClose ? shallowRef(options.onClose).value : null
  state.show = true // 设置 show 为 true 以显示模态框
}

/**
 * 关闭模态框
 */
function closeModal() {
  state.show = false
  // 隐藏后清理状态和回调，防止内存泄漏和干扰下一次显示
  state.title = ''
  state.content = ''
  state.customOptions = undefined
  state.onConfirm = null
  state.onCancel = null
  state.onClose = null
  trackEvent.track('Plugin_Disable_close')
}

// 导出状态和方法
export const modalService = {
  state,
  showModal,
  closeModal,
}
