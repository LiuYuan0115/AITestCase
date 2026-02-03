<template>
  <div class="doc-version-list">
    <div class="version-header">
      <div class="version-title">
        <span class="title-icon">📋</span>
        <span>版本历史</span>
      </div>
      <button class="btn-close" @click="$emit('close')">×</button>
    </div>

    <div class="version-doc-info">
      <div class="doc-name">{{ docTitle }}</div>
      <div class="doc-id">ID: {{ logicalId || currentDocId?.slice(0, 8) }}...</div>
    </div>

    <div class="version-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载版本历史...</span>
      </div>

      <div v-else-if="versions.length === 0" class="empty-state">
        <div class="empty-icon">📄</div>
        <div class="empty-text">暂无版本历史</div>
        <div class="empty-hint">修改文档后会自动记录版本</div>
      </div>

      <div v-else class="version-list">
        <div
          v-for="(version, index) in versions"
          :key="version.docId"
          class="version-item"
          :class="{
            'current': version.docId === currentDocId,
            'selected': selectedVersions.includes(version.docId)
          }"
          @click="toggleSelect(version.docId)"
        >
          <div class="version-info">
            <div class="version-number">
              v{{ versions.length - index }}
              <span v-if="version.docId === currentDocId" class="current-badge">当前</span>
            </div>
            <div class="version-time">{{ formatTime(version.createdAt) }}</div>
            <div v-if="version.title" class="version-label">{{ version.title }}</div>
          </div>
          <div class="version-actions">
            <button
              v-if="version.docId !== currentDocId"
              class="btn-action"
              @click.stop="rollbackTo(version)"
              title="回滚到此版本"
            >
              ↩️
            </button>
            <button
              class="btn-action"
              @click.stop="previewVersion(version)"
              title="预览内容"
            >
              👁
            </button>
          </div>
        </div>
      </div>

      <!-- 对比按钮 -->
      <div v-if="selectedVersions.length === 2" class="compare-bar">
        <button class="btn-compare" @click="compareSelected">
          对比选中的 {{ selectedVersions.length }} 个版本
        </button>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="previewingVersion" class="preview-overlay" @click.self="previewingVersion = null">
      <div class="preview-modal">
        <div class="preview-header">
          <h4>版本预览 - v{{ getVersionNumber(previewingVersion.docId) }}</h4>
          <button class="btn-close" @click="previewingVersion = null">×</button>
        </div>
        <div class="preview-content">
          <div v-if="previewLoading" class="loading-state">加载中...</div>
          <pre v-else>{{ previewContent }}</pre>
        </div>
        <div class="preview-footer">
          <button
            v-if="previewingVersion.docId !== currentDocId"
            class="btn-rollback"
            @click="rollbackTo(previewingVersion); previewingVersion = null"
          >
            回滚到此版本
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { getAgentUrl, buildHeaders } from '@/utils/agentUrl';

interface VersionInfo {
  docId: string;
  logicalId?: string;
  title?: string;
  createdAt: number;
  length?: number;
}

const props = defineProps<{
  sessionId: string;
  logicalId?: string;
  currentDocId: string;
  docTitle?: string;
}>();

const emit = defineEmits<{
  close: [];
  rollback: [docId: string];
  compare: [docId1: string, docId2: string];
}>();

const AGENT_URL = getAgentUrl();

const isLoading = ref(false);
const versions = ref<VersionInfo[]>([]);
const selectedVersions = ref<string[]>([]);
const previewingVersion = ref<VersionInfo | null>(null);
const previewContent = ref('');
const previewLoading = ref(false);

// 加载版本历史
async function loadVersionHistory() {
  isLoading.value = true;
  try {
    // 获取会话下的所有文档，过滤出同一 logicalId 的版本
    const res = await fetch(`${AGENT_URL}/api/sessions/${props.sessionId}/docs`, {
      headers: buildHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      const docs = data.docs || [];

      // 如果有 logicalId，过滤相关版本
      if (props.logicalId) {
        versions.value = docs
          .filter((d: any) => d.logicalId === props.logicalId)
          .map((d: any) => ({
            docId: d.docId,
            logicalId: d.logicalId,
            title: d.title,
            createdAt: d.createdAt || Date.now() / 1000,
            length: d.length
          }))
          .sort((a: VersionInfo, b: VersionInfo) => b.createdAt - a.createdAt);
      } else {
        // 没有 logicalId，只显示当前文档
        const currentDoc = docs.find((d: any) => d.docId === props.currentDocId);
        if (currentDoc) {
          versions.value = [{
            docId: currentDoc.docId,
            logicalId: currentDoc.logicalId,
            title: currentDoc.title,
            createdAt: currentDoc.createdAt || Date.now() / 1000,
            length: currentDoc.length
          }];
        }
      }
    }
  } catch (e) {
    console.error('[DocVersionList] Load error:', e);
  } finally {
    isLoading.value = false;
  }
}

// 切换选择
function toggleSelect(docId: string) {
  const idx = selectedVersions.value.indexOf(docId);
  if (idx === -1) {
    if (selectedVersions.value.length < 2) {
      selectedVersions.value.push(docId);
    } else {
      // 最多选择 2 个，替换第一个
      selectedVersions.value.shift();
      selectedVersions.value.push(docId);
    }
  } else {
    selectedVersions.value.splice(idx, 1);
  }
}

// 预览版本
async function previewVersion(version: VersionInfo) {
  previewingVersion.value = version;
  previewLoading.value = true;
  previewContent.value = '';

  try {
    const res = await fetch(`${AGENT_URL}/api/docs/${version.docId}`, {
      headers: buildHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      previewContent.value = data.content || '(无内容)';
    }
  } catch (e) {
    previewContent.value = '加载失败';
  } finally {
    previewLoading.value = false;
  }
}

// 回滚到指定版本
async function rollbackTo(version: VersionInfo) {
  if (!props.logicalId) {
    console.warn('[DocVersionList] Cannot rollback without logicalId');
    return;
  }

  try {
    const res = await fetch(`${AGENT_URL}/api/sessions/${props.sessionId}/doc_pointers`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify({
        [props.logicalId]: version.docId
      })
    });

    if (res.ok) {
      emit('rollback', version.docId);
    }
  } catch (e) {
    console.error('[DocVersionList] Rollback error:', e);
  }
}

// 对比选中版本
function compareSelected() {
  if (selectedVersions.value.length === 2) {
    emit('compare', selectedVersions.value[0], selectedVersions.value[1]);
  }
}

// 获取版本号
function getVersionNumber(docId: string): number {
  const idx = versions.value.findIndex(v => v.docId === docId);
  return versions.value.length - idx;
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(() => {
  loadVersionHistory();
});

defineExpose({ loadVersionHistory });
</script>

<style scoped>
.doc-version-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.version-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.title-icon {
  font-size: 18px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px 8px;
}

.btn-close:hover {
  color: #374151;
}

.version-doc-info {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fefce8;
}

.doc-name {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
}

.doc-id {
  font-size: 11px;
  color: #6b7280;
  font-family: monospace;
}

.version-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
  gap: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #5D6AB4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
  gap: 8px;
}

.empty-icon {
  font-size: 48px;
}

.empty-text {
  font-size: 14px;
}

.empty-hint {
  font-size: 12px;
  color: #9ca3af;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.version-item:hover {
  background: #f9fafb;
  border-color: #5D6AB4;
}

.version-item.current {
  background: #eff6ff;
  border-color: #3b82f6;
}

.version-item.selected {
  background: #fef3c7;
  border-color: #f59e0b;
}

.version-info {
  flex: 1;
}

.version-number {
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-badge {
  background: #3b82f6;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.version-time {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.version-label {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.version-actions {
  display: flex;
  gap: 4px;
}

.btn-action {
  background: none;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  font-size: 14px;
  padding: 6px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-action:hover {
  background: #f3f4f6;
}

.compare-bar {
  position: sticky;
  bottom: 0;
  padding: 12px 0;
  background: white;
  border-top: 1px solid #e5e7eb;
  margin-top: 12px;
}

.btn-compare {
  width: 100%;
  padding: 10px 16px;
  background: #5D6AB4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-compare:hover {
  background: #4c5a9a;
}

.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.preview-header h4 {
  margin: 0;
  font-size: 16px;
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.preview-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
  font-family: 'Monaco', 'Menlo', monospace;
}

.preview-footer {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.btn-rollback {
  padding: 8px 16px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-rollback:hover {
  background: #d97706;
}
</style>
