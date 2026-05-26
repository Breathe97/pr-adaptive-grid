<template>
  <div ref="pr_adaptive_grid_ref" class="pr-adaptive-grid"></div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
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

const onResize = (e: ResizeObserverCallback) => {}

let observer: ResizeObserver
onMounted(async () => {
  // 创建dom监听
  const createObserver = () => {
    observer = new ResizeObserver((items) => {
      console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: items`, items)
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
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
