<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid" @scroll="onScroll">
    <div ref="pr_adaptive_grid_content_ref" class="pr-adaptive-grid-content" :style="ContainerStyle">
      <div v-for="(item, index) in layout.items" :key="index" class="pr-adaptive-grid-item-span" :data-grid-span-index="index" :style="ItemSpanStyle(item)"></div>
    </div>
    <PrAdaptiveGridItem v-for="(id, index) in itemIds" :key="id" :id="id" :geo="ItemGeo(index)">
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </PrAdaptiveGridItem>
  </div>
</template>

<script lang="ts" setup>
import PrAdaptiveGridItem from './PrAdaptiveGridItem.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type { Geo, GetLayoutFn, GridItemOptions, GridItemsOptions, Layout, LayoutCell } from '../../types'
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

const isReady = ref(false) // 是否准备就绪
const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] }) // 仅 span 占位几何
const size = ref({ width: 0, height: 0 }) // content 尺寸（行高与位移动画时长）
const scrollTop = ref(0) // .pr-adaptive-grid 的 scrollTop，Pin 定位用

const spanIds = ref<string[]>([]) // 当前渲染的span
const itemIds = ref<string[]>([]) // 当前渲染的item
const spanGeos = ref<Geo[]>([]) // 所有span的几何信息

// 获取所有span的几何信息
const getSpanGeos = async () => {
  if (pr_adaptive_grid_content_ref.value === undefined) return
  const spans = pr_adaptive_grid_content_ref.value.childNodes
  const _spanGeos = []
  for (const span of spans) {
    const { className, offsetTop, offsetLeft, clientWidth, clientHeight } = span as HTMLElement
    if (className !== 'pr-adaptive-grid-item-span') continue

    const cx = offsetLeft + clientWidth / 2
    const cy = offsetTop + clientHeight / 2

    const geo: Geo = { cx, cy, top: offsetTop, left: offsetLeft, width: clientWidth, height: clientHeight }

    _spanGeos.push(geo)
  }
  spanGeos.value = _spanGeos
  itemIds.value = [...spanIds.value]
}

const ItemGeo = computed(() => {
  return (index: number) => {
    const geo = spanGeos.value[index]
    return geo
  }
})

const LayoutKey = computed(() => {
  const { width, height } = size.value
  const ids = spanIds.value.join('&')
  const key = `${width}-${height}-${ids}`
  return key
})

const initLayout = async () => {
  if (isReady.value === false) return
  layout.value = props.getLayout(spanIds.value.length)
  await nextTick()
  getSpanGeos()
}

// 布局受外部变量实时变化
watch(
  () => LayoutKey.value,
  () => initLayout(),
  {}
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

/** 新增或更新 item；id 已存在时仅合并传入的 options */
const setItem = (id: string, option?: GridItemOptions) => {
  spanIds.value.push(id)
}

/** 按 ids 一次性设置 */
const setItems = (ids: string[], option?: GridItemsOptions) => {
  spanIds.value.push(...ids)
}

/** 移除 item 并重算布局 */
const removeItems = (removeIds: string[]) => {
  for (const id of removeIds) {
    const index = spanIds.value.findIndex((spanId) => spanId === id)
    if (index === -1) continue
    spanIds.value.splice(index, 1)
  }
}

/** 记录滚动偏移 */
const onScroll = () => {
  const el = pr_adaptive_grid_ref.value
  if (!el) return
  scrollTop.value = el.scrollTop
}

let observer: ResizeObserver // 监听 content 容器尺寸变化
let resizeTimer = 0 // resize debounce 定时器

/** 挂载后监听 content 容器尺寸变化 */
onMounted(async () => {
  await nextTick()

  let _size = { width: 0, height: 0 }

  observer = new ResizeObserver((sizes) => {
    const [{ contentRect }] = sizes
    const { width, height } = contentRect
    _size = { width, height }
    const setSize = () => {
      size.value = _size
    }
    if (isReady.value === false) {
      isReady.value = true
      return setSize()
    }
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(setSize, 500) // 节流
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
  --ag-ease-position: cubic-bezier(0.22, 1, 0.44, 1);
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
