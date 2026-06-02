import type { GridLayoutInsets, GridSizeSpec } from '../../types'

const PERCENT_RE = /^(\d+(?:\.\d+)?)%$/

/** 将像素或百分比尺寸解析为 px（相对 containerSize） */
export const resolveGridSizeSpec = (
  spec: GridSizeSpec | undefined,
  containerSize: number,
  fallback: number
): number => {
  if (spec == null) return fallback
  if (typeof spec === 'number') {
    return Math.max(0, spec)
  }
  const m = PERCENT_RE.exec(spec.trim())
  if (!m) return fallback
  return Math.max(0, Math.round(containerSize * (Number(m[1]) / 100)))
}

export const isGridSizeSpec = (value: unknown): value is GridSizeSpec => {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return PERCENT_RE.test(value.trim())
  return false
}

/** 将四边边距解析为 px（水平边相对 containerW，垂直边相对 containerH） */
export const resolveGridInsets = (
  insets: GridLayoutInsets,
  containerW: number,
  containerH: number
): { left: number; top: number; right: number; bottom: number } => ({
  left: resolveGridSizeSpec(insets.left, containerW, 0),
  top: resolveGridSizeSpec(insets.top, containerH, 0),
  right: resolveGridSizeSpec(insets.right, containerW, 0),
  bottom: resolveGridSizeSpec(insets.bottom, containerH, 0)
})

/**
 * 由组件内部调用：在解析后的边距上扣除 item gap，得到真实流式布局区域边距。
 * 应用层传入逻辑边距（如 Pin 区 70%），勿自行减 gap。
 */
export const applyLayoutInsetGap = (
  insets: { left: number; top: number; right: number; bottom: number },
  gap: number
): { left: number; top: number; right: number; bottom: number } => ({
  left: insets.left > 0 ? Math.max(0, insets.left - gap) : 0,
  top: insets.top > 0 ? Math.max(0, insets.top - gap) : 0,
  right: insets.right > 0 ? Math.max(0, insets.right - gap) : 0,
  bottom: insets.bottom > 0 ? Math.max(0, insets.bottom - gap) : 0
})
