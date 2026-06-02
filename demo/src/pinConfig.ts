import type { GridSetItemOptions, GridSizeSpec } from 'pr-adaptive-grid'

/** 应用层 Pin 规格（仅允许一个 sticky） */
export const PIN_WIDTH: GridSizeSpec = '70%'
export const PIN_HEIGHT: GridSizeSpec = '100%'

/** 有 Pin 时传给组件的流式区逻辑左边距（与 Pin 宽度一致；gap 由组件内部扣除） */
export const PIN_FLOW_INSET_LEFT: GridSizeSpec = PIN_WIDTH

export type PinItemLayout = Pick<GridSetItemOptions, 'left' | 'top' | 'width' | 'height'>

export const resolvePinItemLayout = (): PinItemLayout => ({
  left: 0,
  top: 0,
  width: PIN_WIDTH,
  height: PIN_HEIGHT
})
