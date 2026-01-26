<template>
  <div class="variable-form">
    <div v-if="variables.length === 0" class="empty-hint">
      暂无变量，点击"添加变量"创建
    </div>

    <div v-for="(variable, index) in variables" :key="variable.name" class="variable-item">
      <div class="variable-header">
        <span class="variable-label">
          {{ variable.label }}
          <span v-if="variable.required" class="required">*</span>
        </span>
        <button class="btn-delete" @click="deleteVariable(index)" title="删除变量">×</button>
      </div>

      <div class="variable-input-wrapper">
        <!-- 密码类型 -->
        <input
          v-if="variable.type === 'secret'"
          type="password"
          class="variable-input"
          :placeholder="variable.placeholder || '请输入'"
          :value="values[variable.name] || ''"
          @input="updateValue(variable.name, ($event.target as HTMLInputElement).value)"
        />
        <!-- 下拉选择 -->
        <select
          v-else-if="variable.type === 'select'"
          class="variable-input"
          :value="values[variable.name] || ''"
          @change="updateValue(variable.name, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择</option>
          <option v-for="opt in variable.options" :key="opt" :value="opt">
            {{ opt }}
          </option>
        </select>
        <!-- 数字类型 -->
        <input
          v-else-if="variable.type === 'number'"
          type="number"
          class="variable-input"
          :placeholder="variable.placeholder || '请输入数字'"
          :value="values[variable.name] || ''"
          @input="updateValue(variable.name, ($event.target as HTMLInputElement).value)"
        />
        <!-- URL 类型 -->
        <input
          v-else-if="variable.type === 'url'"
          type="url"
          class="variable-input"
          :placeholder="variable.placeholder || 'https://'"
          :value="values[variable.name] || ''"
          @input="updateValue(variable.name, ($event.target as HTMLInputElement).value)"
        />
        <!-- 默认文本类型 -->
        <input
          v-else
          type="text"
          class="variable-input"
          :placeholder="variable.placeholder || '请输入'"
          :value="values[variable.name] || ''"
          @input="updateValue(variable.name, ($event.target as HTMLInputElement).value)"
        />

        <span class="variable-type">{{ getTypeLabel(variable.type) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VariableDefinition } from '@/types/flow';

// Props
const props = defineProps<{
  variables: VariableDefinition[];
  values: Record<string, string>;
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:values', values: Record<string, string>): void;
  (e: 'update:variables', variables: VariableDefinition[]): void;
}>();

// 更新变量值
const updateValue = (name: string, value: string) => {
  emit('update:values', {
    ...props.values,
    [name]: value,
  });
};

// 删除变量
const deleteVariable = (index: number) => {
  const newVariables = [...props.variables];
  const removed = newVariables.splice(index, 1)[0];
  emit('update:variables', newVariables);
  
  // 同时删除对应的值
  const newValues = { ...props.values };
  delete newValues[removed.name];
  emit('update:values', newValues);
};

// 类型标签
const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    string: '文本',
    secret: '密码',
    url: 'URL',
    number: '数字',
    select: '选择',
  };
  return labels[type] || type;
};
</script>

<style scoped>
.variable-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-hint {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 20px;
}

.variable-item {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px 12px;
}

.variable-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.variable-label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.required {
  color: #ff4d4f;
  margin-left: 2px;
}

.btn-delete {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.btn-delete:hover {
  background: #ffebee;
  color: #ff4d4f;
}

.variable-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.variable-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.variable-input:focus {
  outline: none;
  border-color: #1890ff;
}

.variable-type {
  font-size: 11px;
  color: #999;
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 3px;
}
</style>
