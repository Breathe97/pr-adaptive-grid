<template>
  <div
    ref="containerRef"
    class="pr-adaptive-grid"
    :class="{ 'pr-adaptive-grid-sortable': sortable }"
    :style="containerStyle"
    @scroll="onScroll"
    @click.capture="onGridClickCapture"
  >
    <div ref="contentRef" class="pr-adaptive-grid-content" :style="contentStyle">
      <div
        v-for="item in renderList"
        :key="item.id"
        class="pr-adaptive-grid-item"
        :data-item-id="item.id"
        :class="itemClasses(item)"
        :style="styleItemOuter(item.id)"
      >
        <div
          class="pr-adaptive-grid-item-inner"
          :style="styleItemInner(item.id)"
          @pointerdown="(e) => onItemPointerDown(e, item)"
        >
          <slot :item="item" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  ref,
  computed,
  reactive,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  withDefaults,
  defineProps,
  type CSSProperties
} from 'vue'
import type {
  GridItem,
  GridLayoutRect,
  GridReorderPayload,
  GridSetItemEntry,
  GridSetItemOptions,
  GridSizeSpec
} from '../../types'
import { applyLayoutInsetGap, resolveGridInsets } from './resolveGridSize'
import {
  computeFlowLayout,
  computeStickyRect,
  resolveFlowArea,
  unionStickyRects,
  type ItemLayoutMeta
} from './computeFlowLayout'
import { mergeIdsPreservingFixed } from './mergeIdsPreservingFixed'
import { clientToContentPoint } from './scrollParent'

type AgOuterStyle = CSSProperties & {
  '--ag-duration-position'?: string
  '--ag-duration-size'?: string
  '--ag-duration-lifecycle'?: string
}

const props = withDefaults(
  defineProps<{
    gap?: number
    itemWidth: number
    itemHeight: number
    cols: number
    rows: number
    left?: GridSizeSpec
    top?: GridSizeSpec
    right?: GridSizeSpec
    bottom?: GridSizeSpec
    sortable?: boolean
    virtualScroll?: boolean
    virtualOffsetPages?: number
  }>(),
  {
    gap: 8,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    sortable: true,
    virtualScroll: true,
    virtualOffsetPages: 2
  }
)

const emit = defineEmits<{
  reorder: [payload: GridReorderPayload]
  'visible-change': [ids: string[]]
}>()

const containerRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()

const itemIds = ref<string[]>([])
const itemMetaMap = reactive(new Map<string, ItemLayoutMeta>())
const layoutMap = reactive(new Map<string, GridLayoutRect>())
const viewList = ref<GridItem[]>([])
const visibleList = ref<GridItem[]>([])
const contentHeight = ref(0)

const containerW = ref(0)
const containerH = ref(0)
/** 滚动容器 scrollLeft/scrollTop，用于 sticky(Pin) 视口内固定 */
const scrollOffset = ref({ x: 0, y: 0 })

const layoutTransitionActive = ref(false)
const suppressTransition = ref(true)
const layoutInitialized = ref(false)
/** 布局过渡：旧快照 → 新快照，逐项动画 */
const layoutSnapshotFrom = new Map<string, GridLayoutRect>()
/** Pin 等需视口 FLIP（避免滚动后 left/top 过渡与 scroll 补偿冲突） */
const layoutAnimFlipMap = new Map<string, { dx: number; dy: number; sx: number; sy: number }>()
const layoutAnimPlayIds = ref(new Set<string>())

const ANIM_MIN_MS = 300
const ANIM_MAX_MS = 800
const SIZE_TRANSITION_MS = 500
/** 新增占位 / 移除淡出 / 进入动画 的基础时长 */
const ITEM_LIFECYCLE_MS = 300
const LAYOUT_SPEED = 0.7
const DRAG_THRESHOLD = 6

/** 内部过渡时长系数，默认 1；所有动画时长乘以它 */
const transitionTimeScale = ref(1)
const scaleMs = (ms: number) => Math.max(0, Math.round(ms * transitionTimeScale.value))

const enterHiddenIds = ref(new Set<string>())
const enterPlayIds = ref(new Set<string>())
/** 淡出完成前仍参与布局的 id */
const exitingIds = ref(new Set<string>())
/** 正在播放淡出动画的 id */
const exitPlayIds = ref(new Set<string>())
let pendingIdsAfterExit: string[] | null = null

let enterDelayTimer = 0
let enterCompleteTimer = 0
let exitCompleteTimer = 0

const replaceIdSet = (target: typeof enterHiddenIds, next: Set<string>) => {
  target.value = next
}

const addToIdSet = (target: typeof enterHiddenIds, ids: string[]) => {
  const next = new Set(target.value)
  for (const id of ids) next.add(id)
  target.value = next
}

const isEnterHidden = (id: string) => enterHiddenIds.value.has(id)
const isEnterPlay = (id: string) => enterPlayIds.value.has(id)
const isExiting = (id: string) => exitingIds.value.has(id)
const isExitPlay = (id: string) => exitPlayIds.value.has(id)

const markEnterHidden = (ids: string[]) => {
  if (!ids.length || !layoutInitialized.value) return
  addToIdSet(enterHiddenIds, ids)
}

/** 重排并绘制透明占位后，再等待一个周期并播放进入动画 */
const armEnterLifecycleTimer = () => {
  if (!enterHiddenIds.value.size || !layoutInitialized.value) return
  window.clearTimeout(enterDelayTimer)
  window.clearTimeout(enterCompleteTimer)

  enterDelayTimer = window.setTimeout(() => {
    const playing = new Set(enterHiddenIds.value)
    if (!playing.size) return

    requestAnimationFrame(() => {
      replaceIdSet(enterHiddenIds, new Set())
      enterPlayIds.value = playing
      void nextTick(() => {
        const content = contentRef.value
        if (!content) return
        for (const id of playing) {
          const inner = content.querySelector<HTMLElement>(
            `[data-item-id="${id}"] .pr-adaptive-grid-item-inner`
          )
          if (inner) void inner.offsetHeight
        }
      })
    })

    enterCompleteTimer = window.setTimeout(() => {
      replaceIdSet(enterPlayIds, new Set())
    }, scaleMs(ITEM_LIFECYCLE_MS) + 50)
  }, scaleMs(ITEM_LIFECYCLE_MS))
}

const scheduleEnterAfterLayout = () => {
  if (!enterHiddenIds.value.size) return
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(armEnterLifecycleTimer)
    })
  })
}

const waitForLayoutAnimateReady = () =>
  new Promise<void>((resolve) => {
    if (!suppressTransition.value) {
      resolve()
      return
    }
    const step = () => {
      requestAnimationFrame(() => {
        if (!suppressTransition.value) resolve()
        else step()
      })
    }
    step()
  })

const finishExitLifecycle = () => {
  const toRemove = [...exitingIds.value]
  replaceIdSet(exitingIds, new Set())
  replaceIdSet(exitPlayIds, new Set())

  if (pendingIdsAfterExit) {
    itemIds.value = pendingIdsAfterExit
    pendingIdsAfterExit = null
  } else {
    itemIds.value = itemIds.value.filter((id) => !toRemove.includes(id))
  }

  for (const id of toRemove) itemMetaMap.delete(id)
  queueLayout(true)
}

const scheduleExitLifecycle = (ids: string[]) => {
  if (!ids.length) return
  addToIdSet(exitingIds, ids)
  window.clearTimeout(exitCompleteTimer)
  requestAnimationFrame(() => {
    exitPlayIds.value = new Set(exitingIds.value)
    void nextTick(() => {
      const content = contentRef.value
      if (!content) return
      for (const id of exitPlayIds.value) {
        const inner = content.querySelector<HTMLElement>(
          `[data-item-id="${id}"] .pr-adaptive-grid-item-inner`
        )
        if (inner) void inner.offsetHeight
      }
    })
  })
  exitCompleteTimer = window.setTimeout(finishExitLifecycle, scaleMs(ITEM_LIFECYCLE_MS))
}

const clearItemLifecycleState = () => {
  window.clearTimeout(enterDelayTimer)
  window.clearTimeout(enterCompleteTimer)
  window.clearTimeout(exitCompleteTimer)
  replaceIdSet(enterHiddenIds, new Set())
  replaceIdSet(enterPlayIds, new Set())
  replaceIdSet(exitingIds, new Set())
  replaceIdSet(exitPlayIds, new Set())
  pendingIdsAfterExit = null
}

const getFixedSet = () => new Set(itemIds.value.filter((id) => itemMetaMap.get(id)?.fixed))

const getFlowIds = () => itemIds.value.filter((id) => !itemMetaMap.get(id)?.sticky)

const getStickyIds = () => itemIds.value.filter((id) => itemMetaMap.get(id)?.sticky)

/** 应用层逻辑边距 → 解析为 px 并扣除 gap，得到真实流式布局边距 */
const getLayoutInsets = (cw: number, ch: number) =>
  applyLayoutInsetGap(
    resolveGridInsets(
      { left: props.left, top: props.top, right: props.right, bottom: props.bottom },
      cw,
      ch
    ),
    props.gap
  )

const getFlowAreaSnapshot = () => {
  const cw = containerW.value
  const ch = containerH.value
  const insets = getLayoutInsets(cw, ch)
  const stickyRects: Array<{ x: number; y: number; w: number; h: number }> = []

  for (const id of getStickyIds()) {
    const meta = itemMetaMap.get(id)!
    stickyRects.push(
      computeStickyRect({
        containerW: cw,
        containerH: ch,
        meta,
        defaultWidth: props.itemWidth,
        defaultHeight: props.itemHeight
      })
    )
  }

  return resolveFlowArea(cw, ch, insets, unionStickyRects(stickyRects), props.gap)
}

const rebuildLayout = () => {
  const cw = containerW.value
  const ch = containerH.value
  if (cw <= 0 || ch <= 0) return

  const flowArea = getFlowAreaSnapshot()
  const stickyRects: Array<{ x: number; y: number; w: number; h: number }> = []
  for (const id of getStickyIds()) {
    const meta = itemMetaMap.get(id)!
    stickyRects.push(
      computeStickyRect({
        containerW: cw,
        containerH: ch,
        meta,
        defaultWidth: props.itemWidth,
        defaultHeight: props.itemHeight
      })
    )
  }

  const nextRects = new Map<string, GridLayoutRect>()

  getStickyIds().forEach((id, i) => {
    const r = stickyRects[i]
    nextRects.set(id, { ...r })
  })

  const flowResult = computeFlowLayout({
    flowX: flowArea.x,
    flowY: flowArea.y,
    flowW: flowArea.w,
    flowH: flowArea.h,
    ids: getFlowIds(),
    meta: itemMetaMap,
    cols: Math.max(1, props.cols),
    firstScreenRows: Math.max(1, props.rows),
    gap: props.gap,
    defaultWidth: props.itemWidth,
    defaultHeight: props.itemHeight
  })

  flowResult.rects.forEach((rect, id) => {
    nextRects.set(id, rect)
  })

  const maxBottom = Math.max(
    flowResult.contentHeight,
    ...[...nextRects.values()].map((r) => r.y + r.h)
  )
  contentHeight.value = maxBottom + getLayoutInsets(cw, ch).bottom

  layoutMap.clear()
  nextRects.forEach((rect, id) => layoutMap.set(id, rect))

  viewList.value = itemIds.value
    .filter((id) => nextRects.has(id))
    .map((id) => {
      const rect = nextRects.get(id)!
      const meta = itemMetaMap.get(id)
      return {
        id,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        sticky: meta?.sticky,
        fixed: meta?.fixed
      }
    })

}

const renderList = computed(() => {
  if (!props.virtualScroll) return viewList.value
  return visibleList.value.length ? visibleList.value : viewList.value
})

const containerStyle = computed((): CSSProperties => ({
  width: '100%',
  height: '100%',
  position: 'relative'
}))

const contentStyle = computed((): CSSProperties => ({
  position: 'relative',
  width: '100%',
  minHeight: `${contentHeight.value}px`
}))

const isLayoutFromFrame = (id: string) =>
  layoutTransitionActive.value &&
  layoutSnapshotFrom.has(id) &&
  !layoutAnimPlayIds.value.has(id) &&
  dragState.value?.id !== id

const isLayoutPlayFrame = (id: string) =>
  layoutTransitionActive.value && layoutAnimPlayIds.value.has(id) && dragState.value?.id !== id

const usesLayoutFlip = (id: string) =>
  layoutTransitionActive.value && layoutAnimFlipMap.has(id) && layoutSnapshotFrom.has(id)

const itemClasses = (item: GridItem) => ({
  'pr-adaptive-grid-item-sticky': item.sticky,
  'pr-adaptive-grid-item-fixed': item.fixed,
  'pr-adaptive-grid-item-layout-from': isLayoutFromFrame(item.id),
  'pr-adaptive-grid-item-layout-play': isLayoutPlayFrame(item.id),
  'pr-adaptive-grid-item-layout-anim': isLayoutPlayFrame(item.id) && !usesLayoutFlip(item.id),
  'pr-adaptive-grid-item-layout-flip-from': isLayoutFromFrame(item.id) && usesLayoutFlip(item.id),
  'pr-adaptive-grid-item-layout-flip-play': isLayoutPlayFrame(item.id) && usesLayoutFlip(item.id),
  'pr-adaptive-grid-item-enter-hidden': isEnterHidden(item.id),
  'pr-adaptive-grid-item-enter-play': isEnterPlay(item.id),
  'pr-adaptive-grid-item-exit-play': isExitPlay(item.id),
  'pr-adaptive-grid-item-no-transition':
    suppressTransition.value &&
    !layoutTransitionActive.value &&
    !isEnterHidden(item.id) &&
    !isEnterPlay(item.id) &&
    !isExitPlay(item.id),
  'pr-adaptive-grid-item-dragging': dragState.value?.id === item.id,
  'pr-adaptive-grid-item-drop-target': dropTargetId.value === item.id
})

const measureContainer = () => {
  const el = containerRef.value
  if (!el) return
  containerW.value = el.clientWidth
  containerH.value = el.clientHeight
}

const getDurationForDistance = (distance: number, minMs: number, maxMs: number) => {
  const ms = distance / LAYOUT_SPEED
  return scaleMs(Math.min(maxMs, Math.max(minMs, ms)))
}

const copyLayoutSnapshot = (source: Map<string, GridLayoutRect>) => {
  const snap = new Map<string, GridLayoutRect>()
  source.forEach((rect, id) => snap.set(id, { ...rect }))
  return snap
}

/** 布局前按当前视口捕获快照（相对 content），滚动后仍与可见位置一致 */
const captureSnapshotFromDom = () => {
  const snap = new Map<string, GridLayoutRect>()
  const content = contentRef.value
  if (!content) return copyLayoutSnapshot(layoutMap)

  const contentRect = content.getBoundingClientRect()
  const captureIds = new Set([...layoutMap.keys(), ...itemIds.value])
  for (const id of captureIds) {
    const el = content.querySelector<HTMLElement>(`[data-item-id="${id}"]`)
    if (!el) {
      const fallback = layoutMap.get(id)
      if (fallback) snap.set(id, { ...fallback })
      continue
    }
    const er = el.getBoundingClientRect()
    snap.set(id, {
      x: er.left - contentRect.left,
      y: er.top - contentRect.top,
      w: er.width,
      h: er.height
    })
  }
  return snap
}

const layoutRectChanged = (from: GridLayoutRect, to: GridLayoutRect) =>
  Math.hypot(to.x - from.x, to.y - from.y) > 1 ||
  Math.hypot(to.w - from.w, to.h - from.h) > 1

/** 流式位 → Pin 槽位（仅此时做 FLIP）；已在槽位重排（仅尺寸变化）不做过渡 */
const isStickyPinSlotTransition = (from: GridLayoutRect, to: GridLayoutRect) =>
  Math.hypot(to.x - from.x, to.y - from.y) > 24

/** sticky 用布局坐标；流式项用 DOM 视口坐标（含滚动） */
const resolveTransitionFrom = (
  id: string,
  domSnapshot: Map<string, GridLayoutRect>,
  layoutBefore: Map<string, GridLayoutRect>
) => (itemMetaMap.get(id)?.sticky ? layoutBefore.get(id) : domSnapshot.get(id))

const shouldAnimateStickyLayout = (from: GridLayoutRect, to: GridLayoutRect) =>
  isStickyPinSlotTransition(from, to)

const durationOverrides = new Map<string, { position: number; size: number }>()

/** 对比旧快照与新快照，为每个变化的 item 登记过渡 */
const planLayoutTransition = (
  domSnapshot: Map<string, GridLayoutRect>,
  layoutBefore: Map<string, GridLayoutRect>,
  newSnapshot: Map<string, GridLayoutRect>
) => {
  layoutSnapshotFrom.clear()
  durationOverrides.clear()
  layoutAnimPlayIds.value = new Set()

  let maxDuration = scaleMs(ANIM_MIN_MS)
  let hasMovement = false
  const sizeDur = scaleMs(SIZE_TRANSITION_MS)

  for (const [id, to] of newSnapshot) {
    if (isEnterHidden(id) || isExiting(id)) continue
    const from = resolveTransitionFrom(id, domSnapshot, layoutBefore)
    if (!from || !layoutRectChanged(from, to)) continue
    if (itemMetaMap.get(id)?.sticky && !shouldAnimateStickyLayout(from, to)) continue

    layoutSnapshotFrom.set(id, { ...from })
    const posDist = Math.hypot(to.x - from.x, to.y - from.y)
    const posDur = getDurationForDistance(posDist, ANIM_MIN_MS, ANIM_MAX_MS)
    durationOverrides.set(id, { position: posDur, size: sizeDur })
    maxDuration = Math.max(maxDuration, posDur, sizeDur)
    hasMovement = true
  }

  return { maxDuration, hasMovement }
}

const clearLayoutTransitionState = () => {
  layoutSnapshotFrom.clear()
  layoutAnimFlipMap.clear()
  layoutAnimPlayIds.value = new Set()
  durationOverrides.clear()
}

/** 布局已在目标位(to)，用 transform 对齐切换前视口位置 */
const computeItemFlip = (id: string, visualFrom: GridLayoutRect) => {
  const to = layoutMap.get(id)
  const content = contentRef.value
  if (!to || !content) return null

  const el = content.querySelector<HTMLElement>(`[data-item-id="${id}"]`)
  if (!el) return null

  const cr = content.getBoundingClientRect()
  const ar = el.getBoundingClientRect()
  const beforeX = cr.left + visualFrom.x
  const beforeY = cr.top + visualFrom.y
  const sx = ar.width > 0 ? visualFrom.w / ar.width : 1
  const sy = ar.height > 0 ? visualFrom.h / ar.height : 1

  return {
    dx: beforeX - ar.left,
    dy: beforeY - ar.top,
    sx,
    sy
  }
}

const buildFlipTransform = (flip: { dx: number; dy: number; sx: number; sy: number }) =>
  `translate(${flip.dx}px, ${flip.dy}px) scale(${flip.sx}, ${flip.sy})`

let layoutTransitionTimer = 0

const refreshLayoutTransitionTimer = (durationMs: number) => {
  window.clearTimeout(layoutTransitionTimer)
  layoutTransitionActive.value = true
  layoutTransitionTimer = window.setTimeout(() => {
    layoutTransitionActive.value = false
    clearLayoutTransitionState()
  }, durationMs + 50)
}

const scheduleLayoutAnimPlay = (runId: number) => {
  if (!layoutSnapshotFrom.size) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (runId !== layoutRunId) return
      layoutAnimPlayIds.value = new Set(layoutSnapshotFrom.keys())
    })
  })
}

let layoutRunId = 0
let layoutQueued = false
let layoutQueuedAnimate = false

/** 同一事件循环内合并多次布局请求，只过渡一次到最终状态 */
const queueLayout = (animate = true) => {
  if (animate) layoutQueuedAnimate = true
  if (layoutQueued) return
  layoutQueued = true
  void nextTick(() => {
    layoutQueued = false
    const runAnimate = layoutQueuedAnimate
    layoutQueuedAnimate = false
    void scheduleLayout(runAnimate)
  })
}

const scheduleLayout = async (animate = true) => {
  const runId = ++layoutRunId

  if (animate) await waitForLayoutAnimateReady()
  if (runId !== layoutRunId) return

  const layoutBefore = copyLayoutSnapshot(layoutMap)
  const domSnapshot = animate ? captureSnapshotFromDom() : layoutBefore

  rebuildLayout()
  await nextTick()
  if (runId !== layoutRunId) return

  const newSnapshot = copyLayoutSnapshot(layoutMap)
  syncScrollOffset()

  if (!layoutInitialized.value) {
    layoutInitialized.value = true
    requestAnimationFrame(() => {
      suppressTransition.value = false
    })
    clearLayoutTransitionState()
    updateVisibleWindow()
    return
  }

  if (!animate || suppressTransition.value) {
    clearLayoutTransitionState()
    updateVisibleWindow()
    scheduleEnterAfterLayout()
    return
  }

  const { maxDuration, hasMovement } = planLayoutTransition(domSnapshot, layoutBefore, newSnapshot)

  if (!hasMovement) {
    clearLayoutTransitionState()
    updateVisibleWindow()
    scheduleEnterAfterLayout()
    return
  }

  layoutAnimFlipMap.clear()
  for (const id of layoutSnapshotFrom.keys()) {
    if (!itemMetaMap.get(id)?.sticky) continue
    const from = layoutBefore.get(id)
    const to = newSnapshot.get(id)
    if (!from || !to || !isStickyPinSlotTransition(from, to)) continue
    const visual = domSnapshot.get(id)
    if (!visual) continue
    const flip = computeItemFlip(id, visual)
    if (flip) layoutAnimFlipMap.set(id, flip)
  }

  layoutTransitionActive.value = true
  updateVisibleWindow()
  scheduleLayoutAnimPlay(runId)
  refreshLayoutTransitionTimer(maxDuration)
  scheduleEnterAfterLayout()
}

const buildStickyScrollTransform = () => {
  const { x, y } = scrollOffset.value
  if (x !== 0 || y !== 0) {
    return `translate3d(${x}px, ${y}px, 0) scale(1, 1)`
  }
  return 'translate3d(0,0,0) scale(1, 1)'
}

const styleItemOuter = (id: string): AgOuterStyle => {
  const to = layoutMap.get(id)
  if (!to) return { position: 'absolute', left: '0', top: '0', width: '0', height: '0' }

  const meta = itemMetaMap.get(id)
  const drag = dragState.value
  const isDragging = drag?.id === id
  const from = layoutSnapshotFrom.get(id)
  const flip = layoutAnimFlipMap.get(id)
  const flipMode = Boolean(flip) && usesLayoutFlip(id)
  const useFrom = Boolean(from) && isLayoutFromFrame(id) && !flipMode
  const display = useFrom && from ? from : to

  let x = display.x
  let y = display.y
  let w = display.w
  let h = display.h

  if (isDragging && drag) {
    x = drag.visualX
    y = drag.visualY
    w = drag.frozenW
    h = drag.frozenH
  } else if (flipMode) {
    x = to.x
    y = to.y
    w = to.w
    h = to.h
  }

  const dur = durationOverrides.get(id)
  const isStickyPinned = Boolean(meta?.sticky) && !isDragging

  const style: AgOuterStyle = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`,
    zIndex: isDragging
      ? 20
      : isExiting(id) || isEnterHidden(id) || isEnterPlay(id)
        ? 16
        : layoutSnapshotFrom.has(id)
          ? 15
          : meta?.sticky
            ? 10
            : 1,
    transformOrigin: 'top left',
    '--ag-duration-lifecycle': `${scaleMs(ITEM_LIFECYCLE_MS)}ms`
  }

  if (flipMode && isLayoutFromFrame(id) && flip) {
    style.transform = buildFlipTransform(flip)
  } else if (isStickyPinned) {
    style.transform = buildStickyScrollTransform()
  } else if (!isDragging) {
    style.transform = 'translate3d(0,0,0)'
  }

  if (isLayoutPlayFrame(id) && !suppressTransition.value) {
    const posMs = dur?.position ?? scaleMs(ANIM_MAX_MS)
    const sizeMs = dur?.size ?? scaleMs(SIZE_TRANSITION_MS)
    style['--ag-duration-position'] = `${posMs}ms`
    if (!flipMode) style['--ag-duration-size'] = `${sizeMs}ms`
  }

  if (isStickyPinned && !(flipMode && isLayoutPlayFrame(id))) {
    style.transition = 'none'
  }

  return style
}

const styleItemInner = (id: string): CSSProperties => {
  const to = layoutMap.get(id)
  const drag = dragState.value
  const isDragging = drag?.id === id
  const from = layoutSnapshotFrom.get(id)
  const flipMode = usesLayoutFlip(id)
  const useFrom = Boolean(from) && isLayoutFromFrame(id) && !flipMode
  const display = useFrom && from ? from : to

  const w = isDragging && drag ? drag.frozenW : display?.w ?? 0
  const h = isDragging && drag ? drag.frozenH : display?.h ?? 0
  const dur = durationOverrides.get(id)

  const sizeMs = dur?.size ?? scaleMs(SIZE_TRANSITION_MS)
  const lifecycleMs = scaleMs(ITEM_LIFECYCLE_MS)

  const base: CSSProperties = {
    width: `${w}px`,
    height: `${h}px`,
    transformOrigin: 'center center'
  }

  if (isEnterHidden(id)) {
    return {
      ...base,
      opacity: 0,
      transform: 'scale(0.5)',
      transition: 'none'
    }
  }

  if (isEnterPlay(id)) {
    return {
      ...base,
      opacity: 1,
      transform: 'scale(1)',
      transition: `opacity ${lifecycleMs}ms ease, transform ${lifecycleMs}ms ease`
    }
  }

  if (isExitPlay(id)) {
    return {
      ...base,
      opacity: 0,
      transform: 'scale(0.5)',
      transition: `opacity ${lifecycleMs}ms ease, transform ${lifecycleMs}ms ease`
    }
  }

  return {
    ...base,
    transition:
      isLayoutPlayFrame(id) && !flipMode && !suppressTransition.value && !isDragging
        ? `width ${sizeMs}ms ease, height ${sizeMs}ms ease`
        : undefined
  }
}

interface DragState {
  id: string
  pointerId: number
  startClientX: number
  startClientY: number
  grabOffsetX: number
  grabOffsetY: number
  visualX: number
  visualY: number
  frozenW: number
  frozenH: number
}

const dragState = ref<DragState | null>(null)
const dropTargetId = ref<string>()

let dragStarted = false
let dragPointerTarget: HTMLElement | null = null
let suppressClickItemId: string | undefined
let liveSwapPartnerId: string | undefined

const updateDragVisual = (state: DragState, clientX: number, clientY: number): DragState | null => {
  const content = contentRef.value
  if (!content) return null

  const local = clientToContentPoint(content, clientX, clientY)

  return {
    ...state,
    visualX: local.x - state.grabOffsetX,
    visualY: local.y - state.grabOffsetY
  }
}

const findSwapTarget = (dragId: string, clientX: number, clientY: number): string | undefined => {
  const content = contentRef.value
  if (!content) return undefined

  const { x: px, y: py } = clientToContentPoint(content, clientX, clientY)

  for (const item of viewList.value) {
    if (item.id === dragId || item.fixed || item.sticky) continue
    const rect = layoutMap.get(item.id)
    if (!rect) continue
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
      return item.id
    }
  }

  return undefined
}

const swapIds = (a: string, b: string) => {
  const ids = [...itemIds.value]
  const ia = ids.indexOf(a)
  const ib = ids.indexOf(b)
  if (ia < 0 || ib < 0) return
  ids[ia] = b
  ids[ib] = a
  itemIds.value = mergeIdsPreservingFixed(itemIds.value, ids, getFixedSet())
  emit('reorder', { ids: [...itemIds.value] })
  queueLayout(true)
}

const onItemPointerDown = (event: PointerEvent, item: GridItem) => {
  if (!props.sortable || item.fixed || item.sticky) return
  if (event.button !== 0) return

  const rect = layoutMap.get(item.id)
  if (!rect) return

  const content = contentRef.value
  if (!content) return

  const { x: localX, y: localY } = clientToContentPoint(content, event.clientX, event.clientY)

  dragPointerTarget = event.currentTarget as HTMLElement
  dragStarted = false
  liveSwapPartnerId = undefined
  suppressClickItemId = undefined

  dragState.value = {
    id: item.id,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    grabOffsetX: localX - rect.x,
    grabOffsetY: localY - rect.y,
    visualX: rect.x,
    visualY: rect.y,
    frozenW: rect.w,
    frozenH: rect.h
  }

  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
}

const onWindowPointerMove = (event: PointerEvent) => {
  const state = dragState.value
  if (!state || event.pointerId !== state.pointerId) return

  const dx = event.clientX - state.startClientX
  const dy = event.clientY - state.startClientY

  if (!dragStarted) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    dragStarted = true
    try {
      dragPointerTarget?.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  const synced = updateDragVisual(state, event.clientX, event.clientY)
  if (synced) dragState.value = synced

  const targetId = findSwapTarget(state.id, event.clientX, event.clientY)
  dropTargetId.value = targetId

  if (targetId && targetId !== state.id && targetId !== liveSwapPartnerId) {
    swapIds(state.id, targetId)
    liveSwapPartnerId = targetId
  } else if (!targetId) {
    liveSwapPartnerId = undefined
  }
}

const endDrag = () => {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)

  const state = dragState.value
  if (state && dragPointerTarget) {
    try {
      dragPointerTarget.releasePointerCapture(state.pointerId)
    } catch {
      /* ignore */
    }
  }

  if (dragStarted && state) {
    suppressClickItemId = state.id
  }

  dragPointerTarget = null
  dragState.value = null
  dropTargetId.value = undefined
  dragStarted = false
  queueLayout(true)
}

const onWindowPointerUp = (event: PointerEvent) => {
  if (dragState.value && event.pointerId !== dragState.value.pointerId) return
  endDrag()
}

const onGridClickCapture = (event: MouseEvent) => {
  const target = (event.target as HTMLElement).closest('[data-item-id]')
  const id = target?.getAttribute('data-item-id') ?? undefined
  if (id && suppressClickItemId === id) {
    event.stopPropagation()
    event.preventDefault()
    suppressClickItemId = undefined
  }
}

const getScrollRange = (offsetPages: number) => {
  const container = containerRef.value
  if (!container || containerH.value <= 0) {
    return { top: 0, bottom: Number.POSITIVE_INFINITY }
  }

  const page = containerH.value
  const offset = Math.max(0, offsetPages) * page
  const scrollTop = container.scrollTop

  return {
    top: scrollTop - offset,
    bottom: scrollTop + page + offset
  }
}

const syncScrollOffset = () => {
  const el = containerRef.value
  if (!el) return
  const x = el.scrollLeft
  const y = el.scrollTop
  if (scrollOffset.value.x !== x || scrollOffset.value.y !== y) {
    scrollOffset.value = { x, y }
  }
}

const onScroll = () => {
  syncScrollOffset()
  updateVisibleWindow()
}

const rectInRange = (rect: GridLayoutRect, range: { top: number; bottom: number }) => {
  const bottom = rect.y + rect.h
  return bottom >= range.top && rect.y <= range.bottom
}

const updateVisibleWindow = (offsetPages = props.virtualOffsetPages) => {
  if (!props.virtualScroll) {
    visibleList.value = viewList.value
    notifyVisible(viewList.value)
    return
  }

  const range = getScrollRange(offsetPages)
  const forced = new Set(getStickyIds())
  if (dragState.value) forced.add(dragState.value.id)
  exitingIds.value.forEach((id) => forced.add(id))
  enterHiddenIds.value.forEach((id) => forced.add(id))
  enterPlayIds.value.forEach((id) => forced.add(id))
  const next = viewList.value.filter((item) => {
    if (forced.has(item.id)) return true
    const rect = layoutMap.get(item.id)
    return rect ? rectInRange(rect, range) : false
  })

  visibleList.value = next
  notifyVisible(next)
}

let lastVisibleKey = ''

const notifyVisible = (items: GridItem[]) => {
  const key = items
    .map((i) => i.id)
    .sort()
    .join(',')
  if (key === lastVisibleKey) return
  lastVisibleKey = key
  emit('visible-change', items.map((i) => i.id))
}

const setItem = (id: string, options: GridSetItemOptions = {}) => {
  const { index = 0, ...patch } = options
  const prev = [...itemIds.value]
  const exists = prev.includes(id)
  const isNew = !exists

  if (isNew) {
    const next = [...prev]
    next.splice(Math.min(index, next.length), 0, id)
    itemIds.value = mergeIdsPreservingFixed(prev, next, getFixedSet())
    itemMetaMap.set(id, {})
    markEnterHidden([id])
  }

  itemMetaMap.set(id, { ...(itemMetaMap.get(id) ?? {}), ...patch })

  if (exists && options.index != null) {
    const next = prev.filter((x) => x !== id)
    next.splice(Math.min(options.index, next.length), 0, id)
    itemIds.value = mergeIdsPreservingFixed(prev, next, getFixedSet())
  }

  queueLayout(true)
}

const setItems = (entries: GridSetItemEntry[]) => {
  const prev = [...itemIds.value]
  const order: string[] = []
  const seen = new Set<string>()

  for (const e of entries) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    order.push(e.id)
  }

  const removedIds = prev.filter((id) => !seen.has(id) && !exitingIds.value.has(id))
  const newIds = order.filter((id) => !prev.includes(id))

  for (const id of prev) {
    if (!seen.has(id) && !removedIds.includes(id)) itemMetaMap.delete(id)
  }

  for (const { id, options } of entries) {
    if (!options) {
      if (!itemMetaMap.has(id)) itemMetaMap.set(id, {})
      continue
    }
    const { index: _i, ...patch } = options
    if (!itemMetaMap.has(id)) itemMetaMap.set(id, {})
    itemMetaMap.set(id, { ...(itemMetaMap.get(id) ?? {}), ...patch })
  }

  const nextOrder = mergeIdsPreservingFixed(prev, order, getFixedSet())
  const keptPrev = prev.filter((id) => !removedIds.includes(id))
  const orderChanged =
    nextOrder.length !== keptPrev.length ||
    nextOrder.some((id, i) => id !== keptPrev[i])

  if (removedIds.length) {
    pendingIdsAfterExit = nextOrder
    itemIds.value = [...nextOrder, ...removedIds]
    scheduleExitLifecycle(removedIds)
    if (newIds.length) markEnterHidden(newIds)
    if (newIds.length || orderChanged) queueLayout(true)
  } else {
    itemIds.value = nextOrder
    if (newIds.length) markEnterHidden(newIds)
    queueLayout(true)
  }
}

const removeItem = (ids: string | string[]) => {
  const list = Array.isArray(ids) ? ids : [ids]
  const toExit = list.filter((id) => itemIds.value.includes(id) && !exitingIds.value.has(id))
  if (!toExit.length) return
  pendingIdsAfterExit = null
  scheduleExitLifecycle(toExit)
}

const getItems = (): GridItem[] => viewList.value.map((item) => ({ ...item }))

const getVisibleItems = (offsetPages?: number): GridItem[] => {
  if (offsetPages != null) {
    const range = getScrollRange(offsetPages)
    const forced = new Set(getStickyIds())
    return viewList.value.filter((item) => {
      if (forced.has(item.id)) return true
      const rect = layoutMap.get(item.id)
      return rect ? rectInRange(rect, range) : false
    })
  }
  return visibleList.value.map((item) => ({ ...item }))
}

const settleActiveAnimations = () => {
  layoutRunId++
  layoutQueued = false
  layoutQueuedAnimate = false
  window.clearTimeout(layoutTransitionTimer)
  layoutTransitionActive.value = false
  suppressTransition.value = true
  clearLayoutTransitionState()
  const toRemove = [...exitingIds.value]
  clearItemLifecycleState()

  if (toRemove.length) {
    if (pendingIdsAfterExit) {
      itemIds.value = pendingIdsAfterExit
    } else {
      itemIds.value = itemIds.value.filter((id) => !toRemove.includes(id))
    }
    for (const id of toRemove) itemMetaMap.delete(id)
  }

  endDrag()
  rebuildLayout()
  requestAnimationFrame(() => {
    suppressTransition.value = false
  })
}

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const shuffleItems = () => {
  const fixedSet = getFixedSet()
  const movable = shuffleArray(itemIds.value.filter((id) => !fixedSet.has(id)))
  let cursor = 0
  const next = itemIds.value.map((id) => (fixedSet.has(id) ? id : movable[cursor++]))
  itemIds.value = next
  emit('reorder', { ids: [...next] })
  queueLayout(true)
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  measureContainer()
  rebuildLayout()
  syncScrollOffset()
  updateVisibleWindow()

  resizeObserver = new ResizeObserver(() => {
    measureContainer()
    syncScrollOffset()
    queueLayout(!suppressTransition.value)
  })
  if (containerRef.value) resizeObserver.observe(containerRef.value)

  requestAnimationFrame(() => {
    suppressTransition.value = false
    layoutInitialized.value = true
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  endDrag()
  window.clearTimeout(layoutTransitionTimer)
  clearItemLifecycleState()
})

watch(
  () => [props.cols, props.rows, props.left, props.top, props.right, props.bottom, props.gap, props.itemWidth, props.itemHeight],
  () => queueLayout(true)
)

defineExpose({
  setItem,
  setItems,
  removeItem,
  getItems,
  getVisibleItems,
  settleActiveAnimations,
  shuffleItems,
  getTransitionTimeScale: () => transitionTimeScale.value,
  setTransitionTimeScale: (scale: number) => {
    transitionTimeScale.value = Math.max(0, scale)
  }
})
</script>

<style scoped>
.pr-adaptive-grid {
  box-sizing: border-box;
  overflow: auto;
  /* 保留滚动，隐藏滚动条及其占位 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.pr-adaptive-grid::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.pr-adaptive-grid-content {
  box-sizing: border-box;
}

.pr-adaptive-grid-item {
  box-sizing: border-box;
  will-change: transform, left, top;
}

/* 旧快照帧：无过渡，避免闪到目标位 */
.pr-adaptive-grid-item-layout-from,
.pr-adaptive-grid-item-layout-from .pr-adaptive-grid-item-inner {
  transition: none !important;
}

/* 新快照帧：逐项 left/top/width/height 过渡 */
.pr-adaptive-grid-item-layout-play:not(.pr-adaptive-grid-item-dragging) {
  transition:
    left var(--ag-duration-position, 800ms) ease,
    top var(--ag-duration-position, 800ms) ease,
    width var(--ag-duration-size, 500ms) ease,
    height var(--ag-duration-size, 500ms) ease;
}

.pr-adaptive-grid-item-layout-play:not(.pr-adaptive-grid-item-dragging) .pr-adaptive-grid-item-inner {
  transition:
    width var(--ag-duration-size, 500ms) ease,
    height var(--ag-duration-size, 500ms) ease;
}

.pr-adaptive-grid-item-layout-flip-from,
.pr-adaptive-grid-item-layout-flip-from .pr-adaptive-grid-item-inner {
  transition: none !important;
}

.pr-adaptive-grid-item-layout-flip-play:not(.pr-adaptive-grid-item-dragging) {
  transition: transform var(--ag-duration-position, 800ms) ease !important;
}

/* sticky(Pin)：默认禁止 transform 过渡；仅首次 Pin 的 flip-play 允许 */
.pr-adaptive-grid-item-sticky:not(.pr-adaptive-grid-item-layout-flip-play) {
  transition: none !important;
}

.pr-adaptive-grid-item-sticky.pr-adaptive-grid-item-layout-flip-play:not(.pr-adaptive-grid-item-dragging) {
  transition: transform var(--ag-duration-position, 800ms) ease !important;
}

.pr-adaptive-grid-item-sticky {
  will-change: transform, left, top;
}

.pr-adaptive-grid-item-sticky .pr-adaptive-grid-item-inner {
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.4);
}

.pr-adaptive-grid-item-inner {
  box-sizing: border-box;
  overflow: hidden;
}

/* 新增/移除渐入渐出由内联 style 驱动；类名仅用于层级与调试 */

.pr-adaptive-grid-item-no-transition,
.pr-adaptive-grid-item-dragging {
  transition: none !important;
}

.pr-adaptive-grid-item-dragging {
  z-index: 30;
  opacity: 0.92;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.35));
}

.pr-adaptive-grid-item-drop-target .pr-adaptive-grid-item-inner {
  outline: 2px dashed rgba(37, 99, 235, 0.75);
  outline-offset: -2px;
}

.pr-adaptive-grid-item-fixed .pr-adaptive-grid-item-inner {
  cursor: default;
}

.pr-adaptive-grid-sortable .pr-adaptive-grid-item:not(.pr-adaptive-grid-item-fixed):not(.pr-adaptive-grid-item-sticky) .pr-adaptive-grid-item-inner {
  cursor: grab;
}

.pr-adaptive-grid-sortable .pr-adaptive-grid-item-dragging .pr-adaptive-grid-item-inner {
  cursor: grabbing;
}
</style>
