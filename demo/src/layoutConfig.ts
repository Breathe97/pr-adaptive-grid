/**
 * 应用层布局参数：由业务决定 cols / rows / 流式区内边距，通过 props 传给组件。
 */
export interface DemoLayoutConfig {
  cols: number
  rows: number
  left: number
  top: number
  right: number
  bottom: number
}

/** 示例：有 sticky 时左侧留出固定宽度，流式区在右侧 */
export const resolveDemoLayout = (itemCount: number, hasSticky: boolean): DemoLayoutConfig => {
  void itemCount
  const cols = 2
  const rows = 2

  if (hasSticky) {
    return {
      cols,
      rows,
      left: 320,
      top: 0,
      right: 0,
      bottom: 0
    }
  }

  return { cols, rows, left: 0, top: 0, right: 0, bottom: 0 }
}
