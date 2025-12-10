<template>
  <div
    v-if="shouldShow"
    class="relative w-fit"
    ref="popupRef"
  >
    <!-- Compare 入口按钮（带 Tooltip） -->
    <CustomTooltip
      position="top"
      :disabled="!isDisabled"
    >
      <button
        @click.stop="toggleDropdown"
        :disabled="isDisabled"
        class="flex items-center gap-[4px] pl-[12px] pr-[8px] h-[28px] rounded-[14px] border-[1px] color-transition hover:bg-b_btn_2 dark:hover:bg-b_btn_2_dk border-d_1 dark:border-d_1_dk cursor-pointer"
        :class="[
          isDisabled
            ? 'cursor-not-allowed bg-b_btn_dis dark:bg-b_btn_dis_dk border-s-disable-bg'
            : isOpen
            ? 'bg-b_blue99 dark:bg-b_blue99_dk'
            : 'bg-b_1 dark:bg-b_1_dk ',
        ]"
      >
        <!-- 显示 "Compare with" + icons -->
        <span
          class="text-[12px] font-medium color-transition"
          :class="isDisabled ? 'text-t_btn_dis dark:text-t_dis_dk' : 'text-t_1 dark:text-t_1_dk'"
        >
          Compare with
        </span>

        <!-- 模型 icon 列表 -->
        <div class="flex items-center">
          <div
            v-for="(model, index) in availableModels"
            :key="model.id"
            :class="[
              'flex items-center justify-center w-[17px] h-[17px] rounded-[8px] border-[1px] dark:border-s-border-dark bg-b_1 dark:bg-white-dark relative transition-opacity duration-200',
              index !== availableModels.length - 1 ? '-mr-[4px]' : '',
              isDisabled ? 'opacity-50 border-d_1' : 'border-d_1',
            ]"
            :style="{ zIndex: availableModels.length - index }"
          >
            <SvgIcon
              :name="getModelIcon(model.id)"
              size="14"
              :class="isDisabled ? 'opacity-50' : ''"
            />
          </div>
        </div>

        <!-- 下拉箭头 -->
        <span
          :class="[
            { 'rotate-180': isOpen },
            'color-transition',
            isDisabled ? 'text-t_btn_dis dark:text-t_dis_dk' : 'text-t_2 dark:text-t_2_dk',
          ]"
        >
          <SvgIcon
            name="arrow-down4"
            size="12"
          />
        </span>
      </button>

      <!-- Tooltip 内容（具名插槽） -->
      <template
        v-if="isDisabled"
        #content
      >
        <div class="w-[166px]">
          {{
            isMultiModelDisabled
              ? "You've used all your free solves today"
              : 'Please wait until the generation is completed'
          }}
        </div>
      </template>
    </CustomTooltip>

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
        @click.stop
        :class="[
          'absolute left-0 min-w-[256px] bg-b_card dark:bg-b_card_dk rounded-[16px] shadow-[0_0_24px_rgba(0,0,0,0.16)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-[8px] z-[1000]',
          dropdownPosition === 'bottom' ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]',
        ]"
      >
        <!-- 标题 -->
        <div class="p-[8px] text-[12px] leading-[130%] font-[400] text-t_3 dark:text-t_3_dk mb-[8px]">
          Compare answers
        </div>

        <!-- 模型列表 -->
        <div class="flex flex-col gap-[4px]">
          <button
            v-for="model in availableModels"
            :key="model.id"
            @click="handleSelectModel(model)"
            class="flex items-center gap-[8px] p-[8px] rounded-[8px] leading-[150%] hover:bg-b_blue99 dark:hover:bg-b_blue99_dk transition-colors duration-150 text-left cursor-pointer"
          >
            <SvgIcon
              :name="getModelIcon(model.id)"
              size="20"
              class="flex-shrink-0"
            />

            <!-- 布局 A：左右布局（showGroupNameInButton = true） -->
            <div
              v-if="shouldShowGroupNameForModel(model.id)"
              class="flex items-center justify-between flex-1"
            >
              <span
                class="flex items-center gap-[4px] text-[14px] leading-[140%] font-medium text-t_1 dark:text-t_1_dk"
              >
                {{ getModelGroupName(model.id) }}
                <IconPro v-if="!useSubscription.isSubscribed.value && model.isPro" />
              </span>
              <span class="text-[12px] font-normal text-t_3 dark:text-t_3">
                {{ model.name }}
              </span>
            </div>

            <!-- 布局 B：单列布局（showGroupNameInButton = false） -->
            <span
              v-else
              class="flex items-center gap-[4px] text-[14px] leading-[140%] font-medium text-t_1 dark:text-t_1_dk"
            >
              {{ model.name }}
              <IconPro v-if="!useSubscription.isSubscribed.value && model.isPro" />
            </span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import CustomTooltip from '@/components/common/CustomTooltip.vue'
import { useModelConfig } from '../composables'
import type { ModelItemV2 } from '../composables/types'
import type { Ref } from 'vue'
import trackEvent from '@/utils/trackEvent'
import { useDarkMode } from '@/composables/useDarkMode'
import IconPro from '@/components/common/IconPro.vue'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'

const showOutLimit = inject<(show: boolean, from: string) => void>('showOutLimit')!
const { isDark } = useDarkMode()

// Props
interface Props {
  dropdownPosition?: 'bottom' | 'top'
}

const props = withDefaults(defineProps<Props>(), {
  dropdownPosition: 'bottom',
})

// Emits
const emit = defineEmits<{
  (e: 'switchModel', modelId: string): void
}>()

// 状态
const isOpen = ref(false)
const popupRef = ref<HTMLElement>()

// 从父组件注入当前选中的模型 ID
const currentModelId = inject<Ref<string>>('currentModelId', ref(''))
// 从父组件注入加载状态
const isAnswerLoading = inject<Ref<boolean>>('isAnswerLoading', ref(false))
// 从父组件注入 questionId
const questionId = inject<Ref<string>>('questionId', ref(''))
// 从父组件注入多模型禁用状态
const isMultiModelDisabled = inject<Ref<boolean>>('isMultiModelDisabled', ref(false))

// 使用 useModelConfig 获取配置（V2 版本）
const { flattenedModels: allModels, getModelIcon, getModelGroupName, shouldShowGroupNameForModel } = useModelConfig()

// 可用模型列表：过滤掉当前选中的模型
const availableModels = computed((): ModelItemV2[] => {
  const currentId = currentModelId.value
  const result = allModels.value.filter((model) => model.id !== currentId)

  console.log('🔍 ModelCompareButton: 可用模型（过滤当前模型）', {
    total: allModels.value.length,
    currentModel: currentId,
    available: result.map((m) => ({ name: m.name, id: m.id })),
  })

  return result
})

// 是否显示组件（有未请求的模型时显示）
const shouldShow = computed(() => availableModels.value.length > 0)

// 是否应该禁用（余额不足 或 正在加载 或 余额不足提示已显示）
const isDisabled = computed(() => {
  // 条件 1：未订阅且无余额
  // const noBalance = !useSubscription.isSubscribed.value && !useSubscription.hasBalance.value

  // 条件 2：正在加载
  const loading = isAnswerLoading.value

  // 条件 3：余额不足提示已显示
  const noBalancePromptShown = isMultiModelDisabled.value

  return loading || noBalancePromptShown
})

// 切换下拉菜单
function toggleDropdown() {
  if (isDisabled.value) return
  isOpen.value = !isOpen.value
  trackEvent.track('Plugin_Answer_SwitchModel')
}

// 选择模型（V2：简化逻辑）
function handleSelectModel(model: ModelItemV2) {
  console.log('🎯 ModelCompareButton: 选择模型', model.id)
  if (!useSubscription.isSubscribed.value) {
    isOpen.value = false
    showOutLimit(true, 'model')
    return
  }
  trackEvent.track('Plugin_Answer_SwitchModel_Click', {
    from: 'sidebar',
    Model: model.name,
    questionId: questionId.value,
  })
  emit('switchModel', model.id)
  isOpen.value = false
}

// 点击外部关闭下拉菜单
function handleClickOutside(event: MouseEvent) {
  if (!popupRef.value) return

  // 🎯 兼容 Shadow DOM：使用 composedPath() 检查事件路径
  const path = event.composedPath ? event.composedPath() : [event.target]
  const clickedInside = path.some((el) => el === popupRef.value)

  if (!clickedInside) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* 确保下拉菜单在最上层 */
.z-\[1000\] {
  z-index: 1000;
}
</style>
