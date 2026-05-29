<template>
  <div class="demo">
    <div class="aurora" aria-hidden="true">
      <div class="blob blob-a" />
      <div class="blob blob-b" />
      <div class="blob blob-c" />
    </div>

    <header class="hero">
      <p class="hero-tag">PrAdaptiveGrid</p>
      <h1 class="hero-title">Adaptive<br />Grid</h1>
      <p class="hero-hint">拖拽排序 · 双击空白添加</p>
    </header>

    <main class="stage">
      <div class="grid-shell">
        <PrAdaptiveGrid ref="gridRef" :gap="10">
          <template #default="{ item }">
            <div class="tile" :class="{ 'tile-pinned': item.sticky, 'tile-fixed': item.fixed }" :style="{ '--accent': getTileAccent(item.id) }">
              <div class="tile-glow" aria-hidden="true" />
              <span class="tile-id">{{ item.id }}</span>
              <span class="tile-meta">{{ item.w }}×{{ item.h }} · {{ item.x }},{{ item.y }}</span>
              <div class="tile-toggles">
                <button type="button" class="toggle" :class="{ on: item.sticky }" data-type="pin" @pointerdown.stop @click.stop="setPin(item)">Pin</button>
                <button type="button" class="toggle" :class="{ on: item.fixed }" data-type="fix" @pointerdown.stop @click.stop="setFixed(item)">Fix</button>
              </div>
            </div>
          </template>
        </PrAdaptiveGrid>
      </div>
    </main>

    <div class="dock">
      <div class="dock-glass">
        <div class="dock-group">
          <span class="dock-label">Items</span>
          <div class="counter">
            <button type="button" class="counter-btn" :disabled="userCount <= 1" @click="changeUserCount(-1)">−</button>
            <span class="counter-val">{{ userCount }}</span>
            <button type="button" class="counter-btn" @click="changeUserCount(1)">+</button>
          </div>
        </div>
        <span class="dock-divider" />
        <button type="button" class="dock-action" :disabled="userCount <= 1" @click="shuffleItems">Shuffle</button>
        <button type="button" class="dock-action dock-action-primary" @click="syncGrid">Sync</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { GridItem, PrAdaptiveGridExpose } from '../../src/index.ts'

const DEFAULT_USER_COUNT = 8

const ACCENTS = ['#a78bfa', '#34d399', '#60a5fa', '#f472b6', '#fb923c', '#2dd4bf', '#e879f9', '#facc15']

const gridRef = ref<PrAdaptiveGridExpose>()
const userCount = ref(DEFAULT_USER_COUNT)
const tileAccentMap = ref(new Map<string, string>())

const pickAccent = (): string => ACCENTS[Math.floor(Math.random() * ACCENTS.length)]

const ensureTileAccent = (id: string) => {
  if (tileAccentMap.value.has(id)) return
  const next = new Map(tileAccentMap.value)
  next.set(id, pickAccent())
  tileAccentMap.value = next
}

const getTileAccent = (id: string): string => tileAccentMap.value.get(id) ?? '#a78bfa'

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
  ensureTileAccent(newId)
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
  ids.forEach((id) => ensureTileAccent(id))
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
  ids.forEach((id) => ensureTileAccent(id))
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
  display: grid;
  grid-template-columns: minmax(140px, 22%) 1fr;
  grid-template-rows: 1fr auto;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* ── Aurora background ── */
.aurora {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
  animation: aurora-drift 18s ease-in-out infinite;
}

.blob-a {
  width: 55vw;
  height: 55vw;
  top: -15%;
  left: -10%;
  background: #6366f1;
}

.blob-b {
  width: 45vw;
  height: 45vw;
  bottom: -10%;
  right: -5%;
  background: #ec4899;
  animation-delay: -6s;
}

.blob-c {
  width: 35vw;
  height: 35vw;
  top: 40%;
  left: 35%;
  background: #14b8a6;
  animation-delay: -12s;
  opacity: 0.3;
}

/* ── Hero sidebar ── */
.hero {
  position: relative;
  z-index: 1;
  grid-row: 1 / 3;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: max(24px, env(safe-area-inset-top)) 28px max(100px, calc(24px + env(safe-area-inset-bottom)));
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.hero-tag {
  margin: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.hero-title {
  margin: 0;
  font-size: clamp(2.5rem, 5vw, 3.75rem);
  font-weight: 800;
  line-height: 0.92;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.65) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-hint {
  margin: 16px 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--muted);
  line-height: 1.5;
}

/* ── Grid stage ── */
.stage {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  padding: 20px 20px 12px 12px;
}

.grid-shell {
  height: 100%;
  padding: 14px;
  border-radius: 24px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 24px 48px rgba(0, 0, 0, 0.35);
}

/* ── Tiles ── */
.tile {
  --accent: #a78bfa;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(9, 9, 15, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.tile-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--accent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 60%, transparent);
}

.tile-pinned {
  border-color: color-mix(in srgb, var(--pin) 50%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--pin) 15%, transparent);
}

.tile-fixed {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fixed) 45%, transparent);
}

.tile-id {
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text);
}

.tile-meta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.tile-toggles {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.toggle {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.toggle:hover {
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text);
}

.toggle.on[data-type='pin'] {
  color: var(--pin);
  border-color: color-mix(in srgb, var(--pin) 45%, transparent);
  background: color-mix(in srgb, var(--pin) 12%, transparent);
}

.toggle.on[data-type='fix'] {
  color: var(--fixed);
  border-color: color-mix(in srgb, var(--fixed) 45%, transparent);
  background: color-mix(in srgb, var(--fixed) 12%, transparent);
}

/* ── Floating dock ── */
.dock {
  position: relative;
  z-index: 2;
  grid-column: 2;
  display: flex;
  justify-content: center;
  padding: 0 20px calc(16px + env(safe-area-inset-bottom));
}

.dock-glass {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(15, 15, 22, 0.72);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.dock-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dock-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.counter {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.counter-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;
}

.counter-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.counter-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.counter-val {
  min-width: 32px;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.dock-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
}

.dock-action {
  height: 40px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.dock-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.dock-action:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dock-action-primary {
  border: none;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
  color: #fff;
}

.dock-action-primary:hover:not(:disabled) {
  opacity: 0.9;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
}

@media (max-width: 768px) {
  .demo {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }

  .hero {
    grid-row: auto;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: max(16px, env(safe-area-inset-top)) 20px 12px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hero-tag {
    margin: 0;
  }

  .hero-title {
    font-size: 1.75rem;
  }

  .hero-title br {
    display: none;
  }

  .hero-hint {
    display: none;
  }

  .stage {
    padding: 12px;
  }

  .dock {
    grid-column: 1;
  }

  .dock-glass {
    flex-wrap: wrap;
    justify-content: center;
    border-radius: 20px;
    width: 100%;
  }

  .dock-divider {
    display: none;
  }
}
</style>
