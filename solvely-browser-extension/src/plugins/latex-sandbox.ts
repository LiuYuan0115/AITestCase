import { type App } from 'vue'
import { LatexSandboxService } from '~/services/latex-sandbox'

export const LatexSandboxSymbol = Symbol('LatexSandbox')

export function installLatexSandbox(app: App) {
  const service = LatexSandboxService.getInstance()
  
  app.provide(LatexSandboxSymbol, service)
} 