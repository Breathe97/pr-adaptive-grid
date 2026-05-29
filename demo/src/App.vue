<template>
  <div id="app">
    <div class="grid-wrap">
      <PrAdaptiveGrid ref="gridRef" :gap="8">
        <template #default="{ item }">
          <div class="item" :class="{ 'item-pinned': item.sticky, 'item-fixed': item.fixed }" :style="{ backgroundColor: getItemColor(item.id) }">
            <div class="item-info">
              <span class="item-id">{{ item.id }}</span>
              <span class="item-meta">w:{{ item.w }} h:{{ item.h }} @({{ item.x }},{{ item.y }})</span>
            </div>
            <div class="item-actions">
              <button type="button" class="item-action-btn item-action-btn-pin" :class="{ active: item.sticky }" @pointerdown.stop @click.stop="setPin(item)">Pin</button>
              <button type="button" class="item-action-btn item-action-btn-fixed" :class="{ active: item.fixed }" @pointerdown.stop @click.stop="setFixed(item)">Fixed</button>
            </div>
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
import { ref, onMounted } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { GridItem, PrAdaptiveGridExpose } from '../../src/index.ts'

const gridRef = ref<PrAdaptiveGridExpose>()

const userCount = ref(8)
const itemColorMap = ref(new Map<string, string>())

const randomItemColor = (): string => {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue} 65% 82%)`
}

const ensureItemColor = (id: string) => {
  if (itemColorMap.value.has(id)) return
  const next = new Map(itemColorMap.value)
  next.set(id, randomItemColor())
  itemColorMap.value = next
}

const getItemColor = (id: string): string => itemColorMap.value.get(id) ?? '#f5f5f5'

const createUserIds = (count: number) => Array.from({ length: count }, (_, i) => `${i + 1}`)

const setPin = (item: GridItem) => {
  gridRef.value?.settleActiveAnimations()
  gridRef.value?.setItem(item.id, { sticky: !item.sticky })
}

const setFixed = (item: GridItem) => {
  gridRef.value?.settleActiveAnimations()
  gridRef.value?.setItem(item.id, { fixed: !item.fixed })
}

const changeUserCount = (delta: number) => {
  const next = Math.max(1, userCount.value + delta)
  if (next === userCount.value) return

  userCount.value = next
  gridRef.value?.settleActiveAnimations()

  const items = gridRef.value?.getItems() ?? []

  if (delta < 0) {
    const removeIndex = Math.floor(Math.random() * items.length)
    gridRef.value?.removeItem(items[removeIndex].id)
    return
  }

  const maxId = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0)
  const newId = `${maxId + 1}`
  ensureItemColor(newId)
  gridRef.value?.setItem(newId, { index: 0 })
}

const shuffleItems = () => {
  const items = gridRef.value?.getItems() ?? []
  if (items.length <= 1) return

  gridRef.value?.recordDebug('demo:shuffle:click', {
    scrollTop: document.querySelector('.pr-adaptive-grid')?.scrollTop ?? 0,
    itemCount: items.length
  })

  gridRef.value?.settleActiveAnimations()
  gridRef.value?.shuffleItems()

  gridRef.value?.recordDebug('demo:shuffle:done', {
    itemCount: gridRef.value?.getItems().length ?? 0
  })
}

const initGrid = () => {
  const ids = createUserIds(userCount.value)
  ids.forEach((id) => ensureItemColor(id))
  gridRef.value?.setItems(
    ids.map((id, index) => (index === 0 ? { id, options: { sticky: true, fixed: true } } : { id }))
  )
}

onMounted(() => {
  initGrid()

  if (!import.meta.env.DEV) return
  ;(window as Window & { __agDebug?: { start: () => void; end: () => string } }).__agDebug = {
    start: () => gridRef.value?.startDebugCapture(),
    end: () => gridRef.value?.endDebugCapture() ?? '{"error":"grid not ready"}'
  }
})
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
  gap: 12px;
  color: red;
  border-radius: 12px;
  box-sizing: border-box;
  padding: 8px;
}
.item-pinned {
  color: #1677ff;
}
.item-fixed {
  box-shadow: inset 0 0 0 2px rgba(250, 140, 22, 0.85);
}
.item-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.item-id {
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
}
.item-meta {
  font-size: 11px;
  color: #888;
  text-align: center;
}
.item-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
}
.item-action-btn {
  min-width: 52px;
  padding: 6px 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #444;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}
.item-action-btn:hover {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.item-action-btn-pin.active {
  border-color: #1677ff;
  color: #1677ff;
  background: rgba(22, 119, 255, 0.14);
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.2);
}
.item-action-btn-fixed.active {
  border-color: #fa8c16;
  color: #d46b08;
  background: rgba(250, 140, 22, 0.14);
  box-shadow: 0 2px 8px rgba(250, 140, 22, 0.2);
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
