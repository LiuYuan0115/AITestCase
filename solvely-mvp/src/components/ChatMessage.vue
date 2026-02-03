<template>
  <div
    class="chat-message"
    :class="{
      'user': message.role === 'user',
      'assistant': message.role === 'assistant',
      'system': message.role === 'system',
      'pending': message.status === 'pending',
      'streaming': message.status === 'streaming',
      'error': message.status === 'error'
    }"
  >
    <!-- 头像 -->
    <div class="message-avatar">
      <span v-if="message.role === 'user'">👤</span>
      <span v-else-if="message.role === 'assistant'">🤖</span>
      <span v-else>ℹ️</span>
    </div>

    <!-- 消息内容 -->
    <div class="message-body">
      <div class="message-header">
        <span class="message-sender">{{ senderName }}</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>

      <!-- 加载状态 -->
      <div v-if="message.status === 'pending'" class="message-loading">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="loading-text">思考中...</span>
      </div>

      <!-- 流式内容 -->
      <div v-else-if="message.status === 'streaming'" class="message-content streaming">
        <div v-html="renderedContent"></div>
        <span class="cursor-blink">|</span>
      </div>

      <!-- 正常内容 -->
      <div v-else class="message-content" v-html="renderedContent"></div>

      <!-- 附件 -->
      <div v-if="message.attachments && message.attachments.length > 0" class="message-attachments">
        <div
          v-for="(att, idx) in message.attachments"
          :key="idx"
          class="attachment-item"
          @click="$emit('attachmentClick', att)"
        >
          <span class="attachment-icon">{{ getAttachmentIcon(att.type) }}</span>
          <span class="attachment-name">{{ att.name }}</span>
        </div>
      </div>

      <!-- 文档引用 -->
      <div v-if="message.docRefs && message.docRefs.length > 0" class="message-refs">
        <div class="refs-label">引用文档:</div>
        <div class="refs-list">
          <span
            v-for="ref in message.docRefs"
            :key="ref.docId"
            class="ref-tag"
            @click="$emit('refClick', ref)"
          >
            📄 {{ ref.title || ref.logicalId || ref.docId.slice(0, 8) }}
          </span>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-if="message.status === 'error'" class="message-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ message.error || '发送失败' }}</span>
        <button class="btn-retry" @click="$emit('retry')">重试</button>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="message-actions">
      <button
        v-if="message.role === 'assistant' && message.status === 'complete'"
        class="btn-action"
        @click="copyContent"
        title="复制"
      >
        {{ copied ? '✓' : '📋' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ChatMessage, MessageAttachment } from '@/composables';
import type { DocRef } from '@/utils/refRegistry';

const props = defineProps<{
  message: ChatMessage;
}>();

const emit = defineEmits<{
  retry: [];
  attachmentClick: [attachment: MessageAttachment];
  refClick: [ref: DocRef];
}>();

const copied = ref(false);

const senderName = computed(() => {
  switch (props.message.role) {
    case 'user': return '你';
    case 'assistant': return 'AI 助手';
    case 'system': return '系统';
    default: return '';
  }
});

// 简单的 Markdown 渲染
const renderedContent = computed(() => {
  let content = props.message.content || '';

  // 转义 HTML
  content = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块
  content = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="code-block" data-lang="${lang}"><code>${code.trim()}</code></pre>`;
  });

  // 行内代码
  content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 粗体
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 斜体
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 链接
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 换行
  content = content.replace(/\n/g, '<br>');

  return content;
});

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getAttachmentIcon(type: string): string {
  switch (type) {
    case 'image': return '🖼️';
    case 'document': return '📄';
    default: return '📎';
  }
}

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (e) {
    console.error('Copy failed:', e);
  }
}
</script>

<style scoped>
/* 使用 App.vue 的设计系统变量 */
.chat-message {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 2px solid var(--neo-black, #232323);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
  transition: background 0.2s;
}

.chat-message:hover {
  background: var(--neo-cream, #FFF9E6);
}

.chat-message.user {
  background: var(--neo-purple, #A2A3D1);
  align-self: flex-end;
}

.chat-message.assistant {
  background: var(--neo-white, #FFFEF9);
  align-self: flex-start;
}

.chat-message.system {
  background: var(--neo-yellow, #FFE066);
}

.chat-message.error {
  background: var(--neo-red, #E86F68);
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--neo-cream, #FFF9E6);
  border: 2px solid var(--neo-black, #232323);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.chat-message.user .message-avatar {
  background: var(--neo-pink-light, #FFE4EC);
}

.chat-message.assistant .message-avatar {
  background: var(--neo-green, #90EE90);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.message-sender {
  font-weight: 700;
  font-size: 13px;
  color: var(--neo-black, #232323);
}

.message-time {
  font-size: 11px;
  color: var(--neo-gray, #888);
}

.message-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--neo-primary, #5D6AB4);
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: #9ca3af;
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

.loading-text {
  font-size: 13px;
  font-style: italic;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--neo-black, #232323);
  word-break: break-word;
}

.message-content.streaming {
  display: inline;
}

.cursor-blink {
  animation: blink 1s step-end infinite;
  color: var(--neo-primary, #5D6AB4);
  font-weight: bold;
}

@keyframes blink {
  50% { opacity: 0; }
}

.message-content :deep(.code-block) {
  background: var(--neo-cream, #FFF9E6);
  color: var(--neo-black, #232323);
  padding: 12px 16px;
  border-radius: 6px;
  border: 2px solid var(--neo-black, #232323);
  overflow-x: auto;
  margin: 8px 0;
  font-size: 13px;
  font-family: 'Menlo', 'Monaco', monospace;
  max-height: 200px;
}

.message-content :deep(.inline-code) {
  background: var(--neo-cream, #FFF9E6);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--neo-black, #232323);
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 0.9em;
}

.message-content :deep(a) {
  color: var(--neo-primary, #5D6AB4);
  text-decoration: none;
  font-weight: 600;
}

.message-content :deep(a:hover) {
  text-decoration: underline;
}

.message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--neo-cream, #FFF9E6);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.attachment-item:hover {
  background: var(--neo-yellow, #FFE066);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.attachment-icon {
  font-size: 14px;
}

.attachment-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.message-refs {
  margin-top: 10px;
  padding: 8px 10px;
  background: var(--neo-pink-light, #FFE4EC);
  border-radius: 6px;
  border: 2px solid var(--neo-black, #232323);
}

.refs-label {
  font-size: 11px;
  color: var(--neo-gray, #888);
  margin-bottom: 6px;
  font-weight: 600;
}

.refs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ref-tag {
  font-size: 12px;
  padding: 3px 8px;
  background: var(--neo-blue-light, #E3F2FD);
  border: 1px solid var(--neo-primary, #5D6AB4);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.ref-tag:hover {
  background: var(--neo-primary, #5D6AB4);
  color: white;
}

.message-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--neo-red, #E86F68);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  font-size: 13px;
}

.error-icon {
  font-size: 14px;
}

.error-text {
  flex: 1;
  color: var(--neo-black, #232323);
  font-weight: 600;
}

.btn-retry {
  padding: 4px 10px;
  background: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  color: var(--neo-black, #232323);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retry:hover {
  background: var(--neo-yellow, #FFE066);
}

.message-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.chat-message:hover .message-actions {
  opacity: 1;
}

.btn-action {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-action:hover {
  opacity: 1;
}
</style>
