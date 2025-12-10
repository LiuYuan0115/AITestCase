import { getTrpc } from '~/lib/trpc/client';
import type { ContentScriptContext } from "wxt/client";
import EVENT from '~/utils/event';
import SidepanelEventType from './sidepanel/types/eventTypes';
import { STORAGE_KEY } from '~/config';

const messageFromSolvelyListener = (event: MessageEvent) => {
  try {
    if (event.source !== window && event.data.type) return;
    if (event.data.type === EVENT.SOLVELY_OPEN_SIDEPANEL) {
      chrome.runtime.sendMessage({
        type: SidepanelEventType.OPEN,
      })
      return
    }
    getTrpc().messageListenerFromSolvely.mutate(event.data);
  } catch (error) {
    console.error('Extension porbe Error sending message:', error);
  }
}
const messageFromBackgroundListener = (event: any) => {
  try {
    if(event.type === EVENT.SOLVELY_BEGIN_SOLVE_QUESTION) {
      console.log('messageFromBackgroundListener', event);
      window.postMessage(event, '*');
    }
  } catch (error) {
    console.error('Extension probe Error sending message:', {
      error,
      windowTop: !!window.top,
      location: window.location.href
    });
  }
}

// 监听获取tab数据事件
const requestTabDataListener = () => {
  browser.runtime.sendMessage({type: 'REQUEST_TAB_DATA'})
}

// 监听切换标签页事件
const requestSwitchTabListener = (event: Event) => {
  const customEvent = event as CustomEvent
  browser.runtime.sendMessage({
    type: 'REQUEST_SWITCH_TAB',
    url: customEvent.detail.url
  })
}

// 监听后台返回的tab数据结果
const tabDataResultsListener = (message: any, sender: any, sendResponse: any) => {
  // 监听tab数据结果
  if (message.type === 'TAB_DATA_RESULTS') {
    // 发送给页面进行渲染
    window.postMessage(
      { type: 'TAB_DATA_RESULTS', data: message.data },
      '*'
    )
  }
}
/**
* @file 探针脚本
* @description 探针脚本用于注入到页面中，用于捕获页面信息
*/
export default defineContentScript({
  matches: [
    // "<all_urls>", // 如果配置下面的，那么在background中有坑，会报错Invalid match pattern "*://localhost:*/*": Hostname cannot include a port
    /* 本地环境 */
    '*://localhost/*',
    '*://127.0.0.1/*',
    '*://0.0.0.0/*',
    /* 测试环境 */
    '*://*.solvely.ai/*',
    /* 生产环境 */
    '*://solvely.ai/*',
  ],
  registration: 'manifest',
  // 如果使用主世界（MAIN），不可用访问chrome的API，必须使用孤立世界（ISOLATED）
  world: 'ISOLATED',
  runAt: 'document_end',
  async main(ctx: ContentScriptContext) {
    // 如果上下文已失效，直接返回
    if (ctx.isInvalid) return
    
    /**
     * 从 solvely 网站同步 SEO 次数原始数据到插件 storage
     * 存储时过滤掉超过一周的记录，避免数据冗余
     */
    const syncSeoCreditsRawData = async () => {
      try {
        const rawString = localStorage.getItem(
          'solvely-web-pages-solving-count-limitation:ai-math-solver'
        )
        
        if (!rawString) {
          await browser.storage.local.set({
            [STORAGE_KEY.SEO_CREDITS_RAW_DATA]: null
          })
          return
        }
        
        const data = JSON.parse(rawString)
        const { limitCount = 0, solvedHistory = [] } = data
        
        // 计算一周前的时间戳
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        
        // 只保留一周内的使用记录，过滤掉旧数据
        const filteredHistory = solvedHistory.filter((item: any) => {
          try {
            const dateTime = new Date(item.dateTime).getTime()
            return dateTime > oneWeekAgo
          } catch {
            return false
          }
        })
        
        // 存储过滤后的数据
        const rawData = {
          limitCount,
          solvedHistory: filteredHistory,
          lastSyncTime: Date.now()
        }
        
        await browser.storage.local.set({
          [STORAGE_KEY.SEO_CREDITS_RAW_DATA]: rawData
        })
        
        console.log('🔧 [PROBE] SEO 次数原始数据已同步（已过滤）:', rawData)
      } catch (error) {
        console.error('🔧 [PROBE] 同步 SEO 次数原始数据失败:', error)
      }
    }
    
    // 只在context失效时清理
    let seoCreditsCheckInterval: ReturnType<typeof setInterval> | null = null
    
    ctx.onInvalidated(() => {
      window.removeEventListener('message', messageFromSolvelyListener)
      browser.runtime.onMessage.removeListener(messageFromBackgroundListener)
      window.removeEventListener('REQUEST_TAB_DATA', requestTabDataListener)
      browser.runtime.onMessage.removeListener(tabDataResultsListener)
      if (seoCreditsCheckInterval) {
        clearInterval(seoCreditsCheckInterval)
      }
    })
     console.log('🔧 [PROBE] probe.content.ts loaded', document.title)
     console.log('🔧 [PROBE] 当前URL:', window.location.href)
     const tokenValue = localStorage.getItem('solvelyWebToken')
     console.log('🔧 [PROBE] tokenValue:', tokenValue)
    // 直接存储到浏览器扩展的storage.local中
    // try {
    //   await browser.storage.local.set({ 'solvelyWebToken': tokenValue });
    //   console.log('Token已保存到扩展存储中');
    // } catch (error) {
    //   console.error('保存token到扩展存储失败:', error);
    // }
    // 监听宿主页面传过来的消息
    window.addEventListener('message', messageFromSolvelyListener, false)
    // 监听background传过来的消息，把题目消息通过window.postMessage发送给主站，主站监听这个消息
    browser.runtime.onMessage.addListener(messageFromBackgroundListener)
    if (
      window.location.href.split('?')[0] ===
      import.meta.env.VITE_ONBOARDING_PAGE_URL
    ) {
      window.dispatchEvent(new Event('REQUEST_WEB_ADJUST_USERID'))
      window.dispatchEvent(new Event('REQUEST_WEB_GA_CID'))
      window.dispatchEvent(new Event('REQUEST_WEB_ANON_DEVICE_ID'))
    }

     // 监听获取tab数据事件
     window.addEventListener('REQUEST_TAB_DATA', requestTabDataListener)

     // 监听切换标签页事件
     window.addEventListener('REQUEST_SWITCH_TAB', requestSwitchTabListener)

     // 监听后台返回的测试结果
     browser.runtime.onMessage.addListener(tabDataResultsListener)
     
     // 初始化时同步 SEO 次数数据
     await syncSeoCreditsRawData()
     
     // 定时同步（每 5 秒检查一次 localStorage 变化）
     seoCreditsCheckInterval = setInterval(() => {
       syncSeoCreditsRawData()
     }, 5000)
  },
})
