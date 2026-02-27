/**
 * 统一聊天类型定义
 * Phase 1 & 3: 前后端共用的 ChatRequest/Response schema
 */

import type { DocRef } from '../utils/refRegistry';

// =====================
// 附件相关类型
// =====================

/** 附件类型 */
export type AttachmentType = 'pdf' | 'image' | 'text' | 'office' | 'url' | 'extracted';

/** 附件状态 */
export type AttachmentStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'error';

/** 附件接口 */
export interface Attachment {
  /** 唯一标识 */
  id: string;
  /** 附件类型 */
  type: AttachmentType;
  /** 文件名 */
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** MIME 类型 */
  mimeType?: string;
  /** 处理状态 */
  status: AttachmentStatus;
  /** 上传进度 (0-100) */
  progress: number;
  /** 错误信息 */
  error?: string;

  // 上传后的文档引用
  /** 文档引用（上传成功后） */
  docRef?: DocRef;

  // 预览相关
  /** 本地预览 URL (blob URL) */
  previewUrl?: string;
  /** 缩略图 URL */
  thumbnail?: string;

  // 多模态处理模式
  /** 多模态模式：'gemini_pdf_direct' = PDF 直传, 'multimodal' = 图片转换 */
  multimodalMode?: string;

  // 解析内容预览（用于 prompt 构建）
  /** 内容预览文本 */
  contentPreview?: string;
}

// =====================
// 工具配置
// =====================

/** 工具配置 */
export interface ToolConfig {
  /** 启用 RAG 检索 */
  enableRAG: boolean;
  /** RAG 检索数量 */
  ragTopK: number;
  /** 启用 Critic 评估 */
  enableCritic: boolean;
  /** 合成 PDF */
  generatePDF: boolean;
  /** 流式输出 */
  streamOutput: boolean;
}

/** 默认工具配置 */
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  enableRAG: true,
  ragTopK: 5,
  enableCritic: false,
  generatePDF: false,
  streamOutput: true,
};

// =====================
// 聊天请求/响应
// =====================

/** 用户角色 */
export type UserRole = 'pm' | 'dev' | 'qa';

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system';

/** 消息状态 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: number;
  attachments?: Attachment[];
  docRefs?: DocRef[];
  error?: string;
}

/** 聊天载荷（发送时的数据结构） */
export interface ChatPayload {
  /** 消息文本 */
  text: string;
  /** 附件列表 */
  attachments: Attachment[];
  /** 引用的文档 */
  refDocs: DocRef[];
  /** 工具配置 */
  toolConfig: Partial<ToolConfig>;
}

/** ChatSendPayload 别名（兼容 ChatInput 组件） */
export type ChatSendPayload = ChatPayload;

/** 统一聊天请求 */
export interface ChatRequest {
  /** 会话 ID */
  sessionId: string;
  /** 当前角色 */
  activeRole: UserRole;
  /** 消息内容 */
  message: string;
  /** 附件列表（含解析结果引用） */
  attachments: Attachment[];
  /** @引用的文档 */
  refDocs: DocRef[];
  /** 工具配置 */
  toolConfig: Partial<ToolConfig>;
  /** 编辑目标文档 logicalId */
  targetLogicalId?: string;
  /** 历史消息（多轮对话） */
  history?: ChatMessage[];
}

/** 逻辑问题 */
export interface LogicIssue {
  id: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

/** 风险点 */
export interface RiskPoint {
  area: string;
  description: string;
  impact: string;
  mitigation: string;
}

/** 评估报告 */
export interface EvaluationReport {
  /** 评分 (0-100) */
  score: number;
  /** 总结 */
  summary: string;
  /** 漏测点 */
  coverage_gap: string[];
  /** 逻辑问题 */
  logic_issues: LogicIssue[];
  /** 重复用例 */
  duplicates: string[];
  /** 改进建议 */
  suggestions: string[];
  /** 风险点 */
  risk_points: RiskPoint[];
  /** 补充用例清单 */
  supplementary_cases: string[];
}

/** 遥测数据 */
export interface TelemetryData {
  /** 请求 ID */
  request_id: string;
  /** 总耗时 (ms) */
  duration_ms: number;
  /** 各阶段耗时 */
  phases: Record<string, number>;
  /** 处理的附件数 */
  attachments_processed: number;
  /** Prompt 长度 */
  prompt_length: number;
  /** 输入 token 数 */
  input_tokens: number;
  /** 输出 token 数 */
  output_tokens: number;
  /** 使用的 RAG chunks 数 */
  rag_chunks_used: number;
}

/** 统一聊天响应 */
export interface ChatResponse {
  /** 状态 */
  status: 'success' | 'error';
  /** 会话 ID */
  sessionId: string;
  /** 回复内容 */
  reply: string;
  /** 结构化数据（如果有） */
  structuredData?: {
    type: 'testcase' | 'testpoint' | 'prd' | 'evaluation';
    data: unknown;
  };
  /** 模式：分析或编辑 */
  mode?: 'analysis' | 'edit';
  /** 编辑后的文档内容 */
  updatedDocument?: string;
  /** 编辑摘要 */
  editSummary?: string;
  /** 使用的文档引用 */
  usedDocRefs: DocRef[];
  /** 生成的文档引用 */
  generatedDocRef?: DocRef;
  /** 评估报告（如果启用 Critic） */
  evaluationReport?: EvaluationReport;
  /** 遥测数据 */
  telemetry?: TelemetryData;
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
  };
}

// =====================
// 提取图片相关
// =====================

/** 提取的图片 */
export interface ExtractedImage {
  /** 占位符，如 "[IMAGE_001]" */
  placeholder: string;
  /** 原始 src */
  src: string;
  /** alt 文本 */
  alt?: string;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 位置类型 */
  position?: 'inline' | 'block';
  /** 下载后的 base64 数据 */
  base64?: string;
  /** 上传后的 CDN URL */
  cdnUrl?: string;
  /** 上传状态 */
  uploadStatus?: AttachmentStatus;
}

/** 扩展的页面转换结果 */
export interface ConvertResultWithImages {
  /** Markdown 内容（图片替换为占位符） */
  markdown: string;
  /** 提取的图片列表 */
  images: ExtractedImage[];
}

// =====================
// PDF 合成相关
// =====================

/** PDF 合成请求 */
export interface ComposePdfRequest {
  /** 会话 ID */
  sessionId: string;
  /** Markdown 内容 */
  markdown: string;
  /** 图片列表 */
  images: Array<{
    placeholder: string;
    cdnUrl: string;
  }>;
  /** 文档标题 */
  title?: string;
  /** 选项 */
  options?: {
    pageSize?: 'A4' | 'Letter';
    includeHeader?: boolean;
    includeFooter?: boolean;
  };
}

/** PDF 合成响应 */
export interface ComposePdfResponse {
  status: 'success' | 'error';
  /** 生成的 PDF 文档引用 */
  docRef?: DocRef;
  /** 文件大小（字节） */
  size?: number;
  /** 页数 */
  pageCount?: number;
  /** 错误信息 */
  error?: string;
}

// =====================
// 文件上传辅助
// =====================

/** 后端支持的文件扩展名（与后端 config_manager.py 保持一致） */
export const SUPPORTED_FILE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'md'];

/** 支持的文件类型映射 */
export const FILE_TYPE_MAP: Record<string, AttachmentType> = {
  'application/pdf': 'pdf',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'text/plain': 'text',
  'text/markdown': 'text',
  // 注意：Office 文件类型前端可以识别，但后端不支持解析
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'office',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'office',
  'application/msword': 'office',
  'application/vnd.ms-excel': 'office',
};

/** 检查文件是否为后端支持的类型 */
export function isFileTypeSupported(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? SUPPORTED_FILE_EXTENSIONS.includes(ext) : false;
}

/** 获取支持的文件类型描述（用于错误提示） */
export function getSupportedFileTypesDescription(): string {
  return 'PDF、图片(PNG/JPG/WebP/GIF)、文本(TXT/MD)';
}

/** 根据 MIME 类型获取附件类型 */
export function getAttachmentType(mimeType: string): AttachmentType {
  return FILE_TYPE_MAP[mimeType] || 'text';
}

/** 根据文件扩展名获取附件类型 */
export function getAttachmentTypeFromExtension(filename: string): AttachmentType {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'bmp':
      return 'image';
    case 'txt':
    case 'md':
    case 'markdown':
      return 'text';
    case 'doc':
    case 'docx':
    case 'xls':
    case 'xlsx':
    case 'ppt':
    case 'pptx':
      return 'office';
    default:
      return 'text';
  }
}

/** 生成唯一 ID */
export function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建新附件对象 */
export function createAttachment(file: File): Attachment {
  return {
    id: generateAttachmentId(),
    type: getAttachmentType(file.type) || getAttachmentTypeFromExtension(file.name),
    name: file.name,
    size: file.size,
    mimeType: file.type,
    status: 'pending',
    progress: 0,
    previewUrl: URL.createObjectURL(file),
  };
}
