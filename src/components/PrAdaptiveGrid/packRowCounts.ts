/**
 * 按列数将 n 个 item 分成若干行；每行最多 cols 个。
 * 不能整除时，余数从最后一行往前减（最后一行优先变少）。
 */
export const packRowCounts = (total: number, cols: number): number[] => {
  if (total <= 0 || cols <= 0) return []

  const rowCount = Math.ceil(total / cols)
  const counts = Array<number>(rowCount).fill(cols)
  let excess = rowCount * cols - total

  for (let i = rowCount - 1; i >= 0 && excess > 0; i--) {
    const reduce = Math.min(counts[i] - 1, excess)
    counts[i] -= reduce
    excess -= reduce
  }

  return counts
}
