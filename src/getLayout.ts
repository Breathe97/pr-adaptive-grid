import type { GridItem } from './types'

export interface LayoutResult {
  cols: number
  rows: number
  list: GridItem[]
  /** 首屏等高行数（mode1 最多 3 行，mode2 为 12） */
  firstScreenRowSplit?: number
}

export type LayoutMode = '1' | '2'

/** mode1 首屏最多 3 行、5 列 */
const MODE1_MAX_COLS = 5
const MODE1_FIRST_SCREEN_ROWS = 3

/** 12 列网格：左侧 8 列（2/3），右侧 4 列（1/3） */
const MODE2_COLS = 12
/** 首屏 12 行（3×4），便于 1~4 等分且 n=3 时撑满 */
const MODE2_FULL_ROWS = 12
const MODE2_LEFT_COLS = 8
/** 右侧区域：列 9-12（1/3 宽） */
const MODE2_RIGHT_COL_START = 9
const MODE2_RIGHT_COLS = 4
/** 右侧每个 item 统一占用的行高（网格行数） */
const MODE2_RIGHT_CELL_ROWS = 4

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

const lcm = (a: number, b: number): number => (a * b) / gcd(a, b)

/**
 * mode1 行数：N≤3 为 1 行；否则 r=⌊√N⌋，
 * 若 r≥4 且 N>r(r+1) 则 r+1 行，否则 max(2,r) 行。
 * 每行最多 MODE1_MAX_COLS 个（rows ≥ ceil(n/5)）。
 */
const getRowsMode1 = (n: number): number => {
  if (n <= 0) return 1
  if (n <= 3) return 1

  const r = Math.floor(Math.sqrt(n))
  let rows = r >= 4 && n > r * (r + 1) ? r + 1 : Math.max(2, r)
  rows = Math.max(rows, Math.ceil(n / MODE1_MAX_COLS))

  return rows
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

/** 各行 item 数的最小公倍数，保证同行等分 */
const getGridColsMode1 = (rowCounts: number[]): number => {
  if (!rowCounts.length) return 1
  return rowCounts.reduce((a, b) => lcm(a, b))
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
    return { cols: 1, rows: 1, list: [] }
  }

  const rowCounts = getRowCountsMode1(n)
  const cols = getGridColsMode1(rowCounts)
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

/**
 * 右侧逻辑行分布（非真实网格行号）
 * 3→[1,2]  4→[2,2]  5→[1,2,2] …
 */
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

/** 将 total 行均分给 n 段，余数从最后一行往前 +1 */
const distributeRows = (total: number, segments: number): number[] => {
  const base = Math.floor(total / segments)
  const remainder = total % segments
  return Array.from({ length: segments }, (_, i) => base + (i >= segments - remainder ? 1 : 0))
}

/** n=1~2：右侧 1/3 内纵向均分，占满首屏 12 行 */
const buildRightSimple = (ids: string[]): GridItem[] => {
  const bandHeights = distributeRows(MODE2_FULL_ROWS, ids.length)
  const items: GridItem[] = []
  let y = 1

  bandHeights.forEach((h, i) => {
    items.push({ id: ids[i], x: MODE2_RIGHT_COL_START, y, w: MODE2_RIGHT_COLS, h })
    y += h
  })

  return items
}

/** pin 场景：首屏右侧固定 4 排（12 行均分）；R≥9 时首屏 7/8 交替；溢出排与首屏同行高 */
const MODE2_PIN_FIRST_SCREEN_BANDS = 4
const MODE2_PIN_OVERFLOW_THRESHOLD = 9

/** R 为奇数 → 首屏 7 个，R 为偶数 → 首屏 8 个（R≥9） */
const getPinFirstScreenCount = (rightCount: number): number => {
  return rightCount % 2 === 1 ? 7 : 8
}

const appendRightBands = (items: GridItem[], ids: string[], rowCounts: number[], bandHeights: number[], startOffset: number, startY: number): number => {
  let y = startY
  let offset = startOffset

  rowCounts.forEach((count, bandIndex) => {
    const bandH = bandHeights[bandIndex]
    const itemW = MODE2_RIGHT_COLS / count

    for (let i = 0; i < count; i++) {
      items.push({
        id: ids[offset + i],
        x: MODE2_RIGHT_COL_START + i * itemW,
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

/**
 * pin + 右侧 R≥9：首屏 4 排 7/8 交替，第 5 排起每排最多 2 个，行高与首屏一致
 * 例 R=9 → 7+2；R=10 → 8+2；R=11 → 7+2+2；R=12 → 8+2+2
 */
const buildRightLayoutWithPin = (ids: string[]): GridItem[] => {
  const R = ids.length
  const items: GridItem[] = []

  const firstScreenCount = getPinFirstScreenCount(R)
  const firstRowCounts = getRightRowCounts(firstScreenCount)
  const firstBandHeights = distributeRows(MODE2_FULL_ROWS, MODE2_PIN_FIRST_SCREEN_BANDS)
  const overflowBandHeight = firstBandHeights[0]

  let y = appendRightBands(items, ids, firstRowCounts, firstBandHeights, 0, 1)

  let offset = firstScreenCount
  let remaining = R - firstScreenCount

  while (remaining > 0) {
    const rowCount = Math.min(2, remaining)
    y = appendRightBands(items, ids, [rowCount], [overflowBandHeight], offset, y)
    offset += rowCount
    remaining -= rowCount
  }

  return items
}

/** n=5~8 首屏 12 行内排布；n>8 按逻辑行规律且每逻辑行 h=4 */
const buildRightPattern = (ids: string[]): GridItem[] => {
  const n = ids.length
  const rowCounts = getRightRowCounts(n)
  const bandCount = rowCounts.length
  const bandHeights = n <= 8 ? distributeRows(MODE2_FULL_ROWS, bandCount) : Array(bandCount).fill(MODE2_RIGHT_CELL_ROWS)

  const items: GridItem[] = []
  appendRightBands(items, ids, rowCounts, bandHeights, 0, 1)
  return items
}

/** n=1~2：纵向均分 12 行；n≥3：按逻辑行并排 */
const buildRightLayout = (ids: string[], withPin = false): GridItem[] => {
  const n = ids.length
  if (n === 0) return []
  if (withPin && n >= MODE2_PIN_OVERFLOW_THRESHOLD) {
    return buildRightLayoutWithPin(ids)
  }
  if (n <= 2) return buildRightSimple(ids)
  return buildRightPattern(ids)
}

const getRightLayoutRows = (items: GridItem[]): number => {
  if (!items.length) return MODE2_FULL_ROWS
  return Math.max(...items.map((item) => item.y + item.h - 1))
}

const getLayoutMode2 = (ids: string[], fullId?: string): LayoutResult => {
  if (!ids.length) {
    return { cols: MODE2_COLS, rows: MODE2_FULL_ROWS, list: [], firstScreenRowSplit: MODE2_FULL_ROWS }
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

  const rightItems = buildRightLayout(rightIds, hasFull)
  list.push(...rightItems)

  const rightRows = getRightLayoutRows(rightItems)
  const rows = hasFull ? Math.max(MODE2_FULL_ROWS, rightRows) : Math.max(1, rightRows)

  return {
    cols: MODE2_COLS,
    rows,
    list,
    firstScreenRowSplit: MODE2_FULL_ROWS
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
