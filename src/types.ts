/** 自动排列方向：右(左→右) / 左(右→左) / 下(上→下) / 上(下→上) */
export type GridDirection = 'right' | 'left' | 'down' | 'up'

export interface GridItem {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface GridConfig {
  cols: number
  rows: number
  gap: number
  padding?: number
  /** 自动排列方向，默认 right */
  direction?: GridDirection
}

export interface GridLayoutRect {
  x: number
  y: number
  w: number
  h: number
}

export interface GridItemStyle {
  width: string
  height: string
  transform: string
}

export interface GridLayoutResult {
  layoutMap: Map<string, GridLayoutRect>
  styleMap: Map<string, GridItemStyle & Record<string, string>>
  /** 最终落位（含自动分配后的 col/row） */
  placementMap: Map<string, { col: number; row: number; colSpan: number; rowSpan: number }>
  contentW: number
  contentH: number
  colW: number
  rowH: number
}

/** @deprecated 使用 GridItem */
export type ListItem = GridItem
