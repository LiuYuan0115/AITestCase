/**
 * 答案格式化工具
 * 
 * 职责：
 * - 格式化答案为纯文本（用于复制）
 * - 保留 LaTeX 格式（用于划词引用）
 * - 处理不同类型的组件数据
 */

import type { Component } from './types'

export function useAnswerFormatter() {
  /**
   * 移除 LaTeX 格式
   */
  // const stripLatex = (text: string): string => {
  //   if (!text) return ''
  //   return text
  //     .replace(/\$\$[\s\S]*?\$\$/g, '') // 移除块级LaTeX
  //     .replace(/\$[^$]*\$/g, '') // 移除行内LaTeX
  //     .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '') // 移除LaTeX命令
  //     .trim()
  // }
  
  /**
   * 格式化组件数组为纯文本（用于复制）
   */
  const formatForCopy = (components: Component[]): string => {
    const lines: string[] = []
    
    components.forEach(comp => {
      const formatted = formatComponentForCopy(comp)
      if (formatted) {
        lines.push(formatted)
      }
    })
    
    return lines.filter(Boolean).join('\n\n').trim()
  }
  
  /**
   * 格式化单个组件（内部使用，不导出）
   */
  const formatComponentForCopy = (comp: Component): string => {
    switch (comp.type) {
      case 'questions_step_style':
        return formatQuestionsStepStyle(comp.data)
      case 'final_answer':
        return formatFinalAnswer(comp.data)
      case 'question_single':
        return formatQuestionSingle(comp.data)
      case 'question_multiple':
        return formatQuestionMultiple(comp.data)
      default:
        return ''
    }
  }
  
  // ===== 私有格式化函数 =====
  
  /**
   * 格式化 questions_step_style
   */
  const formatQuestionsStepStyle = (data: any): string => {
    const lines: string[] = []
    
    data.questions?.forEach((q: any, qIndex: number) => {
      // Question 标题
      lines.push(`Question ${q.number || qIndex + 1}`)
      if (q.title) {
        lines.push(q.title)
      }
      
      // Steps（保留 LaTeX 格式）
      q.steps?.forEach((step: any, sIndex: number) => {
        lines.push(`\n${step.number || sIndex + 1}. ${step.title || ''}`)
        if (step.overview) {
          lines.push(step.overview)
        }
        if (step.content) {
          lines.push(step.content)
        }
      })
      
      // Answer（保留 LaTeX 格式）
      if (q.answer) {
        lines.push(`\nAnswer: ${q.answer}`)
      }
      
      lines.push('') // 空行分隔
    })
    
    return lines.join('\n')
  }
  
  /**
   * 格式化 final_answer（保留 LaTeX 格式）
   */
  const formatFinalAnswer = (data: any): string => {
    const lines: string[] = ['Final Answer:']
    
    data.questions?.forEach((q: any) => {
      lines.push(`${q.number}. ${q.answer}`)
    })
    
    return lines.join('\n')
  }
  
  /**
   * 格式化 question_single（单选题，保留 LaTeX 格式）
   */
  const formatQuestionSingle = (data: any): string => {
    const lines: string[] = ['Final Answer:']
    
    // 找到正确答案
    const correctOption = data.options?.find((o: any) => o.isCorrect === 'yes')
    if (correctOption) {
      lines.push(`${correctOption.label}. ${correctOption.text}`)
    }
    
    // 解释
    if (data.explanation) {
      lines.push('\nExplanation:')
      lines.push(data.explanation)
    }
    
    return lines.join('\n')
  }
  
  /**
   * 格式化 question_multiple（多选题，保留 LaTeX 格式）
   */
  const formatQuestionMultiple = (data: any): string => {
    const lines: string[] = ['Final Answer:']
    
    // 多个问题的答案
    data.questions?.forEach((q: any, index: number) => {
      const answers = Array.isArray(q.answer) 
        ? q.answer.join(', ') 
        : q.answer
      lines.push(`Q${index + 1}: ${answers}`)
    })
    
    // 解释
    if (data.explanations) {
      lines.push('\nExplanations:')
      data.explanations.forEach((exp: any, index: number) => {
        lines.push(`\nQuestion ${index + 1}:`)
        const answers = Array.isArray(exp.answer)
          ? exp.answer.join(', ')
          : exp.answer
        lines.push(`Answer: ${answers}`)
        if (exp.explanation) {
          lines.push(`Explanation: ${exp.explanation}`)
        }
      })
    }
    
    return lines.join('\n')
  }
  
  return {
    formatForCopy,
  }
}
