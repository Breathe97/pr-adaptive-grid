<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" :style="Style">
    <div v-for="item in list" :key="`span-${item.id}`" :ref="(el) => setSpanRef(item.id, el)" class="pr-adaptive-grid-item-span" :style="SpanStyle(item)" />
    <div class="pr-adaptive-grid-item" v-for="item in list" :key="`item-${item.id}`" :style="StyleItem(item.id)">
      <slot :item="item" />
    </div>
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

const syncLayout = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const layoutMap = new Map<string, GridLayoutRect>()

  for (const item of props.list) {
    const span = spanRefs.get(item.id)
    if (!span) continue

    const rect = span.getBoundingClientRect()
    const x = rect.left - containerRect.left
    const y = rect.top - containerRect.top
    const w = rect.width
    const h = rect.height

    layoutMap.set(item.id, { x, y, w, h })
    styleMap.set(item.id, {
      width: `${w}px`,
      height: `${h}px`,
      transform: `translate3d(${x}px, ${y}px, 0)`,
      opacity: '1'
    })
  }

  emit('change', { layoutMap })
}

let raf = 0
const scheduleSync = () => {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(syncLayout)
}

let observer: ResizeObserver

const observeSpans = () => {
  if (!observer || !pr_adaptive_grid_ref.value) return
  observer.observe(pr_adaptive_grid_ref.value)
  spanRefs.forEach((span) => observer.observe(span))
}

onMounted(async () => {
  observer = new ResizeObserver(scheduleSync)
  await nextTick()
  observeSpans()
  scheduleSync()
})

watch(
  () => [props.list, props.cols, props.rows, props.gap, props.padding],
  async () => {
    await nextTick()
    observeSpans()
    scheduleSync()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
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
  min-width: 0;
  min-height: 0;
  visibility: hidden;
  pointer-events: none;
}
.pr-adaptive-grid-item {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  opacity: 0;
  box-shadow: 0 0 0 1px #000000 inset;
  transition:
    transform 500ms ease-out,
    width 500ms ease-out,
    height 500ms ease-out;
  will-change: transform;
}
</style>
