import { point } from './point'
import { pointError } from './point'
import SidepanelEventType from '~/entrypoints/sidepanel/types/eventTypes'

// 解题数据接口
interface SolveImageData {
  canvas?: HTMLCanvasElement
  cutDataUrl?: string
  type?: 'text' | 'image'
  content?: string
  source?: string
}

// 任务接口
interface Task {
  type: SidepanelEventType
  data?: any
  timestamp: number
  tabId?: number
}

// sidepanel 状态
interface SidepanelState {
  isOpen: boolean
  pendingTasks: Task[]
  isInitialized: boolean
}

class SidepanelService {
  private state: SidepanelState = {
    isOpen: false,
    pendingTasks: [],
    isInitialized: false,
  }
  private lastHeartbeat: number = 0
  private statusMonitorInterval: NodeJS.Timeout | null = null
  private lastKnownStatus: boolean | null = null
  private monitorFrequency: number = 1000
  private isCheckingStatus: boolean = false // 防止并发检查的锁

  // 统一的事件处理函数
  handleSidepanelEvent(
    message: {
      type: string
      data?: any
    },
    sender: any
  ): void {
    if (!message.type.startsWith('SIDEPANEL:')) {
      return
    }

    switch (message.type) {
      // 输入框搜题和划词搜题共用
      case SidepanelEventType.SOLVE_FROM_CONTENT:
        this.handleSolveRequest(message.data, sender.tab?.id)
        break
      case SidepanelEventType.SOLVE_ALL_FROM_CONTENT:
        this.handleSolveAllRequest(sender.tab?.id)
        break
      case SidepanelEventType.CLOSED:
        this.handleClosed()
        break
      case SidepanelEventType.READY:
        this.handleReady()
        break
      case SidepanelEventType.OPEN:
        this.openSidepanel(sender.tab?.id)
        break
      case SidepanelEventType.TOGGLE:
        this.toggleSidepanel(sender.tab?.id)
        break
      // 针对PDF的生成 Quiz 请求
      case SidepanelEventType.GENERATE_QUIZ_FROM_CONTENT:
        this.handleGenerateQuizRequest(message.data, sender.tab?.id)
        break
      // feature: 针对Chat with PDF的生成请求
      case SidepanelEventType.GENERATE_FROM_CHAT_WITH_PDF:
        const data = {
          ...message.data,
          tabId: sender.tab?.id,
        }
        this.handleGenerateChatWithPdfRequest(data, sender.tab?.id)
        break
      // 针对Selection的生成 Quiz 请求
      case SidepanelEventType.GENERATE_QUIZ_FROM_SELECTION:
        this.handleGenerateSelectionQuizRequest(message.data, sender.tab?.id)
        break
      case SidepanelEventType.GENERATE_QUIZ_FROM_QUIZLET:
        this.handleGenerateQuizFromQuizletRequest(message.data, sender.tab?.id)
        break
      case SidepanelEventType.GENERATE_QUIZ_FROM_YOUTUBE:
        this.handleGenerateQuizFromYouTubeRequest(message.data, sender.tab?.id)
        break
      case SidepanelEventType.GENERATE_QUIZ_SUCCESS:
      case SidepanelEventType.GENERATE_QUIZ_FAIL:
        this.forwardMessageToContentScript(message, sender.tab?.id)
        break
      case SidepanelEventType.GENERATE_QUIZ_FROM_BUTTON:
        this.handleGenerateQuizFromButton()
        break
      // 新增：内容脚本截图生成（chat/summarize/quiz）
      case SidepanelEventType.GENERATE_FROM_SCREENSHOT:
        this.handleGenerateFromScreenshot(message.data, sender.tab?.id)
        break
      // 新增生成 Summarize 请求
      case SidepanelEventType.GENERATE_SUMMARIZE_FROM_SELECTION:
        this.handleSummarizeFromSelection(message.data, sender.tab?.id)
        break
      // 新增生成 Explain 请求
      case SidepanelEventType.GENERATE_EXPLAIN_FROM_SELECTION:
        this.handleExplainFromSelection(message.data, sender.tab?.id)
        break
      // 新增生成 Chat 请求
      case SidepanelEventType.GENERATE_CHAT_FROM_SELECTION:
        this.handleChatFromSelection(message.data, sender.tab?.id)
        break
      case SidepanelEventType.LOGIN_REQUEST_FROM_CONTENT:
        this.handleLoginRequest(message.data, sender.tab?.id)
        break
      case SidepanelEventType.LOGIN_SUCCESS_TO_CONTENT:
        this.forwardMessageToContentScript(message, sender.tab?.id)
        break
      // 新增Youtube三包请求
      case SidepanelEventType.YOUTUBE_OUT_LIMIT_TO_SIDEPANEL:
        this.handleYoutubeOutLimitRequest(message.data, sender.tab?.id)
        break
      // 浮层余额不足，请求打开侧边栏并显示付费弹窗
      case SidepanelEventType.SHOW_PAYWALL_FROM_LAYER:
        this.handleShowPaywallFromLayer(message.data, sender.tab?.id)
        break
      // 浮层推送消息到侧边栏
      case SidepanelEventType.LAYER_TO_SIDEPANEL_PUSH_MESSAGES:
        this.handleLayerPushMessages(message.data, sender.tab?.id)
        break
      // 浮层激活 Quote Staging
      case SidepanelEventType.ACTIVATE_QUOTE_STAGING:
        this.handleActivateQuoteStaging(message.data, sender.tab?.id)
        break
      // 检查侧边栏是否正在解题
      case SidepanelEventType.CHECK_SIDEPANEL_SOLVING:
        this.sendMessageToSidepanel({
          type: SidepanelEventType.CHECK_SIDEPANEL_SOLVING,
          data: message.data,
        })
        break
      // 侧边栏响应解题状态（转发回内容脚本）
      case SidepanelEventType.CHECK_SIDEPANEL_SOLVING_RESPONSE:
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: SidepanelEventType.CHECK_SIDEPANEL_SOLVING_RESPONSE,
                data: message.data,
              }).catch(() => {
                // 忽略发送失败
              })
            }
          })
        })
        break
    }
  }

  // 处理解题请求
  private handleSolveRequest(imgData: SolveImageData, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.SOLVE_TO_SIDEPANEL,
      data: imgData,
      timestamp: Date.now(),
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理一键解题请求
  private handleSolveAllRequest(tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.SOLVE_ALL_TO_SIDEPANEL,
      timestamp: Date.now(),
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理生成 Quiz 请求
  private handleGenerateQuizRequest(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理图片（截图）生成（chat/summarize/quiz）请求
  private handleGenerateFromScreenshot(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_IMAGE_TO_SIDEPANEL,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理生成 Chat with PDF 请求
  private handleGenerateChatWithPdfRequest(data: any, tabId: number): void {
    // 创建任务，将数据传输给上传暂存组件
    const task: Task = {
      type: SidepanelEventType.GENERATE_TO_SIDEPANEL_CHAT_WITH_PDF,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    console.log('handleGenerateChatWithPdfRequest', task)
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理生成 Selection Quiz 请求
  private handleGenerateSelectionQuizRequest(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL_SELECTION,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理生成 Quizlet Quiz 请求
  private handleGenerateQuizFromQuizletRequest(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL_QUIZLET,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理生成 Youtube Quiz 请求
  private handleGenerateQuizFromYouTubeRequest(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_QUIZ_TO_SIDEPANEL_YOUTUBE,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 通用的 sidepanel 请求处理方法
  private handleSidepanelRequest(task: Task, tabId: number): void {
    try {
      // 如果 sidepanel 未打开，先打开它
      if (!this.lastKnownStatus) {
        // 将任务加入等待队列
        this.state.pendingTasks.push(task)
        this.openSidepanel(tabId)
        return
      }

      this.sendMessageToSidepanel(task)
    } catch (error) {
      pointError('service_sidepanel_handleSidepanelRequest', error)
    }
  }

  private async handleGenerateQuizFromButton(): Promise<void> {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.id) return
    browser.tabs.sendMessage(tab.id, {
      type: SidepanelEventType.GENERATE_QUIZ_TO_CONTENT,
    })
  }

  // 处理划词 summarize 请求
  private handleSummarizeFromSelection(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_SUMMARIZE_TO_SIDEPANEL_SELECTION,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理生成 Explain 请求
  private handleExplainFromSelection(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_EXPLAIN_TO_SIDEPANEL_SELECTION,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理生成 Chat 请求
  private handleChatFromSelection(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.GENERATE_CHAT_TO_SIDEPANEL_SELECTION,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理 sidepanel 关闭事件
  private handleClosed(): void {
    this.state.isOpen = false
  }

  // 处理 sidepanel 准备就绪事件
  private handleReady(): void {
    this.state.isOpen = true
    this.lastHeartbeat = Date.now()
    this.processPendingTasks()
  }

  // 切换 sidepanel 显示状态
  public openSidepanel(tabId: number): void {
    try {
      chrome.sidePanel.open({ tabId })
    } catch (error) {
      // pointError('service_sidepanel_openSidepanel', error)
    }
  }

  public closeSidepanel(tabId: number): void {
    try {
      chrome.sidePanel.setOptions({ enabled: false }).then(() => {
        chrome.sidePanel.setOptions({ enabled: true })
      })
      this.lastKnownStatus = false
      this.state.isOpen = false
    } catch (error) {
      pointError('service_sidepanel_closeSidepanel', error)
    }
  }

  // 切换 sidepanel 显示状态
  public toggleSidepanel(tabId: number) {
    if (this.lastKnownStatus) {
      this.closeSidepanel(tabId)
    } else {
      this.openSidepanel(tabId)
    }
  }

  // 发送消息到 sidepanel
  private async sendMessageToSidepanel(message: any): Promise<void> {
    try {
      await browser.runtime.sendMessage(message)
    } catch (error) {
      pointError('service_sidepanel_sendMessageToSidepanel', error, {
        ...message,
      })
    }
  }

  // 转发消息到内容脚本
  private async forwardMessageToContentScript(
    message: any,
    tabId?: number
  ): Promise<void> {
    try {
      // 如果没有提供tabId，尝试获取当前活动的tab
      let targetTabId = tabId
      if (!targetTabId) {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        targetTabId = activeTab?.id
      }
      if (targetTabId) {
        await chrome.tabs.sendMessage(targetTabId, message)
      }
    } catch (error) {
      pointError('service_sidepanel_forwardMessageToContentScript', error)
    }
  }

  // 处理Youtube余额不足请求（侧边栏未打开就打开）
  private handleYoutubeOutLimitRequest(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.YOUTUBE_OUT_LIMIT_TO_SIDEPANEL,
      data: {
        ...data,
        source: 'youtube-panel',
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      tabId: tabId,
    }

    // 处理侧边栏请求（如果侧边栏未打开会自动打开）
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理浮层余额不足请求（打开侧边栏并显示付费弹窗）
  private handleShowPaywallFromLayer(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.SHOW_PAYWALL_TO_SIDEPANEL,
      data: {
        ...data,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      tabId: tabId,
    }

    // 处理侧边栏请求（如果侧边栏未打开会自动打开）
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理浮层推送消息到侧边栏
  private handleLayerPushMessages(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.LAYER_TO_SIDEPANEL_PUSH_MESSAGES,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }

    // 处理侧边栏请求（如果侧边栏未打开会自动打开）
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理激活 Quote Staging
  private handleActivateQuoteStaging(data: any, tabId: number): void {
    const task: Task = {
      type: SidepanelEventType.ACTIVATE_QUOTE_STAGING,
      data: data,
      timestamp: Date.now(),
      tabId: tabId,
    }

    // 处理侧边栏请求（如果侧边栏未打开会自动打开）
    this.handleSidepanelRequest(task, tabId)
  }

  // 处理等待队列中的任务
  private async processPendingTasks(): Promise<void> {
    const isSidepanelOpen = await this.getSidepanelStatusByContexts()
    if (!isSidepanelOpen) {
      return
    }

    const tasks = [...this.state.pendingTasks]
    this.state.pendingTasks = []

    for (const task of tasks) {
      await this.sendMessageToSidepanel(task)
    }

    point('Plugin_sidepanel_processPendingTasks', {
      tasksLength: tasks.length,
    })
  }

  public handleHeartbeat() {
    this.lastHeartbeat = Date.now()
    this.state.isOpen = true
    if (this.state.pendingTasks.length > 0) {
      this.processPendingTasks()
    }
  }

  public isSidepanelAlive(timeout = 6000): boolean {
    return Date.now() - this.lastHeartbeat < timeout
  }

  public getSidepanelStatus(): boolean {
    return !this.state.isOpen || !this.isSidepanelAlive() ? false : true
  }

  public async getSidepanelStatusByContexts(): Promise<boolean> {
    if (!chrome?.runtime?.getContexts) {
      return false
    }
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['SIDE_PANEL' as any],
    })
    return contexts.length > 0
  }

  // 处理登录请求
  private handleLoginRequest(data: any, tabId: number): void {
    try {
      // 如果 sidepanel 未打开，先打开它
      if (!this.lastKnownStatus) {
        // 将登录任务加入等待队列
        const task = {
          type: SidepanelEventType.LOGIN_REQUEST_TO_SIDEPANEL,
          data: data,
          timestamp: Date.now(),
        }
        this.state.pendingTasks.push(task)
        this.openSidepanel(tabId)
        return
      }

      // sidepanel 已打开，直接发送登录请求
      this.sendMessageToSidepanel({
        type: SidepanelEventType.LOGIN_REQUEST_TO_SIDEPANEL,
        data: data,
        timestamp: Date.now(),
      })
    } catch (error) {
      pointError('service_sidepanel_handleLoginRequest', error)
    }
  }

  // 启动状态监控
  public async startStatusMonitor(): Promise<void> {
    // 防止重复启动
    if (this.statusMonitorInterval) {
      return
    }

    // 设置初始状态
    this.lastKnownStatus = await this.getSidepanelStatusByContexts()

    // 启动定时器
    this.statusMonitorInterval = setInterval(() => {
      this.checkStatusAndNotify()
    }, this.monitorFrequency)
  }

  // 停止状态监控
  public stopStatusMonitor(): void {
    if (this.statusMonitorInterval) {
      clearInterval(this.statusMonitorInterval)
      this.statusMonitorInterval = null
      this.lastKnownStatus = null

      point('Plugin_sidepanel_stopStatusMonitor')
    }
  }

  // 检查状态变化并通知
  private async checkStatusAndNotify(): Promise<void> {
    // 如果已经有检查在进行中，跳过本次检查
    if (this.isCheckingStatus) {
      return
    }

    this.isCheckingStatus = true

    try {
      const currentStatus = await this.getSidepanelStatusByContexts()

      // 如果状态发生变化
      if (
        this.lastKnownStatus !== null &&
        this.lastKnownStatus !== currentStatus
      ) {
        // 保存旧状态用于埋点，避免异步操作期间被修改
        const previousStatus = this.lastKnownStatus

        // 立即更新状态，防止竞态条件
        this.lastKnownStatus = currentStatus

        // 异步通知当前活动标签页（不阻塞）
        this.notifyActiveTabStatusChange(currentStatus)

        point('Plugin_sidepanel_statusChanged', {
          from: previousStatus,
          to: currentStatus,
        })
      } else {
        this.lastKnownStatus = currentStatus
      }
    } catch (error) {
      // pointError('service_sidepanel_checkStatusAndNotify', error)
    } finally {
      // 确保锁一定会被释放
      this.isCheckingStatus = false
    }
  }

  // 向当前活动标签页发送状态变化通知（性能优化：只通知活动 tab）
  private async notifyActiveTabStatusChange(isOpen: boolean): Promise<void> {
    try {
      // 只查询当前活动的标签页
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (!activeTab?.id) {
        return
      }

      const message = {
        type: SidepanelEventType.STATUS_CHANGED,
        data: {
          isOpen,
          timestamp: Date.now(),
        },
      }

      try {
        await browser.tabs.sendMessage(activeTab.id, message)
      } catch (error) {
        // 当前标签页可能没有内容脚本，忽略这些错误
      }
    } catch (error) {
      pointError('service_sidepanel_notifyActiveTabStatusChange', error)
    }
  }
}

// 导出单例
export default new SidepanelService()
