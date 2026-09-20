# pr-adaptive-grid

基于 Vue 3 封装的自适应网格布局组件。支持**分辨率实时回调 + 外部决策换布局**、虚拟列表、拖拽排序、自定义布局工厂、动态增删 item、sticky / fixed 固定、iOS 风格滚动条等能力。

[在线预览](https://pryun.vip/pr-adaptive-grid/)

另有 React 版演示项目 [demo-react](./demo-react/README.md)，与 Vue 版 demo 在功能与 UI 上对齐。

---

## 安装

```bash
npm i pr-adaptive-grid
```

## 使用

#### 全局引入

```js
import PrAdaptiveGrid from 'pr-adaptive-grid'
app.use(PrAdaptiveGrid)
```

#### 按需引入

```js
import { PrAdaptiveGrid } from 'pr-adaptive-grid'
```

#### 基础用法

```vue
<template>
  <PrAdaptiveGrid ref="gridRef" v-slot="{ item }">
    <div class="card">{{ item.id }}</div>
  </PrAdaptiveGrid>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { PrAdaptiveGrid, pcSpeakerLayout } from 'pr-adaptive-grid'

const gridRef = ref()

onMounted(() => {
  // 首次：建列表 + 设布局 + 整屏静默，一次调用原子完成
  gridRef.value.setLayout(pcSpeakerLayout, { ids: ['a', 'b', 'c'], animate: false })
})
</script>
```

> 组件**没有任何 props**，全部能力通过 `ref` 暴露的方法驱动。
> 插槽暴露的 `item` 包含 `id`、`left`、`top`、`width`、`height`、`cx`、`cy`、`sticky`、`fixed`，用于自定义渲染。

---

## 核心概念

### 布局 = 一个纯函数

```ts
type LayoutFactory = (length: number) => Layout
```

组件只认这一种「布局」形态。**它不关心 item 是什么，只按数量算出占位网格。**

```ts
interface Layout {
  gap: number
  rows: number   // 首屏行数：这 rows 行正好铺满容器可视高度
  cols: number   // 列数
  items: LayoutCell[]  // 每项占位，数量必须等于 length
}

type LayoutCell = { x: number; y: number; w: number; h: number }  // 1-based
```

### 主区 = 一屏，溢出区 = 往下的无限滚动区

`rows` 行正好铺满容器可视高度（`itemHeight = (H - (rows-1)·gap) / rows`），这一段是**主区**。
`y > rows` 的占位落在首屏之下，随 item 数量无限延伸，靠滚动查看 —— 这就是**溢出区**。

---

## API

组件通过 `ref` 暴露 **4 个方法**：

### `setLayout(factory, options?)`

设置布局工厂。**只换几何，不触碰 item 顺序 / sticky / fixed。**

```ts
interface SetLayoutOptions {
  /** 完全重建 item 列表，顺序即传入顺序；原有顺序 / sticky / fixed 全部清空重来 */
  ids?: string[]
  /** 本次重建是否播放入场动画，默认 true；与本次 ids 批次绑定，渲染后恢复默认 */
  animate?: boolean
  /** 虚拟列表溢出渲染屏数，默认 1；负数 = 禁用虚拟列表，全量渲染 */
  overScan?: number
}
```

| 规则 | 说明 |
|------|------|
| 字段未出现 | **沿用当前值**，不重置为默认 |
| `ids` 传入 | **完全重建**：清空顺序 / sticky / fixed，按传入顺序排 |
| `ids` 不传 | 只换布局，用户拖拽排序 / sticky / fixed **全部保留** |
| `animate` | 一次性。首次传 `false` 可让整屏静默入场 |

```js
// 换布局（最常用）
gridRef.value.setLayout(mobileSpeakerLayout)

// 首次初始化：建列表 + 设布局 + 静默，一次调用原子完成
gridRef.value.setLayout(pcSpeakerLayout, { ids: ['a', 'b', 'c'], animate: false })

// 硬重置：回到初始顺序并播放入场动画
gridRef.value.setLayout(pcSpeakerLayout, { ids: [...initialIds], animate: true })
```

### `onResize(handler)`

注册容器尺寸变化回调（覆盖式，重复调用替换上一个）。**首次测量也会回调一次**，不用自己先量一遍。

```js
gridRef.value.onResize(({ width, height }) => {
  // 自己决定要不要换布局
})
```

> **尺寸变了不等于要换布局**：容器尺寸一变，组件自己就会用当前工厂重算几何。
> `setLayout` 只负责「换策略」，所以同一个策略下 **不要重复调用**。

### `setItems(items)`

批量新增 / 更新状态 / 重排。

```ts
interface GridItemInput {
  id?: string        // 目标 item；省略时用 index 定位「当前第几个槽位」
  index?: number     // id 存在时 = 重排到的目标位置；id 省略时 = 要改的是哪个槽位的 item
  sticky?: boolean
  fixed?: boolean
}
```

**两种寻址方式：**

| 写法 | 含义 |
|------|------|
| `{ id, sticky: true }` | 改这个 id 的状态；**不传 index 就是插/移到第 0 位**，注意 |
| `{ id, index: n, sticky: true }` | 改这个 id 的状态，并顺带把它重排到第 n 位 |
| `{ index: n, sticky: true }` | 改「**当前第 n 个槽位**」那个 item 的状态，**不重排** |

> 只改状态又不想搬位置，最安全的写法是 **只传 `index`**：
> `setItems([{ index: 0, sticky: true }])` —— 把当前首位设成 Sticky，其余什么都不动。

**落位规则（仅 `index` 作为重排目标时生效）：**

1. 去重：同一个 id 取最后一次声明
2. `index` 未传 → 补成**数组下标**
3. 按 `(index 升序, 数组下标升序)` 稳定排序后依次落位，冲突顺延到下一个空位
4. **未提及的已有项**保持原相对顺序，填满剩余空位
5. 整体 = 一次数组计算 + 一次重绘（虚拟列表只重算一次）

**结果与传入顺序无关；除非 `index` 全未传或全相同 —— 此时由数组先后顺序决定。**

| 场景 | 当前 | 入参 | 结果 |
|------|------|------|------|
| 全量、数组顺序即目标 | `[a,b,c]` | `[{c},{a},{b}]` | `[c,a,b]` |
| 全量、乱序 + 显式 index | `[a,b,c]` | `[{c,index:2},{a,index:0},{b,index:1}]` | `[a,b,c]` |
| 都传同一个 index | `[a,b,c]` | `[{c,index:0},{a,index:0},{b,index:0}]` | `[c,a,b]` |
| 单个新增 | `[a,b,c]` | `[{x}]` | `[x,a,b,c]`（补 index=0，插最前） |
| 只挪一项 | `[a,b,c,d]` | `[{c,index:0}]` | `[c,a,b,d]` |
| 改状态不挪位 | `[a,b,c,d]` | `[{index:2,sticky:true}]` | `[a,b,c,d]`，c 变 Sticky |
| index 越界 | `[a,b,c]` | `[{x,index:99}]` | `[a,b,c,x]`（clamp） |

**`setItems` 不删项**，删除走 `removeItems`。`fixed` 只约束**拖拽**不可移动，不约束 `setItems`。

### `removeItems(ids)`

移除 item，会播放退场动画后再摘掉。

```js
gridRef.value.removeItems(['user-001'])
```

---

## 内置布局

布局分两个维度：**设备维度**（PC / iPad / Mobile）× **展示模式**（主讲 / 平铺），共 6 个。
两个模式都是**网格随数量自适应**的 —— 不是固定网格，数量变了自动重算，一屏永远铺满、不留空白带。

| 导出名 | 主区容量 | 说明 |
|--------|----------|------|
| `pcSpeakerLayout` | 16 | PC 主讲 — 大格居中（实测占一屏 40-63%），其余 item 在大格四周用 1×1 / 2×2 / 3×3 正方形块拼满 |
| `pcGridLayout` | 16 | PC 平铺 — 等大格子，每行格数随数量自适应，末行横向拉伸补满 |
| `ipadSpeakerLayout` | 12 | iPad 主讲 — 同 PC 主讲，大格占一屏 42-71% |
| `ipadGridLayout` | 12 | iPad 平铺 — 同 PC 平铺 |
| `mobileSpeakerLayout` | 12 | Mobile 主讲 — 大格满宽置顶（约 1/3 屏），下方按平铺规则铺满 |
| `mobileGridLayout` | 12 | Mobile 平铺 — 同 PC 平铺 |
| `layouts` | — | `{ pc: { speaker, grid }, ipad: {...}, mobile: {...} }` 两级索引 |

### 比例一律朝 4:3 靠

所有 item 的宽高比都按 **4:3** 为目标挑网格（不是 16:9）。实测偏差：

| 布局 | 偏差范围 | 最优档 |
|------|----------|--------|
| PC 平铺 / iPad 平铺 | **0.3% ~ 56%** | n=12 → 0.4%；iPad n=4 → 0.3% |
| Mobile 平铺 | 6% ~ 65% | n=12 → 6.9% |
| PC / iPad 主讲 | 18% ~ 37% | — |
| Mobile 主讲 | 2% ~ 45% | n=9 → 1.9% |

> **为什么偏差下不去**：格子比例恒等于 `容器宽高比 × 行数 / 列数`，行列都是整数，所以只有少数「完美档位」能做到 0.3% 左右。低数量档（n ≤ 4）数学上无解 —— 2 个 item 铺满 16:9 屏幕，每块必然是 0.89 的竖比例，不可能同时是 4:3。
>
> **主讲模式为什么大格到不了 60-70%**：4:3 的小格 + 大格居中 + 四面包围 + 铺满，这四个条件在 16:9 屏上凑不齐（四面包围需要 ~20 个以上 4:3 小格才撑得起来）。当前策略是「大格优先」：大格保 40-60%，小格比例让位。

超出主区容量的 item 会落到溢出区，按标准格宽往下逐行铺。


```js
import { pcSpeakerLayout, pcGridLayout, ipadSpeakerLayout, ipadGridLayout, mobileSpeakerLayout, mobileGridLayout, layouts } from 'pr-adaptive-grid'
```

---

## 响应式布局

组件只上报尺寸，**换不换布局由应用层决定**。设备维度按断点判定，展示模式由自己的交互决定：

```vue
<script setup>
import { onMounted, ref } from 'vue'
import { PrAdaptiveGrid, layouts } from 'pr-adaptive-grid'

const gridRef = ref()
const initialIds = ['a', 'b', 'c', 'd']
let mode = 'speaker'   // 'speaker' 主讲 / 'grid' 平铺，换模式时同步改它
let current = layouts.pc.speaker

/** 按容器宽度判定设备维度 */
const pickSize = (width) => {
  if (width < 768) return 'mobile'
  if (width < 1180) return 'ipad'
  return 'pc'
}

onMounted(() => {
  gridRef.value.onResize(({ width }) => {
    const next = layouts[pickSize(width)][mode]
    if (next === current) return   // 同一策略 → 交给组件自动重算，别重复 setLayout
    current = next
    gridRef.value.setLayout(next)  // 只换几何，用户拖拽排序天然保留
  })

  gridRef.value.setLayout(layouts.pc.speaker, { ids: initialIds, animate: false })
})
</script>
```

---

## 自定义布局：createLayout

作者只写**主区模板**，对齐循环与溢出铺设由引擎接管，并在**构建期**校验配置。

```ts
interface CreateLayoutConfig {
  gap: number
  /** 设计容量：主区最多容纳 designCols × designRows 个 */
  designCols: number
  designRows: number
  /** 主区数量缩减的对齐除数（现有 default 布局是 designCols - 1） */
  alignDivisor: number
  /** 数量（itemsNum）→ 主区模板 */
  presets: Record<number, LayoutPreset>
  /** 溢出规则；按数组顺序匹配，命中第一个 divisibleBy 成立的 */
  surplus?: SurplusRule[]
}

interface LayoutPreset {
  cols: number
  rows: number
  /** 主区占位（完整显式坐标）；数量必须等于本 preset 在 presets 里的 key */
  items: LayoutCell[]
}

interface SurplusRule {
  divisibleBy: number   // 剩余项数能被此值整除时本规则生效
  startRow: number      // 起始行（1-based）
  startCol: number      // 起始列（1-based）
  span: number          // 每项占几列
  step?: number         // 列游标步进，缺省 = span
  wrapAtCol: number     // 列游标到达此值时换行
  lastItemSpan?: number // 只剩最后 1 项且位于 startCol 时的特殊宽度
}
```

**生成流程：**

```
1. 主区数量 = min(length, designCols × designRows)
2. 缩减主区数量，直到剩余项能被 alignDivisor 整除
3. 命中 presets[主区数量] 的模板（未命中直接抛错，不静默降级）
4. 剩余项按 surplus 规则铺到主区下方
```

**示例：**

```ts
import { createLayout } from 'pr-adaptive-grid'

export const dashboardLayout = createLayout({
  gap: 8,
  designCols: 6,
  designRows: 3,
  alignDivisor: 3,
  presets: {
    1: { cols: 1, rows: 1, items: [{ x: 1, y: 1, w: 1, h: 1 }] },
    4: { cols: 2, rows: 2, items: [
      { x: 1, y: 1, w: 1, h: 1 }, { x: 2, y: 1, w: 1, h: 1 },
      { x: 1, y: 2, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 },
    ]},
    6: { cols: 3, rows: 2, items: [
      { x: 1, y: 1, w: 1, h: 1 }, { x: 2, y: 1, w: 1, h: 1 }, { x: 3, y: 1, w: 1, h: 1 },
      { x: 1, y: 2, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 }, { x: 3, y: 2, w: 1, h: 1 },
    ]},
  },
  surplus: [
    { divisibleBy: 3, startRow: 3, startCol: 1, span: 2, step: 2, wrapAtCol: 7 },
  ],
})
```

### 构建期校验（配置写错直接抛错）

| 校验 | 挡住什么 |
|------|----------|
| `presets[k].items.length === k` | 漏 case / case 与数量对不上 |
| `x >= 1 && x + w - 1 <= cols` | 横向越界 |
| `y >= 1 && y + h - 1 <= rows` | 纵向越界 |
| `items` 两两不重叠 | 两个 item 抢同一格 |
| `rows <= 12` | 主区跨屏（破坏「主区 = 一屏」前提） |

**硬性不变量**：`factory(length).items.length === length` 对任意 `length >= 0` 恒成立。

---

## 拖拽排序

组件默认支持拖拽重排。拖拽过程中其他 item 会自动补位，松手后播放回弹动画。

- **fixed** 为 `true` 的 item 不可拖拽，也不作为拖拽落点。
- **sticky** 为 `true` 的 item 在拖拽期间跟随指针，不参与 sticky 吸附。
- 拖拽涉及 sticky item 时优先交换槽位而非挤压，避免 sticky item 视觉吸附位置与槽位不一致导致的长途位移。
- 拖拽跟随以 `pointerdown` 按下点为参考基准，越过触发阈值后 item 立即贴合鼠标，无滞后。

---

## 虚拟列表

组件内置虚拟列表渲染，默认开启（`overScan = 1`）。只渲染视口附近 ±1 屏的 item，大量数据时保持高性能。

- 通过 `overScan` prop 控制额外渲染屏数
- 基于二分查找快速定位可见 item
- 拖拽中的 item 会被强制渲染，不受视口限制

---

## 层级（z-index）

item 层级采用叠加计算方式：

| 状态 | 叠加值 |
|------|--------|
| 基础 | 1 |
| sticky | +1 |
| 被挤压位移 | +10 |
| 回弹中 | +5 + 位移10 |
| 拖拽中 | +10 + 位移10 |

回弹中的 item 数量 `n` 会额外计入拖拽和回弹的层级（`+n`）。

---

## 虚拟滚动条

组件自带 iOS 风格虚拟滚动条，隐藏原生滚动条：

- 鼠标/触摸靠近右边缘 24px 内自动显示
- 悬浮时轨道和滑块放大，便于拖拽
- 支持鼠标和触摸拖拽
- 停止滚动 1s 后自动淡出
- 拖拽时保持显示
- 滑块最小高度 40px

---

## 类型定义

```ts
/** 占位格子几何（1-based） */
type LayoutCell = {
  x: number  // 列起始
  y: number  // 行起始
  w: number  // 跨列数
  h: number  // 跨行数
}

interface Layout {
  gap: number   // 间距 (px)
  rows: number  // 首屏行数
  cols: number  // 列数
  items: LayoutCell[]
}

/** 布局工厂 */
type LayoutFactory = (length: number) => Layout

/** 真实渲染几何 */
interface Geo {
  cx: number     // 中心 x
  cy: number     // 中心 y
  left: number   // 左上角 x
  top: number    // 左上角 y
  width: number  // 宽
  height: number // 高
}

/** 容器尺寸快照 */
interface ResizePayload {
  width: number
  height: number
}

type ResizeHandler = (payload: ResizePayload) => void

/** setItems 入参项；id 与 index 二选一寻址，见上文说明 */
interface GridItemInput {
  id?: string
  index?: number
  sticky?: boolean
  fixed?: boolean
}

/** 组件 ref 暴露的方法 */
type PrAdaptiveGridExpose = {
  setLayout: (factory: LayoutFactory, options?: SetLayoutOptions) => void
  onResize: (handler: ResizeHandler) => void
  setItems: (items: GridItemInput[]) => void
  removeItems: (ids: string[]) => void
}
```

---

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build
```

---

## 代码仓库

[github](https://github.com/breathe97/pr-adaptive-grid)

## 贡献

Breathe
