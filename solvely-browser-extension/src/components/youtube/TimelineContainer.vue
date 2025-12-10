<template>
  <div class="timeline-container">
    <div class="timeline-header">
      <span class="timeline-title">Highlights</span>
      <div class="flex flex-row items-center gap-2">
        <span class="expand-all-text">Expand All</span>
        <ToggleSwitch v-model="allExpanded" @toggle="toggleExpandAll" />
      </div>
    </div>

    <div class="timeline-content">
      <TimelineItem
        v-for="item in timelineData"
        :key="item.id"
        :item="item"
        :isExpanded="item.isExpanded || false"
        @toggle-expand="handleToggleExpand"
        @click-timestamp="handleClickTimestamp"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import TimelineItem, {
  type TimelineItemData,
  type TimelineSubsectionData,
} from './TimelineItem.vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'

const props = defineProps<{
  data: TimelineItemData[]
}>()

// 初始化 timelineData，用于存储带有 isExpanded 状态的数据
const timelineData = ref<TimelineItemData[]>([])

// 使用 watch 监听 props.data 的变化
watch(
  () => props.data,
  (newData) => {
    // 创建一个 Map，用于通过 id 快速查找所有子项数据
    const subsectionMap = new Map<string, TimelineSubsectionData>()
    newData.forEach((item) => {
      // 假设所有 'SECOND_SUMMARY' 类型的项都是子项
      // 或者，更通用地，所有在父级 'subsections' 数组中被引用的项
      // 这里我们简单地将所有具有 'subsections' 字段的项都添加到 map 中
      // 注意：如果您的数据可能包含非 subsection 的项，但它们有 id，请调整此逻辑
      if (item.type === 'SECOND_SUMMARY') {
        // 假设只有 SECOND_SUMMARY 才是真正的子项
        subsectionMap.set(item.id, item as TimelineSubsectionData)
      } else {
        // 如果 top-level item 也有自己的 ID，也可以添加到 map
        // 但这里我们只关心 subsection
        subsectionMap.set(item.id, item as TimelineSubsectionData)
      }
    })

    const updatedTimelineData = newData
      .filter((item) => item.type === 'FIRST_SUMMARY') // 筛选出第一级主项
      .map((newItem) => {
        const existingItem = timelineData.value.find(
          (item) => item.id === newItem.id
        )

        // 如果 newItem.subsections 存在且包含 ID，则进行替换
        let resolvedSubsections: TimelineSubsectionData[] | undefined
        if (newItem.subsections && newItem.subsections.length > 0) {
          resolvedSubsections = newItem.subsections
            .map((subId) => subsectionMap.get(subId as unknown as string)) // 从 map 中查找对应的子项对象
            .filter((sub) => sub !== undefined) as TimelineSubsectionData[] // 过滤掉未找到的项
        }

        return {
          ...newItem,
          subsections: resolvedSubsections, // 使用解析后的子项数组
          isExpanded: existingItem ? existingItem.isExpanded : false, // 默认收起，如果已存在则保留状态
        }
      })
    timelineData.value = updatedTimelineData
  },
  { immediate: true } // immediate: true 会在组件加载时立即执行一次 watch
)

// 检查是否所有可展开的项都已展开
const allExpanded = computed(() => {
  const expandableItems = timelineData.value.filter(
    (item) => item.subsections && item.subsections.length > 0
  )

  // 如果没有可展开的项，返回 false
  if (expandableItems.length === 0) return false

  return expandableItems.every((item) => item.isExpanded)
})

// 切换全部展开/收起
const toggleExpandAll = () => {
  trackEvent.track('Plugin_Youtubepanel_Collapseall')

  const shouldExpand = !allExpanded.value

  timelineData.value.forEach((item) => {
    if (item.subsections && item.subsections.length > 0) {
      item.isExpanded = shouldExpand
    }
  })
}

// 处理单个项目的展开/收起
const handleToggleExpand = (itemId: string) => {
  trackEvent.track('Plugin_Youtubepanel_Collapse')

  const item = timelineData.value.find((item) => item.id === itemId)
  if (item && item.subsections && item.subsections.length > 0) {
    item.isExpanded = !item.isExpanded
  }
}

// 点击时间轴项，跳转视频到对应时间
const handleClickTimestamp = (timestamp: number) => {
  // get video element
  const videoElement = document.querySelector(
    '.html5-video-container video'
  ) as HTMLVideoElement
  console.log('videoElement', videoElement)
  console.log('jump to timestamp', timestamp)
  videoElement.currentTime = timestamp
}
</script>

<style lang="less" scoped>
.timeline-container {
  width: 100%;
}

.timeline-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 20px 10px;
  margin-bottom: 5px;
  background: #fff;
  transition: 0.2s colors;
  
  .dark & {
    background: #1B212D;
  }
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  transition: 0.2s colors;
  line-height: 1.3;
  
  .dark & {
    color: #FFFFFF;
  }
}

.expand-all-text {
  color: var(--Text-colors-Medium-Emphasis, #555);
  font-size: 14px;
  font-style: normal;
  font-weight: 300;
  line-height: 140%; /* 19.6px */
  transition: background-color 0.2s ease;
  transition: 0.2s colors;
  cursor: default;
  
  .dark & {
    color: #999999;
  }
}

@scrollbar-width: 4px;
@scrollbar-radius: @scrollbar-width;
@scrollbar-track-bg: #ffffff;
@scrollbar-thumb-bg: #eeeeee;

.timeline-content {
  padding: 0 8px;
}

:deep(.timeline-content) {
  scrollbar-color: @scrollbar-thumb-bg @scrollbar-track-bg !important;
  scrollbar-width: thin !important;

  overscroll-behavior: contain;
  
  .dark & {
    scrollbar-color: #474C58 #1B212D !important;
  }
}
</style>
