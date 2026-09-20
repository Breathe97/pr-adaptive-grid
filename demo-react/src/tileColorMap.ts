/**
 * Tile 背景色映射表 —— 单独维护，全局唯一。
 *
 * 一个 id 第一次取色时随机生成并写进表，之后永远复用同一个颜色：
 * 增减 item、重置、切布局、切尺寸都不会重新生成，避免颜色乱跳。
 */

/** id → 背景色 */
const colorMap = new Map<string, string>()

/** 高饱和度随机色，亮度偏高以对比深色背景 */
const pickContrastColor = (): string => {
  const hue = Math.floor(Math.random() * 360)
  const sat = 88 + Math.floor(Math.random() * 13)
  const light = 65 + Math.floor(Math.random() * 14)
  return `hsl(${hue} ${sat}% ${light}%)`
}

/** 确保 id 已有颜色：已登记的原样返回，没有的现生成并登记 */
export const ensureTileColor = (id: string): string => {
  const cached = colorMap.get(id)
  if (cached) return cached
  const color = pickContrastColor()
  colorMap.set(id, color)
  return color
}

/** 读取 tile 背景色（首次读取即登记） */
export const getTileColor = (id: string): string => ensureTileColor(id)

/** 映射表本体，只读用途（调试 / 导出配色） */
export const tileColorMap: ReadonlyMap<string, string> = colorMap
