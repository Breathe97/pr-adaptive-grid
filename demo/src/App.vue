<template>
  <div id="app">
    <div class="grid-wrap">
      <PrAdaptiveGrid :list="list" :cols="cols" :rows="rows" :gap="8">
        <template #default="{ item }">
          <div class="item">
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

/** 在一行内按列数均分，生成等宽子项 */
const buildRow = (y: number, count: number, cols: number, startId: number): GridItem[] => {
  const w = cols / count
  return Array.from({ length: count }, (_, i) => ({
    id: String(startId + i),
    x: 1 + i * w,
    y,
    w,
    h: 1
  }))
}

const initLayout = (ids: string[]) => {
  let _list: GridItem[] = []

  const length = ids.length

  switch (length) {
    case 1:
      {
        cols.value = 1
        rows.value = 1
        _list = [{ id: ids[0], x: 1, y: 1, w: 1, h: 1 }]
      }
      break
    case 2:
      {
        cols.value = 2
        rows.value = 1
        _list = [
          { id: '1', x: 1, y: 1, w: 1, h: 1 },
          { id: '1', x: 2, y: 1, w: 1, h: 1 }
        ]
      }
      break
    case 3:
      {
        cols.value = 3
        rows.value = 1
        _list = [
          { id: '1', x: 1, y: 1, w: 1, h: 1 },
          { id: '2', x: 2, y: 1, w: 1, h: 1 },
          { id: '3', x: 3, y: 1, w: 1, h: 1 }
        ]
      }
      break
    case 4:
      {
        cols.value = 2
        rows.value = 2
        _list = [
          { id: '1', x: 1, y: 1, w: 1, h: 1 },
          { id: '2', x: 2, y: 1, w: 1, h: 1 },
          { id: '3', x: 1, y: 1, w: 1, h: 1 },
          { id: '4', x: 2, y: 2, w: 1, h: 1 }
        ]
      }
      break
    case 5:
      {
        cols.value = 6
        rows.value = 2
        _list = [
          { id: '1', x: 1, y: 1, w: 3, h: 1 },
          { id: '2', x: 4, y: 1, w: 3, h: 1 },
          { id: '3', x: 1, y: 2, w: 2, h: 1 },
          { id: '4', x: 3, y: 2, w: 2, h: 1 },
          { id: '5', x: 5, y: 2, w: 2, h: 1 }
        ]
      }
      break
    case 6:
      {
        cols.value = 6
        rows.value = 2
        _list = [
          { id: '1', x: 1, y: 1, w: 2, h: 1 },
          { id: '2', x: 3, y: 1, w: 2, h: 1 },
          { id: '3', x: 5, y: 1, w: 2, h: 1 },
          { id: '4', x: 1, y: 2, w: 2, h: 1 },
          { id: '5', x: 3, y: 2, w: 2, h: 1 },
          { id: '6', x: 5, y: 2, w: 2, h: 1 }
        ]
      }
      break
    case 7:
      {
        cols.value = 12
        rows.value = 2
        _list = [...buildRow(1, 3, 12, 1), ...buildRow(2, 4, 12, 4)]
      }
      break
    case 8:
      {
        cols.value = 4
        rows.value = 2
        _list = [...buildRow(1, 4, 4, 1), ...buildRow(2, 4, 4, 5)]
      }
      break
    case 9:
      {
        cols.value = 3
        rows.value = 3
        _list = [...buildRow(1, 3, 3, 1), ...buildRow(2, 3, 3, 4), ...buildRow(3, 3, 3, 7)]
      }
      break
    case 10:
      {
        cols.value = 12
        rows.value = 3
        _list = [...buildRow(1, 3, 12, 1), ...buildRow(2, 4, 12, 4), ...buildRow(3, 3, 12, 8)]
      }
      break
    case 11:
      {
        cols.value = 12
        rows.value = 3
        _list = [...buildRow(1, 3, 12, 1), ...buildRow(2, 4, 12, 4), ...buildRow(3, 4, 12, 8)]
      }
      break
    case 12:
      {
        cols.value = 4
        rows.value = 3
        _list = [...buildRow(1, 4, 4, 1), ...buildRow(2, 4, 4, 5), ...buildRow(3, 4, 4, 9)]
      }
      break
    case 13:
      {
        cols.value = 20
        rows.value = 3
        _list = [...buildRow(1, 4, 20, 1), ...buildRow(2, 5, 20, 5), ...buildRow(3, 4, 20, 10)]
      }
      break
    case 14:
      {
        cols.value = 20
        rows.value = 3
        _list = [...buildRow(1, 4, 20, 1), ...buildRow(2, 5, 20, 5), ...buildRow(3, 5, 20, 10)]
      }
      break
    case 15:
      {
        cols.value = 5
        rows.value = 3
        _list = [...buildRow(1, 5, 5, 1), ...buildRow(2, 5, 5, 6), ...buildRow(3, 5, 5, 11)]
      }
      break

    default:
      break
  }
  list.value = _list
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
