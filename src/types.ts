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
  /** 固定位置：不可拖动，拖动排序时不会被挤压位移 */
  fixed?: boolean
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

export interface GridReorderPayload {
  list: GridItem[]
  /** 与普通 item 交换 pin 位置时，新的 pin id */
  nextPinId?: string
}

/** setItem / setItems 可选参数（仅 sticky、fixed、index；布局坐标由组件内部计算） */
export interface GridSetItemOptions {
  /** 滚动时固定在容器可视区域 */
  sticky?: boolean
  /** 固定位置：不可拖动，拖动排序时不会被挤压位移 */
  fixed?: boolean
  /** 新 item 插入 ids 的索引（仅 setItem 生效），默认追加到末尾 */
  index?: number
}

/** setItem / setItems 单条入参；options 省略或为 undefined 时保留该 id 已有属性 */
export interface GridSetItemEntry {
  id: string
  options?: GridSetItemOptions
}

/** PrAdaptiveGrid 对外暴露的方法 */
export interface PrAdaptiveGridExpose {
  /** 新增或更新 item；id 已存在时按 options 合并更新属性 */
  setItem: (id: string, options?: GridSetItemOptions) => void
  /** 批量新增或更新 item；数组顺序即 ids 顺序，未包含的已有 id 会被移除；entry.options 为 undefined 时保留该 id 原有属性 */
  setItems: (entries: GridSetItemEntry[]) => void
  /** 按 id 移除一个或多个 item */
  removeItem: (ids: string | string[]) => void
  /** 获取当前 item 列表（只读快照） */
  getItems: () => GridItem[]
  /** 打乱可移动 item 顺序，fixed item 保持 ids 槽位 */
  shuffleItems: () => void
  /** 结束拖动/过渡动画并无动画同步到当前布局，便于 pin 等大幅布局变更 */
  settleActiveAnimations: () => void
  /** 开始采集布局诊断日志（开发环境） */
  startDebugCapture: () => void
  /** 结束采集、下载 JSON 文件并返回 JSON 字符串 */
  endDebugCapture: () => string
  /** 写入一条外部诊断日志（如 demo shuffle） */
  recordDebug: (event: string, data?: Record<string, unknown>) => void
}

/** 布局诊断日志条目 */
export interface AgDebugEntry {
  seq: number
  t: number
  event: string
  data: Record<string, unknown>
}

/** 布局诊断完整报告 */
export interface AgDebugReport {
  startedAt: number
  endedAt: number
  durationMs: number
  entryCount: number
  entries: AgDebugEntry[]
}

/** @deprecated 使用 GridItem */
export type ListItem = GridItem
