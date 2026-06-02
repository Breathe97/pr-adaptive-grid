import { packRowCounts } from './packRowCounts'
import type { GridSizeSpec } from '../../types'
import { resolveGridSizeSpec } from './resolveGridSize'

export interface ItemLayoutMeta {
  width?: GridSizeSpec
  height?: GridSizeSpec
  sticky?: boolean
  fixed?: boolean
  left?: number
  top?: number
  right?: number
  bottom?: number
}

export interface FlowLayoutInput {
  flowX: number
  flowY: number
  flowW: number
  flowH: number
  ids: string[]
  meta: Map<string, ItemLayoutMeta>
  cols: number
  firstScreenRows: number
  gap: number
  defaultWidth: number
  defaultHeight: number
}

export interface FlowLayoutResult {
  rects: Map<string, { x: number; y: number; w: number; h: number }>
  contentHeight: number
}

const distributeRowWidths = (
  rowIds: string[],
  meta: Map<string, ItemLayoutMeta>,
  rowWidth: number,
  gap: number,
  defaultWidth: number
): Map<string, number> => {
  const widths = new Map<string, number>()
  if (!rowIds.length) return widths

  const n = rowIds.length
  const totalGap = Math.max(0, n - 1) * gap
  const available = Math.max(0, rowWidth - totalGap)

  const fixed = new Map<string, number>()
  let fixedSum = 0
  let flexCount = 0

  for (const id of rowIds) {
    const w = meta.get(id)?.width
    if (typeof w === 'number' && w > 0) {
      fixed.set(id, w)
      fixedSum += w
    } else {
      flexCount += 1
    }
  }

  const flexSpace = Math.max(0, available - fixedSum)
  const flexEach = flexCount > 0 ? flexSpace / flexCount : 0

  if (flexCount === n) {
    const each = available / n
    for (const id of rowIds) {
      widths.set(id, each)
    }
    return widths
  }

  for (const id of rowIds) {
    if (fixed.has(id)) {
      widths.set(id, fixed.get(id)!)
    } else {
      widths.set(id, flexEach > 0 ? flexEach : defaultWidth)
    }
  }

  return widths
}

const distributeRowHeights = (
  rowIds: string[],
  meta: Map<string, ItemLayoutMeta>,
  rowHeight: number
): Map<string, number> => {
  const heights = new Map<string, number>()
  for (const id of rowIds) {
    const h = meta.get(id)?.height
    heights.set(id, typeof h === 'number' && h > 0 ? h : rowHeight)
  }
  return heights
}

/**
 * 计算流式 item 的像素布局（不含 sticky）。
 */
export const computeFlowLayout = (input: FlowLayoutInput): FlowLayoutResult => {
  const { flowX, flowY, flowW, flowH, ids, meta, cols, firstScreenRows, gap, defaultWidth, defaultHeight } = input

  const rects = new Map<string, { x: number; y: number; w: number; h: number }>()

  if (!ids.length || flowW <= 0) {
    return { rects, contentHeight: flowY }
  }

  const rowCounts = packRowCounts(ids.length, cols)
  const screenRowCount = Math.min(firstScreenRows, rowCounts.length)
  const screenRows = rowCounts.slice(0, screenRowCount)
  const overflowRows = rowCounts.slice(screenRowCount)

  const screenRowTotal = screenRows.length || 1
  const screenGap = Math.max(0, screenRowTotal - 1) * gap
  const screenRowHeight =
    flowH > 0 ? (flowH - screenGap) / screenRowTotal : defaultHeight > 0 ? defaultHeight : 1

  const overflowRowHeight = screenRowHeight

  let y = flowY
  let idOffset = 0

  const placeRows = (counts: number[], baseRowHeight: number) => {
    for (const count of counts) {
      const rowIds = ids.slice(idOffset, idOffset + count)
      idOffset += count

      const widthMap = distributeRowWidths(rowIds, meta, flowW, gap, defaultWidth)
      const heightMap = distributeRowHeights(rowIds, meta, baseRowHeight)

      let rowH = baseRowHeight
      for (const id of rowIds) {
        rowH = Math.max(rowH, heightMap.get(id) ?? baseRowHeight)
      }

      let x = flowX
      for (const id of rowIds) {
        const w = widthMap.get(id) ?? 0
        const h = heightMap.get(id) ?? rowH
        rects.set(id, { x, y, w, h })
        x += w + gap
      }

      y += rowH + gap
    }
  }

  placeRows(screenRows, screenRowHeight)

  if (overflowRows.length) {
    placeRows(overflowRows, overflowRowHeight)
  }

  const contentHeight = Math.max(y - gap, flowY + screenRowHeight)

  void defaultHeight
  return { rects, contentHeight }
}

/** 首屏单行基准高度 */
export const getScreenBandRowHeight = (
  flowH: number,
  firstScreenRowCount: number,
  gap: number,
  defaultHeight: number
): number => {
  const total = Math.max(1, firstScreenRowCount)
  const rowGap = Math.max(0, total - 1) * gap
  return flowH > 0 ? (flowH - rowGap) / total : defaultHeight > 0 ? defaultHeight : 1
}

export interface StickyLayoutInput {
  containerW: number
  containerH: number
  meta: ItemLayoutMeta
  defaultWidth: number
  defaultHeight: number
}

/** sticky item 使用 left/top/right/bottom + 可选 width/height */
export const computeStickyRect = (input: StickyLayoutInput): { x: number; y: number; w: number; h: number } => {
  const { containerW, containerH, meta, defaultWidth, defaultHeight } = input

  const left = meta.left ?? 0
  const top = meta.top ?? 0
  const right = meta.right ?? 0
  const bottom = meta.bottom ?? 0

  let w = resolveGridSizeSpec(meta.width, containerW, defaultWidth)
  let h = resolveGridSizeSpec(meta.height, containerH, defaultHeight)

  if (meta.width == null && right > 0) {
    w = Math.max(0, containerW - left - right)
  }
  if (meta.height == null && bottom > 0) {
    h = Math.max(0, containerH - top - bottom)
  }

  return { x: left, y: top, w, h }
}

/** 所有 sticky 矩形的并集包围盒 */
export const unionStickyRects = (
  rects: Array<{ x: number; y: number; w: number; h: number }>
): { x: number; y: number; w: number; h: number } | null => {
  if (!rects.length) return null

  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity

  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }

  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/**
 * 流式区域 = 容器 − sticky 并集 − 已扣 gap 的边距。
 * sticky 贴左/上时，流式区从并集外缘 + gap 开始。
 */
export const resolveFlowArea = (
  containerW: number,
  containerH: number,
  insets: { left: number; top: number; right: number; bottom: number },
  stickyUnion: { x: number; y: number; w: number; h: number } | null,
  gap = 0
): { x: number; y: number; w: number; h: number } => {
  let x = insets.left
  let y = insets.top
  let w = Math.max(0, containerW - insets.left - insets.right)
  let h = Math.max(0, containerH - insets.top - insets.bottom)

  if (stickyUnion && stickyUnion.w > 0 && stickyUnion.h > 0) {
    const unionRight = stickyUnion.x + stickyUnion.w
    const unionBottom = stickyUnion.y + stickyUnion.h
    const g = Math.max(0, gap)

    if (stickyUnion.x <= insets.left + 1) {
      x = Math.max(x, unionRight + g)
      w = Math.max(0, containerW - insets.right - x)
    }

    if (stickyUnion.y <= insets.top + 1) {
      y = Math.max(y, unionBottom + g)
      h = Math.max(0, containerH - insets.bottom - y)
    }
  }

  return { x, y, w, h }
}
