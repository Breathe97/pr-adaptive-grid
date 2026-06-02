import type { GridSizeSpec } from 'pr-adaptive-grid'
import { PIN_FLOW_INSET_LEFT } from './pinConfig'

/**
 * 应用层布局参数：由业务决定 cols / rows / 流式区逻辑边距，通过 props 传给组件。
 * gap 扣减与 sticky 间距由 PrAdaptiveGrid 内部根据 :gap 计算。
 */
export interface DemoLayoutConfig {
  cols: number
  rows: number
  left: GridSizeSpec
  top: GridSizeSpec
  right: GridSizeSpec
  bottom: GridSizeSpec
}

/** 有 Pin 时左侧逻辑边距为 70%（与 Pin 宽一致） */
export const resolveDemoLayout = (itemCount: number, hasSticky: boolean): DemoLayoutConfig => {
  void itemCount
  const cols = 2
  const rows = 2

  if (hasSticky) {
    return {
      cols,
      rows,
      left: PIN_FLOW_INSET_LEFT,
      top: 0,
      right: 0,
      bottom: 0
    }
  }

  return { cols, rows, left: 0, top: 0, right: 0, bottom: 0 }
}
