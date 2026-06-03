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

/** 布局计算函数；mode 由应用层在闭包内决定，组件只传 length */
export type GetLayoutFn = (length: number) => Layout

/** setItem / setItems 可选参数（除 id 外）；已存在 id 时未传的字段保留原值 */
export type GridItemOptions = Partial<Pick<GridItem, 'sticky' | 'fixed'>> & {
  index?: number
}

/** PrAdaptiveGrid 组件 expose 的方法 */
export type PrAdaptiveGridExpose = {
  syncLayout: () => Promise<void>
  setItem: (id: string, option?: GridItemOptions) => void
  setItems: (ids: string[], option?: GridItemOptions) => void
  removeItems: (ids: string[]) => void
}
