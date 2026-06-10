<template>
  <div class="demo">
    <div class="grid-wrap">
      <PrAdaptiveGrid ref="gridRef" :get-layout="resolveLayout">
        <template #default="{ item }">
          <div class="tile" :class="{ 'is-pinned': item.sticky, 'is-fixed': item.fixed }" :style="{ backgroundColor: getTileColor(item.id) }">
            <div v-if="item.sticky || item.fixed" class="tile-badges">
              <span v-if="item.sticky" class="badge badge-pin">📌 Pin</span>
              <span v-if="item.fixed" class="badge badge-fixed">🔒 Fixed</span>
            </div>
            <span class="tile-id">{{ item.id }}</span>
            <!-- geo 调试信息 -->
            <div class="tile-geo">
              <span>cx: {{ Math.round(item.cx) }}</span>
              <span>cy: {{ Math.round(item.cy) }}</span>
              <span>w: {{ Math.round(item.width) }}</span>
              <span>h: {{ Math.round(item.height) }}</span>
            </div>
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
            <span class="help-tag help-tag-pin">📌 Pin</span>
            <p class="help-desc">滚动时固定在网格可视区域；同时只能 Pin 一个 item。切到布局 2 自动 Pin 第一项，切回布局 1 自动取消 Pin。</p>
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
      <button type="button" class="bar-btn" :disabled="!canRemoveItem" @click="changeUserCount(-1)">−</button>
      <span class="bar-count">{{ userCount }}</span>
      <button type="button" class="bar-btn" @click="changeUserCount(1)">+</button>
      <span class="bar-sep" />
      <div class="bar-mode" role="group" aria-label="布局模式">
        <button type="button" class="bar-mode-btn" :class="{ active: layoutMode === 1 }" @click="setLayoutMode(1)">布局 1</button>
        <button type="button" class="bar-mode-btn" :class="{ active: layoutMode === 2 }" @click="setLayoutMode(2)">布局 2</button>
      </div>
      <span class="bar-sep" />
      <button type="button" class="bar-text" :disabled="userCount <= 1" @click="shuffleItems">打乱</button>
      <button type="button" class="bar-text" @click="resetGrid">重置</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { PrAdaptiveGrid, getLayout, getLectureLayout } from '../../src/index.ts'
import type { Geo, GetLayoutFn, GridItemsOptions, PrAdaptiveGridExpose } from '../../src/index.ts'

const DEFAULT_USER_COUNT = 10 // 演示初始 item 数量
const layoutMode = ref<1 | 2>(1) // 1 默认布局，2 讲座布局

/** 闭包读取 layoutMode，组件只传 length */
const resolveLayout: GetLayoutFn = (length) => (layoutMode.value === 2 ? getLectureLayout(length) : getLayout(length))

const gridRef = ref<PrAdaptiveGridExpose>() // 网格组件实例
const userCount = ref(DEFAULT_USER_COUNT) // 工具栏显示的数量
const tileColorMap = ref(new Map<string, string>()) // 每个 id 对应的 tile 背景色

const ids: string[] = [] // 业务侧 id 顺序，与 gridItems 下标一致
const pinnedId = ref<string | null>(null) // 当前唯一 Pin 的 item id
const pinnedSwapIndex = ref<number | null>(null) // Pin 时与 index 0 互换的原下标
type GridSlotItem = Geo & Required<GridItemsOptions> & { id: string }

/** 从前 10 项中筛选可移除候选；布局 2 时保护第一项。 */
const getRemovableCandidates = () => {
  const pool = ids.slice(0, Math.min(10, ids.length))
  if (layoutMode.value === 2) return pool.slice(1)
  return pool
}

const canRemoveItem = computed(() => userCount.value > 1 && getRemovableCandidates().length > 0)

const layout = computed(() => resolveDemoLayout(userCount.value))

/** 为新 id 分配并缓存随机背景色 */
const ensureTileColor = (id: string) => {
  if (tileColorMap.value.has(id)) return
  const next = new Map(tileColorMap.value)
  next.set(id, pickContrastColor())
  tileColorMap.value = next
}

/** 读取 tile 背景色，未分配时用默认色 */
const getTileColor = (id: string): string => tileColorMap.value.get(id) ?? 'hsl(210 95% 72%)'

/** 交换 ids 中两个下标的 id（应用层换位） */
const swapIdsAt = (a: number, b: number) => {
  if (a === b || a < 0 || b < 0 || a >= ids.length || b >= ids.length) return
  const tmp = ids[a]
  ids[a] = ids[b]
  ids[b] = tmp
}

/** 取消当前 Pin 并还原换位。 */
const clearPin = () => {
  if (pinnedSwapIndex.value != null) swapIdsAt(0, pinnedSwapIndex.value)
  pinnedId.value = null
  pinnedSwapIndex.value = null
}

/** 将指定 id 设为唯一 Pin，并换到 index 0。 */
const applyPinToId = (targetId: string) => {
  if (ids.length === 0) return
  const wasPinned = pinnedId.value === targetId

  if (pinnedId.value && pinnedId.value !== targetId && pinnedSwapIndex.value != null) {
    swapIdsAt(0, pinnedSwapIndex.value)
  }

  const index = ids.indexOf(targetId)
  if (index === -1) return

  if (index !== 0) {
    swapIdsAt(0, index)
    pinnedSwapIndex.value = index
  } else if (!wasPinned || pinnedSwapIndex.value == null) {
    pinnedSwapIndex.value = null
  }

  pinnedId.value = targetId
}

/** 切换布局模式：布局 1 取消 Pin，布局 2 自动 Pin 第一项。 */
const setLayoutMode = async (mode: 1 | 2) => {
  if (layoutMode.value === mode) return

  if (mode === 1) clearPin()
  else applyPinToId(ids[0])

  layoutMode.value = mode
  await nextTick()
  await initGrid()
}

/** 切换 Fixed：只锁定当前 id 的拖拽排序能力，不改变业务顺序。 */
const setFixed = (item: GridSlotItem) => {
  gridRef.value?.setItem(item.id, { fixed: !item.fixed })
}

/** 增减 item：+1 插入新 id，-1 随机移除一个 */
const changeUserCount = (delta: number) => {
  if (delta === 1) {
    if (userCount.value < 1) return
    const id = `${Math.max(...ids.map(Number), 0) + 1}` // 递增数字 id
    let index = 0 // 插入下标，Pin 时避开首位
    // if (layoutMode.value === 2) index = 1
    ensureTileColor(id)
    gridRef.value?.setItem(id, { index })
    ids.splice(index, 0, id)
    userCount.value += 1
    return
  }
  const candidates = getRemovableCandidates()
  if (candidates.length === 0) return
  const removeId = candidates[Math.floor(Math.random() * candidates.length)]
  if (!removeId) return
  gridRef.value?.removeItems([removeId])
  ids.splice(ids.indexOf(removeId), 1)
  if (pinnedId.value === removeId) {
    pinnedId.value = null
    pinnedSwapIndex.value = null
    layoutMode.value = 1
  }
  userCount.value -= 1
}

/** 切换 Pin：同时只能 Pin 一个；设置后自动切到布局 2，取消后切回布局 1。 */
const setPin = async (target: GridSlotItem) => {
  const targetId = target.id
  if (ids.indexOf(targetId) < 0) return

  if (target.sticky === true) {
    clearPin()
    layoutMode.value = 1
    await nextTick()
    await initGrid()
    return
  }

  applyPinToId(targetId)
  layoutMode.value = 2
  await nextTick()
  await initGrid()
}

/** Fisher-Yates 打乱 ids 后按当前 mode 重排 */
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
  void initGrid()
}

/** 一次 setItems，再恢复唯一 Pin 的 sticky 状态。 */
const initGrid = async () => {
  if (!gridRef.value) return
  gridRef.value.setItems(ids)
  ids.forEach((id) => {
    gridRef.value?.setItem(id, { sticky: id === pinnedId.value })
  })
}

/** 生成默认 ids：从 DEFAULT_USER_COUNT 递减到 1。 */
const getDefaultIds = () => {
  const next: string[] = []
  for (let index = DEFAULT_USER_COUNT; index >= 1; index--) {
    const id = `${index}`
    ensureTileColor(id)
    next.push(id)
  }
  return next
}

/** 重置为初始默认 ids，并清除 Pin / Fixed 与布局模式。 */
const resetGrid = async () => {
  if (!gridRef.value) return
  ids.splice(0, ids.length, ...getDefaultIds())
  layoutMode.value = 1
  pinnedId.value = null
  pinnedSwapIndex.value = null
  userCount.value = DEFAULT_USER_COUNT
  await nextTick()
  gridRef.value.setItems(ids)
  ids.forEach((id) => {
    gridRef.value?.setItem(id, { sticky: false, fixed: false })
  })
}

/** 一次性 setItems 初始化演示数据 */
onMounted(async () => {
  await nextTick()
  ids.push(...getDefaultIds())
  await initGrid()
  userCount.value = DEFAULT_USER_COUNT
})
</script>

<style scoped>
.demo {
  position: relative;
  width: 100vw;
  height: 100vh;
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

.tile-geo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.92);
  text-align: left;
  width: 100%;
  max-width: 140px;
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

.bar-mode {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.bar-mode-label {
  padding: 0 6px 0 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(245, 245, 245, 0.65);
  white-space: nowrap;
}

.bar-mode-btn {
  height: 40px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.bar-mode-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.bar-mode-btn.active {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
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

  .bar-mode {
    width: 100%;
    justify-content: center;
  }
}
</style>
