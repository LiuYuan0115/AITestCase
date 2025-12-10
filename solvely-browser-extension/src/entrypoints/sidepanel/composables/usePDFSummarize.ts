import { ref, reactive } from 'vue'
import { fetchStream } from '@/utils/fetchStream'
import { getTrpc } from '@/lib/trpc/client'
import { getPluginUuid } from '~/utils/pluginUuid'
import { useLanguage } from '@/composables/useLanguage'

// 正则表达式：匹配任何域名（包括协议）
const DOMAIN_REGEX = /^https?:\/\/[^\/]+/
// 正则表达式：匹配 /web-pdf/ 路径
const WEB_PDF_PATH_REGEX = /\/web-pdf\/?/

interface PDFSummaryInfo {
  pdfUrl: string
  pageLimit?: number
  sessionId?: string
  pictures?: string[]  // ⭐ 新增：图片URL列表
}

interface PDFSummaryWithPromptInfo {
  pdfUrl: string
  prompt: string
  pageLimit?: number
  sessionId?: string
}

interface StartPDFSummaryOptions {
  onOpen?: () => void
  onMessage?: (currentSummary: { content: string; command: string }) => void
  onDone?: (content: string) => void
  onError?: (err?: any) => void
}

export function usePDFSummarize() {
  const { currentLanguage } = useLanguage()
  
  const currentSummary = reactive<{ content: string; command: string }>({
    content: '',
    command: '',
  })
  const isSummarizing = ref(false)
  let cancelCurrentRequest: (() => void) | null = null

  // 存储最后一次的 sessionId（用于重试）
  let lastSessionId: string | null = null

  async function startPDFSummary(
    info: PDFSummaryInfo,
    options: StartPDFSummaryOptions = {},
    mode: 'solve' | 'retry' = 'solve'
  ) {
    const isRetry = mode === 'retry'
    
    isSummarizing.value = true
    currentSummary.content = ''
    currentSummary.command = ''

    try {
      // 获取 token
      const authToken = await getTrpc().getAuthToken.query()
      
      // 根据模式决定 URL 和 body
      let url: string
      let body: any
      
      if (isRetry) {
        // 重试模式：只传 sessionId
        const sessionId = info.sessionId || lastSessionId
        if (!sessionId) {
          throw new Error('重试需要 sessionId')
        }
        
        url = '/summary/pdf/retry'
        body = {
          sessionId,
          platform: 'plugin',
        }
      } else {
        // 解题模式：传完整参数
        // 获取 deviceId（用户ID）
        const deviceId = await getTrpc().getUserId.query()
        // 获取 sessionId
        const sessionIdNew = `pdfsummary_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`
        const sessionId = info.sessionId || sessionIdNew
        // 保存 sessionId 用于重试
        lastSessionId = sessionId
        
        // 组装请求体
        body = {
          deviceId,
          platform: 'plugin',
          sessionId,
          language: currentLanguage.value,
        }
        
        // ⭐ 优先使用 pictures，其次使用 pdfUrl
        if (info.pictures && info.pictures.length > 0) {
          body.pictures = info.pictures
          console.log(`📤 [startPDFSummary] 使用图片列表总结，共 ${info.pictures.length} 张`)
        } else if (info.pdfUrl) {
          // 预先处理：提取域名和路径
          const domain =
            info.pdfUrl.match(DOMAIN_REGEX)?.[0] ||
            'https://solve-now.s3.us-west-2.amazonaws.com'
          const pathAfterWebPdf = info.pdfUrl
            .replace(DOMAIN_REGEX, '')
            .replace(WEB_PDF_PATH_REGEX, '')

          // 对路径进行原有处理（URLSearchParams方式）
          const params = new URLSearchParams()
          params.append(pathAfterWebPdf, '')
          const processedPath = params.toString().slice(0, -1)

          // 重新组合：域名 + /web-pdf/ + 处理后的路径
          const newPDFUrl = `${domain}/web-pdf/${processedPath}`
          body.pdfUrl = newPDFUrl
          console.log(`📤 [startPDFSummary] 使用 pdfUrl 总结: ${newPDFUrl}`)
        } else {
          throw new Error('Either pdfUrl or pictures must be provided')
        }
        
        if (info.pageLimit) body.pageLimit = info.pageLimit
        
        url = '/summary/pdf'
      }

      // 发起流式请求
      cancelCurrentRequest = fetchStream({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body,
        onOpen: () => {
          options.onOpen?.()
        },
        onMessage: (event: any) => {
          if (!event || !event.data) return
          const { data } = event || {}
          const { content = '', command = '' } = data

          if (command === 'pending') {
            currentSummary.content += content
            currentSummary.command = command
            options.onMessage?.(currentSummary)
          } else if (command === 'done') {
            currentSummary.command = command
            isSummarizing.value = false
            options.onDone?.(currentSummary.content)
          } else if (command === 'error') {
            currentSummary.content = ''
            currentSummary.command = 'error'
            isSummarizing.value = false
            options.onError?.()
          }
        },
        onError: (err: any) => {
          isSummarizing.value = false
          currentSummary.content = ''
          currentSummary.command = 'error'
          options.onError?.(err)
        },
        onClose: () => {
          isSummarizing.value = false
        },
        onDone: () => {
          options.onDone?.(currentSummary.content)
        },
      })
    } catch (err) {
      isSummarizing.value = false
      currentSummary.content = ''
      currentSummary.command = 'error'
      options.onError?.(err)
    }
  }

  async function startPDFSummaryWithPrompt(
    info: PDFSummaryWithPromptInfo,
    options: StartPDFSummaryOptions = {}
  ) {
    isSummarizing.value = true
    currentSummary.content = ''
    currentSummary.command = ''

    try {
      // 获取 deviceId（用户ID）
      const deviceId = await getTrpc().getUserId.query()
      // 获取 sessionId
      const sessionIdNew = `pdfprompt_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`
      // 获取 token
      const authToken = await getTrpc().getAuthToken.query()
      // 预先处理：提取域名和路径
      const domain =
        info.pdfUrl.match(DOMAIN_REGEX)?.[0] ||
        'https://solve-now.s3.us-west-2.amazonaws.com'
      const pathAfterWebPdf = info.pdfUrl
        .replace(DOMAIN_REGEX, '')
        .replace(WEB_PDF_PATH_REGEX, '')

      // 对路径进行原有处理（URLSearchParams方式）
      const params = new URLSearchParams()
      params.append(pathAfterWebPdf, '')
      const processedPath = params.toString().slice(0, -1)

      // 重新组合：域名 + /web-pdf/ + 处理后的路径
      const newPDFUrl = `${domain}/web-pdf/${processedPath}`
      // 组装请求体
      const body = {
        deviceId,
        platform: 'plugin',
        text: info.prompt,
        sessionId: info.sessionId || sessionIdNew,
      } as any
      if (info.pageLimit) body.pageLimit = info.pageLimit

      // 发起流式请求
      cancelCurrentRequest = fetchStream({
        url: '/chat/pdf/ask/context',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-plugin-uuid': await getPluginUuid() || '',
        },
        body,
        onOpen: () => {
          options.onOpen?.()
        },
        onMessage: (event: any) => {
          if (!event || !event.data) return
          const { data } = event || {}
          const { content = '', command = '' } = data

          if (command === 'pending') {
            try {
              currentSummary.content = JSON.parse(content).Answer
              currentSummary.command = command
              options.onMessage?.(currentSummary)
            } catch (error) {}
          } else if (command === 'done') {
            currentSummary.command = command
            isSummarizing.value = false
            options.onDone?.(currentSummary.content)
          } else if (command === 'error') {
            currentSummary.content = ''
            currentSummary.command = 'error'
            isSummarizing.value = false
            options.onError?.()
          }
        },
        onError: (err: any) => {
          isSummarizing.value = false
          currentSummary.content = ''
          currentSummary.command = 'error'
          options.onError?.(err)
        },
        onClose: () => {
          isSummarizing.value = false
        },
      })
    } catch (err) {
      isSummarizing.value = false
      currentSummary.content = ''
      currentSummary.command = 'error'
      options.onError?.(err)
    }
  }

  function cancelSummary() {
    if (cancelCurrentRequest) {
      cancelCurrentRequest()
      cancelCurrentRequest = null
      isSummarizing.value = false
    }
  }

  // 主动关闭流式请求
  function cancelPDFSummaryRequest() {
    if (cancelCurrentRequest) {
      cancelCurrentRequest()
      cancelCurrentRequest = null
      isSummarizing.value = false
    }
  }

  /**
   * PDF 总结重试
   * 使用重试接口，不扣余额，只传 sessionId
   */
  async function retryPDFSummary(
    sessionId: string,
    options: StartPDFSummaryOptions = {}
  ) {
    if (!sessionId) {
      // 如果没有传入 sessionId，尝试使用上次保存的
      if (!lastSessionId) {
        console.error('重试需要 sessionId')
        return
      }
      sessionId = lastSessionId
    }

    // 使用 mode='retry' 调用 startPDFSummary
    return startPDFSummary(
      { sessionId } as PDFSummaryInfo,
      options,
      'retry'
    )
  }

  return {
    currentSummary,
    isSummarizing,
    startPDFSummary,
    startPDFSummaryWithPrompt,
    cancelSummary,
    cancelPDFSummaryRequest,
    retryPDFSummary,
  }
}
