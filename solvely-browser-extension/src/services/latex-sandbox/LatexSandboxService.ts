import { ref, type Ref } from 'vue'
import type {
  LatexParseResult,
  LatexSandboxMessage,
} from '~/types/latex-sandbox'

export class LatexSandboxService {
  private static instance: LatexSandboxService
  private iframeRef: Ref<HTMLIFrameElement | null> = ref(null)
  isReady: Ref<boolean> = ref(false)
  private messageHandlers: Map<string, (result: LatexParseResult) => void> =
    new Map()
  private messageId: number = 0

  private constructor() {
    this.initMessageHandler()
  }

  static getInstance(): LatexSandboxService {
    if (!LatexSandboxService.instance) {
      LatexSandboxService.instance = new LatexSandboxService()
    }
    return LatexSandboxService.instance
  }

  private initMessageHandler() {
    const handleMessage = (event: MessageEvent) => {
      const { type, messageId, result } = event.data as LatexSandboxMessage

      if (type === 'SANDBOX_READY') {
        this.isReady.value = true
        return
      }

      if (
        type === 'PARSE_RESULT' &&
        messageId &&
        this.messageHandlers.has(messageId)
      ) {
        const handler = this.messageHandlers.get(messageId)
        if (handler) {
          handler(result!)
          this.messageHandlers.delete(messageId)
        }
      }
    }

    window.addEventListener('message', handleMessage)
  }

  setIframeRef(ref: HTMLIFrameElement) {
    this.iframeRef.value = ref
  }

  async parseLatex(latex: string): Promise<LatexParseResult> {
    return new Promise((resolve) => {
      if (!this.iframeRef.value || !this.isReady.value) {
        resolve({ success: false, error: 'Sandbox not ready' })
        return
      }

      const messageId = `parse_${++this.messageId}`

      this.messageHandlers.set(messageId, (result) => {
        resolve(result)
      })

      this.iframeRef.value?.contentWindow?.postMessage(
        {
          type: 'PARSE_LATEX',
          messageId,
          latex,
        },
        '*'
      )
    })
  }
}
