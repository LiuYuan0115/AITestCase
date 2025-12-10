/// <reference types="vite/client" />

/**
 * 环境变量类型定义
 * 确保 TypeScript 能正确识别 import.meta.env 中的变量
 */
interface ImportMetaEnv {
  /** API 认证 Token (JWT) */
  readonly VITE_AUTH_TOKEN: string;
  /** API 基础 URL */
  readonly VITE_API_BASE_URL: string;
  /** 设备 ID */
  readonly VITE_DEVICE_ID: string;
  /** 插件 UUID */
  readonly VITE_PLUGIN_UUID: string;
  /** 本地 Agent 服务器地址 */
  readonly VITE_LOCAL_AGENT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

