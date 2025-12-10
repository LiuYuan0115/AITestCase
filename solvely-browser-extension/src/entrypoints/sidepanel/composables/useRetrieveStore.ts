import { ref, reactive } from 'vue'
import { fetchStream } from '@/utils/fetchStream'
import { getTrpc } from '@/lib/trpc/client'
import { postRetrieve } from '@/api'
import globalUpload from './useGlobalUpload'
import { getPluginUuid } from '~/utils/pluginUuid'

interface RetrieveInfo {
  pdfUrl: string
  text?: string
  sessionId?: string
  platform?: string
  documentId?: string
}

interface StartRetrieveOptions {
  onOpen?: () => void
  onMessage?: (currentSummary: {
    content: {
      Answer: string
      Connect: boolean
    }
    command: string
    errorCode?: string
  }) => void
  onDone?: (content: string) => void
  onError?: (err?: {
    command: string
    errorCode: string | number
    message: string
  }) => void
}

// 正则表达式：匹配任何域名（包括协议和末尾斜杠）
const DOMAIN_REGEX = /^https?:\/\/[^\/]+\/?/
// 正则表达式：匹配任何域名加上 /web-pdf/ 路径（包括末尾斜杠）
const WEB_PDF_REGEX = /^https?:\/\/[^\/]+\/web-pdf\/?/

export function useRetrieveStore() {
  const currentSummary = reactive<{ content: string; command: string }>({
    content: '',
    command: '',
  })
  const isRetrieving = ref(false)
  let cancelCurrentRequest: (() => void) | null = null

  async function startStoreProcess(info: {
    deviceId?: string
    platform?: string
    pdfUrl?: string
    pictures?: string[]  // ⭐ 新增：图片URL列表
    sessionId: string
  }) {
    try {
      const { pdfUrl, pictures, sessionId, deviceId, platform } = info
      
      // 构建请求参数
      const params: any = {
        sessionId: sessionId,
        deviceId: deviceId || (await getTrpc().getUserId.query()),
        platform: platform || 'plugin',
      }
      
      // ⭐ 优先使用 pictures，其次使用 pdfUrl
      if (pictures && pictures.length > 0) {
        params.pictures = pictures
        console.log(`📤 [startStoreProcess] 使用图片列表入库，共 ${pictures.length} 张`)
      } else if (pdfUrl) {
        const pdfUrlNew = pdfUrl.replace(DOMAIN_REGEX, '')
        params.pdfUrl = pdfUrlNew
        console.log(`📤 [startStoreProcess] 使用 pdfUrl 入库: ${pdfUrlNew}`)
      } else {
        throw new Error('Either pdfUrl or pictures must be provided')
      }
      
      const res = await postRetrieve(params)
      if (res.statusCode === 500) {
        throw new Error(res.message || 'PDF storage failed')
      } else if (res.statusCode !== 200) {
        throw new Error(res.message || 'PDF upload failed')
      }
      return res.statusCode === 200
    } catch (err) {
      console.error('❌ [startStoreProcess] 入库失败:', err)
      return false
    }
  }

  // 封装一个靠filestackKey驱动的入库函数
  async function startStoreProcessByFileStackKey(
    fileStackKey: string,
    body: {
      pdfUrl: string
      sessionId: string
    },
    onSuccess?: () => void
  ): Promise<void> {
    if (!fileStackKey) {
      throw new Error('File stack key is required')
    }
    const fileStack = globalUpload.fileStack.value
    const fileInfo = fileStack[fileStackKey]
    if (!fileInfo) {
      throw new Error('File not found')
    }
    // 只处理 fileInfo.cdnUrl
    const pdfUrl = fileInfo.cdnUrl
    if (!pdfUrl) {
      throw new Error('No cdnUrl in fileInfo')
    }
    // 入库逻辑
    const success = await startStoreProcess({
      pdfUrl,
      sessionId: body.sessionId,
      deviceId: undefined,
      platform: undefined,
    })
    if (success) {
      fileInfo.isStored = true
      if (onSuccess) onSuccess()
      return
    } else {
      throw new Error('Store process failed')
    }
  }

  async function startRetrieveProcess(
    info: RetrieveInfo,
    options: StartRetrieveOptions = {}
  ) {
    isRetrieving.value = true
    currentSummary.content = ''
    currentSummary.command = ''

    try {
      const { pdfUrl, text, sessionId, documentId } = info
      //这边的pdfurl要处理一下，去掉前面的域名，只保留文件名
      const documentIdNew = documentId || pdfUrl.replace(WEB_PDF_REGEX, '')
      // 获取 deviceId（用户ID）
      const deviceId = await getTrpc().getUserId.query()
      // 获取 token
      const authToken = await getTrpc().getAuthToken.query()
      // 第二步：检索总结（流式）
      const body = {
        deviceId,
        platform: 'plugin',
        sessionId,
        text: text,
      }

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
          const { content = '', command = '', errorCode } = data
          console.log('data', data)

          if (command === 'pending') {
            try {
              const parsed = JSON.parse(content) as { Answer: string; Connect: boolean }
              currentSummary.content = content
              currentSummary.command = command
              options.onMessage?.({ content: parsed, command })
            } catch (error) {}
          } else if (command === 'done') {
            currentSummary.command = command
            isRetrieving.value = false
            options.onDone?.(currentSummary.content)
          } else if (command === 'error') {
            console.log('error', data)
            currentSummary.content = ''
            currentSummary.command = 'error'
            isRetrieving.value = false

            // 构造错误对象，包含错误码
            const error = {
              command: 'error',
              errorCode: errorCode || 'UNKNOWN_ERROR',
              message: content || 'ERROR',
            }
            options.onError?.(error)
          }
        },
        onError: (err: any) => {
          isRetrieving.value = false
          currentSummary.content = ''
          currentSummary.command = 'error'

          // 构造标准错误对象
          const error = {
            command: 'error',
            errorCode: err?.errorCode || 'NETWORK_ERROR',
            message: err?.message || '网络请求失败',
          }
          options.onError?.(error)
        },
        onClose: () => {
          isRetrieving.value = false
        },
      })
    } catch (err) {
      isRetrieving.value = false
      currentSummary.content = ''
      currentSummary.command = 'error'

      // 构造标准错误对象
      const error = {
        command: 'error',
        errorCode: (err as any)?.errorCode || 'UNKNOWN_ERROR',
        message: (err as any)?.message || '检索过程中发生未知错误',
      }
      options.onError?.(error)
    }
  }

  function cancelRetrieve() {
    if (cancelCurrentRequest) {
      cancelCurrentRequest()
      cancelCurrentRequest = null
      isRetrieving.value = false
    }
  }

  function retryRetrieve() {
    // 重试逻辑：重新开始检索流程
    if (cancelCurrentRequest) {
      cancelRetrieve()
    }
    // 这里可以添加重试逻辑，比如重新调用 startRetrieveProcess
    // 需要保存上一次的参数信息
  }

  return {
    currentSummary,
    isRetrieving,
    startRetrieveProcess,
    cancelRetrieve,
    retryRetrieve,
    startStoreProcess,
    startStoreProcessByFileStackKey,
  }
}
