import type { ContentScriptContext } from 'wxt/client'
import trackEvent from '@/utils/trackEvent'
import { STORAGE_KEY } from '@/config/storage'

/**
 * LMS 埋点内容脚本
 *
 * 功能：
 * - 匹配 LMS 学习管理系统域名（Canvas, Blackboard, Brightspace）
 * - 24小时一次上报埋点，每个域名独立计时
 * - 使用时间戳记录，存储在 localStorage 中
 */

// 支持的 LMS 域名匹配规则
const LMS_RULES: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: 'Canvas',
    patterns: [/^[^.]+\.instructure\.com$/, /^canvas\.[^.]+\.edu$/],
  },
  {
    name: 'Blackboard',
    patterns: [
      /^blackboard\.[^.]+\.edu$/, // blackboard.*.edu
      /^learn\.[^.]+\.edu$/, // learn.*.edu
      /^blackboard\.com$/, // blackboard.com
      /^[^.]+\.blackboard\.com$/, // *.blackboard.com (如 sps.blackboard.com)
    ],
  },
  {
    name: 'Brightspace',
    patterns: [/^[^.]+\.brightspace\.com$/, /^learn\.[^.]+\.ca$/],
  },
]

const EVENT_NAME = 'LMS_Visit_Track'
const TRACK_DURATION = 24 * 60 * 60 * 1000 // 24小时
const STORAGE_KEY_LMS = STORAGE_KEY.LMS_TRACK_TIMESTAMPS // { [rootDomain]: lastTimestamp }

/**
 * 检测当前域名是否匹配 LMS 规则
 */
function detectLMSDomain(hostname: string): string | null {
  for (const rule of LMS_RULES) {
    if (rule.patterns.some((p) => p.test(hostname))) return rule.name
  }
  return null
}

/**
 * 提取根域名（eTLD+1）：默认取最后两段，适用于 .com/.edu/.ca 等
 * 例如：sps.blackboard.com -> blackboard.com
 */
function getRootDomain(hostname: string): string {
  try {
    const parts = (hostname || '').split('.').filter(Boolean)
    if (parts.length <= 2) return hostname
    return parts.slice(-2).join('.')
  } catch {
    return hostname
  }
}

/**
 * 按根域名上报埋点，24小时节流
 */
async function trackPerRootDomain(lmsName: string, rootDomain: string) {
  try {
    const now = Date.now()
    const result = await browser.storage.local.get(STORAGE_KEY_LMS)
    const records: Record<string, number> = result[STORAGE_KEY_LMS] || {}
    const lastTimestamp = records[rootDomain]

    // 检查是否在24小时内已上报过
    if (lastTimestamp && now - lastTimestamp < TRACK_DURATION) {
      console.log(
        '[LMS Track] 跳过上报:',
        lmsName,
        rootDomain,
        '剩余',
        Math.floor((TRACK_DURATION - (now - lastTimestamp)) / (60 * 60 * 1000)),
        '小时'
      )
      return
    }

    // 上报埋点
    await trackEvent.track(EVENT_NAME, { lmsName, rootDomain, timestamp: now })

    // 更新该根域名的时间戳
    records[rootDomain] = now
    await browser.storage.local.set({ [STORAGE_KEY_LMS]: records })

    console.log('[LMS Track] 上报成功:', lmsName, rootDomain, new Date(now).toLocaleString())
  } catch (error) {
    console.error('[LMS Track] 上报失败:', error)
    // 容错：存储异常也尝试上报
    try {
      await trackEvent.track(EVENT_NAME, { lmsName, rootDomain, timestamp: Date.now(), error: 'storage_failed' })
    } catch (e) {
      console.error('[LMS Track] 容错上报也失败:', e)
    }
  }
}

export default defineContentScript({
  // 直接匹配 LMS 域名模式
  // 注意：Chrome Extension 的 matches 不支持中间通配符（如 canvas.*.edu）
  // 所以对于 canvas.*.edu, learn.*.edu, learn.*.ca 等模式，需要在代码中检查
  matches: [
    '*://instructure.com/*', // Canvas: instructure.com
    '*://*.instructure.com/*', // Canvas: *.instructure.com
    '*://blackboard.com/*', // Blackboard: blackboard.com
    '*://*.blackboard.com/*', // Blackboard: *.blackboard.com (如 sps.blackboard.com)
    '*://*.brightspace.com/*', // Brightspace: *.brightspace.com
    // 对于 canvas.*.edu, blackboard.*.edu, learn.*.edu, learn.*.ca 等模式
    // 使用更宽泛的匹配，然后在代码中精确检查
    '*://*.edu/*', // 匹配所有 .edu 域名（代码中会精确检查）
    '*://*.ca/*', // 匹配所有 .ca 域名（代码中会精确检查）
  ],
  allFrames: false,
  runAt: 'document_idle',
  registration: 'manifest',
  async main(ctx: ContentScriptContext) {
    if (ctx.isInvalid) return

    // 仅顶层窗口执行，避免在 iframe 中重复执行
    if (window.self !== window.top) {
      return
    }

    const hostname = window.location.hostname

    // 检测是否为 LMS 域名
    const lmsName = detectLMSDomain(hostname)
    if (!lmsName) {
      // 非 LMS 域名，静默退出（不打印日志，因为 matches 已经缩小了范围）
      return
    }

    // 防止重复初始化
    const FLAG = '__SOLVELY_LMS_TRACK_INITIALIZED__' as const
    if ((window as any)[FLAG]) {
      return
    }
    ;(window as any)[FLAG] = true

    const rootDomain = getRootDomain(hostname)
    await trackPerRootDomain(lmsName, rootDomain)
  },
})
