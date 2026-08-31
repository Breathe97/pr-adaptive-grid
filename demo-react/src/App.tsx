import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PrAdaptiveGrid, getLayout, getLectureLayout, getMobileLayout } from './pr-adaptive-grid'
import type { Geo, GetLayoutFn, GridItemsOptions, PrAdaptiveGridExpose } from './pr-adaptive-grid'
import './App.css'

const DEFAULT_USER_COUNT = 10 // 演示初始 item 数量

type GridSlotItem = Geo & Required<GridItemsOptions> & { id: string }

export default function App() {
  const [layoutMode, setLayoutModeState] = useState<1 | 2 | 3>(1) // 1 默认布局，2 讲座布局，3 移动布局

  /** .demo 四边边距，滑块实时调试用，范围 0~80px，默认 0 */
  const [padding, setPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 })
  const paddingDirs = [
    { key: 'top', label: '上' },
    { key: 'right', label: '右' },
    { key: 'bottom', label: '下' },
    { key: 'left', label: '左' }
  ] as const
  /** 应用到 .demo 内联样式 */
  const demoStyle: CSSProperties = {
    paddingTop: `${padding.top}px`,
    paddingRight: `${padding.right}px`,
    paddingBottom: `${padding.bottom}px`,
    paddingLeft: `${padding.left}px`
  }

  const [paddingOpen, setPaddingOpen] = useState(false) // 边距面板是否展开
  const paddingControlRef = useRef<HTMLDivElement>(null) // 边距控制容器（按钮+面板），用于点击外部关闭

  const gridRef = useRef<PrAdaptiveGridExpose>(null) // 网格组件实例
  const [userCount, setUserCount] = useState(DEFAULT_USER_COUNT) // 工具栏显示的数量
  const [tileColorMap, setTileColorMap] = useState(() => new Map<string, string>()) // 每个 id 对应的 tile 背景色

  const idsRef = useRef<string[]>([]) // 业务侧 id 顺序
  const stickyIdRef = useRef<string | null>(null) // 当前唯一 Sticky 的 item id
  const stickySwapIndexRef = useRef<number | null>(null) // Sticky 时与 index 0 互换的原下标

  /** 从前 10 项中筛选可移除候选；保护当前 Sticky 的 item。 */
  const getRemovableCandidates = () => {
    const pool = idsRef.current.slice(0, Math.min(10, idsRef.current.length))
    if (stickyIdRef.current) return pool.filter((id) => id !== stickyIdRef.current)
    return pool
  }

  const canRemoveItem = userCount > 1

  /** 高饱和度随机色，亮度偏高以对比黑色背景 */
  const pickContrastColor = (): string => {
    const hue = Math.floor(Math.random() * 360)
    const sat = 88 + Math.floor(Math.random() * 13)
    const light = 65 + Math.floor(Math.random() * 14)
    return `hsl(${hue} ${sat}% ${light}%)`
  }

  /** 为新 id 分配并缓存随机背景色（单次添加用） */
  const ensureTileColor = (id: string) => {
    setTileColorMap((prev) => {
      if (prev.has(id)) return prev
      const next = new Map(prev)
      next.set(id, pickContrastColor())
      return next
    })
  }

  /** 读取 tile 背景色，未分配时用默认色 */
  const getTileColor = (id: string): string => tileColorMap.get(id) ?? 'hsl(210 95% 72%)'

  /** 交换 ids 中两个下标的 id（应用层换位） */
  const swapIdsAt = (a: number, b: number) => {
    const ids = idsRef.current
    if (a === b || a < 0 || b < 0 || a >= ids.length || b >= ids.length) return
    const tmp = ids[a]
    ids[a] = ids[b]
    ids[b] = tmp
  }

  /** 取消当前 Sticky 并还原换位。 */
  const clearSticky = () => {
    const prevId = stickyIdRef.current
    if (stickySwapIndexRef.current != null) swapIdsAt(0, stickySwapIndexRef.current)
    stickyIdRef.current = null
    stickySwapIndexRef.current = null
    if (prevId) gridRef.current?.setItem(prevId, { sticky: false })
  }

  /** 将指定 id 设为唯一 Sticky，并换到 index 0。 */
  const applyStickyToId = (targetId: string) => {
    const ids = idsRef.current
    if (ids.length === 0) return
    const wasSticky = stickyIdRef.current === targetId

    if (stickyIdRef.current && stickyIdRef.current !== targetId && stickySwapIndexRef.current != null) {
      swapIdsAt(0, stickySwapIndexRef.current)
    }

    const index = ids.indexOf(targetId)
    if (index === -1) return

    if (index !== 0) {
      swapIdsAt(0, index)
      stickySwapIndexRef.current = index
    } else if (!wasSticky || stickySwapIndexRef.current == null) {
      stickySwapIndexRef.current = null
    }

    stickyIdRef.current = targetId
  }

  /** 一次 setItems，模式 2 时强制唯一 Sticky，模式 1/3 保留已有 sticky 不动。 */
  const initGrid = async () => {
    if (!gridRef.current) return
    gridRef.current.setItems(idsRef.current)
    // 模式 2：强制只有 stickyId 是 sticky，清除其他
    if (layoutMode === 2) {
      idsRef.current.forEach((id) => {
        gridRef.current?.setItem(id, { sticky: id === stickyIdRef.current })
      })
    }
  }

  /** 切换布局模式：切到模式 2 时自动清除所有 Sticky 并 Sticky 第一个 item。 */
  const setLayoutMode = async (mode: 1 | 2 | 3) => {
    if (layoutMode === mode) return
    setLayoutModeState(mode)

    if (mode === 2) {
      stickyIdRef.current = null
      stickySwapIndexRef.current = null
      if (idsRef.current.length > 0) {
        applyStickyToId(idsRef.current[0])
        gridRef.current?.setItem(idsRef.current[0], { fixed: true })
      }
    }

    // 等一帧让 initGrid 闭包里的 layoutMode 更新生效
    await new Promise<void>((r) => setTimeout(r, 0))
    await initGridRef.current()
  }

  // initGrid 依赖 layoutMode state，通过 ref 保证调用到最新版本
  const initGridRef = useRef(initGrid)
  initGridRef.current = initGrid

  /** 闭包读取 layoutMode，组件只传 length */
  const resolveLayout: GetLayoutFn = useCallback(
    (length) => {
      let layout
      switch (layoutModeRef.current) {
        case 1:
          layout = getLayout(length)
          break
        case 2:
          layout = getLectureLayout(length)
          break
        case 3:
          layout = getMobileLayout(length)
          break
        default:
          layout = getLayout(length)
          break
      }
      return layout
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const layoutModeRef = useRef(layoutMode)
  layoutModeRef.current = layoutMode

  /** 切换 Fixed：只锁定当前 id 的拖拽排序能力，不改变业务顺序。 */
  const setFixed = (item: GridSlotItem) => {
    gridRef.current?.setItem(item.id, { fixed: !item.fixed })
  }

  /** 增减 item：+1 插入新 id，-1 随机移除一个 */
  const changeUserCount = (delta: number) => {
    const ids = idsRef.current
    if (delta === 1) {
      if (userCount < 1) return
      const id = `${Math.max(...ids.map(Number), 0) + 1}` // 递增数字 id
      const index = 0 // 插入下标，Sticky 时避开首位
      ensureTileColor(id)
      gridRef.current?.setItem(id, { index })
      ids.splice(index, 0, id)
      setUserCount((c) => c + 1)
      return
    }
    const candidates = getRemovableCandidates()
    if (candidates.length === 0) return
    const removeId = candidates[Math.floor(Math.random() * candidates.length)]
    if (!removeId) return
    gridRef.current?.removeItems([removeId])
    ids.splice(ids.indexOf(removeId), 1)
    if (stickyIdRef.current === removeId) {
      stickyIdRef.current = null
      stickySwapIndexRef.current = null
    }
    setUserCount((c) => c - 1)
  }

  /** 切换 Sticky：模式 1/3 自由切换不影响布局；模式 2 唯一 Sticky + 自动排到 index 0。 */
  const setSticky = async (target: GridSlotItem) => {
    if (idsRef.current.indexOf(target.id) < 0) return

    if (layoutModeRef.current === 2) {
      // 模式 2：唯一 Sticky，点击时排到 index 0
      if (target.sticky) {
        clearSticky()
      } else {
        applyStickyToId(target.id)
      }
      await new Promise<void>((r) => setTimeout(r, 0))
      await initGridRef.current()
      return
    }

    // 模式 1/3：自由切换，不干涉布局
    gridRef.current?.setItem(target.id, { sticky: !target.sticky })
  }

  /** Fisher-Yates 打乱 ids 后按当前 mode 重排 */
  const shuffleItems = () => {
    const ids = idsRef.current
    if (ids.length <= 1) return
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = ids[i]
      ids[i] = ids[j]
      ids[j] = tmp
    }
    void initGridRef.current()
  }

  /** 分块生成默认 ids，避免大量数据同步阻塞主线程。每块生成后 yield 给浏览器。 */
  const getDefaultIds = async () => {
    const next: string[] = []
    const colors = new Map<string, string>()
    const CHUNK = 10000 // 每批 1 万条

    for (let start = DEFAULT_USER_COUNT; start >= 1; start -= CHUNK) {
      const end = Math.max(1, start - CHUNK + 1)
      for (let i = start; i >= end; i--) {
        const id = `${i}`
        colors.set(id, pickContrastColor())
        next.push(id)
      }
      // 让出主线程，避免长时间阻塞
      await new Promise<void>((r) => setTimeout(r, 0))
    }

    setTileColorMap(colors)
    return next
  }

  /** 重置为初始默认 ids，并清除 Sticky / Fixed 与布局模式。 */
  const resetGrid = async () => {
    if (!gridRef.current) return
    const newIds = await getDefaultIds()
    idsRef.current = newIds
    setLayoutModeState(1)
    layoutModeRef.current = 1
    stickyIdRef.current = null
    stickySwapIndexRef.current = null
    setUserCount(DEFAULT_USER_COUNT)
    gridRef.current.setItems(idsRef.current)
    idsRef.current.forEach((id) => {
      gridRef.current?.setItem(id, { sticky: false, fixed: false })
    })
  }

  /** 点击边距面板外部时收起面板 */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = paddingControlRef.current
      if (el && !el.contains(e.target as Node)) setPaddingOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  /** 一次性 setItems 初始化演示数据 */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const newIds = await getDefaultIds()
      if (cancelled) return
      idsRef.current = newIds
      await initGridRef.current()
      setUserCount(DEFAULT_USER_COUNT)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="demo" style={demoStyle}>
      <div className="grid-wrap">
        <PrAdaptiveGrid ref={gridRef} getLayout={resolveLayout}>
          {(item) => (
            <div
              className={`tile${item.sticky ? ' is-sticky' : ''}${item.fixed ? ' is-fixed' : ''}`}
              style={{ backgroundColor: getTileColor(item.id) }}
            >
              {(item.sticky || item.fixed) && (
                <div className="tile-badges">
                  {item.sticky && <span className="badge badge-sticky">📌 Sticky</span>}
                  {item.fixed && <span className="badge badge-fixed">🔒 Fixed</span>}
                </div>
              )}
              <span className="tile-id">{item.id}</span>
              {/* geo 调试信息 */}
              <div className="tile-geo">
                <span>cx: {Math.round(item.cx)}</span>
                <span>cy: {Math.round(item.cy)}</span>
                <span>w: {Math.round(item.width)}</span>
                <span>h: {Math.round(item.height)}</span>
              </div>
              <div className="tile-ops">
                <div
                  className={`op${item.sticky ? ' active' : ''}`}
                  data-type="sticky"
                  onClick={(e) => {
                    e.stopPropagation()
                    void setSticky(item)
                  }}
                >
                  Sticky
                </div>
                <div
                  className={`op${item.fixed ? ' active' : ''}`}
                  data-type="fix"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFixed(item)
                  }}
                >
                  Fixed
                </div>
              </div>
            </div>
          )}
        </PrAdaptiveGrid>
      </div>

      <div className="float-bar">
        <div className="help-wrap">
          <button type="button" className="help-btn" aria-label="Sticky 与 Fixed 说明">
            ?
          </button>
          <div className="help-panel" role="tooltip" aria-label="按钮说明">
            <p className="help-title">按钮说明</p>
            <div className="help-item">
              <span className="help-tag help-tag-sticky">📌 Sticky</span>
              <p className="help-desc">滚动时固定在网格可视区域。模式 1/3 可随意 Sticky 多个；模式 2 只能 Sticky 一个，点击时自动排到首位。</p>
            </div>
            <div className="help-item">
              <span className="help-tag help-tag-fixed">🔒 Fixed</span>
              <p className="help-desc">锁定 ids 槽位，不可拖动，排序时不会被其他 item 挤压位移。</p>
            </div>
          </div>
        </div>
        <span className="bar-sep" />
        <button type="button" className="bar-btn" disabled={!canRemoveItem} onClick={() => changeUserCount(-1)}>
          −
        </button>
        <span className="bar-count">{userCount}</span>
        <button type="button" className="bar-btn" onClick={() => changeUserCount(1)}>
          +
        </button>
        <span className="bar-sep" />
        <div className="bar-mode" role="group" aria-label="布局模式">
          <button type="button" className={`bar-mode-btn${layoutMode === 1 ? ' active' : ''}`} onClick={() => void setLayoutMode(1)}>
            布局 1
          </button>
          <button type="button" className={`bar-mode-btn${layoutMode === 2 ? ' active' : ''}`} onClick={() => void setLayoutMode(2)}>
            布局 2
          </button>
          <button type="button" className={`bar-mode-btn${layoutMode === 3 ? ' active' : ''}`} onClick={() => void setLayoutMode(3)}>
            布局 3
          </button>
        </div>
        <span className="bar-sep" />
        <button type="button" className="bar-text" disabled={userCount <= 1} onClick={shuffleItems}>
          打乱
        </button>
        <button type="button" className="bar-text" onClick={() => void resetGrid()}>
          重置
        </button>
        <span className="bar-sep" />
        {/* 四边边距调试：点击按钮弹出面板控制 */}
        <div ref={paddingControlRef} className="padding-control">
          <button
            type="button"
            className={`bar-text${paddingOpen ? ' is-active' : ''}`}
            onClick={() => setPaddingOpen((v) => !v)}
          >
            边距
          </button>
          <div className={`padding-panel${paddingOpen ? ' is-open' : ''}`}>
            <div className="padding-panel-body">
              {paddingDirs.map((d) => (
                <label key={d.key} className="pad-slider">
                  <span className="pad-slider-dir">{d.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={padding[d.key]}
                    onChange={(e) => setPadding((p) => ({ ...p, [d.key]: Number(e.target.value) }))}
                  />
                  <span className="pad-slider-val">{padding[d.key]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
