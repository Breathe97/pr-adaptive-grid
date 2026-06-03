<template>
  <div class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="item in Items" :key="`span-${item.id}`" class="pr-adaptive-grid-item-span" :data-item-id="item.id" :style="ItemSpanStyle(item)" />
      <div v-for="row in RenderItems" :key="row._leaving ? `leaving-${row.id}` : `item-${row.id}`" class="pr-adaptive-grid-item" :class="itemClass(row.id, row._leaving)" :style="ItemStyle(row.id, row._leaving)">
        <div class="pr-adaptive-grid-item-inner" :class="innerClass(row.id, row._leaving)" :style="ItemInnerStyle(row.id, row._leaving)" @animationend.self="(e) => onInnerAnimationEnd(e, row.id, row._leaving)">
          <slot :item="row.item" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'
import type { PropType } from 'vue'
import type { Layout, LayoutItem } from '../../types'

type ItemRect = { x: number; y: number; width: number; height: number } // 相对 content 的像素矩形
type LeavingRow = { id: string; rect: ItemRect; item: LayoutItem } // 离场中的 item 快照
type RenderRow = { id: string; item: LayoutItem; _leaving: boolean } // 模板 v-for 的一行数据

const props = defineProps({
  layout: {
    // 网格布局配置（cols/rows/gap/items）
    type: Object as PropType<Layout>,
    default: () => 0
  }
})

const pr_adaptive_grid_content_ref = ref<HTMLElement>() // Grid 内容容器 DOM

const layoutReady = ref(false) // 首屏布局是否已就绪（就绪前禁用 transition）
const size = reactive({ x: 0, y: 0, width: 0, height: 0 }) // content 在视口中的位置与尺寸
const prevIds = ref<string[]>([]) // 上一轮 layout 的 id 列表，用于 diff
const lastItemById = ref(new Map<string, LayoutItem>()) // 上一轮 item 数据，供离场时 slot 使用
const lastRectById = ref(new Map<string, ItemRect>()) // 上一轮测量矩形，leave 时 map 未命中则回退

/** 当前 layout 项（仅 props，供 span/sync） */
const Items = computed(() => props.layout.items)

/** Grid 容器的列、行、间距样式 */
const ContainerStyle = computed(() => {
  const { gap, cols, rows } = props.layout
  return {
    gap: `${gap}px`,
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'grid-template-rows': `repeat(${rows}, 1fr)`
  }
})

/** 根据容器高度与行数计算单行高度 */
const ItemHeight = computed(() => {
  const { gap, rows } = props.layout
  return (size.height - (rows - 1) * gap) / rows
})

/** 占位 span 在 Grid 中的位置与高度 */
const ItemSpanStyle = computed(() => {
  return (item: LayoutItem) => {
    const { x, y, w, h } = item
    return {
      'grid-column-start': x,
      'grid-column-end': x + w,
      'grid-row-start': y,
      'grid-row-end': y + h,
      height: `${ItemHeight.value}px`
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
const onInnerAnimationEnd = (e: AnimationEvent, id: string, isLeaving: boolean) => {
  if (!isLeaving && e.animationName.includes('ag-inner-enter')) {
    cancelEnter(id)
    return
  }
  if (isLeaving && e.animationName.includes('ag-inner-leave')) {
    cancelLeave(id)
  }
}

/** 合并 layout 项与离场项，供模板 v-for */
const RenderItems = computed((): RenderRow[] => {
  const leavingIdSet = new Set(leavingItems.value.map((l) => l.id))
  const active = Items.value
    .filter((item) => !leavingIdSet.has(item.id))
    .map((item) => ({
      id: item.id,
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

/** 外层 item 中心定位的 transform */
const ItemStyle = computed(() => {
  return (id: string, isLeaving: boolean) => {
    const config = getRect(id, isLeaving)
    if (!config) return {}
    const { x, y, width, height } = config
    const cx = x + width / 2
    const cy = y + height / 2
    return {
      transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
    }
  }
})

/** inner 的宽高像素值 */
const ItemInnerStyle = computed(() => {
  return (id: string, isLeaving: boolean) => {
    const config = getRect(id, isLeaving)
    if (!config) return {}
    const { width, height } = config
    return {
      width: `${width}px`,
      height: `${height}px`
    }
  }
})

/** 外层 item 的 layout/离场/首屏 class */
const itemClass = (id: string, isLeaving: boolean) => ({
  'pr-adaptive-grid-item-layout-anim': layoutAnimIds.value.has(id) && !isLeaving,
  'pr-adaptive-grid-item-leaving': isLeaving,
  'pr-adaptive-grid-item-no-transition': layoutReady.value === false
})

/** inner 的入场/离场/首屏 class */
const innerClass = (id: string, isLeaving: boolean) => ({
  'pr-adaptive-grid-item-no-transition': layoutReady.value === false || enterAnimIds.value.has(id) || leaveAnimIds.value.has(id),
  'ag-inner-enter': !isLeaving && enterAnimIds.value.has(id),
  'ag-inner-leave': isLeaving && leaveAnimIds.value.has(id)
})

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
    const { id } = item
    const itemSpan = pr_adaptive_grid_content_ref.value.querySelector(`[data-item-id="${id}"]`)
    if (!itemSpan) continue
    const { x, y, width, height } = itemSpan.getBoundingClientRect()
    next.set(id, { x: x - size.x, y: y - size.y, width, height })
  }

  layoutAnimIds.value = new Set(Items.value.map((i) => i.id))

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
  const nextIds = props.layout.items.map((i) => i.id)
  const layoutIdSet = new Set(nextIds)

  if (prevIds.value.length === 0) {
    await syncSize()
    prevIds.value = nextIds
    lastItemById.value = new Map(Items.value.map((i) => [i.id, i]))
    pruneAnimState(layoutIdSet)
    return
  }

  const { added, removed } = diffIds(prevIds.value, nextIds)
  for (const id of removed) onItemLeave(id)

  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  for (const id of added) onItemEnter(id)
  await syncSize()

  prevIds.value = nextIds
  lastItemById.value = new Map(Items.value.map((i) => [i.id, i]))
  pruneAnimState(layoutIdSet)
}

let layoutWatchChain: Promise<void> = Promise.resolve() // layout watch 串行队列，避免并行 sync

/** 监听 layout 变化，串行执行 applyLayoutWatch */
watch(
  () => props.layout.items.map((i) => `${i.id}:${i.x},${i.y},${i.w},${i.h}`).join('|'),
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

/** 滚动事件（预留） */
const onScroll = () => {}

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

/** 供外部主动触发测量（与 resize 后内部 syncSize 相同） */
const syncLayout = () => syncSize()

defineExpose({
  syncLayout
})
</script>

<style scoped>
.pr-adaptive-grid {
  --ag-duration-position: 700ms;
  --ag-duration-size: 500ms;
  --ag-duration-enter: 500ms;
  --ag-duration-exit: 500ms;
  --ag-enter-scale: 0;
  --ag-ease-position: cubic-bezier(0.22, 1, 0.36, 1);
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
  background-color: rgb(26, 26, 26);
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
  transition: transform var(--ag-duration-position) var(--ag-ease-position) 50ms;
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
  animation: ag-inner-enter var(--ag-duration-enter) var(--ag-ease-fade) both;
}
.pr-adaptive-grid-item-inner.ag-inner-leave {
  animation: ag-inner-leave var(--ag-duration-exit) var(--ag-ease-fade) both;
  pointer-events: none;
}
.pr-adaptive-grid-item-no-transition {
  transition: none !important;
}
</style>
