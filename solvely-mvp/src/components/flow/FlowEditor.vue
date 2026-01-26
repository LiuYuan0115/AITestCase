<template>
  <div class="flow-editor">
    <!-- 顶部工具栏 -->
    <div class="flow-toolbar">
      <div class="flow-title-area">
        <input
          v-model="currentFlow.name"
          class="flow-title-input"
          placeholder="流程名称"
          @blur="saveFlowName"
        />
        <span class="flow-category">{{ getCategoryLabel(currentFlow.category) }}</span>
      </div>
      <div class="flow-actions">
        <button class="btn-icon" @click="toggleTemplateLibrary" title="模板库">
          📚
        </button>
        <button class="btn-secondary" @click="exportFlow" title="导出 JSON">
          📤 导出
        </button>
        <button class="btn-secondary" @click="saveAsTemplate" :disabled="!currentFlow.steps.length">
          💾 保存模板
        </button>
        <button 
          class="btn-primary" 
          @click="runFlow" 
          :disabled="isExecuting || !currentFlow.steps.length"
        >
          {{ isExecuting ? '⏳ 执行中...' : '▶️ 运行' }}
        </button>
        <button class="btn-close" @click="$emit('close')" title="关闭">
          ✕
        </button>
      </div>
    </div>

    <div class="flow-main">
      <!-- 左侧：模板库（可折叠） -->
      <div class="flow-sidebar" :class="{ collapsed: !showTemplateLibrary }">
        <TemplateLibrary
          v-if="showTemplateLibrary"
          :templates="templates"
          :selected-id="currentFlow.id"
          @select="loadTemplate"
          @create-new="createNewFlow"
        />
      </div>

      <!-- 中间：编辑区 -->
      <div class="flow-content">
        <!-- 变量配置 -->
        <div class="flow-section">
          <div class="section-header">
            <span>📝 变量配置</span>
            <button class="btn-mini" @click="addVariable">+ 添加变量</button>
          </div>
          <VariableForm
            :variables="currentFlow.variables"
            :values="variableValues"
            @update:values="variableValues = $event"
            @update:variables="updateVariables"
          />
        </div>

        <!-- 步骤列表 -->
        <div class="flow-section steps-section">
          <div class="section-header">
            <span>📋 测试步骤</span>
            <button class="btn-mini" @click="addStep">+ 添加步骤</button>
          </div>
          <StepList
            :steps="currentFlow.steps"
            @update:steps="updateSteps"
            @edit="editStep"
            @delete="deleteStep"
          />
        </div>

        <!-- 执行选项 -->
        <div class="flow-section options-section">
          <div class="section-header">
            <span>⚙️ 执行选项</span>
          </div>
          <div class="options-grid">
            <label class="option-item">
              <input type="checkbox" v-model="currentFlow.options.headless" />
              <span>无头模式</span>
            </label>
            <label class="option-item">
              <input type="checkbox" v-model="currentFlow.options.autoScreenshot" />
              <span>自动截图</span>
            </label>
            <label class="option-item">
              <input type="checkbox" v-model="currentFlow.options.autoHeal" />
              <span>失败自愈</span>
            </label>
            <div class="option-item">
              <span>重试次数:</span>
              <input 
                type="number" 
                v-model.number="currentFlow.options.maxRetries" 
                min="0" 
                max="5"
                class="option-input"
              />
            </div>
            <div class="option-item">
              <span>步骤超时:</span>
              <input 
                type="number" 
                v-model.number="currentFlow.options.stepTimeout" 
                min="1000" 
                step="1000"
                class="option-input"
              />
              <span class="unit">ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 执行结果面板（底部浮层） -->
    <ExecutionPanel
      v-if="showExecutionPanel"
      :result="executionResult"
      :is-executing="isExecuting"
      :progress="executionProgress"
      @close="showExecutionPanel = false"
      @retry="runFlow"
    />

    <!-- 步骤编辑弹窗 -->
    <StepEditor
      v-if="editingStep"
      :step="editingStep"
      @save="saveStep"
      @cancel="editingStep = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import type { FlowConfig, TestStep, VariableDefinition, FlowResult } from '@/types/flow';
import { createEmptyFlow, createDefaultStep, generateStepId, createDefaultOptions } from '@/types/flow';
import { executeFlow, getTemplates, saveTemplate, pollFlowResult } from '@/api/flowApi';
import TemplateLibrary from './TemplateLibrary.vue';
import VariableForm from './VariableForm.vue';
import StepList from './StepList.vue';
import StepEditor from './StepEditor.vue';
import ExecutionPanel from './ExecutionPanel.vue';

// Props & Emits
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'result', result: FlowResult): void;
}>();

// 状态
const currentFlow = reactive<FlowConfig>(createEmptyFlow());
const variableValues = ref<Record<string, string>>({});
const templates = ref<FlowConfig[]>([]);
const showTemplateLibrary = ref(true);
const editingStep = ref<TestStep | null>(null);

// 执行状态
const isExecuting = ref(false);
const showExecutionPanel = ref(false);
const executionResult = ref<FlowResult | null>(null);
const executionProgress = ref(0);

// 类别标签
const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    login: '🔐 登录',
    solve: '🧩 解题',
    payment: '💳 支付',
    custom: '📦 自定义',
  };
  return labels[category] || category;
};

// 加载模板列表
const loadTemplates = async () => {
  const result = await getTemplates();
  if (result.status === 'success') {
    templates.value = result.templates;
  }
};

// 加载模板
const loadTemplate = (template: FlowConfig) => {
  Object.assign(currentFlow, JSON.parse(JSON.stringify(template)));
  // 初始化变量值
  variableValues.value = {};
  currentFlow.variables.forEach((v) => {
    variableValues.value[v.name] = v.defaultValue || '';
  });
};

// 创建新流程
const createNewFlow = () => {
  Object.assign(currentFlow, createEmptyFlow());
  variableValues.value = {};
};

// 保存流程名称
const saveFlowName = () => {
  // 自动保存（可扩展为远程保存）
  console.log('[FlowEditor] Flow name saved:', currentFlow.name);
};

// 切换模板库显示
const toggleTemplateLibrary = () => {
  showTemplateLibrary.value = !showTemplateLibrary.value;
};

// 添加变量
const addVariable = () => {
  const newVar: VariableDefinition = {
    name: `var_${currentFlow.variables.length + 1}`,
    label: `变量 ${currentFlow.variables.length + 1}`,
    type: 'string',
    required: false,
  };
  currentFlow.variables.push(newVar);
};

// 更新变量定义
const updateVariables = (variables: VariableDefinition[]) => {
  currentFlow.variables = variables;
};

// 添加步骤
const addStep = () => {
  const newStep = createDefaultStep(generateStepId());
  newStep.name = `步骤 ${currentFlow.steps.length + 1}`;
  currentFlow.steps.push(newStep);
  editingStep.value = newStep;
};

// 更新步骤列表
const updateSteps = (steps: TestStep[]) => {
  currentFlow.steps = steps;
};

// 编辑步骤
const editStep = (step: TestStep) => {
  editingStep.value = JSON.parse(JSON.stringify(step));
};

// 保存步骤
const saveStep = (step: TestStep) => {
  const index = currentFlow.steps.findIndex((s) => s.id === step.id);
  if (index >= 0) {
    currentFlow.steps[index] = step;
  } else {
    currentFlow.steps.push(step);
  }
  editingStep.value = null;
};

// 删除步骤
const deleteStep = (stepId: string) => {
  const index = currentFlow.steps.findIndex((s) => s.id === stepId);
  if (index >= 0) {
    currentFlow.steps.splice(index, 1);
  }
};

// 导出流程
const exportFlow = () => {
  const json = JSON.stringify(currentFlow, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentFlow.name || 'flow'}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// 保存为模板
const saveAsTemplate = async () => {
  const result = await saveTemplate(currentFlow as FlowConfig);
  if (result.status === 'success') {
    currentFlow.id = result.templateId;
    alert('模板保存成功！');
    loadTemplates(); // 刷新模板列表
  } else {
    alert(`保存失败: ${result.message}`);
  }
};

// 运行流程
const runFlow = async () => {
  if (isExecuting.value || !currentFlow.steps.length) return;

  isExecuting.value = true;
  showExecutionPanel.value = true;
  executionProgress.value = 0;
  executionResult.value = null;

  try {
    // 执行流程
    const response = await executeFlow(
      currentFlow as FlowConfig,
      variableValues.value,
      currentFlow.options
    );

    if (response.status === 'error') {
      throw new Error(response.message || 'Failed to execute flow');
    }

    // 轮询获取结果
    const result = await pollFlowResult(
      response.taskId,
      (progress) => {
        executionProgress.value = progress;
      },
      1000,
      currentFlow.options.flowTimeout || 120000
    );

    if (result) {
      executionResult.value = result;
      emit('result', result);
    } else {
      throw new Error('Execution timeout');
    }
  } catch (error: any) {
    console.error('[FlowEditor] Run flow error:', error);
    alert(`执行失败: ${error.message}`);
  } finally {
    isExecuting.value = false;
    executionProgress.value = 100;
  }
};

// 初始化
onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.flow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
}

/* 工具栏 */
.flow-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.flow-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.flow-title-input {
  font-size: 16px;
  font-weight: 600;
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 4px;
  min-width: 200px;
}

.flow-title-input:hover,
.flow-title-input:focus {
  background: #f0f0f0;
  outline: none;
}

.flow-category {
  font-size: 12px;
  color: #666;
  padding: 2px 8px;
  background: #f0f0f0;
  border-radius: 4px;
}

.flow-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
}

.btn-icon:hover {
  background: #f5f5f5;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background: #1890ff;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.btn-primary:hover {
  background: #40a9ff;
}

.btn-primary:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}

.btn-close {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  color: #999;
}

.btn-close:hover {
  background: #f5f5f5;
  color: #333;
}

/* 主内容区 */
.flow-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 侧边栏 */
.flow-sidebar {
  width: 240px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  overflow-y: auto;
  transition: width 0.2s;
}

.flow-sidebar.collapsed {
  width: 0;
  border-right: none;
}

/* 内容区 */
.flow-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

/* 区块 */
.flow-section {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  color: #333;
}

.btn-mini {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid #1890ff;
  border-radius: 4px;
  background: #fff;
  color: #1890ff;
  cursor: pointer;
}

.btn-mini:hover {
  background: #e6f7ff;
}

/* 步骤区块 */
.steps-section {
  flex: 1;
  min-height: 200px;
}

/* 选项 */
.options-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
}

.option-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.option-input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.unit {
  font-size: 12px;
  color: #999;
}
</style>
