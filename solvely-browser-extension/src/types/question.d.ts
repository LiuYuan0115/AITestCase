export type QuestionInfo = {
  questionId: string
  question?: string
  language: string
  renderStyle?: string
  experimental?: string
  mode: string
  subject: string
  instructions: string
  type: string
  time: number
  files?: {
    processed?: string
    original?: string
  }[]
  isImageSolve?: boolean
  questionText?: string
  answerId: string
  answerStyle: string
  answerLanguage: string
  answerType: string
  isRetry?: boolean
  pdfUrl?: string
  pictures?: string[]
}

export type StartAnswerOptions = {
  answerInfo?: {
    answer: string
    answerStatus: number
    answerJsonObject: any
  }
  successCallback?: () => void
  errorCallback?: () => void
  onStartOutput?: () => void
  onMessage?: (event: MessageEvent) => void
}
