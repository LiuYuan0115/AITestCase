/**
 * 通用性能统计工具
 */
import type {
  PerformanceConfig,
  PerformancePointData,
  PerformanceMetric,
  HTMLPerformanceData,
} from '@/types/performance'
import trackEvent from './trackEvent'

const PERFORMANCE_EVENT_NAME = 'Plugin_Performance_Metrics'

export class Performance {
  private static metrics: PerformanceMetric[] = []
  private static config: PerformanceConfig = {
    enabled: false,
    environment: 'development',
    context: 'background',
    output: {
      console: true,
      format: 'pretty',
    },
  }

  /**
   * 配置性能统计
   */
  static configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 标记开始
   */
  static mark(key: string): void {
    if (!this.isEnabled()) return

    try {
      const existingMetric = this.metrics.find(
        (m) => m.key === key && !m.endTime
      )
      if (existingMetric) {
        console.warn(`Performance metric "${key}" already started`)
        return
      }

      this.metrics.push({
        key,
        startTime: performance.now(),
        success: true,
      })
    } catch (error) {
      console.warn('Failed to mark performance:', error)
    }
  }

  /**
   * 测量结束
   */
  static measure(key: string): void {
    if (!this.isEnabled()) return

    try {
      const metric = this.metrics.find((m) => m.key === key && !m.endTime)
      if (!metric) {
        console.warn(`Performance metric "${key}" not found or already ended`)
        return
      }

      const endTime = performance.now()
      metric.endTime = endTime
      metric.duration = Number((endTime - metric.startTime).toFixed(2))
    } catch (error) {
      console.warn('Failed to measure performance:', error)
    }
  }

  /**
   * 记录错误
   */
  static recordError(key: string, error: any): void {
    if (!this.isEnabled()) return

    try {
      const metric = this.metrics.find((m) => m.key === key && !m.endTime)
      if (metric) {
        metric.error = error
        metric.success = false
        metric.endTime = performance.now()
        metric.duration = Number((metric.endTime - metric.startTime).toFixed(2))
      } else {
        // 如果没有找到开始的metric，创建一个错误记录
        this.metrics.push({
          key,
          startTime: performance.now(),
          endTime: performance.now(),
          duration: 0,
          error,
          success: false,
        })
      }
    } catch (err) {
      console.warn('Failed to record error in performance tracking:', err)
    }
  }

  /**
   * 获取适合 point 的指标
   */
  static getMetricsForPoint(): Record<string, number> {
    const result: Record<string, number> = {}

    this.metrics.forEach((metric) => {
      if (metric.success && metric.duration !== undefined) {
        result[metric.key] = Number(metric.duration.toFixed(2))
      }
    })

    return result
  }

  /**
   * 后台脚本直接上报
   */
  static async reportFromBackground(): Promise<void> {
    if (!this.isEnabled()) return

    try {
      const metrics = this.getMetricsForPoint()
      const pointData = this.buildPointData(metrics)

      // 使用 trackEvent 的 backgroundTrack 方法
      await trackEvent.backgroundTrack(PERFORMANCE_EVENT_NAME, pointData)

      if (this.config.output.console) {
        this.logReport(pointData)
      }
    } catch (error) {
      console.warn('Performance reporting failed:', error)
    }
  }

    /**
   * 非后台脚本通过 tRPC 上报
   */
  static async reportFromNonBackground(): Promise<void> {
    if (!this.isEnabled()) return
    
    try {
      const metrics = this.getMetricsForPoint()
      const pointData = this.buildPointData(metrics)
      
      // 使用 trackEvent.track 方法
      await trackEvent.track(PERFORMANCE_EVENT_NAME, pointData)
      
      if (this.config.output.console) {
        this.logReport(pointData)
      }
    } catch (error) {
      console.warn('Performance reporting failed:', error)
    }
  }

  /**
   * 增量上报单个性能指标
   */
  static async reportSingle(
    key: string, 
    value?: number, 
    alsoRecord: boolean = false
  ): Promise<void> {
    if (!this.isEnabled()) return
    
    try {
      // 计算性能值
      const performanceValue = value ?? performance.now()
      
      // 构建增量上报数据
      const incrementalData = this.buildIncrementalData(key, performanceValue)
      
      // 立即上报
      await trackEvent.track(PERFORMANCE_EVENT_NAME, incrementalData)
      
      // 可选：同时记录到批量收集
      if (alsoRecord) {
        this.recordSingleMetric(key, performanceValue)
      }
      
      // 控制台输出（如果启用）
      if (this.config.output.console) {
        this.logSingleReport(key, performanceValue)
      }
    } catch (error) {
      console.warn('Single performance reporting failed:', error)
      
      // 失败时降级到批量收集
      if (!alsoRecord) {
        this.recordSingleMetric(key, value ?? performance.now())
      }
    }
  }

  /**
   * 组件出现时间上报的便捷方法
   */
  static async reportComponentAppear(
    componentKey: string, 
    alsoRecord: boolean = false
  ): Promise<void> {
    return this.reportSingle(componentKey, performance.now(), alsoRecord)
  }

  /**
   * 处理 HTML 阶段的性能数据
   */
  static recordFromHTML(htmlData: HTMLPerformanceData): void {
    if (!this.isEnabled()) return

    try {
      const { html_start, css_time, js_start, js_end, dom_ready, window_load } =
        htmlData

      // 记录 HTML 开始解析（基准时间）
      this.metrics.push({
        key: 'sp_html_start',
        startTime: 0,
        endTime: html_start,
        duration: Number(html_start.toFixed(2)),
        success: true,
      })

      // 记录 CSS 加载完成时间
      if (css_time !== null) {
        this.metrics.push({
          key: 'sp_css_load',
          startTime: html_start,
          endTime: css_time,
          duration: Number((css_time - html_start).toFixed(2)),
          success: true,
        })
      }

      // 记录 JS 加载时间
      if (js_start !== null && js_end !== null) {
        this.metrics.push({
          key: 'sp_js_load',
          startTime: js_start,
          endTime: js_end,
          duration: Number((js_end - js_start).toFixed(2)),
          success: true,
        })
      }

      // 记录 DOM 就绪时间
      if (dom_ready !== null) {
        this.metrics.push({
          key: 'sp_dom_ready',
          startTime: html_start,
          endTime: dom_ready,
          duration: Number((dom_ready - html_start).toFixed(2)),
          success: true,
        })
      }

      // 记录窗口加载完成时间
      if (window_load !== null) {
        this.metrics.push({
          key: 'sp_window_load',
          startTime: html_start,
          endTime: window_load,
          duration: Number((window_load - html_start).toFixed(2)),
          success: true,
        })
      }
    } catch (error) {
      console.warn('Failed to record HTML performance data:', error)
    }
  }

  /**
   * 清除统计数据
   */
  static clearMetrics(): void {
    this.metrics = []
  }

  /**
   * 检查是否启用
   */
  static isEnabled(): boolean {
    return this.config.enabled
  }

    /**
   * 构建 Point 数据
   */
  private static buildPointData(
    metrics: Record<string, number>
  ): PerformancePointData {
    return {
      // 基础信息
      context: this.config.context,
      environment: this.config.environment,
      
      // 性能指标（直接展开 metrics 对象）
      ...metrics,
    }
  }

  /**
   * 构建增量上报数据
   */
  private static buildIncrementalData(key: string, value: number): PerformancePointData {
    return {
      // 基础信息（与批量上报一致）
      context: this.config.context,
      environment: this.config.environment,
      
      // 单个性能指标
      [key]: Number(value.toFixed(2))
    } as PerformancePointData
  }

  /**
   * 记录单个指标到批量收集
   */
  private static recordSingleMetric(key: string, value: number): void {
    try {
      this.metrics.push({
        key,
        startTime: 0,
        endTime: value,
        duration: Number(value.toFixed(2)),
        success: true
      })
    } catch (error) {
      console.warn('Failed to record single metric:', error)
    }
  }

  /**
   * 单个指标的控制台输出
   */
  private static logSingleReport(key: string, value: number): void {
    if (this.config.output.format === 'pretty') {
      console.log(`🚀 Performance [Incremental]: ${key} = ${value.toFixed(2)}ms`)
    } else {
      console.log('Performance [Incremental]:', { [key]: value.toFixed(2) })
    }
  }

  /**
   * 控制台输出报告
   */
  private static logReport(pointData: PerformancePointData): void {
    if (this.config.output.format === 'pretty') {
      console.log('\n🚀 Performance Report:')
      console.log(`📍 Context: ${pointData.context}`)
      console.log(`🌍 Environment: ${pointData.environment}`)

      // 输出性能指标
      Object.entries(pointData)
        .filter(
          ([key, value]) => key.includes('_') && typeof value === 'number'
        )
        .forEach(([key, value]) => {
          console.log(`⏱️  ${key}: ${value}ms`)
        })
    } else {
      console.log('Performance:', pointData)
    }
  }
}
