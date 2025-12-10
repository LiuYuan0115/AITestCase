export interface DragState {
  canMove: boolean
  canClick: boolean
  startY: number
  endY: number
  bottom: number
}

export interface FloatState {
  isPageShow: boolean
  isGlobalEnabled: boolean
}

export interface ModalState {
  show: boolean
}

export interface AttractState {
  shouldShow: boolean
}

