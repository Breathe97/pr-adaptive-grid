<template>
  <div class="demo">
    <header class="demo-header">
      <div class="demo-brand">
        <span class="demo-logo" aria-hidden="true">▦</span>
        <div class="demo-brand-text">
          <h1 class="demo-title">PrAdaptiveGrid</h1>
          <p class="demo-subtitle">自适应网格 · 交互演示</p>
        </div>
      </div>
      <div class="demo-legend">
        <span class="legend-item">
          <span class="legend-dot legend-dot-pin" />
          Pin 固定视口
        </span>
        <span class="legend-item">
          <span class="legend-dot legend-dot-fixed" />
          Fixed 锁定槽位
        </span>
      </div>
    </header>

    <main class="demo-main">
      <div class="viewport-frame">
        <div class="viewport-chrome">
          <span class="viewport-dot viewport-dot-red" />
          <span class="viewport-dot viewport-dot-yellow" />
          <span class="viewport-dot viewport-dot-green" />
          <span class="viewport-label">Grid Viewport</span>
        </div>
        <div class="grid-wrap">
          <PrAdaptiveGrid ref="gridRef" :gap="8">
            <template #default="{ item }">
              <div class="tile" :class="{ 'tile-pinned': item.sticky, 'tile-fixed': item.fixed }" :style="{ backgroundColor: getItemColor(item.id) }">
                <div class="tile-body">
                  <span class="tile-id">{{ item.id }}</span>
                  <code class="tile-meta">{{ item.w }}×{{ item.h }} · ({{ item.x }}, {{ item.y }})</code>
                </div>
                <div class="tile-actions">
                  <button type="button" class="tile-btn tile-btn-pin" :class="{ active: item.sticky }" @pointerdown.stop @click.stop="setPin(item)">Pin</button>
                  <button type="button" class="tile-btn tile-btn-fixed" :class="{ active: item.fixed }" @pointerdown.stop @click.stop="setFixed(item)">Fixed</button>
                </div>
              </div>
            </template>
          </PrAdaptiveGrid>
        </div>
      </div>
    </main>

    <footer class="demo-dock">
      <div class="dock-group">
        <span class="dock-label">数量</span>
        <div class="dock-stepper">
          <button type="button" class="dock-stepper-btn" :disabled="userCount <= 1" aria-label="减少" @click="changeUserCount(-1)">−</button>
          <span class="dock-stepper-value">{{ userCount }}</span>
          <button type="button" class="dock-stepper-btn" aria-label="增加" @click="changeUserCount(1)">+</button>
        </div>
      </div>
      <div class="dock-divider" />
      <div class="dock-group dock-actions">
        <button type="button" class="dock-action" :disabled="userCount <= 1" @click="shuffleItems">
          <span class="dock-action-icon" aria-hidden="true">⇅</span>
          打乱
        </button>
        <button type="button" class="dock-action dock-action-sync" @click="syncGrid">
          <span class="dock-action-icon" aria-hidden="true">↺</span>
          同步
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { GridItem, PrAdaptiveGridExpose } from '../../src/index.ts'

const DEFAULT_USER_COUNT = 8

const gridRef = ref<PrAdaptiveGridExpose>()

const userCount = ref(DEFAULT_USER_COUNT)
const itemColorMap = ref(new Map<string, string>())

const randomItemColor = (): string => {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue} 38% 76%)`
}

const ensureItemColor = (id: string) => {
  if (itemColorMap.value.has(id)) return
  const next = new Map(itemColorMap.value)
  next.set(id, randomItemColor())
  itemColorMap.value = next
}

const getItemColor = (id: string): string => itemColorMap.value.get(id) ?? '#c8d0dc'

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
  const ids = getDefaultIds()
  ids.forEach((id) => ensureItemColor(id))
  gridRef.value?.setItems(
    ids.map((id, index) => {
      if (index === 0) return { id, options: { sticky: true } }
      if (index === 1) return { id, options: { fixed: true } }
      return { id }
    })
  )
}

const syncGrid = () => {
  gridRef.value?.settleActiveAnimations()
  userCount.value = DEFAULT_USER_COUNT
  const ids = getDefaultIds()
  ids.forEach((id) => ensureItemColor(id))
  gridRef.value?.setItems(ids.map((id) => ({ id })))
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
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  padding: 20px 24px 96px;
  animation: demo-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes demo-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* ── Header ── */
.demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  margin-bottom: 20px;
}

.demo-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.demo-logo {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent-action) 0%, #4f46e5 100%);
  color: #fff;
  font-size: 20px;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
}

.demo-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text-primary);
}

.demo-subtitle {
  margin: 2px 0 0;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.demo-legend {
  display: flex;
  align-items: center;
  gap: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dot-pin {
  background: var(--accent-pin);
  box-shadow: 0 0 8px var(--accent-pin);
}

.legend-dot-fixed {
  background: var(--accent-fixed);
  box-shadow: 0 0 8px var(--accent-fixed);
}

/* ── Main viewport ── */
.demo-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.viewport-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  box-shadow:
    var(--shadow-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.viewport-chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.viewport-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.viewport-dot-red {
  background: #ff5f57;
}

.viewport-dot-yellow {
  background: #febc2e;
}

.viewport-dot-green {
  background: #28c840;
}

.viewport-label {
  margin-left: 8px;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.grid-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  padding: 12px;
}

/* ── Grid tiles ── */
.tile {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 10px;
  border-radius: var(--radius-md);
  box-sizing: border-box;
  color: #1a2332;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.tile-pinned {
  box-shadow:
    0 0 0 2px var(--accent-pin),
    0 0 20px var(--accent-pin-dim);
}

.tile-fixed {
  box-shadow:
    inset 0 0 0 2px var(--accent-fixed),
    0 0 16px var(--accent-fixed-dim);
}

.tile-pinned.tile-fixed {
  box-shadow:
    0 0 0 2px var(--accent-pin),
    inset 0 0 0 2px var(--accent-fixed),
    0 0 24px rgba(34, 211, 238, 0.12);
}

.tile-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.tile-id {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: #0f1728;
}

.tile-meta {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 40, 0.1);
  color: rgba(15, 23, 40, 0.72);
  letter-spacing: 0.02em;
}

.tile-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.tile-btn {
  min-width: 48px;
  padding: 5px 12px;
  border: 1px solid rgba(15, 23, 40, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: rgba(15, 23, 40, 0.75);
  font-family: var(--font-ui);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1.2;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.tile-btn:hover {
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(15, 23, 40, 0.12);
}

.tile-btn-pin.active {
  border-color: #0891b2;
  color: #0e7490;
  background: rgba(34, 211, 238, 0.22);
  box-shadow: 0 2px 10px rgba(34, 211, 238, 0.25);
}

.tile-btn-fixed.active {
  border-color: #d97706;
  color: #b45309;
  background: rgba(251, 191, 36, 0.28);
  box-shadow: 0 2px 10px rgba(251, 191, 36, 0.25);
}

/* ── Bottom dock ── */
.demo-dock {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(18, 24, 32, 0.82);
  border: 1px solid var(--border-strong);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  z-index: 30;
  animation: dock-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
}

@keyframes dock-rise {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(16px);
  }
}

.dock-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dock-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}

.dock-stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border-subtle);
}

.dock-stepper-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: var(--accent-action);
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}

.dock-stepper-btn:hover:not(:disabled) {
  background: var(--accent-action-hover);
  transform: scale(1.05);
}

.dock-stepper-btn:disabled {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
  cursor: not-allowed;
}

.dock-stepper-value {
  min-width: 32px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary);
}

.dock-divider {
  width: 1px;
  height: 28px;
  background: var(--border-strong);
}

.dock-actions {
  gap: 8px;
}

.dock-action {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;
}

.dock-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.dock-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dock-action-sync {
  border-color: rgba(99, 102, 241, 0.35);
  background: rgba(99, 102, 241, 0.12);
}

.dock-action-sync:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.22);
  border-color: rgba(99, 102, 241, 0.5);
}

.dock-action-icon {
  font-size: 1rem;
  line-height: 1;
  opacity: 0.85;
}

@media (max-width: 640px) {
  .demo {
    padding: 12px 12px 88px;
  }

  .demo-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .demo-legend {
    flex-wrap: wrap;
    gap: 12px;
  }

  .demo-dock {
    width: calc(100% - 24px);
    justify-content: center;
    flex-wrap: wrap;
    border-radius: var(--radius-lg);
    padding: 12px 14px;
  }

  .dock-divider {
    display: none;
  }
}
</style>
