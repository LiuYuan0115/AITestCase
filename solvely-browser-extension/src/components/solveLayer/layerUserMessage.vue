<template>
  <div
    v-if="type === 'Chat'"
    class="bg-b_panel dark:bg-b_panel_dk p-3 pb-[15px] rounded-[12px] transition-colors duration-200 flex flex-col gap-3"
  >
    <div class="text-[14px] font-[500] leading-[1.4] text-[#595C60] dark:text-[#D1D3D5] transition-colors duration-200 line-clamp-2">
      {{ props.data.text }}
    </div>
    <div
      class="relative"
      v-if="props.data.selection && !props.data.base64"
    >
      <div
        :class="[
          'py-[7px] bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border-secondary dark:border-s-border-secondary-dark rounded-md flex pl-2 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-[14px] font-[400] leading-[17px] transition-all duration-200',
          showArrow ? 'cursor-pointer hover:border-s-border hover:dark:border-s-border-dark hover:bg-[#ECF5FF] dark:hover:bg-[#303A52]' : 'cursor-default',
          isSelectionExpanded ? 'overflow-y-auto' : ''
        ]"
        @click="handleClickSellction"
        :style="{
          height: isSelectionExpanded ? expandedHeight + 'px' : `${Math.min(expandedHeight, 34)}px`,
        }"
      >
        <div
          class="select-none w-[302px] h-fit"
          :class="isSelectionExpanded ? '' : 'truncate'"
        >
          {{ props.data.selection }}
        </div>
        <SvgIcon
          v-if="showArrow"
          name="textSelection/layer-arrow"
          size="20"
          class="transition-all duratuon-200 absolute right-[8px] top-[6px]"
          :class="isSelectionExpanded ? 'scale-y-[-1]' : ''"
        />
      </div>
      <!-- 镜像元素，用于计算展开后的高度 -->
      <div class="overflow-hidden h-0 relative">
        <div
          ref="mirrorElement"
          class="overflow-hidden flex items-start justify-start py-[7px] pl-2 text-[14px] font-[400] leading-[17px] w-[302px] !absolute top-0 left-0 !opacity-0 !pointer-events-none z-[-1]"
        >
          <span>{{ props.data.selection }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="props.data.base64">
      <div class="w-[152px] h-[74px] border border-[#E6E8EA] dark:border-[#474C58] bg-[#fff] dark:bg-[#1B212D] rounded-[12px] overflow-hidden flex items-center justify-center">
        <img
          :src="props.data.base64"
          alt="base64"
          class="max-w-full max-h-full object-contain"
          style="display: block"
        />
      </div>
    </div>
  </div>
  <div
    class="relative"
    v-else
  >
    <div
      v-if="props.data.selection && !props.data.base64"
      :class="[
        'py-[7px] bg-s-interface-bg dark:bg-s-interface-bg-dark border border-s-border-secondary dark:border-s-border-secondary-dark rounded-md flex pl-2 text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark text-[14px] font-[400] leading-[17px] transition-all duration-200',
        showArrow ? 'cursor-pointer hover:border-s-border hover:dark:border-s-border-dark hover:bg-[#ECF5FF] dark:hover:bg-[#303A52]' : 'cursor-default',
        isSelectionExpanded ? 'overflow-y-auto' : ''
      ]"
      @click="handleClickSellction"
      :style="{
        height: isSelectionExpanded ? expandedHeight + 'px' : `${Math.min(expandedHeight, 34)}px`,
      }"
    >
      <div
        class="select-none w-[328px] h-fit"
        :class="isSelectionExpanded ? '' : 'truncate'"
      >
        {{ props.data.selection }}
      </div>
      <SvgIcon
        v-if="showArrow"
        name="textSelection/layer-arrow"
        size="20"
        class="transition-all duratuon-200 absolute right-[8px] top-[6px]"
        :class="isSelectionExpanded ? 'scale-y-[-1]' : ''"
      />
    </div>
    <div v-else-if="props.data.base64" class="flex items-center justify-end">
      <div class="w-[218px] h-[106px] border border-[#E6E8EA] dark:border-[#474C58] bg-[#fff] dark:bg-[#1B212D] rounded-[12px] overflow-hidden flex items-center justify-center">
        <img
          :src="props.data.base64"
          alt="base64"
          class="max-w-full max-h-full object-contain"
          style="display: block"
        />
      </div>
    </div>
    <!-- 镜像元素，用于计算展开后的高度 -->
    <div class="overflow-hidden h-0 relative">
      <div
        v-if="props.data.selection && !props.data.base64"
        ref="mirrorElement"
        class="overflow-hidden flex items-start justify-start py-[7px] pl-2 text-[14px] font-[400] leading-[17px] w-[328px] !absolute top-0 left-0 !opacity-0 !pointer-events-none z-[-1]"
      >
        <span>{{ props.data.selection }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import SvgIcon from '../common/SvgIcon.vue'

type dataType = {
  selection?: string
  text?: string
  base64?: string
}

const props = defineProps<{
  data: dataType
  type: string
}>()

// 行数到高度的映射表
const LINE_HEIGHT_MAP = {
  1: 34,  // 1行
  2: 52,  // 2行
  3: 70,  // 3行及以上
}

const mirrorElement = ref<HTMLElement>()
const expandedHeight = ref(LINE_HEIGHT_MAP[1])
const isSelectionExpanded = ref(false)

// 计算文本行数并映射对应高度
const calculateExpandedHeight = () => {
  if (mirrorElement.value) {
    // 获取镜像元素的实际高度
    const actualHeight = mirrorElement.value.offsetHeight
    
    console.log('[layerUserMessage] actualHeight:', actualHeight)
    
    // 直接根据实际高度判断行数
    // 1行：34px (16px padding + 17px content +1px)
    // 2行：52px (16px padding + 35px content +1px)  
    // 3行：70px (16px padding + 53px content +1px)
    
    if (actualHeight <= 34) {
      // 小于等于 34px 视为 1行
      expandedHeight.value = LINE_HEIGHT_MAP[1]
    } else if (actualHeight <= 52) {
      // 35-52px 视为 2行
      expandedHeight.value = LINE_HEIGHT_MAP[2]
    } else {
      // 大于 53px 视为 3行及以上
      expandedHeight.value = LINE_HEIGHT_MAP[3]
    }
    
    console.log('[layerUserMessage] expandedHeight:', expandedHeight.value, 'showArrow:', expandedHeight.value > LINE_HEIGHT_MAP[1])
  }
}

// 判断是否显示箭头（只有一行时不显示）
const showArrow = computed(() => {
  return expandedHeight.value > LINE_HEIGHT_MAP[1]
})

const handleClickSellction = () => {
  if (showArrow.value) {
    isSelectionExpanded.value = !isSelectionExpanded.value
  }
}

// 监听文本变化，重置展开状态并重新计算高度
watch(
  () => props.data.selection,
  () => {
    isSelectionExpanded.value = false
    nextTick(() => {
      calculateExpandedHeight()
    })
  }
)

// 组件挂载后计算高度
onMounted(() => {
  nextTick(() => {
    calculateExpandedHeight()
  })
})
</script>
