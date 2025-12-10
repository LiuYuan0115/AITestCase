<template>
  <div class="timeline-item">
    <!-- 第一级时间轴项容器 -->
    <div class="timeline-level-1-container" :class="{ expanded: isExpanded }">
      <!-- 第一级主要内容 -->
      <div
        class="timeline-level-1"
        :class="{ 'hover-level-1': isHovering }"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
        @click.stop="handleClickTimestamp(item.start_time)"
      >
        <div class="timeline-level-1-content">
          <div class="timeline-timestamp-container">
            <span class="timeline-timestamp-text">
              {{ formatTime(item.start_time) }}
            </span>
          </div>
          <div class="timeline-content">
            <div class="timeline-text">{{ item.text }}</div>
            <!-- 展开按钮 -->
            <div
              v-if="item.subsections && item.subsections.length > 0"
              class="expand-button"
              @click="toggleExpand"
            >
              <span class="expand-text">
                {{ isExpanded ? 'Click to Collapse' : 'Click to Expand' }}
              </span>
              <SvgIcon
                name="expend-arrow"
                size="10"
                :style="{
                  color: '#007aff',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
                }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 第二级时间轴项（子项） -->
      <div
        v-if="item.subsections && item.subsections.length > 0"
        class="timeline-children"
        :class="{ expanded: isExpanded }"
        ref="timelineChildrenRef"
      >
        <div
          v-for="subsection in item.subsections"
          :key="subsection.id"
          class="timeline-level-2"
          :class="{ 'hover-level-2': subsection.isHovering }"
          @mouseenter="handleChildMouseEnter(subsection)"
          @mouseleave="handleChildMouseLeave(subsection)"
          @click.stop="handleClickTimestamp(subsection.start_time)"
        >
          <div class="timeline-timestamp-container">
            <span class="timeline-timestamp-text">
              {{ formatTime(subsection.start_time) }}
            </span>
          </div>
          <div></div>
          <div class="timeline-content">
            <div class="timeline-text">{{ subsection.text }}</div>
          </div>
        </div>
        <div class="timeline-children-divider"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'

// 定义时间轴数据结构
export interface TimelineItemData {
  id: string
  title: string
  text: string
  start_time: number // 开始时间（秒）
  end_time: number // 结束时间（秒）
  duration: number // 持续时间（秒）
  subsections?: TimelineSubsectionData[] // 恢复为只包含完整对象的数组
  isExpanded?: boolean // 添加展开状态字段
  type?: 'FIRST_SUMMARY' | 'SECOND_SUMMARY' | string // 添加 type 字段
}

export interface TimelineSubsectionData {
  id: string
  title: string
  text: string
  start_time: number
  end_time: number
  duration: number
  isHovering?: boolean
  type?: 'FIRST_SUMMARY' | 'SECOND_SUMMARY' | string // 添加 type 字段
}

const props = defineProps<{
  item: TimelineItemData
  isExpanded: boolean // 从父组件接收展开状态
}>()

// 定义事件
const emit = defineEmits<{
  'toggle-expand': [itemId: string]
  'click-timestamp': [timestamp: number]
}>()

const isHovering = ref(false)
const timelineChildrenRef = ref<HTMLElement | null>(null)

// 格式化时间戳为 hh:mm:ss 格式
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (hours === 0) {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`
  } else {
    return `${hours.toString()}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// 切换展开状态 - 发射事件给父组件
const toggleExpand = () => {
  if (props.item.subsections && props.item.subsections.length > 0) {
    emit('toggle-expand', props.item.id)
  }
}

watch(
  () => props.isExpanded,
  (isExpanded) => {
    const timelineChildren = timelineChildrenRef.value

    // 确保 DOM 元素存在
    if (!timelineChildren) {
      return
    }

    // 定义展开和收起动画的速度因子（秒/像素）
    // 这些值是根据视觉效果调整的“魔法数字”，定义为常量以提高可读性和可维护性
    const EXPAND_SPEED_FACTOR = 0.001 // 展开时的速度因子
    const COLLAPSE_SPEED_FACTOR = 0.001 // 收起时的速度因子

    // 使用 requestAnimationFrame 确保 DOM 操作在下一帧执行，优化性能
    requestAnimationFrame(() => {
      const scrollHeight = timelineChildren.scrollHeight // 获取元素的实际高度

      if (isExpanded) {
        // 展开状态：根据实际高度计算过渡时间，并设置为 ease-in 效果
        timelineChildren.style.transition = `max-height ${
          scrollHeight * EXPAND_SPEED_FACTOR
        }s ease-in`
        timelineChildren.style.maxHeight = `${scrollHeight}px`
      } else {
        // 收起状态：根据实际高度计算过渡时间，并设置为 ease-out 效果
        timelineChildren.style.transition = `max-height ${
          scrollHeight * COLLAPSE_SPEED_FACTOR
        }s ease-out`
        timelineChildren.style.maxHeight = `0px`
      }
    })
  }
)

// 第一级hover事件
const handleMouseEnter = () => {
  isHovering.value = true
}

const handleMouseLeave = () => {
  isHovering.value = false
}

// 第二级hover事件
const handleChildMouseEnter = (subsection: TimelineSubsectionData) => {
  subsection.isHovering = true
}

const handleChildMouseLeave = (subsection: TimelineSubsectionData) => {
  subsection.isHovering = false
}

// 点击时间轴项，跳转视频到对应时间
const handleClickTimestamp = (timestamp: number) => {
  emit('click-timestamp', timestamp)
}
</script>

<style lang="less" scoped>
.timeline-item {
}

.timeline-level-1-container {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  transition: all 0.2s ease;
  overflow: hidden;
}

/* 第一级时间轴项 */
.timeline-level-1 {
  display: flex;
  padding: 8px;
  border-radius: 12px;
  flex-direction: column;
  align-items: flex-start;
  transition: background-color 0.3s ease;
  cursor: pointer;

  .timeline-level-1-content {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
    gap: 12px;
  }

  &.hover-level-1 {
    background-color: #ecf5ff;
    
    .dark & {
      background-color: #122E57;
    }
  }
}

/* 第二级时间轴项 */
.timeline-level-2 {
  display: flex;
  align-items: flex-start;
  padding: 8px;
  border-radius: 12px;
  gap: 12px;
  cursor: pointer;
}

.timeline-timestamp-container {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 46px; // 恢复原来的宽度，因为只显示单个时间
}

/* 时间轴时间戳 */
.timeline-timestamp-text {
  flex-shrink: 0;
  text-align: center;
  border-radius: 6px;
  color: #111;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 19.6px;

  .dark & {
    color: #FFFFFF;
  }

  .hover-level-2 & {
    color: #007aff;
  }
}
.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-text {
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 140%; /* 19.6px */
  color: #111; // 使用深色，因为这是主要内容
  transition: color 0.2s ease-out;

  .dark & {
    color: #FFFFFF;
  }

  .hover-level-2 & {
    color: #007aff;
  }
}

.timeline-children {
  padding-left: 8px;
  padding-bottom: 8px;
  overflow: hidden;
  transition: max-height 0.5s ease-in;
  max-height: 0;
  position: relative;

  .timeline-children-divider {
    position: absolute;
    width: 1px;
    left: 75px;
    top: 12px;
    bottom: 8px;
    background-color: #ededed;
    
    .dark & {
      background-color: #474C58;
    }
  }
}

.expand-button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #007aff;
  font-size: 14px;
  font-weight: 400;
  user-select: none;
  gap: 4px;
  width: fit-content;

  &:hover {
    text-decoration: underline;
  }

  .expand-text {
    color: #007aff;
  }

  svg {
    transition: transform 0.2s ease;
  }
}
</style>
