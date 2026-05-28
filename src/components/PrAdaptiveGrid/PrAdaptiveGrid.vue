<template>
  <div
    ref="pr_adaptive_grid_ref"
    class="pr-adaptive-grid"
    :style="ScrollContainerStyle"
    @scroll="onScroll"
    @click.capture="onGridClickCapture"
  >
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="item in list" :key="`span-${item.id}`" class="pr-adaptive-grid-item-span" :data-item-id="item.id" :style="ItemSpanStyle(item)" />
      <div
        v-for="item in list"
        :key="`item-${item.id}`"
        class="pr-adaptive-grid-item"
        :class="{
          'pr-adaptive-grid-item-sticky': item.sticky,
          'pr-adaptive-grid-item-layout-anim': layoutTransitionActive && !enteringItemIds.has(item.id),
          'pr-adaptive-grid-item-enter-host': enteringItemIds.has(item.id),
          'pr-adaptive-grid-item-no-transition':
            scrollTransitionDisabled || (suppressTransition && !enteringItemIds.has(item.id)),
          'pr-adaptive-grid-item-dragging': dragState?.id === item.id && dragReleasingId !== item.id,
          'pr-adaptive-grid-item-dragging-release': dragReleasingId === item.id,
          'pr-adaptive-grid-item-drop-target': dropTargetId === item.id
        }"
        :style="StyleItemOuter(item.id)"
      >
        <div
          class="pr-adaptive-grid-item-inner"
          :class="{ 'pr-adaptive-grid-item-enter': enteringItemIds.has(item.id) }"
          :style="StyleItemInner(item.id)"
          @pointerdown="(event) => onItemPointerDown(event, item)"
        >
          <slot :item="item" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch, nextTick, type CSSProperties } from 'vue'
import type { GridDirection, GridItem, GridLayoutRect, GridReorderPayload } from '../../types'

const props = defineProps({
  list: {
    type: Array<GridItem>,
    required: true
  },
  cols: {
    type: Number,
    required: true
  },
  rows: {
    type: Number,
    required: true
  },
  gap: {
    type: Number,
    default: () => 0
  },
  padding: {
    type: Number,
    default: () => 0
  },
  /** 单行轨道高度（px）；不传则按容器首屏可视高度自动计算 */
  itemHeight: {
    type: Number,
    default: undefined
  },
  /** 首屏等高行数（如 mode2 为 12，行高 = (视口高 - gap) / 12） */
  firstScreenRowSplit: {
    type: Number,
    default: undefined
  },
  direction: {
    type: String as () => GridDirection,
    default: () => 'right' as GridDirection
  },
  /** 是否允许拖动交换格子排序 */
  sortable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits<{
  reorder: [payload: GridReorderPayload]
}>()

const pr_adaptive_grid_ref = ref<HTMLElement>()
const pr_adaptive_grid_content_ref = ref<HTMLElement>()

/** 首屏按最多 4 行均分容器高度（与 mode2 左侧 fullId 占 4 行一致） */
const FIRST_SCREEN_ROWS = 4
const LAYOUT_TRANSITION_MS = 850

const containerViewportHeight = ref(0)
const layoutTransitionActive = ref(false)
const scrollTransitionDisabled = ref(false)
const suppressTransition = ref(true)
const layoutInitialized = ref(false)
const previousListLength = ref(0)

const contentLayoutMap = reactive(new Map<string, GridLayoutRect>())
const stickyOffsetMap = reactive(new Map<string, GridLayoutRect>())
const knownItemIds = new Set<string>()
const enteringItemIds = reactive(new Set<string>())

const DRAG_THRESHOLD = 6

interface DragState {
  id: string
  pointerId: number
  startClientX: number
  startClientY: number
  grabOffsetX: number
  grabOffsetY: number
  offsetX: number
  offsetY: number
  /** 按下时的尺寸，拖动浮层期间保持不变 */
  frozenW: number
  frozenH: number
  /** 松手过渡阶段：true 时过渡到目标格尺寸 */
  useSlotSize?: boolean
}

const dragState = ref<DragState | null>(null)
const dragReleasingId = ref<string>()
const dropTargetId = ref<string>()
let dragStarted = false
let suppressClickAfterDrag = false
let dragPointerTarget: HTMLElement | null = null
let liveSwapPartnerId: string | undefined
let lastPointerClientX = 0
let lastPointerClientY = 0
let dragReorderSyncToken = 0
let dragReleaseTimer = 0
let dragReleaseToken = 0

const cancelDragRelease = () => {
  window.clearTimeout(dragReleaseTimer)
  dragReleaseTimer = 0
  dragReleaseToken++
  dragReleasingId.value = undefined
}

const EMPTY_ITEM_STYLE: CSSProperties = {
  width: '0px',
  height: '0px',
  transform: 'translate3d(0px, 0px, 0)'
}

const ScrollContainerStyle = computed(() => {
  const { padding } = props
  return {
    padding: `${padding}px`
  }
})

/** 未传 itemHeight 时：(视口高度 - 行间距) / 首屏行数 */
const resolvedRowHeight = computed(() => {
  if (props.itemHeight != null && props.itemHeight > 0) {
    return props.itemHeight
  }
  if (containerViewportHeight.value <= 0 || props.rows <= 0) return 0

  const split = props.firstScreenRowSplit != null && props.firstScreenRowSplit > 0 ? props.firstScreenRowSplit : Math.min(props.rows, FIRST_SCREEN_ROWS)
  const totalGap = Math.max(0, split - 1) * props.gap
  return (containerViewportHeight.value - totalGap) / split
})

const ContainerStyle = computed(() => {
  const { gap, rows, cols } = props
  const rowHeight = resolvedRowHeight.value

  if (!rowHeight) {
    return {
      gap: `${gap}px`,
      display: 'grid',
      width: '100%',
      height: '100%',
      'grid-template-columns': `repeat(${cols}, 1fr)`,
      'grid-template-rows': `repeat(${rows}, 1fr)`
    }
  }

  const contentHeight = rows * rowHeight + Math.max(0, rows - 1) * gap

  return {
    gap: `${gap}px`,
    display: 'grid',
    width: '100%',
    minHeight: `${contentHeight}px`,
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'grid-template-rows': `repeat(${rows}, ${rowHeight}px)`
  }
})

const ItemSpanStyle = computed(() => {
  return function (item: GridItem) {
    const { x, y, w, h } = item

    return {
      'grid-column-start': x,
      'grid-column-end': `span ${w}`,
      'grid-row-start': y,
      'grid-row-end': `span ${h}`
    }
  }
})

/** 根据网格轨道计算像素矩形（x/y 为 1-based，与 CSS grid-line 一致） */
const computeItemRect = (item: GridItem, innerW: number, innerH: number, cols: number, rows: number, gap: number, itemHeight: number): GridLayoutRect => {
  const colTrack = cols > 0 ? (innerW - (cols - 1) * gap) / cols : 0
  const rowTrack = itemHeight > 0 ? itemHeight : rows > 0 ? (innerH - (rows - 1) * gap) / rows : 0
  const colStart = item.x - 1
  const rowStart = item.y - 1

  return {
    x: colStart * (colTrack + gap),
    y: rowStart * (rowTrack + gap),
    w: item.w * colTrack + (item.w - 1) * gap,
    h: item.h * rowTrack + (item.h - 1) * gap
  }
}

const measureContainer = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return
  containerViewportHeight.value = container.clientHeight
}

const measureItemRects = (): Map<string, GridLayoutRect> => {
  const rects = new Map<string, GridLayoutRect>()
  const content = pr_adaptive_grid_content_ref.value
  if (!content) return rects

  const { width, height } = content.getBoundingClientRect()
  if (!width || !height) return rects

  const rowHeight = resolvedRowHeight.value
  const spans = content.querySelectorAll<HTMLElement>('.pr-adaptive-grid-item-span')
  const contentRect = content.getBoundingClientRect()
  const canMeasure = spans.length === props.list.length

  props.list.forEach((item) => {
    let rect: GridLayoutRect | undefined

    if (canMeasure) {
      const span = content.querySelector<HTMLElement>(`.pr-adaptive-grid-item-span[data-item-id="${item.id}"]`)
      if (!span) return

      const spanRect = span.getBoundingClientRect()
      rect = {
        x: spanRect.left - contentRect.left,
        y: spanRect.top - contentRect.top,
        w: spanRect.width,
        h: spanRect.height
      }
    } else {
      const { gap, cols, rows } = props
      rect = computeItemRect(item, width, height, cols, rows, gap, rowHeight)
    }

    if (rect) rects.set(item.id, rect)
  })

  return rects
}

const finishInitialLayout = () => {
  if (layoutInitialized.value || containerViewportHeight.value <= 0) return

  layoutInitialized.value = true
  requestAnimationFrame(() => {
    suppressTransition.value = false
  })
}

const syncKnownItemIds = () => {
  props.list.forEach((item) => knownItemIds.add(item.id))
  for (const id of [...knownItemIds]) {
    if (!props.list.some((item) => item.id === id)) {
      knownItemIds.delete(id)
    }
  }
}

const syncLayout = () => {
  const rects = measureItemRects()
  rects.forEach((rect, id) => {
    contentLayoutMap.set(id, rect)
  })

  // 清理已移除项
  for (const id of [...contentLayoutMap.keys()]) {
    if (!props.list.some((item) => item.id === id)) {
      contentLayoutMap.delete(id)
      stickyOffsetMap.delete(id)
      enteringItemIds.delete(id)
    }
  }

  updateStickyOnScroll()

  const state = dragState.value
  if (state && dragStarted) {
    const synced = updateDragOffset(state, lastPointerClientX, lastPointerClientY)
    if (synced) {
      dragState.value = synced
    }
  }
}

const getItemLayout = (id: string): GridLayoutRect | undefined => {
  const item = props.list.find((entry) => entry.id === id)
  if (!item) return undefined

  if (item.sticky) {
    const sticky = stickyOffsetMap.get(id)
    if (sticky) return sticky
  }

  const cached = contentLayoutMap.get(id)
  if (cached) return cached

  const content = pr_adaptive_grid_content_ref.value
  if (!content) return undefined

  const { width, height } = content.getBoundingClientRect()
  if (!width || !height) return undefined

  const span = content.querySelector<HTMLElement>(`.pr-adaptive-grid-item-span[data-item-id="${id}"]`)
  if (span) {
    const contentRect = content.getBoundingClientRect()
    const spanRect = span.getBoundingClientRect()
    return {
      x: spanRect.left - contentRect.left,
      y: spanRect.top - contentRect.top,
      w: spanRect.width,
      h: spanRect.height
    }
  }

  return computeItemRect(item, width, height, props.cols, props.rows, props.gap, resolvedRowHeight.value)
}

const StyleItemOuter = (id: string): CSSProperties => {
  const layout = getItemLayout(id)
  if (!layout) return EMPTY_ITEM_STYLE

  const state = dragState.value
  const isActiveDrag = state?.id === id && dragReleasingId.value !== id
  const isRelease = dragReleasingId.value === id && state?.id === id

  if (isActiveDrag || isRelease) {
    const useSlotSize = Boolean(isRelease && state.useSlotSize)
    const w = useSlotSize ? layout.w : state.frozenW
    const h = useSlotSize ? layout.h : state.frozenH
    const offsetX = useSlotSize ? 0 : state.offsetX
    const offsetY = useSlotSize ? 0 : state.offsetY

    return {
      width: `${w}px`,
      height: `${h}px`,
      transform: `translate3d(${layout.x + offsetX}px, ${layout.y + offsetY}px, 0)`
    }
  }

  const dragging = state?.id === id ? state : null
  const x = layout.x + (dragging?.offsetX ?? 0)
  const y = layout.y + (dragging?.offsetY ?? 0)

  return {
    width: `${layout.w}px`,
    height: `${layout.h}px`,
    transform: `translate3d(${x}px, ${y}px, 0)`
  }
}

const getVisualSortIds = (list: GridItem[]): string[] =>
  [...list]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => item.id)

const swapItemsLayout = (fromId: string, toId: string): GridItem[] => {
  const from = props.list.find((item) => item.id === fromId)
  const to = props.list.find((item) => item.id === toId)
  if (!from || !to) return props.list.map((item) => ({ ...item }))

  const fromLayout = { x: from.x, y: from.y, w: from.w, h: from.h }
  const toLayout = { x: to.x, y: to.y, w: to.w, h: to.h }

  return props.list.map((item) => {
    if (item.id === fromId) return { ...item, ...toLayout }
    if (item.id === toId) return { ...item, ...fromLayout }
    return { ...item }
  })
}

const getHitTestLayout = (item: GridItem): GridLayoutRect | undefined => {
  if (dragStarted) {
    const content = pr_adaptive_grid_content_ref.value
    if (!content) return contentLayoutMap.get(item.id)

    const { width, height } = content.getBoundingClientRect()
    if (!width || !height) return contentLayoutMap.get(item.id)

    return computeItemRect(item, width, height, props.cols, props.rows, props.gap, resolvedRowHeight.value)
  }

  return contentLayoutMap.get(item.id) ?? getItemLayout(item.id)
}

const findDropTargetAt = (clientX: number, clientY: number): string | undefined => {
  const content = pr_adaptive_grid_content_ref.value
  const draggingId = dragState.value?.id
  if (!content || !draggingId) return undefined

  const contentRect = content.getBoundingClientRect()
  const x = clientX - contentRect.left
  const y = clientY - contentRect.top

  for (const item of props.list) {
    if (item.id === draggingId || item.sticky) continue

    const layout = getHitTestLayout(item)
    if (!layout) continue

    if (x >= layout.x && x <= layout.x + layout.w && y >= layout.y && y <= layout.y + layout.h) {
      return item.id
    }
  }

  return undefined
}

const performLiveSwap = (fromId: string, toId: string) => {
  const newList = swapItemsLayout(fromId, toId)

  liveSwapPartnerId = toId

  emit('reorder', {
    ids: getVisualSortIds(newList),
    list: newList
  })
}

const scheduleDragReorderSync = () => {
  const token = ++dragReorderSyncToken
  beginLayoutTransition()

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (token !== dragReorderSyncToken) return
      syncLayout()
      syncKnownItemIds()
    })
  })
}

const cleanupDragListeners = () => {
  document.removeEventListener('pointermove', onDocumentPointerMove)
  document.removeEventListener('pointerup', onDocumentPointerUp)
  document.removeEventListener('pointercancel', onDocumentPointerUp)
}

const finishDrag = () => {
  const state = dragState.value

  if (dragPointerTarget && state) {
    try {
      dragPointerTarget.releasePointerCapture(state.pointerId)
    } catch {
      // ignore
    }
  }

  dragPointerTarget = null
  cleanupDragListeners()

  if (dragStarted && state) {
    suppressClickAfterDrag = true
    syncLayout()
    beginLayoutTransition()
    dragReleasingId.value = state.id

    const releaseToken = dragReleaseToken
    const releasingId = state.id

    requestAnimationFrame(() => {
      if (dragReleaseToken !== releaseToken) return
      if (dragState.value?.id !== releasingId) return
      dragState.value = { ...state, offsetX: 0, offsetY: 0, useSlotSize: true }
    })

    window.clearTimeout(dragReleaseTimer)
    dragReleaseTimer = window.setTimeout(() => {
      if (dragReleaseToken !== releaseToken) return
      if (dragState.value?.id !== releasingId) return
      dragReleasingId.value = undefined
      dragState.value = null
      dropTargetId.value = undefined
      liveSwapPartnerId = undefined
      dragStarted = false
    }, LAYOUT_TRANSITION_MS)
    return
  }

  dragState.value = null
  dragReleasingId.value = undefined
  dropTargetId.value = undefined
  liveSwapPartnerId = undefined
  dragStarted = false
}

const updateDragOffset = (state: DragState, clientX: number, clientY: number): DragState | null => {
  const content = pr_adaptive_grid_content_ref.value
  if (!content) return null

  const layout = getItemLayout(state.id)
  if (!layout) return null

  const contentRect = content.getBoundingClientRect()
  const px = clientX - contentRect.left
  const py = clientY - contentRect.top

  return {
    ...state,
    offsetX: px - layout.x - state.grabOffsetX,
    offsetY: py - layout.y - state.grabOffsetY
  }
}

const onDocumentPointerMove = (event: PointerEvent) => {
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
      // ignore
    }
  }

  event.preventDefault()
  lastPointerClientX = event.clientX
  lastPointerClientY = event.clientY

  const nextState = updateDragOffset(state, event.clientX, event.clientY)
  if (!nextState) return

  dragState.value = nextState

  const targetId = findDropTargetAt(event.clientX, event.clientY)
  dropTargetId.value = targetId

  if (!targetId || targetId === nextState.id) {
    liveSwapPartnerId = undefined
  } else if (targetId !== liveSwapPartnerId) {
    performLiveSwap(nextState.id, targetId)
  }
}

const onDocumentPointerUp = (event: PointerEvent) => {
  const state = dragState.value
  if (!state || event.pointerId !== state.pointerId) return

  finishDrag()
}

const onItemPointerDown = (event: PointerEvent, item: GridItem) => {
  if (!props.sortable || item.sticky || event.button !== 0) return

  cancelDragRelease()
  cleanupDragListeners()

  const content = pr_adaptive_grid_content_ref.value
  const layout = getItemLayout(item.id)
  if (!content || !layout) return

  const contentRect = content.getBoundingClientRect()
  const pointerX = event.clientX - contentRect.left
  const pointerY = event.clientY - contentRect.top

  dragState.value = {
    id: item.id,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    grabOffsetX: pointerX - layout.x,
    grabOffsetY: pointerY - layout.y,
    offsetX: 0,
    offsetY: 0,
    frozenW: layout.w,
    frozenH: layout.h
  }
  dropTargetId.value = undefined
  liveSwapPartnerId = undefined
  dragStarted = false
  dragPointerTarget = event.currentTarget as HTMLElement

  document.addEventListener('pointermove', onDocumentPointerMove)
  document.addEventListener('pointerup', onDocumentPointerUp)
  document.addEventListener('pointercancel', onDocumentPointerUp)
}

const onGridClickCapture = (event: MouseEvent) => {
  if (!suppressClickAfterDrag) return
  event.stopPropagation()
  event.preventDefault()
  suppressClickAfterDrag = false
}

const StyleItemInner = (id: string): CSSProperties => {
  const isEntering = enteringItemIds.has(id)

  return {
    width: '100%',
    height: '100%',
    opacity: isEntering ? 0 : 1,
    transform: isEntering ? 'scale(0.5)' : 'scale(1)'
  }
}

const updateStickyOnScroll = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return

  const { scrollTop, scrollLeft } = container

  for (const item of props.list) {
    if (!item.sticky) {
      stickyOffsetMap.delete(item.id)
      continue
    }

    const layout = contentLayoutMap.get(item.id)
    if (!layout) continue

    // 绝对定位在滚动内容内，需加上 scroll 偏移才能在视口中保持原位（首屏 pin 不随滚动移走）
    stickyOffsetMap.set(item.id, {
      x: layout.x + scrollLeft,
      y: layout.y + scrollTop,
      w: layout.w,
      h: layout.h
    })
  }
}

let raf = 0
let layoutTransitionTimer = 0
let scrollTransitionTimer = 0

const beginLayoutTransition = () => {
  layoutTransitionActive.value = true
  window.clearTimeout(layoutTransitionTimer)
  layoutTransitionTimer = window.setTimeout(() => {
    layoutTransitionActive.value = false
  }, LAYOUT_TRANSITION_MS)
}

const playEnterAnimation = async (newItems: GridItem[]) => {
  if (!newItems.length) return

  // 先绘制 entering 初始态（opacity:0 scale:0.5）
  await nextTick()
  void pr_adaptive_grid_content_ref.value?.offsetHeight
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

  // 再切换到最终态，触发 inner 的 opacity/transform 过渡
  newItems.forEach((item) => enteringItemIds.delete(item.id))
}

const scheduleSync = (options?: { animate?: boolean }) => {
  if (dragStarted && dragState.value) {
    scheduleDragReorderSync()
    return
  }

  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    void (async () => {
      measureContainer()
      await nextTick()

      const runSync = () => {
        syncLayout()
        syncKnownItemIds()
        previousListLength.value = props.list.length
        finishInitialLayout()
      }

      const isIntroSingleItem = props.list.length === 1 && previousListLength.value === 0
      const shouldAnimate = Boolean(options?.animate && layoutInitialized.value && !isIntroSingleItem)

      if (shouldAnimate) {
        const newItems = props.list.filter((item) => !knownItemIds.has(item.id))

        if (newItems.length > 0) {
          for (const item of newItems) {
            enteringItemIds.add(item.id)
          }
          await nextTick()

          const repositionExisting = knownItemIds.size > 0
          if (repositionExisting) {
            beginLayoutTransition()
            requestAnimationFrame(() => {
              void (async () => {
                syncLayout()
                syncKnownItemIds()
                previousListLength.value = props.list.length
                finishInitialLayout()
                await playEnterAnimation(newItems)
              })()
            })
          } else {
            runSync()
            void playEnterAnimation(newItems)
          }
        } else {
          beginLayoutTransition()
          requestAnimationFrame(runSync)
        }
      } else {
        runSync()
      }
    })()
  })
}

let scrollRaf = 0
const onScroll = () => {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(updateStickyOnScroll)

  if (dragStarted) return

  scrollTransitionDisabled.value = true
  window.clearTimeout(scrollTransitionTimer)

  scrollTransitionTimer = window.setTimeout(() => {
    scrollTransitionDisabled.value = false
  }, 80)
}

let observer: ResizeObserver

onMounted(async () => {
  observer = new ResizeObserver(() => scheduleSync())
  await nextTick()
  if (pr_adaptive_grid_ref.value) observer.observe(pr_adaptive_grid_ref.value)
  if (pr_adaptive_grid_content_ref.value) observer.observe(pr_adaptive_grid_content_ref.value)
  scheduleSync()
})

watch(
  () => props.list.map((item) => item.id).join(','),
  () => {
    if (!layoutInitialized.value) return

    for (const item of props.list) {
      if (!knownItemIds.has(item.id)) {
        enteringItemIds.add(item.id)
      }
    }
  },
  { flush: 'pre' }
)

watch(
  () => ({
    list: props.list,
    cols: props.cols,
    rows: props.rows,
    gap: props.gap,
    firstScreenRowSplit: props.firstScreenRowSplit,
    stickyKey: props.list.map((item) => `${item.id}:${item.sticky}`).join(',')
  }),
  async () => {
    await nextTick()
    if (dragStarted && dragState.value) {
      scheduleDragReorderSync()
      return
    }
    scheduleSync({ animate: true })
  },
  { deep: true }
)

watch(
  () => [props.padding, props.itemHeight, containerViewportHeight.value],
  async () => {
    await nextTick()
    scheduleSync({ animate: false })
  }
)

onBeforeUnmount(() => {
  cancelDragRelease()
  finishDrag()
  cancelAnimationFrame(raf)
  cancelAnimationFrame(scrollRaf)
  window.clearTimeout(layoutTransitionTimer)
  window.clearTimeout(scrollTransitionTimer)
  window.clearTimeout(dragReleaseTimer)
  observer?.disconnect()
})
</script>

<style scoped>
/* iOS 风格缓动：位移快速启动、末端平滑减速 */
.pr-adaptive-grid {
  --ag-ease-position: cubic-bezier(0.22, 1, 0.36, 1);
  --ag-ease-size: cubic-bezier(0.32, 0.72, 0, 1);
  --ag-ease-fade: cubic-bezier(0.32, 0.72, 0, 1);
  --ag-duration-position: 800ms;
  --ag-duration-size: 600ms;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.pr-adaptive-grid::-webkit-scrollbar {
  display: none;
}
.pr-adaptive-grid-content {
  position: relative;
  box-sizing: border-box;
}
.pr-adaptive-grid-item-span {
  pointer-events: none;
  min-width: 0;
  min-height: 0;
  /* box-shadow: 0 0 1px 0 red inset; */
  z-index: 2;
}
.pr-adaptive-grid-item {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  box-sizing: border-box;
  transition:
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
  will-change: transform;
}

.pr-adaptive-grid-item-inner {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
  transition:
    transform var(--ag-duration-position) var(--ag-ease-fade),
    opacity var(--ag-duration-position) var(--ag-ease-fade);
}

.pr-adaptive-grid-item-enter-host {
  transition:
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-enter-host .pr-adaptive-grid-item-inner {
  transition:
    transform var(--ag-duration-position) var(--ag-ease-fade),
    opacity var(--ag-duration-position) var(--ag-ease-fade);
}

.pr-adaptive-grid-item-layout-anim {
  transition:
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-sticky {
  z-index: 2;
  transition:
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-sticky.pr-adaptive-grid-item-layout-anim {
  transition:
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-no-transition {
  transition: none !important;
}

.pr-adaptive-grid-item-dragging,
.pr-adaptive-grid-item-dragging.pr-adaptive-grid-item-layout-anim {
  z-index: 20;
  cursor: grabbing;
  will-change: transform;
  transition: transform 0s linear, width 0s linear, height 0s linear;
}

.pr-adaptive-grid-item-dragging-release,
.pr-adaptive-grid-item-dragging-release.pr-adaptive-grid-item-layout-anim {
  z-index: 20;
  cursor: grabbing;
  will-change: transform, width, height;
  transition:
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-sticky .pr-adaptive-grid-item-inner {
  cursor: default;
  touch-action: auto;
}

.pr-adaptive-grid-item-drop-target .pr-adaptive-grid-item-inner {
  box-shadow: inset 0 0 0 2px rgba(22, 119, 255, 0.85);
}
</style>
