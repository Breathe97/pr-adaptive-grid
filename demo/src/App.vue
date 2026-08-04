<template>
  <div class="demo" :style="demoStyle">
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
              <div class="op" :class="{ active: item.sticky }" data-type="pin" @click.stop="setPin(item)">Pin</div>
              <div class="op" :class="{ active: item.fixed }" data-type="fix" @click.stop="setFixed(item)">Fixed</div>
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
            <p class="help-desc">滚动时固定在网格可视区域。模式 1/3 可随意 Pin 多个；模式 2 只能 Pin 一个，点击时自动排到首位。</p>
          </div>
          <div class="help-item">
            <span class="help-tag help-tag-fixed">🔒 Fixed</span>
            <p class="help-desc">锁定 ids 槽位，不可拖动，排序时不会被其他 item 挤压位移。</p>
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
        <button type="button" class="bar-mode-btn" :class="{ active: layoutMode === 3 }" @click="setLayoutMode(3)">布局 3</button>
      </div>
      <span class="bar-sep" />
      <button type="button" class="bar-text" :disabled="userCount <= 1" @click="shuffleItems">打乱</button>
      <button type="button" class="bar-text" @click="resetGrid">重置</button>
      <span class="bar-sep" />
      <!-- 四边边距调试：点击按钮弹出面板控制 -->
      <div ref="paddingControlRef" class="padding-control">
        <button type="button" class="bar-text" :class="{ 'is-active': paddingOpen }" @click="paddingOpen = !paddingOpen">边距</button>
        <div class="padding-panel" :class="{ 'is-open': paddingOpen }">
          <div class="padding-panel-body">
            <label v-for="d in paddingDirs" :key="d.key" class="pad-slider">
              <span class="pad-slider-dir">{{ d.label }}</span>
              <input type="range" min="0" max="80" v-model.number="padding[d.key]" />
              <span class="pad-slider-val">{{ padding[d.key] }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { PrAdaptiveGrid, getLayout, getLectureLayout, getMobileLayout } from '../../src/index.ts'
import type { Geo, GetLayoutFn, GridItemsOptions, PrAdaptiveGridExpose } from '../../src/index.ts'

const DEFAULT_USER_COUNT = 10 // 演示初始 item 数量
const layoutMode = ref<1 | 2 | 3>(1) // 1 默认布局，2 讲座布局，3 移动布局

/** .demo 四边边距，滑块实时调试用，范围 0~80px，默认 0 */
const padding = ref({ top: 0, right: 0, bottom: 0, left: 0 })
const paddingDirs = [
  { key: 'top', label: '上' },
  { key: 'right', label: '右' },
  { key: 'bottom', label: '下' },
  { key: 'left', label: '左' }
] as const
/** 应用到 .demo 内联样式 */
const demoStyle = computed(() => ({
  paddingTop: `${padding.value.top}px`,
  paddingRight: `${padding.value.right}px`,
  paddingBottom: `${padding.value.bottom}px`,
  paddingLeft: `${padding.value.left}px`
}))

const paddingOpen = ref(false) // 边距面板是否展开
const paddingControlRef = ref<HTMLElement>() // 边距控制容器（按钮+面板），用于点击外部关闭
/** 点击边距面板外部时收起面板 */
const onDocClick = (e: MouseEvent) => {
  if (!paddingOpen.value) return
  const el = paddingControlRef.value
  if (el && !el.contains(e.target as Node)) paddingOpen.value = false
}

/** 闭包读取 layoutMode，组件只传 length */
const resolveLayout: GetLayoutFn = (length) => {
  let layout
  switch (layoutMode.value) {
    case 1:
      layout = getLayout(length)
      break
    case 2:
      layout = getLectureLayout(length)
      break
    case 3:
      layout = getMobileLayout(length)
      break
    default:
      layout = getLayout(length)
      break
  }

  return layout
}

const gridRef = ref<PrAdaptiveGridExpose>() // 网格组件实例
const userCount = ref(DEFAULT_USER_COUNT) // 工具栏显示的数量
const tileColorMap = ref(new Map<string, string>()) // 每个 id 对应的 tile 背景色

const ids: string[] = [] // 业务侧 id 顺序，与 gridItems 下标一致
const pinnedId = ref<string | null>(null) // 当前唯一 Pin 的 item id
const pinnedSwapIndex = ref<number | null>(null) // Pin 时与 index 0 互换的原下标
type GridSlotItem = Geo & Required<GridItemsOptions> & { id: string }

/** 从前 10 项中筛选可移除候选；保护当前 Pin 的 item。 */
const getRemovableCandidates = () => {
  const pool = ids.slice(0, Math.min(10, ids.length))
  if (pinnedId.value) return pool.filter((id) => id !== pinnedId.value)
  return pool
}

const canRemoveItem = computed(() => userCount.value > 1)

/** 高饱和度随机色，亮度偏高以对比黑色背景 */
const pickContrastColor = (): string => {
  const hue = Math.floor(Math.random() * 360)
  const sat = 88 + Math.floor(Math.random() * 13)
  const light = 65 + Math.floor(Math.random() * 14)
  return `hsl(${hue} ${sat}% ${light}%)`
}

/** 为新 id 分配并缓存随机背景色（单次添加用） */
const ensureTileColor = (id: string) => {
  if (tileColorMap.value.has(id)) return
  tileColorMap.value.set(id, pickContrastColor())
  tileColorMap.value = new Map(tileColorMap.value)
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
  const prevId = pinnedId.value
  if (pinnedSwapIndex.value != null) swapIdsAt(0, pinnedSwapIndex.value)
  pinnedId.value = null
  pinnedSwapIndex.value = null
  if (prevId) gridRef.value?.setItem(prevId, { sticky: false })
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

/** 切换布局模式：切到模式 2 时自动清除所有 Pin 并 Pin 第一个 item。 */
const setLayoutMode = async (mode: 1 | 2 | 3) => {
  if (layoutMode.value === mode) return
  layoutMode.value = mode

  if (mode === 2) {
    pinnedId.value = null
    pinnedSwapIndex.value = null
    if (ids.length > 0) {
      applyPinToId(ids[0])
      gridRef.value?.setItem(ids[0], { fixed: true })
    }
  }

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
  }
  userCount.value -= 1
}

/** 切换 Pin：模式 1/3 自由切换不影响布局；模式 2 唯一 Pin + 自动排到 index 0。 */
const setPin = async (target: GridSlotItem) => {
  if (ids.indexOf(target.id) < 0) return

  if (layoutMode.value === 2) {
    // 模式 2：唯一 Pin，点击时排到 index 0
    if (target.sticky) {
      clearPin()
    } else {
      applyPinToId(target.id)
    }
    await nextTick()
    await initGrid()
    return
  }

  // 模式 1/3：自由切换，不干涉布局
  gridRef.value?.setItem(target.id, { sticky: !target.sticky })
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

/** 一次 setItems，模式 2 时强制唯一 Pin，模式 1/3 保留已有 sticky 不动。 */
const initGrid = async () => {
  if (!gridRef.value) return
  gridRef.value.setItems(ids)
  // 模式 2：强制只有 pinnedId 是 sticky，清除其他
  if (layoutMode.value === 2) {
    ids.forEach((id) => {
      gridRef.value?.setItem(id, { sticky: id === pinnedId.value })
    })
  }
}

/** 分块生成默认 ids，避免大量数据同步阻塞主线程。每块生成后 yield 给浏览器。 */
const getDefaultIds = async () => {
  const next: string[] = []
  const colors = new Map<string, string>()
  const CHUNK = 10000 // 每批 1 万条

  for (let start = DEFAULT_USER_COUNT; start >= 1; start -= CHUNK) {
    const end = Math.max(1, start - CHUNK + 1)
    for (let i = start; i >= end; i--) {
      const id = `${i}`
      colors.set(id, pickContrastColor())
      next.push(id)
    }
    // 让出主线程，避免长时间阻塞
    await new Promise<void>((r) => setTimeout(r, 0))
  }

  tileColorMap.value = colors
  return next
}

/** 重置为初始默认 ids，并清除 Pin / Fixed 与布局模式。 */
const resetGrid = async () => {
  if (!gridRef.value) return
  const newIds = await getDefaultIds()
  ids.length = 0
  for (let i = 0; i < newIds.length; i++) ids.push(newIds[i])
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
  document.addEventListener('click', onDocClick)
  await nextTick()
  const newIds = await getDefaultIds()
  for (let i = 0; i < newIds.length; i++) ids.push(newIds[i])
  await initGrid()
  userCount.value = DEFAULT_USER_COUNT
})

/** 卸载时移除 Padding 面板的外部点击监听 */
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped>
.demo {
  box-sizing: border-box;
  position: relative;
  width: 100vw;
  height: 100vh;
  background: var(--bg);
  overflow: hidden;
}

.grid-wrap {
  width: 100%;
  height: 100%;
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
  width: max-content;
  max-width: calc(100% - 24px);
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
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

/* ── Padding 四边留白调试（点击弹窗） ── */
.padding-control {
  position: relative;
  flex-shrink: 0;
}
.bar-text.is-active {
  background: rgba(37, 99, 235, 0.35);
  color: #fff;
}
.padding-panel {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(28, 28, 30, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(8px) scale(0.96);
  transform-origin: bottom center;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    visibility 0.2s;
}
.padding-panel.is-open {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0) scale(1);
}
.padding-panel-body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.pad-slider {
  display: flex;
  align-items: center;
  gap: 5px;
}
.pad-slider-dir {
  width: 14px;
  text-align: center;
  font-size: 0.625rem;
  font-weight: 700;
  color: rgba(245, 245, 245, 0.75);
}
.pad-slider input[type='range'] {
  width: 64px;
  height: 16px;
  accent-color: #2563eb;
  cursor: pointer;
}
.pad-slider-val {
  min-width: 22px;
  text-align: right;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: rgba(245, 245, 245, 0.75);
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

@media (max-width: 660px) {
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
