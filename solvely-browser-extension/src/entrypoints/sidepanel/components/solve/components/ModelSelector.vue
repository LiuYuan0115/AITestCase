<template>
  <div
    class="relative inline-block -ml-[6px]"
    ref="popupRef"
  >
    <!-- Selector 入口按钮 -->
    <button
      @click.stop="toggleDropdown"
      @mousedown.stop
      @mouseenter="handleButtonHover"
      @mouseleave="handleButtonLeave"
      class="relative flex items-center gap-[4px] px-[6px] rounded-[14px] text-t_2 dark:text-t_2_dk hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk color-transition cursor-pointer"
      :class="{ 'bg-b_blue99 dark:bg-b_blue99_dk': isOpen, 'bg-b_2 dark:bg-b_2_dk': showGuideDot, 'h-[26px]': isSidePanelSupported(), 'h-[32px]': !isSidePanelSupported() }"
    >
      <span
        class="relative inline-block overflow-hidden mb-[1px]"
        :class="isSidePanelSupported() ? 'w-[18px] h-[18px]' : 'w-[26px] h-[26px]'"
      >
        <TransitionGroup
          name="icon-fade"
          tag="span"
          class="relative block w-full h-full"
        >
          <SvgIcon
            v-if="getModelIcon(props.modelValue)"
            :key="getModelIcon(props.modelValue)"
            :name="getModelIcon(props.modelValue)"
            :size="isSidePanelSupported() ? 18 : 26"
            class="absolute inset-0"
          />
        </TransitionGroup>
      </span>
      <span
        class="text-[12px] font-medium"
        v-if="isSidePanelSupported()"
      >
        {{ getButtonDisplayName(props.modelValue) }}
      </span>

      <!-- 下拉箭头 -->
      <SvgIcon
        name="arrow-down4"
        :size="isSidePanelSupported()?12:16"
        :class="{ 'rotate-180': isOpen }"
        class="transition-transform duration-200"
      />

      <!-- 引导红点 -->
      <Transition
        enter-active-class="transition-all duration-200"
        leave-active-class="transition-all duration-200"
        enter-from-class="opacity-0 scale-0"
        enter-to-class="opacity-100 scale-100"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-0"
      >
        <span
          v-if="showGuideDot"
          class="absolute -top-[3px] -right-[3px] w-[10px] h-[10px] bg-[#F0594F] rounded-full border-2 border-b_1 dark:border-b_1_dk"
        />
      </Transition>
    </button>

    <!-- 下拉菜单 -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      :enter-from-class="
        dropdownPosition === 'bottom' ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-0 scale-95 translate-y-2'
      "
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      :leave-to-class="
        dropdownPosition === 'bottom' ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-0 scale-95 translate-y-2'
      "
    >
      <div
        v-show="isOpen"
        @mousedown.stop
        @click.stop
        :class="[
          'absolute left-0 min-w-[256px] bg-b_card dark:bg-b_card_dk rounded-[16px] shadow-[0_0_24px_rgba(0,0,0,0.16)] dark:shadow-[0_0_24px_rgba(0,0,0,0.5)] p-[12px] z-[1000]',
          dropdownPosition === 'bottom' ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]',
        ]"
      >
        <!-- 模型列表（V2：平铺结构，按分组渲染） -->
        <div class="flex flex-col gap-[2px]">
          <div
            v-for="group in groupedModels"
            :key="group.name"
            class="flex flex-col"
          >
            <!-- 分组标题 -->
            <div class="p-[8px_8px_4px_8px] text-[12px] leading-[130%] font-[500] text-t_3 dark:text-t_3_dk mb-[2px]">
              {{ group.name }}
            </div>

            <!-- 模型项列表 -->
            <div class="flex flex-col gap-[2px]">
              <button
                v-for="model in group.models"
                :key="model.id"
                @click="handleSelectModel(model)"
                :class="[
                  'flex items-center gap-[8px] p-[8px] rounded-[8px] transition-colors duration-150 text-left cursor-pointer',
                  model.id === props.modelValue
                    ? 'bg-b_blue99 dark:bg-b_blue99_dk'
                    : 'hover:bg-b_1_hov dark:hover:bg-b_1_hov_dk',
                ]"
              >
                <SvgIcon
                  :name="getModelIcon(model.id)"
                  size="20"
                  class="flex-shrink-0"
                />
                <div class="flex flex-col items-start gap-[2px] flex-1">
                  <span
                    class="flex h-[20px] items-center gap-[4px] text-[14px] leading-[140%] font-medium text-t_1 dark:text-t_1_dk"
                  >
                    {{ model.name }}
                    <IconPro v-if="!useSubscription.isSubscribed.value && model.isPro" />
                  </span>
                  <span class="text-[12px] font-normal leading-[130%] text-t_2 dark:text-t_2_dk whitespace-nowrap">
                    {{ model.description }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 引导弹层 -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-2"
    >
      <div
        v-if="showGuidePopup"
        ref="guidePopupRef"
        @mouseenter="handleGuidePopupHover"
        @mouseleave="handleGuidePopupLeave"
        class="absolute -left-[11px] bottom-[36px] w-[337px] p-[16px] flex flex-col gap-[8px] bg-b_brand dark:bg-b_brand_dk rounded-[12px] shadow-[0_0_24px_rgba(0,0,0,0.16)] z-[1002]"
      >
        <!-- 标题 -->
        <h3 class="flex items-center gap-[6px] text-white text-[16px] font-bold leading-[130%] m-0">
          <SvgIcon
            name="star2"
            size="16"
          />
          Switch models in one click
        </h3>

        <!-- 描述 -->
        <p class="text-white text-[14px] font-normal leading-[140%] m-0">
          Stack answers from GPT-5, Gemini 2.5 Flash, and Claude 4.1 Sonnet—pick the clearest, most accurate one.
        </p>

        <!-- Got it 按钮 -->
        <div class="flex justify-end">
          <button
            @click="handleGotItClick"
            class="flex items-center justify-center w-[100px] h-[36px] px-[20px] py-[5px] mt-[4px] rounded-[100px] bg-b_btn_2 text-b_brand text-[14px] font-bold leading-[140%] hover:bg-b_1_hov transition-colors duration-200 cursor-pointer"
          >
            Got it
          </button>
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="8"
          viewBox="0 0 16 8"
          fill="none"
          class="absolute -bottom-[8px] left-[52px]"
        >
          <path
            d="M9.41421 6.58579C8.63316 7.36684 7.36683 7.36684 6.58579 6.58579L-6.99382e-07 1.39876e-06L16 0L9.41421 6.58579Z"
            fill="#007AFF"
          />
        </svg>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch, nextTick } from 'vue'
import { browser } from 'wxt/browser'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useModelConfig } from '../composables'
import type { ModelItemV2 } from '../composables/types'
import { STORAGE_KEY } from '@/config/storage'
import { useDarkMode } from '@/composables/useDarkMode'
import trackEvent from '@/utils/trackEvent'
import IconPro from '@/components/common/IconPro.vue'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'

const showOutLimit = inject<(show: boolean, from: string) => void>('showOutLimit')!

const { isDark } = useDarkMode()

// Props
interface Props {
  modelValue: string
  dropdownPosition?: 'bottom' | 'top'
  showTitle?: boolean
  titleText?: string
}

const props = withDefaults(defineProps<Props>(), {
  dropdownPosition: 'bottom',
  showTitle: true,
  titleText: '',
})

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', modelId: string): void
}>()

// Inject auth
const auth = inject<{
  isAuthenticated: { value: boolean }
  isLoggedIn?: { value: boolean }
  showLoginModal: () => void
}>('auth')

// 状态
const isOpen = ref(false)
const popupRef = ref<HTMLElement>()

// 引导红点相关状态
const showGuideDot = ref(false)
const showGuidePopup = ref(false)
const guidePopupRef = ref<HTMLElement>()
const guideHoverTimer = ref<number>()

// 使用 useModelConfig 获取配置（V2 版本）
const { flattenedModels, groupedModels, getModelById, getModelIcon, getModelName, getButtonDisplayName } =
  useModelConfig()

// 当前选中的模型
const selectedModel = computed(() => {
  return getModelById(props.modelValue) || flattenedModels.value[0]
})

// 标题文本
const displayTitle = computed(() => {
  return props.titleText || 'Select model'
})

// 切换下拉菜单
function toggleDropdown(event?: MouseEvent) {
  if (!auth?.isAuthenticated.value) {
    auth?.showLoginModal()
    return
  }

  // 如果有引导红点，点击时先标记已读
  if (showGuideDot.value) {
    markGuideAsShown()
  }

  const wasOpen = isOpen.value
  isOpen.value = !isOpen.value

  // 如果正在打开下拉菜单，使用 nextTick 确保 DOM 更新后再处理点击外部事件
  if (!wasOpen && isOpen.value) {
    nextTick(() => {
      // 延迟一帧，确保下拉菜单已渲染
      requestAnimationFrame(() => {
        // 此时下拉菜单应该已经渲染完成
      })
    })
  }

  trackEvent.track('Plugin_Sidebar_SwitchModel')
}

// 选择模型（V2：简化逻辑）
function handleSelectModel(model: ModelItemV2) {
  console.log('🎯 ModelSelector: 选择模型', model.id)
  if (!useSubscription.isSubscribed.value) {
    isOpen.value = false
    showOutLimit(true, 'model')
    return
  }
  emit('update:modelValue', model.id)
  isOpen.value = false

  trackEvent.track('Plugin_Sidebar_SwitchModel_Click', {
    Model: model.name,
  })
}

// 点击外部关闭下拉菜单
function handleClickOutside(event: MouseEvent) {
  // 如果下拉菜单未打开，直接返回
  if (!isOpen.value) {
    return
  }

  // 检查点击是否在 popupRef 内（包括按钮和下拉菜单）
  if (popupRef.value && popupRef.value.contains(event.target as Node)) {
    return
  }

  // 延迟关闭，确保点击事件已完全处理
  setTimeout(() => {
    if (isOpen.value) {
      isOpen.value = false
    }
  }, 0)
}

// ========== 引导红点相关函数 ==========

// 初始化引导红点显示状态
async function initGuideState() {
  try {
    console.log('[ModelSelector][Guide] init start', {
      isAuthenticated: auth?.isAuthenticated.value,
    })

    // 检查是否已登录
    if (!auth?.isAuthenticated.value) {
      console.log('[ModelSelector][Guide] skip: user not authenticated')
      showGuideDot.value = false
      return
    }

    if (!browser?.storage?.local) {
      console.warn('[ModelSelector][Guide] browser.storage.local unavailable')
      showGuideDot.value = false
      return
    }

    // 检查 storage 中是否已标记
    const result = await browser.storage.local.get(STORAGE_KEY.MODEL_SELECTOR_GUIDE_SHOWN)
    const hasShown = result[STORAGE_KEY.MODEL_SELECTOR_GUIDE_SHOWN]

    console.log('[ModelSelector][Guide] storage result', {
      hasShown,
      raw: result,
    })

    showGuideDot.value = !hasShown
    console.log('[ModelSelector][Guide] showGuideDot set to', showGuideDot.value)
  } catch (error) {
    console.error('Failed to init guide state:', error)
    showGuideDot.value = false
  }
}

// 标记引导为已显示
async function markGuideAsShown() {
  try {
    console.log('[ModelSelector][Guide] mark as shown')
    await browser.storage.local.set({
      [STORAGE_KEY.MODEL_SELECTOR_GUIDE_SHOWN]: true,
    })
    showGuideDot.value = false
    showGuidePopup.value = false
    console.log('[ModelSelector][Guide] mark complete')
  } catch (error) {
    console.error('Failed to mark guide as shown:', error)
  }
}

// 处理按钮 hover 进入
function handleButtonHover() {
  if (showGuideDot.value) {
    console.log('[ModelSelector][Guide] button hover: show popup')
    // 清除离开定时器
    if (guideHoverTimer.value) {
      clearTimeout(guideHoverTimer.value)
      guideHoverTimer.value = undefined
    }
    showGuidePopup.value = true
    trackEvent.track('Plugin_Tips_SwitchModel_Show')
  }
}

// 处理按钮 hover 离开
function handleButtonLeave() {
  if (showGuideDot.value) {
    // 延迟隐藏，给用户时间移到弹层上
    guideHoverTimer.value = setTimeout(() => {
      showGuidePopup.value = false
    }, 150) as any
  }
}

// 处理弹层 hover 进入
function handleGuidePopupHover() {
  // 清除离开定时器
  if (guideHoverTimer.value) {
    clearTimeout(guideHoverTimer.value)
    guideHoverTimer.value = undefined
  }
}

// 处理弹层 hover 离开
function handleGuidePopupLeave() {
  // 延迟隐藏
  guideHoverTimer.value = setTimeout(() => {
    showGuidePopup.value = false
  }, 150) as any
}

// 处理 Got it 按钮点击
function handleGotItClick(event: MouseEvent) {
  event.stopPropagation() // 阻止冒泡到 button
  console.log('[ModelSelector][Guide] Got it clicked')
  markGuideAsShown()
  trackEvent.track('Plugin_Tips_SwitchModel_Click')
}

// 监听登录状态变化，登录后重新检查
watch(
  () => auth?.isAuthenticated.value,
  (isAuthenticated) => {
    console.log('[ModelSelector][Guide] auth state changed', { isAuthenticated })
    if (isAuthenticated) {
      initGuideState()
    }
  }
)

// 监听 storage 变化，清空标记时重新显示红点
function handleStorageChange(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName !== 'local') return

  if (STORAGE_KEY.MODEL_SELECTOR_GUIDE_SHOWN in changes) {
    const change = changes[STORAGE_KEY.MODEL_SELECTOR_GUIDE_SHOWN]
    console.log('[ModelSelector][Guide] storage changed', change)
    if (!change.newValue) {
      showGuideDot.value = true
    }
  }
}

onMounted(() => {
  console.log('[ModelSelector][Guide] mounted')
  document.addEventListener('click', handleClickOutside)
  browser?.storage?.onChanged?.addListener(handleStorageChange)
  // 初始化引导状态
  initGuideState()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  browser?.storage?.onChanged?.removeListener(handleStorageChange)
  // 清理引导 hover 定时器
  if (guideHoverTimer.value) {
    clearTimeout(guideHoverTimer.value)
  }
})
</script>

<style scoped>
/* 确保下拉菜单在最上层 */
.z-\[1000\] {
  z-index: 1000;
}

/* Icon 交叉淡入淡出动画 */
.icon-fade-enter-active,
.icon-fade-leave-active {
  transition: opacity 150ms ease-in-out;
}

.icon-fade-enter-from {
  opacity: 0;
}

.icon-fade-leave-to {
  opacity: 0;
}

.icon-fade-enter-to,
.icon-fade-leave-from {
  opacity: 1;
}
</style>
