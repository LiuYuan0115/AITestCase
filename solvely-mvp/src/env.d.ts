/// <reference types="vite/client" />

/**
 * 环境变量类型定义
 * 确保 TypeScript 能正确识别 import.meta.env 中的变量
 */
interface ImportMetaEnv {
  /** 本地 Agent 服务器地址 */
  readonly VITE_LOCAL_AGENT_URL: string;
  /** webserver 上传服务地址（如 https://dev-webserver.solvely.ai） */
  readonly VITE_SOLVELY_UPLOAD_BASE: string;
  /** webserver 上传鉴权 token（Bearer） */
  readonly VITE_SOLVELY_AUTH_TOKEN: string;
  /** 插件 uuid（用于 webserver 上传鉴权/灰度，可选） */
  readonly VITE_SOLVELY_PLUGIN_UUID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

