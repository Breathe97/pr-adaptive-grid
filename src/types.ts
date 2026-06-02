/** 应用层传入的流式布局参数 */
export interface GridLayoutInsets {
  left?: number
  top?: number
  right?: number
  bottom?: number
}

/** 组件渲染用的 item 视图（像素坐标） */
export interface GridItem {
  id: string
  x: number
  y: number
  w: number
  h: number
  sticky?: boolean
  fixed?: boolean
}

export interface GridLayoutRect {
  x: number
  y: number
  w: number
  h: number
}

export interface GridSetItemOptions {
  width?: number
  height?: number
  /** 仅 sticky: true 时生效 */
  left?: number
  top?: number
  right?: number
  bottom?: number
  sticky?: boolean
  fixed?: boolean
  /** 插入 ids 的索引，默认 0（首屏第一行） */
  index?: number
}

export interface GridSetItemEntry {
  id: string
  options?: GridSetItemOptions
}

export interface GridReorderPayload {
  ids: string[]
}

export type GridVisibleChangeHandler = (ids: string[]) => void

export interface PrAdaptiveGridExpose {
  setItem: (id: string, options?: GridSetItemOptions) => void
  setItems: (entries: GridSetItemEntry[]) => void
  removeItem: (ids: string | string[]) => void
  getItems: () => GridItem[]
  getVisibleItems: (offsetPages?: number) => GridItem[]
  settleActiveAnimations: () => void
  shuffleItems: () => void
}
