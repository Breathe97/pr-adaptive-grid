<template>
  <div id="app">
    <div class="grid-wrap">
      <PrAdaptiveGrid
        ref="gridRef"
        :list="list"
        :cols="cols"
        :rows="rows"
        :gap="8"
        :first-screen-row-split="firstScreenRowSplit"
        @reorder="onReorder"
      >
        <template #default="{ item }">
          <div class="item" :class="{ 'item-pinned': item.sticky }" :style="{ backgroundColor: getItemColor(item.id) }" @click="() => setPin(item)">
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
      <button type="button" class="toolbar-shuffle-btn" :disabled="userCount <= 1" @click="shuffleItems">打乱</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { GridItem, GridReorderPayload, PrAdaptiveGridExpose } from '../../src/index.ts'
import { getLayout } from './getLayout'

const gridRef = ref<PrAdaptiveGridExpose>()

const cols = ref(1)
const rows = ref(1)
const firstScreenRowSplit = ref<number>()
const list = ref<GridItem[]>([])

const userCount = ref(1)
const layoutMode = ref<'1' | '2'>('1')
const currentIds = ref<string[]>([])
const pinId = ref<string>()
const itemColorMap = ref(new Map<string, string>())

const randomItemColor = (): string => {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue} 65% 82%)`
}

const ensureItemColors = (ids: string[]) => {
  const next = new Map(itemColorMap.value)
  for (const id of ids) {
    if (!next.has(id)) {
      next.set(id, randomItemColor())
    }
  }
  itemColorMap.value = next
}

const getItemColor = (id: string): string => itemColorMap.value.get(id) ?? '#f5f5f5'

const initUsers = (num = 1) => {
  const users: string[] = []
  for (let index = 0; index < num; index++) {
    users.push(`${index + 1}`)
  }
  return users
}

const applyLayout = (ids: string[], mode: '1' | '2' = '1') => {
  ensureItemColors(ids)
  // 开启 pin 时固定走 mode2（左侧 fullId + 右侧列表）
  const effectiveMode: '1' | '2' = pinId.value ? '2' : mode
  const layout = getLayout(ids, effectiveMode, pinId.value ? { fullId: pinId.value } : undefined)
  cols.value = layout.cols
  rows.value = layout.rows
  firstScreenRowSplit.value = layout.firstScreenRowSplit
  list.value = layout.list.map((item) => ({
    ...item,
    sticky: pinId.value === item.id
  }))
}

const setPin = (item: GridItem) => {
  gridRef.value?.settleActiveAnimations()
  pinId.value = pinId.value === item.id ? undefined : item.id
  applyLayout(currentIds.value, layoutMode.value)
}

const onReorder = ({ ids }: GridReorderPayload) => {
  currentIds.value = ids
  applyLayout(ids, layoutMode.value)
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

const shuffleArray = <T,>(arr: T[]): T[] => {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

const shuffleItems = () => {
  if (currentIds.value.length <= 1) return

  gridRef.value?.settleActiveAnimations()

  let shuffled = shuffleArray(currentIds.value)
  if (shuffled.length === 2 && shuffled[0] === currentIds.value[0]) {
    shuffled = [...currentIds.value].reverse()
  }

  currentIds.value = shuffled
  applyLayout(shuffled, layoutMode.value)
}

const init = () => {
  pinId.value = undefined
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
  border-radius: 12px;
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
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  z-index: 30;
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
.toolbar-shuffle-btn {
  height: 40px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: #1677ff;
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.toolbar-shuffle-btn:disabled {
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
