<template>
  <div class="template-library">
    <div class="library-header">
      <span class="library-title">📚 模板库</span>
      <button class="btn-new" @click="$emit('create-new')" title="新建流程">
        + 新建
      </button>
    </div>

    <div class="library-content">
      <!-- 预置模板 -->
      <div class="template-group">
        <div class="group-title">预置模板</div>
        <div
          v-for="template in presetTemplates"
          :key="template.id"
          class="template-item"
          :class="{ active: selectedId === template.id }"
          @click="$emit('select', template)"
        >
          <span class="template-icon">{{ getCategoryIcon(template.category) }}</span>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description || '无描述' }}</div>
          </div>
        </div>
      </div>

      <!-- 用户模板 -->
      <div class="template-group" v-if="userTemplates.length > 0">
        <div class="group-title">我的模板</div>
        <div
          v-for="template in userTemplates"
          :key="template.id"
          class="template-item"
          :class="{ active: selectedId === template.id }"
          @click="$emit('select', template)"
        >
          <span class="template-icon">{{ getCategoryIcon(template.category) }}</span>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.steps?.length || 0 }} 个步骤</div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="templates.length === 0" class="empty-state">
        <p>暂无模板</p>
        <button class="btn-create" @click="$emit('create-new')">
          创建第一个流程
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FlowConfig } from '@/types/flow';

// Props
const props = defineProps<{
  templates: FlowConfig[];
  selectedId?: string;
}>();

// Emits
defineEmits<{
  (e: 'select', template: FlowConfig): void;
  (e: 'create-new'): void;
}>();

// 预置模板
const presetTemplates = computed(() => 
  props.templates.filter((t) => t.isPreset)
);

// 用户模板
const userTemplates = computed(() => 
  props.templates.filter((t) => !t.isPreset)
);

// 类别图标
const getCategoryIcon = (category: string) => {
  const icons: Record<string, string> = {
    login: '🔐',
    solve: '🧩',
    payment: '💳',
    custom: '📦',
  };
  return icons[category] || '📄';
};
</script>

<style scoped>
.template-library {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
}

.library-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.btn-new {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid #1890ff;
  border-radius: 4px;
  background: #fff;
  color: #1890ff;
  cursor: pointer;
}

.btn-new:hover {
  background: #e6f7ff;
}

.library-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.template-group {
  margin-bottom: 8px;
}

.group-title {
  font-size: 11px;
  color: #999;
  padding: 8px 16px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.template-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.template-item:hover {
  background: #f5f5f5;
}

.template-item.active {
  background: #e6f7ff;
  border-left: 3px solid #1890ff;
}

.template-icon {
  font-size: 20px;
  margin-right: 10px;
  flex-shrink: 0;
}

.template-info {
  flex: 1;
  min-width: 0;
}

.template-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.template-desc {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-state p {
  margin-bottom: 16px;
}

.btn-create {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background: #1890ff;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn-create:hover {
  background: #40a9ff;
}
</style>
