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

const initLayout = (num = 1) => {
  let _list: GridItem[] = []
  switch (num) {
    case 1:
      {
        cols.value = 1
        rows.value = 1
        _list = [{ id: '1', x: 1, y: 1, w: 1, h: 1 }]
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
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 8:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 9:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 10:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 11:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 12:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 13:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 14:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break
    case 15:
      {
        cols.value = 6
        rows.value = 2
        _list = []
      }
      break

    default:
      break
  }
  list.value = _list
}

initLayout(6)
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
