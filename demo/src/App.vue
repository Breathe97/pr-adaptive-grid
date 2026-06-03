<template>
  <div class="demo">
    <div class="grid-wrap">
      <PrAdaptiveGrid ref="gridRef" :layout="layout">
        <template #default="{ item }">
          <div class="tile" :class="{ 'is-pinned': item.sticky, 'is-fixed': item.fixed }" :style="{ backgroundColor: getTileColor(item.id) }">
            <div v-if="item.sticky || item.fixed" class="tile-badges">
              <span v-if="item.sticky" class="badge badge-pin">📌 Pin</span>
              <span v-if="item.fixed" class="badge badge-fixed">🔒 Fixed</span>
            </div>
            <span class="tile-id">{{ item.id }}</span>
            <span class="tile-meta">{{ item.w }}×{{ item.h }}</span>
            <div class="tile-ops">
              <button type="button" class="op" :class="{ active: item.sticky }" data-type="pin" @pointerdown.stop @click.stop="setPin(item)">Pin</button>
              <button type="button" class="op" :class="{ active: item.fixed }" data-type="fix" @pointerdown.stop @click.stop="setFixed(item)">Fixed</button>
            </div>
          </div>
        </template>
      </PrAdaptiveGrid>
    </div>

    <div class="float-bar">
      <div class="help-wrap">
        <button type="button" class="help-btn" aria-label="Pin 与 Fixed 说明">?</button>
        <div class="help-panel" role="tooltip" aria-label="按钮说明">
          <p class="help-title">按钮说明</p>
          <div class="help-item">
            <span class="help-tag help-tag-pin">📌 Pin</span>
            <p class="help-desc">滚动时固定在网格可视区域，类似 sticky 锚点。</p>
          </div>
          <div class="help-item">
            <span class="help-tag help-tag-fixed">🔒 Fixed</span>
            <p class="help-desc">锁定 ids 槽位，不可拖动，排序时不会被其他 item 挤压位移。</p>
          </div>
        </div>
      </div>
      <span class="bar-sep" />
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
import { PrAdaptiveGrid, getLayout } from '../../src/index.ts'
import type { Layout, LayoutItem, PrAdaptiveGridExpose } from '../../src/index.ts'
import { GridItem } from '../../dist/src/types'

const DEFAULT_USER_COUNT = 5

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

const setFixed = (item: GridItem) => {}

const createIds = (count: number = 8) => {
  const ids = []
  for (let index = 1; index <= count; index++) {
    ids.push(`${index}`)
    ensureTileColor(`${index}`)
  }
  return ids.reverse()
}

const ids = createIds(userCount.value)

const layout = ref<Layout>({ gap: 8, cols: 1, rows: 1, items: [] })

const changeUserCount = (delta: number) => {
  if (delta === 1) {
    if (ids.length < 1) return
    const [_id] = ids
    const id = `${Math.max(...Array.from(ids, (id) => Number(id))) + 1}`
    // const index = Math.ceil(Math.random() * ids.length - 1)
    ids.splice(0, 0, id)
    ensureTileColor(id)
  }
  if (delta === -1) {
    if (ids.length === 1) return
    const index = Math.ceil(Math.random() * ids.length - 1)
    ids.splice(index, 1)
  }
  userCount.value += delta
  initGrid()
}

const setPin = (target: LayoutItem) => {
  const targetId = target.id
  const index = ids.indexOf(targetId)
  if (index < 0) return
  const nextSticky = !target.sticky
  // 开启 Pin：与 ids[0] 交换，占 mode=2 主槽（如左侧大格）
  if (nextSticky && index !== 0) {
    const prevFirstId = ids[0]
    ids[0] = targetId
    ids[index] = prevFirstId
  }
  initGrid()
  // getLayout 会重建 items，需写回 sticky（一次只 Pin 一个可先清空其它的）
  layout.value = {
    ...layout.value,
    items: layout.value.items.map((it) => ({
      ...it,
      sticky: nextSticky && it.id === targetId
    }))
  }
}

const shuffleItems = () => {
  if (ids.length <= 1) return
  const shuffleIds = () => {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = ids[i]
      ids[i] = ids[j]
      ids[j] = tmp
    }
  }

  shuffleIds()
  initGrid()
}

const initGrid = () => {
  // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: ids`, ids)
  layout.value = getLayout('2', ids)
  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: layout.value`, layout.value)
}

const syncGrid = () => {
  void gridRef.value?.syncLayout()
}

onMounted(() => {
  initGrid()
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
  padding: 8px;
  box-sizing: border-box;
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
  gap: 8px;
  margin-top: 6px;
  position: relative;
  z-index: 3;
}

.op {
  min-height: 36px;
  padding: 7px 18px;
  border: 2px solid rgba(0, 0, 0, 0.22);
  border-radius: 999px;
  background: #fff;
  color: #1a1a1a;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  -webkit-font-smoothing: antialiased;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.op:hover {
  border-radius: 999px;
  background: #fff;
  border-color: rgba(0, 0, 0, 0.32);
  color: #000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.op.active[data-type='pin'] {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #fff;
  box-shadow: 0 2px 12px rgba(37, 99, 235, 0.45);
}

.op.active[data-type='pin']:hover {
  background: #1d4ed8;
  border-color: #1e40af;
  color: #fff;
}

.op.active[data-type='fix'] {
  background: #d97706;
  border-color: #b45309;
  color: #fff;
  box-shadow: 0 2px 12px rgba(217, 119, 6, 0.45);
}

.op.active[data-type='fix']:hover {
  background: #b45309;
  border-color: #92400e;
  color: #fff;
}

/* ── 底部悬浮工具栏 ── */
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

.help-wrap {
  position: relative;
  flex-shrink: 0;
}

.help-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1;
  cursor: help;
  transition: background 0.15s ease;
}

.help-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.help-panel {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  width: min(300px, calc(100vw - 48px));
  padding: 14px 16px 16px;
  border-radius: 16px;
  background: rgba(28, 28, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: translateX(-50%) translateY(16px) scale(0.5);
  transform-origin: bottom center;
  overflow: hidden;
}

.help-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(to top, rgba(28, 28, 30, 0.98) 0%, transparent 50%);
  pointer-events: none;
}

.help-wrap:hover .help-panel,
.help-wrap:focus-within .help-panel {
  visibility: visible;
  pointer-events: auto;
  animation: help-rise 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes help-rise {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(20px) scaleX(0.2);
    clip-path: inset(100% 0 0 0 round 16px);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(-10px) scaleX(1);
    clip-path: inset(0 0 0 0 round 16px);
  }
}

.help-title,
.help-item {
  position: relative;
  z-index: 1;
}

.help-title {
  margin: 0 0 12px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.help-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.help-item + .help-item {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.help-tag {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
}

.help-tag-pin {
  background: #2563eb;
  color: #fff;
}

.help-tag-fixed {
  background: #d97706;
  color: #fff;
}

.help-desc {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(245, 245, 245, 0.75);
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
