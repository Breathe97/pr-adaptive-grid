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
export interface Geo {
  left: number
  top: number
  width: number
  height: number
}

/** 布局计算函数；mode 由应用层在闭包内决定，组件只传 length */
export type GetLayoutFn = (length: number) => Layout

/** setItem 可选参数 */
export interface GridItemOptions {
  sticky?: boolean
  fixed?: boolean
}
/** setItems 可选参数 */
export type GridItemsOptions = GridItemOptions & {
  index?: number
}

/** PrAdaptiveGrid 组件 expose 的方法 */
export type PrAdaptiveGridExpose = {
  setItem: (id: string, option?: GridItemsOptions) => void
  setItems: (ids: string[], option?: GridItemOptions) => void
  removeItems: (ids: string[]) => void
}
