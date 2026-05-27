import type { GridItem } from '../../src/types'

export interface LayoutResult {
  cols: number
  rows: number
  list: GridItem[]
}

export type LayoutMode = '1' | '2'

const MODE2_COLS = 7
/** fullId 固定占满首屏 4 行 */
const MODE2_FULL_ROWS = 4
const MODE2_LEFT_COLS = 5
const MODE2_RIGHT_COL_START = 6
const MODE2_RIGHT_MAX_PER_ROW = 2

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

const lcm = (a: number, b: number): number => (a * b) / gcd(a, b)

/**
 * mode 1 行数：N≤3 为 1 行；否则 r=⌊√N⌋，
 * 若 r≥4 且 N>r(r+1) 则 r+1 行，否则 max(2,r) 行。
 */
const getRowsMode1 = (n: number): number => {
  if (n <= 3) return 1
  const r = Math.floor(Math.sqrt(n))
  if (r >= 4 && n > r * (r + 1)) return r + 1
  return Math.max(2, r)
}

/**
 * mode 1 每行个数：base=⌊N/rows⌋，余数从最后一行往前每行 +1。
 */
const getRowCountsMode1 = (n: number): number[] => {
  if (n <= 0) return []

  const rowCount = getRowsMode1(n)
  const base = Math.floor(n / rowCount)
  const remainder = n % rowCount

  return Array.from({ length: rowCount }, (_, i) => base + (i >= rowCount - remainder ? 1 : 0))
}

const getGridCols = (rowCounts: number[]): number => {
  if (!rowCounts.length) return 1
  return rowCounts.reduce((a, b) => lcm(a, b))
}

const buildRow = (y: number, count: number, gridCols: number, ids: string[], offset: number): GridItem[] => {
  const w = gridCols / count
  return Array.from({ length: count }, (_, i) => ({
    id: ids[offset + i],
    x: 1 + i * w,
    y,
    w,
    h: 1
  }))
}

const buildList = (rowCounts: number[], gridCols: number, ids: string[]): GridItem[] => {
  const items: GridItem[] = []
  let offset = 0
  rowCounts.forEach((count, index) => {
    items.push(...buildRow(index + 1, count, gridCols, ids, offset))
    offset += count
  })
  return items
}

const getLayoutMode1 = (ids: string[]): LayoutResult => {
  const n = ids.length
  if (n === 0) {
    return { cols: 1, rows: 1, list: [] }
  }

  const rowCounts = getRowCountsMode1(n)
  const cols = getGridCols(rowCounts)
  const rows = rowCounts.length
  const list = buildList(rowCounts, cols, ids)

  return { cols, rows, list }
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

/**
 * mode2 右侧每行个数（列 6-7，每行最多 2 个），行数随 n 自动增长。
 * 1→[1]  2→[1,1]  3→[1,2]  4→[2,2]  5→[1,2,2]  6→[2,2,2]  7→[1,2,2,2] …
 */
const getRightRowCounts = (n: number): number[] => {
  if (n <= 0) return []
  if (n === 1) return [1]
  if (n === 2) return [1, 1]
  if (n === 3) return [1, 2]
  if (n === 4) return [2, 2]

  const rowCount = n === 5 ? 3 : 3 + Math.ceil((n - 6) / 2)
  const firstOne = n % 4 === 1 || n % 4 === 3

  if (firstOne) {
    return [1, ...fillTwosThenTrim(rowCount - 1, n - 1)]
  }
  return fillTwosThenTrim(rowCount, n)
}

/** 在列 6-7 放置右侧元素 */
const buildRightList = (rowCounts: number[], ids: string[]): GridItem[] => {
  const items: GridItem[] = []
  let offset = 0

  rowCounts.forEach((count, rowIndex) => {
    const y = rowIndex + 1

    if (count === 1) {
      items.push({
        id: ids[offset],
        x: MODE2_RIGHT_COL_START,
        y,
        w: MODE2_RIGHT_MAX_PER_ROW,
        h: 1
      })
      offset += 1
      return
    }

    for (let i = 0; i < count; i++) {
      items.push({
        id: ids[offset + i],
        x: MODE2_RIGHT_COL_START + i,
        y,
        w: 1,
        h: 1
      })
    }
    offset += count
  })

  return items
}

const getLayoutMode2 = (ids: string[], fullId?: string): LayoutResult => {
  if (!ids.length) {
    return { cols: MODE2_COLS, rows: MODE2_FULL_ROWS, list: [] }
  }

  const list: GridItem[] = []
  const hasFull = Boolean(fullId && ids.includes(fullId))
  const rightIds = hasFull ? ids.filter((id) => id !== fullId) : [...ids]

  if (hasFull) {
    list.push({
      id: fullId!,
      x: 1,
      y: 1,
      w: MODE2_LEFT_COLS,
      h: MODE2_FULL_ROWS
    })
  }

  const rightRowCounts = getRightRowCounts(rightIds.length)
  if (rightIds.length) {
    list.push(...buildRightList(rightRowCounts, rightIds))
  }

  const rightRows = rightRowCounts.length
  const rows = hasFull ? Math.max(MODE2_FULL_ROWS, rightRows) : Math.max(1, rightRows)

  return {
    cols: MODE2_COLS,
    rows,
    list
  }
}

export const getLayout = (ids: string[], mode: LayoutMode = '1', ext?: { fullId?: string }): LayoutResult => {
  switch (mode) {
    case '1':
      return getLayoutMode1(ids)
    case '2':
      return getLayoutMode2(ids, ext?.fullId)
    default:
      return { cols: 1, rows: 1, list: [] }
  }
}
