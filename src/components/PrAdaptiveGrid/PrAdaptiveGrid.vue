<template>
  <div class="pr-adaptive-grid-wrapper" @pointermove="onWrapperPointerMove">
    <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" :class="{ 'is-dragging-overflow': overflowVisible }" @scroll="onScroll">
      <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle"></div>
      <PrAdaptiveGridItem
        v-for="idx in visibleIndicesWithDrag"
        :key="spanIds[idx]"
        :id="spanIds[idx]"
        :geo="ItemGeo(idx)"
        :sticky-geo="StickyGeo(spanIds[idx], idx)"
        :drag-geo="DragGeo(spanIds[idx])"
        :sticky="ItemOptions(spanIds[idx]).sticky"
        :fixed="ItemOptions(spanIds[idx]).fixed"
        :draggable="!ItemOptions(spanIds[idx]).fixed"
        :dragging="DraggingId === spanIds[idx]"
        :leaving="IsLeaving(spanIds[idx])"
        :no-enter-animation="props.noEnterAnimation || initializing || !_recentlyAddedIds.has(spanIds[idx])"
        :on-drag-start="onItemDragStart"
        :on-drag-move="onItemDragMove"
        :on-drag-end="onItemDragEnd"
        :on-leave-end="onItemLeaveEnd"
        :settling-count="settlingCount"
        :on-settling-change="onItemSettlingChange"
      >
        <template #default="slotProps">
          <slot v-bind="slotProps" />
        </template>
      </PrAdaptiveGridItem>
    </div>
    <!-- iOS 风格虚拟滚动条（在 overflow 容器外，避免被裁剪） -->
    <div class="pr-adaptive-grid-scrollbar-track" :class="{ 'is-visible': scrollbarVisible }" @pointerenter="onScrollbarEnter" @pointerleave="onScrollbarLeave" @pointerdown="onScrollbarPointerDown">
      <div class="pr-adaptive-grid-scrollbar-thumb" :style="scrollbarThumbStyle"></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import PrAdaptiveGridItem from './PrAdaptiveGridItem.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type { Geo, GetLayoutFn, GridItemOptions, GridItemsOptions, Layout, LayoutCell } from '../../types'
import { getLayout } from '../../layouts/layout.default.ts'

const props = defineProps({
  getLayout: {
    required: true,
    type: Function as PropType<GetLayoutFn>,
    default: () => getLayout
  },
  noEnterAnimation: {
    required: false,
    type: Boolean,
    default: () => false
  },
  /** 虚拟列表溢出渲染屏数 */
  overScan: {
    required: false,
    type: Number,
    default: 1
  }
})

const pr_adaptive_grid_ref = ref<HTMLElement>() // 外部容器 滚动
const pr_adaptive_grid_content_ref = ref<HTMLElement>() // 模板 ref（仅在 template 使用）
void pr_adaptive_grid_content_ref

const isReady = ref(false) // 是否准备就绪
const initializing = ref(true) // 首次初始渲染中，item 跳过入场动画
const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] }) // 仅 span 占位几何
const size = ref({ width: 0, height: 0 }) // content 尺寸（行高与位移动画时长）
const scrollTop = ref(0) // .pr-adaptive-grid 的 scrollTop，Pin 定位用
const scrollbarVisible = ref(false)
const scrollbarHover = ref(false)
const SCROLLBAR_EDGE_ZONE = 24 // px，鼠标/触摸在此距离右边缘内时显示滚动条
let _scrollbarTimer = 0
let _scrollbarDragging = false
let _scrollbarEdgeTimer = 0
let _scrollbarDragOffset = 0 // 拖拽时指针相对于滑块顶部的偏移

const showScrollbar = () => {
  scrollbarVisible.value = true
  clearTimeout(_scrollbarTimer)
}
const hideScrollbar = () => {
  if (scrollbarHover.value || _scrollbarDragging) return
  scrollbarVisible.value = false
}
const delayHideScrollbar = () => {
  clearTimeout(_scrollbarTimer)
  _scrollbarTimer = window.setTimeout(hideScrollbar, 1000)
}

const SCROLLBAR_TRACK_PAD = 10 // 与 CSS top/bottom 一致
const scrollbarThumbStyle = computed(() => {
  const el = pr_adaptive_grid_ref.value
  const totalH = totalContentHeight.value
  if (!el || totalH <= 0) return {}
  const { clientHeight } = el
  if (totalH <= clientHeight) return {}
  const p = SCROLLBAR_TRACK_PAD
  const trackH = clientHeight - p * 2
  const thumbH = Math.max(40, (clientHeight / totalH) * trackH)
  const travel = trackH - thumbH
  const thumbTop = (scrollTop.value / (totalH - clientHeight)) * travel
  return {
    height: `${thumbH}px`,
    transform: `translateY(${thumbTop}px)`
  }
})

const spanIds = ref<string[]>([]) // 当前渲染的span
const itemIds = ref<string[]>([]) // 当前渲染的item
const leavingIds = ref<string[]>([]) // 当前退场的item
const settlingCount = ref(0) // 当前正在回弹的 item 数量
const overflowVisible = ref(false) // 拖拽期间容器不裁剪溢出 item
const forcedVisibleId = ref<string | null>(null)

/** 最近通过 setItem 添加的 item id，用于入场动画判断 */
const _recentlyAddedIds = new Set<string>()

/** 列宽 */
const colWidth = computed(() => {
  const { gap, cols } = layout.value
  if (cols <= 0 || size.value.width <= 0) return 0
  return (size.value.width - (cols - 1) * gap) / cols
})

/** 总内容高度：取最后一个 item 的底部位置，不受 layout.rows 限制 */
const totalContentHeight = computed(() => {
  const geos = itemGeos.value
  if (geos.length === 0) return 0
  const last = geos[geos.length - 1]
  return last.top + last.height
})

/** 从 LayoutCell 计算像素几何 */
const computeItemGeo = (cell: LayoutCell): Geo => {
  const { gap } = layout.value
  const { x, y, w, h } = cell
  const cw = colWidth.value
  const ih = ItemHeight.value
  const left = (x - 1) * (cw + gap)
  const top = (y - 1) * (ih + gap)
  const width = w * cw + (w - 1) * gap
  const height = h * ih + (h - 1) * gap
  return { cx: left + width / 2, cy: top + height / 2, left, top, width, height }
}

/** 所有 item 的几何数据（用 for 循环代替 .map，减少大数组下函数调用开销） */
const itemGeos = computed(() => {
  const cells = layout.value.items
  const n = cells.length
  const result = new Array<Geo>(n)
  for (let i = 0; i < n; i++) {
    result[i] = computeItemGeo(cells[i])
  }
  return result
})

/** 当前可见的 item 原始索引（含 overScan 缓冲）。二分查找 + 局部扫描，避免全量遍历。 */
const visibleIndices = computed(() => {
  const geos = itemGeos.value
  const n = geos.length
  if (n === 0) return []

  const viewH = pr_adaptive_grid_ref.value?.clientHeight ?? size.value.height
  const rangeStart = scrollTop.value - props.overScan * viewH
  const rangeEnd = scrollTop.value + viewH + props.overScan * viewH

  // 二分：第一个 top > rangeStart 的 item
  let lo = 0,
    hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (geos[mid].top < rangeStart) lo = mid + 1
    else hi = mid
  }
  const scanStart = Math.max(0, lo - 20) // 回退一行，防止前一行大高度 item 漏掉

  // 二分：第一个 top > rangeEnd 的 item
  lo = 0
  hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (geos[mid].top <= rangeEnd) lo = mid + 1
    else hi = mid
  }
  const scanEnd = lo

  // 只在 scanStart~scanEnd 范围内做完整判断，通常几十个 item
  const result: number[] = []
  for (let i = scanStart; i < scanEnd; i++) {
    const geo = geos[i]
    if (geo.top + geo.height >= rangeStart && geo.top <= rangeEnd) {
      result.push(i)
    }
  }
  return result
})

/** visibleIndices + 强制包含拖拽中的 item（过滤越界索引） */
const visibleIndicesWithDrag = computed(() => {
  const set = new Set(visibleIndices.value)
  if (forcedVisibleId.value) {
    const idx = spanIds.value.indexOf(forcedVisibleId.value)
    if (idx !== -1) set.add(idx)
  }
  const max = spanIds.value.length
  return [...set].filter((i) => i >= 0 && i < max).sort((a, b) => a - b)
})

type StoredItemOptions = Required<GridItemsOptions>

const DEFAULT_ITEM_OPTIONS: StoredItemOptions = { sticky: false, fixed: false }
const itemOptionsById = ref(new Map<string, StoredItemOptions>()) // 每个 item 的 sticky/fixed 状态

/** 只合并显式传入的 sticky / fixed，避免 index 或 undefined 覆盖已有状态。 */
const normalizeItemOptions = (options?: GridItemsOptions): Partial<StoredItemOptions> => {
  const next: Partial<StoredItemOptions> = {}
  if (typeof options?.sticky === 'boolean') next.sticky = options.sticky
  if (typeof options?.fixed === 'boolean') next.fixed = options.fixed
  return next
}

/** 写入或合并指定 item 的状态；未传入任何选项时跳过，避免无谓的对象创建。 */
const setItemOptions = (id: string, options?: GridItemsOptions) => {
  const merged = normalizeItemOptions(options)
  if (Object.keys(merged).length === 0) return
  const current = itemOptionsById.value.get(id) ?? DEFAULT_ITEM_OPTIONS
  itemOptionsById.value.set(id, { ...current, ...merged })
}

/** 清理已经不再存在的 item 状态，避免 remove / setItems 后残留旧配置。 */
const pruneItemOptions = (activeIds: string[]) => {
  const activeIdSet = new Set(activeIds)
  for (const id of itemOptionsById.value.keys()) {
    if (!activeIdSet.has(id)) itemOptionsById.value.delete(id)
  }
}

type DragState = {
  id: string
  startPointer: {
    x: number
    y: number
  }
  startGeo: Geo
  currentCenter: {
    x: number
    y: number
  }
  fromIndex: number
  overIndex: number
}

const dragState = ref<DragState>()
const SYNC_LAYOUT_DRAG_INTERVAL_MS = 300
let syncLayoutToken = 0
let syncLayoutDragTimerId = 0
let syncLayoutLastDragRunAt = 0
let syncLayoutQueued = false
let syncLayoutResolvers: Array<() => void> = []

/** 同步 spanIds 到 itemIds */
const getSpanGeos = async () => {
  itemIds.value = [...spanIds.value]
}

/** item 退场动画完成后，真正从 span / item 列表中移除。 */
const onItemLeaveEnd = (id: string) => {
  const leavingIndex = leavingIds.value.indexOf(id)
  // 已经被 setItem 复活了，忽略这次退场完成回调
  if (leavingIndex === -1) return
  if (dragState.value?.id === id) {
    dragState.value = undefined
    maybeRestoreOverflow()
  }
  leavingIds.value.splice(leavingIndex, 1)
  const spanIndex = spanIds.value.indexOf(id)
  if (spanIndex !== -1) spanIds.value.splice(spanIndex, 1)
  const itemIndex = itemIds.value.indexOf(id)
  if (itemIndex !== -1) itemIds.value.splice(itemIndex, 1)
  itemOptionsById.value.delete(id)
}

/** 跟踪 item 回弹状态变化，维护 settlingCount。 */
const onItemSettlingChange = (_id: string, isSettling: boolean) => {
  settlingCount.value += isSettling ? 1 : -1
  maybeRestoreOverflow()
}

/** 拖拽结束且所有 item 回弹完成后，恢复容器 overflow，避免拖出网格的 item 被裁剪。 */
const maybeRestoreOverflow = () => {
  if (!dragState.value && settlingCount.value <= 0) overflowVisible.value = false
}

/** 按渲染下标返回 item 对应的几何 */
const DEFAULT_GEO: Geo = { cx: 0, cy: 0, left: 0, top: 0, width: 0, height: 0 }
const ItemGeo = computed(() => {
  return (index: number) => itemGeos.value[index] ?? DEFAULT_GEO
})

/** sticky 只调整视觉位置，不改 spanGeos / spanIds 的真实占位。 */
const StickyGeo = computed(() => {
  return (id: string, index: number) => {
    if (!ItemOptions.value(id).sticky) return undefined
    if (DraggingId.value === id) return undefined

    const geo = itemGeos.value[index]
    if (!geo) return undefined

    const viewportHeight = pr_adaptive_grid_ref.value?.clientHeight ?? size.value.height
    if (viewportHeight <= 0) return geo

    const minCenterY = scrollTop.value + geo.height / 2
    const maxCenterY = scrollTop.value + Math.max(geo.height / 2, viewportHeight - geo.height / 2)
    const stickyCy = Math.min(Math.max(geo.cy, minCenterY), maxCenterY)

    return {
      ...geo,
      top: stickyCy - geo.height / 2,
      cy: stickyCy
    }
  }
})

/** 布局重算 key：容器尺寸或 span 数量变化时触发重新计算。 */
const LayoutKey = computed(() => {
  const { width, height } = size.value
  const key = `${width}-${height}-${spanIds.value.length}`
  return key
})

/** 判断指定 item 是否正在退场。 */
const IsLeaving = computed(() => {
  return (id: string) => leavingIds.value.includes(id)
})

/** 读取指定 item 的 sticky / fixed 状态，未设置时返回默认状态。 */
const ItemOptions = computed(() => {
  return (id: string): StoredItemOptions => itemOptionsById.value.get(id) ?? DEFAULT_ITEM_OPTIONS
})

/** 判断 item 是否固定；固定 item 不可被拖动，也不作为拖拽落点。 */
const IsFixedItem = (id?: string) => {
  if (id === undefined) return false
  return itemOptionsById.value.get(id)?.fixed ?? DEFAULT_ITEM_OPTIONS.fixed
}

const IsFixedSpanIndex = (index: number) => IsFixedItem(spanIds.value[index])

/** 当前正在拖拽的 item id。 */
const DraggingId = computed(() => dragState.value?.id)

/** 根据拖拽中心点生成临时 geo，让拖拽项直接跟随指针。 */
const DragGeo = computed(() => {
  return (id: string) => {
    const state = dragState.value
    if (!state || state.id !== id) return undefined

    const dx = state.currentCenter.x - state.startGeo.cx
    const dy = state.currentCenter.y - state.startGeo.cy
    return {
      ...state.startGeo,
      cx: state.currentCenter.x,
      cy: state.currentCenter.y,
      left: state.startGeo.left + dx,
      top: state.startGeo.top + dy
    }
  }
})

/** 真正执行布局同步；token 用来丢弃过期异步结果。 */
const executeSyncLayout = async () => {
  if (isReady.value === false) return

  const token = ++syncLayoutToken
  layout.value = props.getLayout(spanIds.value.length)
  await nextTick()
  if (token !== syncLayoutToken) return
  await getSpanGeos()
  _recentlyAddedIds.clear()
  if (initializing.value) {
    await nextTick()
    initializing.value = false
  }
}

const resolveSyncLayoutWaiters = () => {
  const resolvers = syncLayoutResolvers
  syncLayoutResolvers = []
  resolvers.forEach((resolve) => resolve())
}

const runQueuedSyncLayout = async () => {
  if (!syncLayoutQueued) return
  syncLayoutQueued = false
  await executeSyncLayout()
  resolveSyncLayoutWaiters()
}

const cancelScheduledSyncLayout = () => {
  if (syncLayoutDragTimerId) {
    clearTimeout(syncLayoutDragTimerId)
    syncLayoutDragTimerId = 0
  }
}

/** 拖拽中：约每 100ms 最多执行一次布局同步。 */
const scheduleSyncLayoutDrag = () => {
  if (syncLayoutDragTimerId) return

  const elapsed = Date.now() - syncLayoutLastDragRunAt
  const delay = Math.max(0, SYNC_LAYOUT_DRAG_INTERVAL_MS - elapsed)

  syncLayoutDragTimerId = window.setTimeout(async () => {
    syncLayoutDragTimerId = 0
    syncLayoutLastDragRunAt = Date.now()
    await runQueuedSyncLayout()
    if (syncLayoutQueued) scheduleSyncLayoutDrag()
  }, delay)
}

/**
 * 重新计算布局并在 DOM 更新后刷新 span 几何。
 * @param duringDrag 拖拽移动触发的重排，使用 100ms 节流；非拖拽直接同步执行。
 */
const syncLayout = (duringDrag = false) => {
  syncLayoutQueued = true
  return new Promise<void>((resolve) => {
    syncLayoutResolvers.push(resolve)
    if (duringDrag) {
      scheduleSyncLayoutDrag()
      return
    }
    // 非拖拽：立即执行，避免 spanIds 已变但 layout 未更新导致 visibleIndices 不同步
    runQueuedSyncLayout().then(resolve)
  })
}

/** 拖拽换位后，让 sticky / fixed 跟随槽位而不是跟随 id。 */
const applySlotOptionsAfterReorder = (prevSpanIds: string[], nextSpanIds: string[]) => {
  const prevSlotOptions = prevSpanIds.map((spanId) => itemOptionsById.value.get(spanId) ?? DEFAULT_ITEM_OPTIONS)
  const nextOptions = new Map(itemOptionsById.value)

  nextSpanIds.forEach((spanId, index) => {
    nextOptions.set(spanId, { ...prevSlotOptions[index] })
  })

  itemOptionsById.value = nextOptions
}

/** 将指定 id 移动到目标 span 下标，返回是否真的发生了排序变化。 */
const moveSpanId = (id: string, toIndex: number) => {
  const fromIndex = spanIds.value.indexOf(id)
  if (fromIndex === -1) return false

  const targetIndex = Math.max(0, Math.min(toIndex, spanIds.value.length - 1))
  if (fromIndex === targetIndex) return false
  if (IsFixedItem(id) || IsFixedSpanIndex(targetIndex)) return false

  const prevSpanIds = [...spanIds.value]

  const fixedSlots = new Map<number, string>()
  spanIds.value.forEach((spanId, index) => {
    if (spanId !== id && IsFixedItem(spanId)) fixedSlots.set(index, spanId)
  })

  const movableSlotIndexes = spanIds.value.map((_, index) => index).filter((index) => !fixedSlots.has(index))
  const targetMovableIndex = movableSlotIndexes.indexOf(targetIndex)
  if (targetMovableIndex === -1) return false

  const movableIds = movableSlotIndexes.map((index) => spanIds.value[index]).filter((spanId) => spanId !== id)
  movableIds.splice(targetMovableIndex, 0, id)

  const nextSpanIds = [...spanIds.value]
  movableSlotIndexes.forEach((slotIndex, index) => {
    nextSpanIds[slotIndex] = movableIds[index]
  })
  spanIds.value = nextSpanIds
  applySlotOptionsAfterReorder(prevSpanIds, nextSpanIds)
  return true
}

/** 根据拖拽 item 的视觉中心点，寻找距离最近的 span 槽位。 */
const getNearestSpanIndex = (center: { x: number; y: number }, fallbackIndex: number) => {
  let nearestIndex = fallbackIndex
  let nearestScore = Number.POSITIVE_INFINITY

  itemGeos.value.forEach((geo, index) => {
    const id = spanIds.value[index]
    // 正在退场的 item 不参与拖拽目标判断，避免拖到即将移除的槽位。
    if (id !== undefined && leavingIds.value.includes(id)) return
    if (IsFixedItem(id)) return

    // 用平方距离比较即可，不需要开方，结果排序一致且计算更轻。
    const dx = center.x - geo.cx
    const dy = center.y - geo.cy
    const score = dx * dx + dy * dy
    if (score >= nearestScore) return

    nearestIndex = index
    nearestScore = score
  })

  return nearestIndex
}

/** 根据当前 pointer 位置刷新拖拽中心点，并在跨槽位时调整 spanIds 顺序。 */
const updateDragStateFromPointer = (state: DragState, event: PointerEvent) => {
  const dx = event.clientX - state.startPointer.x
  const dy = event.clientY - state.startPointer.y
  const currentCenter = { x: state.startGeo.cx + dx, y: state.startGeo.cy + dy }
  const overIndex = getNearestSpanIndex(currentCenter, state.overIndex)
  const didReorder = overIndex !== state.overIndex && moveSpanId(state.id, overIndex)
  const nextState = { ...state, currentCenter, overIndex }
  dragState.value = nextState

  return { didReorder }
}

/** 开始拖拽：记录指针起点、item 初始 geo 与原始下标。 */
const onItemDragStart = (id: string, event: PointerEvent) => {
  if (IsFixedItem(id)) return

  const fromIndex = itemIds.value.indexOf(id)
  const startGeo = fromIndex === -1 ? undefined : itemGeos.value[fromIndex]
  if (!startGeo) return

  forcedVisibleId.value = id // 虚拟模式下确保拖拽 item 始终渲染
  event.preventDefault()
  overflowVisible.value = true // 拖拽期间不裁剪，让拖出网格的 item 完整显示
  dragState.value = { id, startPointer: { x: event.clientX, y: event.clientY }, startGeo, currentCenter: { x: startGeo.cx, y: startGeo.cy }, fromIndex, overIndex: fromIndex }
}

/** 拖拽移动：更新临时 geo，并在目标槽位变化时让其他 item 补位。 */
const onItemDragMove = (id: string, event: PointerEvent) => {
  const state = dragState.value
  if (!state || state.id !== id) return

  event.preventDefault()
  const { didReorder } = updateDragStateFromPointer(state, event)
  if (didReorder) void syncLayout(true)
}

/** 结束拖拽：先落位并立刻清 dragState 触发回弹，再异步同步布局。 */
const onItemDragEnd = async (id: string, event: PointerEvent) => {
  const state = dragState.value
  if (!state || state.id !== id) return
  event.preventDefault()

  updateDragStateFromPointer(state, event)
  dragState.value = undefined
  forcedVisibleId.value = null
  await syncLayout()
}

// 布局受外部变量实时变化。
watch(
  () => LayoutKey.value,
  () => syncLayout(),
  {}
)

/** Grid 容器的列、行、间距样式（虚拟模式直接用 content 容器撑高度） */
/** content 容器撑开滚动高度 */
const ContainerStyle = computed(() => {
  return { height: `${totalContentHeight.value}px` }
})

/**
 * 虚拟模式行高：基于「视口内目标行数」计算，不随总行数变化。
 * 去掉最小 60px 保底，行高随容器自适应填满可视区，
 * 避免矮容器下多行布局（如 lecture 的 11 行）内容溢出出现滚动条、item 被拉成竖条。
 */
const VIRTUAL_TARGET_ROWS = 12
const ItemHeight = computed(() => {
  const { gap, rows } = layout.value
  const { height } = size.value
  const targetRows = Math.min(rows, VIRTUAL_TARGET_ROWS)
  if (targetRows <= 0) return 0
  // 向下取整并防负值：保证总内容高度不超过可视高度，不产生多余滚动条
  return Math.max(0, Math.floor((height - (targetRows - 1) * gap) / targetRows))
})

/** 计算跳过 fixed item 后的实际插入下标 */
/**
 * 在非 fixed 序列的第 index 位插入 id，fixed item 保持原索引不动。
 * 返回新的 spanIds 数组。
 */
const insertNonFixedId = (ids: string[], targetId: string, index: number): string[] => {
  // 记录每个 fixed item 的原始索引
  const fixedSlots = new Map<number, string>()
  ids.forEach((id, i) => {
    if (IsFixedItem(id)) fixedSlots.set(i, id)
  })
  // 非 fixed 序列
  const nonFixed = ids.filter((id) => !IsFixedItem(id))
  // 在指定位置插入
  nonFixed.splice(index, 0, targetId)
  // 重建：fixed 保持原槽位，非 fixed 按顺序填充
  const result: string[] = []
  let nfIdx = 0
  for (let i = 0; i < ids.length + 1; i++) {
    if (fixedSlots.has(i)) {
      result.push(fixedSlots.get(i)!)
    } else {
      result.push(nonFixed[nfIdx++])
    }
  }
  return result
}

/** 新增或更新 item；id 已存在时仅合并传入的 options */
const setItem = (id: string, options?: GridItemOptions) => {
  setItemOptions(id, options)
  const { index = 0 } = options ?? {}
  const isFixed = options?.fixed === true
  const leavingIndex = leavingIds.value.indexOf(id)
  // 情况 1：这个 id 正在退场，说明业务层又把它加回来了
  if (leavingIndex !== -1) {
    leavingIds.value.splice(leavingIndex, 1)
    _recentlyAddedIds.add(id)
    if (spanIds.value.includes(id)) {
      return
    }
    if (isFixed) {
      spanIds.value.push(id)
    } else {
      spanIds.value = insertNonFixedId(spanIds.value, id, index)
    }
    return
  }
  // 情况 2：已经存在，避免重复添加
  if (spanIds.value.includes(id)) {
    return
  }
  // 情况 3：真正的新 item
  _recentlyAddedIds.add(id)
  if (isFixed) {
    spanIds.value.push(id)
  } else {
    spanIds.value = insertNonFixedId(spanIds.value, id, index)
  }
}

/** 按 ids 一次性设置 */
const setItems = (ids: string[], options?: GridItemsOptions) => {
  const nextIds = [...ids]
  spanIds.value = [...nextIds]
  leavingIds.value = []
  pruneItemOptions(nextIds)
  if (options !== undefined) {
    nextIds.forEach((id) => setItemOptions(id, options))
  }
  void syncLayout()
}

/** 移除 item 并重算布局 */
const removeItems = (removeIds: string[]) => {
  for (const id of removeIds) {
    if (!spanIds.value.includes(id)) continue
    if (leavingIds.value.includes(id)) continue
    leavingIds.value.push(id)
  }
}

/** 记录滚动偏移，显示虚拟滚动条并在停止后自动隐藏 */
const onScroll = () => {
  const el = pr_adaptive_grid_ref.value
  if (!el) return
  scrollTop.value = el.scrollTop
  if (totalContentHeight.value > el.clientHeight) {
    showScrollbar()
    delayHideScrollbar()
  }
}

/** 鼠标进入滚动条区域 → 保持显示 */
const onScrollbarEnter = () => {
  scrollbarHover.value = true
  if (totalContentHeight.value > (pr_adaptive_grid_ref.value?.clientHeight ?? 0)) {
    showScrollbar()
  }
}
/** 鼠标离开滚动条区域 → 恢复自动隐藏 */
const onScrollbarLeave = () => {
  scrollbarHover.value = false
  if (!_scrollbarDragging) delayHideScrollbar()
}

/** 鼠标/触摸在 wrapper 上移动：检测是否靠近右边缘以显示滚动条 */
const onWrapperPointerMove = (e: PointerEvent) => {
  if (_scrollbarDragging) return
  const el = pr_adaptive_grid_ref.value
  if (!el || totalContentHeight.value <= el.clientHeight) return
  const rect = el.getBoundingClientRect()
  const dist = rect.right - e.clientX
  if (dist >= 0 && dist <= SCROLLBAR_EDGE_ZONE) {
    showScrollbar()
    clearTimeout(_scrollbarEdgeTimer)
  } else {
    // 离开边缘区域后延迟隐藏（给短暂离开再回来的缓冲）
    if (!scrollbarHover.value && !_scrollbarDragging) {
      clearTimeout(_scrollbarEdgeTimer)
      _scrollbarEdgeTimer = window.setTimeout(() => {
        if (!scrollbarHover.value && !_scrollbarDragging) delayHideScrollbar()
      }, 300)
    }
  }
}

/** 开始拖拽滚动条 */
const onScrollbarPointerDown = (e: PointerEvent) => {
  const el = pr_adaptive_grid_ref.value
  const totalH = totalContentHeight.value
  if (!el || totalH <= el.clientHeight) return
  e.preventDefault()

  const { top, height } = el.getBoundingClientRect()
  const p = SCROLLBAR_TRACK_PAD
  const clickY = e.clientY - top - p // 相对于轨道顶部的 Y
  const trackH = height - p * 2
  const scrollRange = totalH - el.clientHeight
  const thumbH = Math.max(40, (el.clientHeight / totalH) * trackH)
  const travel = trackH - thumbH
  const currentThumbTop = (scrollTop.value / scrollRange) * travel

  if (clickY >= currentThumbTop && clickY <= currentThumbTop + thumbH) {
    // 点在滑块上 → 记录指针相对滑块顶部的偏移，不跳转位置
    _scrollbarDragOffset = clickY - currentThumbTop
  } else {
    // 点在轨道上 → 跳到点击位置（以滑块中心为拖拽起点）
    const ratio = travel > 0 ? Math.max(0, Math.min((clickY - thumbH / 2) / travel, 1)) : 0
    el.scrollTop = ratio * scrollRange
    scrollTop.value = el.scrollTop
    _scrollbarDragOffset = thumbH / 2
  }

  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  _scrollbarDragging = true
}

/** 拖拽中 pointermove */
const onScrollbarPointerMove = (e: PointerEvent) => {
  if (!_scrollbarDragging) return
  const el = pr_adaptive_grid_ref.value
  const totalH = totalContentHeight.value
  if (!el || totalH <= el.clientHeight) return

  const { top, height } = el.getBoundingClientRect()
  const p = SCROLLBAR_TRACK_PAD
  const trackH = height - p * 2
  const thumbH = Math.max(40, (el.clientHeight / totalH) * trackH)
  const travel = trackH - thumbH
  const pointerY = e.clientY - top - p - _scrollbarDragOffset
  const ratio = travel > 0 ? Math.max(0, Math.min(pointerY / travel, 1)) : 0
  el.scrollTop = ratio * (totalH - el.clientHeight)
  scrollTop.value = el.scrollTop
}

/** 拖拽结束 pointerup */
const onScrollbarPointerUp = () => {
  if (!_scrollbarDragging) return
  _scrollbarDragging = false
  if (!scrollbarHover.value) delayHideScrollbar()
}

let observer: ResizeObserver // 监听 content 容器尺寸变化
let resizeTimer = 0 // resize debounce 定时器

/** 挂载后监听 content 容器尺寸变化 */
onMounted(async () => {
  await nextTick()
  onScroll()

  let _size = { width: 0, height: 0 }

  observer = new ResizeObserver((sizes) => {
    const [{ contentRect }] = sizes
    const { width, height } = contentRect
    _size = { width, height }
    /** 写入最新容器尺寸，驱动 LayoutKey 变化后重算布局。 */
    const setSize = () => {
      size.value = _size
    }
    if (isReady.value === false) {
      isReady.value = true
      return setSize()
    }
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(setSize, 50) // 节流
  })
  // 全局 pointermove/up 监听拖拽
  document.addEventListener('pointermove', onScrollbarPointerMove)
  document.addEventListener('pointerup', onScrollbarPointerUp)
  if (pr_adaptive_grid_ref.value) observer.observe(pr_adaptive_grid_ref.value)
})

/** 卸载时断开监听并清理定时器 */
onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onScrollbarPointerMove)
  document.removeEventListener('pointerup', onScrollbarPointerUp)
  observer?.disconnect()
  if (resizeTimer) clearTimeout(resizeTimer)
  cancelScheduledSyncLayout()
  syncLayoutQueued = false
  resolveSyncLayoutWaiters()
})

defineExpose({
  setItem,
  setItems,
  removeItems
})
</script>

<style scoped>
.pr-adaptive-grid-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
.pr-adaptive-grid {
  --ag-ease-position: cubic-bezier(0.22, 1, 0.44, 1);
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
/* 拖拽期间临时改为 visible，让拖出网格的 item 完整显示，不被滚动容器裁剪 */
.pr-adaptive-grid.is-dragging-overflow {
  overflow: visible;
}
.pr-adaptive-grid::-webkit-scrollbar {
  display: none;
}
.pr-adaptive-grid-content {
  position: relative;
  box-sizing: border-box;
  width: 100%;
}

/* ── iOS 风格虚拟滚动条 ── */
.pr-adaptive-grid-scrollbar-track {
  position: absolute;
  top: 10px;
  right: 4px;
  bottom: 10px;
  width: 8px;
  z-index: 100;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.25s ease,
    background 0.2s ease,
    width 0.2s ease;
  touch-action: none;
  border-radius: 5px;
}
.pr-adaptive-grid-scrollbar-track.is-visible {
  opacity: 1;
}
.pr-adaptive-grid-scrollbar-track:hover {
  background: rgba(20, 20, 20, 0.2);
  width: 16px;
  /* right: 0; */
  border-radius: 8px;
}
.pr-adaptive-grid-scrollbar-thumb {
  width: 100%;
  border-radius: 6px;
  background: rgba(20, 20, 20, 0.6);
  will-change: transform;
  transition:
    background 0.2s ease,
    border-radius 0.2s ease;
  align-self: flex-start;
  flex-shrink: 0;
  backdrop-filter: blur(20px);
}
.pr-adaptive-grid-scrollbar-track:hover .pr-adaptive-grid-scrollbar-thumb {
  background: rgba(20, 20, 20, 0.5);
  border-radius: 8px;
}
</style>
