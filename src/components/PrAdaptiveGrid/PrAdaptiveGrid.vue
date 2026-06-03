<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="(item, index) in layout.items" :key="index" class="pr-adaptive-grid-item-span" :data-item-index="index" :style="ItemSpanStyle(item)" />
      <div v-for="row in RenderItems" :key="row._leaving ? `leaving-${row.id}` : `item-${row.id}`" class="pr-adaptive-grid-item" :class="itemClass(row)" :style="ItemStyle(row)">
        <div class="pr-adaptive-grid-item-inner" :class="itemInnerClass(row)" :style="ItemInnerStyle(row)" @animationend.self="(e) => onInnerAnimationEnd(e, row)">
          <slot :item="row.item" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'
import type { PropType } from 'vue'
import { getLayout as defaultGetLayout } from '../../layouts/layout.default'
import type { GetLayoutFn, Layout, LayoutItem, LayoutItemOptions } from '../../types'

type ItemRect = { x: number; y: number; width: number; height: number } // 相对 content 的像素矩形
type LeavingRow = { id: string; rect: ItemRect; item: LayoutItem } // 离场中的 item 快照
type RenderRow = { id: string; item: LayoutItem; _leaving: boolean } // 模板 v-for 的一行数据

const props = defineProps({
  getLayout: { type: Function as PropType<GetLayoutFn>, default: undefined } // 自定义布局函数，默认内置 getLayout
})

const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] }) // 组件内部布局状态

const itemIds = ref<string[]>([]) // 当前 item 顺序，与 layout.items 下标对应
const resolveGetLayout = (): GetLayoutFn => props.getLayout ?? defaultGetLayout
const collectItemIds = (items: LayoutItem[]) => items.map((i) => i.id).filter((id): id is string => id != null)

const pr_adaptive_grid_ref = ref<HTMLElement>()
const pr_adaptive_grid_content_ref = ref<HTMLElement>() // Grid 内容容器 DOM

const layoutReady = ref(false) // 首屏布局是否已就绪（就绪前禁用 transition）
const size = reactive({ x: 0, y: 0, width: 0, height: 0 }) // content 在视口中的位置与尺寸
const scrollOffset = reactive({ x: 0, y: 0 }) // .pr-adaptive-grid 的 scrollLeft/Top
const prevIds = ref<string[]>([]) // 上一轮 layout 的 id 列表，用于 diff
const lastItemById = ref(new Map<string, LayoutItem>()) // 上一轮 item 数据，供离场时 slot 使用
const lastRectById = ref(new Map<string, ItemRect>()) // 上一轮测量矩形，leave 时 map 未命中则回退

/** 当前 layout 项（仅 props，供 span/sync） */
const Items = computed(() => layout.value.items)

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
  return (item: LayoutItem) => {
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

const mapItemStyle = ref(new Map<string, ItemRect>()) // 各 id 相对 content 的测量结果（驱动定位）
const layoutAnimIds = ref(new Set<string>()) // 需要播放 layout 位移动画的 id

/** 读取 item 相对 content 的像素矩形（正常项用 map，离场项用快照） */
const getRect = (id: string, isLeaving: boolean): ItemRect | undefined => {
  if (isLeaving) return leavingItems.value.find((l) => l.id === id)?.rect
  return mapItemStyle.value.get(id)
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
  const rect = mapItemStyle.value.get(id) ?? lastRectById.value.get(id)
  const item = lastItemById.value.get(id)
  if (!rect || !item) return
  if (leavingItems.value.some((l) => l.id === id)) return
  leavingItems.value = [...leavingItems.value, { id, rect: { ...rect }, item }]
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

/** 合并 layout 项与离场项，供模板 v-for */
const RenderItems = computed((): RenderRow[] => {
  const leavingIdSet = new Set(leavingItems.value.map((l) => l.id))
  const active = Items.value
    .filter((item) => item.id != null && !leavingIdSet.has(item.id))
    .map((item) => ({
      id: item.id as string,
      item,
      _leaving: false as const
    }))
  const leaving = leavingItems.value.map((l) => ({
    id: l.id,
    item: l.item,
    _leaving: true as const
  }))
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
  // 依赖 scrollOffset，滚动时触发重新渲染
  const { x: scrollX, y: scrollY } = scrollOffset
  return (row: RenderRow) => {
    const { id, _leaving, item } = row
    const config = getRect(id, _leaving)
    if (!config) return {}
    const { x, y, width, height } = config
    const cx = x + width / 2
    const cy = y + height / 2
    const isSticky = _leaving === false && item.sticky === true
    const px = isSticky ? cx + scrollX : cx
    const py = isSticky ? cy + scrollY : cy
    const layoutDurationMs = mapItemPositionDuration.value.get(id) ?? POSITION_DURATION_MIN
    // const durationMs = isSticky ? 0 : layoutDurationMs
    return {
      transform: `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`,
      '--ag-duration-position': `${layoutDurationMs}ms`
    }
  }
})

/** inner 的宽高像素值 */
const ItemInnerStyle = computed(() => {
  return (row: RenderRow) => {
    const { id, _leaving } = row
    const config = getRect(id, _leaving)
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

/** 测量各 span 位置并写入 mapItemStyle */
const syncItemsLayout = async () => {
  await nextTick()
  if (!pr_adaptive_grid_content_ref.value) return

  const next = new Map<string, ItemRect>()
  for (const item of Items.value) {
    const id = item.id
    if (!id) continue
    const itemSpan = pr_adaptive_grid_content_ref.value.querySelector(`[data-item-id="${id}"]`)
    if (!itemSpan) continue
    const { x, y, width, height } = itemSpan.getBoundingClientRect()
    next.set(id, { x: x - size.x, y: y - size.y, width, height })
  }

  layoutAnimIds.value = new Set(collectItemIds(Items.value))

  // 记录当前位置到目标位置的距离
  {
    const prev = mapItemStyle.value
    const durationNext = new Map<string, number>()
    for (const item of Items.value) {
      const id = item.id
      if (!id) continue
      const rect = next.get(id)
      if (!rect) continue
      durationNext.set(id, calcPositionDurationMs(prev.get(id), rect))
    }
    mapItemPositionDuration.value = durationNext
  }

  mapItemStyle.value = next
  lastRectById.value = new Map(next)

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

/** layout 变更时的完整同步流程（diff、动画、测量） */
const applyLayoutWatch = async () => {
  const nextIds = collectItemIds(layout.value.items)
  const layoutIdSet = new Set(nextIds)

  if (prevIds.value.length === 0) {
    await syncSize()
    prevIds.value = nextIds
    lastItemById.value = new Map(Items.value.filter((i) => i.id != null).map((i) => [i.id as string, i]))
    pruneAnimState(layoutIdSet)
    return
  }

  const { added, removed } = diffIds(prevIds.value, nextIds)
  for (const id of removed) onItemLeave(id)

  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  for (const id of added) onItemEnter(id)
  await syncSize()

  prevIds.value = nextIds
  lastItemById.value = new Map(Items.value.filter((i) => i.id != null).map((i) => [i.id as string, i]))
  pruneAnimState(layoutIdSet)
}

let layoutWatchChain: Promise<void> = Promise.resolve() // layout watch 串行队列，避免并行 sync

/** 监听 layout 变化，串行执行 applyLayoutWatch */
watch(
  () => layout.value.items.map((i) => `${i.id}:${i.x},${i.y},${i.w},${i.h}`).join('|'),
  () => {
    layoutWatchChain = layoutWatchChain.then(() => applyLayoutWatch()).catch((err) => console.error('[PrAdaptiveGrid] layout watch failed', err))
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

/** 按 itemIds 顺序合并 getLayout 几何与 id / 标记 */
const applyLayoutFromIds = (idList: string[], optionById?: Map<string, LayoutItemOptions>) => {
  const geo = resolveGetLayout()(idList.length)
  const prev = new Map(layout.value.items.map((it) => [it.id, it]))
  layout.value = {
    ...geo,
    items: geo.items.map((cell, i) => {
      const id = idList[i]
      const p = prev.get(id)
      const opt = optionById?.get(id)
      return {
        ...cell,
        id,
        sticky: opt?.sticky ?? p?.sticky,
        fixed: opt?.fixed ?? p?.fixed
      }
    })
  }
}

/** 新增 item 并重算布局 */
const addItem = (id: string, option?: LayoutItemOptions) => {
  if (itemIds.value.includes(id)) return
  const index = option?.index ?? itemIds.value.length
  const next = [...itemIds.value]
  next.splice(index, 0, id)
  itemIds.value = next
  const optionById = new Map<string, LayoutItemOptions>()
  if (option) optionById.set(id, option)
  applyLayoutFromIds(next, optionById)
}

/** 移除 item 并重算布局 */
const removeItems = (removeIds: string[]) => {
  if (removeIds.length === 0) return
  const removeSet = new Set(removeIds)
  const next = itemIds.value.filter((id) => !removeSet.has(id))
  itemIds.value = next
  applyLayoutFromIds(next)
}

/** 计算布局（不写入组件，使用 props.getLayout 或内置 layout.default） */
const getLayoutExpose = (length: number) => resolveGetLayout()(length)

/** 写入布局并同步 itemIds */
const setLayout = (next: Layout) => {
  layout.value = next
  itemIds.value = next.items.map((it) => it.id).filter((id): id is string => id != null)
}

/** 读取当前布局 */
const getLayoutState = () => layout.value

/** 供外部主动触发测量（与 resize 后内部 syncSize 相同） */
const syncLayout = () => syncSize()

defineExpose({
  syncLayout,
  getLayout: getLayoutExpose,
  setLayout,
  getLayoutState,
  addItem,
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
