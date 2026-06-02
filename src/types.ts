/** sticky 等区域尺寸：像素，或相对容器的百分比（如 '70%'、'100%'） */
export type GridSizeSpec = number | `${number}%`

/**
 * 应用层传入的流式布局边距（相对网格容器，支持百分比）。
 * 为逻辑预留区域；组件内部会按 props.gap 扣减后计算真实流式区，并与 sticky 之间留出 gap。
 */
export interface GridLayoutInsets {
  left?: GridSizeSpec
  top?: GridSizeSpec
  right?: GridSizeSpec
  bottom?: GridSizeSpec
}

/** 组件渲染用的 item 视图（像素坐标） */
export interface GridItem {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** 为 true 时以 absolute + 滚动 translate 固定在容器可视区（非 CSS position:sticky） */
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
  /** sticky 支持百分比；流式区 item 建议传像素 */
  width?: GridSizeSpec
  height?: GridSizeSpec
  /** 仅 sticky: true 时生效 */
  left?: number
  top?: number
  right?: number
  bottom?: number
  /** 为 true 时以 absolute + 滚动 translate 固定在容器可视区（非 CSS position:sticky） */
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
  /** 过渡时长系数，默认 1；所有动画时长会乘以该值 */
  getTransitionTimeScale: () => number
  setTransitionTimeScale: (scale: number) => void
}
