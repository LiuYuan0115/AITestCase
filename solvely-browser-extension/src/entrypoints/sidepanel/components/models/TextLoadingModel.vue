<template>
  <TextFlowing>
    <template v-if="isInit">
      <div
        class="flex items-center leading-[20px] text-[14px] text-[#595C60] dark:text-[#D1D3D5]"
      >
        Understanding your question
      </div>
    </template>
    <template v-else>
      <div
        class="flex items-center leading-[20px] text-[14px] text-[#595C60] dark:text-[#D1D3D5]"
      >
        Cross-checking with
        <div class="overflow-hidden h-[20px] relative min-w-[144px] ml-1">
          <div
            ref="scrollContainer"
            class="flex flex-col absolute top-0 left-0 transition-transform duration-500"
            :style="{ transform: `translateY(${translateY}px)` }"
          >
            <div
              v-for="(item, i) in doubleBufferModels"
              :key="`${item.name}-${i}`"
              class="flex gap-[3px] items-center"
            >
              <div class="text-[#111111] dark:text-[#FFFFFF]">
                <SvgIcon v-if="item.icon" :name="item.icon" size="18" />
                <img v-else :src="getCurrentIconUrl(item)" :alt="item.name" class="w-[18px] h-[18px]" />
              </div>
              <span class="leading-[20px] text-[14px]">{{ item.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </TextFlowing>
</template>
<script setup lang="ts">
import TextFlowing from './TextFlowing.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getConfigValue } from '@/utils/config'
import { useDarkMode } from '@/composables/useDarkMode'

const isInit = ref(true)
const scrollContainer = ref<HTMLElement>()
const translateY = ref(0)
const currentIndex = ref(0)
const carouselTimer = ref<NodeJS.Timeout>()

const intervalTime = 3000 // 总间隔：400ms过渡 + 2700ms停留
const animationTime = 400 // 过渡时间：400ms
const initDelay = 3000 // 初始化延迟：400ms

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

// 双缓冲数据：原始内容 + 缓冲区内容
const doubleBufferModels = computed(() => [...models.value, ...models.value])

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
    
    // 更新总项目数
    totalItems.value = models.value.length
  } catch (error) {
    console.error('Failed to load models config:', error)
    // 出错时使用默认配置
    models.value = [...defaultModels]
    totalItems.value = models.value.length
  }
}

// 常量
const itemHeight = 20 // 每个项目的高度
const totalItems = ref(models.value.length)

// 重置位置函数
const resetPosition = () => {
  if (!scrollContainer.value) return

  // 临时禁用过渡动画
  scrollContainer.value.style.transition = 'none'

  // 瞬间重置位置
  translateY.value = 0
  currentIndex.value = 0

  // 使用双重 requestAnimationFrame 确保渲染完成后再恢复动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (scrollContainer.value) {
        scrollContainer.value.style.transition = `transform ${animationTime}ms ease`
      }
    })
  })
}

// 动画到下一个项目
const animateToNext = () => {
  return new Promise<void>((resolve) => {
    currentIndex.value++
    translateY.value = -currentIndex.value * itemHeight

    // 检查是否需要重置
    if (currentIndex.value >= totalItems.value) {
      setTimeout(() => {
        resetPosition()
        resolve()
      }, animationTime)
    } else {
      setTimeout(resolve, animationTime)
    }
  })
}

// 启动轮播
const startCarousel = () => {
  carouselTimer.value = setInterval(async () => {
    await animateToNext()
  }, intervalTime) // 每3.1秒切换一次（400ms过渡 + 2700ms停留）
}

// 停止轮播
const stopCarousel = () => {
  if (carouselTimer.value) {
    clearInterval(carouselTimer.value)
    carouselTimer.value = undefined
  }
}

// 监听暗色主题变化
watch(isDark, () => {
  loadModelsConfig()
})

// 组件挂载
onMounted(async () => {
  // 加载模型配置
  loadModelsConfig()
  
  // 初始化延迟
  setTimeout(() => {
    isInit.value = false
  }, initDelay)
  setTimeout(() => {
    startCarousel()
  }, 1100)
})

// 组件卸载
onUnmounted(() => {
  stopCarousel()
})
</script>

<style scoped></style>
