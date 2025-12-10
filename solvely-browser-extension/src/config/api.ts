// src/config/api.ts API相关配置

export const API_CONFIG = {
  /**
   * @description 
   * 必须使用`VITE_BASE_URL`，不能是其他的名称，我试着改成了`API_BASE_URL`，结果报错，
   * 请求地址为：chrome-extension://eppoecldnpbkofaeccnadfmilhcjnhme/v8/report/brower-ext/event
   */
  BASE_URL: import.meta.env.VITE_BASE_URL,
  WS_URL: import.meta.env.VITE_WS_URL,
  TIMEOUT: 2 * 60 * 1000
}