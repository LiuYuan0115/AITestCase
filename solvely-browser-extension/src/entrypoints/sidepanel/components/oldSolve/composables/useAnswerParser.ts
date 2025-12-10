/**
 * 数据解析器
 *
 * 职责：
 * - 解析流式 JSON
 * - 提取组件数组
 * - 按 sortId 排序
 */

import type { Component } from './types'

export function useAnswerParser() {
  /**
   * 解析流式 JSON
   * 返回解析后的对象，如果是不完整的 JSON 则返回 null
   */
  const parseStreamJSON = (content: string): any | null => {
    if (!content || !content.trim()) {
      return null
    }

    try {
      return JSON.parse(content)
    } catch (e) {
      // 部分 JSON，等待更多数据
      return null
    }
  }

  /**
   * 提取组件数组
   *
   * 支持两种数据结构：
   *
   * 1. components 数组结构：
   * {
   *   "components": [
   *     { componentId: "1001", componentType: "question_thinking", data: {...} }
   *   ]
   * }
   *
   * 2. 扁平对象结构：
   * {
   *   "final_answer": { componentId: "1001", componentType: "final_answer", sortId: "1", data: {...} },
   *   "questions_step_style": { componentId: "1002", componentType: "questions_step_style", sortId: "2", data: {...} }
   * }
   *
   * 输出：
   * [
   *   { id: "1001", type: "question_thinking", sortId: 999, data: {...} },
   *   { id: "1002", type: "final_answer", sortId: 1, data: {...} }
   * ]
   */
  const extractComponents = (parsed: any): Component[] => {
    if (!parsed || typeof parsed !== 'object') {
      return []
    }

    const components: Component[] = []

    // 🔑 特殊处理：如果有 components 数组，直接提取
    if (Array.isArray(parsed.components)) {
      parsed.components.forEach((comp: any) => {
        if (comp && comp.componentType) {
          components.push({
            id: comp.componentId || 'unknown',
            type: comp.componentType,
            sortId: parseInt(comp.sortId || '999'), // 默认最大值，放在最后
            data: comp.data || {},
          })
        }
      })
    }

    // 遍历所有键，查找组件（扁平结构）
    Object.entries(parsed).forEach(([key, value]: [string, any]) => {
      // 跳过已处理的 components 数组
      if (key === 'components') return

      if (value && typeof value === 'object' && value.componentType) {
        components.push({
          id: value.componentId || key,
          type: value.componentType,
          sortId: parseInt(value.sortId || '999'), // 默认最大值，放在最后
          data: value.data || {},
        })
      }
    })

    // 按 sortId 排序（升序）
    return components.sort((a, b) => a.sortId - b.sortId)
  }

  /**
   * 检查是否为 PROBLEM MISSING
   */
  const isProblemMissing = (parsed: any): boolean => {
    // 检查 solutions 中是否有 PROBLEM MISSING 标记
    if (parsed?.solutions?.[0]?.questionGoal === 'PROBLEM MISSING') {
      return true
    }
    return false
  }

  return {
    parseStreamJSON,
    extractComponents,
    isProblemMissing,
  }
}
