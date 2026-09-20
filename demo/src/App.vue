<template>
  <div class="demo" :style="demoStyle">
    <div class="grid-wrap">
      <PrAdaptiveGrid ref="gridRef">
        <template #default="{ item }">
          <div class="tile" :class="{ 'is-sticky': item.sticky, 'is-fixed': item.fixed }" :style="{ backgroundColor: getTileColor(item.id) }">
            <div v-if="item.sticky || item.fixed" class="tile-badges">
              <span v-if="item.sticky" class="badge badge-sticky">📌 Sticky</span>
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
              <div class="op" :class="{ active: item.sticky }" data-type="sticky" @click.stop="setSticky(item)">Sticky</div>
              <div class="op" :class="{ active: item.fixed }" data-type="fix" @click.stop="setFixed(item)">Fixed</div>
            </div>
          </div>
        </template>
      </PrAdaptiveGrid>
    </div>

    <div class="float-bar">
      <div class="help-wrap">
        <button type="button" class="help-btn" aria-label="Sticky 与 Fixed 说明">?</button>
        <div class="help-panel" role="tooltip" aria-label="按钮说明">
          <p class="help-title">按钮说明</p>
          <div class="help-item">
            <span class="help-tag help-tag-sticky">📌 Sticky</span>
            <p class="help-desc">滚动时固定在网格可视区域。平铺模式可随意 Sticky 多个；主讲模式只能 Sticky 一个，点击时自动排到首位。</p>
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
      <div class="bar-mode" role="group" aria-label="展示模式">
        <button type="button" class="bar-mode-btn" :class="{ active: modeKind === 'grid' }" @click="setModeKind('grid')">平铺</button>
        <button type="button" class="bar-mode-btn" :class="{ active: modeKind === 'speaker' }" @click="setModeKind('speaker')">主讲</button>
      </div>
      <span class="bar-sep" />
      <!-- 当前实际生效的设备维度：由容器宽度自动判定，这里只做展示 -->
      <span class="bar-layout" aria-live="polite">{{ layoutLabel }}</span>
      <span class="bar-sep" />
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
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { PrAdaptiveGrid, layouts } from '../../src/index.ts'
import type { Geo, GridItemsOptions, LayoutFactory, PrAdaptiveGridExpose, ResizePayload } from '../../src/index.ts'
import { ensureTileColor, getTileColor } from './tileColorMap'

const DEFAULT_USER_COUNT = 1 // 演示初始 item 数量
type SizeKind = 'pc' | 'ipad' | 'mobile' // 设备维度：完全由容器宽度自动判定
type ModeKind = 'speaker' | 'grid' // 展示模式：主讲 / 平铺
const modeKind = ref<ModeKind>('grid') // 默认平铺，主讲由用户手动开
const currentSize = ref<SizeKind | null>(null) // 实际测到的设备维度，未测到前不显示假值
const currentLayout = ref<LayoutFactory | null>(null) // 当前生效的布局工厂，未确定前为 null
const lastWidth = ref(0) // 最近一次测量到的容器宽度
let pendingIds: string[] | null = null // 尺寸回调未到时挂起的首帧 ids
let fallbackTimer = 0 // 尺寸回调兜底定时器

const SIZE_LABEL: Record<SizeKind, string> = { pc: 'PC', ipad: 'iPad', mobile: 'Mobile' }

/** 当前生效的设备维度（展示模式由按钮高亮体现，这里不重复显示） */
const layoutLabel = computed(() => (currentSize.value ? SIZE_LABEL[currentSize.value] : '—'))

/** 按容器宽度判定设备维度：<768 移动，<1180 平板，其余 PC（与网格响应式同一套断点） */
const pickSize = (width: number): SizeKind => {
  if (width < 768) return 'mobile'
  if (width < 1180) return 'ipad'
  return 'pc'
}

/** 解析当前应生效的布局工厂（纯计算，不改状态） */
const resolveLayout = (): LayoutFactory => layouts[pickSize(lastWidth.value)][modeKind.value]

/** 记录当前生效的布局状态，供底部工具栏展示 */
const trackLayout = (factory: LayoutFactory) => {
  // 宽度未测到时不更新维度，避免按 0 判成 mobile
  if (lastWidth.value > 0) currentSize.value = pickSize(lastWidth.value)
  currentLayout.value = factory
}

/** 换布局：只换几何，不触碰 item 顺序 / sticky / fixed */
const applyLayout = () => {
  const factory = resolveLayout()
  trackLayout(factory)
  gridRef.value?.setLayout(factory)
}

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

const gridRef = ref<PrAdaptiveGridExpose>() // 网格组件实例
const userCount = ref(DEFAULT_USER_COUNT) // 工具栏显示的数量

const ids: string[] = [] // 业务侧 id 顺序，与 gridItems 下标一致
type GridSlotItem = Geo & Required<GridItemsOptions> & { id: string }

/** 从前 10 项中筛选可移除候选；主讲模式下槽位 0 就是主讲，不能移除。 */
const getRemovableCandidates = () => {
  const pool = ids.slice(0, Math.min(10, ids.length))
  if (modeKind.value === 'speaker') return pool.filter((id) => id !== ids[0])
  return pool
}

const canRemoveItem = computed(() => userCount.value > 1)

/** 交换 ids 中两个下标的 id（应用层换位） */
const swapIdsAt = (a: number, b: number) => {
  if (a === b || a < 0 || b < 0 || a >= ids.length || b >= ids.length) return
  const tmp = ids[a]
  ids[a] = ids[b]
  ids[b] = tmp
}

/**
 * 切换展示模式。
 * 主讲 = 槽位 0 那个 item 变成唯一 Sticky；取消主讲 = 清掉槽位 0 的 Sticky。
 * 只动槽位 0 的状态、不重建列表，所以用户拖拽出来的顺序天然保留。
 */
const setModeKind = (kind: ModeKind) => {
  if (modeKind.value === kind) return
  modeKind.value = kind
  gridRef.value?.setItems([{ index: 0, sticky: kind === 'speaker' }])
  applyLayout()
}

/** 切换 Fixed：只改 fixed 状态。不传 index，组件会保持该 id 当前槽位，
 *  不会拿业务层 ids 的旧下标去重排（拖拽只改组件内部顺序，业务层 ids 不跟）。 */
const setFixed = (item: GridSlotItem) => {
  gridRef.value?.setItems([{ id: item.id, fixed: !item.fixed }])
}

/** 增减 item：+1 插入新 id，-1 随机移除一个 */
const changeUserCount = (delta: number) => {
  if (delta === 1) {
    if (userCount.value < 1) return
    const id = `${Math.max(...ids.map(Number), 0) + 1}` // 递增数字 id
    const index = modeKind.value === 'speaker' ? 1 : 0 // 主讲模式下插到大格后面，不抢主讲位
    ensureTileColor(id)
    gridRef.value?.setItems([{ id, index }])
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
  userCount.value -= 1
}

/** 切换 Sticky：主讲模式下唯一 Sticky 且必定在槽位 0；平铺模式自由切换。 */
const setSticky = (target: GridSlotItem) => {
  if (ids.indexOf(target.id) < 0) return

  if (modeKind.value !== 'speaker') {
    // 平铺模式自由切换；不传 index，组件保持当前槽位，不打乱拖拽出来的顺序
    gridRef.value?.setItems([{ id: target.id, sticky: !target.sticky }])
    return
  }

  // 主讲模式：先清掉当前主讲（槽位 0），再把被点的那个换到槽位 0 并设为 Sticky
  gridRef.value?.setItems([{ index: 0, sticky: false }])
  if (target.sticky) return
  swapIdsAt(0, ids.indexOf(target.id))
  gridRef.value?.setItems([{ id: target.id, index: 0, sticky: true }])
}

/** 分块生成默认 ids，避免大量数据同步阻塞主线程。每块生成后 yield 给浏览器。 */
const getDefaultIds = async () => {
  const next: string[] = []
  const CHUNK = 10000 // 每批 1 万条

  for (let start = DEFAULT_USER_COUNT; start >= 1; start -= CHUNK) {
    const end = Math.max(1, start - CHUNK + 1)
    for (let i = start; i >= end; i--) {
      const id = `${i}`
      ensureTileColor(id) // 已有颜色的 id 原样复用，不重新生成
      next.push(id)
    }
    // 让出主线程，避免长时间阻塞
    await new Promise<void>((r) => setTimeout(r, 0))
  }

  return next
}

/** 重置为初始默认 ids，清除 Sticky / Fixed，回到自动布局；重建并播放入场动画。 */
const resetGrid = async () => {
  if (!gridRef.value) return
  const newIds = await getDefaultIds()
  ids.length = 0
  for (let i = 0; i < newIds.length; i++) ids.push(newIds[i])
  modeKind.value = 'grid'
  userCount.value = DEFAULT_USER_COUNT
  const factory = resolveLayout()
  trackLayout(factory)
  // 传入 ids 即完全重建（清空顺序 / sticky / fixed）；animate 为 true 播放入场动画
  gridRef.value.setLayout(factory, { ids: [...ids], animate: true })
}

/** 首次：注册尺寸回调 + 建列表 + 设布局 + 整屏静默 */
onMounted(async () => {
  document.addEventListener('click', onDocClick)

  // 尺寸变化 → 决策是否换布局；只有策略真的变了才 setLayout
  gridRef.value?.onResize(({ width }: ResizePayload) => {
    lastWidth.value = width
    const next = resolveLayout()
    const changed = next !== currentLayout.value
    trackLayout(next) // 换不换布局，展示用的维度都要跟上宽度
    if (pendingIds) {
      // 首个尺寸回调：此刻宽度才是真的，用它建列表，避免断点按 0 判成 mobile
      const ids = pendingIds
      pendingIds = null
      gridRef.value?.setLayout(next, { ids: [...ids], animate: false })
      return
    }
    if (changed) gridRef.value?.setLayout(next)
  })

  // 兜底：尺寸回调始终不来时不能让首帧一直空着
  fallbackTimer = window.setTimeout(() => {
    if (!pendingIds) return
    const ids = pendingIds
    pendingIds = null
    console.warn('[demo] 未收到网格尺寸回调，回退用窗口宽度判定断点')
    lastWidth.value = window.innerWidth
    const factory = resolveLayout()
    trackLayout(factory)
    gridRef.value?.setLayout(factory, { ids: [...ids], animate: false })
  }, 800)

  const newIds = await getDefaultIds()
  for (let i = 0; i < newIds.length; i++) ids.push(newIds[i])
  userCount.value = DEFAULT_USER_COUNT
  // 尺寸回调还没来 → 挂起，等它带着实测宽度来建列表，否则断点会被判错
  if (lastWidth.value <= 0) {
    pendingIds = newIds
    return
  }
  const factory = resolveLayout()
  trackLayout(factory)
  // ids 与 animate 原子绑定：首帧建列表并保持静默，之后新增 item 自动带入场动画
  gridRef.value?.setLayout(factory, { ids: [...ids], animate: false })
})

/** 卸载时移除 Padding 面板的外部点击监听 */
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.clearTimeout(fallbackTimer)
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

/* Sticky / Fixed 内阴影层（::before = Sticky，::after = Fixed） */
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

.is-sticky::before {
  opacity: 1;
  box-shadow: inset 0 0 40px 8px rgba(37, 99, 235, 0.28);
}

.is-fixed::after {
  opacity: 1;
  box-shadow: inset 0 0 40px 8px rgba(217, 119, 6, 0.28);
}

.is-sticky.is-fixed::before {
  box-shadow: inset 0 0 36px 6px rgba(37, 99, 235, 0.22);
}

.is-sticky.is-fixed::after {
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

.badge-sticky {
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

.op.active[data-type='sticky'] {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #fff;
  box-shadow: 0 2px 12px rgba(37, 99, 235, 0.45);
}

.op.active[data-type='sticky']:hover {
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

.help-tag-sticky {
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

/* 当前生效的布局名（设备维度 · 展示模式） */
.bar-layout {
  padding: 0 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: rgba(245, 245, 245, 0.72);
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

.pad-toggle-input:checked + .pad-toggle-switch::after {
  transform: translateX(13px);
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

/* ── 响应式：断点与网格的响应式标准完全对齐（<1180 平板档，<768 移动档） ── */
@media (max-width: 1179px) {
  .float-bar {
    gap: 6px;
    padding: 8px 14px;
    bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .help-btn,
  .bar-btn {
    width: 40px;
    height: 40px;
    font-size: 1.125rem;
  }

  .bar-count {
    min-width: 26px;
    font-size: 1rem;
  }

  .bar-text {
    height: 40px;
    padding: 0 14px;
    font-size: 0.875rem;
  }

  .bar-mode-btn {
    height: 34px;
    padding: 0 11px;
  }

  .bar-layout {
    padding: 0 10px;
  }

  .bar-sep {
    height: 22px;
    margin: 0 2px;
  }
}

@media (max-width: 767px) {
  .float-bar {
    width: calc(100% - 24px);
    border-radius: 16px;
  }

  .bar-sep {
    display: none;
  }

  .bar-layout {
    width: 100%;
    padding: 0;
    text-align: center;
  }

  .bar-mode {
    width: 100%;
    justify-content: center;
  }

  .bar-mode-btn {
    flex: 1;
  }
}
</style>
