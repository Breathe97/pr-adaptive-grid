<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" :style="ContainerStyle" @scroll="onScroll">
    <div v-for="item in list" :key="`span-${item.id}`" class="pr-adaptive-grid-item-span" :style="[ItemSpanStyle(item)]">{{ item.id }}</div>

    <!-- <div v-for="item in list" :key="`item-${item.id}`" class="pr-adaptive-grid-item" :class="{ 'pr-adaptive-grid-item-sticky': item.sticky }" :style="StyleItem(item.id)">
      <slot :item="item" />
    </div> -->
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
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

const contentLayoutMap = reactive(new Map<string, GridLayoutRect>())

const ContainerStyle = computed(() => {
  const { gap, rows, cols } = props
  return {
    gap: `${gap}px`,
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

const syncLayout = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return

  const { width, height } = container.getBoundingClientRect()
  if (!width || !height) return
}

const updateStickyOnScroll = () => {
  const container = pr_adaptive_grid_ref.value
  if (!container) return

  for (const item of props.list) {
    if (!item.sticky) continue
    const layout = contentLayoutMap.get(item.id)
    if (!layout) continue
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  grid-auto-rows: auto;
}
.pr-adaptive-grid-item-span {
  pointer-events: none;
  background-color: rgb(128, 128, 128);
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
  transition:
    transform 300ms ease-out,
    width 300ms ease-out,
    height 300ms ease-out;
  will-change: transform;
  box-shadow: 0 0 0 1px #ff0000 inset;
}
.pr-adaptive-grid-item-sticky {
  transition:
    width 300ms ease-out,
    height 300ms ease-out;
}
</style>
