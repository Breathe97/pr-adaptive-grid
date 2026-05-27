/**
 * 根据子项总数生成「从上到下每行个数」。
 *
 * mode = 1（均衡向 √N 靠拢，余数从底部均摊）
 *   1→1  4→2 2  10→3 3 4  21→4 4 4 4 5 …
 *
 * mode = 2（以每行 2 个为主，首行常为 1 或末行消减）
 *   1→1  2→1 1  3→1 2  6→2 2 2  7→1 2 2 2  10→2 2 2 2 2 …
 */

export type LayoutMode = 1 | 2

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

export const lcm = (a: number, b: number): number => (a * b) / gcd(a, b)

/** mode 1：行数 */
const getRowsMode1 = (n: number): number => {
  if (n <= 3) return 1
  const r = Math.floor(Math.sqrt(n))
  if (r >= 4 && n > r * (r + 1)) return r + 1
  return Math.max(2, r)
}

/** mode 2：行数 */
const getRowsMode2 = (n: number): number => {
  if (n <= 1) return 1
  if (n <= 5) return 2
  return 3 + Math.ceil((n - 6) / 2)
}

/** mode 1：余数从最后一行往前，每行 +1 */
const distributeMode1 = (n: number, rowCount: number): number[] => {
  const base = Math.floor(n / rowCount)
  const remainder = n % rowCount
  return Array.from({ length: rowCount }, (_, i) => base + (i >= rowCount - remainder ? 1 : 0))
}

/** mode 2：首行是否为 1（N=3，或 N≥7 且 N≡1/3 (mod 4)） */
const mode2FirstRowIsOne = (n: number): boolean =>
  n === 3 || (n >= 7 && (n % 4 === 1 || n % 4 === 3))

/** mode 2：两行时的分配 */
const distributeMode2TwoRows = (n: number): number[] => {
  if (n === 2) return [1, 1]
  if (n === 3) return [1, 2]
  const base = Math.floor(n / 2)
  const rem = n % 2
  return [base, base + rem]
}

/** mode 2：先填满 2，再从末行减去多余 */
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

/** mode 2：每行个数 */
const distributeMode2 = (n: number, rowCount: number): number[] => {
  if (rowCount === 1) return [n]
  if (rowCount === 2) return distributeMode2TwoRows(n)

  if (mode2FirstRowIsOne(n)) {
    const innerRows = rowCount - 1
    const inner = fillTwosThenTrim(innerRows, n - 1)
    return [1, ...inner]
  }

  return fillTwosThenTrim(rowCount, n)
}

/**
 * 根据总数与模式，返回从上到下的每行 item 个数。
 */
export const getRowCounts = (n: number, mode: LayoutMode = 1): number[] => {
  if (n <= 0) return []

  const rowCount = mode === 1 ? getRowsMode1(n) : getRowsMode2(n)
  const counts = mode === 1 ? distributeMode1(n, rowCount) : distributeMode2(n, rowCount)

  const sum = counts.reduce((a, b) => a + b, 0)
  if (sum !== n) {
    console.warn(`[layoutRows] mode=${mode} n=${n} 行分布之和为 ${sum}，期望 ${n}`, counts)
  }

  return counts
}

/** 网格列数：各行个数的 lcm，便于同行等分 */
export const getGridCols = (rowCounts: number[]): number => {
  if (!rowCounts.length) return 1
  return rowCounts.reduce((a, b) => lcm(a, b))
}

/** 格式化为 "N：a b c" */
export const formatLayout = (n: number, mode: LayoutMode = 1): string => {
  return `${n}：${getRowCounts(n, mode).join(' ')}`
}
