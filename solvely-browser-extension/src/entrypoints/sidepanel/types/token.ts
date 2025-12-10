export enum InjectionTokens {
  SHOW_ACTIONS = 'SHOW_ACTIONS',
  CANCEL_REGISTRY = 'CANCEL_REGISTRY',
  IS_STOPPED = 'IS_STOPPED',
  SHOW_MODEL_NAVIGATOR = 'SHOW_MODEL_NAVIGATOR',
}

export interface CancelRegistry {
  registerCancelable: (messageId: string, cancelFn: () => void) => void
  unregisterCancelable: (messageId: string) => void
}
