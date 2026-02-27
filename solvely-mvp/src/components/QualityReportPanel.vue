<template>
  <div class="quality-report-panel">
    <!-- 加载状态 -->
    <div v-if="loading" class="report-loading">
      <div class="loading-spinner"></div>
      <span class="loading-text">正在评估测试用例质量...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="report-error">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ error }}</span>
      <button class="btn-retry" @click="$emit('retry')">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!report" class="report-empty">
      <div class="empty-icon">📊</div>
      <div class="empty-title">暂无评估报告</div>
      <div class="empty-desc">生成测试用例后，点击「质量评估」按钮获取报告</div>
    </div>

    <!-- 报告内容 -->
    <div v-else class="report-content">
      <!-- 总分卡片 -->
      <div class="score-card" :class="scoreLevel">
        <div class="score-ring">
          <svg viewBox="0 0 120 120" class="score-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e5e5" stroke-width="8" />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              :stroke="scoreColor"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeOffset"
              class="score-progress"
            />
          </svg>
          <div class="score-value">{{ report.score }}</div>
          <div class="score-label">总分</div>
        </div>
        <div class="score-summary">{{ report.summary }}</div>
      </div>

      <!-- 问题统计条 -->
      <div class="stats-bar">
        <div class="stat-item" :class="{ 'has-issues': report.coverage_gap.length > 0 }">
          <span class="stat-count">{{ report.coverage_gap.length }}</span>
          <span class="stat-label">漏测点</span>
        </div>
        <div class="stat-item" :class="{ 'has-issues': report.logic_issues.length > 0 }">
          <span class="stat-count">{{ report.logic_issues.length }}</span>
          <span class="stat-label">逻辑问题</span>
        </div>
        <div class="stat-item" :class="{ 'has-issues': report.duplicates.length > 0 }">
          <span class="stat-count">{{ report.duplicates.length }}</span>
          <span class="stat-label">重复用例</span>
        </div>
        <div class="stat-item suggestions">
          <span class="stat-count">{{ report.suggestions.length }}</span>
          <span class="stat-label">改进建议</span>
        </div>
      </div>

      <!-- 可折叠的详情区 -->
      <div class="report-sections">

        <!-- 漏测点 -->
        <div v-if="report.coverage_gap.length > 0" class="report-section">
          <button class="section-header" @click="toggleSection('coverage')">
            <span class="section-icon">🔍</span>
            <span class="section-title">漏测点</span>
            <span class="section-badge danger">{{ report.coverage_gap.length }}</span>
            <span class="section-arrow" :class="{ expanded: expandedSections.coverage }">▸</span>
          </button>
          <div v-show="expandedSections.coverage" class="section-body">
            <ul class="issue-list">
              <li v-for="(gap, i) in report.coverage_gap" :key="'cg-' + i" class="issue-item coverage-gap">
                {{ gap }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 逻辑问题 -->
        <div v-if="report.logic_issues.length > 0" class="report-section">
          <button class="section-header" @click="toggleSection('logic')">
            <span class="section-icon">⚡</span>
            <span class="section-title">逻辑问题</span>
            <span class="section-badge warning">{{ report.logic_issues.length }}</span>
            <span class="section-arrow" :class="{ expanded: expandedSections.logic }">▸</span>
          </button>
          <div v-show="expandedSections.logic" class="section-body">
            <div v-for="issue in report.logic_issues" :key="issue.id" class="logic-issue-card">
              <div class="issue-severity" :class="issue.severity">
                {{ severityLabel(issue.severity) }}
              </div>
              <div class="issue-desc">{{ issue.issue }}</div>
            </div>
          </div>
        </div>

        <!-- 重复用例 -->
        <div v-if="report.duplicates.length > 0" class="report-section">
          <button class="section-header" @click="toggleSection('duplicates')">
            <span class="section-icon">📋</span>
            <span class="section-title">重复用例</span>
            <span class="section-badge info">{{ report.duplicates.length }}</span>
            <span class="section-arrow" :class="{ expanded: expandedSections.duplicates }">▸</span>
          </button>
          <div v-show="expandedSections.duplicates" class="section-body">
            <ul class="issue-list">
              <li v-for="(dup, i) in report.duplicates" :key="'dup-' + i" class="issue-item duplicate">
                {{ dup }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 改进建议 -->
        <div v-if="report.suggestions.length > 0" class="report-section">
          <button class="section-header" @click="toggleSection('suggestions')">
            <span class="section-icon">💡</span>
            <span class="section-title">改进建议</span>
            <span class="section-badge success">{{ report.suggestions.length }}</span>
            <span class="section-arrow" :class="{ expanded: expandedSections.suggestions }">▸</span>
          </button>
          <div v-show="expandedSections.suggestions" class="section-body">
            <ul class="suggestion-list">
              <li v-for="(sug, i) in report.suggestions" :key="'sug-' + i" class="suggestion-item">
                {{ sug }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 风险点 -->
        <div v-if="report.risk_points && report.risk_points.length > 0" class="report-section">
          <button class="section-header" @click="toggleSection('risks')">
            <span class="section-icon">🛡️</span>
            <span class="section-title">风险点</span>
            <span class="section-badge warning">{{ report.risk_points.length }}</span>
            <span class="section-arrow" :class="{ expanded: expandedSections.risks }">▸</span>
          </button>
          <div v-show="expandedSections.risks" class="section-body">
            <div v-for="(risk, i) in report.risk_points" :key="'risk-' + i" class="risk-card">
              <div class="risk-area">{{ risk.area }}</div>
              <div class="risk-desc">{{ risk.description }}</div>
              <div class="risk-row">
                <span class="risk-label">影响：</span>
                <span class="risk-value">{{ risk.impact }}</span>
              </div>
              <div class="risk-row">
                <span class="risk-label">缓解：</span>
                <span class="risk-value">{{ risk.mitigation }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 补充用例 -->
        <div v-if="report.supplementary_cases && report.supplementary_cases.length > 0" class="report-section">
          <button class="section-header" @click="toggleSection('supplementary')">
            <span class="section-icon">📝</span>
            <span class="section-title">补充用例建议</span>
            <span class="section-badge success">{{ report.supplementary_cases.length }}</span>
            <span class="section-arrow" :class="{ expanded: expandedSections.supplementary }">▸</span>
          </button>
          <div v-show="expandedSections.supplementary" class="section-body">
            <ul class="suggestion-list">
              <li v-for="(sc, i) in report.supplementary_cases" :key="'sc-' + i" class="suggestion-item supplementary">
                {{ sc }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 操作按钮区 -->
      <div class="report-actions">
        <button
          class="btn-supplement"
          :disabled="!hasIssues"
          @click="$emit('supplement', report)"
        >
          根据评估补充用例
        </button>
        <span v-if="!hasIssues" class="action-hint">评估未发现需补充的问题</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { EvaluationReport } from '@/types/chat';

const props = defineProps<{
  report: EvaluationReport | null;
  loading?: boolean;
  error?: string;
}>();

defineEmits<{
  retry: [];
  supplement: [report: EvaluationReport];
}>();

const hasIssues = computed(() => {
  if (!props.report) return false;
  return props.report.coverage_gap.length > 0
    || props.report.logic_issues.length > 0
    || props.report.suggestions.length > 0;
});

const expandedSections = reactive({
  coverage: true,
  logic: true,
  duplicates: false,
  suggestions: true,
  risks: false,
  supplementary: false,
});

function toggleSection(key: keyof typeof expandedSections) {
  expandedSections[key] = !expandedSections[key];
}

const circumference = 2 * Math.PI * 52; // ~326.73

const strokeOffset = computed(() => {
  if (!props.report) return circumference;
  return circumference - (props.report.score / 100) * circumference;
});

const scoreLevel = computed(() => {
  if (!props.report) return '';
  const s = props.report.score;
  if (s >= 80) return 'level-good';
  if (s >= 60) return 'level-ok';
  return 'level-bad';
});

const scoreColor = computed(() => {
  if (!props.report) return '#ccc';
  const s = props.report.score;
  if (s >= 80) return '#22c55e';
  if (s >= 60) return '#f59e0b';
  return '#ef4444';
});

function severityLabel(severity: string) {
  switch (severity) {
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return severity;
  }
}
</script>

<style scoped>
.quality-report-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  background: var(--neo-white, #FFFEF9);
}

/* 加载状态 */
.report-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e5e5;
  border-top-color: var(--neo-primary, #5D6AB4);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: var(--neo-gray, #888);
  font-weight: 600;
}

/* 错误状态 */
.report-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: #FEF2F2;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 8px;
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.error-icon { font-size: 18px; }

.error-text {
  flex: 1;
  font-size: 13px;
  color: var(--neo-black, #232323);
  font-weight: 600;
}

.btn-retry {
  padding: 6px 14px;
  background: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-retry:hover {
  background: var(--neo-yellow, #FFE066);
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

/* 空状态 */
.report-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon { font-size: 48px; margin-bottom: 12px; }

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--neo-black, #232323);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: var(--neo-gray, #888);
  line-height: 1.5;
}

/* 总分卡片 */
.score-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 12px;
  box-shadow: 4px 4px 0 var(--neo-black, #232323);
  margin-bottom: 16px;
  transition: background 0.2s;
}

.score-card.level-good { background: #F0FDF4; }
.score-card.level-ok   { background: #FFFBEB; }
.score-card.level-bad  { background: #FEF2F2; }

.score-ring {
  position: relative;
  width: 100px;
  height: 100px;
  margin-bottom: 12px;
}

.score-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.score-progress {
  transition: stroke-dashoffset 0.8s ease;
}

.score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -60%);
  font-size: 32px;
  font-weight: 900;
  color: var(--neo-black, #232323);
  line-height: 1;
}

.score-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, 50%);
  font-size: 12px;
  color: var(--neo-gray, #888);
  font-weight: 600;
}

.score-summary {
  font-size: 14px;
  color: var(--neo-black, #232323);
  text-align: center;
  line-height: 1.5;
  font-weight: 600;
}

/* 统计条 */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 8px;
  background: var(--neo-cream, #FFF9E6);
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.stat-item.has-issues {
  background: #FEF2F2;
}

.stat-item.suggestions {
  background: #F0FDF4;
}

.stat-count {
  font-size: 20px;
  font-weight: 900;
  color: var(--neo-black, #232323);
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: var(--neo-gray, #888);
  font-weight: 600;
  margin-top: 4px;
}

/* 折叠区域 */
.report-sections {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-section {
  border: 2px solid var(--neo-black, #232323);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: var(--neo-cream, #FFF9E6);
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  color: var(--neo-black, #232323);
  transition: background 0.15s;
  text-align: left;
}

.section-header:hover {
  background: var(--neo-yellow, #FFE066);
}

.section-icon { font-size: 16px; }

.section-title { flex: 1; }

.section-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1.5px solid var(--neo-black, #232323);
}

.section-badge.danger  { background: #FEE2E2; color: #DC2626; }
.section-badge.warning { background: #FEF3C7; color: #D97706; }
.section-badge.info    { background: #DBEAFE; color: #2563EB; }
.section-badge.success { background: #DCFCE7; color: #16A34A; }

.section-arrow {
  font-size: 14px;
  transition: transform 0.2s;
  color: var(--neo-gray, #888);
}

.section-arrow.expanded {
  transform: rotate(90deg);
}

.section-body {
  padding: 12px;
  background: var(--neo-white, #FFFEF9);
  border-top: 2px solid var(--neo-black, #232323);
}

/* 问题列表 */
.issue-list, .suggestion-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-item {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--neo-black, #232323);
  border-left: 4px solid;
}

.issue-item.coverage-gap {
  background: #FEF2F2;
  border-left-color: #EF4444;
}

.issue-item.duplicate {
  background: #EFF6FF;
  border-left-color: #3B82F6;
}

.suggestion-item {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--neo-black, #232323);
  background: #F0FDF4;
  border-left: 4px solid #22C55E;
}

.suggestion-item.supplementary {
  background: #F5F3FF;
  border-left-color: var(--neo-primary, #5D6AB4);
}

/* 逻辑问题卡片 */
.logic-issue-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  background: #FFFBEB;
  border-radius: 6px;
  margin-bottom: 8px;
}

.logic-issue-card:last-child {
  margin-bottom: 0;
}

.issue-severity {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1.5px solid var(--neo-black, #232323);
}

.issue-severity.high   { background: #FEE2E2; color: #DC2626; }
.issue-severity.medium { background: #FEF3C7; color: #D97706; }
.issue-severity.low    { background: #DBEAFE; color: #2563EB; }

.issue-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--neo-black, #232323);
}

/* 风险卡片 */
.risk-card {
  padding: 12px;
  background: #FFFBEB;
  border-radius: 6px;
  border: 1.5px solid #FDE68A;
  margin-bottom: 8px;
}

.risk-card:last-child {
  margin-bottom: 0;
}

.risk-area {
  font-size: 14px;
  font-weight: 700;
  color: var(--neo-black, #232323);
  margin-bottom: 4px;
}

.risk-desc {
  font-size: 13px;
  color: var(--neo-black, #232323);
  line-height: 1.5;
  margin-bottom: 8px;
}

.risk-row {
  display: flex;
  gap: 4px;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 2px;
}

.risk-label {
  color: var(--neo-gray, #888);
  font-weight: 600;
  flex-shrink: 0;
}

.risk-value {
  color: var(--neo-black, #232323);
}

/* 操作按钮区 */
.report-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.btn-supplement {
  width: 100%;
  padding: 12px 20px;
  background: var(--neo-primary, #5D6AB4);
  color: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
  transition: all 0.15s;
}

.btn-supplement:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 var(--neo-black, #232323);
  filter: brightness(1.1);
}

.btn-supplement:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.btn-supplement:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-hint {
  font-size: 12px;
  color: var(--neo-gray, #888);
  font-weight: 600;
}
</style>
