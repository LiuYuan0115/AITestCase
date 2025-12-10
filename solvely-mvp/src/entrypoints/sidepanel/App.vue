<template>
  <!-- Landing View -->
  <div v-if="projectState.currentStep === ''" class="landing-container">
    <div class="welcome-box">
      <h1 class="landing-title">AI Test Case</h1>
      <p class="landing-desc">全自动需求分析与测试用例生成</p>
      <button @click="enterWorkflow" class="btn-primary start-btn">
        ✨ 需求 Workflow
      </button>
      <button @click="enterAutoTest" class="btn-secondary start-btn" style="margin-top: 12px;">
        🤖 自动化测试
      </button>
    </div>
  </div>

  <!-- Workflow View -->
  <div v-else class="main-layout">
    <!-- Left Panel: Control & Chat -->
    <div class="left-panel">
      <div class="header">
        <div class="header-top">
          <button v-if="projectState.currentStep === 'setup'" @click="projectState.currentStep = ''" class="back-btn">←</button>
          <h2>需求 Workflow</h2>
        </div>
        <div class="step-indicator glass-container">
          <div 
            class="glass-btn" 
            :class="{ active: ['analyzing', 'content_review'].includes(projectState.currentStep) }"
            @click="goToStep('content_review')"
          >1.分析</div>
          
          <div class="glass-separator">→</div>

          <div 
            class="glass-btn" 
            :class="{ active: ['optimizing', 'prd_review'].includes(projectState.currentStep) }"
            @click="goToStep('prd_review')"
          >2.PRD</div>

          <div class="glass-separator">→</div>

          <div 
            class="glass-btn" 
            :class="{ active: projectState.currentStep === 'test_point' }"
            @click="goToStep('test_point')"
          >3.测试点</div>

          <div class="glass-separator">→</div>

          <div 
            class="glass-btn" 
            :class="{ active: projectState.currentStep === 'test_case' }"
            @click="goToStep('test_case')"
          >4.用例</div>

          <div class="glass-separator">→</div>

          <div 
            class="glass-btn" 
            :class="{ active: projectState.currentStep === 'auto_test' }"
            @click="goToStep('auto_test')"
          >5.测试</div>
        </div>
      </div>

      <div class="chat-container" ref="chatContainer">
        <div v-for="(msg, idx) in messages" :key="idx" :class="['msg', msg.role]">
          <div class="msg-content" v-html="renderMarkdown(msg.content)"></div>
          <!-- 撤回按钮：仅对可撤回的 AI 编辑操作显示 -->
          <button 
            v-if="msg.canUndo && msg.role === 'ai'" 
            @click="msg.actionType === 'testcase_edit' ? undoTestCaseEdit(idx) : undoPrdEdit(idx)" 
            class="undo-btn"
            title="撤回此操作"
          >
            ↩️ 撤回
          </button>
        </div>
        <div v-if="isProcessing" class="msg ai">
          <div class="typing-indicator">{{ statusText || 'AI 正在思考...' }}</div>
          <div class="progress-bar" v-if="progress > 0">
             <div :style="{width: progress + '%'}" class="progress-fill"></div>
          </div>
        </div>
      </div>

      <div class="controls">
        <!-- Step: Setup (was initial step) -->
        <div v-if="projectState.currentStep === 'setup'" class="control-group">
          <button @click="startAnalysis" class="btn-primary" :disabled="isProcessing">
            {{ isProcessing ? '分析中...' : '开始全页分析' }}
          </button>
        </div>

        <!-- Step 1.5: Content Review (Raw DOM) -->
        <div v-else-if="projectState.currentStep === 'content_review'" class="control-group">
            <div class="info-box" style="font-size:12px; color:#666; background:#eee; padding:8px; border-radius:4px;">
                已提取原始数据，请在右侧修正后继续。
            </div>
            <div style="display: flex; gap: 8px;">
                <button @click="optimizePRD" class="btn-primary" style="flex: 1;" :disabled="isProcessing">✨ 优化需求文档</button>
                <button v-if="hasGeneratedPRD" @click="forwardToPRDReview" class="btn-secondary" style="padding: 10px 14px;" title="返回 PRD 预览" :disabled="isProcessing">→</button>
            </div>
        </div>

        <!-- Step 1: PRD Review -->
        <div v-else-if="projectState.currentStep === 'prd_review'" class="control-group">
          <!-- PRD Agent 输入框 -->
          <div class="prd-agent-input">
            <div style="display:flex; gap:5px; margin-bottom:8px;">
              <input 
                v-model="prdAgentInput" 
                @keydown.enter="sendPrdAgentMessage"
                placeholder="PRD智能助手：删除模块、检测冲突、识别风险..." 
                class="input-field" 
                style="flex:1;" 
                :disabled="isProcessing" 
              />
              <button @click="sendPrdAgentMessage" class="btn-primary" style="padding: 10px 12px;" :disabled="isProcessing || !prdAgentInput">
                发送
              </button>
            </div>
            <div class="agent-hints">
              <span @click="prdAgentInput = '检测当前PRD的逻辑冲突'">🔍 检测冲突</span>
              <span @click="prdAgentInput = '识别潜在风险点'">⚠️ 识别风险</span>
              <span @click="prdAgentInput = '结构化输出功能点'">📋 功能点</span>
            </div>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button @click="backToContentReview" class="btn-secondary" style="padding: 10px 14px;" title="返回修改提取内容" :disabled="isProcessing">←</button>
            <button @click="regeneratePRD" class="btn-secondary" style="flex: 1;" :disabled="isProcessing">重新优化 PRD</button>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
             <button @click="proceedToTestPoints" class="btn-secondary" style="flex: 1;" :disabled="isProcessing">生成测试点</button>
             <button @click="proceedToTestCasesFromPRD" class="btn-primary" style="flex: 1;" :disabled="isProcessing">直接生成用例</button>
          </div>
          <!-- Forward navigation if already generated -->
           <div v-if="hasGeneratedTestPoints || hasGeneratedTestCases" style="display: flex; gap: 8px; margin-top: 8px;">
               <button v-if="hasGeneratedTestPoints" @click="forwardToTestPoints" class="btn-secondary" style="flex:1; font-size:12px;">查看测试点</button>
               <button v-if="hasGeneratedTestCases" @click="forwardToTestCases" class="btn-secondary" style="flex:1; font-size:12px;">查看测试用例</button>
           </div>
        </div>

        <!-- Step 2: Test Points Review -->
        <div v-else-if="projectState.currentStep === 'test_point'" class="control-group">
          <div style="display: flex; gap: 8px;">
            <button @click="backToPRD" class="btn-secondary" style="padding: 10px 14px;" title="返回修改 PRD" :disabled="isProcessing">←</button>
            <button @click="proceedToTestCases" class="btn-primary" style="flex: 1;" :disabled="isProcessing">确认并生成用例</button>
            <button v-if="hasGeneratedTestCases" @click="forwardToTestCases" class="btn-secondary" style="padding: 10px 14px;" title="返回用例结果" :disabled="isProcessing">→</button>
          </div>
        </div>

        <!-- Step 3: Test Cases Review -->
        <div v-else-if="projectState.currentStep === 'test_case'" class="control-group">
          <!-- Test Case Agent 输入框 -->
          <div class="prd-agent-input">
            <div style="display:flex; gap:5px; margin-bottom:8px;">
              <input 
                v-model="testCaseAgentInput" 
                @keydown.enter="sendTestCaseAgentMessage"
                placeholder="Test Case助手：补充异常场景、评审覆盖率..." 
                class="input-field" 
                style="flex:1;" 
                :disabled="isProcessing" 
              />
              <button @click="sendTestCaseAgentMessage" class="btn-primary" style="padding: 10px 12px;" :disabled="isProcessing || !testCaseAgentInput">
                发送
              </button>
            </div>
            <div class="agent-hints">
              <span @click="testCaseAgentInput = '评审当前用例的覆盖率'">📊 评审用例</span>
              <span @click="testCaseAgentInput = '补充异常测试场景'">⚠️ 补充异常</span>
              <span @click="testCaseAgentInput = '检查逻辑漏洞'">🔍 检查漏洞</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
             <button @click="backToTestPoints" class="btn-secondary" style="padding: 10px 14px;" title="返回修改测试点" :disabled="isProcessing">←</button>
             <button @click="exportResults" class="btn-success" style="flex: 1;">导出结果</button>
          </div>
          <button @click="projectState.currentStep = 'auto_test'" class="btn-primary" style="width: 100%;">进入自动化测试</button>
          <button @click="openFeishu" class="btn-secondary" style="width: 100%;">打开飞书文档</button>
          <button @click="reset" class="btn-text">重置</button>
        </div>

        <!-- Step 4: Auto Test (New) -->
        <div v-else-if="projectState.currentStep === 'auto_test'" class="control-group">
            <!-- UI Agent 输入框 -->
            <div class="prd-agent-input">
                <div class="info-box" style="font-size:11px; color:#555; background:#f0f7ff; padding:8px; border-radius:4px; margin-bottom:10px;">
                    🤖 <strong>UI 自动化测试智能体</strong><br/>
                    <span style="color:#888;">支持：文档生成 | 直接操作浏览器</span>
                </div>
                <div style="display:flex; gap:5px; margin-bottom:8px;">
                    <input 
                        v-model="uiAgentInput" 
                        @keydown.enter="sendUiAgentMessage"
                        placeholder="输入指令（如：点击登录按钮 / 输入admin到用户名）" 
                        class="input-field" 
                        style="flex:1;" 
                        :disabled="isProcessing" 
                    />
                    <button @click="sendUiAgentMessage" class="btn-primary" style="padding: 10px 12px;" :disabled="isProcessing || !uiAgentInput">
                        发送
                    </button>
                </div>
                <!-- 指令模式指示 -->
                <div v-if="uiAgentInput" class="mode-indicator" :class="getUiAgentMode(uiAgentInput)">
                    <span v-if="getUiAgentMode(uiAgentInput) === 'document'">📄 文档模式：将生成测试计划/报告</span>
                    <span v-else>⚡ 操作模式：将直接执行浏览器操作</span>
                </div>
                <!-- 快捷指令 -->
                <div class="agent-hints-group">
                    <div class="hints-label">📄 文档生成：</div>
                    <div class="agent-hints">
                        <span @click="uiAgentInput = '分析当前页面结构'">🔍 分析页面</span>
                        <span @click="uiAgentInput = '生成UI自动化测试计划'">📋 生成计划</span>
                        <span v-if="projectState.documents.uiPlan" @click="uiAgentInput = '执行测试并生成报告'">🚀 执行测试</span>
                        <span v-else style="opacity:0.5;" title="请先生成计划">🚀 执行测试</span>
                    </div>
                </div>
                <div class="agent-hints-group">
                    <div class="hints-label">⚡ 直接操作：</div>
                    <div class="agent-hints">
                        <span @click="uiAgentInput = '点击登录按钮'">👆 点击</span>
                        <span @click="uiAgentInput = '输入admin到用户名输入框'">⌨️ 输入</span>
                        <span @click="uiAgentInput = '截取当前页面'">📸 截图</span>
                        <span @click="uiAgentInput = '跳转到 https://www.baidu.com'">🔗 跳转</span>
                    </div>
                </div>
            </div>
            
            <!-- 截图按钮 -->
            <button @click="showScreenshots" class="btn-secondary" style="width: 100%; margin-bottom:8px;">
                📸 查看截图 <span v-if="screenshotCount > 0">({{ screenshotCount }})</span>
            </button>
            
            <!-- 文档切换按钮 -->
            <div v-if="projectState.documents.uiPlan || projectState.documents.uiReport" style="display:flex; gap:8px; margin-bottom:8px;">
                <button 
                    v-if="projectState.documents.uiPlan" 
                    @click="toggleUiDoc('plan')" 
                    :class="uiViewType === 'plan' ? 'btn-primary' : 'btn-secondary'" 
                    style="flex:1; font-size:12px;"
                >
                    📋 测试计划
                </button>
                <button 
                    v-if="projectState.documents.uiReport" 
                    @click="toggleUiDoc('report')" 
                    :class="uiViewType === 'report' ? 'btn-primary' : 'btn-secondary'" 
                    style="flex:1; font-size:12px;"
                >
                    📊 测试报告
                </button>
            </div>
            
            <!-- 导出按钮 -->
            <div v-if="projectState.documents.uiPlan || projectState.documents.uiReport" style="display:flex; gap:8px; margin-bottom:8px;">
                <button v-if="projectState.documents.uiPlan" @click="exportUiPlan" class="btn-secondary" style="flex:1; font-size:12px;">
                    📥 导出计划
                </button>
                <button v-if="projectState.documents.uiReport" @click="exportUiReport" class="btn-secondary" style="flex:1; font-size:12px;">
                    📥 导出报告
                </button>
            </div>
            
            <button @click="projectState.currentStep = 'test_case'" class="btn-secondary" style="width: 100%;">← 返回测试用例</button>
            <button @click="resetUiAgent" class="btn-text">重置自动化测试</button>
        </div>
        
        <!-- 截图弹窗 -->
        <div v-if="showScreenshotModal" class="screenshot-modal-overlay" @click.self="showScreenshotModal = false">
            <div class="screenshot-modal">
                <div class="screenshot-modal-header">
                    <h3>📸 测试截图</h3>
                    <div style="display:flex; gap:8px;">
                        <button @click="refreshScreenshots" class="btn-secondary" style="font-size:12px; padding:4px 8px;">🔄 刷新</button>
                        <button @click="clearAllScreenshots" class="btn-secondary" style="font-size:12px; padding:4px 8px;">🗑️ 清空</button>
                        <button @click="showScreenshotModal = false" class="btn-text" style="font-size:18px;">×</button>
                    </div>
                </div>
                <div class="screenshot-modal-body">
                    <div v-if="screenshotList.length === 0" class="no-screenshots">
                        暂无截图
                    </div>
                    <div v-else class="screenshot-grid">
                        <div v-for="(ss, idx) in screenshotList" :key="idx" class="screenshot-item" @click="previewScreenshot(ss)">
                            <img :src="ss.base64" :alt="ss.step" />
                            <div class="screenshot-label">{{ ss.step }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 截图预览 -->
        <div v-if="previewingScreenshot" class="screenshot-preview-overlay" @click="previewingScreenshot = null">
            <img :src="previewingScreenshot.base64" :alt="previewingScreenshot.step" />
            <div class="preview-label">{{ previewingScreenshot.step }}</div>
        </div>
      </div>
    </div>

    <!-- Right Panel: Editor & Preview -->
    <div class="right-panel">
      <div class="editor-header">
        <span class="title">{{ currentDocTitle }}</span>
        <div class="tabs">
          <button :class="{ active: viewMode === 'edit' }" @click="viewMode = 'edit'">编辑</button>
          <button :class="{ active: viewMode === 'preview' }" @click="viewMode = 'preview'">预览</button>
        </div>
      </div>
      
      <div class="editor-content">
        <textarea 
          v-show="viewMode === 'edit'"
          v-model="currentDocContent" 
          class="markdown-editor"
          :placeholder="editorPlaceholder"
        ></textarea>
        
        <!-- Markdown Preview (for generic use) -->
        <div 
          v-show="viewMode === 'preview' && !['test_point', 'test_case'].includes(projectState.currentStep)"
          class="markdown-preview"
          v-html="renderMarkdown(currentDocContent)"
        ></div>
        
        <!-- Mind Map Preview (for Test Points / Test Cases) -->
        <MindMapPreview 
            v-if="viewMode === 'preview' && ['test_point', 'test_case'].includes(projectState.currentStep)"
            :content="currentDocContent"
            :type="projectState.currentStep as any"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive } from 'vue';
import { marked } from 'marked';
import { ImageProcessor } from '@/utils/imageProcessor';
import { postRetrieve, ask, uploadImage, prdAgent, clearPrdSession, testCaseAgent, clearTestCaseSession, uiAgent, clearUiSession, getUiScreenshots, clearUiScreenshots } from '@/api';
import MindMapPreview from '@/components/MindMapPreview.vue';

// Step 类型定义
type Step = '' | 'setup' | 'analyzing' | 'content_review' | 'optimizing' | 'prd_review' | 'test_point' | 'test_case' | 'auto_test';

interface ProjectState {
  currentStep: Step;
  inputs: {
    figmaUrl: string;
  };
  assets: {
    screenshotUrl: string;
    domMarkdown: string;
    cdnUrl: string;
    sessionId: string;
  };
  documents: {
    prd: string;
    testPoints: string;
    testCases: string;
    uiPlan: string;
    uiReport: string;
  };
}


// --- State ---
const projectState = reactive<ProjectState>({
  currentStep: '',
  inputs: { figmaUrl: '' },
  assets: { screenshotUrl: '', domMarkdown: '', cdnUrl: '', sessionId: '' },
  documents: { prd: '', testPoints: '', testCases: '', uiPlan: '', uiReport: '' }
});

// 消息类型扩展：支持撤回操作
interface Message {
  role: 'user' | 'ai';
  content: string;
  actionType?: 'edit' | 'delete' | 'add' | 'query' | 'testcase_edit'; // 操作类型
  canUndo?: boolean; // 是否可撤回
  undoData?: string; // 撤回前的 PRD 内容
}

const messages = ref<Message[]>([]);
const isProcessing = ref(false);
const statusText = ref('');
const progress = ref(0);
const viewMode = ref<'edit' | 'preview'>('preview');
const chatContainer = ref<HTMLElement|null>(null);
const hasGeneratedPRD = ref(false); // Track if PRD has been generated at least once
const cachedPRD = ref('');
const hasGeneratedTestPoints = ref(false);
const cachedTestPoints = ref('');
const hasGeneratedTestCases = ref(false);
const cachedTestCases = ref('');
const imageProcessor = new ImageProcessor();
const uiAgentInput = ref('');
const prdAgentInput = ref(''); // PRD 智能体输入
const prdHistory = ref<string[]>([]); // PRD 历史记录，用于撤回
const testCaseAgentInput = ref(''); // Test Case 智能体输入
const testCaseHistory = ref<string[]>([]); // Test Case 历史记录
const uiAgentSessionId = ref(`ui-session-${Date.now()}`);

// ... (Computed)

const currentDocTitle = computed(() => {
  switch (projectState.currentStep) {
    case 'content_review': return '📄 原始提取内容 (可编辑)';
    case 'optimizing': return 'AI 正在优化...';
    case 'prd_review': return '📄 需求文档 (PRD)';
    case 'test_point': return '🎯 测试点拆解';
    case 'test_case': return '🧪 测试用例';
    case 'auto_test': 
      if (uiViewType.value === 'report' && projectState.documents.uiReport) {
        return '📊 UI自动化测试报告';
      } else if (projectState.documents.uiPlan) {
        return '📋 UI自动化测试计划';
      }
      return '🤖 UI自动化测试';
    default: return '等待开始...';
  }
});

const currentDocContent = computed({
  get: () => {
    switch (projectState.currentStep) {
      case 'content_review':
      case 'optimizing':
      case 'prd_review': return projectState.documents.prd;
      case 'test_point': return projectState.documents.testPoints;
      case 'test_case': return projectState.documents.testCases;
      case 'auto_test': return uiViewType.value === 'report' ? projectState.documents.uiReport : projectState.documents.uiPlan;
      default: return '';
    }
  },
  set: (val) => {
    switch (projectState.currentStep) {
      case 'content_review':
      case 'optimizing':
      case 'prd_review': projectState.documents.prd = val; break;
      case 'test_point': projectState.documents.testPoints = val; break;
      case 'test_case': projectState.documents.testCases = val; break;
      case 'auto_test': 
         if (uiViewType.value === 'report') projectState.documents.uiReport = val;
         else projectState.documents.uiPlan = val;
         break;
    }
  }
});

const editorPlaceholder = computed(() => {
  if (!projectState.currentStep || projectState.currentStep === 'setup') return '请点击左侧开始分析...';
  return 'AI 生成的内容将显示在这里，您可以直接编辑...';
});

// --- Helpers ---
const addMessage = (role: 'user' | 'ai', content: string) => {
  messages.value.push({ role, content });
  nextTick(() => {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  });
};

const renderMarkdown = (text: string) => {
    if (!text) return '';
    try {
        // Pre-process: Remove data URIs if they are just hanging around (optional based on legacy code)
        let clean = text.replace(/^data: /gm, '');
        
        // Use marked to render HTML
        // marked.parse returns string | Promise<string>. Since we don't use async extensions, it should be string.
        // We cast to string to be safe or handle promise if needed.
        // But default usage is sync.
        return marked.parse(clean) as string;
    } catch (e) {
        console.error("Markdown render error", e);
        return text;
    }
};

// --- Image Processing Helpers (Stitching) ---
const cropImageTopByRatio = async (dataUrl: string, ratio: number) => {
  if (!dataUrl || !ratio || ratio <= 0) return dataUrl;
  const safeRatio = Math.max(0, Math.min(0.99, ratio));
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot image'));
    image.src = dataUrl;
  });
  const cropPixels = Math.round(img.height * safeRatio);
  if (cropPixels <= 0) return dataUrl;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height - cropPixels;
  ctx.drawImage(img, 0, cropPixels, img.width, img.height - cropPixels, 0, 0, img.width, img.height - cropPixels);
  return canvas.toDataURL('image/png');
};

const cropImageTopPixels = async (dataUrl: string, pixels: number) => {
  if (!dataUrl || !pixels || pixels <= 0) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot image'));
    image.src = dataUrl;
  });
  
  if (pixels >= img.height) return dataUrl;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height - pixels;
  
  ctx.drawImage(img, 0, pixels, img.width, img.height - pixels, 0, 0, img.width, img.height - pixels);
  return canvas.toDataURL('image/png');
};

const removeFinalOverlap = async (screenshots: string[], pageInfo: any) => {
  if (!screenshots.length) return screenshots;
  const { totalHeight, viewportHeight } = pageInfo;
  if (!totalHeight || !viewportHeight) return screenshots;
  const remainder = totalHeight % viewportHeight;
  if (remainder === 0) return screenshots;

  const overlapCss = viewportHeight - remainder;
  const overlapRatio = overlapCss / viewportHeight;
  
  const copy = screenshots.slice();
  copy[copy.length - 1] = await cropImageTopByRatio(copy[copy.length - 1], overlapRatio);
  return copy;
};

const removeRepeatedHeaders = async (screenshots: string[]) => {
  if (screenshots.length < 2) return screenshots;

  const first = screenshots[0];
  const second = screenshots[1];

  const [img1, img2] = await Promise.all([
    new Promise<HTMLImageElement>((resolve) => {
        const i = new Image(); 
        i.onload = () => resolve(i); 
        i.src = first;
    }),
    new Promise<HTMLImageElement>((resolve) => {
        const i = new Image(); 
        i.onload = () => resolve(i); 
        i.src = second;
    })
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = img1.width;
  canvas.height = Math.min(img1.height, 300); // Only check top 300px
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  ctx.drawImage(img1, 0, 0);
  const data1 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img2, 0, 0);
  const data2 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let sameHeight = 0;
  const width = canvas.width;
  
  for (let y = 0; y < canvas.height; y++) {
    let isRowSame = true;
    for (let x = 0; x < width; x += 10) { // Sample every 10px
      const idx = (y * width + x) * 4;
      if (Math.abs(data1[idx] - data2[idx]) > 5 ||
          Math.abs(data1[idx+1] - data2[idx+1]) > 5 ||
          Math.abs(data1[idx+2] - data2[idx+2]) > 5) {
        isRowSame = false;
        break;
      }
    }
    if (isRowSame) {
      sameHeight = y + 1;
    } else {
      break;
    }
  }

  if (sameHeight > 0) {
    console.log(`Detected repeated header height: ${sameHeight}px`);
    const processed = [first];
    for (let i = 1; i < screenshots.length; i++) {
      processed.push(await cropImageTopPixels(screenshots[i], sameHeight));
    }
    return processed;
  }

  return screenshots;
};

// --- Workflow Actions ---

const goToStep = (step: Step) => {
    if (isProcessing.value) return;
    if (projectState.currentStep === step) return; // 防止重复点击

    if (step === 'content_review') {
        // 防止未生成 PRD 时切换丢失 Step1 的编辑内容
        if (hasGeneratedPRD.value) {
            projectState.documents.prd = projectState.assets.domMarkdown;
        }
        projectState.currentStep = 'content_review';
        viewMode.value = 'edit';
    } else if (step === 'prd_review') {
        projectState.currentStep = 'prd_review';
        viewMode.value = 'preview';
        if (hasGeneratedPRD.value) {
            projectState.documents.prd = cachedPRD.value;
        }
    } else if (step === 'test_point') {
        projectState.currentStep = 'test_point';
        viewMode.value = 'preview';
        if (hasGeneratedTestPoints.value) {
            projectState.documents.testPoints = cachedTestPoints.value;
        }
    } else if (step === 'test_case') {
        projectState.currentStep = 'test_case';
        viewMode.value = 'preview';
        if (hasGeneratedTestCases.value) {
            projectState.documents.testCases = cachedTestCases.value;
        }
    } else if (step === 'auto_test') {
        enterAutoTest();
    }
};

const enterWorkflow = () => {
  projectState.currentStep = 'setup';
};

const enterAutoTest = () => {
  projectState.currentStep = 'auto_test';
  uiViewType.value = 'plan';
  addMessage('ai', `🤖 **UI 自动化测试智能体**

欢迎使用 UI 自动化测试功能！

**工作流程：**
1. 📋 **生成测试计划** - 分析当前页面，生成结构化测试计划
2. 🚀 **执行测试** - 根据计划自动执行测试并截图
3. 📊 **生成报告** - 汇总测试结果，生成详细报告

**快速开始：**
- 点击下方"分析页面"了解页面结构
- 点击"生成计划"创建测试计划
- 有计划后，点击"执行测试"开始自动化

**前置条件：**
\`\`\`
✅ 本地 Agent 服务 (Port 8000)
✅ Chrome 调试模式 (Port 9222)
\`\`\``);
};

const captureFullPageAndDOM = async (tabId: number) => {
    statusText.value = "正在获取页面信息...";
    await browser.tabs.sendMessage(tabId, { type: 'PREPARE_PAGE_FOR_SCREENSHOT' });
    const pageInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
    const { totalHeight, viewportHeight } = pageInfo;
    const scrollSteps = Math.ceil(totalHeight / viewportHeight);
    
    const screenshots: string[] = [];
    let domSegments: { markdown: string, images: { url: string, base64: string }[] }[] = [];
    
    // 1. Ensure we start at top
    await browser.tabs.sendMessage(tabId, { type: 'SCROLL_TO_POSITION', position: 0 });
    await new Promise(r => setTimeout(r, 300));

    try {
        for (let i = 0; i < scrollSteps; i++) {
            statusText.value = `正在处理第 ${i + 1}/${scrollSteps} 屏...`;
            progress.value = ((i + 1) / scrollSteps) * 100;
            
            // 1. Scroll to position (Top-down)
            await browser.tabs.sendMessage(tabId, { 
                type: 'SCROLL_TO_POSITION', 
                position: i * viewportHeight 
            });
            
            // 2. Wait for render
            await new Promise(r => setTimeout(r, 500));
            
            // 3. Extract DOM Segment (Current Viewport ONLY)
            const domRes: any = await browser.tabs.sendMessage(tabId, { 
                type: 'GET_DOM',
                onlyInViewport: true
            });
            const segment = domRes.markdown || '';
            const images = domRes.images || [];
            domSegments.push({ markdown: segment, images });

            // 4. Capture Screenshot
            const dataUrl = await browser.tabs.captureVisibleTab(undefined, { format: 'png' });
            screenshots.push(dataUrl);
        }

    } finally {
        await browser.tabs.sendMessage(tabId, { type: 'RESTORE_SCROLL_POSITION', originalPosition: pageInfo.currentScrollY || 0 });
        await browser.tabs.sendMessage(tabId, { type: 'RESTORE_PAGE_AFTER_SCREENSHOT' });
    }
    
    // Merge DOM Segments
    statusText.value = "正在合并文本...";
    let fullDOM = '';
    const allImages: { url: string, base64: string }[] = [];

    for (const seg of domSegments) {
        fullDOM = mergeTextSegments(fullDOM, seg.markdown);
        if (seg.images) {
            allImages.push(...seg.images);
        }
    }
    
    // Upload Images (Feishu & others)
    statusText.value = "正在上传文档图片...";
    
    // Deduplicate images by URL
    const uniqueImages = new Map<string, string>(); // url -> base64
    allImages.forEach(img => {
        if (img.base64 && !uniqueImages.has(img.url)) {
            uniqueImages.set(img.url, img.base64);
        }
    });

    // Upload and map original URL to CDN URL
    const urlMap = new Map<string, string>();
    let imgCount = 0;
    
    for (const [originalUrl, base64] of uniqueImages.entries()) {
        try {
            imgCount++;
            statusText.value = `正在上传图片 (${imgCount}/${uniqueImages.size})...`;
            // Skip if already http(s) and not blob (unless user explicitly wants to re-upload everything)
            // But "blob:" MUST be uploaded.
            // "data:" MUST be uploaded.
            // Feishu images are usually blob: or specific domains.
            
            const cdnUrl = await uploadImage(base64);
            urlMap.set(originalUrl, cdnUrl);
        } catch (e) {
            console.error("Failed to upload image:", originalUrl, e);
        }
    }
    
    // Replace URLs in Markdown
    let processedDOM = fullDOM;
    for (const [original, newUrl] of urlMap.entries()) {
        // Escape regex special chars in original url
        const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedOriginal, 'g');
        processedDOM = processedDOM.replace(regex, newUrl);
    }

    // Process Screenshot
    statusText.value = "正在处理截图...";
    let processed = await removeRepeatedHeaders(screenshots);
    processed = await removeFinalOverlap(processed, pageInfo);
    
    statusText.value = "正在拼接图片...";
    const stitchedImage = await imageProcessor.stitchScreenshots(processed);

    return { screenshot: stitchedImage, dom: processedDOM };
};

const startAnalysis = async () => {
  try {
    isProcessing.value = true;
    progress.value = 0;
    statusText.value = "初始化...";
    addMessage('user', '开始分析页面...');
    projectState.currentStep = 'analyzing';

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) throw new Error("No active tab");

    // 1. Capture Full Page & DOM (Combined Step)
    const captureResult = await captureFullPageAndDOM(tabId);
    
    projectState.assets.screenshotUrl = captureResult.screenshot;
    projectState.assets.domMarkdown = captureResult.dom;
    
    console.log('--------------------------------------------------');
    console.log('Extracted DOM Content:');
    console.log(projectState.assets.domMarkdown);
    console.log('--------------------------------------------------');
    
    addMessage('ai', `全屏截图完成，DOM 提取成功 (${captureResult.dom.length} chars)。`);

    // 2. Upload to Cloud
    statusText.value = "正在上传上下文...";
    const uploadRes = await postRetrieve({
        pictures: [projectState.assets.screenshotUrl],
        dom: projectState.assets.domMarkdown
    });
    projectState.assets.cdnUrl = uploadRes.cdnUrl;
    
    // 3. Review Step
    projectState.documents.prd = projectState.assets.domMarkdown; // Initialize with raw DOM
    projectState.currentStep = 'content_review';
    viewMode.value = 'edit';
    addMessage('ai', '内容提取完成。您可以直接编辑原始数据（剔除无关内容），然后点击“优化需求文档”。');

  } catch (e) {
    console.error(e);
    addMessage('ai', `Error: ${e}`);
    projectState.currentStep = 'setup'; // Revert to setup on error
  } finally {
    isProcessing.value = false;
    progress.value = 0;
    statusText.value = '';
  }
};

const optimizePRD = async () => {
    // Save user edits to raw DOM before optimizing so we can go back
    projectState.assets.domMarkdown = projectState.documents.prd;

    isProcessing.value = true;
    statusText.value = "AI 正在优化文档...";
    projectState.currentStep = 'optimizing';
    addMessage('user', '开始优化需求文档...');

    try {
        // New Ask Interface for PRD
        const aiRes = await ask({
            code: 'plugin_test_testprd',
            type: 'testprd',
            sessionId: projectState.assets.sessionId,
            params: {
                text: projectState.documents.prd, // User edited DOM content
                pictureKeyList: [projectState.assets.cdnUrl], // Screenshot URL
                isImageSolve: true,
                isImageByte64: true
            },
            onMessage: (text) => {
                 // Optional: Real-time update
                 // Since currentDocContent is computed based on state, we can update state incrementally?
                 // But optimization step usually replaces the whole thing.
            }
        });
        
        projectState.assets.sessionId = aiRes.sessionId;
        projectState.documents.prd = aiRes.answer;
        
        // Cache the result
        cachedPRD.value = aiRes.answer;
        hasGeneratedPRD.value = true;

        projectState.currentStep = 'prd_review';
        viewMode.value = 'preview';
        addMessage('ai', 'PRD 已优化生成，请确认。');
    } catch (e) {
         console.error(e);
         addMessage('ai', '优化失败，请重试。');
         projectState.currentStep = 'content_review';
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

const backToContentReview = () => {
    // Restore raw DOM content
    projectState.documents.prd = projectState.assets.domMarkdown;
    projectState.currentStep = 'content_review';
    viewMode.value = 'edit';
    addMessage('user', '返回修改提取内容...');
};

const forwardToPRDReview = () => {
    if (hasGeneratedPRD.value) {
        projectState.documents.prd = cachedPRD.value;
        projectState.currentStep = 'prd_review';
        viewMode.value = 'preview';
        addMessage('user', '返回 PRD 预览...');
    }
};

const regeneratePRD = async () => {
  isProcessing.value = true;
  statusText.value = "正在重新生成...";
  addMessage('user', '重新生成 PRD...');
  
  try {
      // Use ask interface for regeneration
      // Assuming same code/type works
      const aiRes = await ask({
          code: 'plugin_test_testprd', 
          type: 'testprd',
          sessionId: projectState.assets.sessionId,
          params: {
              text: projectState.documents.prd + "\n(请重新生成)",
              pictureKeyList: [projectState.assets.cdnUrl],
              isImageSolve: true,
              isImageByte64: true
          }
      });
      projectState.documents.prd = aiRes.answer;
      addMessage('ai', 'PRD 已更新。');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败，请重试。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const proceedToTestPoints = async () => {
  isProcessing.value = true;
  statusText.value = "正在拆解测试点...";
  addMessage('user', 'PRD 确认无误，生成测试点...');
  
  try {
      // Test Point Generation
      const aiRes = await ask({
          code: 'plugin_test_testpoint',
          type: 'testpoint',
          sessionId: `mvp-${Date.now()}`, // New session
          params: {
              text: projectState.documents.prd, // Send PRD as context
              pictureKeyList: [projectState.assets.cdnUrl], // Optional: keep screenshot context
              isImageSolve: true,
              isImageByte64: true
          }
      });
      
      projectState.documents.testPoints = aiRes.answer;
      cachedTestPoints.value = aiRes.answer;
      hasGeneratedTestPoints.value = true;

      projectState.currentStep = 'test_point';
      viewMode.value = 'preview';
      addMessage('ai', '测试点已拆解，请确认。');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const proceedToTestCasesFromPRD = async () => {
  isProcessing.value = true;
  statusText.value = "正在根据 PRD 生成测试用例...";
  addMessage('user', '跳过测试点，直接生成测试用例...');
  
  try {
      const aiRes = await ask({
          code: 'plugin_test_testcase',
          type: 'testcase',
          sessionId: `mvp-${Date.now()}`, 
          params: {
              text: projectState.documents.prd, // PRD as input
              pictureKeyList: [projectState.assets.cdnUrl],
              isImageSolve: true,
              isImageByte64: true
          }
      });
      
      projectState.documents.testCases = aiRes.answer;
      cachedTestCases.value = aiRes.answer;
      hasGeneratedTestCases.value = true;

      // Reset Test Case Agent Session
      await clearTestCaseSession(testCaseAgentSessionId.value);
      testCaseAgentSessionId.value = `testcase-session-${Date.now()}`;
      testCaseHistory.value = [];

      projectState.currentStep = 'test_case';
      viewMode.value = 'preview';
      addMessage('ai', '测试用例已生成！');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const backToPRD = () => {
  projectState.currentStep = 'prd_review';
  viewMode.value = 'preview'; // Usually we want to see preview when going back
};

const forwardToTestPoints = () => {
    if (hasGeneratedTestPoints.value) {
        projectState.documents.testPoints = cachedTestPoints.value;
        projectState.currentStep = 'test_point';
        viewMode.value = 'preview';
        addMessage('user', '返回测试点预览...');
    }
};

const proceedToTestCases = async () => {
  isProcessing.value = true;
  statusText.value = "正在生成测试用例...";
  addMessage('user', '测试点确认，生成用例...');
  
  const hasFigma = !!projectState.inputs.figmaUrl;
  
  try {
      // Test Case Generation
      const aiRes = await ask({
          code: 'plugin_test_testcase',
          type: 'testcase',
          sessionId: `mvp-${Date.now()}`, // New session
          params: {
              text: projectState.documents.testPoints, // Send Test Points as context
              pictureKeyList: [projectState.assets.cdnUrl], // Optional
              isImageSolve: true,
              isImageByte64: true,
              // Figma link might be useful here if backend supports it, 
              // but standard params only show text/pictureKeyList.
              // I'll append it to text if it exists just in case, or ignore if backend is strict.
              // User instructions say: "modified PRD or Test Points as text".
              // So I will stick to just testPoints.
          }
      });
      
      projectState.documents.testCases = aiRes.answer;
      cachedTestCases.value = aiRes.answer;
      hasGeneratedTestCases.value = true;

      // Reset Test Case Agent Session
      await clearTestCaseSession(testCaseAgentSessionId.value);
      testCaseAgentSessionId.value = `testcase-session-${Date.now()}`;
      testCaseHistory.value = [];

      projectState.currentStep = 'test_case';
      viewMode.value = 'preview';
      addMessage('ai', '测试用例已生成！');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const backToTestPoints = () => {
  projectState.currentStep = 'test_point';
  viewMode.value = 'preview';
};

const forwardToTestCases = () => {
    if (hasGeneratedTestCases.value) {
        projectState.documents.testCases = cachedTestCases.value;
        projectState.currentStep = 'test_case';
        viewMode.value = 'preview';
        addMessage('user', '返回用例结果...');
    }
};

// ================= UI 智能体 (Auto Test) =================

const uiViewType = ref<'plan' | 'report'>('plan');
const showScreenshotModal = ref(false);
const screenshotList = ref<{filename: string; step: string; base64: string}[]>([]);
const screenshotCount = ref(0);
const previewingScreenshot = ref<{step: string; base64: string} | null>(null);

const toggleUiDoc = (type: 'plan' | 'report') => {
    uiViewType.value = type;
    viewMode.value = 'preview';
};

// 显示截图弹窗
const showScreenshots = async () => {
    showScreenshotModal.value = true;
    await refreshScreenshots();
};

// 刷新截图列表
const refreshScreenshots = async () => {
    try {
        const result = await getUiScreenshots();
        if (result.status === 'success') {
            screenshotList.value = result.screenshots;
            screenshotCount.value = result.total;
        }
    } catch (e) {
        console.error('获取截图失败:', e);
    }
};

// 清空所有截图
const clearAllScreenshots = async () => {
    if (!confirm('确定清空所有截图吗？')) return;
    await clearUiScreenshots();
    screenshotList.value = [];
    screenshotCount.value = 0;
    addMessage('ai', '🗑️ 所有截图已清空');
};

// 预览单张截图
const previewScreenshot = (ss: {step: string; base64: string}) => {
    previewingScreenshot.value = ss;
};

// UI Agent 模式检测
const UI_DOCUMENT_KEYWORDS = ['分析页面', '分析当前', '页面分析', '生成计划', '测试计划', '执行测试', '自动化测试', '生成报告', '测试报告'];

const getUiAgentMode = (input: string): 'document' | 'action' => {
    if (!input) return 'action';
    return UI_DOCUMENT_KEYWORDS.some(keyword => input.includes(keyword)) ? 'document' : 'action';
};

const sendUiAgentMessage = async () => {
    if (!uiAgentInput.value || isProcessing.value) return;

    // 1. 获取当前标签页 URL
    let currentUrl = '';
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab?.url || '';
    } catch (e) {
        console.warn("无法获取标签页信息");
    }

    const userInput = uiAgentInput.value;
    uiAgentInput.value = '';

    addMessage('user', userInput);
    isProcessing.value = true;
    statusText.value = "🤖 UI 自动化智能体运行中...";

    try {
        const result = await uiAgent({
            sessionId: uiAgentSessionId.value,
            instruction: userInput,
            url: currentUrl,
            plan: projectState.documents.uiPlan,
            report: projectState.documents.uiReport
        });

        if (result.status === 'success') {
            // 更新截图数量
            if (result.screenshotCount && result.screenshotCount > 0) {
                screenshotCount.value = result.screenshotCount;
            }
            
            // 更新文档
            if (result.plan) {
                projectState.documents.uiPlan = result.plan;
                uiViewType.value = 'plan';
                addMessage('ai', `✅ **测试计划已生成！**\n\n${result.response}\n\n*右侧可查看完整计划，点击"执行测试"开始自动化测试*`);
            } else if (result.report) {
                projectState.documents.uiReport = result.report;
                uiViewType.value = 'report';
                
                const ssInfo = result.screenshotCount ? `\n\n📸 已捕获 ${result.screenshotCount} 张测试截图，点击左侧"查看截图"按钮查看` : '';
                addMessage('ai', `✅ **测试报告已生成！**\n\n${result.response}${ssInfo}\n\n*右侧可查看完整报告*`);
            } else {
                // 分析类响应
                addMessage('ai', result.response);
            }
            
            // 如果生成了新文档，自动切换到预览
            if (result.type === 'plan_generated' || result.type === 'report_generated') {
                viewMode.value = 'preview';
            }
            
            nextTick(() => {
                if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
            });
        } else {
            addMessage('ai', `❌ **执行失败**\n\n${result.response}`);
        }
    } catch (e: any) {
        console.error("UI Agent Error", e);
        addMessage('ai', `⚠️ **连接失败**

请确保以下服务已启动：

1. **本地 Agent 服务** (Port 8000)
   \`\`\`bash
   cd agent-server && ./run_agent.sh
   \`\`\`

2. **Chrome 调试模式** (Port 9222)
   \`\`\`bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_test"
   \`\`\`

错误信息: ${e.message || e}`);
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

// 导出测试计划
const exportUiPlan = () => {
    if (!projectState.documents.uiPlan) return;
    const blob = new Blob([projectState.documents.uiPlan], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UI自动化测试计划_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addMessage('ai', '📥 测试计划已导出');
};

// 导出测试报告
const exportUiReport = () => {
    if (!projectState.documents.uiReport) return;
    const blob = new Blob([projectState.documents.uiReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UI自动化测试报告_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addMessage('ai', '📥 测试报告已导出');
};

// 重置 UI 自动化测试
const resetUiAgent = async () => {
    if (!confirm("确定重置 UI 自动化测试吗？这将清除测试计划、报告和截图。")) return;
    
    await clearUiSession(uiAgentSessionId.value);
    await clearUiScreenshots();
    uiAgentSessionId.value = `ui-session-${Date.now()}`;
    projectState.documents.uiPlan = '';
    projectState.documents.uiReport = '';
    uiViewType.value = 'plan';
    screenshotCount.value = 0;
    screenshotList.value = [];
    
    addMessage('ai', '🔄 UI 自动化测试已重置（计划、报告、截图已清空）');
};

const exportResults = () => {
  const blob = new Blob([projectState.documents.testCases], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solvely-test-cases-${Date.now()}.md`;
  a.click();
  addMessage('ai', '文件已下载。');
};

const openFeishu = () => {
  // 打开飞书文档（可根据实际需求修改 URL）
  window.open('https://www.feishu.cn/docs', '_blank');
};

const runAutoTest = async () => {
    // Deprecated
};

// ================= PRD 智能体 =================

// URL 检测正则
const URL_REGEX = /(https?:\/\/[^\s]+)/;

// ========== 优化方案：复用"开始全页分析"链路 ==========
// 流程：打开新标签页 → 滚动截图 → DOM提取 → 图片上传入库 → 拼接内容 → 返回内容+CDN URL
// 这样可以保证图片也被处理，AI 能看到完整的页面信息
interface ExtractResult {
    content: string;      // 提取的文本内容（Markdown）
    cdnUrl: string;       // 上传后的截图 CDN URL（用于 AI 识图）
    screenshot: string;   // 拼接后的截图 base64
}

const extractContentFromUrlWithFullAnalysis = async (url: string): Promise<ExtractResult> => {
    let tabId: number | null = null;
    let originalTabId: number | null = null;
    
    try {
        // 记录当前活动标签页，提取完成后切回
        try {
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            originalTabId = activeTab?.id || null;
        } catch {}
        
        addMessage('ai', `🔗 正在新标签页打开: ${url}`);
        addMessage('ai', `💡 将自动执行：滚动页面 → 截图 → 提取内容 → 上传图片`);
        
        // 1. 创建新标签页（用户可见，确保 JS 正常执行）
        const tab = await browser.tabs.create({ 
            url, 
            active: true
        });
        tabId = tab.id || null;
        
        if (!tabId) {
            throw new Error('标签页创建失败');
        }
        
        console.log(`[extractFromUrl] 创建可见标签页: tabId=${tabId}`);
        
        // 2. 等待页面加载完成
        statusText.value = "等待页面加载...";
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('页面加载超时 (45s)')), 45000);
            const listener = (updatedTabId: number, changeInfo: any) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    browser.tabs.onUpdated.removeListener(listener);
                    clearTimeout(timeout);
                    resolve();
                }
            };
            browser.tabs.onUpdated.addListener(listener);
        });
        
        // 3. 等待 SPA 初始渲染
        addMessage('ai', `📄 页面已加载，等待动态内容渲染...`);
        await new Promise(r => setTimeout(r, 3000));
        
        // 4. ========== 复用 captureFullPageAndDOM 的核心逻辑 ==========
        statusText.value = "正在获取页面信息...";
        await browser.tabs.sendMessage(tabId, { type: 'PREPARE_PAGE_FOR_SCREENSHOT' });
        const pageInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
        const { totalHeight, viewportHeight } = pageInfo;
        const scrollSteps = Math.ceil(totalHeight / viewportHeight);
        
        const screenshots: string[] = [];
        let domSegments: { markdown: string, images: { url: string, base64: string }[] }[] = [];
        
        // 确保从顶部开始
        await browser.tabs.sendMessage(tabId, { type: 'SCROLL_TO_POSITION', position: 0 });
        await new Promise(r => setTimeout(r, 300));
        
        addMessage('ai', `🔄 开始全页滚动分析 (共 ${scrollSteps} 屏)...`);
        
        try {
            for (let i = 0; i < scrollSteps; i++) {
                statusText.value = `正在处理第 ${i + 1}/${scrollSteps} 屏...`;
                progress.value = ((i + 1) / scrollSteps) * 100;
                
                // 滚动到位置
                await browser.tabs.sendMessage(tabId, { 
                    type: 'SCROLL_TO_POSITION', 
                    position: i * viewportHeight 
                });
                
                // 等待渲染
                await new Promise(r => setTimeout(r, 500));
                
                // 提取当前视口的 DOM
                const domRes: any = await browser.tabs.sendMessage(tabId, { 
                    type: 'GET_DOM',
                    onlyInViewport: true
                });
                const segment = domRes.markdown || '';
                const images = domRes.images || [];
                domSegments.push({ markdown: segment, images });

                // 截图
                const dataUrl = await browser.tabs.captureVisibleTab(undefined, { format: 'png' });
                screenshots.push(dataUrl);
            }
        } finally {
            await browser.tabs.sendMessage(tabId, { type: 'RESTORE_SCROLL_POSITION', originalPosition: pageInfo.currentScrollY || 0 });
            await browser.tabs.sendMessage(tabId, { type: 'RESTORE_PAGE_AFTER_SCREENSHOT' });
        }
        
        // 5. 合并 DOM 片段
        statusText.value = "正在合并文本...";
        let fullDOM = '';
        const allImages: { url: string, base64: string }[] = [];

        for (const seg of domSegments) {
            fullDOM = mergeTextSegments(fullDOM, seg.markdown);
            if (seg.images) {
                allImages.push(...seg.images);
            }
        }
        
        // 6. 上传文档中的图片
        statusText.value = "正在上传文档图片...";
        
        // 去重
        const uniqueImages = new Map<string, string>();
        allImages.forEach(img => {
            if (img.base64 && !uniqueImages.has(img.url)) {
                uniqueImages.set(img.url, img.base64);
            }
        });

        // 上传并替换 URL
        const urlMap = new Map<string, string>();
        let imgCount = 0;
        
        for (const [originalUrl, base64] of uniqueImages.entries()) {
            try {
                imgCount++;
                statusText.value = `正在上传图片 (${imgCount}/${uniqueImages.size})...`;
                const cdnUrl = await uploadImage(base64);
                urlMap.set(originalUrl, cdnUrl);
            } catch (e) {
                console.error("图片上传失败:", originalUrl, e);
            }
        }
        
        // 替换 Markdown 中的图片 URL
        let processedDOM = fullDOM;
        for (const [original, newUrl] of urlMap.entries()) {
            const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedOriginal, 'g');
            processedDOM = processedDOM.replace(regex, newUrl);
        }

        // 7. 处理截图拼接（复用原有的去重和裁剪逻辑）
        statusText.value = "正在处理截图...";
        let stitchedScreenshot = '';
        
        if (screenshots.length > 0) {
            try {
                if (screenshots.length === 1) {
                    stitchedScreenshot = screenshots[0];
                } else {
                    // 复用原有的截图处理流程：去除重复header + 去除最后一屏重叠
                    let processed = await removeRepeatedHeaders(screenshots);
                    processed = await removeFinalOverlap(processed, pageInfo);
                    
                    statusText.value = "正在拼接截图...";
                    stitchedScreenshot = await imageProcessor.stitchScreenshots(processed);
                }
            } catch (imgErr) {
                console.warn('[extractFromUrl] 截图拼接失败，使用第一张:', imgErr);
                stitchedScreenshot = screenshots[0] || '';
            }
        }

        // 8. 上传拼接后的截图到云端
        statusText.value = "正在上传上下文...";
        const uploadRes = await postRetrieve({
            pictures: [stitchedScreenshot],
            dom: processedDOM
        });
        
        // 最终内容检查
        if (processedDOM.length < 100) {
            throw new Error(`提取内容过少 (${processedDOM.length} 字符)，可能页面需要登录或内容为空`);
        }
        
        addMessage('ai', `✅ 全页分析完成：${processedDOM.length} 字符，${urlMap.size} 张图片已入库`);
        
        return {
            content: processedDOM,
            cdnUrl: uploadRes.cdnUrl,
            screenshot: stitchedScreenshot
        };
        
    } catch (e: any) {
        console.error("[extractFromUrl] 提取失败:", e);
        // 处理各种错误类型（Error, Event, string 等）
        const errMsg = e?.message || e?.type || (typeof e === 'string' ? e : '未知错误');
        throw new Error(`无法提取页面内容: ${errMsg}`);
    } finally {
        // 清理：关闭提取用的标签页
        if (tabId) {
            try {
                await browser.tabs.remove(tabId);
                console.log(`[extractFromUrl] 已关闭标签页: ${tabId}`);
            } catch (closeErr) {
                console.warn('[extractFromUrl] 关闭标签页失败:', closeErr);
            }
        }
        
        // 切回原来的标签页
        if (originalTabId) {
            try {
                await browser.tabs.update(originalTabId, { active: true });
            } catch {}
        }
        
        progress.value = 0;
        statusText.value = '';
    }
};

// PRD Agent 会话 ID（保持上下文连续性）
const prdAgentSessionId = ref(`prd-session-${Date.now()}`);

const sendPrdAgentMessage = async () => {
    if (!prdAgentInput.value || isProcessing.value) return;
    
    const userInput = prdAgentInput.value;
    const urlMatch = userInput.match(URL_REGEX);
    const hasUrl = !!urlMatch;
    const currentPrd = projectState.documents.prd;
    
    // 空状态检查
    if (!currentPrd && !hasUrl) {
        addMessage('ai', '⚠️ 上下文为空。请先在首页点击"开始分析"，或在输入中包含目标网址 (http/https) 以便自动提取。');
        return;
    }
    
    prdAgentInput.value = '';
    
    if (currentPrd) {
        prdHistory.value.push(currentPrd);
    }
    
    addMessage('user', userInput);
    isProcessing.value = true;
    
    try {
        let contextText = currentPrd;
        let cdnUrl = projectState.assets.cdnUrl;
        
        // ========== URL 模式：复用全页分析链路提取内容 ==========
        if (hasUrl) {
            const targetUrl = urlMatch[0];
            
            // 打开新标签页，执行全页分析（滚动+截图+DOM提取+图片上传）
            const extractResult = await extractContentFromUrlWithFullAnalysis(targetUrl);
            
            if (!extractResult.content || extractResult.content.length < 100) {
                throw new Error(`提取内容过少 (${extractResult.content?.length || 0} 字符)`);
            }
            
            // 更新项目状态
            contextText = extractResult.content;
            cdnUrl = extractResult.cdnUrl;
            
            projectState.assets.domMarkdown = extractResult.content;
            projectState.assets.cdnUrl = extractResult.cdnUrl;
            projectState.assets.screenshotUrl = extractResult.screenshot;
            projectState.documents.prd = extractResult.content;
            projectState.currentStep = 'prd_review';
            viewMode.value = 'preview';
        }
        
        statusText.value = "PRD 智能助手分析中...";
        
        // 调用 Agent（带图片上下文）
        const refinedInstruction = hasUrl 
            ? `(系统提示：已完成全页分析，内容和截图已准备就绪) ${userInput}`
            : userInput;
        
        const result = await prdAgent({
            sessionId: prdAgentSessionId.value,
            text: contextText,
            instruction: refinedInstruction,
            pictureKeyList: cdnUrl ? [cdnUrl] : [],
            isImageSolve: true,
            isImageByte64: true
        });
        
        if (result.type === 'delete' || result.type === 'modify' || result.type === 'add') {
            if (result.newPrd) {
                projectState.documents.prd = result.newPrd;
                cachedPRD.value = result.newPrd;
                viewMode.value = 'preview';
            }
            
            messages.value.push({
                role: 'ai',
                content: `✅ ${result.response}\n\n*PRD 已更新，点击"撤回"可恢复*`,
                actionType: result.type as 'edit' | 'delete' | 'add',
                canUndo: true,
                undoData: currentPrd
            });
        } else {
            addMessage('ai', result.response);
        }
        
        nextTick(() => {
            if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        });
        
    } catch (e: any) {
        console.error("PRD Agent Error", e);
        if (e.message?.includes('fetch') || e.name === 'TypeError') {
            addMessage('ai', `⚠️ **服务连接失败**\n\n${e.message || e}`);
        } else {
            addMessage('ai', `❌ 执行失败：${e.message || e}`);
        }
        if (currentPrd) prdHistory.value.pop();
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

// 撤回 PRD 编辑操作
const undoPrdEdit = (msgIndex: number) => {
    const msg = messages.value[msgIndex];
    if (!msg || !msg.canUndo || !msg.undoData) return;
    
    // 恢复 PRD
    projectState.documents.prd = msg.undoData;
    cachedPRD.value = msg.undoData;
    
    // 标记该消息已撤回，不可再次撤回
    msg.canUndo = false;
    msg.content = msg.content.replace('*PRD 已更新，点击"撤回"可恢复*', '*（已撤回）*');
    
    addMessage('ai', '↩️ 操作已撤回，PRD 已恢复到修改前的状态。');
};

// ================= Test Case 智能体 =================

const testCaseAgentSessionId = ref(`testcase-session-${Date.now()}`);

const sendTestCaseAgentMessage = async () => {
    if (!testCaseAgentInput.value || isProcessing.value) return;
    
    const userInput = testCaseAgentInput.value;
    const urlMatch = userInput.match(URL_REGEX);
    const hasUrl = !!urlMatch;
    const currentTestCase = projectState.documents.testCases;
    
    // 空状态检查：无现有用例且无 URL
    if (!currentTestCase && !hasUrl) {
        addMessage('ai', '⚠️ 暂无测试用例上下文。请先通过工作流生成用例，或在输入中包含需求文档网址 (http/https) 以便一键生成。');
        return;
    }
    
    testCaseAgentInput.value = '';
    
    // 仅当有内容时保存历史（用于撤回）
    if (currentTestCase) {
        testCaseHistory.value.push(currentTestCase);
    }
    
    addMessage('user', userInput);
    isProcessing.value = true;
    
    try {
        // ========== URL 模式：一键生成测试用例（复用全页分析链路）==========
        if (hasUrl) {
            const targetUrl = urlMatch[0];
            
            // 1. 打开新标签页，执行全页分析（滚动+截图+DOM提取+图片上传）
            const extractResult = await extractContentFromUrlWithFullAnalysis(targetUrl);
            
            if (!extractResult.content || extractResult.content.length < 100) {
                throw new Error(`提取内容过少 (${extractResult.content?.length || 0} 字符)，页面可能需要登录或内容为空`);
            }
            
            // 保存到项目状态（方便后续使用）
            projectState.assets.domMarkdown = extractResult.content;
            projectState.assets.cdnUrl = extractResult.cdnUrl;
            projectState.assets.screenshotUrl = extractResult.screenshot;
            
            statusText.value = "AI 正在生成测试用例...";
            
            // 2. 调用 ask 接口生成测试用例（带图片上下文）
            const aiRes = await ask({
                code: 'plugin_test_testcase',
                type: 'testcase',
                sessionId: `url-testcase-${Date.now()}`,
                params: {
                    text: extractResult.content,
                    pictureKeyList: [extractResult.cdnUrl],  // 携带截图 CDN URL
                    isImageSolve: true,
                    isImageByte64: true
                }
            });
            
            // 3. 设置测试用例并渲染思维导图
            if (aiRes.answer) {
                projectState.documents.testCases = aiRes.answer;
                cachedTestCases.value = aiRes.answer;
                hasGeneratedTestCases.value = true;
                projectState.currentStep = 'test_case';
                viewMode.value = 'preview';
                
                addMessage('ai', `🎉 **测试用例已生成！**\n\n已完成全页分析（截图+图片入库），右侧已渲染思维导图，共 ${aiRes.answer.length} 字符。`);
            } else {
                throw new Error('AI 返回内容为空');
            }
        } 
        // ========== 普通模式：基于现有用例进行修改/分析 ==========
        else {
            statusText.value = "Test Case 智能助手分析中...";
            
            const result = await testCaseAgent({
                sessionId: testCaseAgentSessionId.value,
                text: currentTestCase,
                instruction: userInput
            });
            
            if (result.type === 'delete' || result.type === 'modify' || result.type === 'add') {
                if (result.newTestcase) {
                    projectState.documents.testCases = result.newTestcase;
                    cachedTestCases.value = result.newTestcase;
                    viewMode.value = 'preview';
                }
                
                messages.value.push({
                    role: 'ai',
                    content: `✅ ${result.response}\n\n*测试用例已更新，点击"撤回"可恢复*`,
                    actionType: 'testcase_edit' as any,
                    canUndo: true,
                    undoData: currentTestCase
                });
            } else {
                addMessage('ai', result.response);
            }
        }
        
        nextTick(() => {
            if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        });
        
    } catch (e: any) {
        console.error("Test Case Agent Error", e);
        addMessage('ai', `❌ 执行失败：${e.message || e}`);
        if (currentTestCase) testCaseHistory.value.pop();
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

const undoTestCaseEdit = (msgIndex: number) => {
    const msg = messages.value[msgIndex];
    if (!msg || !msg.canUndo || !msg.undoData) return;
    
    projectState.documents.testCases = msg.undoData;
    cachedTestCases.value = msg.undoData;
    
    msg.canUndo = false;
    msg.content = msg.content.replace('*测试用例已更新，点击"撤回"可恢复*', '*（已撤回）*');
    
    addMessage('ai', '↩️ 操作已撤回，测试用例已恢复到修改前的状态。');
};

const reset = async () => {
  if(confirm("确定重置所有进度吗？")) {
      // 清除会话上下文
      await clearPrdSession(prdAgentSessionId.value);
      await clearTestCaseSession(testCaseAgentSessionId.value);
      await clearUiSession(uiAgentSessionId.value);
      
      // 生成新的会话 ID
      prdAgentSessionId.value = `prd-session-${Date.now()}`;
      testCaseAgentSessionId.value = `testcase-session-${Date.now()}`;
      uiAgentSessionId.value = `ui-session-${Date.now()}`;
      
      // 重置状态
      projectState.currentStep = '';
      projectState.documents = { prd: '', testPoints: '', testCases: '', uiPlan: '', uiReport: '' };
      projectState.assets = { screenshotUrl: '', domMarkdown: '', cdnUrl: '', sessionId: '' };
      messages.value = [];
      projectState.inputs.figmaUrl = '';
      prdHistory.value = [];
      testCaseHistory.value = [];
      hasGeneratedPRD.value = false;
      hasGeneratedTestPoints.value = false;
      hasGeneratedTestCases.value = false;
      cachedPRD.value = '';
      cachedTestPoints.value = '';
      cachedTestCases.value = '';
      uiViewType.value = 'plan';
  }
};
</script>

<style scoped>
.landing-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f9f9f9;
  text-align: center;
}

.welcome-box {
  padding: 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 80%;
  max-width: 400px;
}

.landing-title {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 24px;
}

.landing-desc {
  margin: 0 0 30px 0;
  color: #666;
  font-size: 14px;
}

.start-btn {
  width: 100%;
  padding: 16px;
  font-size: 18px;
  font-weight: bold;
}

.main-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Left Panel */
.left-panel {
  width: 350px;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  background: #f9f9f9;
}

.header {
  padding: 15px;
  background: white;
  border-bottom: 1px solid #eee;
}
.header-top { display: flex; align-items: center; margin-bottom: 10px; }
.header h2 { margin: 0; font-size: 18px; color: #333; flex: 1; }
.back-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 0 10px 0 0; color: #666; }

/* Glassmorphism Step Indicator */
.step-indicator.glass-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 8px;
    background: linear-gradient(135deg, rgba(240, 244, 255, 0.9) 0%, rgba(230, 233, 240, 0.9) 100%);
    border-radius: 14px;
    margin-top: 8px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.glass-btn {
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.5);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.7);
    color: #666;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    user-select: none;
}

.glass-btn:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(100, 108, 255, 0.15);
    border-color: rgba(100, 108, 255, 0.3);
}

.glass-btn.active {
    background: linear-gradient(135deg, rgba(100, 108, 255, 0.15) 0%, rgba(100, 108, 255, 0.25) 100%);
    border-color: rgba(100, 108, 255, 0.4);
    color: #4a55ff;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(100, 108, 255, 0.2);
}

.glass-separator {
    color: #c0c0c0;
    font-size: 10px;
    font-weight: 300;
    opacity: 0.8;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg {
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
  max-width: 90%;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 代码块样式：固定高度，可滚动 */
.msg :deep(pre) {
  max-height: 200px;
  overflow: auto;
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
}

.msg :deep(code) {
  word-break: break-all;
}
.msg.user {
  background: #e3f2fd;
  align-self: flex-end;
  color: #0d47a1;
}
.msg.ai {
  background: white;
  border: 1px solid #ddd;
  align-self: flex-start;
  color: #333;
}
.typing-indicator {
    font-style: italic;
    color: #888;
    margin-bottom: 5px;
}

.progress-bar { height: 4px; background: #eee; margin-top: 5px; border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: #646cff; transition: width 0.3s; }

.controls {
  padding: 15px;
  background: white;
  border-top: 1px solid #eee;
}
.control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-field {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

/* Buttons */
.btn-primary {
  background: #646cff; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer;
}
.btn-primary:hover { background: #535bf2; }
.btn-primary:disabled { background: #a5a9ff; cursor: not-allowed; }

.btn-secondary {
  background: #f5f5f5; color: #333; border: 1px solid #ddd; padding: 10px; border-radius: 6px; cursor: pointer;
}
.btn-secondary:hover { background: #e0e0e0; }

.btn-success {
  background: #4caf50; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer;
}
.btn-text {
  background: none; border: none; color: #666; cursor: pointer; padding: 5px;
}

/* PRD Agent 输入区域 */
.prd-agent-input {
  background: #f8f9ff;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 10px;
  border: 1px solid #e0e4ff;
}

.agent-hints {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.agent-hints span {
  font-size: 11px;
  color: #646cff;
  background: #eef0ff;
  padding: 4px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.agent-hints span:hover {
  background: #646cff;
  color: white;
}

/* 撤回按钮 */
.undo-btn {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  font-size: 12px;
  background: #fff3e0;
  border: 1px solid #ffb74d;
  border-radius: 4px;
  color: #e65100;
  cursor: pointer;
  transition: all 0.2s;
}

.undo-btn:hover {
  background: #ffe0b2;
}

/* Right Panel */
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  min-width: 0; /* Allows flex child to shrink below content size, enabling scroll */
}

.editor-header {
  padding: 10px 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
}
.editor-header .title {
  font-weight: bold;
  font-size: 14px;
}

.tabs {
  display: flex;
  background: #f0f0f0;
  border-radius: 4px;
  padding: 2px;
}
.tabs button {
  background: none;
  border: none;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 3px;
}
.tabs button.active {
  background: white;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.editor-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.markdown-editor {
  width: 100%;
  height: 100%;
  border: none;
  padding: 15px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.markdown-preview {
  width: 100%;
  height: 100%;
  padding: 15px;
  overflow-y: auto;
  overflow-x: auto;
  box-sizing: border-box;
}

/* Markdown Styles */
.markdown-preview :deep(h1) { font-size: 1.5em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h2) { font-size: 1.3em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h3) { font-size: 1.1em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h4) { font-size: 1em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h5) { font-size: 0.9em; margin-bottom: 0.5em; font-weight: bold; color: #555; }
.markdown-preview :deep(p) { margin-bottom: 1em; line-height: 1.6; }
.markdown-preview :deep(ul), .markdown-preview :deep(ol) { padding-left: 20px; margin-bottom: 1em; }
.markdown-preview :deep(li) { margin-bottom: 0.5em; }

/* Images */
.markdown-preview :deep(img) {
  max-width: 100%;
  border-radius: 4px;
  margin: 10px 0;
  display: block;
}

/* Links */
.markdown-preview :deep(a) {
  color: #646cff;
  word-break: break-all;
  text-decoration: none;
}
.markdown-preview :deep(a):hover {
  text-decoration: underline;
}

/* Tables */
.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
  display: block;
  overflow-x: auto;
}
.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}
.markdown-preview :deep(th) {
  background-color: #f5f5f5;
  font-weight: bold;
}
.markdown-preview :deep(tr:nth-child(even)) {
  background-color: #fafafa;
}

/* Code Blocks */
.markdown-preview :deep(pre) {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1em;
}
.markdown-preview :deep(code) {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  background: rgba(0,0,0,0.05);
  padding: 2px 4px;
  border-radius: 3px;
}
.markdown-preview :deep(pre) :deep(code) {
  background: none;
  padding: 0;
}

/* Screenshot Modal */
.screenshot-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.screenshot-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.screenshot-modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.screenshot-modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.screenshot-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.no-screenshots {
  text-align: center;
  color: #999;
  padding: 40px;
}

.screenshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.screenshot-item {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.screenshot-item:hover {
  border-color: #646cff;
  box-shadow: 0 2px 8px rgba(100,108,255,0.2);
}

.screenshot-item img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
}

.screenshot-label {
  padding: 8px;
  font-size: 11px;
  color: #666;
  background: #f9f9f9;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Screenshot Preview */
.screenshot-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1001;
  cursor: zoom-out;
}

.screenshot-preview-overlay img {
  max-width: 90%;
  max-height: 80%;
  object-fit: contain;
  border-radius: 4px;
}

.preview-label {
  color: white;
  margin-top: 15px;
  font-size: 14px;
}

/* UI Agent Mode Indicator */
.mode-indicator {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.mode-indicator.document {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.mode-indicator.action {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffcc80;
}

/* Agent Hints Group */
.agent-hints-group {
  margin-bottom: 6px;
}

.hints-label {
  font-size: 10px;
  color: #888;
  margin-bottom: 3px;
}

.agent-hints-group .agent-hints {
  margin-bottom: 0;
}
</style>
