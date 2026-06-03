export interface LayoutItem {
  /** 网格开始的水平坐标位置（列索引，0-based） */
  x: number
  /** 网格开始的垂直坐标位置（行索引，0-based） */
  y: number
  /** 该元素在当前行的宽度占比 */
  w: number
  /** 该元素在当前列的高度占比 */
  h: number
  /** 滚动时固定在容器可视区域 */
  sticky?: boolean
  /** 固定位置：不可拖动，拖动排序时不会被挤压位移 */
  fixed?: boolean
}

export interface Layout {
  gap: number
  rows: number
  cols: number
  items: LayoutItem[]
}

/** PrAdaptiveGrid 组件 expose 的方法 */
export type PrAdaptiveGridExpose = {
  syncLayout: () => Promise<void>
}
