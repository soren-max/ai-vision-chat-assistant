/// <reference types="vite/client" />

/**
 * 环境变量类型声明
 * 为 import.meta.env 提供类型提示
 */
interface ImportMetaEnv {
  /** 后端 API 基础地址 */
  readonly VITE_API_BASE_URL: string;
  /** WebSocket 服务器地址 */
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
