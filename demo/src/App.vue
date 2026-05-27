<template>
  <div id="app">
    <div class="grid-wrap">
      <PrAdaptiveGrid :list="list" :cols="cols" :rows="rows" :gap="8">
        <template #default="{ item }">
          <div class="item" :class="{ 'item-pinned': item.sticky }" @click="() => setPin(item)">
            <span>{{ item.id }}</span>
            <span class="item-meta">w:{{ item.w }} h:{{ item.h }} @({{ item.x }},{{ item.y }})</span>
          </div>
        </template>
      </PrAdaptiveGrid>
    </div>
    <div class="toolbar">
      <button type="button" class="toolbar-btn" :disabled="userCount <= 1" @click="changeUserCount(-1)">−</button>
      <span class="toolbar-count">{{ userCount }}</span>
      <button type="button" class="toolbar-btn" @click="changeUserCount(1)">+</button>
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

const userCount = ref(1)
const layoutMode = ref<'1' | '2'>('1')
const currentIds = ref<string[]>([])
const pinId = ref<string>()

const initUsers = (num = 1) => {
  const users: string[] = []
  for (let index = 0; index < num; index++) {
    users.push(`${index + 1}`)
  }
  return users
}

const applyLayout = (ids: string[], mode: '1' | '2' = '1') => {
  const layout = getLayout(ids, mode, pinId.value && mode === '2' ? { fullId: pinId.value } : undefined)
  cols.value = layout.cols
  rows.value = layout.rows
  list.value = layout.list.map((item) => ({
    ...item,
    sticky: pinId.value === item.id
  }))
}

const setPin = (item: GridItem) => {
  pinId.value = pinId.value === item.id ? undefined : item.id
  applyLayout(currentIds.value, layoutMode.value)
}

const initLayout = (ids: string[], mode: '1' | '2' = '1') => {
  currentIds.value = ids
  layoutMode.value = mode
  applyLayout(ids, mode)
}

const changeUserCount = (delta: number) => {
  const next = Math.max(1, userCount.value + delta)
  if (next === userCount.value) return

  userCount.value = next
  const ids = initUsers(next)

  if (pinId.value && !ids.includes(pinId.value)) {
    pinId.value = undefined
  }

  initLayout(ids, layoutMode.value)
}

const init = () => {
  pinId.value = '1'
  initLayout(initUsers(userCount.value), layoutMode.value)
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
  cursor: pointer;
}
.item-pinned {
  color: #1677ff;
}
.item-meta {
  font-size: 11px;
  color: #888;
}
.toolbar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 10;
}
.toolbar-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.toolbar-btn:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}
.toolbar-count {
  min-width: 28px;
  text-align: center;
  font-size: 16px;
  color: #333;
}
</style>
