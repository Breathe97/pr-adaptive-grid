<template>
  <div class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="item in Items" :key="`span-${item.id}`" class="pr-adaptive-grid-item-span" :data-item-id="item.id" :style="ItemSpanStyle(item)">{{ item.id }}</div>
      <div v-for="item in Items" :key="`item-${item.id}`" class="pr-adaptive-grid-item" :class="[itemClass(item.id)]" :style="ItemStyle(item.id)">
        <div class="pr-adaptive-grid-item-inner" :class="[innerClass(item.id)]" :style="ItemInnerStyle(item.id)" @transitionend="(e) => animationend(e, item.id)">
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

const props = defineProps({
  layout: {
    type: Object as PropType<Layout>,
    default: () => 0
  }
})

const pr_adaptive_grid_content_ref = ref<HTMLElement>()

const layoutReady = ref(false)

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
    const { x, y, width, height } = config
    const cx = x + width / 2
    const cy = y + height / 2
    return {
      transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
    }
  }
})

const ItemInnerStyle = computed(() => {
  return (id: string) => {
    const config = mapItemStyle.value.get(id)
    if (!config) return {}
    const { width, height } = config
    const style: Record<string, string> = {
      width: `${width}px`,
      height: `${height}px`
    }
    return style
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

  const next = new Map<string, { x: number; y: number; width: number; height: number }>()

  for (const item of Items.value) {
    const { id } = item
    const selector = `data-item-id="${id}"`
    const itemSpan = pr_adaptive_grid_content_ref.value.querySelector(`[${selector}]`)
    if (!itemSpan) continue
    const { x, y, width, height } = itemSpan.getBoundingClientRect()
    next.set(id, { x: x - size.x, y: y - size.y, width, height })
  }

  layoutAnimIds.value = new Set(Items.value.map((i) => i.id)) // 标记需要执行动画
  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: syncItemsLayout`, next)
  mapItemStyle.value = next

  if (layoutReady.value === false) {
    await new Promise((r) => requestAnimationFrame(r)) // 可选，更稳
    prevIds.value = Items.value.map((i) => i.id)
    layoutReady.value = true
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

const itemClass = (id: string) => ({
  'pr-adaptive-grid-item-layout-anim': layoutAnimIds.value.has(id),
  'pr-adaptive-grid-item-no-transition': layoutReady.value === false
})

const innerClass = () => ({
  'pr-adaptive-grid-item-no-transition': layoutReady.value === false
})

const animationend = (e: TransitionEvent, id: string) => {}

watch(
  () => props.layout.items.map((i) => i.id).join(','),
  async () => {
    const nextIds = props.layout.items.map((i) => i.id)
    // 首屏：不要对全部 id 做 enter
    if (prevIds.value.length === 0) {
      await syncSize()
      prevIds.value = nextIds
      return
    }
    prevIds.value = nextIds
    await syncSize()
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
  --ag-duration-enter-size: 320ms;
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
</style>
