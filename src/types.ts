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
  cx: number
  cy: number
  left: number
  top: number
  width: number
  height: number
}

/** 拖拽开始回调：origin 为 pointerdown 时的指针坐标，用于消除拖拽阈值导致的鼠标滞后 */
export type PrAdaptiveGridItemDragStartEvent = (
  id: string,
  event: PointerEvent,
  origin?: { x: number; y: number }
) => void

export type PrAdaptiveGridItemDragEvent = (id: string, event: PointerEvent) => void

/** 布局工厂：按 item 数量生成占位网格；mode 由应用层决定，组件只传 length */
export type LayoutFactory = (length: number) => Layout

/** 容器尺寸快照 */
export interface ResizePayload {
  width: number
  height: number
}

/** 尺寸变化回调 */
export type ResizeHandler = (payload: ResizePayload) => void

/** setLayout 可选参数 */
export interface SetLayoutOptions {
  /** 完全重建 item 列表，顺序即传入顺序；原有顺序 / sticky / fixed 全部清空重来 */
  ids?: string[]
  /** 本次重建是否播放入场动画，默认 true；与本次 ids 批次绑定，渲染后即恢复默认 */
  animate?: boolean
  /** 虚拟列表溢出渲染屏数，默认 1；设为负数禁用虚拟列表，渲染全部 item */
  overScan?: number
}

/** item 的 sticky / fixed 状态 */
export interface GridItemsOptions {
  sticky?: boolean
  fixed?: boolean
}

/**
 * setItems 入参项。
 * - 传 id：修改这个 id 的 item 参数；同时传 index 就顺带把它重排到目标槽位
 * - 传 id 但不传 index：只改参数，保持该 item 当前的槽位，不影响顺序
 * - 不传 id、只传 index：修改「当前第 index 个槽位」上那个 item 的参数，不做重排
 * - id 与 index 都不传：由组件按数组下标兜底补齐顺序
 */
export interface GridItemInput extends GridItemsOptions {
  id?: string
  index?: number
}

export type GeoItem = Geo & Required<GridItemsOptions>

/** createLayout：单个数量档位的主区模板 */
export interface LayoutPreset {
  /** 主区列数 */
  cols: number
  /** 主区行数 */
  rows: number
  /** 主区占位（完整显式坐标）；数量必须等于本 preset 在 presets 里的 key */
  items: LayoutCell[]
}

/** createLayout：溢出区规则；按数组顺序匹配，命中第一个 divisibleBy 成立的 */
export interface SurplusRule {
  /** 剩余项数能被此值整除时，本规则生效 */
  divisibleBy: number
  /** 起始行（1-based） */
  startRow: number
  /** 起始列（1-based） */
  startCol: number
  /** 每项占几列 */
  span: number
  /** 列游标步进；缺省 = span */
  step?: number
  /** 列游标等于此值时换行（回到 startCol，行 +1） */
  wrapAtCol: number
  /** 只剩最后 1 项、且位于 startCol 时，该项宽度改用此值；缺省 = span */
  lastItemSpan?: number
}

/** createLayout 配置 */
export interface CreateLayoutConfig {
  /** 格子间距 */
  gap: number
  /** 设计容量：主区最多容纳 designCols × designRows 个 */
  designCols: number
  designRows: number
  /** 主区数量缩减的对齐除数（现有 default 布局是 designCols - 1） */
  alignDivisor: number
  /** 数量（itemsNum）→ 主区模板 */
  presets: Record<number, LayoutPreset>
  /** 溢出规则 */
  surplus?: SurplusRule[]
}

/** PrAdaptiveGrid 组件 expose 的方法 */
export type PrAdaptiveGridExpose = {
  /** 设置布局工厂；可选完全重建 item 列表与渲染配置 */
  setLayout: (factory: LayoutFactory, options?: SetLayoutOptions) => void
  /** 注册容器尺寸变化回调；覆盖式，重复调用替换上一个 */
  onResize: (handler: ResizeHandler) => void
  /** 批量设置 / 新增 / 重排 item；已存在且不传 index 的 item 保持原槽位，新 item 不传 index 时由组件按数组顺序找空位 */
  setItems: (items: GridItemInput[]) => void
  /** 移除 item（带退场动画） */
  removeItems: (ids: string[]) => void
}
