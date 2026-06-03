<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="(item, index) in layout.items" :key="index" class="pr-adaptive-grid-item-span" :data-item-index="index" :style="ItemSpanStyle(item)" />
      <div v-for="row in RenderItems" :key="row._leaving ? `leaving-${row.id}` : `item-${row.id}`" class="pr-adaptive-grid-item" :class="itemClass(row)" :style="ItemStyle(row)">
        <div class="pr-adaptive-grid-item-inner" :class="itemInnerClass(row)" :style="ItemInnerStyle(row)" @animationend.self="(e) => onInnerAnimationEnd(e, row)">
          <slot :item="row.slotItem" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'
import type { PropType } from 'vue'
import type { GetLayoutFn, GridItem, GridItemOptions, GridSlotItem, Layout, LayoutCell } from '../../types'

type ItemRect = { x: number; y: number; width: number; height: number } // 相对 content 的像素矩形
type LeavingRow = { id: string; index: number; rect: ItemRect; item: GridItem } // 离场中的 item 快照
type RenderRow = { id: string; index: number; item: GridItem; slotItem: GridSlotItem; _leaving: false } | { id: string; index: number; item: GridItem; slotItem: GridSlotItem; _leaving: true } // 模板 v-for 的一行数据

const props = defineProps({
  getLayout: { type: Function as PropType<GetLayoutFn>, required: true } // 应用层注册，内部自行读取 mode 等状态
})

const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] }) // 仅 span 占位几何
const gridItems = ref<GridItem[]>([]) // 真实 item，下标与 layout.items 一一对应

const pr_adaptive_grid_ref = ref<HTMLElement>()
const pr_adaptive_grid_content_ref = ref<HTMLElement>() // Grid 内容容器 DOM

const layoutReady = ref(false) // 首屏布局是否已就绪（就绪前禁用 transition）
const size = reactive({ x: 0, y: 0, width: 0, height: 0 }) // content 在视口中的位置与尺寸
const scrollOffset = reactive({ x: 0, y: 0 }) // .pr-adaptive-grid 的 scrollLeft/Top
const pinScrollAnchorById = ref(new Map<string, { x: number; y: number }>()) // 各 id 开启 sticky 时的 scroll 锚点
const prevIds = ref<string[]>([]) // 上一轮 layout 的 id 列表，用于 diff
const lastItemById = ref(new Map<string, GridItem>()) // 上一轮 item 数据，供离场时 slot 使用
const mapRectById = ref(new Map<string, ItemRect>()) // 各 id 当前帧矩形（驱动绝对定位）
const lastRectById = ref(new Map<string, ItemRect>()) // 各 id 上一轮矩形（位移动画起点、离场回退）

/** Grid 容器的列、行、间距样式 */
const ContainerStyle = computed(() => {
  const { gap, cols, rows } = layout.value
  return {
    gap: `${gap}px`,
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'grid-template-rows': `repeat(${rows}, 1fr)`
  }
})

/** 根据容器高度与行数计算单行高度 */
const ItemHeight = computed(() => {
  const { gap, rows } = layout.value
  return (size.height - (rows - 1) * gap) / rows
})

/** 占位 span 在 Grid 中的位置与高度 */
const ItemSpanStyle = computed(() => {
  return (item: LayoutCell) => {
    const { gap } = layout.value
    const { x, y, w, h } = item
    return {
      'grid-column-start': x,
      'grid-column-end': x + w,
      'grid-row-start': y,
      'grid-row-end': y + h,
      height: `${h * ItemHeight.value + (h - 1) * gap}px`
    }
  }
})

const mapRectByIndex = ref(new Map<number, ItemRect>()) // 各 span 下标相对 content 的测量结果（驱动定位）
const layoutAnimIds = ref(new Set<string>()) // 需要播放 layout 位移动画的 id

/** 读取 item 相对 content 的像素矩形（按 id；测量前回退 lastRectById，离场用快照） */
const getRect = (_index: number, isLeaving: boolean, id: string): ItemRect | undefined => {
  if (isLeaving) return leavingItems.value.find((l) => l.id === id)?.rect
  return mapRectById.value.get(id) ?? lastRectById.value.get(id)
}

const enterAnimIds = ref(new Set<string>()) // 正在播放入场 animation 的 id
const leaveAnimIds = ref(new Set<string>()) // 正在播放离场 animation 的 id
const leavingItems = ref<LeavingRow[]>([]) // 已从 layout 移除、DOM 仍保留的离场项

/** 取消指定 id 的入场动画状态 */
const cancelEnter = (id: string) => {
  if (!enterAnimIds.value.has(id)) return
  const next = new Set(enterAnimIds.value)
  next.delete(id)
  enterAnimIds.value = next
}

/** 取消指定 id 的离场动画并移出 leaving 列表 */
const cancelLeave = (id: string) => {
  leavingItems.value = leavingItems.value.filter((l) => l.id !== id)
  if (!leaveAnimIds.value.has(id)) return
  const next = new Set(leaveAnimIds.value)
  next.delete(id)
  leaveAnimIds.value = next
}

/** 移除已不在当前 layout 中的入场/离场状态 */
const pruneAnimState = (layoutIdSet: Set<string>) => {
  enterAnimIds.value = new Set([...enterAnimIds.value].filter((id) => layoutIdSet.has(id)))
  leavingItems.value = leavingItems.value.filter((l) => !layoutIdSet.has(l.id))
  leaveAnimIds.value = new Set([...leaveAnimIds.value].filter((id) => !layoutIdSet.has(id)))
}

/** 新增 item 时挂入场动画 class */
const onItemEnter = (id: string) => {
  cancelLeave(id)
  enterAnimIds.value = new Set([...enterAnimIds.value, id])
}

/** 删除 item 时写入离场快照并挂离场动画 class */
const onItemLeave = (id: string) => {
  cancelEnter(id)
  const rect = lastRectById.value.get(id)
  const item = lastItemById.value.get(id)
  const index = prevIds.value.indexOf(id)
  if (!rect || !item || index < 0) return
  if (leavingItems.value.some((l) => l.id === id)) return
  leavingItems.value = [...leavingItems.value, { id, index, rect: { ...rect }, item }]
  leaveAnimIds.value = new Set([...leaveAnimIds.value, id])
}

/** 入场/离场 animation 结束时清理对应状态 */
const onInnerAnimationEnd = (e: AnimationEvent, row: RenderRow) => {
  const { id, _leaving } = row
  if (_leaving === false && e.animationName.includes('ag-inner-enter')) {
    cancelEnter(id)
    return
  }
  if (_leaving === true && e.animationName.includes('ag-inner-leave')) {
    cancelLeave(id)
  }
}

/** 合并真实 item 与离场项，供模板 v-for */
const RenderItems = computed((): RenderRow[] => {
  const leavingIdSet = new Set(leavingItems.value.map((l) => l.id))
  const cells = layout.value.items
  const active: RenderRow[] = []
  gridItems.value.forEach((item, index) => {
    const cell = cells[index]
    if (!cell || leavingIdSet.has(item.id)) return
    active.push({
      id: item.id,
      index,
      item,
      slotItem: { ...item, ...cell },
      _leaving: false
    })
  })
  const leaving: RenderRow[] = leavingItems.value.map((l) => {
    const cell = cells[l.index]
    return {
      id: l.id,
      index: l.index,
      item: l.item,
      slotItem: cell ? { ...l.item, ...cell } : { ...l.item, x: 0, y: 0, w: 1, h: 1 },
      _leaving: true
    }
  })
  return [...active, ...leaving]
})

const POSITION_DURATION_MIN = 600 // 位移过渡最短 ms
const POSITION_DURATION_MAX = 1200 // 位移过渡最长 ms
const mapItemPositionDuration = ref(new Map<string, number>()) // 每个 id 本次位移的 transition 时长
/** 根据中心点移动距离映射到 [POSITION_DURATION_MIN, POSITION_DURATION_MAX] */
const calcPositionDurationMs = (prev: ItemRect | undefined, next: ItemRect): number => {
  if (!prev) return POSITION_DURATION_MIN
  const pcx = prev.x + prev.width / 2
  const pcy = prev.y + prev.height / 2
  const ncx = next.x + next.width / 2
  const ncy = next.y + next.height / 2
  const dist = Math.hypot(ncx - pcx, ncy - pcy)
  const maxDist = Math.hypot(size.width, size.height) || 1
  const t = Math.min(1, dist / maxDist)
  return Math.round(POSITION_DURATION_MIN + t * (POSITION_DURATION_MAX - POSITION_DURATION_MIN))
}

/** 外层 item 中心定位的 transform */
const ItemStyle = computed(() => {
  const { x: scrollX, y: scrollY } = scrollOffset
  return (row: RenderRow) => {
    const { id, index, _leaving } = row
    const config = getRect(index, _leaving, id)
    if (!config) return {}
    const { x, y, width, height } = config
    const cx = x + width / 2
    const cy = y + height / 2
    const isSticky = _leaving === false && row.item.sticky === true
    const anchor = pinScrollAnchorById.value.get(id)
    const px = isSticky ? cx + scrollX - (anchor?.x ?? 0) : cx
    const py = isSticky ? cy + scrollY - (anchor?.y ?? 0) : cy
    const layoutDurationMs = mapItemPositionDuration.value.get(id) ?? POSITION_DURATION_MIN
    return {
      transform: `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`,
      '--ag-duration-position': `${layoutDurationMs}ms`
    }
  }
})

/** inner 的宽高像素值 */
const ItemInnerStyle = computed(() => {
  return (row: RenderRow) => {
    const { id, index, _leaving } = row
    const config = getRect(index, _leaving, id)
    if (!config) return {}
    const { width, height } = config
    return {
      width: `${width}px`,
      height: `${height}px`
    }
  }
})

/** 外层 item 的 layout/离场/首屏 class */
const itemClass = (row: RenderRow) => {
  const { id, _leaving, item } = row
  return {
    'pr-adaptive-grid-item-pinned': _leaving === false && item.sticky === true,
    'pr-adaptive-grid-item-layout-anim': layoutAnimIds.value.has(id) && _leaving === false,
    'pr-adaptive-grid-item-leaving': _leaving,
    'pr-adaptive-grid-item-no-transition': layoutReady.value === false || enterAnimIds.value.has(id)
  }
}

/** inner 的入场/离场/首屏 class */
const itemInnerClass = (row: RenderRow) => {
  const { id, _leaving } = row
  return {
    'pr-adaptive-grid-item-no-transition': layoutReady.value === false || enterAnimIds.value.has(id) || leaveAnimIds.value.has(id),
    'ag-inner-enter': _leaving === false && enterAnimIds.value.has(id),
    'ag-inner-leave': _leaving && leaveAnimIds.value.has(id)
  }
}

/** 对比前后 id 列表，得到新增与删除的 id */
const diffIds = (prev: string[], next: string[]) => {
  const prevSet = new Set(prev)
  const nextSet = new Set(next)
  const added = next.filter((id) => !prevSet.has(id))
  const removed = prev.filter((id) => !nextSet.has(id))
  return { added, removed }
}

/** 测量 span 下标位置，按 gridItems 顺序写入 mapRectById / mapRectByIndex */
const syncItemsLayout = async () => {
  await nextTick()
  if (!pr_adaptive_grid_content_ref.value) return

  const next = new Map<number, ItemRect>()
  const spanCount = layout.value.items.length
  for (let index = 0; index < spanCount; index++) {
    const itemSpan = pr_adaptive_grid_content_ref.value.querySelector(`[data-item-index="${index}"]`)
    if (!itemSpan) continue
    const { x, y, width, height } = itemSpan.getBoundingClientRect()
    next.set(index, { x: x - size.x, y: y - size.y, width, height })
  }

  layoutAnimIds.value = new Set(gridItems.value.map((g) => g.id))

  const prevRects = lastRectById.value
  const durationNext = new Map<string, number>()
  const rectById = new Map<string, ItemRect>()
  gridItems.value.forEach((g, index) => {
    const rect = next.get(index)
    if (!rect) return
    durationNext.set(g.id, calcPositionDurationMs(prevRects.get(g.id), rect))
    rectById.set(g.id, rect)
  })
  mapItemPositionDuration.value = durationNext

  mapRectByIndex.value = next
  mapRectById.value = rectById
  lastRectById.value = rectById

  if (layoutReady.value === false) {
    await nextTick()
    await new Promise((r) => requestAnimationFrame(r))

    layoutReady.value = true
  }
}

/** 测量 content 容器尺寸并触发 syncItemsLayout */
const syncSize = async () => {
  await nextTick()
  if (!pr_adaptive_grid_content_ref.value) return
  const { x, y, height, width } = pr_adaptive_grid_content_ref.value.getBoundingClientRect()
  size.x = x
  size.y = y
  size.height = height
  size.width = width
  await syncItemsLayout()
}

/** gridItems 变更时的完整同步流程（diff、动画、测量） */
const applyGridWatch = async () => {
  const nextIds = gridItems.value.map((g) => g.id)
  const layoutIdSet = new Set(nextIds)

  if (prevIds.value.length === 0) {
    await syncSize()
    prevIds.value = nextIds
    lastItemById.value = new Map(gridItems.value.map((g) => [g.id, g]))
    pruneAnimState(layoutIdSet)
    return
  }

  const { added, removed } = diffIds(prevIds.value, nextIds)
  for (const id of removed) onItemLeave(id)

  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  for (const id of added) onItemEnter(id)
  await syncSize()

  prevIds.value = nextIds
  lastItemById.value = new Map(gridItems.value.map((g) => [g.id, g]))
  pruneAnimState(layoutIdSet)
}

let layoutWatchChain: Promise<void> = Promise.resolve() // watch 串行队列，避免并行 sync

const layoutGeometryKey = () => [layout.value.gap, layout.value.cols, layout.value.rows, ...layout.value.items.map((c) => `${c.x},${c.y},${c.w},${c.h}`)].join('|')

/** 仅几何变化时重新测量（不触发 enter/leave） */
watch(layoutGeometryKey, () => {
  if (gridItems.value.length === 0) return
  layoutWatchChain = layoutWatchChain.then(() => syncSize()).catch((err) => console.error('[PrAdaptiveGrid] geometry watch failed', err))
})

/** 真实 item 列表变化时 diff 与动画 */
watch(
  () => gridItems.value.map((g) => `${g.id}:${g.sticky ?? ''}:${g.fixed ?? ''}`).join('|'),
  () => {
    layoutWatchChain = layoutWatchChain.then(() => applyGridWatch()).catch((err) => console.error('[PrAdaptiveGrid] grid watch failed', err))
  }
)

let resizeTimer: ReturnType<typeof setTimeout> | undefined // resize debounce 定时器

/** 窗口/容器尺寸变化时 debounce 后重新测量 */
const scheduleResizeSync = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    resizeTimer = undefined
    void syncSize()
  }, 32)
}

/** 记录某 id 开启 Pin 时的滚动位置 */
const capturePinScrollAnchor = (id: string) => {
  const next = new Map(pinScrollAnchorById.value)
  next.set(id, { x: scrollOffset.x, y: scrollOffset.y })
  pinScrollAnchorById.value = next
}
/** 取消 Pin 时移除锚点 */
const clearPinScrollAnchor = (id: string) => {
  if (!pinScrollAnchorById.value.has(id)) return
  const next = new Map(pinScrollAnchorById.value)
  next.delete(id)
  pinScrollAnchorById.value = next
}

/** 记录滚动偏移，供 sticky item 抵消位移 */
const onScroll = () => {
  const el = pr_adaptive_grid_ref.value
  if (!el) return
  scrollOffset.x = el.scrollLeft
  scrollOffset.y = el.scrollTop
}

let observer: ResizeObserver // 监听 content 容器尺寸变化

/** 挂载后监听 content 容器尺寸变化 */
onMounted(async () => {
  await nextTick()
  observer = new ResizeObserver(() => scheduleResizeSync())
  if (pr_adaptive_grid_content_ref.value) observer.observe(pr_adaptive_grid_content_ref.value)
})

/** 卸载时断开监听并清理定时器 */
onBeforeUnmount(() => {
  observer?.disconnect()
  if (resizeTimer) clearTimeout(resizeTimer)
})

/** 合并已有 item 与本次传入的 options（未传字段保留原值） */
const mergeItemOptions = (id: string, prev: GridItem | undefined, option?: GridItemOptions): GridItem => ({
  id,
  sticky: option && 'sticky' in option ? option.sticky : prev?.sticky,
  fixed: option && 'fixed' in option ? option.fixed : prev?.fixed
})

/** 按 id 顺序重算 span 几何并同步 gridItems */
const applyLayoutFromIds = (idList: string[], optionById?: Map<string, GridItemOptions>) => {
  const geo = props.getLayout(idList.length)
  const prevById = new Map(gridItems.value.map((g) => [g.id, g]))
  layout.value = geo
  gridItems.value = idList.map((id) => mergeItemOptions(id, prevById.get(id), optionById?.get(id)))
  gridItems.value.forEach((g) => {
    const wasSticky = prevById.get(g.id)?.sticky === true
    if (g.sticky === true && !wasSticky) capturePinScrollAnchor(g.id)
    if (g.sticky !== true && wasSticky) clearPinScrollAnchor(g.id)
  })
}

/** 新增或更新 item；id 已存在时仅合并传入的 options */
const setItem = (id: string, option?: GridItemOptions) => {
  const existingIndex = gridItems.value.findIndex((g) => g.id === id)
  if (existingIndex >= 0) {
    const prev = gridItems.value[existingIndex]
    const merged = mergeItemOptions(id, prev, option)
    let idList = gridItems.value.map((g) => g.id)
    if (option?.index !== undefined && option.index !== existingIndex) {
      idList.splice(existingIndex, 1)
      idList.splice(option.index, 0, id)
    }
    const optionById = new Map<string, GridItemOptions>()
    optionById.set(id, { sticky: merged.sticky, fixed: merged.fixed })
    applyLayoutFromIds(idList, optionById)
    return
  }
  const index = option?.index ?? gridItems.value.length
  const idList = gridItems.value.map((g) => g.id)
  idList.splice(index, 0, id)
  const optionById = new Map<string, GridItemOptions>()
  if (option) optionById.set(id, option)
  applyLayoutFromIds(idList, optionById)
}

/** 按 ids 顺序一次性设置全部 item，共用 option 作为各 id 默认值（index 以数组下标为准） */
const setItems = (idList: string[], option?: GridItemOptions) => {
  const optionById = new Map<string, GridItemOptions>()
  if (option) {
    const { index: _index, ...shared } = option
    for (const id of idList) {
      optionById.set(id, shared)
    }
  }
  applyLayoutFromIds(idList, optionById)
}

/** 移除 item 并重算布局 */
const removeItems = (removeIds: string[]) => {
  if (removeIds.length === 0) return
  const removeSet = new Set(removeIds)
  const nextIds = gridItems.value.filter((g) => !removeSet.has(g.id)).map((g) => g.id)
  applyLayoutFromIds(nextIds)
}

/** 供外部主动触发测量（与 resize 后内部 syncSize 相同） */
const syncLayout = () => syncSize()

defineExpose({
  syncLayout,
  setItem,
  setItems,
  removeItems
})
</script>

<style scoped>
.pr-adaptive-grid {
  --ag-duration-position: 700ms;
  --ag-duration-size: 500ms;
  --ag-duration-enter: 500ms;
  --ag-duration-exit: 500ms;
  --ag-enter-scale: 0;
  --ag-ease-position: cubic-bezier(0.22, 1, 0.44, 1);
  --ag-ease-size: ease;
  --ag-ease-fade: ease-out;

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
  display: grid;
  height: 100%;
  width: 100%;
}
.pr-adaptive-grid-item-span {
  pointer-events: none;
  min-width: 0;
  min-height: 0;
  grid-auto-flow: row dense;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pr-adaptive-grid-item {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  box-sizing: border-box;
  will-change: transform;
}
.pr-adaptive-grid-item-leaving {
  z-index: 0;
}
.pr-adaptive-grid-item-inner {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
}
.pr-adaptive-grid-item-layout-anim {
  transition: transform var(--ag-duration-position, 700ms) var(--ag-ease-position);
}
.pr-adaptive-grid-item-layout-anim .pr-adaptive-grid-item-inner {
  transition:
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}
@keyframes ag-inner-enter {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes ag-inner-leave {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.3);
  }
}
.pr-adaptive-grid-item-inner.ag-inner-enter {
  animation: ag-inner-enter var(--ag-duration-enter) var(--ag-ease-fade) 100ms both;
}
.pr-adaptive-grid-item-inner.ag-inner-leave {
  animation: ag-inner-leave var(--ag-duration-exit) var(--ag-ease-fade) both;
  pointer-events: none;
}

.pr-adaptive-grid-item-pinned {
  z-index: 20;
}

.pr-adaptive-grid-item-pinned:not(.pr-adaptive-grid-item-layout-anim) {
  transition: none !important;
}

.pr-adaptive-grid-item-no-transition {
  transition: none !important;
}

.pr-adaptive-grid-item-dragging {
  z-index: 25; /* 高于 pinned 的 20 */
  cursor: grabbing;
}
.pr-adaptive-grid-item-dragging .pr-adaptive-grid-item-inner {
  cursor: grabbing;
}
</style>
