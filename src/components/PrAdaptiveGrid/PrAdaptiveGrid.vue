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
  /** 单行轨道高度（px）；不传则按容器首屏可视高度自动计算 */
  itemHeight: {
    type: Number,
    default: undefined
  },
  direction: {
    type: String as () => GridDirection,
    default: () => 'right' as GridDirection
  }
})

const pr_adaptive_grid_ref = ref<HTMLElement>()
const pr_adaptive_grid_content_ref = ref<HTMLElement>()

/** 首屏按最多 4 行均分容器高度（与 mode2 左侧 fullId 占 4 行一致） */
const FIRST_SCREEN_ROWS = 4

const containerViewportHeight = ref(0)

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

/** 未传 itemHeight 时：首屏高度 / min(rows, 4)，避免总行数增多时挤压单行 */
const resolvedRowHeight = computed(() => {
  if (props.itemHeight != null && props.itemHeight > 0) {
    return props.itemHeight
  }
  if (containerViewportHeight.value <= 0 || props.rows <= 0) return 0

  const firstScreenRows = Math.min(props.rows, FIRST_SCREEN_ROWS)
  return containerViewportHeight.value / firstScreenRows
})

const ContainerStyle = computed(() => {
  const { gap, rows, cols } = props
  const rowHeight = resolvedRowHeight.value

  if (!rowHeight) {
    return {
      gap: `${gap}px`,
      display: 'grid',
      width: '100%',
      height: '100%',
      'grid-template-columns': `repeat(${cols}, 1fr)`,
      'grid-template-rows': `repeat(${rows}, 1fr)`
    }
  }

  const contentHeight = rows * rowHeight + Math.max(0, rows - 1) * gap

  return {
    gap: `${gap}px`,
    display: 'grid',
    width: '100%',
    minHeight: `${contentHeight}px`,
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'grid-template-rows': `repeat(${rows}, ${rowHeight}px)`
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
const computeItemRect = (
  item: GridItem,
  innerW: number,
  innerH: number,
  cols: number,
  rows: number,
  gap: number,
  itemHeight: number
): GridLayoutRect => {
  const colTrack = cols > 0 ? (innerW - (cols - 1) * gap) / cols : 0
  const rowTrack = itemHeight > 0 ? itemHeight : rows > 0 ? (innerH - (rows - 1) * gap) / rows : 0
  const colStart = item.x - 1
  const rowStart = item.y - 1

  return {
    x: colStart * (colTrack + gap),
    y: rowStart * (rowTrack + gap),
    w: item.w * colTrack + (item.w - 1) * gap,
    h: item.h * rowTrack + (item.h - 1) * gap
  }
}

const measureContainer = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return
  containerViewportHeight.value = container.clientHeight
}

const syncLayout = () => {
  const content = pr_adaptive_grid_content_ref.value
  if (!content) return

  const { width, height } = content.getBoundingClientRect()
  if (!width || !height) return

  const rowHeight = resolvedRowHeight.value

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
      rect = computeItemRect(item, width, height, cols, rows, gap, rowHeight)
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

  const width = layout.w
  const height = layout.h

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
  raf = requestAnimationFrame(() => {
    void (async () => {
      measureContainer()
      await nextTick()
      syncLayout()
    })()
  })
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
  () => [props.list, props.cols, props.rows, props.gap, props.padding, props.itemHeight, containerViewportHeight.value],
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
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.pr-adaptive-grid::-webkit-scrollbar {
  display: none;
}
.pr-adaptive-grid-content {
  position: relative;
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
