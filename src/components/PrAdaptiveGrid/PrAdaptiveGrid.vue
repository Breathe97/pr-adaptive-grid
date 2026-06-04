<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="(item, index) in layout.items" :key="index" class="pr-adaptive-grid-item-span" :data-grid-span-index="index" :style="ItemSpanStyle(item)"></div>
      <!-- <PrAdaptiveGridItem v-for="id in renderIds" :key="id" :geo="Geo(id)"></PrAdaptiveGridItem> -->
    </div>
  </div>
</template>

<script lang="ts" setup>
import PrAdaptiveGridItem from './PrAdaptiveGridItem.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'
import type { PropType } from 'vue'
import type { GetLayoutFn, GridItemOptions, GridItemsOptions, Layout, LayoutCell } from '../../types'
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

const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] }) // 仅 span 占位几何
const size = ref({ width: 0, height: 0 }) // content 尺寸（行高与位移动画时长）
const scrollTop = ref(0) // .pr-adaptive-grid 的 scrollTop，Pin 定位用

const renderIds = ref<string[]>([]) // 当前渲染的item

const initLayout = () => {
  layout.value = props.getLayout(renderIds.value.length)
}

const Geo = computed(() => {
  return (id: string) => {}
})

const RenderKey = computed(() => {
  const { width, height } = size.value
  const ids = renderIds.value.join('&')
  return `${width}-${height}-${ids}`
})

// 布局受外部变量实时变化
watch(
  () => RenderKey.value,
  () => initLayout()
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

let resizeTimer: ReturnType<typeof setTimeout> | undefined // resize debounce 定时器

/** 新增或更新 item；id 已存在时仅合并传入的 options */
const setItem = (id: string, option?: GridItemOptions) => {
  renderIds.value.push(id)
}

/** 按 ids 一次性设置 */
const setItems = (ids: string[], option?: GridItemsOptions) => {
  renderIds.value.push(...ids)
}

/** 移除 item 并重算布局 */
const removeItems = (removeIds: string[]) => {}

/** 记录滚动偏移 */
const onScroll = () => {
  const el = pr_adaptive_grid_ref.value
  if (!el) return
  scrollTop.value = el.scrollTop
}

let observer: ResizeObserver // 监听 content 容器尺寸变化

/** 挂载后监听 content 容器尺寸变化 */
onMounted(async () => {
  await nextTick()
  observer = new ResizeObserver((sizes) => {
    const [{ contentRect }] = sizes
    const { width, height } = contentRect
    size.value = { width, height }
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
  --ag-duration-position: 700ms;
  --ag-duration-size: 500ms;
  --ag-duration-enter: 500ms;
  --ag-duration-exit: 500ms;
  --ag-enter-scale: 0;
  --ag-ease-position: cubic-bezier(0.22, 1, 0.44, 1);
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
  min-width: 0;
  min-height: 0;
  grid-auto-flow: row dense;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 1px red inset;
  pointer-events: none;
}
</style>
