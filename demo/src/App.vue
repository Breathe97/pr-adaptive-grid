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
import { getLayout } from './getLayout'

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

const currentIds = ref<string[]>([])
const fullId = ref<string>()

const applyLayout = (ids: string[], mode: '1' | '2' = '1', pinId?: string) => {
  const layout = getLayout(ids, mode, pinId ? { fullId: pinId } : undefined)
  cols.value = layout.cols
  rows.value = layout.rows
  list.value = layout.list
}

const setPin = (item: GridItem) => {
  fullId.value = item.id
  applyLayout(currentIds.value, '2', item.id)
}

const initLayout = (ids: string[], mode: '1' | '2' = '1') => {
  currentIds.value = ids
  applyLayout(ids, mode, fullId.value)
}

const init = () => {
  const ids = initUsers(9)
  fullId.value = '1'
  initLayout(ids, '2')
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
