/**
 * Composables 统一导出
 * Week 8: 前端架构重构
 */

// Session & Role
export { useSession } from './useSession';
export { useRole, type UserRole, ROLE_INFO } from './useRole';

// Workflow
export { useWorkflow, type WorkflowStep, type WorkflowState, WORKFLOW_STEPS } from './useWorkflow';

// Task Progress
export { useTaskProgress, submitAsyncEvaluation, type TaskStatus, type TaskState } from './useTaskProgress';

// Chat
export {
  useChat,
  type MessageRole,
  type MessageStatus,
  type MessageAttachment,
  type ChatMessage,
  type SendMessageOptions
} from './useChat';

// Documents
export {
  useDocuments,
  type DocStatus,
  type DocKind,
  type LocalDocument,
  type UploadProgress
} from './useDocuments';
