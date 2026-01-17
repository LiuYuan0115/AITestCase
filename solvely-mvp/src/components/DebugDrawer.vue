<template>
  <div v-if="isOpen" class="debug-drawer-overlay" @click.self="close">
    <div class="debug-drawer" @click.stop>
      <div class="debug-drawer-header">
        <h3>📚 文档调试面板</h3>
        <button class="debug-drawer-close" @click="close">×</button>
      </div>
      
      <div class="debug-drawer-tabs">
        <button 
          class="debug-tab" 
          :class="{ active: activeTab === 'docs' }"
          @click="activeTab = 'docs'"
        >
          文档列表
        </button>
        <button 
          class="debug-tab" 
          :class="{ active: activeTab === 'request' }"
          @click="activeTab = 'request'"
        >
          最近请求
        </button>
      </div>

      <!-- Tab 1: 文档列表 -->
      <div v-if="activeTab === 'docs'" class="debug-drawer-content">
        <div v-if="loading" class="debug-loading">加载中...</div>
        <div v-else-if="docs.length === 0" class="debug-empty">暂无文档</div>
        <div v-else class="debug-docs-list">
          <div v-for="doc in docs" :key="doc.docId" class="debug-doc-item">
            <div class="debug-doc-header">
              <span class="debug-doc-title">{{ doc.title || '(无标题)' }}</span>
              <span class="debug-doc-kind">{{ doc.kind || 'unknown' }}</span>
            </div>
            <div class="debug-doc-meta">
              <span v-if="doc.logicalId" class="debug-doc-logical-id">logicalId: {{ doc.logicalId }}</span>
              <span class="debug-doc-length">{{ formatBytes(doc.length || 0) }}</span>
              <span class="debug-doc-date">{{ formatDate(doc.createdAt) }}</span>
            </div>
            <div class="debug-doc-actions">
              <button @click="copyToClipboard(doc.docId)" class="debug-btn-small">复制 docId</button>
              <button v-if="doc.logicalId" @click="copyToClipboard(doc.logicalId)" class="debug-btn-small">复制 logicalId</button>
              <button @click="previewDoc(doc.docId)" class="debug-btn-small">预览</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: 最近请求 -->
      <div v-if="activeTab === 'request'" class="debug-drawer-content">
        <div v-if="!lastRequest" class="debug-empty">暂无请求记录</div>
        <div v-else class="debug-request-info">
          <div class="debug-request-section">
            <h4>请求信息</h4>
            <div class="debug-info-row">
              <span class="debug-label">类型:</span>
              <span>{{ lastRequest.type || 'unknown' }}</span>
            </div>
            <div class="debug-info-row">
              <span class="debug-label">指令:</span>
              <span>{{ lastRequest.instruction || '(无)' }}</span>
            </div>
            <div v-if="lastRequest.mainDocId" class="debug-info-row">
              <span class="debug-label">主文档:</span>
              <code class="debug-code">{{ lastRequest.mainDocId }}</code>
            </div>
          </div>

          <div v-if="lastRequest.usedDocRefs && lastRequest.usedDocRefs.length > 0" class="debug-request-section">
            <h4>实际使用的文档 ({{ lastRequest.usedDocRefs.length }})</h4>
            <div v-for="(ref, idx) in lastRequest.usedDocRefs" :key="idx" class="debug-doc-ref">
              <div class="debug-doc-ref-header">
                <span class="debug-doc-ref-title">{{ ref.title || '(无标题)' }}</span>
                <span class="debug-doc-ref-kind">{{ ref.kind }}</span>
              </div>
              <div class="debug-doc-ref-meta">
                <code class="debug-code-small">{{ ref.docId }}</code>
                <span v-if="ref.logicalId" class="debug-doc-ref-logical-id">{{ ref.logicalId }}</span>
              </div>
            </div>
          </div>

          <div v-if="lastRequest.generatedDocRef" class="debug-request-section">
            <h4>生成的文档</h4>
            <div class="debug-doc-ref">
              <div class="debug-doc-ref-header">
                <span class="debug-doc-ref-title">{{ lastRequest.generatedDocRef.title || '(无标题)' }}</span>
                <span class="debug-doc-ref-kind">{{ lastRequest.generatedDocRef.kind }}</span>
              </div>
              <div class="debug-doc-ref-meta">
                <code class="debug-code-small">{{ lastRequest.generatedDocRef.docId }}</code>
                <span v-if="lastRequest.generatedDocRef.logicalId" class="debug-doc-ref-logical-id">{{ lastRequest.generatedDocRef.logicalId }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 预览弹窗 -->
      <div v-if="previewDocId" class="debug-preview-overlay" @click.self="previewDocId = null">
        <div class="debug-preview" @click.stop>
          <div class="debug-preview-header">
            <h4>文档预览</h4>
            <button @click="previewDocId = null">×</button>
          </div>
          <div v-if="previewLoading" class="debug-loading">加载中...</div>
          <div v-else-if="previewContent" class="debug-preview-content">
            <pre>{{ previewContent }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { listSessionDocs, getDocContent } from '@/utils/docStoreApi';
import type { DocRef } from '@/utils/refRegistry';

const props = defineProps<{
  sessionId: string;
  lastRequest?: {
    type?: string;
    instruction?: string;
    mainDocId?: string;
    usedDocRefs?: DocRef[];
    generatedDocRef?: DocRef;
  };
}>();

const emit = defineEmits<{
  close: [];
}>();

const isOpen = ref(false);
const activeTab = ref<'docs' | 'request'>('docs');
const docs = ref<any[]>([]);
const loading = ref(false);
const previewDocId = ref<string | null>(null);
const previewContent = ref<string>('');
const previewLoading = ref(false);

const open = () => {
  isOpen.value = true;
  if (activeTab.value === 'docs') {
    loadDocs();
  }
};

const close = () => {
  isOpen.value = false;
  previewDocId.value = null;
  emit('close');
};

const loadDocs = async () => {
  if (!props.sessionId) return;
  loading.value = true;
  try {
    const response = await listSessionDocs(props.sessionId);
    docs.value = response.docs || [];
  } catch (error) {
    console.error('[DebugDrawer] 加载文档列表失败:', error);
    docs.value = [];
  } finally {
    loading.value = false;
  }
};

const previewDoc = async (docId: string) => {
  previewDocId.value = docId;
  previewLoading.value = true;
  previewContent.value = '';
  try {
    const response = await getDocContent(docId);
    if (response.status === 'success' && response.content) {
      previewContent.value = response.content;
    } else {
      previewContent.value = '无法加载文档内容';
    }
  } catch (error) {
    console.error('[DebugDrawer] 加载文档内容失败:', error);
    previewContent.value = '加载失败';
  } finally {
    previewLoading.value = false;
  }
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert(`已复制: ${text}`);
  } catch (error) {
    console.error('[DebugDrawer] 复制失败:', error);
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (timestamp?: number): string => {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleString('zh-CN');
};

watch(() => activeTab.value, (newTab) => {
  if (newTab === 'docs' && isOpen.value) {
    loadDocs();
  }
});

defineExpose({ open, close });
</script>

<style scoped>
.debug-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.debug-drawer {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.debug-drawer-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debug-drawer-header h3 {
  margin: 0;
  font-size: 18px;
}

.debug-drawer-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
}

.debug-drawer-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.debug-tab {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 14px;
}

.debug-tab.active {
  border-bottom-color: #5D6AB4;
  color: #5D6AB4;
  font-weight: bold;
}

.debug-drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.debug-loading, .debug-empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.debug-docs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.debug-doc-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
}

.debug-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.debug-doc-title {
  font-weight: bold;
  font-size: 14px;
}

.debug-doc-kind {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.debug-doc-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.debug-doc-actions {
  display: flex;
  gap: 8px;
}

.debug-btn-small {
  padding: 4px 8px;
  font-size: 12px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.debug-btn-small:hover {
  background: #e0e0e0;
}

.debug-request-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.debug-request-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.debug-info-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.debug-label {
  font-weight: bold;
  min-width: 80px;
}

.debug-code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.debug-code-small {
  font-size: 11px;
}

.debug-doc-ref {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.debug-doc-ref-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.debug-doc-ref-title {
  font-weight: bold;
  font-size: 14px;
}

.debug-doc-ref-kind {
  background: #e3f2fd;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.debug-doc-ref-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.debug-doc-ref-logical-id {
  background: #fff3e0;
  padding: 2px 6px;
  border-radius: 4px;
}

.debug-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.debug-preview {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.debug-preview-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debug-preview-header h4 {
  margin: 0;
}

.debug-preview-header button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

.debug-preview-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.debug-preview-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 12px;
  line-height: 1.5;
}
</style>





