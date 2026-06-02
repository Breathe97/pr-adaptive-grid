/**
 * 应用层布局参数：由业务决定 cols / rows / 流式区逻辑边距，通过 props 传给组件。
 * Pin 占位由 sticky 并集计算，无需再传 left 偏移。
 */
export interface DemoLayoutConfig {
  cols: number
  rows: number
  left: number
  top: number
  right: number
  bottom: number
}

export const resolveDemoLayout = (itemCount: number): DemoLayoutConfig => {
  void itemCount
  return { cols: 2, rows: 2, left: 0, top: 0, right: 0, bottom: 0 }
}
