// 解题面板控制器
export type PanelControls = {
  openPanel: (imgData: { canvas: HTMLCanvasElement; cutDataUrl: string }) => void
  openExamplePanel: () => void
  openNoLoginPanel: (imgData: { canvas: HTMLCanvasElement; cutDataUrl: string }) => void
  closePanel: (source?: string) => void
  updatePanelPosition: () => void
}