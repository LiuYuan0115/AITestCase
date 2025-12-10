import { inject } from 'vue'
import { LatexSandboxSymbol } from '~/plugins/latex-sandbox'
import type { LatexParseResult } from '~/types/latex-sandbox'
import { LatexSandboxService } from '~/services/latex-sandbox'

export function useLatexSandbox() {
  const service = inject<LatexSandboxService>(LatexSandboxSymbol)
  
  if (!service) {
    throw new Error('LatexSandbox service not found')
  }

  return {
    parseLatex: (latex: string): Promise<LatexParseResult> => {
      return service.parseLatex(latex)
    }
  }
} 