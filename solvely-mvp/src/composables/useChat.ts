/**
 * useChat - 聊天消息管理 Composable
 * Week 8: 前端优化 - 聊天状态管理
 */
import { ref, computed, reactive, watch } from 'vue';
import { useSession } from './useSession';
import { useRole, type UserRole } from './useRole';
import { chatAgent, prdAgent, testCaseAgent, ask } from '../api';
import type { DocRef } from '../utils/refRegistry';

// 消息类型
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

// 附件类型
export interface MessageAttachment {
  type: 'file' | 'image' | 'document';
  name: string;
  url?: string;
  docRef?: DocRef;
  size?: number;
}

// 消息接口
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: number;
  attachments?: MessageAttachment[];
  docRefs?: DocRef[];
  error?: string;
}

// 发送选项
export interface SendMessageOptions {
  /** 附加的文档引用 */
  docRefs?: DocRef[];
  /** 附件列表 */
  attachments?: MessageAttachment[];
  /** 使用流式响应 */
  stream?: boolean;
  /** 目标文档 logicalId（用于编辑操作） */
  targetLogicalId?: string;
}

// 聊天状态
interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  currentStreamMessage: string;
}

// 单例状态
const _state = reactive<ChatState>({
  messages: [],
  isLoading: false,
  currentStreamMessage: ''
});

/**
 * 聊天管理 Composable
 *
 * 提供统一的聊天消息管理、发送、流式接收功能。
 * 所有使用此 composable 的组件共享同一个聊天状态。
 *
 * @example
 * ```ts
 * const { messages, isLoading, sendMessage, clearMessages } = useChat();
 *
 * // 发送消息
 * await sendMessage('帮我分析这个PRD', { docRefs: [prdDocRef] });
 *
 * // 在模板中使用
 * <div v-for="msg in messages" :key="msg.id">
 *   {{ msg.content }}
 * </div>
 * ```
 */
export function useChat() {
  const { getSessionId } = useSession();
  const { currentRole } = useRole();

  // 计算属性
  const messages = computed(() => _state.messages);
  const isLoading = computed(() => _state.isLoading);
  const currentStreamMessage = computed(() => _state.currentStreamMessage);

  const lastMessage = computed(() => {
    const len = _state.messages.length;
    return len > 0 ? _state.messages[len - 1] : null;
  });

  const hasMessages = computed(() => _state.messages.length > 0);

  /**
   * 生成消息 ID
   */
  function generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 添加用户消息
   */
  function addUserMessage(content: string, options?: SendMessageOptions): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      status: 'complete',
      timestamp: Date.now(),
      attachments: options?.attachments,
      docRefs: options?.docRefs
    };
    _state.messages.push(message);
    return message;
  }

  /**
   * 添加助手消息
   */
  function addAssistantMessage(content: string = '', status: MessageStatus = 'pending'): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content,
      status,
      timestamp: Date.now()
    };
    _state.messages.push(message);
    return message;
  }

  /**
   * 添加系统消息
   */
  function addSystemMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'system',
      content,
      status: 'complete',
      timestamp: Date.now()
    };
    _state.messages.push(message);
    return message;
  }

  /**
   * 更新消息
   */
  function updateMessage(id: string, updates: Partial<ChatMessage>): void {
    const index = _state.messages.findIndex(m => m.id === id);
    if (index !== -1) {
      _state.messages[index] = { ..._state.messages[index], ...updates };
    }
  }

  /**
   * 发送消息
   *
   * 根据当前角色自动选择合适的 API：
   * - PM: chatAgent with role='pm'
   * - DEV: chatAgent with role='dev'
   * - QA: 根据上下文选择 prdAgent/testCaseAgent/ask
   */
  async function sendMessage(content: string, options?: SendMessageOptions): Promise<ChatMessage | null> {
    if (_state.isLoading) {
      console.warn('[useChat] Already loading, ignoring send request');
      return null;
    }

    const sessionId = getSessionId();
    const role = currentRole.value;

    // 1. 添加用户消息
    addUserMessage(content, options);

    // 2. 创建助手占位消息
    const assistantMsg = addAssistantMessage('', 'pending');

    // 3. 开始加载
    _state.isLoading = true;
    _state.currentStreamMessage = '';

    try {
      let response: string = '';

      // 根据角色选择 API
      if (role === 'pm' || role === 'dev') {
        // PM/DEV 使用 chatAgent
        const result = await chatAgent({
          sessionId,
          role: role as 'pm' | 'dev',
          message: content,
          docRefs: options?.docRefs?.map(ref => ({
            docId: ref.docId,
            logicalId: ref.logicalId,
            title: ref.title,
            kind: ref.kind as 'main' | 'aux' | 'output' | undefined
          }))
        });

        if (result.status === 'error') {
          throw new Error(result.reply);
        }

        response = result.reply;
      } else {
        // QA 使用 ask API（通用接口）
        const result = await ask({
          sessionId,
          code: 'plugin_test_chat',
          type: 'chat',
          params: {
            text: content,
            isImageSolve: false
          },
          docRefs: options?.docRefs?.map(ref => ({
            docId: ref.docId,
            logicalId: ref.logicalId,
            title: ref.title,
            kind: ref.kind
          })),
          targetLogicalId: options?.targetLogicalId,
          onMessage: (text) => {
            // 流式回调（如果支持）
            _state.currentStreamMessage = text;
          }
        });

        response = result.answer;
      }

      // 4. 更新助手消息
      updateMessage(assistantMsg.id, {
        content: response,
        status: 'complete'
      });

      return assistantMsg;

    } catch (error: any) {
      console.error('[useChat] Send error:', error);

      // 更新为错误状态
      updateMessage(assistantMsg.id, {
        content: error.message || 'Unknown error',
        status: 'error',
        error: error.message
      });

      return assistantMsg;

    } finally {
      _state.isLoading = false;
      _state.currentStreamMessage = '';
    }
  }

  /**
   * 发送 PRD 分析请求（QA 专用）
   */
  async function sendPrdAnalysis(prdText: string, instruction?: string, options?: SendMessageOptions): Promise<ChatMessage | null> {
    if (_state.isLoading) return null;

    const sessionId = getSessionId();

    // 添加用户消息
    const userContent = instruction || '请分析这个 PRD';
    addUserMessage(userContent, options);

    // 创建助手占位消息
    const assistantMsg = addAssistantMessage('正在分析 PRD...', 'pending');

    _state.isLoading = true;

    try {
      const result = await prdAgent({
        sessionId,
        text: prdText,
        instruction
      });

      if (result.status === 'error') {
        throw new Error(result.response);
      }

      updateMessage(assistantMsg.id, {
        content: result.response,
        status: 'complete'
      });

      return assistantMsg;

    } catch (error: any) {
      updateMessage(assistantMsg.id, {
        content: error.message,
        status: 'error',
        error: error.message
      });
      return assistantMsg;

    } finally {
      _state.isLoading = false;
    }
  }

  /**
   * 发送测试用例分析请求（QA 专用）
   */
  async function sendTestCaseAnalysis(testcaseText: string, instruction?: string, options?: SendMessageOptions): Promise<ChatMessage | null> {
    if (_state.isLoading) return null;

    const sessionId = getSessionId();

    addUserMessage(instruction || '请分析这些测试用例', options);
    const assistantMsg = addAssistantMessage('正在分析测试用例...', 'pending');

    _state.isLoading = true;

    try {
      const result = await testCaseAgent({
        sessionId,
        text: testcaseText,
        instruction
      });

      if (result.status === 'error') {
        throw new Error(result.response);
      }

      updateMessage(assistantMsg.id, {
        content: result.response,
        status: 'complete'
      });

      return assistantMsg;

    } catch (error: any) {
      updateMessage(assistantMsg.id, {
        content: error.message,
        status: 'error',
        error: error.message
      });
      return assistantMsg;

    } finally {
      _state.isLoading = false;
    }
  }

  /**
   * 清空消息历史
   */
  function clearMessages(): void {
    _state.messages = [];
    _state.isLoading = false;
    _state.currentStreamMessage = '';
  }

  /**
   * 删除指定消息
   */
  function deleteMessage(id: string): void {
    const index = _state.messages.findIndex(m => m.id === id);
    if (index !== -1) {
      _state.messages.splice(index, 1);
    }
  }

  /**
   * 重试最后一条消息
   */
  async function retryLastMessage(): Promise<ChatMessage | null> {
    // 找到最后一条用户消息
    const lastUserMessage = [..._state.messages]
      .reverse()
      .find(m => m.role === 'user');

    if (!lastUserMessage) {
      return null;
    }

    // 删除之后的所有消息
    const index = _state.messages.findIndex(m => m.id === lastUserMessage.id);
    if (index !== -1) {
      _state.messages = _state.messages.slice(0, index);
    }

    // 重新发送
    return sendMessage(lastUserMessage.content, {
      docRefs: lastUserMessage.docRefs,
      attachments: lastUserMessage.attachments
    });
  }

  /**
   * 导入消息历史
   */
  function importMessages(messages: ChatMessage[]): void {
    _state.messages = messages;
  }

  /**
   * 导出消息历史
   */
  function exportMessages(): ChatMessage[] {
    return [..._state.messages];
  }

  return {
    // 状态
    messages,
    isLoading,
    currentStreamMessage,
    lastMessage,
    hasMessages,

    // 消息操作
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    updateMessage,
    deleteMessage,
    clearMessages,

    // 发送
    sendMessage,
    sendPrdAnalysis,
    sendTestCaseAnalysis,
    retryLastMessage,

    // 导入导出
    importMessages,
    exportMessages
  };
}

export default useChat;
