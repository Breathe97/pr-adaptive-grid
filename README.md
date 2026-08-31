# pr-adaptive-grid

基于 Vue 3 封装的自适应网格布局组件。支持虚拟列表、拖拽排序、多布局模式、动态增删 item、sticky / fixed 固定、iOS 风格滚动条等能力。

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
  <PrAdaptiveGrid :getLayout="getLayout">
    <template #default="{ item }">
      <div class="card">{{ item.id }}</div>
    </template>
  </PrAdaptiveGrid>
</template>

<script setup>
import { PrAdaptiveGrid, getLayout } from 'pr-adaptive-grid'
</script>
```

> 组件内部使用 `slot-scope` 暴露 `item` 对象，包含 `id`、`left`、`top`、`width`、`height`、`cx`、`cy`、`sticky`、`fixed` 等字段，可用于自定义渲染。

---

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `getLayout` | `(length: number) => Layout` | `getLayout` | 布局计算函数，根据 item 数量返回行列与占位网格 |
| `noEnterAnimation` | `boolean` | `false` | 是否禁用入场动画 |
| `overScan` | `number` | `1` | 虚拟列表溢出渲染屏数。设为负数禁用虚拟列表，渲染全部 item |
| `padding` | `number[]` | `[]` | 容器内边距，与 CSS padding 格式一致：`[v]`、`[v, h]`、`[t, h, b]`、`[t, r, b, l]` |

---

## 布局模式

组件内置三种布局函数，可从 `pr-adaptive-grid` 按需导入：

| 导出名 | 说明 |
|--------|------|
| `getLayout` | 默认布局 — 5 列 3 行主区，超出部分按 4 列扩展 |
| `getLectureLayout` | 演讲布局 — 2 列 5 行主区，右侧为侧边栏 |
| `getMobileLayout` | 移动端布局 — 3 列 3 行主区，超出部分按 3 列扩展 |

```js
import { getLayout, getLectureLayout, getMobileLayout } from 'pr-adaptive-grid'

// 传入对应布局函数即可
;<PrAdaptiveGrid :getLayout="getLectureLayout">
  ...
</PrAdaptiveGrid>
```

---

## 方法（expose）

组件通过 `ref` 暴露以下方法，用于动态管理网格内的 item：

#### `setItem(id, options?)`

新增或更新一个 item。如果 id 已存在则仅更新选项；如果该 id 正在退场则会取消退场。

插入时自动跳过 fixed item 的槽位，保持其顺序不变；fixed item 始终追加到末尾。

```js
const gridRef = ref()

// 新增 item，插入到第 2 个非 fixed 位置
gridRef.value.setItem('user-001', { index: 1, sticky: true })
```

#### `setItems(ids, options?)`

批量设置 items，会替换当前所有 item。

```js
gridRef.value.setItems(['a', 'b', 'c'], { sticky: false })
```

#### `removeItems(ids)`

移除指定 ids 的 item，会播放退场动画后移除。

```js
gridRef.value.removeItems(['user-001'])
```

#### 参数类型

| 参数 | 类型 | 说明 |
|------|------|------|
| `options.index` | `number` | 插入位置下标（非 fixed 序列中的位置） |
| `options.sticky` | `boolean` | 是否粘性定位（视觉跟随视口） |
| `options.fixed` | `boolean` | 是否固定（不可拖拽，插入时不被挤压） |

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
/** 占位格子几何 */
type LayoutCell = {
  x: number  // 列起始（1-based）
  y: number  // 行起始（1-based）
  w: number  // 跨列数
  h: number  // 跨行数
}

interface Layout {
  gap: number   // 间距 (px)
  rows: number  // 行数
  cols: number  // 列数
  items: LayoutCell[]
}

/** 真实渲染几何 */
interface Geo {
  cx: number     // 中心 x
  cy: number     // 中心 y
  left: number   // 左上角 x
  top: number    // 左上角 y
  width: number  // 宽
  height: number // 高
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
