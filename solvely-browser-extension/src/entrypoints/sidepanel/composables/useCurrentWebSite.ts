import { reactive, onMounted, onUnmounted } from 'vue'
import websiteLogo from '~/assets/images/sidepanel/website-logo.webp'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'
import { Readability } from '@mozilla/readability'
import { QuestionType } from '../types/question'
import { QUIZLET_URL_PATTERN, YOUTUBE_URL_PATTERN } from '~/types/content'
import { UserContent } from '../types/message'
import trackEvent from '~/utils/trackEvent'
import useFileStagingUIStatus from './useFileStagingUIStatus'
import useGlobalUpload from './useGlobalUpload'
import useAuth from './useAuth'
import { detectCanvasEnvironment, sniffPdfInfoFromDocument } from '~/utils/canvasPageDetector'
const {addFileOrUrl} = useFileStagingUIStatus()
const { fileStack } = useGlobalUpload
const auth = useAuth()

// 定义选项接口
interface UseCurrentWebsiteOptions {
  onTabChange?: (tab: any) => void
}

export default function useCurrentWebsite(
  options: UseCurrentWebsiteOptions = {}
) {
  // 当前使用的供应商索引
  let currentProviderIndex = 0
  // 备用图标提供商
  const backupFaviconProviders = [
    (hostname: string) =>
      `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
    (hostname: string) => `https://icon.horse/icon/${hostname}`,
    (hostname: string) =>
      `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${hostname}&size=32`,
  ]

  const currentWebsite = reactive({
    url: '',
    title: '',
    defaultLogo: websiteLogo,
    get favicon() {
      try {
        if (!this.url) return this.defaultLogo

        const url = new URL(this.url)
        const provider = backupFaviconProviders[currentProviderIndex]
        return provider(url.hostname)
      } catch (e) {
        return this.defaultLogo
      }
    },
  })

  // 将 Blob 转换为 data URL
  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // 从 URL 拉取并转换为 base64 data URL
  async function toBase64FromUrl(url: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch(url, { cache: 'no-cache', signal })
    if (!res.ok) throw new Error(`favicon fetch failed: ${res.status}`)
    const blob = await res.blob()
    return blobToDataUrl(blob)
  }

  // 无缓存：按顺序尝试 tab.favIconUrl -> 备选提供商 -> 默认图标
  async function getFaviconBase64(signal?: AbortSignal): Promise<string> {
    try {
      const tab = await getCurrentTab()
      if (tab?.favIconUrl) {
        if (typeof tab.favIconUrl === 'string' && tab.favIconUrl.startsWith('data:')) {
          return tab.favIconUrl
        }
        try {
          return await toBase64FromUrl(tab.favIconUrl as string, signal)
        } catch {}
      }

      if (!currentWebsite.url) {
        try {
          return await toBase64FromUrl(currentWebsite.defaultLogo, signal)
        } catch {}
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      }

      const hostname = new URL(currentWebsite.url).hostname
      for (const provider of backupFaviconProviders) {
        try {
          return await toBase64FromUrl(provider(hostname), signal)
        } catch {}
      }

      try {
        return await toBase64FromUrl(currentWebsite.defaultLogo, signal)
      } catch {}
      return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
    } catch {
      try {
        return await toBase64FromUrl(currentWebsite.defaultLogo, signal)
      } catch {}
      return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
    }
  }

  // 获取当前标签页信息
  async function updateCurrentTabInfo() {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (tab?.url && tab?.title) {
        currentWebsite.url = tab.url
        currentWebsite.title = tab.title
      }

      options.onTabChange?.(tab)
    } catch (error) {
      console.error('Failed to get current tab info:', error)
    }
  }

  // 监听标签页更新事件
  function handleTabUpdated(tabId: number, changeInfo: any, tab: any) {
    if (changeInfo.url) {
      // 检查更新的标签页是否为当前活动标签页
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(([activeTab]) => {
          if (activeTab && activeTab.id === tabId) {
            updateCurrentTabInfo()
          }
        })
    }
  }

  // 处理图标加载错误
  function handleFaviconError(e: Event) {
    // 尝试下一个供应商
    if (currentProviderIndex < backupFaviconProviders.length - 1) {
      currentProviderIndex++
    } else {
      // 如果所有供应商都失败，使用默认图标
      const imgElement = e.target as HTMLImageElement
      imgElement.src = currentWebsite.defaultLogo
      // 重置索引供下次使用
      currentProviderIndex = 0
    }
  }

  // 获取当前活动标签页
  async function getCurrentTab() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    return tab
  }

  // 获取页面内容
  async function getPageContent() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.id) return null

    const response = await browser.tabs.sendMessage(tab.id, {
      type: SidepanelEventType.GET_PAGE_CONTENT,
    })

    // 从 HTML 字符串创建新的文档对象
    const parser = new DOMParser()
    const doc = parser.parseFromString(response.html, 'text/html')
    return doc // 这是一个新的文档对象，可以用于 Readability
  }

  async function getPageContentInfo() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.id) return null

    try {
      const response = await browser.tabs.sendMessage(tab.id, {
        type: SidepanelEventType.GET_PAGE_CONTENT_TYPE,
      })
      
      // 检查 response 是否存在且有 contentType
      if (response && response.contentType) {
        return {
          contentType: response.contentType,
          url: tab.url,
        }
      } else {
        // 如果 response 不存在或没有 contentType，返回默认值
        return {
          contentType: 'text/html', // 默认内容类型
          url: tab.url,
        }
      }
    } catch (error) {
      console.error('Failed to get page content info:', error)
      // 发生错误时返回默认值
      return {
        contentType: 'text/html',
        url: tab.url,
      }
    }
  }

  // Canvas: 本地（基于页面 HTML）嗅探 PDF URL，不走跨进程通信
  async function trySniffCanvasUrlFromPage(): Promise<{ isCanvas: boolean; url: string | null; fileName: string | null }> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return { isCanvas: false, url: null, fileName: null }
    try {
      // 获取页面 HTML Document 与 URL
      const pageInfo = await getPageContentInfo()
      const doc = await getPageContent()
      if (!doc || !pageInfo?.url) return { isCanvas: false, url: null, fileName: null }
      
      // 伪造最小 Window（提供 href 即可满足 url 规则判断）
      const fakeWin = { location: { href: pageInfo.url } } as any
      
      // 检测 Canvas 环境
      const { isCanvas } = detectCanvasEnvironment(doc as any, fakeWin)
      
      if (isCanvas) {
        // 嗅探 PDF 信息
        const info = sniffPdfInfoFromDocument(doc as any, fakeWin)
      return { isCanvas, url: info.url, fileName: info.fileName }
      } else {
        return { isCanvas, url: null, fileName: null }
      }
    } catch (e) {
      return { isCanvas: false, url: null, fileName: null }
    }
  }

  // 处理总结页面
  async function handleSummarizePage(
    addUserMessage: (message: UserContent) => void,
    instructions?: string
  ) {
    // 检查登录状态
    if (!auth.isAuthenticated.value) {
      auth.showLoginModal()
      return
    }
    
    // 优先：Canvas 场景嗅探 URL 并直传
    const { isCanvas: isCanvasSiteForSummary, url: canvasUrlForSummary, fileName: canvasNameForSummary } = await trySniffCanvasUrlFromPage()
    if (isCanvasSiteForSummary && canvasUrlForSummary) {
      try {
        // 触发 URL 上传并发送 Chat with PDF 消息
        addFileOrUrl(canvasUrlForSummary, true, undefined, undefined, 'Chat_with_pdf')
        // 解析文件名
        let fileName = canvasNameForSummary || ''
        if (!fileName) {
          try {
            const u = new URL(canvasUrlForSummary)
            const lastSegment = u.pathname.substring(u.pathname.lastIndexOf('/') + 1)
            fileName = lastSegment || canvasUrlForSummary || ''
          } catch {
            fileName = canvasUrlForSummary || ''
          }
        }
        addUserMessage({
          type: QuestionType.PDF_SUMMARIZE,
          value: '',
          fileStackKey: canvasUrlForSummary,
          attachments: {
            chatWithPdf: {
              fileUrl: '',
              fileName,
              needHideDownload: true,
            },
          },
        })
        return
      } catch (e) {
        console.warn('Canvas summarize fallback to generic flow due to error:', e)
      }
    }

    const pageContentInfo = await getPageContentInfo()
    
    // 检查URL中是否有浏览器扩展标识和cdn以及fileStackKey参数
    if (pageContentInfo?.url && pageContentInfo.url.startsWith('chrome-extension://')) {
      try {
        const url = new URL(pageContentInfo.url)
        const cdn = url.searchParams.get('cdn')
        const fileStackKey = url.searchParams.get('fileStackKey')
        
        // 如果有cdn和fileStackKey参数，检查文件栈中是否存在该文件
        if (cdn && fileStackKey) {
          // 获取文件名，没有文件名就用URL
          let fileName = ''
          try {
            const lastSegment = cdn.substring(cdn.lastIndexOf('/') + 1)
            fileName = lastSegment || cdn || ''
          } catch {
            fileName = cdn || ''
          }
          
          // 检查文件栈中是否存在该文件
          if (fileStack.value[fileStackKey]) {
            // 文件栈中存在，直接添加PDF总结消息
            const fileNameNew = fileStack.value[fileStackKey]?.fileName || fileName
            addUserMessage({
              type: QuestionType.PDF_SUMMARIZE,
              value: '',
              fileStackKey: fileStackKey,
              attachments: {
                chatWithPdf: {
                  fileUrl: cdn,
                  fileName: fileNameNew,
                },
              },
            })
            return
          } else {
            // 走URL上传流程
            addFileOrUrl(cdn, true,undefined,undefined,'Chat_with_pdf')
            
            // 添加用户消息
            addUserMessage({
              type: QuestionType.PDF_SUMMARIZE,
              fileStackKey: cdn,
              value: '',
              attachments: {
                chatWithPdf: {
                  fileUrl: '',
                  fileName: fileName,
                  needHideDownload: true,
                },
              },
            })
            return
          }
        }
      } catch (error) {
        console.error('Failed to parse extension URL params:', error)
      }
    }

    if (pageContentInfo?.contentType === 'application/pdf') {
      // 获取文件名，没有文件名就用URL
      let fileName = ''
      try {
        const urlObj = new URL(pageContentInfo.url || '')
        const pathname = urlObj.pathname
        const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1)
        fileName = lastSegment || pageContentInfo.url || ''
      } catch {
        fileName = pageContentInfo.url || ''
      }
      addFileOrUrl(pageContentInfo.url || '',true,undefined,undefined,'Chat_with_pdf')
      
      addUserMessage({
        type: QuestionType.PDF_SUMMARIZE,
        value: '',
        fileStackKey:pageContentInfo.url,
        attachments: {
          chatWithPdf: {
            fileUrl: '',
            fileName: fileName,
            needHideDownload:true,
          },
        },
      })
      return
    }

    
    // 获取当前 tab 标签页的 url
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.url) {
      console.error('No active tab found')
      return
    }

    let article = ''
    const content = await getPageContent()
    if (tab.url.includes('khanacademy')) {
      article = (content as Document)?.body.textContent || ''
    } else {
      const reader = new Readability(content as Document)
      article = reader.parse()?.textContent || ''
    }

    addUserMessage({
      type: QuestionType.SUMMARY,
      prompt: instructions,
      value: JSON.stringify({
        pageTitle: tab.title,
        pageUrl: tab.url,
        content: article,
        instructions,
      }),
    })
  }

  // 处理Quiz页面
  async function handleQuizPage(addUserMessage: (content: UserContent) => void) {
    // 检查登录状态
    if (!auth.isAuthenticated.value) {
      auth.showLoginModal()
      return
    }
    
    try {
      // 优先：Canvas 场景嗅探 URL 并直传
      const { isCanvas: isCanvasSiteForQuiz, url: canvasUrlForQuiz, fileName: canvasNameForQuiz } = await trySniffCanvasUrlFromPage()
      if (isCanvasSiteForQuiz && canvasUrlForQuiz) {
        try {
          addFileOrUrl(canvasUrlForQuiz, true, undefined, undefined, 'Chat_with_pdf')
          let fileName = canvasNameForQuiz || ''
          if (!fileName) {
            try {
              const u = new URL(canvasUrlForQuiz)
              const lastSegment = u.pathname.substring(u.pathname.lastIndexOf('/') + 1)
              fileName = lastSegment || canvasUrlForQuiz || ''
            } catch {
              fileName = canvasUrlForQuiz || ''
            }
          }
          const fileStackKey = canvasUrlForQuiz
          addUserMessage({
            type: QuestionType.QUIZ,
            fileStackKey,
            value: '',
            attachments: {
              chatWithPdf: {
                fileUrl: '',
                fileName,
                needHideDownload: true,
              },
            },
          })
          return
        } catch (e) {
          console.warn('Canvas quiz fallback to generic flow due to error:', e)
        }
      }

      const pageContentInfo = await getPageContentInfo()

      // 检查URL中是否有浏览器扩展标识和cdn以及fileStackKey参数
      if (pageContentInfo?.url && pageContentInfo.url.startsWith('chrome-extension://')) {
        try {
          const url = new URL(pageContentInfo.url)
          const cdn = url.searchParams.get('cdn')
          const fileStackKey = url.searchParams.get('fileStackKey')
          
          // 如果有cdn和fileStackKey参数，检查文件栈中是否存在该文件
          if (cdn && fileStackKey) {
            // 获取文件名，没有文件名就用URL
            let fileName = ''
            try {
              const lastSegment = cdn.substring(cdn.lastIndexOf('/') + 1)
              fileName = lastSegment || cdn || ''
            } catch {
              fileName = cdn || ''
            }
            
            // 检查文件栈中是否存在该文件
            if (fileStack.value[fileStackKey]) {
              // 文件栈中存在，直接添加PDF Quiz消息
              const quizCdnUrl =
                fileStack.value[fileStackKey]?.cdnUrl_To_Quiz || cdn
              const fileNameQuiz =
                fileStack.value[fileStackKey]?.fileName || fileName
              addUserMessage({
                type: QuestionType.QUIZ,
                value: '',
                fileStackKey: fileStackKey,
                attachments: {
                  chatWithPdf: {
                    fileUrl: quizCdnUrl,
                    fileName: fileNameQuiz,
                  },
                },
              })
              return
            } else {
              // 走URL上传流程
              addFileOrUrl(cdn, true,undefined,undefined,'Chat_with_pdf')
              
              // 添加用户消息
              addUserMessage({
                type: QuestionType.QUIZ,
                fileStackKey: cdn,
                value: '',
                attachments: {
                  chatWithPdf: {
                    fileUrl: '',
                    fileName: fileName,
                    needHideDownload: true,
                  },
                },
              })
              return
            }
          }
        } catch (error) {
          console.error('Failed to parse extension URL params:', error)
        }
      }

      if (pageContentInfo?.contentType === 'application/pdf') {
         // 获取文件名，没有文件名就用URL
         let fileName = ''
         try {
           const urlObj = new URL(pageContentInfo.url || '')
           const pathname = urlObj.pathname
           const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1)
           fileName = lastSegment || pageContentInfo.url || ''
         } catch {
          fileName = pageContentInfo.url || ''
         }
         const fileStackKey = pageContentInfo.url || ''
         addFileOrUrl(pageContentInfo.url || '',true,undefined,undefined,'Chat_with_pdf')
         addUserMessage({
           type: QuestionType.QUIZ,
           fileStackKey,
           value: '',
           attachments: {
             chatWithPdf: {
               fileUrl: '',
               fileName: fileName,
               needHideDownload: true,
             },
           },
         })
        return
      }

      if (
        pageContentInfo?.url &&
        QUIZLET_URL_PATTERN.test(pageContentInfo.url)
      ) {
        browser.runtime.sendMessage({
          type: SidepanelEventType.GENERATE_QUIZ_FROM_BUTTON,
        })
        return
      }

      // 获取当前 tab 标签页的信息
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (!tab?.url || !tab?.title) {
        console.error('No active tab found or missing tab info')
        return
      }

      // youtube
      if (
        pageContentInfo?.url &&
        YOUTUBE_URL_PATTERN.test(pageContentInfo.url)
      ) {
        addUserMessage({
          type: QuestionType.QUIZ,
          value: '',
          attachments: {
            youtube: {
              title: tab.title,
              url: tab.url,
            },
            // page: {
            //   title: tab.title,
            //   url: tab.url,
            //   content: '',
            // },
          },
        })
        return
      }

      // 获取页面内容
      const content = await getPageContent()
      if (!content) {
        trackEvent.track('Plugin_sidebar_quiz_no_content')
        return
      }

      let article = ''
      if (tab.url.includes('khanacademy')) {
        article = (content as Document)?.body.textContent || ''
      } else {
        const reader = new Readability(content as Document)
        article = reader.parse()?.textContent || ''
      }

      // 检查是否有有效的文本内容
      if (!article || article.trim().length === 0) {
        console.error('No valid text content found on the page')
        return
      }

      // 构建符合 UserContent 接口的消息数据
      addUserMessage({
        type: QuestionType.QUIZ,
        value: '', // Quiz类型使用空字符串
        attachments: {
          page: {
            title: tab.title,
            url: tab.url,
            content: article.slice(0, 100000),
          },
        },
      })
    } catch (error) {
      trackEvent.trackError('Plugin_sidebar_quiz_error', error)
    }
  }

  onMounted(async () => {
    await updateCurrentTabInfo()
    browser.tabs.onActivated.addListener(updateCurrentTabInfo)
    browser.tabs.onUpdated.addListener(handleTabUpdated)
  })

  onUnmounted(() => {
    browser.tabs.onActivated.removeListener(updateCurrentTabInfo)
    browser.tabs.onUpdated.removeListener(handleTabUpdated)
  })

  return {
    currentWebsite,
    updateCurrentTabInfo,
    handleFaviconError,
    getCurrentTab,
    getPageContent,
    getFaviconBase64,
    handleSummarizePage,
    handleQuizPage,
    trySniffCanvasUrlFromPage,
  }
}
