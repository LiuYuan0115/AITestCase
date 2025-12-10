export interface LatexParseResult {
  success: boolean
  data?: string      // 渲染后的字符串
  error?: string
}

export interface LatexSandboxMessage {
  type: 'PARSE_LATEX' | 'PARSE_RESULT' | 'SANDBOX_READY'
  messageId?: string
  latex?: string
  result?: LatexParseResult
} 