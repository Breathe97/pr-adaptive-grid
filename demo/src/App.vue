<template>
  <div class="demo">
    <div class="grid-wrap">
      <PrAdaptiveGrid ref="gridRef" :gap="8">
        <template #default="{ item }">
          <div
            class="tile"
            :class="{ 'is-pinned': item.sticky, 'is-fixed': item.fixed }"
            :style="{ backgroundColor: getTileColor(item.id) }"
          >
            <div v-if="item.sticky || item.fixed" class="tile-badges">
              <span v-if="item.sticky" class="badge badge-pin">📌 Pin</span>
              <span v-if="item.fixed" class="badge badge-fixed">🔒 Fixed</span>
            </div>
            <span class="tile-id">{{ item.id }}</span>
            <span class="tile-meta">{{ item.w }}×{{ item.h }}</span>
            <div class="tile-ops">
              <button
                type="button"
                class="op"
                :class="{ active: item.sticky }"
                @pointerdown.stop
                @click.stop="setPin(item)"
              >
                Pin
              </button>
              <span class="op-dot" />
              <button
                type="button"
                class="op"
                :class="{ active: item.fixed }"
                @pointerdown.stop
                @click.stop="setFixed(item)"
              >
                Fixed
              </button>
            </div>
          </div>
        </template>
      </PrAdaptiveGrid>
    </div>

    <div class="float-bar">
      <button type="button" class="bar-btn" :disabled="userCount <= 1" @click="changeUserCount(-1)">−</button>
      <span class="bar-count">{{ userCount }}</span>
      <button type="button" class="bar-btn" @click="changeUserCount(1)">+</button>
      <span class="bar-sep" />
      <button type="button" class="bar-text" :disabled="userCount <= 1" @click="shuffleItems">打乱</button>
      <button type="button" class="bar-text" @click="syncGrid">同步</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { GridItem, PrAdaptiveGridExpose } from '../../src/index.ts'

const DEFAULT_USER_COUNT = 8

const gridRef = ref<PrAdaptiveGridExpose>()
const userCount = ref(DEFAULT_USER_COUNT)
const tileColorMap = ref(new Map<string, string>())

/** 高饱和度随机色，亮度偏高以对比黑色背景 */
const pickContrastColor = (): string => {
  const hue = Math.floor(Math.random() * 360)
  const sat = 88 + Math.floor(Math.random() * 13)
  const light = 65 + Math.floor(Math.random() * 14)
  return `hsl(${hue} ${sat}% ${light}%)`
}

const ensureTileColor = (id: string) => {
  if (tileColorMap.value.has(id)) return
  const next = new Map(tileColorMap.value)
  next.set(id, pickContrastColor())
  tileColorMap.value = next
}

const getTileColor = (id: string): string => tileColorMap.value.get(id) ?? 'hsl(210 95% 72%)'

const createUserIds = (count: number) => Array.from({ length: count }, (_, i) => `${i + 1}`)

const getDefaultIds = () => createUserIds(DEFAULT_USER_COUNT)

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
  ensureTileColor(newId)
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
  getDefaultIds().forEach((id) => ensureTileColor(id))
  gridRef.value?.setItems(
    getDefaultIds().map((id, index) => {
      if (index === 0) return { id, options: { sticky: true } }
      if (index === 1) return { id, options: { fixed: true } }
      return { id }
    })
  )
}

const syncGrid = () => {
  gridRef.value?.settleActiveAnimations()
  userCount.value = DEFAULT_USER_COUNT
  getDefaultIds().forEach((id) => ensureTileColor(id))
  gridRef.value?.setItems(getDefaultIds().map((id) => ({ id })))
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
.demo {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: var(--bg);
  overflow: hidden;
}

.grid-wrap {
  position: absolute;
  inset: 0;
  padding: 6px 6px 0;
}

/* ── Tile ── */
.tile {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 10px;
  color: #1a1a1a;
  overflow: hidden;
  isolation: isolate;
}

/* Pin / Fixed 内阴影层（::before = Pin，::after = Fixed） */
.tile::before,
.tile::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.is-pinned::before {
  opacity: 1;
  box-shadow: inset 0 0 40px 8px rgba(37, 99, 235, 0.28);
}

.is-fixed::after {
  opacity: 1;
  box-shadow: inset 0 0 40px 8px rgba(217, 119, 6, 0.28);
}

.is-pinned.is-fixed::before {
  box-shadow: inset 0 0 36px 6px rgba(37, 99, 235, 0.22);
}

.is-pinned.is-fixed::after {
  box-shadow: inset 0 0 36px 6px rgba(217, 119, 6, 0.22);
}

.tile-id,
.tile-meta,
.tile-ops,
.tile-badges {
  position: relative;
  z-index: 2;
}

.tile-badges {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.badge {
  padding: 4px 9px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.badge-pin {
  background: #2563eb;
  color: #fff;
}

.badge-fixed {
  background: #d97706;
  color: #fff;
}

.tile-id {
  font-size: clamp(1.75rem, 4.5vw, 2.5rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1;
}

.tile-meta {
  font-size: 0.6875rem;
  color: rgba(0, 0, 0, 0.5);
  font-variant-numeric: tabular-nums;
}

.tile-ops {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.op {
  min-height: 32px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: none;
  color: rgba(0, 0, 0, 0.45);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.op:hover {
  background: rgba(255, 255, 255, 0.4);
}

.op.active {
  color: #2563eb;
  font-weight: 600;
}

.op:last-of-type.active {
  color: #d97706;
}

.op-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
}

/* ── 底部悬浮毛玻璃工具栏 ── */
.float-bar {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(28, 28, 30, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
}

.bar-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  font-size: 1.375rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;
}

.bar-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
}

.bar-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.bar-count {
  min-width: 32px;
  text-align: center;
  font-size: 1.0625rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.bar-sep {
  width: 1px;
  height: 28px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.15);
}

.bar-text {
  height: 48px;
  padding: 0 20px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.bar-text:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
}

.bar-text:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .float-bar {
    width: calc(100% - 24px);
    flex-wrap: wrap;
    justify-content: center;
    border-radius: 16px;
  }

  .bar-sep {
    display: none;
  }

  .bar-text {
    flex: 1;
    min-width: 80px;
  }
}
</style>
