import { createApp } from 'vue'
import type { ContentScriptContext } from 'wxt/client'
import InjectedPanel from '@/components/chatgpt/CompareBtn.vue'
import ChatgptMain from '@/components/chatgpt/index.vue'
import SidepanelEventType from '@/entrypoints/sidepanel/types/eventTypes'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { downloadImageAsBase64 } from '@/utils/fileConverter'
import { uploadFileToS3 } from '@/utils/fileUpload'
import { STORAGE_KEY } from '~/config'
import { QuestionType } from '@/entrypoints/sidepanel/types/question'
import html2canvas from 'html2canvas'
import trackEvent from '@/utils/trackEvent'
import { isSidePanelSupported } from '@/utils/common'
import '@/styles/main.less'
import '@/styles/tailwind.css'

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  cssInjectionMode: 'ui',
  registration: 'manifest',
  runAt: 'document_end',
  async main(ctx: ContentScriptContext) {
    if (ctx.isInvalid) return

    // 检查浏览器是否支持侧边栏功能
    if (!isSidePanelSupported()) {
      return
    }

    // 检查ChatGPT按钮设置
    const isEnabled = await checkChatGPTButtonEnabled()
    if (!isEnabled) return

    initializeChatGPTContent(ctx)
  },
})

const matchSelector = '.agent-turn .select-none.gap-y-4.p-1'

// 初始化ChatGPT内容
function initializeChatGPTContent(ctx: ContentScriptContext) {
  const foundElements = document.querySelectorAll(matchSelector)
  foundElements.forEach((foundElement) => {
    handleAgentTurnElement(ctx, foundElement)
  })
  // 监听内容变化
  addClickListener(ctx)
  watchForAgentTurnSelectNone(ctx)
  // 创建并挂载全局UI
  createGlobalUi(ctx)
}

/**
 * 检查ChatGPT按钮是否启用
 */
async function checkChatGPTButtonEnabled(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(
      STORAGE_KEY.CHATGPT_BTN_ENABLED
    )
    return result[STORAGE_KEY.CHATGPT_BTN_ENABLED] !== undefined
      ? result[STORAGE_KEY.CHATGPT_BTN_ENABLED]
      : true // 默认启用
  } catch (error) {
    console.error('检查ChatGPT按钮设置失败:', error)
    return true // 默认启用
  }
}

// 处理 .agent-turn .select-none 元素，避免重复插入
function handleAgentTurnElement(ctx: ContentScriptContext, element: Element) {
  // 检查是否已经插入过（使用标记属性）
  const PROCESSED_ATTR = 'data-solvely-processed'
  if (element.hasAttribute(PROCESSED_ATTR)) {
    return // 已处理过，跳过
  }
  // 标记为已处理
  element.setAttribute(PROCESSED_ATTR, 'true')
  // console.log('检测到新的 .agent-turn .select-none 元素:', element)
  insertPanel(ctx, element)
}

// 生成唯一ID的计数器
let panelIdCounter = 0

/**
 * 显示Toast提示
 * @param message 提示消息
 * @param duration 显示时长，默认3000ms
 */
function showToast(message: string, duration: number = 3000) {
  // 检查是否已有toast存在，避免重复创建
  const existingToast = document.querySelector('.solvely-toast')
  if (existingToast) {
    return
  }

  // 创建toast元素
  const toastElement = document.createElement('div')
  toastElement.className = 'solvely-toast'
  toastElement.textContent = message

  // 设置样式
  Object.assign(toastElement.style, {
    position: 'fixed',
    zIndex: '9999',
    top: '100px',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    opacity: '0',
    transition: 'opacity 0.3s ease',
    pointerEvents: 'none',
  })

  // 添加到页面
  document.body.appendChild(toastElement)

  // 立即显示（触发动画）
  requestAnimationFrame(() => {
    toastElement.style.opacity = '1'
  })

  // 延迟隐藏
  setTimeout(() => {
    toastElement.style.opacity = '0'

    // 动画结束后移除元素
    toastElement.addEventListener(
      'transitionend',
      () => {
        if (toastElement.parentNode) {
          toastElement.parentNode.removeChild(toastElement)
        }
      },
      { once: true }
    )
  }, duration)
}

// 1. 查找所有 .agent-turn 元素
async function insertPanel(ctx: ContentScriptContext, targetNode: Element) {
  try {
    // 3. 创建一个挂载点，使用唯一ID
    const uniqueId = `solvely-injected-panel-root-${++panelIdCounter}`
    const mountPoint = document.createElement('div')
    mountPoint.id = uniqueId

    // 4. 插入到最后一个 .agent-turn 元素后面
    targetNode.appendChild(mountPoint)

    const ui = await createBtnUi(ctx, uniqueId)
    ui.autoMount()
  } catch (error) {
    console.error('注入失败：', error)
  }
}

// 创建注入的全局组件
async function createGlobalUi(ctx: ContentScriptContext) {
  let ui = await createShadowRootUi(ctx, {
    name: 'solvely-chatgpt-main',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    onMount: (uiContainer) => {
      const app = createApp(ChatgptMain)
      app.component('SvgIcon', SvgIcon)
      app.mount(uiContainer)
      return app
    },
    onRemove: (app) => {
      app?.unmount()
    },
  })
  ui.autoMount()
}

// 创建注入的按钮组件
function createBtnUi(ctx: ContentScriptContext, uniqueId: string) {
  return createShadowRootUi(ctx, {
    name: 'solvely-chatgpt-compare-btn',
    position: 'inline',
    anchor: `#${uniqueId}`,
    append: 'last',
    onMount: (uiContainer) => {
      const app = createApp(InjectedPanel)
      app.mount(uiContainer)
      return app
    },
    onRemove: (app) => {
      app?.unmount()
    },
  })
}

function watchForAgentTurnSelectNone(ctx: ContentScriptContext) {
  // 1. 获取目标节点
  const targetNode = document.querySelector('main')
  if (!targetNode) {
    console.warn('未找到 .flex.basis-auto.flex-col 元素')
    return
  }

  // 2. 创建回调函数
  const callback = function (
    mutationsList: MutationRecord[],
    observer: MutationObserver
  ) {
    for (const mutation of mutationsList) {
      // console.log('监听到内容变化：', mutation)
      // 只处理子节点变化
      if (mutation.type === 'childList') {
        // 遍历新增的节点，查找是否包含 .agent-turn .select-none
        mutation.addedNodes.forEach((node) => {
          // 只处理元素节点
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            // 检查新增元素本身是否匹配
            if (element.matches(matchSelector)) {
              handleAgentTurnElement(ctx, element)
            }
            // 检查新增元素的后代是否包含目标元素
            else {
              const foundElements = element.querySelectorAll(matchSelector)
              foundElements.forEach((foundElement) => {
                handleAgentTurnElement(ctx, foundElement)
              })
            }
          }
        })
      }
    }
  }

  // 3. 创建 MutationObserver 实例
  const observer = new MutationObserver(callback)

  // 4. 配置 observer 选项
  observer.observe(targetNode, {
    childList: true, // 监听子节点变化
    subtree: true, // 监听后代节点
  })

  // console.log('已开始监听 main 的内容变化')
}

function addClickListener(ctx: ContentScriptContext) {
  document.addEventListener(
    'click',
    async (e) => {
      let target = e.target as HTMLElement
      // 判断是不是点击注入的按钮
      if (target.tagName !== 'SOLVELY-CHATGPT-COMPARE-BTN') return
      // 冒泡获取父元素（答案区域）
      const artWrap = target.closest('article.text-token-text-primary')
      // console.log('GPT按钮点击', target)
      if (artWrap) {
        let prevSibling = artWrap.previousElementSibling
        let answerArea: HTMLElement | null =
          artWrap.querySelector('.agent-turn')
        let gptModel = document.querySelector(
          'button[data-testid="model-switcher-dropdown-button"] div'
        ) as HTMLElement

        // 提取文字问题
        let text = prevSibling?.querySelector('.whitespace-pre-wrap')
        let textContent = text?.textContent?.trim()

        // 提取图片问题
        let img = prevSibling?.querySelector(
          '.bg-token-main-surface-secondary img'
        ) as HTMLImageElement
        let imageUrl = img?.src

        // 发送解题请求到侧边栏
        if (textContent || imageUrl) {
          await browser.storage.local.set({
            [STORAGE_KEY.CHATGPT_SOLVE_DATA]: {
              model: gptModel?.innerText || 'default',
            },
          })
          sendToSidepanel(textContent, imageUrl)
          console.log('答案区域：', answerArea)
          // if (answerArea) {
          //   let cdnUrl = await captureDomAndUpload(answerArea)
          //   // 存储ChatGPT解题数据到本地存储
          //   const chatgptSolveData = {
          //     model: gptModel?.innerText || 'default',
          //     answerUrl: cdnUrl,
          //   }
          //   await browser.storage.local.set({
          //     [STORAGE_KEY.CHATGPT_SOLVE_DATA]: chatgptSolveData,
          //   })
          // }
        } else {
          console.warn('未找到有效的问题内容')
        }
      }
    },
    false // 改为 false，在冒泡阶段监听，这样 stopPropagation() 就能阻止事件
  )
}

// 发送数据到侧边栏进行解题
async function sendToSidepanel(textContent?: string, imageUrl?: string) {
  try {
    console.log('发送解题请求到侧边栏:', { textContent, imageUrl })

    trackEvent.track('Plugin_ChatGPT_sendToSidepanel')

    // 如果有图片，需要先下载并转换为base64
    if (imageUrl) {
      try {
        const imageBase64 = await downloadImageAsBase64(imageUrl)

        // 发送图片解题请求
        browser.runtime.sendMessage({
          type: SidepanelEventType.SOLVE_FROM_CONTENT,
          data: {
            cutDataUrl: imageBase64,
            content: textContent,
            source: 'chatgpt',
          },
        })
      } catch (downloadError) {
        console.error('图片下载或转换失败:', downloadError)
        showToast(
          'Image could not be loaded. Refresh the page and try again later.'
        )
        // 终止后续代码执行
        return
      }
    }
    // 如果只有文字，发送文字解题请求
    else if (textContent) {
      // 创建文字解题消息
      browser.runtime.sendMessage({
        type: SidepanelEventType.SOLVE_FROM_CONTENT,
        data: {
          type: QuestionType.TEXT_SOLVE,
          content: textContent,
          source: 'chatgpt',
        },
      })
    }
  } catch (error) {
    console.error('发送解题请求失败:', error)
  }
}

/**
 * 生成DOM区域截图并上传
 * @param element 要截图的DOM元素
 * @returns 返回上传后的图片地址
 */
async function captureDomAndUpload(element: HTMLElement): Promise<string> {
  try {
    // 判断html元素上是否有 dark 类名
    const isDarkMode = document.documentElement.classList.contains('dark')
    if (isDarkMode && !element.classList.contains('bg-gray-800')) {
      element.classList.add('bg-gray-800')
    }
    // 使用html2canvas生成截图
    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      background: undefined,
    })

    // 转换为base64
    const base64Data = canvas.toDataURL('image/webp', 0.9)
    if (element.classList.contains('bg-gray-800')) {
      element.classList.remove('bg-gray-800')
    }
    // 上传到S3并返回地址
    let cdnUrl = await uploadFileToS3(base64Data)
    console.log('DOM截图上传完成，URL:', cdnUrl, isDarkMode)
    return cdnUrl
  } catch (error) {
    console.error('DOM截图上传失败:', error)
    return ''
  }
}
