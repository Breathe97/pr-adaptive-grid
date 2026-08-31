import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Geo, PrAdaptiveGridItemDragEvent, PrAdaptiveGridItemDragStartEvent } from './types'

// 动画时长与缓动，与 Vue 版保持一致
const AG_DURATION_ENTER = 500
const AG_EASING_ENTER = 'ease-out'
const AG_DURATION_POSITION = 800
const AG_EASING_POSITION = 'cubic-bezier(0.22, 1, 0.44, 1)'
const AG_DURATION_SIZE = 800
const AG_EASING_SIZE = 'cubic-bezier(0.22, 1, 0.44, 1)'

/** 基础层级，叠加计算：普通1 + 位移10 + 拖拽10 + 回弹5 */
const Z_INDEX_BASE = 1

const DRAG_THRESHOLD = 5 // px，指针移动超过此值才进入拖拽

/** 暴露给渲染插槽的 item 信息 */
export type GridSlotInfo = Geo & { id: string; sticky: boolean; fixed: boolean }

export interface PrAdaptiveGridItemProps {
  id: string
  geo: Geo
  dragGeo?: Geo
  stickyGeo?: Geo
  draggable?: boolean
  sticky?: boolean
  fixed?: boolean
  dragging?: boolean
  leaving?: boolean
  noEnterAnimation?: boolean
  onDragStart?: PrAdaptiveGridItemDragStartEvent
  onDragMove?: PrAdaptiveGridItemDragEvent
  onDragEnd?: PrAdaptiveGridItemDragEvent
  onLeaveEnd?: (id: string) => void
  settlingCount?: number
  onSettlingChange?: (id: string, isSettling: boolean) => void
  /** 渲染函数，接收 item 信息（对应 Vue 的默认插槽） */
  children?: (item: GridSlotInfo) => ReactNode
}

type TransformOptions = {
  /** 拖拽松手后的回弹动画，需要高于其它补位 item 的 21。 */
  settlingAfterDrag?: boolean
}

export function PrAdaptiveGridItem(props: PrAdaptiveGridItemProps) {
  const {
    id,
    geo,
    dragGeo,
    stickyGeo,
    draggable = false,
    sticky = false,
    fixed = false,
    dragging = false,
    leaving = false,
    noEnterAnimation = false,
    onDragStart,
    onDragMove,
    onDragEnd,
    onLeaveEnd,
    settlingCount = 0,
    onSettlingChange,
    children
  } = props

  const positionRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef<HTMLDivElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const activePointerIdRef = useRef<number>() // 已进入拖拽状态的 pointer id
  const pendingPointerIdRef = useRef<number>() // pointerdown 后等待判断的 pointer id
  const pendingStartPosRef = useRef({ x: 0, y: 0 })

  const [isPositionAnimating, setIsPositionAnimating] = useState(false)
  const [isSettlingAfterDrag, setIsSettlingAfterDrag] = useState(false)
  const isSettlingRef = useRef(false) // 同步镜像，供同步逻辑读取
  const animVersionRef = useRef(0) // 递增 token，防止过期 .finally 覆盖状态

  const prevDraggingRef = useRef(false)
  const prevLeavingRef = useRef(false)
  const prevSettlingRef = useRef(false)
  const firstGeoRef = useRef(true)
  const lastGeoRef = useRef<Geo | null>(null) // 上一次渲染的占位 geo
  const pendingStartRef = useRef<Geo | null>(null) // DOM 提交前抓到的当前视觉位置（动画起点）

  /** 当前实际用于渲染的几何；拖拽优先，其次 sticky 视觉吸附，最后使用原始占位。 */
  const effectiveGeo = dragGeo ?? stickyGeo ?? geo

  // Vue 版 watch(flush: 'pre') 在 DOM 更新前读旧位置当动画起点；
  // React effect 在 DOM 提交后跑，内联 transform 已变成新 geo，再读 rect 起点==终点会跳帧。
  // 这里在 render 阶段（DOM 尚未提交）就把当前视觉位置抓下来，供 toTransform 当起点。
  // 两类时机都要抓：
  // 1. geo 变化的普通补位渲染；
  // 2. 松手渲染（上一帧拖拽中、这一帧已松开）——此时 geo 在拖拽期间早已更新、本次不再变化，
  //    但 DOM 仍是 fixed 屏幕坐标的拖拽位置，必须在提交前换算成内容坐标当回弹起点。
  const prevGeo = lastGeoRef.current
  const isReleaseRender = prevDraggingRef.current && !dragging
  const geoChanged =
    !!prevGeo &&
    (geo.left !== prevGeo.left || geo.top !== prevGeo.top || geo.width !== prevGeo.width || geo.height !== prevGeo.height)
  if ((!dragging && geoChanged) || isReleaseRender) {
    pendingStartRef.current = readCurrentVisualGeo()
  }
  lastGeoRef.current = geo

  /** 暴露给渲染插槽的 item 信息。 */
  const info: GridSlotInfo = { id, ...effectiveGeo, sticky, fixed }

  /** 根据退场、拖拽和 pointer 捕获状态生成根节点 class。 */
  const itemClass = [
    'pr-adaptive-grid-item-position',
    leaving && 'pr-adaptive-grid-item-leaving',
    sticky && 'pr-adaptive-grid-item-sticky',
    fixed && 'pr-adaptive-grid-item-fixed',
    dragging && 'pr-adaptive-grid-item-dragging',
    isSettlingAfterDrag && 'pr-adaptive-grid-item-settling',
    activePointerIdRef.current !== undefined && 'pr-adaptive-grid-item-active-pointer'
  ]
    .filter(Boolean)
    .join(' ')

  /** position 层只负责中心点定位和层级。叠加计算：sticky+1，拖拽=拖拽10+位移10+n，回弹=回弹5+位移10+n，被挤压=位移10，普通=1 */
  const itemStyle: CSSProperties = (() => {
    const { cx, cy } = effectiveGeo
    const n = settlingCount
    let z = Z_INDEX_BASE
    if (sticky) z += 1 // Sticky 额外 +1
    if (dragging) {
      z += 20 + n // 拖拽10 + 位移10 + n
    } else if (isSettlingAfterDrag) {
      z += 15 + n // 回弹5 + 位移10 + n
    } else if (isPositionAnimating) {
      z += 10 // 仅位移（被挤压）
    }
    // 拖拽项使用 fixed 定位：坐标是父层换算的屏幕坐标，相对视口、不受滚动容器 overflow 裁剪，
    // 拖出网格边界也能完整显示；其余 item 用内容坐标 + absolute，随容器滚动。
    const isFloating = !!dragGeo
    return {
      position: isFloating ? 'fixed' : 'absolute',
      zIndex: z,
      transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
    } as CSSProperties
  })()

  /** size 层只负责宽高，避免尺寸动画和位移动画互相影响。 */
  const itemInnerStyle: CSSProperties = {
    width: `${effectiveGeo.width}px`,
    height: `${effectiveGeo.height}px`
  }

  /** 将 WAAPI 动画的当前状态提交到内联样式后停止动画。 */
  const saveStyles = (animate: Animation) => {
    if (animate.playState === 'idle') return
    animate.commitStyles()
    animate.cancel()
  }

  /** 拖拽开始前停止 position 层动画，避免布局动画和指针跟随竞争。 */
  const stopPositionAnimations = () => {
    const outer = positionRef.current
    if (!outer) return
    outer.getAnimations().forEach((animate) => saveStyles(animate))
  }

  /** 释放当前 pointer capture。 */
  const releasePointerCapture = (event: PointerEvent) => {
    const visual = visualRef.current
    if (!visual?.hasPointerCapture(event.pointerId)) return
    visual.releasePointerCapture(event.pointerId)
  }

  /** 清理 pending 状态（pointerdown 已记录但尚未进入拖拽）。 */
  const cancelPending = (event: PointerEvent) => {
    if (pendingPointerIdRef.current !== event.pointerId) return
    pendingPointerIdRef.current = undefined
  }

  /** 从 pending 进入正式拖拽：捕获指针并通知父组件（附带按下点坐标，供父级消除阈值滞后）。 */
  const commitDrag = (event: PointerEvent) => {
    cancelPending(event)
    activePointerIdRef.current = event.pointerId
    visualRef.current?.setPointerCapture(event.pointerId)
    onDragStart?.(id, event, { ...pendingStartPosRef.current })
  }

  /** 结束 pointer 捕获并通知父组件释放拖拽；重复调用会被 activePointerId 拦住。 */
  const finishPointerInteraction = (event: PointerEvent) => {
    if (activePointerIdRef.current !== event.pointerId) return
    activePointerIdRef.current = undefined
    releasePointerCapture(event)
    onDragEnd?.(id, event)
  }

  /** pointerdown：记录起始位置，不立即捕获，等足够移动才进入拖拽。 */
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || leaving) return
    pendingPointerIdRef.current = event.pointerId
    pendingStartPosRef.current = { x: event.clientX, y: event.clientY }
  }

  /** pointermove：拖拽中→通知父组件；pending 且超阈值→进入拖拽；纯点击不拦截。 */
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const native = event.nativeEvent
    // 已进入拖拽状态
    if (activePointerIdRef.current === event.pointerId) {
      const visual = visualRef.current
      if (visual && !visual.hasPointerCapture(event.pointerId) && event.buttons !== 0) {
        visual.setPointerCapture(event.pointerId)
      }
      if (event.buttons === 0) {
        finishPointerInteraction(native)
        return
      }
      onDragMove?.(id, native)
      return
    }

    // pending 态：检查移动距离是否达到拖拽阈值
    if (pendingPointerIdRef.current !== event.pointerId) return
    const dx = event.clientX - pendingStartPosRef.current.x
    const dy = event.clientY - pendingStartPosRef.current.y
    if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
      commitDrag(native)
    }
  }

  /** pointerup：拖拽中则结束拖拽；pending 中则仅取消 pending，click 正常触发。 */
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === event.pointerId) {
      finishPointerInteraction(event.nativeEvent)
      return
    }
    cancelPending(event.nativeEvent)
  }

  /** pointercancel：同 pointerup。 */
  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === event.pointerId) {
      finishPointerInteraction(event.nativeEvent)
      return
    }
    cancelPending(event.nativeEvent)
  }

  /** 意外丢失 capture 时尝试恢复；仅在按键已松开时才结束拖拽。 */
  const onLostPointerCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    if (event.buttons !== 0) {
      visualRef.current?.setPointerCapture(event.pointerId)
      return
    }
    finishPointerInteraction(event.nativeEvent)
  }

  /** 读取当前视觉几何（内容坐标），用作 WAAPI 动画起点。
   *  用 function 声明利用提升：render 阶段的捕获代码在其声明之前就会调用它。 */
  function readCurrentVisualGeo(): Geo | null {
    const outer = positionRef.current
    const inner = sizeRef.current
    if (!outer || !inner) return null
    const rect = inner.getBoundingClientRect()
    // outer 是 absolute item，offsetParent 通常就是滚动容器；
    // 拖拽项是 fixed 定位，offsetParent 为 null，回退到父元素拿到同一个 grid 容器。
    const parent = (outer.offsetParent ?? outer.parentElement) as HTMLElement | null
    if (!parent) return null
    const parentRect = parent.getBoundingClientRect()
    const left = rect.left - parentRect.left + parent.scrollLeft
    const top = rect.top - parentRect.top + parent.scrollTop
    return {
      top,
      left,
      cx: left + rect.width / 2,
      cy: top + rect.height / 2,
      width: rect.width,
      height: rect.height
    }
  }

  /** 从当前视觉位置过渡到新的 geo，同时处理 position 和 size 两层动画。 */
  const toTransform = (newGeo: Geo, options?: TransformOptions) => {
    const outer = positionRef.current
    const inner = sizeRef.current
    if (!outer || !inner) return

    const settlingAfterDrag = options?.settlingAfterDrag === true
    setIsPositionAnimating(true)
    isSettlingRef.current = settlingAfterDrag
    setIsSettlingAfterDrag(settlingAfterDrag)

    /** 读取当前视觉几何，用作下一段 WAAPI 动画的起点（内容坐标）。 */
    const getCurrentCenterGeo = () => {
      const rect = inner.getBoundingClientRect()
      // outer 是 absolute item，offsetParent 通常就是滚动容器；
      // 拖拽项是 fixed 定位，offsetParent 为 null，回退到父元素拿到同一个 grid 容器，
      // 从而把当前屏幕坐标换算回内容坐标，避免回弹动画起点被当成终点、瞬间闪到槽位。
      const parent = (outer.offsetParent ?? outer.parentElement) as HTMLElement | null
      if (!parent) return { ...newGeo }
      const parentRect = parent.getBoundingClientRect()
      const left = rect.left - parentRect.left + parent.scrollLeft
      const top = rect.top - parentRect.top + parent.scrollTop
      const width = rect.width
      const height = rect.height
      const cx = left + width / 2
      const cy = top + height / 2
      return { top, left, cx, cy, width, height }
    }

    const currentGeo = pendingStartRef.current ?? getCurrentCenterGeo() // 当前几何（内容坐标）
    pendingStartRef.current = null // 起点只消费一次，避免残留到下一段动画

    // 松手回弹时，元素可能仍停留在 fixed（屏幕坐标）状态，而动画 keyframe 值是内容坐标。
    // 若两者基准不一致，瞬间从 fixed 切到 absolute 会导致起点错位、看起来"闪到最终位置"。
    // 这里在启动动画前，先把 outer 预定位到内容坐标起点（absolute），保证动画起点精确。
    const position = getComputedStyle(outer).position
    if (position === 'fixed') {
      outer.style.position = 'absolute'
      outer.style.transform = `translate3d(${currentGeo.cx}px, ${currentGeo.cy}px, 0) translate(-50%, -50%)`
    }

    // 开始新动画前先提交旧动画状态，保证连续重排时不会跳帧。
    outer.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画
    inner.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画

    // 两个动画都完成后才清除动画状态，避免一方提前结束导致 z-index 降级被其它 item 盖住
    const version = ++animVersionRef.current
    const outerAnim = outer.animate(
      [
        // 开始
        { transform: `translate3d(${currentGeo.cx}px, ${currentGeo.cy}px, 0) translate(-50%, -50%)` },
        // 结束
        { transform: `translate3d(${newGeo.cx}px, ${newGeo.cy}px, 0) translate(-50%, -50%)` }
      ],
      { duration: AG_DURATION_POSITION, easing: AG_EASING_POSITION }
    )
    const innerAnim = inner.animate(
      [
        // 开始
        { width: `${currentGeo.width}px`, height: `${currentGeo.height}px` },
        // 结束
        { width: `${newGeo.width}px`, height: `${newGeo.height}px` }
      ],
      { duration: AG_DURATION_SIZE, easing: AG_EASING_SIZE }
    )

    // 动画无 fill，结束后会回退到内联样式；而 saveStyles/commitStyles 可能把被中断动画的
    // 中途插值写进内联（如渲染 B 只变了 left/top，治愈 effect 因宽高未变不会重跑）。
    // 因此启动动画的瞬间就把内联样式直接写成目标 geo：播放期间由 animation 覆盖显示，
    // 结束后回退到的就是正确值，杜绝"动画结束跳变为错误宽高/位置"。
    outer.style.transform = `translate3d(${newGeo.cx}px, ${newGeo.cy}px, 0) translate(-50%, -50%)`
    inner.style.width = `${newGeo.width}px`
    inner.style.height = `${newGeo.height}px`

    Promise.all([outerAnim.finished, innerAnim.finished])
      .then(([outerResult]) => saveStyles(outerResult))
      .catch(() => {})
      .finally(() => {
        if (version !== animVersionRef.current) return // 过期调用，忽略
        setIsPositionAnimating(false)
        isSettlingRef.current = false
        setIsSettlingAfterDrag(false)
      })
  }

  // geo 变化时播放布局补位动画；拖拽项由 dragGeo 直接跟随指针，不参与普通补位。
  // 首次挂载跳过（对应 Vue watch 非 immediate），由挂载 effect 播放入场动画。
  useEffect(() => {
    if (firstGeoRef.current) {
      firstGeoRef.current = false
      return
    }
    if (dragging) {
      pendingStartRef.current = null // 拖拽项不播补位动画，丢弃过期起点
      return
    }
    toTransform(effectiveGeo, isSettlingRef.current ? { settlingAfterDrag: true } : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.left, geo.top, geo.width, geo.height])

  // 治愈 effect：commitStyles() 会把动画中途的插值宽高写成内联样式，
  // 而 React 对前后未变化的 style prop 不会重写 DOM，导致中途值永久残留、宽高算错。
  // 每次提交后强制把内联尺寸对齐到 effectiveGeo；动画播放期间 animation 覆盖内联值，互不冲突。
  // 注意必须用 effectiveGeo 且拖拽中（dragGeo 存在）跳过：拖拽期间 geo prop 会随重排变成
  // 新槽位的占位尺寸，若按 geo 治愈会把 dragGeo 驱动的正确尺寸覆盖掉，导致拖拽中大小突变。
  useEffect(() => {
    const inner = sizeRef.current
    if (!inner || dragGeo) return
    inner.style.width = `${effectiveGeo.width}px`
    inner.style.height = `${effectiveGeo.height}px`
  }, [effectiveGeo.width, effectiveGeo.height, dragGeo])

  // 同理治愈 position 层的 transform：防止被中断动画的中间位移残留。
  // 拖拽中由 dragGeo 驱动（fixed 屏幕坐标），不能覆盖，跳过。
  useEffect(() => {
    const outer = positionRef.current
    if (!outer || dragGeo) return
    outer.style.transform = `translate3d(${effectiveGeo.cx}px, ${effectiveGeo.cy}px, 0) translate(-50%, -50%)`
  }, [effectiveGeo.cx, effectiveGeo.cy, dragGeo])

  // 拖拽态切换：进入时停止旧动画，退出时从当前视觉位置过渡到最终 geo。
  useEffect(() => {
    const prev = prevDraggingRef.current
    prevDraggingRef.current = dragging
    if (dragging) {
      stopPositionAnimations()
      return
    }
    if (prev) {
      toTransform(effectiveGeo, { settlingAfterDrag: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  // 回弹状态变化时通知父组件更新 settlingCount
  useEffect(() => {
    const prev = prevSettlingRef.current
    prevSettlingRef.current = isSettlingAfterDrag
    if (prev !== isSettlingAfterDrag) onSettlingChange?.(id, isSettlingAfterDrag)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettlingAfterDrag])

  /** 播放退场动画，并在完成或中断时通知父组件真正移除 item。 */
  const leavTransform = () => {
    const visual = visualRef.current
    if (!visual) {
      onLeaveEnd?.(id)
      return
    }

    const outer = positionRef.current
    const inner = sizeRef.current
    if (!outer || !inner) return

    /** 获取 visual 当前透明度和缩放，保证退场动画可以从当前状态衔接。 */
    const getCurrentVisualState = () => {
      const style = getComputedStyle(visual)
      return {
        opacity: style.opacity,
        transform: style.transform === 'none' ? 'scale(1)' : style.transform
      }
    }

    const current = getCurrentVisualState() // 当前进出场信息

    visual.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画

    const animation = visual.animate(
      [
        { opacity: current.opacity, transform: current.transform },
        { opacity: 0, transform: 'scale(0.3)' }
      ],
      {
        duration: AG_DURATION_ENTER,
        easing: AG_EASING_ENTER,
        fill: 'forwards'
      }
    )
    animation.finished
      .then(() => {
        onLeaveEnd?.(id)
      })
      .catch(() => {
        onLeaveEnd?.(id)
      })
  }

  /** 播放入场/恢复动画，让 visual 从当前状态回到完整显示。 */
  const addTransform = () => {
    const visual = visualRef.current
    if (!visual) return

    /** 获取 visual 当前透明度和缩放，避免打断退场后恢复时产生跳变。 */
    const getCurrentVisualState = () => {
      const style = getComputedStyle(visual)
      return {
        opacity: style.opacity,
        transform: style.transform === 'none' ? 'scale(1)' : style.transform
      }
    }

    const current = getCurrentVisualState() // 当前进出场信息

    visual.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画

    const animation = visual.animate(
      [
        // 开始
        { opacity: current.opacity, transform: current.transform },
        // 结束
        { opacity: 1, transform: 'scale(1)' }
      ],
      {
        duration: AG_DURATION_ENTER,
        easing: AG_EASING_ENTER,
        delay: 100,
        fill: 'forwards'
      }
    )

    animation.finished
      .then((animate) => saveStyles(animate))
      .catch(() => {
        // 兜底：动画失败时直接设置最终样式
        visual.style.opacity = '1'
        visual.style.transform = 'scale(1)'
      })
  }

  // leaving 变化时切换进出场动画。
  useEffect(() => {
    const prev = prevLeavingRef.current
    prevLeavingRef.current = leaving
    if (leaving === true && prev !== true) {
      leavTransform()
      return
    }
    if (leaving === false && prev === true) {
      // 取消退场，恢复/入场
      addTransform()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  // 首次挂载时播放入场动画；noEnterAnimation 为 true 时直接显示，跳过动画。
  useEffect(() => {
    if (noEnterAnimation) {
      const visual = visualRef.current
      if (visual) {
        visual.style.opacity = '1'
        visual.style.transform = 'scale(1)'
      }
      return
    }
    addTransform()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={positionRef} className={itemClass} style={itemStyle}>
      <div ref={sizeRef} className="pr-adaptive-grid-item-size" style={itemInnerStyle}>
        <div
          ref={visualRef}
          className="pr-adaptive-grid-item-visual"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onLostPointerCapture}
        >
          {children?.(info)}
        </div>
      </div>
    </div>
  )
}
