export interface LayoutItem {
  /** 元素唯一 ID（getLayout 几何不含 id，由组件或 demo 合并） */
  id?: string
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

/** 布局计算函数，默认使用包内 getLayout */
export type GetLayoutFn = (length: number) => Layout

/** addItem 可选参数（除 id 外） */
export type LayoutItemOptions = Partial<Pick<LayoutItem, 'x' | 'y' | 'w' | 'h' | 'sticky' | 'fixed'>> & {
  /** 插入到 ids 顺序中的下标，默认末尾 */
  index?: number
}

/** PrAdaptiveGrid 组件 expose 的方法 */
export type PrAdaptiveGridExpose = {
  syncLayout: () => Promise<void>
  getLayout: (length: number) => Layout
  setLayout: (layout: Layout) => void
  getLayoutState: () => Layout
  addItem: (id: string, option?: LayoutItemOptions) => void
  removeItems: (ids: string[]) => void
}
