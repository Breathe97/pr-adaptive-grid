<template>
  <div class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="item in Items" :key="`span-${item.id}`" class="pr-adaptive-grid-item-span" :data-item-id="item.id" :style="ItemSpanStyle(item)">{{ item.id }}</div>
      <div v-for="item in Items" :key="`item-${item.id}`" class="pr-adaptive-grid-item" :style="ItemStyle(item.id)">
        <div class="pr-adaptive-grid-item-inner" :style="ItemInnerStyle(item.id)">
          <!-- <slot :item="item" /> -->
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'
import type { PropType } from 'vue'
import type { Layout, LayoutItem } from '../../types'

const props = defineProps({
  layout: {
    type: Object as PropType<Layout>,
    default: () => 0
  }
})

const pr_adaptive_grid_content_ref = ref<HTMLElement>()

const size = reactive({ x: 0, y: 0, width: 0, height: 0 })

const Items = computed(() => props.layout.items)

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
  return (id: string) => {
    const config = mapItemStyle.value.get(id)
    if (!config) return {}
    const { x, y } = config
    return {
      transform: `translate3d(${x}px,${y}px,0)`
    }
  }
})

const ItemInnerStyle = computed(() => {
  return (id: string) => {
    const config = mapItemStyle.value.get(id)
    if (!config) return {}
    const { width, height } = config
    return {
      width: `${width}px`,
      height: `${height}px`
    }
  }
})

const syncItemsLayout = async () => {
  await nextTick()
  if (!pr_adaptive_grid_content_ref.value) return
  for (const item of Items.value) {
    const { id } = item
    const selector = `data-item-id="${id}"`
    const itemSpan = pr_adaptive_grid_content_ref.value.querySelector(`[${selector}]`)
    if (!itemSpan) continue
    const { x, y, width, height } = itemSpan.getBoundingClientRect()
    mapItemStyle.value.set(id, { x: x - size.x, y: y - size.y, width, height })
  }
}

const onScroll = () => {}

const init = () => {}

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

watch(
  () => props.layout,
  () => syncSize(),
  {
    immediate: true
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
  background-color: rgba(200, 200, 200, 0.1);
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
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
  will-change: transform;
}

.pr-adaptive-grid-item-inner {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
  background-color: #0097ff;
  transition:
    transform var(--ag-duration-position) var(--ag-ease-fade),
    opacity var(--ag-duration-position) var(--ag-ease-fade);
}

.pr-adaptive-grid-item-enter-host {
  transition:
    width var(--ag-duration-enter-size) var(--ag-ease-size),
    height var(--ag-duration-enter-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-enter-host .pr-adaptive-grid-item-inner {
  transition:
    transform var(--ag-duration-enter) var(--ag-ease-fade),
    opacity var(--ag-duration-enter) var(--ag-ease-fade);
}

.pr-adaptive-grid-item-leaving {
  z-index: 15;
  pointer-events: none;
  transition: none;
}

.pr-adaptive-grid-item-leaving .pr-adaptive-grid-item-inner {
  transition:
    transform var(--ag-duration-exit) var(--ag-ease-fade),
    opacity var(--ag-duration-exit) var(--ag-ease-fade);
}

.pr-adaptive-grid-item-layout-anim {
  transition:
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-sticky {
  z-index: 2;
  transition:
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-sticky.pr-adaptive-grid-item-layout-anim {
  transition:
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-no-transition {
  transition: none !important;
}

.pr-adaptive-grid-item-dragging,
.pr-adaptive-grid-item-dragging.pr-adaptive-grid-item-layout-anim {
  z-index: 20;
  cursor: grabbing;
  will-change: transform;
  transition:
    transform 0s linear,
    width 0s linear,
    height 0s linear;
}

.pr-adaptive-grid-item-dragging-release,
.pr-adaptive-grid-item-dragging-release.pr-adaptive-grid-item-layout-anim {
  z-index: 20;
  cursor: grabbing;
  will-change: transform, width, height;
  transition:
    transform var(--ag-duration-position) var(--ag-ease-position),
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}

.pr-adaptive-grid-item-sticky .pr-adaptive-grid-item-inner {
  cursor: default;
  touch-action: auto;
}

.pr-adaptive-grid-sortable .pr-adaptive-grid-item-sticky .pr-adaptive-grid-item-inner {
  cursor: grab;
  touch-action: none;
}

.pr-adaptive-grid-item-fixed .pr-adaptive-grid-item-inner,
.pr-adaptive-grid-sortable .pr-adaptive-grid-item-fixed .pr-adaptive-grid-item-inner {
  cursor: default;
  touch-action: auto;
}

.pr-adaptive-grid-item-drop-target .pr-adaptive-grid-item-inner {
  box-shadow: inset 0 0 0 2px rgba(22, 119, 255, 0.85);
}
</style>
