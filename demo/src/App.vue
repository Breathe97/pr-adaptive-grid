<template>
  <div id="app">
    <div class="grid-wrap">
      <PrAdaptiveGrid :list="list" :cols="cols" :rows="rows" :gap="8">
        <template #default="{ item }">
          <div class="item" @click="() => setPin(item)">
            <span>{{ item.id }}</span>
            <span class="item-meta">w:{{ item.w }} h:{{ item.h }} @({{ item.x }},{{ item.y }})</span>
          </div>
        </template>
      </PrAdaptiveGrid>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { GridItem } from '../../src/index.ts'

const cols = ref(1)
const rows = ref(1)

const list = ref<GridItem[]>([])

const initUsers = (num = 1) => {
  const users = []
  for (let index = 0; index < num; index++) {
    users.push(`${index + 1}`)
  }
  return users
}

const setPin = (item: GridItem) => {
  cols.value = 6
  rows.value = 6
  item.x = 1
  item.w = 4
  item.y = 1
  item.h = 4
}

/** 在一行内按列数均分，生成等宽子项 */
const buildRow = (y: number, count: number, gridCols: number, ids: string[], offset: number): GridItem[] => {
  const w = gridCols / count
  return Array.from({ length: count }, (_, i) => ({
    id: ids[offset + i],
    x: 1 + i * w,
    y,
    w,
    h: 1
  }))
}

/** 按每行 item 数量生成完整布局 */
const buildLayout = (rowCounts: number[], gridCols: number, ids: string[]): GridItem[] => {
  const items: GridItem[] = []
  let offset = 0
  rowCounts.forEach((count, index) => {
    items.push(...buildRow(index + 1, count, gridCols, ids, offset))
    offset += count
  })
  return items
}

/** key: ids.length */
const LAYOUTS: Record<number, { cols: number; rows: number; rowCounts: number[] }> = {
  1: { cols: 1, rows: 1, rowCounts: [1] },
  2: { cols: 2, rows: 1, rowCounts: [2] },
  3: { cols: 3, rows: 1, rowCounts: [3] },
  4: { cols: 2, rows: 2, rowCounts: [2, 2] },
  5: { cols: 6, rows: 2, rowCounts: [2, 3] },
  6: { cols: 6, rows: 2, rowCounts: [3, 3] },
  7: { cols: 12, rows: 2, rowCounts: [3, 4] },
  8: { cols: 4, rows: 2, rowCounts: [4, 4] },
  9: { cols: 3, rows: 3, rowCounts: [3, 3, 3] },
  10: { cols: 12, rows: 3, rowCounts: [3, 4, 3] },
  11: { cols: 12, rows: 3, rowCounts: [3, 4, 4] },
  12: { cols: 4, rows: 3, rowCounts: [4, 4, 4] },
  13: { cols: 20, rows: 3, rowCounts: [4, 5, 4] },
  14: { cols: 20, rows: 3, rowCounts: [4, 5, 5] },
  15: { cols: 5, rows: 3, rowCounts: [5, 5, 5] }
}

const initLayout = (ids: string[]) => {
  const layout = LAYOUTS[ids.length]
  if (!layout) {
    list.value = []
    return
  }
  cols.value = layout.cols
  rows.value = layout.rows
  list.value = buildLayout(layout.rowCounts, layout.cols, ids)
}

const init = () => {
  const ids = initUsers(14)
  initLayout(ids)
}

init()
</script>
<style scoped>
#app {
  position: relative;
  width: 100vw;
  height: 100vh;
  padding: 8px;
  box-sizing: border-box;
}
.grid-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.item {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: red;
}
.item-meta {
  font-size: 11px;
  color: #888;
}
</style>
