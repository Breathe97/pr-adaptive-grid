<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" :style="Style" @scroll="onScroll">
    <div v-for="item in list" :key="`item-${item.id}`" class="pr-adaptive-grid-item" :class="{ 'pr-adaptive-grid-item-sticky': item.sticky }" :style="StyleItem(item.id)">
      <slot :item="item" />
    </div>
    <div v-for="item in list" :key="`span-${item.id}`" :ref="(el) => setSpanRef(item.id, el)" class="pr-adaptive-grid-item-span" :style="SpanStyle(item)" />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { GridDirection, GridItem, GridLayoutRect } from '../../types'

const emit = defineEmits<{
  change: [payload: { layoutMap: Map<string, GridLayoutRect> }]
}>()

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
  direction: {
    type: String as () => GridDirection,
    default: () => 'right' as GridDirection
  }
})

const pr_adaptive_grid_ref = ref<HTMLElement>()
const spanRefs = new Map<string, HTMLElement>()

const styleMap = reactive(new Map<string, Record<string, string>>())
/** 内容坐标系下的布局（含滚动区域），sticky 滚动时据此补偿 */
const contentLayoutMap = reactive(new Map<string, GridLayoutRect>())

const StyleItem = (id: string) => styleMap.get(id)

const Style = computed(() => {
  const { cols, rows, gap, padding } = props
  return {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gap: `${gap}px`,
    padding: `${padding}px`
  }
})

const SpanStyle = (item: GridItem) => ({
  gridColumn: `${item.x + 1} / span ${item.w}`,
  gridRow: `${item.y + 1} / span ${item.h}`
})

const setSpanRef = (id: string, el: unknown) => {
  if (el instanceof HTMLElement) {
    spanRefs.set(id, el)
  } else {
    spanRefs.delete(id)
  }
}

const applyItemStyle = (item: GridItem, layout: GridLayoutRect, container: HTMLElement) => {
  const { scrollLeft, scrollTop } = container
  const tx = item.sticky ? layout.x - scrollLeft : layout.x
  const ty = item.sticky ? layout.y - scrollTop : layout.y

  styleMap.set(item.id, {
    width: `${layout.w}px`,
    height: `${layout.h}px`,
    transform: `translate3d(${tx}px, ${ty}px, 0)`,
    opacity: '1',
    zIndex: item.sticky ? '2' : '1'
  })
}

const syncLayout = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const layoutMap = new Map<string, GridLayoutRect>()
  const activeIds = new Set<string>()

  for (const item of props.list) {
    const span = spanRefs.get(item.id)
    if (!span) continue

    activeIds.add(item.id)

    const rect = span.getBoundingClientRect()
    const layout: GridLayoutRect = {
      x: rect.left - containerRect.left + container.scrollLeft,
      y: rect.top - containerRect.top + container.scrollTop,
      w: rect.width,
      h: rect.height
    }

    contentLayoutMap.set(item.id, layout)
    layoutMap.set(item.id, layout)
    applyItemStyle(item, layout, container)
  }

  for (const id of contentLayoutMap.keys()) {
    if (!activeIds.has(id)) {
      contentLayoutMap.delete(id)
      styleMap.delete(id)
    }
  }

  emit('change', { layoutMap })
}

const updateStickyOnScroll = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return

  for (const item of props.list) {
    if (!item.sticky) continue
    const layout = contentLayoutMap.get(item.id)
    if (!layout) continue
    applyItemStyle(item, layout, container)
  }
}

let raf = 0
const scheduleSync = () => {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(syncLayout)
}

let scrollRaf = 0
const onScroll = () => {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(updateStickyOnScroll)
}

let observer: ResizeObserver

onMounted(async () => {
  observer = new ResizeObserver(scheduleSync)
  await nextTick()
  if (pr_adaptive_grid_ref.value) {
    observer.observe(pr_adaptive_grid_ref.value)
  }
  scheduleSync()
})

watch(
  () => [props.list, props.cols, props.rows, props.gap, props.padding],
  async () => {
    await nextTick()
    scheduleSync()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  cancelAnimationFrame(scrollRaf)
  observer?.disconnect()
})
</script>

<style scoped>
.pr-adaptive-grid {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  display: grid;
  box-sizing: border-box;
}
.pr-adaptive-grid-item-span {
  pointer-events: none;
  background-color: rgb(65, 65, 65);
}
.pr-adaptive-grid-item {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  transition:
    transform 300ms ease-out,
    width 300ms ease-out,
    height 300ms ease-out;
  will-change: transform;
  box-shadow: 0 0 0 1px #000000 inset;
}
.pr-adaptive-grid-item-sticky {
  /* 滚动时由 JS 高频更新 transform，关闭过渡避免拖影 */
  transition:
    width 300ms ease-out,
    height 300ms ease-out;
}
</style>
