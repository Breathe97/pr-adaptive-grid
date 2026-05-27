<template>
  <div id="app">
    <div class="debug-bar">
      <button type="button" class="debug-btn" @click="addItem">+ item</button>
      <button type="button" class="debug-btn" :disabled="list.length === 0" @click="removeItem">- item</button>
      <span class="debug-tip">Pin：固定到左侧 2/3，全局仅一个，切换 Pin 时旧项恢复</span>
    </div>
    <div class="grid-wrap">
      <PrAdaptiveGrid :list="list" :cols="COLS" :rows="ROWS" :gap="8" direction="right">
        <template #default="{ item }">
          <div class="item" :class="{ 'item-pinned': pinnedId === item.id }">
            <button type="button" class="item-pin-btn" :class="{ 'item-pin-btn-active': pinnedId === item.id }" @click.stop="togglePin(item.id)">
              {{ pinnedId === item.id ? 'Unpin' : 'Pin' }}
            </button>
            <span>{{ item.id }}</span>
            <span class="item-meta">{{ item.w }}×{{ item.h }} @({{ item.x }},{{ item.y }})</span>
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

const COLS = 4
const ROWS = 3

/** x/y = 网格起始列/行（0-based），w/h = 占据列/行数 */
const leftColSpan = () => Math.max(1, Math.round((COLS * 2) / 3))

const list = ref<GridItem[]>([
  { id: '1', x: 0, y: 0, w: 1, h: 1, sticky: true },
  { id: '2', x: 1, y: 0, w: 1, h: 1 },
  { id: '3', x: 2, y: 0, w: 1, h: 1 },
  { id: '4', x: 3, y: 0, w: 1, h: 1 },
  { id: '5', x: 0, y: 1, w: 1, h: 1 },
  { id: '6', x: 1, y: 1, w: 1, h: 1 },
  { id: '7', x: 2, y: 1, w: 1, h: 1 },
  { id: '8', x: 3, y: 1, w: 1, h: 1 },
  { id: '9', x: 0, y: 2, w: 1, h: 1 },
  { id: '10', x: 1, y: 2, w: 1, h: 1 },
  { id: '11', x: 2, y: 2, w: 1, h: 1 },
  { id: '12', x: 3, y: 2, w: 1, h: 1 }
])

const pinnedId = ref<string | null>(null)
const snapshotBeforePin = ref<GridItem[] | null>(null)

const cloneItem = (item: GridItem): GridItem => ({
  id: item.id,
  x: item.x,
  y: item.y,
  w: item.w,
  h: item.h,
  sticky: item.sticky
})

const cloneList = (items: GridItem[]) => items.map(cloneItem)

const canPlace = (occupied: boolean[][], x: number, y: number, w: number, h: number, cols: number, rows: number) => {
  if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (occupied[row][col]) return false
    }
  }
  return true
}

const markPlace = (occupied: boolean[][], x: number, y: number, w: number, h: number) => {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      occupied[row][col] = true
    }
  }
}

/** 在指定网格区域内按 right 方向自动排布 */
const autoLayout = (items: Pick<GridItem, 'id' | 'w' | 'h'>[], cols: number, rows: number, offsetX = 0): GridItem[] => {
  const occupied = Array.from({ length: rows }, () => Array(cols).fill(false))
  const result: GridItem[] = []

  for (const item of items) {
    let placed = false
    for (let y = 0; y < rows && !placed; y++) {
      for (let x = 0; x < cols && !placed; x++) {
        if (canPlace(occupied, x, y, item.w, item.h, cols, rows)) {
          markPlace(occupied, x, y, item.w, item.h)
          result.push({ id: item.id, x: x + offsetX, y, w: item.w, h: item.h })
          placed = true
        }
      }
    }
  }

  return result
}

const restoreSnapshot = () => {
  if (snapshotBeforePin.value) {
    list.value = cloneList(snapshotBeforePin.value)
  }
  pinnedId.value = null
  snapshotBeforePin.value = null
}

const applyPin = (id: string) => {
  const pinW = leftColSpan()
  const target = list.value.find((item) => item.id === id)!
  const others = list.value.filter((item) => item.id !== id).map((item) => ({ id: item.id, w: item.w, h: item.h }))
  const rightCols = COLS - pinW

  list.value = [{ ...cloneItem(target), x: 0, y: 0, w: pinW, h: ROWS }, ...autoLayout(others, rightCols, ROWS, pinW)]
}

const togglePin = (id: string) => {
  if (pinnedId.value === id) {
    restoreSnapshot()
    return
  }

  if (pinnedId.value !== null) {
    restoreSnapshot()
  }

  snapshotBeforePin.value = cloneList(list.value)
  applyPin(id)
  pinnedId.value = id
}

const addItem = () => {
  const id = String(list.value.length + 1)
  const next = [...list.value.map(cloneItem), { id, x: 0, y: 0, w: 1, h: 1 }]

  if (pinnedId.value !== null) {
    const pinW = leftColSpan()
    const pinned = next.find((item) => item.id === pinnedId.value)!
    const others = next.filter((item) => item.id !== pinnedId.value).map((item) => ({ id: item.id, w: item.w, h: item.h }))
    list.value = [{ ...pinned, x: 0, y: 0, w: pinW, h: ROWS }, ...autoLayout(others, COLS - pinW, ROWS, pinW)]
    snapshotBeforePin.value = cloneList(list.value)
    return
  }

  list.value = autoLayout(
    next.map((item) => ({ id: item.id, w: item.w, h: item.h })),
    COLS,
    ROWS
  )
}

const removeItem = () => {
  if (list.value.length === 0) return
  const removed = list.value[list.value.length - 1]
  const next = list.value.slice(0, -1).map(cloneItem)

  if (removed.id === pinnedId.value) {
    pinnedId.value = null
    snapshotBeforePin.value = null
    list.value = next
    return
  }

  if (pinnedId.value !== null) {
    const pinW = leftColSpan()
    const pinned = next.find((item) => item.id === pinnedId.value)!
    const others = next.filter((item) => item.id !== pinnedId.value).map((item) => ({ id: item.id, w: item.w, h: item.h }))
    list.value = [{ ...pinned, x: 0, y: 0, w: pinW, h: ROWS }, ...autoLayout(others, COLS - pinW, ROWS, pinW)]
    snapshotBeforePin.value = cloneList(list.value)
    return
  }

  list.value = next
}
</script>
<style scoped>
#app {
  position: relative;
  width: 100vw;
  height: 100vh;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.debug-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.debug-btn {
  padding: 4px 12px;
  cursor: pointer;
  border: 1px solid #31a8ff;
  background: rgba(9, 37, 71, 0.9);
  color: #fff;
  border-radius: 4px;
}
.debug-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.debug-tip {
  font-size: 12px;
  color: #888;
}
.grid-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
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
.item-pinned {
  color: #31a8ff;
}
.item-pin-btn {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #31a8ff;
  background: rgba(0, 0, 0, 0.5);
  color: #31a8ff;
  border-radius: 4px;
}
.item-pin-btn-active {
  background: #31a8ff;
  color: #fff;
}
.item-meta {
  font-size: 11px;
  color: #888;
}
</style>
