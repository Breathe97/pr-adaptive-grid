import type { GridItem } from '../../types'

/** 布局结果：组件只负责按 cols/rows/list 渲染 */
export interface LayoutResult {
  cols: number
  rows: number
  list: GridItem[]
  /** 首屏视口均分的网格轨道行数 */
  firstScreenRowSplit: number
}

/** mode1 */
const MODE1_MAX_COLS = 5
const MODE1_FIRST_SCREEN_ROWS = 3

/** mode2 首屏：最多 7 行 item，每行最多 2 个，共 14 个（可改常量） */
const MODE2_MAX_ITEM_ROWS = 7
const MODE2_MAX_ITEMS_PER_ROW = 2
const MODE2_FIRST_SCREEN_MAX_ITEMS = MODE2_MAX_ITEM_ROWS * MODE2_MAX_ITEMS_PER_ROW

/** 左右列宽比 3 : 1 */
const MODE2_COL_RATIO_LEFT = 3
const MODE2_COL_RATIO_RIGHT = 1

/** 首屏网格轨道行数（7×2），视口按此均分高度 */
const MODE2_FIRST_SCREEN_GRID_ROWS = MODE2_MAX_ITEM_ROWS * MODE2_MAX_ITEMS_PER_ROW

/** 满 7 行 item 时，每个逻辑行占用的轨道行数 */
const MODE2_LOGICAL_ROW_HEIGHT = MODE2_FIRST_SCREEN_GRID_ROWS / MODE2_MAX_ITEM_ROWS

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number): number => (a * b) / gcd(a, b)

/** 可被 1~n 整除的最小正整数 */
const getFinalRowCount = (rowCount: number): number => {
  const n = Math.floor(rowCount)
  if (!Number.isFinite(n) || n < 1) return 1
  let result = 1
  for (let i = 2; i <= n; i++) {
    result = lcm(result, i)
  }
  return result
}

/**
 * 首屏网格轨道行数：保证每个逻辑行 item 等高（gridRows / 逻辑行数 为整数）
 */
const getFirstScreenGridRowsForBands = (logicalRowCount: number): number => {
  if (logicalRowCount <= 0) return MODE2_FIRST_SCREEN_GRID_ROWS
  if (MODE2_FIRST_SCREEN_GRID_ROWS % logicalRowCount === 0) {
    return MODE2_FIRST_SCREEN_GRID_ROWS
  }
  const byUnit = logicalRowCount * MODE2_LOGICAL_ROW_HEIGHT
  if (byUnit <= MODE2_FIRST_SCREEN_GRID_ROWS) return byUnit
  return getFinalRowCount(logicalRowCount)
}

/** 每个逻辑行等高 */
const getEqualBandHeights = (logicalRowCount: number, gridRows: number): number[] => {
  const bandH = gridRows / logicalRowCount
  return Array(logicalRowCount).fill(bandH)
}

/** 根据右侧每行 item 数推导总列数（3:1） */
const getMode2GridCols = (
  maxItemsPerRightRow: number
): { cols: number; pinCols: number; rightCols: number; rightStart: number } => {
  const rightCols = Math.max(MODE2_MAX_ITEMS_PER_ROW, maxItemsPerRightRow)
  const cols = (MODE2_COL_RATIO_LEFT + MODE2_COL_RATIO_RIGHT) * (rightCols / MODE2_COL_RATIO_RIGHT)
  const pinCols = MODE2_COL_RATIO_LEFT * (rightCols / MODE2_COL_RATIO_RIGHT)
  return {
    cols,
    pinCols,
    rightCols,
    rightStart: pinCols + 1
  }
}

const getRowsMode1 = (n: number): number => {
  if (n <= 0) return 1
  if (n <= 3) return 1
  const r = Math.floor(Math.sqrt(n))
  let rows = r >= 4 && n > r * (r + 1) ? r + 1 : Math.max(2, r)
  rows = Math.max(rows, Math.ceil(n / MODE1_MAX_COLS))
  return rows
}

const getRowCountsMode1 = (n: number): number[] => {
  if (n <= 0) return []
  const rowCount = getRowsMode1(n)
  const base = Math.floor(n / rowCount)
  const remainder = n % rowCount
  return Array.from({ length: rowCount }, (_, i) => base + (i >= rowCount - remainder ? 1 : 0))
}

const getGridColsFromRowCounts = (rowCounts: number[]): number => {
  if (!rowCounts.length) return 1
  return rowCounts.reduce((a, b) => lcm(a, b), 1)
}

const buildRowMode1 = (y: number, count: number, gridCols: number, ids: string[], offset: number): GridItem[] => {
  const w = gridCols / count
  return Array.from({ length: count }, (_, i) => ({
    id: ids[offset + i],
    x: 1 + i * w,
    y,
    w,
    h: 1
  }))
}

const buildListMode1 = (rowCounts: number[], gridCols: number, ids: string[]): GridItem[] => {
  const items: GridItem[] = []
  let offset = 0
  rowCounts.forEach((count, index) => {
    items.push(...buildRowMode1(index + 1, count, gridCols, ids, offset))
    offset += count
  })
  return items
}

const getLayoutMode1 = (ids: string[]): LayoutResult => {
  const n = ids.length
  if (n === 0) {
    return { cols: 1, rows: 1, list: [], firstScreenRowSplit: 1 }
  }
  const rowCounts = getRowCountsMode1(n)
  const cols = getGridColsFromRowCounts(rowCounts)
  const rows = rowCounts.length
  const list = buildListMode1(rowCounts, cols, ids)
  return {
    cols,
    rows,
    list,
    firstScreenRowSplit: Math.min(rows, MODE1_FIRST_SCREEN_ROWS)
  }
}

const fillTwosThenTrim = (rowCount: number, total: number): number[] => {
  const counts = Array(rowCount).fill(2)
  let excess = 2 * rowCount - total
  for (let i = rowCount - 1; i >= 0 && excess > 0; i--) {
    const reduce = Math.min(counts[i] - 1, excess)
    counts[i] -= reduce
    excess -= reduce
  }
  return counts
}

/** 右侧逻辑行：每行最多 2 个，余数从最后一行往前 +1 */
const getRightRowCounts = (n: number): number[] => {
  if (n <= 2) return []
  if (n === 3) return [1, 2]
  if (n === 4) return [2, 2]
  if (n === 5) return [1, 2, 2]
  if (n === 6) return [2, 2, 2]
  if (n === 7) return [1, 2, 2, 2]
  if (n === 8) return [2, 2, 2, 2]
  const rowCount = 3 + Math.ceil((n - 6) / 2)
  const firstOne = n % 4 === 1 || n % 4 === 3
  if (firstOne) {
    return [1, ...fillTwosThenTrim(rowCount - 1, n - 1)]
  }
  return fillTwosThenTrim(rowCount, n)
}

const getFirstScreenItemCount = (n: number): number => {
  if (n <= 0) return 0
  if (n <= 2) return n
  const rowCounts = getRightRowCounts(n)
  let usedItemRows = 0
  let items = 0
  for (const count of rowCounts) {
    if (usedItemRows >= MODE2_MAX_ITEM_ROWS) break
    const next = items + count
    if (next > MODE2_FIRST_SCREEN_MAX_ITEMS) {
      return MODE2_FIRST_SCREEN_MAX_ITEMS
    }
    usedItemRows += 1
    items = next
  }
  return Math.min(items, n, MODE2_FIRST_SCREEN_MAX_ITEMS)
}

const appendRightBands = (
  items: GridItem[],
  ids: string[],
  rowCounts: number[],
  bandHeights: number[],
  rightCols: number,
  rightStart: number,
  startOffset: number,
  startY: number
): number => {
  let y = startY
  let offset = startOffset

  rowCounts.forEach((count, bandIndex) => {
    const bandH = bandHeights[bandIndex]
    const itemW = rightCols / count

    for (let i = 0; i < count; i++) {
      items.push({
        id: ids[offset + i],
        x: rightStart + i * itemW,
        y,
        w: itemW,
        h: bandH
      })
    }

    y += bandH
    offset += count
  })

  return y
}

const buildRightSimple = (
  ids: string[],
  rightCols: number,
  rightStart: number,
  startY: number,
  gridRows: number
): GridItem[] => {
  const bandHeights = getEqualBandHeights(ids.length, gridRows)
  const items: GridItem[] = []
  let y = startY

  bandHeights.forEach((h, i) => {
    items.push({ id: ids[i], x: rightStart, y, w: rightCols, h })
    y += h
  })

  return items
}

const buildRightSection = (
  ids: string[],
  rightCols: number,
  rightStart: number,
  startY: number,
  gridRows: number
): GridItem[] => {
  const n = ids.length
  if (n <= 2) return buildRightSimple(ids, rightCols, rightStart, startY, gridRows)

  const rowCounts = getRightRowCounts(n)
  const bandHeights = getEqualBandHeights(rowCounts.length, gridRows)
  const items: GridItem[] = []
  appendRightBands(items, ids, rowCounts, bandHeights, rightCols, rightStart, 0, startY)
  return items
}

const resolveFirstScreenGridRows = (firstIds: string[]): number => {
  const n = firstIds.length
  if (n <= 0) return MODE2_FIRST_SCREEN_GRID_ROWS
  if (n <= 2) return getFirstScreenGridRowsForBands(n)
  return getFirstScreenGridRowsForBands(getRightRowCounts(n).length)
}

/** 首屏下方继续排：每行最多 2 个，行高与首屏单行 item 一致 */
const buildRightOverflow = (
  ids: string[],
  rightCols: number,
  rightStart: number,
  firstScreenGridRows: number,
  overflowBandH: number
): GridItem[] => {
  const items: GridItem[] = []
  let offset = 0
  let remaining = ids.length
  let y = firstScreenGridRows + 1

  while (remaining > 0) {
    const rowCount = Math.min(MODE2_MAX_ITEMS_PER_ROW, remaining)
    y = appendRightBands(items, ids, [rowCount], [overflowBandH], rightCols, rightStart, offset, y)
    offset += rowCount
    remaining -= rowCount
  }

  return items
}

const buildRightLayout = (
  ids: string[],
  rightCols: number,
  rightStart: number
): { items: GridItem[]; firstScreenGridRows: number; overflowBandH: number } => {
  if (!ids.length) {
    return { items: [], firstScreenGridRows: MODE2_FIRST_SCREEN_GRID_ROWS, overflowBandH: MODE2_LOGICAL_ROW_HEIGHT }
  }

  const firstCount = getFirstScreenItemCount(ids.length)
  const firstIds = ids.slice(0, firstCount)
  const overflowIds = ids.slice(firstCount)

  const firstScreenGridRows = resolveFirstScreenGridRows(firstIds)
  const logicalRows = firstIds.length <= 2 ? firstIds.length : getRightRowCounts(firstIds.length).length
  const overflowBandH = firstScreenGridRows / Math.max(logicalRows, 1)

  const items: GridItem[] = []

  if (firstIds.length) {
    items.push(...buildRightSection(firstIds, rightCols, rightStart, 1, firstScreenGridRows))
  }
  if (overflowIds.length) {
    items.push(...buildRightOverflow(overflowIds, rightCols, rightStart, firstScreenGridRows, overflowBandH))
  }

  return { items, firstScreenGridRows, overflowBandH }
}

const getRightLayoutRows = (items: GridItem[]): number => {
  if (!items.length) return 0
  return Math.max(...items.map((item) => item.y + item.h - 1))
}

const getLayoutMode2 = (ids: string[], fullId?: string): LayoutResult => {
  const hasFull = Boolean(fullId && ids.includes(fullId))
  const rightIds = hasFull && fullId ? ids.filter((id) => id !== fullId) : [...ids]

  const maxPerRow = rightIds.length
    ? Math.max(...getRightRowCounts(Math.min(rightIds.length, MODE2_FIRST_SCREEN_MAX_ITEMS)), 1)
    : 1
  const { cols, pinCols, rightCols, rightStart } = getMode2GridCols(maxPerRow)

  const { items: rightItems, firstScreenGridRows } = buildRightLayout(rightIds, rightCols, rightStart)

  if (!ids.length) {
    return {
      cols,
      rows: MODE2_FIRST_SCREEN_GRID_ROWS,
      list: [],
      firstScreenRowSplit: MODE2_FIRST_SCREEN_GRID_ROWS
    }
  }

  const list: GridItem[] = []

  if (hasFull && fullId) {
    list.push({
      id: fullId,
      x: 1,
      y: 1,
      w: pinCols,
      h: firstScreenGridRows
    })
  }

  list.push(...rightItems)

  const rightRows = getRightLayoutRows(rightItems)
  const rows = Math.max(firstScreenGridRows, rightRows)

  return {
    cols,
    rows,
    list,
    firstScreenRowSplit: firstScreenGridRows
  }
}

/** 有 sticky 时用 mode2，否则 mode1 */
export const resolveGridLayout = (ids: string[], stickyId?: string): LayoutResult => {
  if (stickyId) {
    return getLayoutMode2(ids, stickyId)
  }
  return getLayoutMode1(ids)
}
