const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

const lcm = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0
  return (Math.abs(a) * Math.abs(b)) / gcd(a, b)
}

/**
 * 根据传入行数 n，生成最终行数。
 * 返回值可被 1、2、…、n 中任意整数整除（即 lcm(1, 2, …, n)）。
 *
 * @example
 * getFinalRowCount(3) // 6  （6÷1、6÷2、6÷3 均为整数）
 * getFinalRowCount(4) // 12
 * getFinalRowCount(7) // 420
 */
export const getFinalRowCount = (rowCount: number): number => {
  const n = Math.floor(rowCount)
  if (!Number.isFinite(n) || n < 1) return 1

  let result = 1
  for (let i = 2; i <= n; i++) {
    result = lcm(result, i)
  }
  return result
}
