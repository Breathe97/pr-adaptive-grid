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

  const next = new Map<string, { x: number; y: number; width: number; height: number }>()

  for (const item of Items.value) {
    const { id } = item
    const selector = `data-item-id="${id}"`
    const itemSpan = pr_adaptive_grid_content_ref.value.querySelector(`[${selector}]`)
    if (!itemSpan) continue
    const { x, y, width, height } = itemSpan.getBoundingClientRect()
    next.set(id, { x: x - size.x, y: y - size.y, width, height })
  }

  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: syncItemsLayout`, next)
  mapItemStyle.value = next
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
  () => syncSize()
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
  --ag-duration-position: 500ms;
  --ag-duration-size: 280ms;
  --ag-duration-enter: 220ms;
  --ag-duration-exit: 180ms;
  --ag-duration-enter-size: 320ms;
  --ag-ease-position: cubic-bezier(0.22, 1, 0.36, 1);
  --ag-ease-size: cubic-bezier(0.22, 1, 0.36, 1);
  --ag-ease-fade: cubic-bezier(0.4, 0, 0.2, 1);

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
  box-shadow: 0 0 0 1px red inset;
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
  transition: transform var(--ag-duration-position) var(--ag-ease-position);
  will-change: transform;
}

.pr-adaptive-grid-item-inner {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
  background-color: rgba(0, 151, 255, 0.9);
  transition:
    transform var(--ag-duration-position) var(--ag-ease-fade),
    opacity var(--ag-duration-position) var(--ag-ease-fade);
}
</style>
