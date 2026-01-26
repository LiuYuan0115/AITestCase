<template>
  <div class="step-editor-overlay" @click.self="$emit('cancel')">
    <div class="step-editor-modal">
      <div class="modal-header">
        <h3>{{ isNew ? '添加步骤' : '编辑步骤' }}</h3>
        <button class="btn-close" @click="$emit('cancel')">×</button>
      </div>

      <div class="modal-body">
        <!-- 步骤名称 -->
        <div class="form-group">
          <label>步骤名称</label>
          <input
            v-model="editingStep.name"
            type="text"
            class="form-input"
            placeholder="如：点击登录按钮"
          />
        </div>

        <!-- 操作区域 -->
        <div class="form-group">
          <label>操作区域</label>
          <TargetSelector v-model="editingStep.target" />
        </div>

        <!-- 操作类型 -->
        <div class="form-group">
          <label>操作类型</label>
          <select v-model="editingStep.action" class="form-select">
            <option value="navigate">navigate - 页面跳转</option>
            <option value="click">click - 点击元素</option>
            <option value="input">input - 输入文本</option>
            <option value="select">select - 下拉选择</option>
            <option value="wait">wait - 等待</option>
            <option value="assert">assert - 断言验证</option>
            <option value="screenshot">screenshot - 截图</option>
            <option value="scroll">scroll - 滚动</option>
          </select>
        </div>

        <!-- 元素定位（非 navigate/wait/screenshot） -->
        <div v-if="needsSelector" class="form-group">
          <label>元素定位</label>
          <div class="selector-types">
            <label 
              v-for="opt in selectorTypeOptions" 
              :key="opt.value"
              class="selector-type-option"
              :class="{ active: editingStep.selector?.type === opt.value }"
            >
              <input
                type="radio"
                :value="opt.value"
                v-model="selectorType"
                @change="updateSelectorType(opt.value)"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>
          <input
            v-model="selectorValue"
            type="text"
            class="form-input"
            :placeholder="getSelectorPlaceholder()"
            @input="updateSelectorValue"
          />
          <p class="form-hint" v-if="selectorType === 'ai'">
            💡 提示：用自然语言描述元素，如"提交按钮"、"用户名输入框"
          </p>
        </div>

        <!-- 参数配置 -->
        <div v-if="needsParams" class="form-group">
          <label>参数配置</label>
          
          <!-- navigate: URL -->
          <div v-if="editingStep.action === 'navigate'" class="params-row">
            <span>目标 URL:</span>
            <input
              v-model="paramsValue"
              type="text"
              class="form-input"
              placeholder="https:// 或 {{变量}}"
              @input="updateParams('value', paramsValue)"
            />
          </div>
          
          <!-- input: 输入值 -->
          <div v-if="editingStep.action === 'input'" class="params-row">
            <span>输入内容:</span>
            <input
              v-model="paramsValue"
              type="text"
              class="form-input"
              placeholder="输入值或 {{变量}}"
              @input="updateParams('value', paramsValue)"
            />
          </div>
          
          <!-- select: 选项值 -->
          <div v-if="editingStep.action === 'select'" class="params-row">
            <span>选择值:</span>
            <input
              v-model="paramsValue"
              type="text"
              class="form-input"
              placeholder="选项文本或值"
              @input="updateParams('value', paramsValue)"
            />
          </div>
          
          <!-- wait: 超时 -->
          <div v-if="editingStep.action === 'wait'" class="params-row">
            <span>等待时间:</span>
            <input
              v-model.number="paramsTimeout"
              type="number"
              class="form-input small"
              placeholder="3000"
              @input="updateParams('timeout', paramsTimeout)"
            />
            <span class="unit">ms</span>
          </div>
          
          <!-- scroll: 方向和距离 -->
          <div v-if="editingStep.action === 'scroll'" class="params-row">
            <span>方向:</span>
            <select v-model="paramsDirection" class="form-select small" @change="updateParams('direction', paramsDirection)">
              <option value="down">向下</option>
              <option value="up">向上</option>
            </select>
            <span>距离:</span>
            <input
              v-model.number="paramsDistance"
              type="number"
              class="form-input small"
              placeholder="500"
              @input="updateParams('distance', paramsDistance)"
            />
            <span class="unit">px</span>
          </div>
        </div>

        <!-- 错误处理 -->
        <div class="form-group">
          <label>失败处理</label>
          <div class="error-options">
            <label 
              v-for="opt in errorOptions" 
              :key="opt.value"
              class="error-option"
              :class="{ active: editingStep.onError === opt.value }"
            >
              <input
                type="radio"
                :value="opt.value"
                v-model="editingStep.onError"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </div>

        <!-- 启用状态 -->
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="editingStep.enabled" />
            <span>启用此步骤</span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('cancel')">取消</button>
        <button class="btn-primary" @click="saveStep">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { TestStep, SelectorType } from '@/types/flow';
import TargetSelector from './TargetSelector.vue';

// Props
const props = defineProps<{
  step: TestStep;
}>();

// Emits
const emit = defineEmits<{
  (e: 'save', step: TestStep): void;
  (e: 'cancel'): void;
}>();

// 编辑中的步骤
const editingStep = ref<TestStep>({ ...props.step });

// 选择器状态
const selectorType = ref<SelectorType>(props.step.selector?.type || 'ai');
const selectorValue = ref(props.step.selector?.value || '');

// 参数状态
const paramsValue = ref(props.step.params?.value || '');
const paramsTimeout = ref(props.step.params?.timeout || 3000);
const paramsDirection = ref(props.step.params?.direction || 'down');
const paramsDistance = ref(props.step.params?.distance || 500);

// 是否为新建
const isNew = computed(() => !props.step.name);

// 是否需要选择器
const needsSelector = computed(() => {
  return !['navigate', 'wait', 'screenshot'].includes(editingStep.value.action);
});

// 是否需要参数
const needsParams = computed(() => {
  return ['navigate', 'input', 'select', 'wait', 'scroll'].includes(editingStep.value.action);
});

// 选择器类型选项
const selectorTypeOptions = [
  { value: 'ai', label: 'AI智能定位 (推荐)' },
  { value: 'css', label: 'CSS选择器' },
  { value: 'xpath', label: 'XPath' },
  { value: 'text', label: '文本匹配' },
];

// 错误处理选项
const errorOptions = [
  { value: 'fail', label: '终止流程' },
  { value: 'skip', label: '跳过此步' },
  { value: 'retry', label: '重试' },
];

// 获取选择器占位符
const getSelectorPlaceholder = () => {
  const placeholders: Record<string, string> = {
    ai: '描述元素，如：登录按钮、用户名输入框',
    css: 'CSS 选择器，如：#login-btn、.submit',
    xpath: 'XPath 表达式，如：//button[@type="submit"]',
    text: '元素文本内容',
  };
  return placeholders[selectorType.value] || '';
};

// 更新选择器类型
const updateSelectorType = (type: string) => {
  selectorType.value = type as SelectorType;
  editingStep.value.selector = {
    type: type as SelectorType,
    value: selectorValue.value,
  };
};

// 更新选择器值
const updateSelectorValue = () => {
  editingStep.value.selector = {
    type: selectorType.value,
    value: selectorValue.value,
  };
};

// 更新参数
const updateParams = (key: string, value: any) => {
  if (!editingStep.value.params) {
    editingStep.value.params = {};
  }
  (editingStep.value.params as any)[key] = value;
};

// 保存步骤
const saveStep = () => {
  emit('save', editingStep.value);
};

// 监听 step 变化
watch(() => props.step, (newStep) => {
  editingStep.value = { ...newStep };
  selectorType.value = newStep.selector?.type || 'ai';
  selectorValue.value = newStep.selector?.value || '';
  paramsValue.value = newStep.params?.value || '';
  paramsTimeout.value = newStep.params?.timeout || 3000;
  paramsDirection.value = newStep.params?.direction || 'down';
  paramsDistance.value = newStep.params?.distance || 500;
}, { deep: true });
</script>

<style scoped>
.step-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.step-editor-modal {
  width: 520px;
  max-height: 90vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  color: #999;
}

.btn-close:hover {
  background: #f5f5f5;
  color: #333;
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group > label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
}

.form-input:focus {
  outline: none;
  border-color: #1890ff;
}

.form-input.small {
  width: 100px;
}

.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}

.form-select.small {
  width: 100px;
}

.form-hint {
  font-size: 12px;
  color: #1890ff;
  margin-top: 6px;
}

.selector-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.selector-type-option {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.selector-type-option.active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.selector-type-option input {
  display: none;
}

.params-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #666;
}

.params-row .form-input,
.params-row .form-select {
  flex: 1;
}

.unit {
  font-size: 12px;
  color: #999;
}

.error-options {
  display: flex;
  gap: 12px;
}

.error-option {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.error-option.active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.error-option input {
  display: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e8e8e8;
}

.btn-secondary {
  padding: 10px 24px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.btn-primary {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  background: #1890ff;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary:hover {
  background: #40a9ff;
}
</style>
