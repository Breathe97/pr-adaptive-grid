import type { GridItem } from '../../src/types'

export interface LayoutResult {
  cols: number
  rows: number
  list: GridItem[]
}

export type LayoutMode = '1' | '2'

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
 * 例：10→[3,3,4]  21→[4,4,4,4,5]
 */
const getRowCountsMode1 = (n: number): number[] => {
  if (n <= 0) return []

  const rowCount = getRowsMode1(n)
  const base = Math.floor(n / rowCount)
  const remainder = n % rowCount

  return Array.from({ length: rowCount }, (_, i) => base + (i >= rowCount - remainder ? 1 : 0))
}

/** 各行 lcm，用于网格等分列数 */
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

export const getLayout = (ids: string[], mode: LayoutMode = '1', _ext?: { fullId?: string }): LayoutResult => {
  switch (mode) {
    case '1':
      return getLayoutMode1(ids)
    case '2':
      // mode 2 规则待补充
      return { cols: 1, rows: 1, list: [] }
    default:
      return { cols: 1, rows: 1, list: [] }
  }
}
