<template>
  <div class="demo">
    <div class="grid-wrap">
      <PrAdaptiveGrid ref="gridRef" :gap="VIEW_GAP" :item-width="300" :item-height="200" :cols="layout.cols" :rows="layout.rows" :left="layout.left" :top="layout.top" :right="layout.right" :bottom="layout.bottom" :virtual-scroll="false" :sortable="true" @visible-change="onVisibleChange">
        <template #default="{ item }">
          <div class="tile" :class="{ 'is-pinned': item.sticky, 'is-fixed': item.fixed }" :style="{ backgroundColor: getTileColor(item.id) }">
            <div v-if="item.sticky || item.fixed" class="tile-badges">
              <span v-if="item.sticky" class="badge badge-pin">📌 Pin</span>
              <span v-if="item.fixed" class="badge badge-fixed">🔒 Fixed</span>
            </div>
            <span class="tile-id">{{ item.id }}</span>
            <span class="tile-meta">{{ Math.round(item.w) }}×{{ Math.round(item.h) }}</span>
            <p class="tile-hint">{{ getTileHint(item.id) }}</p>
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
        <button type="button" class="help-btn" aria-label="说明">?</button>
        <div class="help-panel" role="tooltip">
          <p class="help-title">测试说明（预设 5 个 item）</p>
          <div class="help-item">
            <span class="help-tag">布局</span>
            <p class="help-desc">首屏 2×2（1–4），第 5 个在下方需滚动。cols=2 rows=2，无 Pin。</p>
          </div>
          <div class="help-item">
            <span class="help-tag">📌 Pin</span>
            <p class="help-desc">同时仅 1 个；70%×100%；流式区由 sticky 并集 + 组件 gap 自动让位。</p>
          </div>
          <div class="help-item">
            <span class="help-tag">🔒 Fixed</span>
            <p class="help-desc">锁定槽位后不可拖排序。</p>
          </div>
        </div>
      </div>
      <span class="bar-sep" />
      <button type="button" class="bar-btn" :disabled="userCount <= 1" @click="changeUserCount(-1)">−</button>
      <span class="bar-count">{{ userCount }}</span>
      <button type="button" class="bar-btn" @click="changeUserCount(1)">+</button>
      <span class="bar-sep" />
      <button type="button" class="bar-text" :disabled="userCount <= 1" @click="shuffleItems">打乱</button>
      <button type="button" class="bar-text" @click="syncGrid">重置</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { GridItem, GridSetItemEntry, PrAdaptiveGridExpose } from 'pr-adaptive-grid'
import { resolveDemoLayout } from './layoutConfig'
import { resolvePinItemLayout } from './pinConfig'

/** 默认 5 个：首屏 2+2，第 5 个在第二屏 */
const DEFAULT_USER_COUNT = 5
/** 视图层 item 间距，与 PrAdaptiveGrid :gap 一致；应用层计算边距时需减去该值 */
const VIEW_GAP = 8

const TILE_COLORS: Record<string, string> = {
  '1': 'hsl(350 85% 72%)',
  '2': 'hsl(45 90% 68%)',
  '3': 'hsl(145 75% 68%)',
  '4': 'hsl(210 90% 72%)',
  '5': 'hsl(270 80% 75%)',
  '6': 'hsl(15 85% 70%)',
  '7': 'hsl(185 80% 68%)',
  '8': 'hsl(300 75% 72%)'
}

const TILE_HINTS: Record<string, string> = {
  '1': '首屏左上',
  '2': '首屏右上',
  '3': '首屏左下',
  '4': '首屏右下',
  '5': '第二屏（下滑）'
}

const gridRef = ref<PrAdaptiveGridExpose>()
const userCount = ref(DEFAULT_USER_COUNT)
/** 当前唯一 Pin 的 item id（仅 UI 状态） */
const pinnedId = ref<string | null>(null)

const layout = computed(() => resolveDemoLayout(userCount.value))

const getTileColor = (id: string) => TILE_COLORS[id] ?? 'hsl(210 95% 72%)'
const getTileHint = (id: string) => TILE_HINTS[id] ?? ''

const createUserIds = (count: number) => Array.from({ length: count }, (_, i) => `${i + 1}`)

const setPin = (item: GridItem) => {
  const turningOn = !item.sticky

  if (turningOn) {
    pinnedId.value = item.id
    const entries: GridSetItemEntry[] = (gridRef.value?.getItems() ?? []).map((i) => {
      if (i.id === item.id) {
        return { id: i.id, options: { sticky: true, ...resolvePinItemLayout() } }
      }
      if (i.sticky) {
        return { id: i.id, options: { sticky: false } }
      }
      return { id: i.id }
    })
    gridRef.value?.setItems(entries)
    return
  }

  pinnedId.value = null
  gridRef.value?.setItem(item.id, { sticky: false })
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
  gridRef.value?.setItem(`${maxId + 1}`, { index: 0 })
}

const shuffleItems = () => {
  if ((gridRef.value?.getItems().length ?? 0) <= 1) return
  gridRef.value?.settleActiveAnimations()
  gridRef.value?.shuffleItems()
}

const initGrid = () => {
  // gridRef.value?.setTransitionTimeScale(3) // 放慢 3 倍观察
  gridRef.value?.setItems(createUserIds(userCount.value).map((id) => ({ id })))
}

const syncGrid = () => {
  gridRef.value?.settleActiveAnimations()
  userCount.value = DEFAULT_USER_COUNT
  pinnedId.value = null
  initGrid()
}

const onVisibleChange = (ids: string[]) => {
  console.log('[visible]', ids.join(', '))
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

.tile {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  color: #1a1a1a;
  overflow: hidden;
}

.tile-hint {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.45);
}

.is-pinned::before,
.is-fixed::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.is-pinned::before {
  box-shadow: inset 0 0 40px 8px rgba(37, 99, 235, 0.28);
}

.is-fixed::after {
  box-shadow: inset 0 0 40px 8px rgba(217, 119, 6, 0.28);
}

.tile-id {
  font-size: clamp(1.75rem, 4.5vw, 2.5rem);
  font-weight: 600;
}

.tile-meta {
  font-size: 0.6875rem;
  color: rgba(0, 0, 0, 0.5);
  font-variant-numeric: tabular-nums;
}

.tile-ops {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.op {
  min-height: 32px;
  padding: 6px 14px;
  border: 2px solid rgba(0, 0, 0, 0.22);
  border-radius: 999px;
  background: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}

.op.active[data-type='pin'] {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #fff;
}

.op.active[data-type='fix'] {
  background: #d97706;
  border-color: #b45309;
  color: #fff;
}

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
  backdrop-filter: blur(20px);
}

.help-wrap {
  position: relative;
}

.help-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  font-size: 1.25rem;
  cursor: help;
}

.help-panel {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  width: min(320px, calc(100vw - 48px));
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(28, 28, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.14);
  transform: translateX(-50%) translateY(8px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.help-wrap:hover .help-panel,
.help-wrap:focus-within .help-panel {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(-50%) translateY(-8px);
}

.help-title {
  margin: 0 0 10px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.help-item + .help-item {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.help-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
}

.help-desc {
  margin: 6px 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(245, 245, 245, 0.75);
}

.bar-btn,
.bar-text {
  height: 48px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  cursor: pointer;
}

.bar-btn {
  width: 48px;
  font-size: 1.375rem;
}

.bar-text {
  padding: 0 20px;
  font-size: 0.9375rem;
}

.bar-count {
  min-width: 32px;
  text-align: center;
  font-weight: 600;
  color: var(--text);
}

.bar-sep {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.15);
}
</style>
