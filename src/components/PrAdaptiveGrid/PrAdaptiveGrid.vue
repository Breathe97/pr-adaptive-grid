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

const layoutTransitionActive = ref(false)
const suppressTransition = ref(true)
const layoutInitialized = ref(false)
/** pin(sticky) 切换时：先以 absolute 做过渡，结束后再切回 sticky */
const stickyToggleAnimIds = reactive(new Set<string>())

const ANIM_MIN_MS = 300
const ANIM_MAX_MS = 800
const SIZE_TRANSITION_MS = 500
const LAYOUT_SPEED = 0.7
const DRAG_THRESHOLD = 6

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

const itemClasses = (item: GridItem) => ({
  'pr-adaptive-grid-item-sticky': item.sticky,
  'pr-adaptive-grid-item-fixed': item.fixed,
  'pr-adaptive-grid-item-sticky-toggle': stickyToggleAnimIds.has(item.id),
  'pr-adaptive-grid-item-layout-anim': layoutTransitionActive.value,
  'pr-adaptive-grid-item-no-transition': suppressTransition.value && !layoutTransitionActive.value,
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
  return Math.round(Math.min(maxMs, Math.max(minMs, ms)))
}

const prevLayoutSnapshot = new Map<string, GridLayoutRect>()

const computeLayoutAnimDurations = (
  next: Map<string, GridLayoutRect>,
  prev: Map<string, GridLayoutRect>
) => {
  let maxPos = ANIM_MIN_MS
  let maxSize = SIZE_TRANSITION_MS

  for (const [id, rect] of next) {
    const p = prev.get(id)
    if (!p) continue
    const posDist = Math.hypot(rect.x - p.x, rect.y - p.y)
    const sizeDist = Math.hypot(rect.w - p.w, rect.h - p.h)
    maxPos = Math.max(maxPos, getDurationForDistance(posDist, ANIM_MIN_MS, ANIM_MAX_MS))
    if (sizeDist > 1) {
      maxSize = Math.max(maxSize, SIZE_TRANSITION_MS)
    }
  }

  return { position: maxPos, size: maxSize }
}

let layoutTransitionTimer = 0

const refreshLayoutTransitionTimer = (durationMs: number) => {
  window.clearTimeout(layoutTransitionTimer)
  layoutTransitionActive.value = true
  layoutTransitionTimer = window.setTimeout(() => {
    layoutTransitionActive.value = false
  }, durationMs + 50)
}

let stickyToggleAnimTimer = 0

const triggerStickyToggleAnim = (id: string) => {
  stickyToggleAnimIds.add(id)
  window.clearTimeout(stickyToggleAnimTimer)
  stickyToggleAnimTimer = window.setTimeout(() => {
    stickyToggleAnimIds.delete(id)
  }, ANIM_MAX_MS + 80)
}

const scheduleLayout = async (animate = true) => {
  prevLayoutSnapshot.clear()
  layoutMap.forEach((rect, id) => prevLayoutSnapshot.set(id, { ...rect }))

  rebuildLayout()
  await nextTick()

  if (!layoutInitialized.value) {
    layoutInitialized.value = true
    requestAnimationFrame(() => {
      suppressTransition.value = false
    })
    updateVisibleWindow()
    return
  }

  if (!animate || suppressTransition.value) {
    updateVisibleWindow()
    return
  }

  const next = new Map<string, GridLayoutRect>()
  layoutMap.forEach((r, id) => next.set(id, { ...r }))
  const { position, size } = computeLayoutAnimDurations(next, prevLayoutSnapshot)
  durationOverrides.clear()
  let maxDuration = ANIM_MIN_MS
  let hasMovement = false

  next.forEach((rect, id) => {
    const p = prevLayoutSnapshot.get(id)
    if (!p) return
    const posDist = Math.hypot(rect.x - p.x, rect.y - p.y)
    const sizeDist = Math.hypot(rect.w - p.w, rect.h - p.h)
    if (posDist > 1 || sizeDist > 1) hasMovement = true
    const posDur = getDurationForDistance(posDist, ANIM_MIN_MS, ANIM_MAX_MS)
    maxDuration = Math.max(maxDuration, posDur)
    durationOverrides.set(id, {
      position: posDur,
      size: SIZE_TRANSITION_MS
    })
  })

  for (const id of stickyToggleAnimIds) {
    if (!durationOverrides.has(id)) {
      durationOverrides.set(id, { position: ANIM_MAX_MS, size: SIZE_TRANSITION_MS })
    }
    maxDuration = Math.max(maxDuration, ANIM_MAX_MS)
    hasMovement = true
  }

  void position
  void size

  refreshLayoutTransitionTimer(hasMovement ? ANIM_MAX_MS : maxDuration)
  updateVisibleWindow()
}

const durationOverrides = new Map<string, { position: number; size: number }>()

const styleItemOuter = (id: string): AgOuterStyle => {
  const rect = layoutMap.get(id)
  if (!rect) return { position: 'absolute', left: '0', top: '0', width: '0', height: '0' }

  const meta = itemMetaMap.get(id)
  const drag = dragState.value
  const isDragging = drag?.id === id

  let x = rect.x
  let y = rect.y

  if (isDragging && drag) {
    x = drag.visualX
    y = drag.visualY
  }

  const dur = durationOverrides.get(id)
  const pinTransition =
    layoutTransitionActive.value && stickyToggleAnimIds.has(id) && !isDragging
  const useStickyPosition = Boolean(meta?.sticky) && !pinTransition

  const style: AgOuterStyle = {
    position: useStickyPosition ? 'sticky' : 'absolute',
    left: `${useStickyPosition ? rect.x : x}px`,
    top: `${useStickyPosition ? rect.y : y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    zIndex: isDragging ? 20 : meta?.sticky ? 10 : 1
  }

  if (!useStickyPosition) {
    style.transform = isDragging ? undefined : `translate3d(0,0,0)`
  }

  if (layoutTransitionActive.value && !suppressTransition.value && !isDragging) {
    style['--ag-duration-position'] = `${dur?.position ?? ANIM_MAX_MS}ms`
    style['--ag-duration-size'] = `${dur?.size ?? SIZE_TRANSITION_MS}ms`
  }

  return style
}

const styleItemInner = (id: string): CSSProperties => {
  const rect = layoutMap.get(id)
  const drag = dragState.value
  const isDragging = drag?.id === id
  const w = isDragging && drag ? drag.frozenW : rect?.w ?? 0
  const h = isDragging && drag ? drag.frozenH : rect?.h ?? 0
  const dur = durationOverrides.get(id)

  return {
    width: `${w}px`,
    height: `${h}px`,
    transition:
      layoutTransitionActive.value && !suppressTransition.value
        ? `width ${dur?.size ?? SIZE_TRANSITION_MS}ms ease, height ${dur?.size ?? SIZE_TRANSITION_MS}ms ease`
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
  void scheduleLayout(true)
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
  void scheduleLayout(true)
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

const onScroll = () => {
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

  if (!exists) {
    const next = [...prev]
    next.splice(Math.min(index, next.length), 0, id)
    itemIds.value = mergeIdsPreservingFixed(prev, next, getFixedSet())
    itemMetaMap.set(id, {})
  }

  const prevSticky = itemMetaMap.get(id)?.sticky
  itemMetaMap.set(id, { ...(itemMetaMap.get(id) ?? {}), ...patch })

  if (exists && options.index != null) {
    const next = prev.filter((x) => x !== id)
    next.splice(Math.min(options.index, next.length), 0, id)
    itemIds.value = mergeIdsPreservingFixed(prev, next, getFixedSet())
  }

  if (patch.sticky !== undefined && patch.sticky !== prevSticky) {
    triggerStickyToggleAnim(id)
  }

  void scheduleLayout(true)
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

  for (const id of prev) {
    if (!seen.has(id)) itemMetaMap.delete(id)
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

  itemIds.value = mergeIdsPreservingFixed(prev, order, getFixedSet())
  void scheduleLayout(true)
}

const removeItem = (ids: string | string[]) => {
  const list = Array.isArray(ids) ? ids : [ids]
  const removeSet = new Set(list)
  itemIds.value = itemIds.value.filter((id) => !removeSet.has(id))
  for (const id of list) itemMetaMap.delete(id)
  void scheduleLayout(true)
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
  window.clearTimeout(layoutTransitionTimer)
  layoutTransitionActive.value = false
  suppressTransition.value = true
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
  void scheduleLayout(true)
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  measureContainer()
  rebuildLayout()
  updateVisibleWindow()

  resizeObserver = new ResizeObserver(() => {
    measureContainer()
    void scheduleLayout(!suppressTransition.value)
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
  window.clearTimeout(stickyToggleAnimTimer)
})

watch(
  () => [props.cols, props.rows, props.left, props.top, props.right, props.bottom, props.gap, props.itemWidth, props.itemHeight],
  () => void scheduleLayout(true)
)

watch(itemIds, () => void scheduleLayout(true), { deep: true })

defineExpose({
  setItem,
  setItems,
  removeItem,
  getItems,
  getVisibleItems,
  settleActiveAnimations,
  shuffleItems
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

.pr-adaptive-grid-item-layout-anim:not(.pr-adaptive-grid-item-dragging) {
  transition:
    left var(--ag-duration-position, 800ms) ease,
    top var(--ag-duration-position, 800ms) ease;
}

.pr-adaptive-grid-item-sticky {
  flex-shrink: 0;
}

.pr-adaptive-grid-item-sticky.pr-adaptive-grid-item-layout-anim:not(.pr-adaptive-grid-item-dragging) {
  transition:
    left var(--ag-duration-position, 800ms) ease,
    top var(--ag-duration-position, 800ms) ease,
    width var(--ag-duration-size, 500ms) ease,
    height var(--ag-duration-size, 500ms) ease;
}

.pr-adaptive-grid-item-sticky-toggle .pr-adaptive-grid-item-inner {
  transition:
    box-shadow 0.35s ease,
    transform 0.35s ease;
  transform: scale(1.015);
}

.pr-adaptive-grid-item-sticky .pr-adaptive-grid-item-inner {
  transition: box-shadow 0.35s ease;
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.4);
}

.pr-adaptive-grid-item-inner {
  box-sizing: border-box;
  overflow: hidden;
}

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
