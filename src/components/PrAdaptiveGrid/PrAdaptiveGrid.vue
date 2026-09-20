<template>
  <div class="pr-adaptive-grid-wrapper" @pointermove="onWrapperPointerMove">
    <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" @scroll="onScroll">
      <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle"></div>
      <PrAdaptiveGridItem
        v-for="idx in visibleIndicesWithDrag"
        :key="spanIds[idx]"
        :id="spanIds[idx]"
        :geo="ItemGeo(idx)"
        :scroll-el="pr_adaptive_grid_ref ?? null"
        :sticky-geo="StickyGeo(spanIds[idx], idx)"
        :drag-geo="DragGeo(spanIds[idx])"
        :sticky="ItemOptions(spanIds[idx]).sticky"
        :fixed="ItemOptions(spanIds[idx]).fixed"
        :draggable="!ItemOptions(spanIds[idx]).fixed"
        :dragging="DraggingId === spanIds[idx]"
        :leaving="IsLeaving(spanIds[idx])"
        :no-enter-animation="skipEnterBatch || !_recentlyAddedIds.has(spanIds[idx])"
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
import type { Geo, GridItemInput, GridItemsOptions, Layout, LayoutCell, LayoutFactory, ResizeHandler, SetLayoutOptions } from '../../types'
import { getLayout as defaultLayout } from '../../layouts/layout.pc-speaker.ts'

const pr_adaptive_grid_ref = ref<HTMLElement>() // 外部容器 滚动
const pr_adaptive_grid_content_ref = ref<HTMLElement>() // 模板 ref（仅在 template 使用）
void pr_adaptive_grid_content_ref

const isReady = ref(false) // 是否准备就绪
const layoutFactory = ref<LayoutFactory>(defaultLayout) // 当前布局工厂，外部通过 setLayout 替换
const layoutVersion = ref(0) // 工厂被替换时自增，驱动 LayoutKey 变化后重算
const overScan = ref(1) // 虚拟列表溢出渲染屏数
const skipEnterBatch = ref(false) // 本批新增项是否跳过入场动画；渲染完成后自动恢复
let resizeHandler: ResizeHandler | undefined // 尺寸变化回调（覆盖式，只保留最后一个）
const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] }) // 仅 span 占位几何
const size = ref({ width: 0, height: 0 }) // content 尺寸（行高与位移动画时长）
const scrollTop = ref(0) // .pr-adaptive-grid 的 scrollTop，Sticky 定位用
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
const leavingIds = ref<string[]>([]) // 当前退场的item
const settlingCount = ref(0) // 当前正在回弹的 item 数量
const forcedVisibleId = ref<string | null>(null)

/** 最近通过 setItem 添加的 item id，用于入场动画判断 */
const _recentlyAddedIds = new Set<string>()

/** 列宽 */
const colWidth = computed(() => {
  const { gap, cols } = layout.value
  if (cols <= 0 || size.value.width <= 0) return 0
  return (size.value.width - (cols - 1) * gap) / cols
})

/** 总内容高度：取所有 item 底部的最大值，不受 layout.rows 限制。
 *  不能用「数组最后一个 item」—— layout.items 的顺序不保证按行递增，
 *  末位 item 若不在最低行，容器就会少算高度，底部直接露出黑边。 */
const totalContentHeight = computed(() => {
  const geos = itemGeos.value
  let bottom = 0
  for (let i = 0; i < geos.length; i++) {
    const itemBottom = geos[i].top + geos[i].height
    if (itemBottom > bottom) bottom = itemBottom
  }
  return bottom
})

/** 第 y 行（1 起）的顶部偏移：前 extra 行各多占 1px */
const rowTop = (y: number): number => {
  const { base, extra, gap } = RowMetrics.value
  return (y - 1) * (base + gap) + Math.min(y - 1, extra)
}

/** 第 y 行起跨 h 行的格子高度：只把落在跨度内的补足像素算进来 */
const rowSpanHeight = (y: number, h: number): number => {
  const { base, extra, gap } = RowMetrics.value
  const extraBefore = Math.min(y - 1, extra)
  const extraAfter = Math.min(y + h - 1, extra)
  return h * base + (h - 1) * gap + Math.max(0, extraAfter - extraBefore)
}

/** 从 LayoutCell 计算像素几何 */
const computeItemGeo = (cell: LayoutCell): Geo => {
  const { gap } = layout.value
  const { x, y, w, h } = cell
  const cw = colWidth.value
  const left = (x - 1) * (cw + gap)
  const top = rowTop(y)
  const width = w * cw + (w - 1) * gap
  const height = rowSpanHeight(y, h)
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

/**
 * 按 top 升序排列的 item 下标 + 最大格子高度。
 * 虚拟窗口靠二分查找定位可视范围，而 layout.items 的顺序不保证按 top 递增
 * （如 pc-speaker 的 n=10 依次是 1,5,1,1,3,3,8,8,10,10 行），
 * 直接在原数组上二分会把整行 item 判成不可见 —— 底部空出一条黑边。
 */
const geoOrder = computed(() => {
  const geos = itemGeos.value
  const order = geos.map((_, i) => i)
  order.sort((a, b) => geos[a].top - geos[b].top)
  let maxHeight = 0
  for (let i = 0; i < geos.length; i++) {
    if (geos[i].height > maxHeight) maxHeight = geos[i].height
  }
  return { order, maxHeight }
})

/** 当前可见的 item 原始索引（含 overScan 缓冲）。在有序下标上二分 + 局部扫描，避免全量遍历。 */
const visibleIndices = computed(() => {
  const geos = itemGeos.value
  const n = geos.length
  if (n === 0) return []
  if (overScan.value < 0) return Array.from({ length: n }, (_, i) => i) // 负数禁用虚拟列表

  const { order, maxHeight } = geoOrder.value
  const viewH = pr_adaptive_grid_ref.value?.clientHeight ?? size.value.height
  const rangeStart = scrollTop.value - overScan.value * viewH
  const rangeEnd = scrollTop.value + viewH + overScan.value * viewH

  // 二分：第一个 top >= rangeStart 的 item
  let lo = 0,
    hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (geos[order[mid]].top < rangeStart) lo = mid + 1
    else hi = mid
  }
  // 起点回退：跨多行的大格顶部在 rangeStart 之前，但底部压在可视区内
  let scanStart = lo
  while (scanStart > 0 && geos[order[scanStart - 1]].top + maxHeight >= rangeStart) scanStart--

  // 二分：第一个 top > rangeEnd 的 item
  lo = 0
  hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (geos[order[mid]].top <= rangeEnd) lo = mid + 1
    else hi = mid
  }
  const scanEnd = lo

  // 只在 scanStart~scanEnd 范围内做完整判断，通常几十个 item
  const result: number[] = []
  for (let i = scanStart; i < scanEnd; i++) {
    const index = order[i]
    const geo = geos[index]
    if (geo.top + geo.height >= rangeStart && geo.top <= rangeEnd) {
      result.push(index)
    }
  }
  result.sort((a, b) => a - b) // 还原原始下标顺序，避免渲染顺序随滚动抖动
  return result
})

/** visibleIndices + 强制渲染集合（过滤越界索引）。
 *  sticky item 永久渲染，不受虚拟窗口排除：
 *  否则滚动后 sticky item 被卸载/重建，吸附位置与层级会错乱。 */
const visibleIndicesWithDrag = computed(() => {
  const set = new Set(visibleIndices.value)
  if (forcedVisibleId.value) {
    const idx = spanIds.value.indexOf(forcedVisibleId.value)
    if (idx !== -1) set.add(idx)
  }
  // sticky 不参与动态渲染排除，始终加入渲染集合
  spanIds.value.forEach((id, i) => {
    if (itemOptionsById.value.get(id)?.sticky) set.add(i)
  })
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
let lastSyncedLayoutKey = '' // 最近一次真正执行过布局计算的 LayoutKey，用于跳过重复计算

/** 拖拽期间缓存的容器视口信息（left / top / clientHeight）。
 *  拖拽渲染里逐 item 读 getBoundingClientRect 会强制同步布局，
 *  内容复杂 + 低性能设备时是拖拽卡顿/闪烁的主要来源，缓存后拖拽几何变纯计算。 */
let _dragViewport: { left: number; top: number; clientHeight: number } | undefined

/** 刷新拖拽期容器视口缓存；容器不存在时保持旧值 */
const refreshDragViewport = () => {
  const el = pr_adaptive_grid_ref.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  _dragViewport = { left: rect.left, top: rect.top, clientHeight: el.clientHeight }
}

/** item 退场动画完成后，真正从 span / item 列表中移除。 */
const onItemLeaveEnd = (id: string) => {
  const leavingIndex = leavingIds.value.indexOf(id)
  // 已经被 setItem 复活了，忽略这次退场完成回调
  if (leavingIndex === -1) return
  if (dragState.value?.id === id) {
    dragState.value = undefined
  }
  leavingIds.value.splice(leavingIndex, 1)
  const spanIdIndex = spanIds.value.indexOf(id)
  itemOptionsById.value.delete(id)
  if (spanIdIndex === -1) return

  // 先记下移除前各 fixed item 的槽位：splice 之后它们会整体前移，
  // 事后再读 spanIds 拿到的是「已经前移过的」下标，按那个保位等于没保。
  const fixedSlotBefore = new Map<string, number>()
  spanIds.value.forEach((spanId, index) => {
    if (index === spanIdIndex || !IsFixedItem(spanId)) return
    fixedSlotBefore.set(spanId, index)
  })

  spanIds.value.splice(spanIdIndex, 1)
  reorderKeepingFixedSlots(fixedSlotBefore)
}

/** 跟踪 item 回弹状态变化，维护 settlingCount。 */
const onItemSettlingChange = (_id: string, isSettling: boolean) => {
  settlingCount.value += isSettling ? 1 : -1
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

    // 拖拽中用缓存的 clientHeight，避免 render 里逐 item 触发同步布局
    const viewportHeight = (dragState.value ? _dragViewport?.clientHeight : undefined) ?? pr_adaptive_grid_ref.value?.clientHeight ?? size.value.height
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

/** 布局重算 key：容器尺寸、span 数量或布局工厂版本变化时触发重新计算。 */
const LayoutKey = computed(() => {
  const { width, height } = size.value
  const key = `${width}-${height}-${spanIds.value.length}-${layoutVersion.value}`
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

/**
 * 移除 item 之后重新平衡顺序：fixed item 回到移除前的槽位，其余 item 按原相对顺序填满剩余空位。
 * 不做这步的话，`spanIds.splice` 会让被移除项之后的所有 item 整体前移一格，fixed item 也跟着挪，
 * 与「锁定槽位」的语义直接冲突。
 * @param fixedSlotBefore 移除**之前**记录的各 fixed item 槽位快照
 */
const reorderKeepingFixedSlots = (fixedSlotBefore: Map<string, number>) => {
  const ids = spanIds.value
  const total = ids.length
  if (total === 0 || fixedSlotBefore.size === 0) return

  const slots = new Array<string | undefined>(total)
  const pinned = new Set<string>()

  // fixed 先按移除前的槽位占位；越界（原本在末尾、总数变小）或撞车的往前找最近空位
  fixedSlotBefore.forEach((slotBefore, id) => {
    if (!ids.includes(id)) return
    let pos = Math.min(slotBefore, total - 1)
    while (pos > 0 && slots[pos] !== undefined) pos -= 1
    if (slots[pos] !== undefined) return
    slots[pos] = id
    pinned.add(id)
  })

  // 其余 item 按原相对顺序填满剩下的空位
  let cursor = 0
  ids.forEach((id) => {
    if (pinned.has(id)) return
    while (cursor < total && slots[cursor] !== undefined) cursor += 1
    if (cursor >= total) return
    slots[cursor] = id
    cursor += 1
  })

  const next = slots.filter((spanId): spanId is string => spanId !== undefined)
  // 顺序真的变了才替换引用，避免无谓的响应式刷新
  if (next.length === total && next.some((spanId, index) => spanId !== ids[index])) {
    spanIds.value = next
  }
}

/** 当前正在拖拽的 item id。 */
const DraggingId = computed(() => dragState.value?.id)

/**
 * 根据拖拽中心点生成临时 geo，让拖拽项直接跟随指针。
 * 返回的是「屏幕坐标」：拖拽项在 item 层使用 fixed 定位，相对视口、
 * 不受滚动容器 overflow 裁剪，因此可拖出网格边界仍完整显示。
 * 换位判定仍由拖拽项的内容坐标（dragState.currentCenter）负责，互不干扰。
 */
const DragGeo = computed(() => {
  return (id: string) => {
    const state = dragState.value
    if (!state || state.id !== id) return undefined

    // 优先用拖拽开始时缓存的容器视口信息：render 里逐 item 读 getBoundingClientRect
    // 会在内容复杂时造成强制同步布局抖动，是低性能设备拖拽卡顿/闪烁的主要来源
    let viewport = _dragViewport
    if (!viewport) {
      refreshDragViewport()
      viewport = _dragViewport
    }
    if (!viewport) return undefined

    // 内容坐标 → 屏幕坐标：x 相对容器左边，y 额外减去已滚动的 scrollTop
    const cx = viewport.left + state.currentCenter.x
    const cy = viewport.top + state.currentCenter.y - scrollTop.value
    return {
      ...state.startGeo,
      cx,
      cy,
      left: cx - state.startGeo.width / 2,
      top: cy - state.startGeo.height / 2
    }
  }
})

/**
 * 真正执行布局同步；token 用来丢弃过期异步结果。
 * 同一 LayoutKey 只需算一次：setItems 等改动 spanIds 后会立即 syncLayout，
 * 随后 LayoutKey watcher 还会再触发一次，不去重就会把布局工厂跑两遍。
 */
const executeSyncLayout = async () => {
  if (isReady.value === false) return

  const key = LayoutKey.value
  if (key === lastSyncedLayoutKey) return
  lastSyncedLayoutKey = key

  const token = ++syncLayoutToken
  layout.value = layoutFactory.value(spanIds.value.length)
  await nextTick()
  if (token !== syncLayoutToken) return
  _recentlyAddedIds.clear()
  // 入场动画开关只作用于本批新增项：渲染（上面的 nextTick）完成后立即恢复默认
  skipEnterBatch.value = false
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

/**
 * 拖拽换位后同步选项 —— 语义是「sticky / fixed 跟随槽位，不跟随 id」：
 * 发生交换时，当前槽位的 sticky / fixed 保持不变，动的只是槽位上挂的 item。
 * ⚠️ 这是有意设计，别改成「跟随 id」：那样子设过 sticky 的 item 一被拖走，
 * 网格里就再没有吸附在视口里的格子了，整个 sticky 的意义直接没了。
 */
const applySlotOptionsAfterReorder = (prevSpanIds: string[], nextSpanIds: string[]) => {
  const prevSlotOptions = prevSpanIds.map((spanId) => itemOptionsById.value.get(spanId) ?? DEFAULT_ITEM_OPTIONS)
  const nextOptions = new Map(itemOptionsById.value)
  let changed = false

  nextSpanIds.forEach((spanId, index) => {
    const slotOptions = prevSlotOptions[index]
    const current = nextOptions.get(spanId) ?? DEFAULT_ITEM_OPTIONS
    if (current.sticky === slotOptions.sticky && current.fixed === slotOptions.fixed) return
    nextOptions.set(spanId, { ...slotOptions })
    changed = true
  })

  // 选项没有任何变化时不替换 Map 引用，避免无谓的响应式刷新
  if (changed) itemOptionsById.value = nextOptions
}

/** 将指定 id 移动到目标 span 下标，返回是否真的发生了排序变化。 */
const moveSpanId = (id: string, toIndex: number) => {
  const fromIndex = spanIds.value.indexOf(id)
  if (fromIndex === -1) return false

  const targetIndex = Math.max(0, Math.min(toIndex, spanIds.value.length - 1))
  if (fromIndex === targetIndex) return false
  if (IsFixedItem(id) || IsFixedSpanIndex(targetIndex)) return false

  const prevSpanIds = [...spanIds.value]

  // 碰撞双方任一为 sticky item 时优先交换而不是挤压：sticky 的视觉位置被吸附在视口内，
  // 挤压会让它从吸附位长途奔袭到新槽位，轨迹过长看起来像动画丢失；交换只需短距离过渡。
  const targetId = spanIds.value[targetIndex]
  const isDragSticky = itemOptionsById.value.get(id)?.sticky
  const isTargetSticky = targetId && targetId !== id && itemOptionsById.value.get(targetId)?.sticky
  if (isDragSticky || isTargetSticky) {
    const nextSpanIds = [...spanIds.value]
    nextSpanIds[fromIndex] = targetId
    nextSpanIds[targetIndex] = id
    spanIds.value = nextSpanIds
    applySlotOptionsAfterReorder(prevSpanIds, nextSpanIds)
    return true
  }

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

  const viewportHeight = pr_adaptive_grid_ref.value?.clientHeight ?? 0

  itemGeos.value.forEach((geo, index) => {
    const id = spanIds.value[index]
    // 正在退场的 item 不参与拖拽目标判断，避免拖到即将移除的槽位。
    if (id !== undefined && leavingIds.value.includes(id)) return
    if (IsFixedItem(id)) return

    // sticky item 的视觉位置被吸附在视口内，与槽位占位不同；
    // 距离判定必须用吸附后的视觉 cy，否则滚动越多偏差越大，拖到看得见的 Sticky item 上会判定到别的槽位。
    let cy = geo.cy
    if (viewportHeight > 0 && itemOptionsById.value.get(id)?.sticky) {
      const minCenterY = scrollTop.value + geo.height / 2
      const maxCenterY = scrollTop.value + Math.max(geo.height / 2, viewportHeight - geo.height / 2)
      cy = Math.min(Math.max(geo.cy, minCenterY), maxCenterY)
    }

    // 用平方距离比较即可，不需要开方，结果排序一致且计算更轻。
    const dx = center.x - geo.cx
    const dy = center.y - cy
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
const onItemDragStart = (id: string, event: PointerEvent, origin?: { x: number; y: number }) => {
  if (IsFixedItem(id)) return

  // 用实时 spanIds 定位：它与 itemGeos 的槽位一一对应（itemGeos 只由 layout 决定，与顺序无关）
  const fromIndex = spanIds.value.indexOf(id)
  const slotGeo = fromIndex === -1 ? undefined : itemGeos.value[fromIndex]
  if (!slotGeo) return

  refreshDragViewport() // 缓存容器视口信息，拖拽期间的渲染不再逐 item 读布局

  // sticky item 的视觉位置被吸附在视口内，与槽位占位不同；滚动越多偏差越大。
  // 拖拽跟随必须从视觉位置起步，否则 currentCenter 以槽位为基准会向上/向下偏移。
  const startGeo = StickyGeo.value(id, fromIndex) ?? slotGeo

  forcedVisibleId.value = id // 虚拟模式下确保拖拽 item 始终渲染
  event.preventDefault()
  // 注意：不能在此处把滚动容器的 overflow 切成 visible，否则 scrollTop 会被重置为 0，已滚动的网格整体坍塌。
  // 参考基准用 pointerdown 坐标而非阈值触发时的坐标：
  // 这样提交拖拽瞬间 currentCenter 就已包含阈值内的位移，item 精确贴合鼠标，无滞后。
  const originX = origin?.x ?? event.clientX
  const originY = origin?.y ?? event.clientY
  dragState.value = {
    id,
    startPointer: { x: originX, y: originY },
    startGeo,
    currentCenter: { x: startGeo.cx + (event.clientX - originX), y: startGeo.cy + (event.clientY - originY) },
    fromIndex,
    overIndex: fromIndex
  }
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
  _dragViewport = undefined // 拖拽结束，释放缓存
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
/**
 * 行高与余数分配：把「可视高度 - 行间距」平分给 targetRows 行。
 * 除不尽的部分按 1px 依次补给前几行（行与行之间最多差 1px），让 rows 行正好铺满可视高度。
 * 不能直接向下取整 —— 那会让 rows 行累计少掉「行数 × 小数部分」像素，
 * 底部露出一条黑边（11 行布局最多差 10px，且随视口高度忽有忽无）。
 * 容器高度可能带小数，先取整，避免总高度超出可视区挤出多余滚动条。
 */
const RowMetrics = computed(() => {
  const { gap, rows } = layout.value
  const totalRows = Math.min(rows, VIRTUAL_TARGET_ROWS)
  if (totalRows <= 0) return { base: 0, extra: 0, gap }
  const usable = Math.max(0, Math.floor(size.value.height) - (totalRows - 1) * gap)
  const base = Math.floor(usable / totalRows)
  return { base, extra: usable - base * totalRows, gap }
})

/**
 * 把「目标位置」归一化成最终槽位序列。
 * index 未传时按数组下标补齐，再按 (index 升序, 数组下标升序) 稳定排序后依次落位，冲突顺延到下一个空位。
 * 所以结果与传入顺序无关；除非 index 全未传或全相同 —— 此时由数组先后顺序决定。
 */
const computeNextSpanIds = (list: GridItemInput[], current: string[]): string[] => {
  const currentSet = new Set(current)
  const currentIndexById = new Map(current.map((id, index) => [id, index]))

  // 去重：同一个 id 只取最后一次声明，并记下它的数组下标
  const declared = new Map<string, { index: number; order: number }>()
  list.forEach((item, order) => {
    if (!item?.id) return
    // 已存在的 item 但没传 index ⇒ 保持它在当前顺序里的槽位，index 只当定位用、不重排。
    // 否则「只改 sticky / fixed 状态」会被当成重排，把用户拖拽出来的顺序打回原样。
    const existingIndex = currentIndexById.get(item.id)
    const index = item.index ?? (existingIndex === undefined ? order : existingIndex)
    declared.set(item.id, { index, order })
  })

  const addedCount = [...declared.keys()].filter((id) => !currentSet.has(id)).length
  const total = current.length + addedCount
  if (total === 0) return []

  // 稳定排序：index 升序；index 相同则按数组下标升序
  const ordered = [...declared.entries()].sort((a, b) => (a[1].index === b[1].index ? a[1].order - b[1].order : a[1].index - b[1].index))

  const slots = new Array<string | undefined>(total)

  // fixed item 先按当前槽位钉死：新增 / 重排都不许把它们顶走。
  // 否则新 item 抢下槽位 0，后面所有 item 依次后移，fixed 那个也被挤开 —— 与「锁定槽位」的语义直接冲突。
  const pinned = new Set<string>()
  current.forEach((id, index) => {
    if (!IsFixedItem(id)) return
    slots[Math.min(index, total - 1)] = id
    pinned.add(id)
  })

  /** 从 target 起找第一个空位落座；target 越界自动纠正到合法区间 */
  const takeSlot = (id: string, target: number) => {
    let pos = Math.max(0, Math.min(target, total - 1))
    while (pos < total && slots[pos] !== undefined) pos += 1
    if (pos >= total) return
    slots[pos] = id
  }

  ordered.forEach(([id, meta]) => {
    if (pinned.has(id)) return // fixed item 的槽位已经锁定，忽略它的重排请求
    takeSlot(id, meta.index)
  })

  // 未被提及的已有项：按原相对顺序填满剩余空位（已钉死的 fixed item 跳过，避免被写进第二个槽位）
  let cursor = 0
  current.forEach((id) => {
    if (declared.has(id) || pinned.has(id)) return
    while (cursor < total && slots[cursor] !== undefined) cursor += 1
    if (cursor >= total) return
    slots[cursor] = id
    cursor += 1
  })

  return slots.filter((id): id is string => id !== undefined)
}

/** 结束进行中的拖拽（重排会让拖拽的起始下标失效） */
const cancelDrag = () => {
  if (!dragState.value) return
  dragState.value = undefined
  forcedVisibleId.value = null
  _dragViewport = undefined
}

/** 完全重建 item 列表：清空顺序 / sticky / fixed，按传入顺序重排 */
const replaceItems = (ids: string[]) => {
  cancelDrag()
  const nextIds: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    nextIds.push(id)
  }
  leavingIds.value = []
  itemOptionsById.value = new Map()
  _recentlyAddedIds.clear()
  nextIds.forEach((id) => _recentlyAddedIds.add(id))
  spanIds.value = nextIds
  void syncLayout()
}

/**
 * 批量设置 / 新增 / 重排 item。
 * - 传 id：改该 id 的参数；同时传 index 就是把它重排到目标槽位
 * - 传 id 但不传 index：只改参数，保持该 item 当前的槽位（不会动顺序）
 * - 只传 index（不传 id）：改「当前第 index 个槽位」那个 item 的参数，不重排
 * - 新 id 不传 index：按传入的数组顺序找空位落座
 * 未提及的已有项保持原相对顺序。
 */
const setItems = (list: GridItemInput[]) => {
  if (!Array.isArray(list) || list.length === 0) return
  cancelDrag()

  // 解析目标 id：显式 id 优先（允许是尚未存在的新 item）；只给 index 时按当前槽位定位
  const resolved: (GridItemInput & { id: string })[] = []
  list.forEach((item) => {
    if (!item) return
    const targetId = item.id ?? (item.index === undefined ? undefined : spanIds.value[item.index])
    if (!targetId) return
    resolved.push({ ...item, id: targetId })
  })
  if (resolved.length === 0) return

  resolved.forEach((item) => {
    // 正在退场的 id 被重新声明 → 复活，取消退场
    const leavingIndex = leavingIds.value.indexOf(item.id)
    if (leavingIndex !== -1) leavingIds.value.splice(leavingIndex, 1)
    setItemOptions(item.id, item)
    if (!spanIds.value.includes(item.id)) _recentlyAddedIds.add(item.id)
  })

  spanIds.value = computeNextSpanIds(resolved, spanIds.value)
  void syncLayout()
}

/** 设置布局工厂；可选完全重建 item 列表与渲染配置 */
const setLayout = (factory: LayoutFactory, options: SetLayoutOptions = {}) => {
  if (options.overScan !== undefined) overScan.value = options.overScan

  // 先换工厂并记版本，保证随后触发的重算用的是新工厂
  if (factory !== layoutFactory.value) {
    layoutFactory.value = factory
    layoutVersion.value += 1
  }

  if (options.ids) {
    skipEnterBatch.value = options.animate === false
    replaceItems(options.ids)
  }
}

/** 注册尺寸变化回调；覆盖式，重复调用替换上一个 */
const onResize = (handler: ResizeHandler) => {
  resizeHandler = handler
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
  // 拖拽中滚动会改变容器视口位置，同步刷新缓存，保证拖拽几何不漂移
  if (dragState.value) refreshDragViewport()
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

  /**
   * 先派发尺寸（外部可在回调里同步 setLayout），再写入 size 驱动同帧重算。
   * 顺序不能反：反了会先用旧尺寸算一遍、再用新尺寸算一遍。
   */
  const applySize = () => {
    resizeHandler?.({ width: _size.width, height: _size.height })
    size.value = _size
    // 拖拽中容器尺寸变化会改变视口位置，同步刷新缓存
    if (dragState.value) refreshDragViewport()
  }

  observer = new ResizeObserver((sizes) => {
    const [{ contentRect }] = sizes
    _size = { width: contentRect.width, height: contentRect.height }
    if (isReady.value === false) {
      isReady.value = true
      return applySize()
    }
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(applySize, 50) // 节流
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
  setLayout,
  onResize,
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
