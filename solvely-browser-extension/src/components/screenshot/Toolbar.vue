<template>
  <div
    :class="[
      'absolute h-[36px] bg-b_card dark:bg-b_card_dk rounded-xl cursor-auto color-transition flex items-center justify-start p-[1px] shadow-[0_0_24px_0_rgba(0,0,0,0.12)] box-border border border-white dark:border-f_card_2_dk',
      ...positionClass,
      isSidePanelSupported() ? 'pl-[9px]' : '',
    ]"
    v-show="shouldShow"
    ref="actionsBar"
    @mousedown="(e) => e.stopPropagation()"
  >
    <SvgIcon
      name="logo"
      size="22"
      v-if="isSidePanelSupported()"
    />

    <!-- 模型选择器（仅在不支持侧边栏时显示） -->
    <div
      v-if="!isSidePanelSupported()"
      class="ml-[9px] mr-[3px] flex items-center justify-center"
    >
      <ModelSelector
        v-model="currentModel"
        :dropdown-position="dropdownPosition"
      />
    </div>

    <!-- Chat 输入框 -->
    <div
      v-show="canShowInput && props.isSolveLayer"
      class="w-[calc(100%-44px)] h-full bg-b_card dark:bg-b_card_dk absolute top-0 right-0 flex items-center rounded-tr-xl rounded-br-xl pr-3 gap-2 color-transition"
    >
      <input
        ref="inputRef"
        type="text"
        placeholder="Ask me any questions"
        class="w-full h-5 border-0 outline-none text-[14px] font-[400] leading-[140%] bg-transparent px-2 text-t_1 dark:text-t_1_dk placeholder:text-t_3 dark:placeholder:text-t_3_dk caret-b_brand color-transition"
        @keydown.enter="handleSend"
        @keydown.esc="canShowInput = false"
      />
      <div
        class="w-[20px] h-[20px] flex items-center justify-center bg-b_brand dark:bg-b_brand_dk hover:bg-b_brand dark:hover:bg-b_brand_dk rounded-full color-transition cursor-pointer shrink-0"
      >
        <SvgIcon
          name="textSelection/select-send"
          size="20"
          @click="handleSend"
        />
      </div>
      <i class="w-[1px] h-4 bg-d_1 dark:bg-d_1_dk ml-[2px] mr-[1px]"></i>
      <div
        class="w-[20px] h-[20px] flex items-center justify-center text-t_3 dark:text-t_3_dk hover:bg-b_btn_2 dark:hover:bg-b_btn_2_dk rounded-full color-transition cursor-pointer shrink-0"
      >
        <SvgIcon
          name="textSelection/layer-send-close"
          size="20"
          @click="handleClose"
        />
      </div>
    </div>

    <!-- 分割线 -->
    <div
      class="w-[2px] h-[20px] rounded-full bg-d_1 dark:bg-d_1_dk color-transition mr-[3px]"
      :class="isSidePanelSupported() ? 'ml-[9px]' : 'ml-[3px]'"
    ></div>

    <div class="flex items-center justify-start gap-1.5">
      <!-- 按钮列表 -->
      <button
        v-for="btn in actionButtons"
        :key="btn.key"
        type="button"
        :class="[
          'pl-1 pr-1.5 h-[28px] rounded-[6px] cursor-pointer flex items-center color-transition text-[14px] font-[400] hover:bg-b_card_hov dark:hover:bg-b_card_hov_dk',
          btn.textColor,
          btn.width,
        ]"
        @click="btn.handler"
      >
        <SvgIcon
          :name="btn.icon"
          :size="btn.iconSize"
          class="mr-0.5"
        />
        {{ btn.label }}
      </button>
    </div>

    <button
      type="button"
      class="w-[88px] h-[32px] rounded-[10px] font-[700] cursor-pointer text-[14px] ml-[6px] bg-b_brand dark:bg-b_brand_dk text-t_btn dark:text-t_btn_dk hover:bg-b_brand dark:hover:bg-b_brand_dk color-transition"
      @click="toSolve()"
    >
      Solve
    </button>
  </div>
</template>

<script lang="ts" setup>
import SvgIcon from '@/components/common/SvgIcon.vue'
import { ref, watch, computed, onMounted, provide } from 'vue'
import { isSidePanelSupported } from '@/utils/common'
import trackEvent from '@/utils/trackEvent'
import ModelSelector from '@/entrypoints/sidepanel/components/solve/components/ModelSelector.vue'
import { useModelConfig } from '@/entrypoints/sidepanel/components/solve/composables'
import { STORAGE_KEY } from '@/config/storage'
import { browser } from 'wxt/browser'
import useAuth from '@/entrypoints/sidepanel/composables/useAuth'
import usePaywall from '@/composables/usePaywall'

const canShowInput = ref(false)
const inputRef = ref<HTMLInputElement>()

// 模型选择相关
const { defaultModelId, getEffectiveDefaultModel } = useModelConfig()
const currentModel = ref<string>(defaultModelId.value)
const dropdownPosition = ref<'bottom' | 'top'>('bottom')

// 提供 auth 和 showOutLimit 给 ModelSelector
const auth = useAuth()
provide('auth', auth)

const paywall = usePaywall()
const showOutLimit = (show: boolean, from: string) => {
  if (show) {
    paywall.show({
      from: from || 'unknown',
    })
  }
}
provide('showOutLimit', showOutLimit)

// 初始化模型选择
onMounted(async () => {
  try {
    const effectiveModel = await getEffectiveDefaultModel()
    currentModel.value = effectiveModel
  } catch (error) {
    console.error('Failed to load default model:', error)
  }
})

// 监听模型变化，保存到 storage
watch(currentModel, async (newValue) => {
  if (newValue) {
    try {
      await browser.storage.local.set({
        [STORAGE_KEY.DEFAULT_SOLVE_MODEL]: newValue,
      })
      console.log('✅ Toolbar: 默认模型已更新', newValue)
      trackEvent.track('Plugin_Sidebar_DefaultModel_Changed', {
        modelId: newValue,
      })
    } catch (error) {
      console.error('❌ Toolbar: 保存默认模型失败', error)
    }
  }
})

// 🔴 按钮配置映射表 - 根据浏览器能力显示不同按钮
const actionButtons = computed(() => {
  const allButtons = [
    {
      key: 'cancel',
      label: 'Cancel',
      icon: 'toolbar/close',
      iconSize: 20,
      textColor: 'text-t_1 dark:text-t_1_dk',
      width: 'w-[78px]',
      handler: toCancel,
      showInOtherBrowsers: true, // ✅ 其他派也显示
    },
    {
      key: 'summarize',
      label: 'Summarize',
      icon: 'textSelection/select-summarize',
      iconSize: 20,
      textColor: 'text-t_1 dark:text-t_1_dk',
      width: 'w-[106px]',
      handler: toSummarize,
      showInOtherBrowsers: false, // ❌ 其他派隐藏
    },
    {
      key: 'quiz',
      label: 'Quiz',
      icon: 'textSelection/select-quiz',
      iconSize: 20,
      textColor: 'text-t_1 dark:text-t_1_dk',
      width: 'w-[62px]',
      handler: toQuiz,
      showInOtherBrowsers: false, // ❌ 其他派隐藏
    },
    {
      key: 'chat',
      label: 'Chat',
      icon: 'textSelection/select-chat',
      iconSize: 20,
      textColor: 'text-t_brand dark:text-t_brand_dk',
      width: 'w-[64px]',
      handler: toChat,
      showInOtherBrowsers: false, // ❌ 其他派隐藏
    },
  ]

  // 根据浏览器能力过滤按钮
  const isSupported = isSidePanelSupported()
  return allButtons.filter((btn) => isSupported || btn.showInOtherBrowsers)
})

const props = defineProps<{
  // 是否显示
  shouldShow: boolean
  // 截图区域位置
  rectPosition: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  isSolveLayer: boolean
}>()

// 利用截图区域位置计算出工具栏位置
const positionClass = ref<string[]>([])
watch(
  [() => props.shouldShow, () => props.rectPosition],
  ([shouldShow, rectPosition]) => {
    if (!shouldShow) return

    // 🔴 根据浏览器能力动态计算工具栏宽度
    // 可用派：Cancel + Summarize + Quiz + Chat + Solve ≈ 470px
    // 其他派：Cancel + ModelSelector + Solve ≈ 320px（ModelSelector 约 100px）
    const toolbarWidth = isSidePanelSupported() ? 470 : 245
    const { minX, minY, maxX, maxY } = rectPosition
    const newPositionClass = []

    const hasLeftSpace = maxX > toolbarWidth
    const hasBottomSpace = window.innerHeight - maxY > 52
    const hasTopSpace = minY > 52

    newPositionClass.push(hasLeftSpace ? 'right-0' : 'left-0 right-auto')
    newPositionClass.push(hasBottomSpace ? '-bottom-[48px]' : hasTopSpace ? '-top-[48px]' : 'bottom-[10px] right-[8px]')

    // 计算下拉框位置：根据工具栏实际位置和可用空间智能调整
    if (!isSidePanelSupported()) {
      const dropdownHeight = 360 // 估算下拉框高度（包含最大内容高度）
      const toolbarHeight = 36 // 工具栏高度
      const spacing = 8 // 下拉框与工具栏的间距

      // 计算工具栏的实际位置
      let toolbarBottom: number // 工具栏底部距离窗口顶部的距离

      if (hasBottomSpace) {
        // 工具栏在截图区域下方：使用 -bottom-[48px]
        // 工具栏底部位置 = maxY + 48px
        toolbarBottom = maxY + 48
      } else if (hasTopSpace) {
        // 工具栏在截图区域上方：使用 -top-[48px]
        // 工具栏底部位置 = minY - 48px + toolbarHeight = minY - 12px
        toolbarBottom = minY - 48 + toolbarHeight
      } else {
        // 工具栏在截图区域内部：使用 bottom-[10px] right-[8px]
        // 工具栏底部位置 = maxY - 10px
        toolbarBottom = maxY - 10
      }

      // 计算工具栏底部距离窗口底部的空间
      const spaceBelowToolbar = window.innerHeight - toolbarBottom

      // 如果工具栏底部空间足够（>= dropdownHeight + spacing），下拉框显示在底部
      // 否则显示在顶部
      dropdownPosition.value = spaceBelowToolbar >= dropdownHeight + spacing ? 'bottom' : 'top'
    }

    positionClass.value = newPositionClass
  },
  {
    immediate: true,
  }
)

// 处理发送按钮点击
const handleSend = () => {
  if (!inputRef.value) return

  const text = inputRef.value.value.trim()
  if (!text) return

  // 🎯 添加埋点
  trackEvent.track('Plugin_NewPanel_Chat_Send', {
    input: text,
    from: 'screenshot',
  })

  // 清空输入框
  inputRef.value.value = ''

  // 隐藏输入框
  canShowInput.value = false

  // 触发 Chat 事件，传入用户输入
  emit('toChat', text)
}

const emit = defineEmits<{
  (e: 'toHome'): void
  (e: 'toCancel'): void
  (e: 'toCopy'): void
  (e: 'toSolve'): void
  (e: 'toSummarize'): void
  (e: 'toQuiz'): void
  (e: 'toChat', input?: string): void
}>()

const toHome = () => {
  emit('toHome')
}

const toCancel = () => {
  emit('toCancel')
}

const toCopy = () => {
  emit('toCopy')
}

const toSolve = () => {
  emit('toSolve')
}

const toSummarize = () => {
  emit('toSummarize')
}

const toQuiz = () => {
  emit('toQuiz')
}

const toChat = () => {
  if (!props.isSolveLayer) {
    emit('toChat')
  } else {
    canShowInput.value = true
    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }
}

const handleClose = () => {
  canShowInput.value = false
  // 清空输入框
  if (inputRef.value) {
    inputRef.value.value = ''
  }
}
</script>

<style lang="less" scoped></style>
