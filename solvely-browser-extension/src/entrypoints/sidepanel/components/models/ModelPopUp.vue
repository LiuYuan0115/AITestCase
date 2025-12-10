<template>
  <div class="relative w-fit" ref="popupRef">
    <!-- 按钮 -->
    <div
      :class="buttonClass"
      @click="togglePopUp"
    >
      <SvgIcon name="models/check" size="16" />
      <span class="text-[12px] font-normal leading-[16px] ml-[4px] mr-[8px]"
        >Verified by</span
      >
      <div
        class="flex items-center gap-[2px] text-[#111] dark:text-[#DCDFE6] transition-all duration-200"
      >
        <template v-for="value in models" :key="value.name">
          <SvgIcon v-if="value.icon" :name="value.icon" size="20" />
          <img v-else :src="getCurrentIconUrl(value)" :alt="value.name" class="w-5 h-5" />
        </template>
      </div>
      <SvgIcon name="models/arrow" size="16" :class="arrowClass" />
    </div>
    <!-- 浮窗 -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-[-8px]"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-[-8px]"
    >
    
      <div
        v-show="isOpen"
        class="absolute top-[34px] w-[312px] left-0 bg-[#fff] dark:bg-[#222A38] rounded-[12px] flex flex-col justify-start z-[9999] p-4 shadow-[0_0_24px_0_rgba(0,0,0,0.16)] transition-all duration-200"
      >
        <div
        class="text-[16px] font-[700] leading-[130%] text-[#111111] dark:text-[#ffffff] mb-1 transition-all duration-200"
      >
        Answer confidence
      </div>
      <div class="flex items-center justify-between mb-4">
        <div
          class="text-[12px] font-[400] leading-[130%] text-[#595C60] dark:text-[#D1D3D5] transition-all duration-200"
        >
          Cross-model verification 3/3
        </div>
        <div
          class="w-[91px] h-[26px] bg-[#F5FEF5] dark:bg-[#313D42] py-2 px-[10px] flex gap-1 items-center rounded-full transition-all duration-200"
        >
          <i
            v-for="i in 3"
            :key="i"
            class="block w-[10px] h-[4px] bg-[#40C700] rounded-full"
          ></i>
          <div
            class="text-[10px] font-[600] leading-[10px] text-[#40C700] ml-1"
          >
            high
          </div>
        </div>
      </div>
      <!-- 模型列表 -->
      <div
        class="bg-[#F6F8FA] dark:bg-[#1B212D] p-3 flex flex-col gap-4 rounded-[16px] transition-all duration-200"
      >
        <div
          v-for="model in models"
          :key="model.name"
          class="h-6 flex items-center"
        >
          <div class="text-[#111] dark:text-[#DCDFE6] transition-all duration-200">
            <SvgIcon v-if="model.icon" :name="model.icon" size="24" />
            <img v-else :src="getCurrentIconUrl(model)" :alt="model.name" class="w-6 h-6" />
          </div>
          <span
            class="text-[14px] font-[500] leading-[140%] text-[#111] dark:text-[#DCDFE6] ml-2 transition-all duration-200"
            >{{ model.totalName }}</span
          >
          <div class="flex-1"></div>
          <SvgIcon name="models/check" size="16" />
        </div>
      </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getConfigValue } from '@/utils/config'
import { useDarkMode } from '@/composables/useDarkMode'
import trackEvent from '@/utils/trackEvent'

// 默认模型配置（兜底）
const defaultModels = [
  {
    name: 'GPT-5',
    totalName: 'OpenAI GPT-5',
    icon: 'models/gpt',
    url: '',
    'url-dark': '',
  },
  {
    name: 'Claude 4.1 Sonnet',
    totalName: 'Anthropic Claude 4.1 Sonnet',
    icon: 'models/claude',
    url: '',
    'url-dark': '',
  },
  {
    name: 'Gemini 2.5 Flash',
    totalName: 'Google Gemini 2.5 Flash',
    icon: 'models/gemini',
    url: '',
    'url-dark': '',
  },
]

const models = ref([...defaultModels])

// 暗色主题状态
const { isDark } = useDarkMode()

// 状态管理
const isOpen = ref(false)
const popupRef = ref<HTMLElement | null>(null)

// 按钮样式动态绑定
const buttonClass = computed(() => {
  return [
    'flex py-[5px] pl-[12px] pr-[6px] items-center text-[#111111] dark:text-[#DCDFE6] w-fit rounded-full cursor-pointer transition-all duration-200',
    isOpen.value 
      ? 'bg-[#ECF5FF] dark:bg-[#324B68]' // 展开时保持hover颜色
      : 'bg-[#F3F4F9] dark:bg-[#374052] hover:bg-[#ECF5FF] dark:hover:bg-[#324B68]'
  ]
})

// 箭头旋转样式
const arrowClass = computed(() => {
  return [
    'transition-transform duration-200',
    isOpen.value ? 'rotate-90' : 'rotate-0'
  ]
})

// 切换浮窗显示状态
const togglePopUp = () => {
  // 添加点击事件追踪
  trackEvent.track('Plugin_Sidebar_MutipleModel_Click')
  
  isOpen.value = !isOpen.value
}

// 关闭浮窗
const closePopUp = () => {
  isOpen.value = false
}

// 手动实现点击外部检测
const handleClickOutside = (event: MouseEvent) => {
  if (popupRef.value && !popupRef.value.contains(event.target as Node)) {
    closePopUp()
  }
}

// 键盘事件处理（ESC键关闭）
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    closePopUp()
  }
}

// 获取当前主题对应的图标 URL
const getCurrentIconUrl = (configModal: any) => {
  if (isDark.value && configModal['url-dark']) {
    return configModal['url-dark']
  }
  return configModal.url || ''
}

// 加载模型配置
const loadModelsConfig = async () => {
  try {
    const configModals = await getConfigValue('features.modals', [])
    
    if (configModals && configModals.length > 0) {
      // 使用云端配置，优先使用 icon 字段
      models.value = configModals.map((configModal: any) => ({
        name: configModal.name || '',
        totalName: configModal.totalName || '',
        icon: configModal.icon || '', // 优先使用 icon 字段
        url: configModal.url || '',
        'url-dark': configModal['url-dark'] || '',
      }))
    } else {
      // 使用默认配置
      models.value = [...defaultModels]
    }
  } catch (error) {
    console.error('Failed to load models config:', error)
    // 出错时使用默认配置
    models.value = [...defaultModels]
  }
}

// 监听暗色主题变化
watch(isDark, () => {
  loadModelsConfig()
})

// 生命周期钩子
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
  
  // 加载模型配置
  loadModelsConfig()
  
  // 组件出现时上报Show事件
  trackEvent.track('Plugin_Sidebar_MutipleModel_Show')
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
