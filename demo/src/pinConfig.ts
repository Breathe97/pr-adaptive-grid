import type { GridSetItemOptions, GridSizeSpec } from 'pr-adaptive-grid'

/** 应用层 Pin 规格（仅允许一个 sticky） */
export const PIN_WIDTH: GridSizeSpec = '70%'
export const PIN_HEIGHT: GridSizeSpec = '100%'

export type PinItemLayout = Pick<GridSetItemOptions, 'left' | 'top' | 'width' | 'height'>

export const resolvePinItemLayout = (): PinItemLayout => ({
  left: 0,
  top: 0,
  width: PIN_WIDTH,
  height: PIN_HEIGHT
})
