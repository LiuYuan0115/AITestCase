interface QuizResource {
  type: string
  name: string
  url: string
  contentText?: string
}

interface QuizConfig {
  type: 'QUIZLET' | 'TXT' | 'YOUTUBE'
  attachmentKey: 'quizlet' | 'page' | 'youtube' | 'selection'
  resourceBuilder: (attachment: any) => QuizResource
  eventPrefix: string
  shouldSendTabMessage?: boolean
  shouldSendRuntimeMessage?: boolean
}

export const QUIZ_CONFIGS: Record<string, QuizConfig> = {
  quizlet: {
    type: 'QUIZLET',
    attachmentKey: 'quizlet',
    resourceBuilder: (attachment) => ({
      type: 'QUIZLET',
      name: '',
      url: attachment.url,
    }),
    eventPrefix: 'Plugin_sidebar_QuizQuizletMessage',
    shouldSendTabMessage: true,
    shouldSendRuntimeMessage: true,
  },
  text: {
    type: 'TXT',
    attachmentKey: 'page',
    resourceBuilder: (attachment) => ({
      type: 'TXT',
      name: '',
      url: attachment.url,
      contentText: attachment.content,
    }),
    eventPrefix: 'Plugin_sidebar_QuizTextMessage',
  },
  selection: {
    type: 'TXT',
    attachmentKey: 'selection',
    resourceBuilder: (attachment) => ({
      type: 'TXT',
      name: '',
      url: attachment.url,
      contentText: attachment.content,
    }),
    // 新增 Selection 埋点
    eventPrefix: 'Plugin_sidebar_QuizSelectionMessage',
  },
  youtube: {
    type: 'YOUTUBE',
    attachmentKey: 'youtube',
    resourceBuilder: (attachment) => ({
      type: 'YOUTUBE',
      name: '',
      url: attachment.url,
    }),
    eventPrefix: 'Plugin_sidebar_QuizYoutubeMessage',
    shouldSendTabMessage: true,
    shouldSendRuntimeMessage: true,
  },
}

export type { QuizConfig, QuizResource } 