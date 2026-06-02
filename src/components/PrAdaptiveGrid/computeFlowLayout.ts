import { packRowCounts } from './packRowCounts'
import type { GridSizeSpec } from '../../types'
import { resolveGridSizeSpec } from './resolveGridSize'

export interface ItemLayoutMeta {
  /** 仅 sticky: true 时参与布局 */
  width?: GridSizeSpec
  /** 仅 sticky: true 时参与布局 */
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

/** 将 total 均分为 parts 份整数，余数分配给前几项 */
export const splitIntegerTotal = (total: number, parts: number): number[] => {
  const n = Math.max(0, Math.floor(parts))
  if (n === 0) return []

  const t = Math.max(0, Math.floor(total))
  const base = Math.floor(t / n)
  let rem = t - base * n

  return Array.from({ length: n }, () => {
    const extra = rem > 0 ? 1 : 0
    if (rem > 0) rem -= 1
    return base + extra
  })
}

/**
 * 行内宽度：flex 均分可用宽度（整数 px），保证 sum(w) + (n-1)*gap === rowWidth。
 */
/** 流式行内宽度均分（忽略 meta.width，仅 sticky 使用自定义宽高） */
const distributeRowWidths = (rowIds: string[], rowWidth: number, gap: number): Map<string, number> => {
  const widths = new Map<string, number>()
  const n = rowIds.length
  if (!n || rowWidth <= 0) return widths

  const totalGap = Math.max(0, n - 1) * gap
  const available = Math.max(0, rowWidth - totalGap)
  const flexWidths = splitIntegerTotal(available, n)
  rowIds.forEach((id, i) => widths.set(id, flexWidths[i]))

  return absorbRowWidthDrift(widths, rowIds, rowWidth, gap)
}

const absorbRowWidthDrift = (
  widths: Map<string, number>,
  rowIds: string[],
  rowWidth: number,
  gap: number
): Map<string, number> => {
  const n = rowIds.length
  if (!n) return widths

  let used = 0
  for (let i = 0; i < n; i++) {
    used += widths.get(rowIds[i]) ?? 0
    if (i < n - 1) used += gap
  }

  const drift = rowWidth - used
  if (drift !== 0) {
    const last = rowIds[n - 1]
    widths.set(last, Math.max(0, (widths.get(last) ?? 0) + drift))
  }

  return widths
}

/**
 * 计算流式 item 的像素布局（不含 sticky）。
 */
export const computeFlowLayout = (input: FlowLayoutInput): FlowLayoutResult => {
  const { flowX, flowY, flowW, flowH, ids, cols, firstScreenRows, gap, defaultHeight } = input

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
  const screenContentH = flowH > 0 ? Math.max(0, flowH - screenGap) : 0
  const screenRowHeights =
    screenContentH > 0
      ? splitIntegerTotal(screenContentH, screenRowTotal)
      : Array(screenRowTotal).fill(defaultHeight > 0 ? defaultHeight : 1)

  const overflowRowHeight =
    screenRowHeights[screenRowHeights.length - 1] ?? (defaultHeight > 0 ? defaultHeight : 1)

  let y = flowY
  let idOffset = 0

  const placeRows = (counts: number[], rowHeights: number[]) => {
    for (let ri = 0; ri < counts.length; ri++) {
      const count = counts[ri]
      const rowIds = ids.slice(idOffset, idOffset + count)
      idOffset += count

      const rowBandH = rowHeights[ri] ?? overflowRowHeight
      const widthMap = distributeRowWidths(rowIds, flowW, gap)

      let x = flowX
      for (const id of rowIds) {
        const w = widthMap.get(id) ?? 0
        rects.set(id, { x, y, w, h: rowBandH })
        x += w + gap
      }

      y += rowBandH + gap
    }
  }

  placeRows(screenRows, screenRowHeights)

  if (overflowRows.length) {
    placeRows(
      overflowRows,
      overflowRows.map(() => overflowRowHeight)
    )
  }

  const contentHeight = Math.max(y - gap, flowY + (screenRowHeights[0] ?? overflowRowHeight))

  return { rects, contentHeight }
}

/** 首屏单行基准高度（整数 px，与 splitIntegerTotal 一致） */
export const getScreenBandRowHeight = (
  flowH: number,
  firstScreenRowCount: number,
  gap: number,
  defaultHeight: number
): number => {
  const total = Math.max(1, firstScreenRowCount)
  const rowGap = Math.max(0, total - 1) * gap
  const contentH = flowH > 0 ? Math.max(0, flowH - rowGap) : 0
  if (contentH <= 0) return defaultHeight > 0 ? defaultHeight : 1
  return splitIntegerTotal(contentH, total)[0] ?? defaultHeight
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

    const onLeftColumn = stickyUnion.x <= insets.left + 1

    if (onLeftColumn) {
      x = Math.max(x, unionRight + g)
      w = Math.max(0, containerW - insets.right - x)
    }

    // 左侧通栏 Pin（占满高度）的 y 也为 0，不能当作顶栏 sticky 把流式区整体下移
    const isTopBandOnly = unionBottom < containerH - insets.bottom - 1

    if (stickyUnion.y <= insets.top + 1 && (!onLeftColumn || isTopBandOnly)) {
      y = Math.max(y, unionBottom + g)
      h = Math.max(0, containerH - insets.bottom - y)
    }
  }

  return { x, y, w, h }
}
