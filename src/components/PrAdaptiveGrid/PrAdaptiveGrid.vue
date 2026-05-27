<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" :style="ScrollContainerStyle" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="item in list" :key="`span-${item.id}`" class="pr-adaptive-grid-item-span" :style="ItemSpanStyle(item)" />
      <div v-for="item in list" :key="`item-${item.id}`" class="pr-adaptive-grid-item" :class="{ 'pr-adaptive-grid-item-sticky': item.sticky }" :style="StyleItem(item.id)">
        <slot :item="item" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch, nextTick, type CSSProperties } from 'vue'
import type { GridDirection, GridItem, GridLayoutRect } from '../../types'

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
const pr_adaptive_grid_content_ref = ref<HTMLElement>()

const contentLayoutMap = reactive(new Map<string, GridLayoutRect>())
const stickyOffsetMap = reactive(new Map<string, GridLayoutRect>())

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

const ContainerStyle = computed(() => {
  const { gap, rows, cols } = props
  return {
    gap: `${gap}px`,
    display: 'grid',
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'grid-template-rows': `repeat(${rows}, 1fr)`
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
const computeItemRect = (item: GridItem, innerW: number, innerH: number, cols: number, rows: number, gap: number): GridLayoutRect => {
  const colTrack = cols > 0 ? (innerW - (cols - 1) * gap) / cols : 0
  const rowTrack = rows > 0 ? (innerH - (rows - 1) * gap) / rows : 0
  const colStart = item.x - 1
  const rowStart = item.y - 1

  return {
    x: colStart * (colTrack + gap),
    y: rowStart * (rowTrack + gap),
    w: item.w * colTrack + (item.w - 1) * gap,
    h: item.h * rowTrack + (item.h - 1) * gap
  }
}

const syncLayout = () => {
  const content = pr_adaptive_grid_content_ref.value
  if (!content) return

  const { width, height } = content.getBoundingClientRect()
  if (!width || !height) return

  const spans = content.querySelectorAll<HTMLElement>('.pr-adaptive-grid-item-span')
  const contentRect = content.getBoundingClientRect()
  const canMeasure = spans.length === props.list.length

  props.list.forEach((item, index) => {
    let rect: GridLayoutRect | undefined

    if (canMeasure) {
      const spanRect = spans[index].getBoundingClientRect()
      rect = {
        x: spanRect.left - contentRect.left,
        y: spanRect.top - contentRect.top,
        w: spanRect.width,
        h: spanRect.height
      }
    } else {
      const { gap, cols, rows } = props
      rect = computeItemRect(item, width, height, cols, rows, gap)
    }

    contentLayoutMap.set(item.id, rect)
  })

  // 清理已移除项
  for (const id of [...contentLayoutMap.keys()]) {
    if (!props.list.some((item) => item.id === id)) {
      contentLayoutMap.delete(id)
      stickyOffsetMap.delete(id)
    }
  }

  updateStickyOnScroll()
}

const StyleItem = (id: string): CSSProperties => {
  const item = props.list.find((entry) => entry.id === id)
  const layout = item?.sticky ? (stickyOffsetMap.get(id) ?? contentLayoutMap.get(id)) : contentLayoutMap.get(id)

  if (!layout) return EMPTY_ITEM_STYLE

  const width = Math.max(layout.w, item?.minW ?? 0)
  const height = Math.max(layout.h, item?.minH ?? 0)

  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`
  }
}

const updateStickyOnScroll = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return

  const { scrollTop, scrollLeft, clientWidth, clientHeight } = container

  for (const item of props.list) {
    if (!item.sticky) {
      stickyOffsetMap.delete(item.id)
      continue
    }

    const layout = contentLayoutMap.get(item.id)
    if (!layout) continue

    const maxX = Math.max(scrollLeft, scrollLeft + clientWidth - layout.w)
    const maxY = Math.max(scrollTop, scrollTop + clientHeight - layout.h)
    const x = Math.min(Math.max(layout.x, scrollLeft), maxX)
    const y = Math.min(Math.max(layout.y, scrollTop), maxY)

    stickyOffsetMap.set(item.id, { x, y, w: layout.w, h: layout.h })
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
  if (pr_adaptive_grid_ref.value) observer.observe(pr_adaptive_grid_ref.value)
  if (pr_adaptive_grid_content_ref.value) observer.observe(pr_adaptive_grid_content_ref.value)
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
  box-sizing: border-box;
}
.pr-adaptive-grid-content {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.pr-adaptive-grid-item-span {
  pointer-events: none;
  min-width: 0;
  min-height: 0;
  background-color: rgba(128, 128, 128, 0.5);
}
.pr-adaptive-grid-item {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  box-sizing: border-box;
  box-shadow: 0 0 0 1px red inset;
  transition:
    transform 300ms ease-out,
    width 300ms ease-out,
    height 300ms ease-out;
  will-change: transform;
}
.pr-adaptive-grid-item-sticky {
  z-index: 2;
  transition:
    width 300ms ease-out,
    height 300ms ease-out;
}
</style>
