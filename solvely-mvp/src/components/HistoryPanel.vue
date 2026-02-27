<template>
  <div class="history-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span class="title-icon">📜</span>
        <span>历史记录</span>
      </div>
      <div class="panel-actions">
        <button class="btn-icon" @click="loadStats" :disabled="isLoading" v-tooltip="'刷新'">
          <span :class="{ 'spinning': isLoading }">🔄</span>
        </button>
      </div>
    </div>

    <div class="search-box">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="🔍 搜索历史用例..."
        @keyup.enter="search"
      />
      <button class="btn-search" @click="search" :disabled="isSearching || !searchQuery.trim()">
        {{ isSearching ? '搜索中...' : '搜索' }}
      </button>
    </div>

    <div class="stats-bar" v-if="stats">
      <div class="stat-item">
        <span class="stat-value">{{ stats.totalHistoryCases }}</span>
        <span class="stat-label">历史用例</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.totalSessionDocs }}</span>
        <span class="stat-label">会话文档</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.totalCompanyKnowledge }}</span>
        <span class="stat-label">知识库</span>
      </div>
    </div>

    <div class="panel-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="!hasSearched" class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">输入关键词搜索历史用例</div>
        <div class="empty-hint">如：登录、支付、注册</div>
      </div>

      <div v-else-if="searchResults.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">未找到匹配的历史用例</div>
        <div class="empty-hint">尝试其他关键词</div>
      </div>

      <div v-else class="results-list">
        <div
          v-for="(result, index) in searchResults"
          :key="index"
          class="result-item"
          @click="previewResult(result)"
        >
          <div class="result-icon">📄</div>
          <div class="result-info">
            <div class="result-title">{{ result.metadata?.title || result.title || '历史用例' }}</div>
            <div class="result-preview">{{ truncateContent(result.content) }}</div>
            <div class="result-meta">
              <span v-if="result.similarity" class="result-score">相似度: {{ (result.similarity * 100).toFixed(1) }}%</span>
              <span v-if="result.metadata?.archived_at" class="result-date">{{ formatArchivedAt(result.metadata.archived_at) }}</span>
            </div>
          </div>
          <div class="result-actions">
            <button class="btn-tiny" @click.stop="useResult(result)" v-tooltip="'使用此用例'">📋</button>
            <button class="btn-tiny btn-delete" @click.stop="confirmDeleteResult(result, index)" v-tooltip="'删除'">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="previewingResult" class="preview-overlay" @click.self="previewingResult = null">
      <div class="preview-modal">
        <div class="preview-header">
          <h4>{{ previewingResult?.metadata?.title || previewingResult?.title || '历史用例详情' }}</h4>
          <div class="preview-actions">
            <button class="btn-use" @click="useResult(previewingResult); previewingResult = null">
              使用此用例
            </button>
            <button class="btn-close" @click="previewingResult = null">×</button>
          </div>
        </div>
        <div class="preview-content">
          <pre>{{ previewingResult?.content }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getAgentUrl, buildHeaders } from '@/utils/agentUrl';
import { deleteDoc } from '@/utils/docStoreApi';

interface HistoryResult {
  id?: string;
  content: string;
  title?: string;
  module?: string;
  score?: number;
  similarity?: number;  // API 实际返回的字段名
  createdAt?: number;
  metadata?: {
    title?: string;
    kind?: string;
    tags?: string;
    archived_at?: string;
    source_doc_id?: string;
    source_session_id?: string;
    type?: string;
  };
}

interface HistoryStats {
  totalHistoryCases: number;
  totalSessionDocs: number;
  totalCompanyKnowledge: number;
}

const props = defineProps<{
  sessionId: string;
}>();

const emit = defineEmits<{
  use: [content: string];
}>();

const AGENT_URL = getAgentUrl();

const isLoading = ref(false);
const isSearching = ref(false);
const searchQuery = ref('');
const searchResults = ref<HistoryResult[]>([]);
const hasSearched = ref(false);
const stats = ref<HistoryStats | null>(null);
const previewingResult = ref<HistoryResult | null>(null);

// 加载统计信息
async function loadStats() {
  isLoading.value = true;
  try {
    const res = await fetch(`${AGENT_URL}/api/history/stats`, {
      headers: buildHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      // API 返回 { status, stats: {...} }，需要先提取 stats 对象
      const statsData = data.stats || data;
      stats.value = {
        totalHistoryCases: statsData.total_history_cases || statsData.totalHistoryCases || 0,
        totalSessionDocs: statsData.total_session_docs || statsData.totalSessionDocs || 0,
        totalCompanyKnowledge: statsData.total_company_knowledge || statsData.totalCompanyKnowledge || 0
      };
    } else if (res.status === 404 || res.status === 501) {
      // API 未实现，使用默认值
      console.warn('[HistoryPanel] /api/history/stats not available');
      stats.value = { totalHistoryCases: 0, totalSessionDocs: 0, totalCompanyKnowledge: 0 };
    }
  } catch (e) {
    console.error('[HistoryPanel] Load stats error:', e);
    stats.value = { totalHistoryCases: 0, totalSessionDocs: 0, totalCompanyKnowledge: 0 };
  } finally {
    isLoading.value = false;
  }
}

// 搜索历史用例
async function search() {
  const query = searchQuery.value.trim();
  if (!query) return;

  isSearching.value = true;
  hasSearched.value = true;
  searchResults.value = [];

  try {
    const params = new URLSearchParams({
      query,
      top_k: '10'
    });

    const res = await fetch(`${AGENT_URL}/api/history/search?${params}`, {
      headers: buildHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      searchResults.value = data.results || [];
    } else if (res.status === 404 || res.status === 501) {
      console.warn('[HistoryPanel] /api/history/search not available');
      searchResults.value = [];
    }
  } catch (e) {
    console.error('[HistoryPanel] Search error:', e);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

// 预览结果
function previewResult(result: HistoryResult) {
  previewingResult.value = result;
}

// 使用历史用例
function useResult(result: HistoryResult | null) {
  if (result?.content) {
    emit('use', result.content);
  }
}

// 确认删除历史用例
function confirmDeleteResult(result: HistoryResult, index: number) {
  const title = result.metadata?.title || result.title || '该历史用例';
  if (confirm(`确定要删除「${title}」吗？此操作不可撤销。`)) {
    handleDeleteResult(result, index);
  }
}

// 删除历史用例
async function handleDeleteResult(result: HistoryResult, index: number) {
  // 获取文档 ID（可能来自 id 或 metadata.source_doc_id）
  const docId = result.id || result.metadata?.source_doc_id;
  if (!docId) {
    alert('无法删除：未找到文档 ID');
    return;
  }

  try {
    await deleteDoc(docId, props.sessionId);
    // 从搜索结果中移除
    searchResults.value.splice(index, 1);
    // 更新统计
    if (stats.value && stats.value.totalHistoryCases > 0) {
      stats.value.totalHistoryCases--;
    }
  } catch (e) {
    console.error('[HistoryPanel] Delete error:', e);
    alert('删除失败: ' + (e instanceof Error ? e.message : '未知错误'));
  }
}

// 截断内容用于预览
function truncateContent(content?: string, maxLength: number = 100): string {
  if (!content) return '(无内容)';
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...';
}

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN');
}

// 格式化归档时间（ISO 字符串格式）
function formatArchivedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN');
  } catch {
    return isoString;
  }
}

onMounted(() => {
  loadStats();
});

defineExpose({ search, loadStats });
</script>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.title-icon {
  font-size: 18px;
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  background: none;
  border: 1px solid #e5e7eb;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.search-box {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.search-box input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.search-box input:focus {
  border-color: #5D6AB4;
}

.btn-search {
  padding: 8px 16px;
  background: #5D6AB4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-search:hover:not(:disabled) {
  background: #4c5a9a;
}

.btn-search:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.stats-bar {
  display: flex;
  justify-content: space-around;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #5D6AB4;
}

.stat-label {
  font-size: 11px;
  color: #6b7280;
}

.panel-content {
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

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  gap: 12px;
  transition: all 0.2s;
}

.result-item:hover {
  background: #f9fafb;
  border-color: #5D6AB4;
}

.result-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.result-preview {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.result-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #9ca3af;
}

.result-score {
  background: #dbeafe;
  color: #1d4ed8;
  padding: 2px 6px;
  border-radius: 4px;
}

.result-actions {
  flex-shrink: 0;
}

.btn-tiny {
  background: none;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  font-size: 16px;
  padding: 6px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-tiny:hover {
  background: #f3f4f6;
}

.btn-tiny.btn-delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.preview-overlay {
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

.preview-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
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
  flex: 1;
}

.preview-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-use {
  padding: 6px 12px;
  background: #5D6AB4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-use:hover {
  background: #4c5a9a;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
}

.btn-close:hover {
  color: #374151;
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
</style>
