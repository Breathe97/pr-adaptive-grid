import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PrAdaptiveGrid, layouts } from './pr-adaptive-grid'
import type { Geo, GridItemsOptions, LayoutFactory, PrAdaptiveGridExpose, ResizePayload } from './pr-adaptive-grid'
import { ensureTileColor, getTileColor } from './tileColorMap'
import './App.css'

const DEFAULT_USER_COUNT = 1 // 演示初始 item 数量（与 Vue demo 保持一致）

type GridSlotItem = Geo & Required<GridItemsOptions> & { id: string }
type SizeKind = 'pc' | 'ipad' | 'mobile' // 设备维度：完全由容器宽度自动判定
type ModeKind = 'speaker' | 'grid' // 展示模式：主讲 / 平铺

const SIZE_LABEL: Record<SizeKind, string> = { pc: 'PC', ipad: 'iPad', mobile: 'Mobile' }

/** 按容器宽度判定设备维度：<768 移动，<1180 平板，其余 PC（与网格响应式同一套断点） */
const pickSize = (width: number): SizeKind => {
  if (width < 768) return 'mobile'
  if (width < 1180) return 'ipad'
  return 'pc'
}

/** 解析应生效的布局工厂 */
const resolveLayout = (mode: ModeKind, width: number): LayoutFactory => layouts[pickSize(width)][mode]

export default function App() {
  const [modeKind, setModeKindState] = useState<ModeKind>('grid') // 展示模式：默认平铺，主讲由用户手动开
  const modeKindRef = useRef<ModeKind>('grid')
  modeKindRef.current = modeKind
  const [currentSize, setCurrentSize] = useState<SizeKind | null>(null) // 实际测到的设备维度，未测到前不显示假值
  const currentLayoutRef = useRef<LayoutFactory | null>(null) // 当前生效的布局工厂，未确定前为 null
  const lastWidthRef = useRef(0) // 最近一次测量到的容器宽度
  const pendingIdsRef = useRef<string[] | null>(null) // 尺寸回调未到时挂起的首帧 ids

  /** 当前生效的设备维度（展示模式由按钮高亮体现，这里不重复显示） */
  const layoutLabel = currentSize ? SIZE_LABEL[currentSize] : '—'

  /** 按当前 ref 状态解析布局工厂 */
  const resolveCurrentLayout = () => resolveLayout(modeKindRef.current, lastWidthRef.current)

  /** 记录当前生效的布局状态，供底部工具栏展示 */
  const trackLayout = (factory: LayoutFactory) => {
    // 宽度未测到时不更新维度，避免按 0 判成 mobile
    if (lastWidthRef.current > 0) setCurrentSize(pickSize(lastWidthRef.current))
    currentLayoutRef.current = factory
  }

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

  const idsRef = useRef<string[]>([]) // 业务侧 id 顺序

  /** 从前 10 项中筛选可移除候选；主讲模式下槽位 0 就是主讲，不能移除。 */
  const getRemovableCandidates = () => {
    const pool = idsRef.current.slice(0, Math.min(10, idsRef.current.length))
    if (modeKindRef.current === 'speaker') return pool.filter((id) => id !== idsRef.current[0])
    return pool
  }

  const canRemoveItem = userCount > 1

  /** 交换 ids 中两个下标的 id（应用层换位） */
  const swapIdsAt = (a: number, b: number) => {
    const ids = idsRef.current
    if (a === b || a < 0 || b < 0 || a >= ids.length || b >= ids.length) return
    const tmp = ids[a]
    ids[a] = ids[b]
    ids[b] = tmp
  }

  /** 换布局：只换几何，不触碰 item 顺序 / sticky / fixed */
  const applyLayout = () => {
    const factory = resolveCurrentLayout()
    trackLayout(factory)
    gridRef.current?.setLayout(factory)
  }

  /**
   * 切换展示模式。
   * 主讲 = 槽位 0 那个 item 变成唯一 Sticky；取消主讲 = 清掉槽位 0 的 Sticky。
   * 只动槽位 0 的状态、不重建列表，所以用户拖拽出来的顺序天然保留。
   */
  const setModeKind = (kind: ModeKind) => {
    if (modeKindRef.current === kind) return
    setModeKindState(kind)
    modeKindRef.current = kind
    gridRef.current?.setItems([{ index: 0, sticky: kind === 'speaker' }])
    applyLayout()
  }

  /** 切换 Fixed：只改 fixed 状态。不传 index，组件会保持该 id 当前槽位，
   *  不会拿业务层 ids 的旧下标去重排（拖拽只改组件内部顺序，业务层 ids 不跟）。 */
  const setFixed = (item: GridSlotItem) => {
    gridRef.current?.setItems([{ id: item.id, fixed: !item.fixed }])
  }

  /** 增减 item：+1 插入新 id，-1 随机移除一个 */
  const changeUserCount = (delta: number) => {
    const ids = idsRef.current
    if (delta === 1) {
      if (userCount < 1) return
      const id = `${Math.max(...ids.map(Number), 0) + 1}` // 递增数字 id
      const index = modeKindRef.current === 'speaker' ? 1 : 0 // 主讲模式下插到大格后面，不抢主讲位
      ensureTileColor(id)
      gridRef.current?.setItems([{ id, index }])
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
    setUserCount((c) => c - 1)
  }

  /** 切换 Sticky：主讲模式下唯一 Sticky 且必定在槽位 0；平铺模式自由切换。 */
  const setSticky = (target: GridSlotItem) => {
    if (idsRef.current.indexOf(target.id) < 0) return

    if (modeKindRef.current !== 'speaker') {
      // 平铺模式自由切换；不传 index，组件保持当前槽位，不打乱拖拽出来的顺序
      gridRef.current?.setItems([
        { id: target.id, sticky: !target.sticky }
      ])
      return
    }

    // 主讲模式：先清掉当前主讲（槽位 0），再把被点的那个换到槽位 0 并设为 Sticky
    gridRef.current?.setItems([{ index: 0, sticky: false }])
    if (target.sticky) return
    swapIdsAt(0, idsRef.current.indexOf(target.id))
    gridRef.current?.setItems([{ id: target.id, index: 0, sticky: true }])
  }

  /** 分块生成默认 ids，避免大量数据同步阻塞主线程。每块生成后 yield 给浏览器。 */
  const getDefaultIds = async () => {
    const next: string[] = []
    const CHUNK = 10000 // 每批 1 万条

    for (let start = DEFAULT_USER_COUNT; start >= 1; start -= CHUNK) {
      const end = Math.max(1, start - CHUNK + 1)
      for (let i = start; i >= end; i--) {
        const id = `${i}`
        ensureTileColor(id) // 已有颜色的 id 原样复用，不重新生成
        next.push(id)
      }
      // 让出主线程，避免长时间阻塞
      await new Promise<void>((r) => setTimeout(r, 0))
    }

    return next
  }

  /** 重置为初始默认 ids，清除 Sticky / Fixed，回到自动布局；重建并播放入场动画。 */
  const resetGrid = async () => {
    if (!gridRef.current) return
    const newIds = await getDefaultIds()
    idsRef.current = newIds
    setModeKindState('grid')
    modeKindRef.current = 'grid'
    setUserCount(DEFAULT_USER_COUNT)
    // 模式已切回平铺，必须走 resolveCurrentLayout，写死 speaker 会和按钮高亮不一致
    const factory = resolveCurrentLayout()
    trackLayout(factory)
    // 传入 ids 即完全重建（清空顺序 / sticky / fixed）；animate 为 true 播放入场动画
    gridRef.current.setLayout(factory, { ids: [...newIds], animate: true })
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

  /** 首次：注册尺寸回调 + 建列表 + 设布局 + 整屏静默 */
  useEffect(() => {
    let cancelled = false

    // 尺寸变化 → 决策是否换布局；只有策略真的变了才 setLayout
    gridRef.current?.onResize(({ width }: ResizePayload) => {
      lastWidthRef.current = width
      const next = resolveCurrentLayout()
      const changed = next !== currentLayoutRef.current
      trackLayout(next) // 换不换布局，展示用的维度都要跟上宽度
      const pending = pendingIdsRef.current
      if (pending) {
        // 首个尺寸回调：此刻宽度才是真的，用它建列表，避免断点按 0 判成 mobile
        pendingIdsRef.current = null
        gridRef.current?.setLayout(next, { ids: [...pending], animate: false })
        return
      }
      if (changed) gridRef.current?.setLayout(next)
    })

    // 兜底：尺寸回调始终不来时不能让首帧一直空着
    const fallbackTimer = window.setTimeout(() => {
      const pending = pendingIdsRef.current
      if (!pending || cancelled) return
      pendingIdsRef.current = null
      console.warn('[demo] 未收到网格尺寸回调，回退用窗口宽度判定断点')
      lastWidthRef.current = window.innerWidth
      const factory = resolveCurrentLayout()
      trackLayout(factory)
      gridRef.current?.setLayout(factory, { ids: [...pending], animate: false })
    }, 800)

    ;(async () => {
      const newIds = await getDefaultIds()
      if (cancelled) return
      idsRef.current = newIds
      setUserCount(DEFAULT_USER_COUNT)
      // 尺寸回调还没来 → 挂起，等它带着实测宽度来建列表，否则断点会被判错
      if (lastWidthRef.current <= 0) {
        pendingIdsRef.current = newIds
        return
      }
      const factory = resolveCurrentLayout()
      trackLayout(factory)
      // ids 与 animate 原子绑定：首帧建列表并保持静默，之后新增 item 自动带入场动画
      gridRef.current?.setLayout(factory, { ids: [...newIds], animate: false })
    })()
    return () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="demo" style={demoStyle}>
      <div className="grid-wrap">
        <PrAdaptiveGrid ref={gridRef}>
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
              <p className="help-desc">滚动时固定在网格可视区域。平铺模式可随意 Sticky 多个；主讲模式只能 Sticky 一个，点击时自动排到首位。</p>
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
        <div className="bar-mode" role="group" aria-label="展示模式">
          <button type="button" className={`bar-mode-btn${modeKind === 'grid' ? ' active' : ''}`} onClick={() => setModeKind('grid')}>
            平铺
          </button>
          <button type="button" className={`bar-mode-btn${modeKind === 'speaker' ? ' active' : ''}`} onClick={() => setModeKind('speaker')}>
            主讲
          </button>
        </div>
        <span className="bar-sep" />
        {/* 当前实际生效的设备维度：由容器宽度自动判定，这里只做展示 */}
        <span className="bar-layout" aria-live="polite">
          {layoutLabel}
        </span>
        <span className="bar-sep" />
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
