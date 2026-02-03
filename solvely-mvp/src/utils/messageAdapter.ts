/**
 * messageAdapter.ts - 消息类型适配器
 * Week 8: 用于将旧 Message 类型转换为新 ChatMessage 类型
 */
import type { ChatMessage, MessageStatus } from '@/composables';
import type { DocRef } from '@/utils/refRegistry';

// 旧消息类型（App.vue 中的 Message 接口）
export interface LegacyMessage {
  role: 'user' | 'ai';
  content: string;
  actionType?: 'edit' | 'delete' | 'add' | 'query' | 'testcase_edit';
  canUndo?: boolean;
  undoData?: string;
}

// 旧属性存储
export interface LegacyMessageData {
  actionType?: string;
  canUndo?: boolean;
  undoData?: string;
  originalIndex: number;
}

// 扩展 ChatMessage 以保留旧属性
export interface AdaptedChatMessage extends ChatMessage {
  _legacy?: LegacyMessageData;
}

/**
 * 将旧 Message 转换为 ChatMessage
 * @param msg 旧消息
 * @param index 消息索引
 * @returns 适配后的 ChatMessage
 */
export function adaptLegacyMessage(msg: LegacyMessage, index: number): AdaptedChatMessage {
  return {
    id: `msg-${index}-${Date.now()}`,
    role: msg.role === 'ai' ? 'assistant' : 'user',
    content: msg.content,
    status: 'complete' as MessageStatus,
    timestamp: Date.now(),
    _legacy: {
      actionType: msg.actionType,
      canUndo: msg.canUndo,
      undoData: msg.undoData,
      originalIndex: index
    }
  };
}

/**
 * 批量转换消息
 * @param messages 旧消息数组
 * @returns 适配后的消息数组
 */
export function adaptLegacyMessages(messages: LegacyMessage[]): AdaptedChatMessage[] {
  return messages.map((msg, idx) => adaptLegacyMessage(msg, idx));
}

/**
 * 检查消息是否可撤回
 * @param msg 适配后的消息
 * @returns 是否可撤回
 */
export function canUndoMessage(msg: AdaptedChatMessage): boolean {
  return msg._legacy?.canUndo === true && msg.role === 'assistant';
}

/**
 * 获取撤回数据
 * @param msg 适配后的消息
 * @returns 撤回数据
 */
export function getUndoData(msg: AdaptedChatMessage): string | undefined {
  return msg._legacy?.undoData;
}

/**
 * 获取消息的 actionType
 * @param msg 适配后的消息
 * @returns actionType
 */
export function getActionType(msg: AdaptedChatMessage): string | undefined {
  return msg._legacy?.actionType;
}

/**
 * 获取原始索引
 * @param msg 适配后的消息
 * @returns 原始索引
 */
export function getOriginalIndex(msg: AdaptedChatMessage): number {
  return msg._legacy?.originalIndex ?? -1;
}

/**
 * 将 ChatMessage 转换回旧 Message（用于兼容现有逻辑）
 * @param msg 适配后的消息
 * @returns 旧消息格式
 */
export function adaptToLegacyMessage(msg: AdaptedChatMessage): LegacyMessage {
  return {
    role: msg.role === 'assistant' ? 'ai' : 'user',
    content: msg.content,
    actionType: msg._legacy?.actionType as LegacyMessage['actionType'],
    canUndo: msg._legacy?.canUndo,
    undoData: msg._legacy?.undoData
  };
}
