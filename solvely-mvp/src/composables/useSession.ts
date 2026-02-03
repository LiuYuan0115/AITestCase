/**
 * useSession - 会话管理 Composable
 * Week 8: 统一会话状态管理
 */
import { ref, computed } from 'vue';
import { PointerRegistry } from '../utils/refRegistry';

// 生成 UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 单例状态
let _sessionId = ref<string>('');
let _pointers: PointerRegistry | null = null;
let _isInitialized = ref(false);

/**
 * 会话管理 Composable
 *
 * 提供统一的会话 ID 和指针管理。
 * 所有使用此 composable 的组件共享同一个会话状态。
 *
 * @example
 * ```ts
 * const { sessionId, pointers, resetSession, initSession } = useSession();
 *
 * // 初始化会话
 * await initSession();
 *
 * // 使用会话 ID
 * console.log(sessionId.value);
 *
 * // 重置会话
 * resetSession();
 * ```
 */
export function useSession() {
  const sessionId = computed(() => _sessionId.value);
  const isInitialized = computed(() => _isInitialized.value);

  /**
   * 初始化会话
   * 如果已存在会话则返回现有会话，否则创建新会话
   */
  async function initSession(): Promise<string> {
    if (_sessionId.value && _pointers) {
      // 已初始化，直接返回
      return _sessionId.value;
    }

    // 生成新的会话 ID
    _sessionId.value = generateUUID();

    // 创建 PointerRegistry
    _pointers = new PointerRegistry(_sessionId.value);

    // 从后端加载指针表（如果存在）
    try {
      await _pointers.init();
    } catch (e) {
      console.warn('[useSession] Failed to init pointers:', e);
    }

    _isInitialized.value = true;

    console.log('[useSession] Session initialized:', _sessionId.value);

    return _sessionId.value;
  }

  /**
   * 重置会话
   * 创建新的会话 ID 并清空所有状态
   */
  function resetSession(): string {
    _sessionId.value = generateUUID();
    _pointers = new PointerRegistry(_sessionId.value);
    _isInitialized.value = true;

    console.log('[useSession] Session reset:', _sessionId.value);

    return _sessionId.value;
  }

  /**
   * 获取 PointerRegistry 实例
   * 用于管理文档版本指针
   */
  function getPointers(): PointerRegistry {
    if (!_pointers) {
      throw new Error('Session not initialized. Call initSession() first.');
    }
    return _pointers;
  }

  /**
   * 获取当前会话 ID（同步方法）
   * 如果未初始化则自动创建
   */
  function getSessionId(): string {
    if (!_sessionId.value) {
      _sessionId.value = generateUUID();
      _pointers = new PointerRegistry(_sessionId.value);
      _isInitialized.value = true;
    }
    return _sessionId.value;
  }

  /**
   * 设置会话 ID（用于恢复会话）
   */
  async function setSessionId(id: string): Promise<void> {
    _sessionId.value = id;
    _pointers = new PointerRegistry(id);

    try {
      await _pointers.init();
    } catch (e) {
      console.warn('[useSession] Failed to restore session pointers:', e);
    }

    _isInitialized.value = true;
  }

  return {
    sessionId,
    isInitialized,
    initSession,
    resetSession,
    getPointers,
    getSessionId,
    setSessionId
  };
}

export default useSession;
