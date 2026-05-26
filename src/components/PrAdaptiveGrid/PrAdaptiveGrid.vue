<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid">
    <div class="pr-adaptive-grid-item" v-for="item in list" :key="item.id" :style="[StyleItem(item.id)]">
      <slot :item="item" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { ListItem } from '../../types'

const emit = defineEmits(['change'])

const props = defineProps({
  // 子元素
  list: {
    type: Array<ListItem>,
    required: true
  }
})

const pr_adaptive_grid_ref = ref()

const viewSize = reactive({ width: 0, height: 0 })

const styleMap = reactive(new Map())

const StyleItem = computed(() => {
  return function (id: string) {
    return styleMap.get(id)
  }
})

const initStyle = () => {
  const { list } = props
  for (const item of list) {
    const { id, w, h } = item
    const style = { width: `${w}px`, height: `${h}px` }
    styleMap.set(id, style)
  }
}

watch(
  () => viewSize,
  () => initStyle(),
  {
    deep: true
  }
)

let timer = 0
let observer: ResizeObserver
onMounted(async () => {
  // 创建dom监听
  const createObserver = () => {
    observer = new ResizeObserver((items) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const [dom] = items
        const { contentRect } = dom
        const { width, height } = contentRect
        viewSize.width = width
        viewSize.height = height
      }, 100)
    })
    observer.observe(pr_adaptive_grid_ref.value, { box: 'border-box' })
  }
  createObserver()
})

onBeforeUnmount(() => {
  observer.disconnect()
})
</script>

<style scoped>
.pr-adaptive-grid {
  padding: 8px;
  box-sizing: border-box;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  gap: 8px;
}
.pr-adaptive-grid-item {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  margin: auto;
  opacity: 0;
  box-shadow: 0 0 0 1px #000000 inset;
}
</style>
