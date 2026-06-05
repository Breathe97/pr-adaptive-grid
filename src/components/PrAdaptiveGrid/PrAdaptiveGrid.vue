<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="(item, index) in layout.items" :key="index" class="pr-adaptive-grid-item-span" :data-grid-span-index="index" :style="ItemSpanStyle(item)"></div>
    </div>
    <PrAdaptiveGridItem v-for="(id, index) in itemIds" :key="id" :id="id" :geo="ItemGeo(index)" :drag-geo="DragGeo(id)" :draggable="true" :dragging="DraggingId === id" :leaving="IsLeaving(id)" :on-drag-start="onItemDragStart" :on-drag-move="onItemDragMove" :on-drag-end="onItemDragEnd" :on-leave-end="onItemLeaveEnd">
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

// 获取所有span的几何信息
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
}

const ItemGeo = computed(() => {
  return (index: number) => {
    const geo = spanGeos.value[index]
    return geo
  }
})

const LayoutKey = computed(() => {
  const { width, height } = size.value
  const ids = spanIds.value.join('&')
  const key = `${width}-${height}-${ids}`
  return key
})

const IsLeaving = computed(() => {
  return (id: string) => leavingIds.value.includes(id)
})

const DraggingId = computed(() => dragState.value?.id)

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

/** 根据拖拽 item 的视觉中心点，寻找距离最近的 span 槽位。 */
const getNearestSpanIndex = (center: { x: number; y: number }, fallbackIndex: number) => {
  let nearestIndex = fallbackIndex
  let nearestScore = Number.POSITIVE_INFINITY

  spanGeos.value.forEach((geo, index) => {
    const id = itemIds.value[index]
    // 正在退场的 item 不参与拖拽目标判断，避免拖到即将移除的槽位。
    if (id !== undefined && leavingIds.value.includes(id)) return

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

const onItemDragStart = (id: string, event: PointerEvent) => {
  const fromIndex = itemIds.value.indexOf(id)
  const startGeo = fromIndex === -1 ? undefined : spanGeos.value[fromIndex]
  if (!startGeo) return

  event.preventDefault()
  dragState.value = { id, startPointer: { x: event.clientX, y: event.clientY }, startGeo, currentCenter: { x: startGeo.cx, y: startGeo.cy }, fromIndex, overIndex: fromIndex }
}

const onItemDragMove = (id: string, event: PointerEvent) => {
  const state = dragState.value
  if (!state || state.id !== id) return

  event.preventDefault()
  const dx = event.clientX - state.startPointer.x
  const dy = event.clientY - state.startPointer.y
  const currentCenter = { x: state.startGeo.cx + dx, y: state.startGeo.cy + dy }
  const overIndex = getNearestSpanIndex(currentCenter, state.overIndex)
  dragState.value = { ...state, currentCenter, overIndex }
}

const onItemDragEnd = (id: string, event: PointerEvent) => {
  if (dragState.value?.id !== id) return
  event.preventDefault()
  dragState.value = undefined
}

const initLayout = async () => {
  if (isReady.value === false) return
  layout.value = props.getLayout(spanIds.value.length)
  await nextTick()
  getSpanGeos()
}

// 布局受外部变量实时变化
watch(
  () => LayoutKey.value,
  () => initLayout(),
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
const setItems = (ids: string[], _options?: GridItemsOptions) => {
  spanIds.value.push(...ids)
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

  let _size = { width: 0, height: 0 }

  observer = new ResizeObserver((sizes) => {
    const [{ contentRect }] = sizes
    const { width, height } = contentRect
    _size = { width, height }
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
