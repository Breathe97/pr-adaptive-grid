<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="(item, index) in layout.items" :key="index" class="pr-adaptive-grid-item-span" :data-grid-span-index="index" :style="ItemSpanStyle(item)"></div>
    </div>
    <PrAdaptiveGridItem v-for="(id, index) in itemIds" :key="id" :id="id" :geo="ItemGeo(index)" :sticky-geo="StickyGeo(id, index)" :drag-geo="DragGeo(id)" :sticky="ItemOptions(id).sticky" :fixed="ItemOptions(id).fixed" :draggable="!ItemOptions(id).fixed" :dragging="DraggingId === id" :leaving="IsLeaving(id)" :on-drag-start="onItemDragStart" :on-drag-move="onItemDragMove" :on-drag-end="onItemDragEnd" :on-leave-end="onItemLeaveEnd">
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </PrAdaptiveGridItem>
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
  }
})

const pr_adaptive_grid_ref = ref<HTMLElement>() // 外部容器 滚动
const pr_adaptive_grid_content_ref = ref<HTMLElement>() // Grid 内容容器 DOM

const isReady = ref(false) // 是否准备就绪
const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] }) // 仅 span 占位几何
const size = ref({ width: 0, height: 0 }) // content 尺寸（行高与位移动画时长）
const scrollTop = ref(0) // .pr-adaptive-grid 的 scrollTop，Pin 定位用

const spanIds = ref<string[]>([]) // 当前渲染的span
const itemIds = ref<string[]>([]) // 当前渲染的item
const leavingIds = ref<string[]>([]) // 当前退场的item
const spanGeos = ref<Geo[]>([]) // 所有span的几何信息

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

/** 写入或合并指定 item 的状态；未传入时初始化为默认状态。 */
const setItemOptions = (id: string, options?: GridItemsOptions) => {
  const current = itemOptionsById.value.get(id) ?? DEFAULT_ITEM_OPTIONS
  itemOptionsById.value.set(id, { ...current, ...normalizeItemOptions(options) })
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
let syncLayoutToken = 0

/** 读取所有 span 占位节点的几何信息，并用 spanIds 同步真实渲染 item 顺序。 */
const getSpanGeos = async () => {
  if (pr_adaptive_grid_content_ref.value === undefined) return
  const spans = pr_adaptive_grid_content_ref.value.childNodes
  const _spanGeos = []
  for (const span of spans) {
    const { className, offsetTop, offsetLeft, clientWidth, clientHeight } = span as HTMLElement
    if (className !== 'pr-adaptive-grid-item-span') continue

    const cx = offsetLeft + clientWidth / 2
    const cy = offsetTop + clientHeight / 2

    const geo: Geo = { cx, cy, top: offsetTop, left: offsetLeft, width: clientWidth, height: clientHeight }

    _spanGeos.push(geo)
  }
  spanGeos.value = _spanGeos
  itemIds.value = [...spanIds.value]
}

/** item 退场动画完成后，真正从 span / item 列表中移除。 */
const onItemLeaveEnd = (id: string) => {
  const leavingIndex = leavingIds.value.indexOf(id)
  // 已经被 setItem 复活了，忽略这次退场完成回调
  if (leavingIndex === -1) return
  if (dragState.value?.id === id) dragState.value = undefined
  leavingIds.value.splice(leavingIndex, 1)
  const spanIndex = spanIds.value.indexOf(id)
  if (spanIndex !== -1) spanIds.value.splice(spanIndex, 1)
  const itemIndex = itemIds.value.indexOf(id)
  if (itemIndex !== -1) itemIds.value.splice(itemIndex, 1)
  itemOptionsById.value.delete(id)
}

/** 按渲染下标返回 item 对应的 span 几何。 */
const ItemGeo = computed(() => {
  return (index: number) => {
    const geo = spanGeos.value[index]
    return geo
  }
})

/** sticky 只调整视觉位置，不改 spanGeos / spanIds 的真实占位。 */
const StickyGeo = computed(() => {
  return (id: string, index: number) => {
    if (!ItemOptions.value(id).sticky) return undefined
    if (DraggingId.value === id) return undefined

    const geo = spanGeos.value[index]
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

/** 重新计算布局并在 DOM 更新后刷新 span 几何；token 用来丢弃过期异步结果。 */
const syncLayout = async () => {
  if (isReady.value === false) return

  const token = ++syncLayoutToken
  layout.value = props.getLayout(spanIds.value.length)
  await nextTick()
  if (token !== syncLayoutToken) return
  await getSpanGeos()
}

/** 将指定 id 移动到目标 span 下标，返回是否真的发生了排序变化。 */
const moveSpanId = (id: string, toIndex: number) => {
  const fromIndex = spanIds.value.indexOf(id)
  if (fromIndex === -1) return false

  const targetIndex = Math.max(0, Math.min(toIndex, spanIds.value.length - 1))
  if (fromIndex === targetIndex) return false
  if (IsFixedItem(id) || IsFixedSpanIndex(targetIndex)) return false

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
  return true
}

/** 根据拖拽 item 的视觉中心点，寻找距离最近的 span 槽位。 */
const getNearestSpanIndex = (center: { x: number; y: number }, fallbackIndex: number) => {
  let nearestIndex = fallbackIndex
  let nearestScore = Number.POSITIVE_INFINITY

  spanGeos.value.forEach((geo, index) => {
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
  const startGeo = fromIndex === -1 ? undefined : spanGeos.value[fromIndex]
  if (!startGeo) return

  event.preventDefault()
  dragState.value = { id, startPointer: { x: event.clientX, y: event.clientY }, startGeo, currentCenter: { x: startGeo.cx, y: startGeo.cy }, fromIndex, overIndex: fromIndex }
}

/** 拖拽移动：更新临时 geo，并在目标槽位变化时让其他 item 补位。 */
const onItemDragMove = (id: string, event: PointerEvent) => {
  const state = dragState.value
  if (!state || state.id !== id) return

  event.preventDefault()
  const { didReorder } = updateDragStateFromPointer(state, event)
  if (didReorder) void syncLayout()
}

/** 结束拖拽：先同步最终布局，再清理拖拽态触发 item 回到最终 geo。 */
const onItemDragEnd = async (id: string, event: PointerEvent) => {
  const state = dragState.value
  if (!state || state.id !== id) return
  event.preventDefault()

  updateDragStateFromPointer(state, event)
  await syncLayout()
  // 等待期间可能已经被退场或下一次拖拽替换，避免清掉新的拖拽状态。
  if (dragState.value?.id !== id) return

  dragState.value = undefined
}

// 布局受外部变量实时变化。
watch(
  () => LayoutKey.value,
  () => syncLayout(),
  {}
)

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
  const { height } = size.value
  const num = (height - (rows - 1) * gap) / rows
  return num
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

/** 新增或更新 item；id 已存在时仅合并传入的 options */
const setItem = (id: string, options?: GridItemOptions) => {
  setItemOptions(id, options)
  const { index = 0 } = options ?? {}
  const leavingIndex = leavingIds.value.indexOf(id)
  // 情况 1：这个 id 正在退场，说明业务层又把它加回来了
  if (leavingIndex !== -1) {
    leavingIds.value.splice(leavingIndex, 1)
    // 如果 spanIds 里还保留着它，就不要重复插入
    if (spanIds.value.includes(id)) {
      return
    }
    // 如果你 remove 时已经从 spanIds 删除了，则这里重新插入
    spanIds.value.splice(index, 0, id)
    return
  }
  // 情况 2：已经存在，避免重复添加
  if (spanIds.value.includes(id)) {
    return
  }
  // 情况 3：真正的新 item
  spanIds.value.splice(index, 0, id)
}

/** 按 ids 一次性设置 */
const setItems = (ids: string[], options?: GridItemsOptions) => {
  const nextIds = [...ids]
  spanIds.value = [...nextIds]
  leavingIds.value = []
  pruneItemOptions(nextIds)
  nextIds.forEach((id) => setItemOptions(id, options))
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

/** 记录滚动偏移 */
const onScroll = () => {
  const el = pr_adaptive_grid_ref.value
  if (!el) return
  scrollTop.value = el.scrollTop
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
    resizeTimer = setTimeout(setSize, 500) // 节流
  })
  if (pr_adaptive_grid_ref.value) observer.observe(pr_adaptive_grid_ref.value)
})

/** 卸载时断开监听并清理定时器 */
onBeforeUnmount(() => {
  observer?.disconnect()
  if (resizeTimer) clearTimeout(resizeTimer)
})

defineExpose({
  setItem,
  setItems,
  removeItems
})
</script>

<style scoped>
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
  display: grid;
  height: 100%;
  width: 100%;
}
.pr-adaptive-grid-item-span {
  min-width: 0;
  min-height: 0;
  grid-auto-flow: row dense;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  /* box-shadow: 0 0 0 1px red inset; */
  pointer-events: none;
}
</style>
