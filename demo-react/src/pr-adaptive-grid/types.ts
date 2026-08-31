/** 占位格子几何（仅用于 itemSpan，不含 id） */
export type LayoutCell = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export interface Layout {
  gap: number;
  rows: number;
  cols: number;
  items: LayoutCell[];
}

/** 真实渲染项（按 index 对应 layout.items 中的 span） */
export interface Geo {
  cx: number;
  cy: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 拖拽开始回调：origin 为 pointerdown 时的指针坐标，用于消除拖拽阈值导致的鼠标滞后 */
export type PrAdaptiveGridItemDragStartEvent = (
  id: string,
  event: PointerEvent,
  origin?: { x: number; y: number },
) => void;

export type PrAdaptiveGridItemDragEvent = (
  id: string,
  event: PointerEvent,
) => void;

/** 布局计算函数；mode 由应用层在闭包内决定，组件只传 length */
export type GetLayoutFn = (length: number) => Layout;

/** setItem 可选参数 */
export interface GridItemsOptions {
  sticky?: boolean;
  fixed?: boolean;
}
/** setItems 可选参数 */
export type GridItemOptions = GridItemsOptions & {
  index?: number;
};

export type GeoItem = Geo & Required<GridItemOptions>;

/** PrAdaptiveGrid 组件 ref 暴露的方法 */
export type PrAdaptiveGridExpose = {
  setItem: (id: string, option?: GridItemOptions) => void;
  setItems: (ids: string[], option?: GridItemsOptions) => void;
  removeItems: (ids: string[]) => void;
  getItemOrder: () => string[];
};
