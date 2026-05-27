<template>
  <div id="app">
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
  { id: '12', x: 3, y: 2, w: 1, h: 1 },
  { id: '13', x: 4, y: 0, w: 1, h: 1 }
])

const pinnedId = ref<string | null>(null)

const togglePin = (id: string) => {}
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
