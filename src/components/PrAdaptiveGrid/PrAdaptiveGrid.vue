<template>
  <div class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="item in Items" :key="`span-${item.id}`" class="pr-adaptive-grid-item-span" :data-item-id="item.id" :style="ItemSpanStyle(item)">{{ item.id }}</div>
      <div v-for="item in RenderItems" :key="`item-${item.id}`" class="pr-adaptive-grid-item" :class="[itemClass(item.id, item._leaving)]" :style="ItemStyle(item.id, item._leaving)">
        <div class="pr-adaptive-grid-item-inner" :class="[innerClass(item.id, item._leaving)]" :style="ItemInnerStyle(item.id, item._leaving)" @animationend="(e) => onInnerAnimationEnd(e, item.id, item._leaving)">
          <slot :item="item" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'
import type { PropType } from 'vue'
import type { Layout, LayoutItem } from '../../types'

type ItemRect = { x: number; y: number; width: number; height: number }
type LeavingRow = { id: string; rect: ItemRect; item: LayoutItem }
type RenderRow = { id: string; item: LayoutItem; _leaving: boolean }

const props = defineProps({
  layout: {
    type: Object as PropType<Layout>,
    default: () => 0
  }
})

const pr_adaptive_grid_content_ref = ref<HTMLElement>()

const layoutReady = ref(false)

const size = reactive({ x: 0, y: 0, width: 0, height: 0 })

const ContainerStyle = computed(() => {
  const { gap, cols, rows } = props.layout
  return {
    gap: `${gap}px`,
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'grid-template-rows': `repeat(${rows}, 1fr)`
  }
})

const ItemHeight = computed(() => {
  const { gap, rows } = props.layout
  return (size.height - (rows - 1) * gap) / rows
})

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

const mapItemStyle = ref(new Map<string, { x: number; y: number; width: number; height: number }>())

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

const layoutAnimIds = ref(new Set<string>())

const prevIds = ref<string[]>([])
const diffIds = (prev: string[], next: string[]) => {
  const prevSet = new Set(prev)
  const nextSet = new Set(next)
  const added = next.filter((id) => !prevSet.has(id))
  const removed = prev.filter((id) => !nextSet.has(id))
  return { added, removed }
}

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
  if (layoutReady.value === false) {
    await nextTick()
    await new Promise((r) => requestAnimationFrame(r))
    layoutReady.value = true
  }
}

const onScroll = () => {}

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

const enterAnimIds = ref(new Set<string>())
const leaveAnimIds = ref(new Set<string>())
const leavingItems = ref<LeavingRow[]>([])
const lastItemById = ref(new Map<string, LayoutItem>())

const getRect = (id: string, isLeaving: boolean): ItemRect | undefined => {
  if (isLeaving) return leavingItems.value.find((l) => l.id === id)?.rect
  return mapItemStyle.value.get(id)
}

const itemClass = (id: string, isLeaving: boolean) => ({
  'pr-adaptive-grid-item-layout-anim': layoutAnimIds.value.has(id) && !isLeaving,
  'pr-adaptive-grid-item-leaving': isLeaving,
  'pr-adaptive-grid-item-no-transition': layoutReady.value === false
})

const innerClass = (id: string, isLeaving: boolean) => ({
  'pr-adaptive-grid-item-no-transition': layoutReady.value === false || enterAnimIds.value.has(id) || leaveAnimIds.value.has(id),
  'ag-inner-enter': !isLeaving && enterAnimIds.value.has(id),
  'ag-inner-leave': isLeaving && leaveAnimIds.value.has(id)
})

const onItemEnter = (id: string) => {
  enterAnimIds.value = new Set([...enterAnimIds.value, id])
}

const onItemLeave = (id: string) => {
  const rect = mapItemStyle.value.get(id)
  const item = lastItemById.value.get(id)
  if (!rect || !item) return
  if (leavingItems.value.some((l) => l.id === id)) return
  leavingItems.value = [...leavingItems.value, { id, rect: { ...rect }, item }]
  leaveAnimIds.value = new Set([...leaveAnimIds.value, id])
}

const onInnerAnimationEnd = (e: AnimationEvent, id: string, isLeaving: boolean) => {
  if (e.target !== e.currentTarget) return
  if (!isLeaving && e.animationName === 'ag-inner-enter') {
    const next = new Set(enterAnimIds.value)
    next.delete(id)
    enterAnimIds.value = next
    return
  }
  if (isLeaving && e.animationName === 'ag-inner-leave') {
    leavingItems.value = leavingItems.value.filter((l) => l.id !== id)
    const next = new Set(leaveAnimIds.value)
    next.delete(id)
    leaveAnimIds.value = next
  }
}

const Items = computed(() => props.layout.items)

const RenderItems = computed((): RenderRow[] => [
  ...Items.value.map((item) => ({
    id: item.id,
    item,
    _leaving: false as const
  })),
  ...leavingItems.value.map((l) => ({
    id: l.id,
    item: l.item,
    _leaving: true as const
  }))
])

watch(
  () => props.layout.items.map((i) => i.id).join(','),
  async () => {
    const nextIds = props.layout.items.map((i) => i.id)
    if (prevIds.value.length === 0) {
      await syncSize()
      prevIds.value = nextIds
      lastItemById.value = new Map(Items.value.map((i) => [i.id, i]))
      return
    }
    const { added, removed } = diffIds(prevIds.value, nextIds)
    for (const id of removed) onItemLeave(id)
    for (const id of added) onItemEnter(id)
    prevIds.value = nextIds
    await syncSize()
    lastItemById.value = new Map(Items.value.map((i) => [i.id, i]))
  }
)

let observer: ResizeObserver

onMounted(async () => {
  await nextTick()
  observer = new ResizeObserver(() => syncSize())
  if (pr_adaptive_grid_content_ref.value) observer.observe(pr_adaptive_grid_content_ref.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<style scoped>
.pr-adaptive-grid {
  --ag-duration-position: 800ms;
  --ag-duration-size: 500ms;
  --ag-duration-enter: 220ms;
  --ag-duration-exit: 180ms;
  --ag-enter-scale: 0.5;
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
  /* box-shadow: 0 0 0 1px red inset; */
  color: red;
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

.pr-adaptive-grid-item-inner {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
}

.pr-adaptive-grid-item-layout-anim {
  transition: transform var(--ag-duration-position) var(--ag-ease-position);
}

.pr-adaptive-grid-item-layout-anim .pr-adaptive-grid-item-inner {
  transition:
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

@keyframes ag-inner-enter {
  from {
    opacity: 0;
    transform: scale(var(--ag-enter-scale, 0.5));
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
    transform: scale(var(--ag-enter-scale, 0.5));
  }
}
.pr-adaptive-grid-item-inner.ag-inner-enter {
  animation: ag-inner-enter var(--ag-duration-enter) var(--ag-ease-fade) both;
}
.pr-adaptive-grid-item-inner.ag-inner-leave {
  animation: ag-inner-leave var(--ag-duration-exit) var(--ag-ease-fade) both;
  pointer-events: none;
}
.pr-adaptive-grid-item-leaving {
  z-index: 15;
}

.pr-adaptive-grid-item-no-transition {
  transition: none !important;
}
</style>
