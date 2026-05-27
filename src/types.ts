/** 自动排列方向（预留，自动排布时使用） */
export type GridDirection = 'right' | 'left' | 'down' | 'up'

export interface GridItem {
  /** 元素唯一 ID */
  id: string
  /** 网格开始的水平坐标位置（列索引，0-based） */
  x: number
  /** 网格开始的垂直坐标位置（行索引，0-based） */
  y: number
  /** 该元素在当前行的宽度占比（权重，同行自动分配剩余空间） */
  w: number
  /** 该元素在当前列的高度占比（权重，同列自动分配剩余空间） */
  h: number
  /** 滚动时固定在容器可视区域 */
  sticky?: boolean
}

export interface GridConfig {
  cols: number
  rows: number
  gap: number
  padding?: number
  direction?: GridDirection
}

/** 像素级布局矩形 */
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
  styleMap: Map<string, GridItemStyle>
  contentW: number
  contentH: number
}

/** @deprecated 使用 GridItem */
export type ListItem = GridItem
