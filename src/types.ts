/** 占位格子几何（仅用于 itemSpan，不含 id） */
export type LayoutCell = {
  x: number
  y: number
  w: number
  h: number
}

export interface Layout {
  gap: number
  rows: number
  cols: number
  items: LayoutCell[]
}

/** 真实渲染项（按 index 对应 layout.items 中的 span） */
export interface GridItem {
  id: string
  sticky?: boolean
  fixed?: boolean
}

/** 插槽数据：业务字段 + 当前 index 对应格子的几何 */
export type GridSlotItem = GridItem & LayoutCell

/** 布局计算函数，默认使用 layout.default */
export type GetLayoutFn = (length: number) => Layout

/** addItem 可选参数（除 id 外） */
export type GridItemOptions = Partial<Pick<GridItem, 'sticky' | 'fixed'>> & {
  index?: number
}

/** PrAdaptiveGrid 组件 expose 的方法 */
export type PrAdaptiveGridExpose = {
  syncLayout: () => Promise<void>
  getLayout: (length: number) => Layout
  setLayoutGeometry: (layout: Layout) => void
  setGridItems: (items: GridItem[]) => void
  getLayoutState: () => Layout
  getGridItems: () => GridItem[]
  addItem: (id: string, option?: GridItemOptions) => void
  removeItems: (ids: string[]) => void
}
