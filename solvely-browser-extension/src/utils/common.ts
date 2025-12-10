import { v4 as uuidv4 } from 'uuid'

// 生成questionId，格式为YYYY_MM_DD_uuid
export const generateQuestionId = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}_${month}_${day}_${uuidv4()}`
}

// 解析Markdown字符串，提取LaTeX公式
export const extractLatex = (markdown: string) => {
  let latexExpressions = []
  let remainingText = markdown
  const latexDelimiters = [
    { start: '\\$\\$', end: '\\$\\$' },
    { start: '\\$', end: '\\$' },
    { start: '\\\\\\(', end: '\\\\\\)' },
    { start: '\\\\\\[', end: '\\\\\\]' },
  ]

  while (remainingText.length > 0) {
    let earliestMatch = null
    let earliestIndex = remainingText.length

    for (let delimiter of latexDelimiters) {
      let regex = new RegExp(`${delimiter.start}(.+?)${delimiter.end}`)
      let match = regex.exec(remainingText)

      if (match && match.index < earliestIndex) {
        earliestMatch = match
        earliestIndex = match.index
      }
    }

    if (earliestMatch) {
      latexExpressions.push(earliestMatch[0])
      remainingText = remainingText.substring(
        earliestIndex + earliestMatch[0].length
      )
    } else {
      break
    }
  }

  return latexExpressions
}

const loadedScripts = new Map()

/**
 * 加载js文件
 * @param {String} src js文件路径
 * @returns Promise
 */
export function loadScript(src: string) {
  return new Promise((resolve, reject) => {
    if (loadedScripts.has(src)) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.onload = () => {
      loadedScripts.set(src, true)
      resolve(true)
    }
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

// 获取url参数
export const getUrlParam = (name: string, url?: string) => {
  const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)')
  const r = (url || window.location.search.substring(1)).match(reg)
  if (r != null) return decodeURIComponent(r[2])
  return null
}

/**
 * 检查当前浏览器是否支持 sidePanel 功能
 */
export function isSidePanelSupported(): boolean {
  try {
    // 检查运行环境
    if (typeof navigator === 'undefined' || !navigator.userAgent) {
      return true // 默认支持，避免误判
    }

    const userAgent = navigator.userAgent.toLowerCase()

    // 检查是否为 Opera 浏览器
    // Opera 的 userAgent 通常包含 "opr/" 或 "opera"
    if (userAgent.includes('opr/') || userAgent.includes('opera')) {
      return false // Opera 不支持
    }

    // 检查是否为 Chrome 浏览器
    // Chrome 的 userAgent 包含 "chrome/" 但不包含 "edg"（排除 Edge）
    if (userAgent.includes('chrome/') && !userAgent.includes('edg')) {
      // 提取 Chrome 版本号
      // Chrome userAgent 格式: "chrome/116.0.0.0"
      const chromeMatch = userAgent.match(/chrome\/(\d+)/)

      if (chromeMatch && chromeMatch[1]) {
        const majorVersion = parseInt(chromeMatch[1], 10)

        // 检查版本号是否有效
        if (isNaN(majorVersion)) {
          return true // 版本号解析失败时默认支持
        }

        // Chrome 版本小于 116 不支持
        if (majorVersion < 116) {
          return false
        }
      }
    }

    // 其他所有情况都默认支持
    return true
  } catch (error) {
    // 任何错误都默认支持，避免功能误判
    return true
  }
}
