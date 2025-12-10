import { createChromeHandler } from 'trpc-chrome/adapter'
import { appRouter } from './router'
import { TRPCError } from '@trpc/server'
import { goToSolvely } from '~/utils'
import { point, pointError } from './service/point'
import sidepanelService from './service/sidepanel'
import { initPluginOnInstall, syncPluginUuidFromWeb } from './service/login'
import youtubeSubtitleService from './service/youtubeSubtitleService'
import { STORAGE_KEY } from '@/config/storage'
import { syncCloudConfig } from '@/utils/config'
import { Performance } from '@/utils'
import { PerformanceKeys } from '@/types'
import { getPluginUuid } from '~/utils/pluginUuid'

const checkUrl = (url?: string) => {
  return (
    url &&
    url !== 'about:blank' &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('moz-extension://') &&
    !url.startsWith('edge://')
  )
}

export default defineBackground(async () => {
  // 配置性能统计
  Performance.configure({
    enabled: true,
    environment: import.meta.env.DEV ? 'development' : 'production',
    context: 'background',
    output: { console: true, format: 'pretty' },
  })

  // 开始统计整个脚本启动过程
  Performance.mark(PerformanceKeys.BACKGROUND_STARTUP)

  try {
    createChromeHandler({
      router: appRouter,
      createContext: () => ({}),
      onError: (error: TRPCError) => {
        if (
          error.code === 'CLIENT_CLOSED_REQUEST' ||
          chrome.runtime.lastError?.message
        ) {
          return
        }
        console.error(
          'tRPC error details:',
          JSON.stringify(
            {
              message: error.message,
              code: error.code,
              stack: error.stack,
              cause: error.cause,
            },
            null,
            2
          )
        )
      },
    })
  } catch (error) {
    pointError('background_error', error)
  }

  // 监听标签页切换
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await injectIfNeeded(activeInfo.tabId)
  })

  // 监听页面状态变化
  // chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  //   if (changeInfo.status === 'complete' && checkUrl(tab.url)) {
  //     await injectIfNeeded(tabId)
  //   }
  // })

  // 监听所有消息
  chrome.runtime.onMessage.addListener(
    async (message, sender, sendResponse) => {
      // 处理 SIDEPANEL 前缀的消息
      if (message.type.startsWith('SIDEPANEL:')) {
        if (message.type === 'SIDEPANEL:HEARTBEAT') {
          sidepanelService.handleHeartbeat()
          return true
        }
        sidepanelService.handleSidepanelEvent(message, sender)
        return true
      }

      // 处理字幕URL存储消息
      if (message.type === 'STORE_SUBTITLE_URL') {
        try {
          const result = youtubeSubtitleService.storeSubtitleUrlToCache(
            message.videoId,
            message.url
          )
          sendResponse(result)
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '未知错误',
          })
        }
        return true
      }

      // 处理获取tab数据消息
      if (message.type === 'REQUEST_TAB_DATA') {
        chrome.tabs.query({}, (tabs) => {
          // 获取当前聚焦的tab
          chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
            const currentActiveTabId = activeTabs[0]?.id
            
            const filteredTabs = tabs.filter(tab => {
              const url = tab.url || ''
              
              // 检查是否是Google搜索页面（各种域名）
              const isGoogleSearch = /google\..*\/search?/.test(url)
              
              // 检查是否是扩展商店页面
              const isExtensionStore = url.includes('chromewebstore.google.com') || 
                                     url.includes('microsoftedge.microsoft.com') ||
                                     url.includes('addons.mozilla.org')
              
              // 检查是否是Solvely相关页面
              const isSolvelyPage = url.includes('solvely.ai')
              
              // 检查是否是特殊协议页面
              const isSpecialProtocol = url.startsWith('chrome://') ||
                                      url.startsWith('chrome-extension://') ||
                                      url.startsWith('moz-extension://') ||
                                      url.startsWith('edge://') ||
                                      url === 'about:blank'
              
              // 检查是否是当前聚焦的tab
              const isCurrentActiveTab = tab.id === currentActiveTabId
              
              return !isGoogleSearch && 
                     !isExtensionStore && 
                     !isSolvelyPage && 
                     !isSpecialProtocol && 
                     !isCurrentActiveTab &&
                     checkUrl(url)
            })
            
            console.log('📋 [BACKGROUND] 过滤后的 tabs 详情:', filteredTabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url })))
            
            // 按最后访问时间排序，选择最近激活的4个tab
            const sortedTabs = filteredTabs.sort((a, b) => {
              const aTime = a.lastAccessed || 0
              const bTime = b.lastAccessed || 0
              return bTime - aTime // 降序排列，最新的在前
            })
            
            const selectedTabs = sortedTabs.slice(0, 4)
            
            // 直接构建结果，不需要截图
            const results = selectedTabs.map((tab, index) => ({
              tabId: tab.id,
              url: tab.url,
              title: tab.title,
              favicon: tab.favIconUrl,
              success: true,
              timestamp: new Date().toISOString()
            }))

            console.log('[Background_getTabData] 获取tab数据结果:', results)
            
            
            // 发送结果给onboarding页面
            browser.tabs.sendMessage(sender.tab!.id!, {
              type: 'TAB_DATA_RESULTS',
              data: results
            })
            
          })
        })
        return true
      }

      // 处理切换标签页消息
      if (message.type === 'REQUEST_SWITCH_TAB') {
        const targetUrl = message.url
        if (!targetUrl) {
          console.error('[Background] REQUEST_SWITCH_TAB: 缺少目标URL')
          return true
        }

        try {
          // 查找匹配的标签页
          const tabs = await chrome.tabs.query({})
          const matchingTab = tabs.find(tab => {
            if (!tab.url) return false
            try {
              const tabUrl = new URL(tab.url)
              const targetUrlObj = new URL(targetUrl)
              // 比较域名和路径，忽略查询参数和hash
              return tabUrl.hostname === targetUrlObj.hostname && 
                     tabUrl.pathname === targetUrlObj.pathname
            } catch {
              return false
            }
          })

          if (matchingTab && matchingTab.id) {
            // 切换到匹配的标签页
            await chrome.tabs.update(matchingTab.id, { active: true })
            // 将窗口聚焦到该标签页
            await chrome.windows.update(matchingTab.windowId, { focused: true })
            console.log(`[Background] 成功切换到标签页: ${matchingTab.title} (${matchingTab.url})`)
          } else {
            // 如果没有找到匹配的标签页，创建新标签页
            await chrome.tabs.create({ url: targetUrl, active: true })
            console.log(`[Background] 未找到匹配标签页，创建新标签页: ${targetUrl}`)
          }
        } catch (error) {
          console.error('[Background] 切换标签页失败:', error)
        }
        return true
      }

      // 处理其他消息
      if (message.type === 'fetchStream:heartbeat') {
        sendResponse({ alive: true })
      }
      return true // 保持消息通道开放
    }
  )

  /**
   * 在下载完成或更新完成后，会自动跳转`solvely home页`
   * 但是需要从对应浏览器的商店页中取出`adjust_referrer`参数（投放的广告链接中带这个参数）
   * 透传给主站，以便于主站进行数据分析
   */
  browser.runtime.onInstalled.addListener(async (details) => {
    Performance.mark(PerformanceKeys.INSTALL_HANDLER_EXECUTION)

    try {
      chrome?.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true })

      Performance.mark(PerformanceKeys.INSTALL_HANDLER_GET_AD_REFERRER)

      let extensionStoreUrl = ''
      switch (import.meta.env.BROWSER) {
        case 'chrome':
          extensionStoreUrl = 'https://chromewebstore.google.com/*'
          break
        case 'edge':
          extensionStoreUrl = 'https://microsoftedge.microsoft.com/*'
      }
      // 默认要加一个来源字段，主站用来打点
      let queryString = '?portal=extinstall'
      let adReferrer = ''
      if (extensionStoreUrl) {
        // 查询当前打开的浏览器商店页的tab
        const openTabs = await browser.tabs.query({ url: extensionStoreUrl })
        // 遍历打开的浏览器商店页的tab，获取`adjust_referrer`参数
        for (const tab of openTabs) {
          const searchParams = new URL(tab.url as string).searchParams
          const adjustReferrer = searchParams.get('adjust_referrer')
          const utmSource = searchParams.get('utm_source')
          if (utmSource) {
            queryString = `${queryString}&utm_source=${encodeURIComponent(
              utmSource
            )}`
          }
          if (adjustReferrer) {
            queryString = `${queryString}&adjust_referrer=${encodeURIComponent(
              adjustReferrer
            )}`
            adReferrer = adjustReferrer
            console.log('[web extension] queryString', queryString)
            break
          }
        }
      }

      Performance.measure(PerformanceKeys.INSTALL_HANDLER_GET_AD_REFERRER)

      Performance.mark(PerformanceKeys.INSTALL_HANDLER_EXECUTION)

      // 仅在首次安装时打开onboarding页面
      if (details.reason === 'install') {
        Performance.mark(PerformanceKeys.INSTALL_HANDLER_OPEN_ONBOARDING_PAGE)
        
        try {
          // 获取当前版本号
          const manifest = chrome.runtime.getManifest()
          const installTime = Date.now()
          // 记录首次安装时间和版本号
          await browser.storage.local.set({
            [STORAGE_KEY.INSTALL_TIME]: installTime,
            [STORAGE_KEY.INSTALL_VERSION]: manifest.version,
          })
          console.log(`[Plugin Install] 记录安装信息 - 时间: ${new Date(installTime).toISOString()}, 版本: ${manifest.version}`)
        } catch (error) {
          console.error('[Plugin Install] 记录安装信息失败:', error)
        }
        
        // 生成本地 UUID 并执行初始化流程（UUID同步 + 自动登录）
        try {
          const tempUuid = await getPluginUuid() // 这会自动生成并保存
          console.log(`[Plugin Install] 临时 UUID: ${tempUuid}`)
          // 调用组合函数，在同一个 offscreen 生命周期内完成
          initPluginOnInstall()
        } catch (error) {
          console.error('[Plugin Install] 初始化失败:', error)
          pointError('Plugin_install_init_error', error)
        }
        
        let hash = ''

        try {
          // 确保存在匿名设备ID（与 abtestAssignments.ts 相同逻辑）
          const anonStored = await browser.storage.local.get(
            STORAGE_KEY.ANON_DEVICE_ID
          )
          let anonDeviceId: string | undefined =
            anonStored[STORAGE_KEY.ANON_DEVICE_ID]
          if (!anonDeviceId) {
            anonDeviceId = crypto?.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random()}`
            await browser.storage.local.set({
              [STORAGE_KEY.ANON_DEVICE_ID]: anonDeviceId,
            })
          }
          hash = `#auid=${encodeURIComponent(anonDeviceId!)}`
        } catch (error) {
          console.error(error)
        }

        try {
          browser.tabs.create({
            url: `${
              import.meta.env.VITE_ONBOARDING_PAGE_URL
            }${queryString}${hash}`,
          })
          point('Plugin_install', {
            adReferrer,
          })
          await browser.storage.local.set({
            [STORAGE_KEY.AD_REFERRER]: adReferrer,
          })
          await syncCloudConfig()
        } catch (error) {
          pointError('Plugin_install_error', error, {
            adReferrer,
          })
          console.error(
            '[web extension] failed to open onboarding page:',
            error
          )
        }
        Performance.measure(
          PerformanceKeys.INSTALL_HANDLER_OPEN_ONBOARDING_PAGE
        )
      } else if (details.reason === 'update') {
        // 扩展更新时生成 UUID（如果不存在）并同步
        try {
          const uuid = await getPluginUuid() // 对于老用户升级，这会生成 UUID
          console.log(`[Plugin Update] UUID: ${uuid}`)
          // 独立调用 UUID 同步
          syncPluginUuidFromWeb()
        } catch (error) {
          console.error('[Plugin Update] UUID 初始化/同步失败:', error)
          pointError('Plugin_update_uuid_error', error)
        }
        
        // 扩展更新时同步一次云端配置
        try {
          await syncCloudConfig()
        } catch (error) {
          pointError('Plugin_update_sync_config_error', error)
        }
      }

      Performance.measure(PerformanceKeys.INSTALL_HANDLER_EXECUTION)
    } catch (error) {
      Performance.recordError(PerformanceKeys.INSTALL_HANDLER_EXECUTION, error)
      throw error
    }

    // 生成并输出性能报告
    // 使用 setTimeout 确保所有同步操作完成后再输出报告
    setTimeout(async () => {
      await Performance.reportFromBackground()
    }, 0)
  })

  const manifest = chrome.runtime.getManifest()
  chrome.runtime.setUninstallURL(
    `${import.meta.env.VITE_UNINSTALL_PAGE_URL}?version=${manifest.version}`
  )

  try {
    await sidepanelService.startStatusMonitor()
    // 在这里初始化 YouTube 字幕服务
    youtubeSubtitleService.init()
  } catch (error) {
    pointError('Plugin_services_init_error', error)
  }

  /**
   * 检查并注入内容脚本到指定标签页
   * 使用 sendMessage 检测内容脚本是否已存在，避免重复注入
   */
  async function injectIfNeeded(tabId: number) {
    // 检查tab是否有效
    if (!tabId) return

    const tab = await chrome.tabs.get(tabId)

    try {
      // 跳过特殊页面和空白页
      if (!checkUrl(tab.url)) {
        return
      }
    } catch (error) {
      // 标签页可能已经关闭或无效
      return
    }

    // 处理普通页面的内容脚本注入
    chrome.tabs
      .sendMessage(tabId, { type: 'CONTENT_SCRIPT_PING' })
      .then(() => {
        // 内容脚本已存在，无需注入
        console.log(`Tab ${tabId} already has content script`)
      })
      .catch(async () => {
        // 发送失败，说明需要注入内容脚本
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/main.js'],
          })

          // 根据URL注入特定网站的内容脚本
          if (tab.url?.includes('quizlet.com')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-scripts/quizlet.js'],
            })
          } else if (tab.url?.includes('youtube.com')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-scripts/youtube.js'],
            })
          } else if (tab.url?.includes('chatgpt.com')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-scripts/chatgpt.js'],
            })
          } else if (tab.url?.includes('solvely.ai')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-scripts/probe.js'],
            })
          } else if (tab.url?.includes('google.com')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-scripts/google.js'],
            })
          }

          // Canvas按钮注入：基于页面特征检测，不依赖域名
          // 注入canvas内容脚本，它会内部检测是否为Canvas环境
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/canvas.js'],
          })

          console.log(`Successfully injected content script to tab ${tabId}`)
        } catch (error) {
          // 静默处理注入失败（可能是特殊页面如chrome://）
          console.warn(
            `Failed to inject content script to tab ${tabId}:`,
            error
          )
        }
      })
  }

  // 结束整个脚本启动统计
  Performance.measure(PerformanceKeys.BACKGROUND_STARTUP)
})
