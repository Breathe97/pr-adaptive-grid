# pr-adaptive-grid

基于 Vue 3 封装的自适应网格布局组件。支持拖拽排序、多布局模式、动态增删 item、sticky / fixed 固定等能力。

[在线预览](https://pryun.vip/pr-adaptive-grid/)

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
import { PrAdaptiveGrid } from 'pr-adaptive-grid'
import { getLayout } from 'pr-adaptive-grid'
</script>
```

> 组件内部使用 `slot-scope` 暴露 `item` 对象，包含 `id`、`left`、`top`、`width`、`height`、`cx`、`cy`、`sticky`、`fixed` 等字段，可用于自定义渲染。

---

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `getLayout` | `(length: number) => Layout` | `getLayout` | 布局计算函数，根据 item 数量返回行列与占位网格 |
| `noEnterAnimation` | `boolean` | `false` | 是否禁用入场动画 |

---

## 布局模式

组件内置三种布局函数，可从 `pr-adaptive-grid` 按需导入：

| 导出名 | 说明 |
|--------|------|
| `getLayout` | 默认布局 — 5 列 3 行主区，超出部分按 4 列扩展 |
| `getLectureLayout` | 演讲布局 — 2 列 5 行主区，右侧为侧边栏 |
| `getMobileLayout` | 移动端布局 — 3 列 3 行主区，超出部分按 3 列扩展 |

```js
import { getLayout } from 'pr-adaptive-grid'
import { getLectureLayout } from 'pr-adaptive-grid'
import { getMobileLayout } from 'pr-adaptive-grid'

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

```js
const gridRef = ref()

// 新增 item，插入到第 2 个位置
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
| `options.index` | `number` | 插入位置下标 |
| `options.sticky` | `boolean` | 是否粘性定位（视觉跟随视口） |
| `options.fixed` | `boolean` | 是否固定（不可拖拽，排序时固定槽位） |

---

## 拖拽排序

组件默认支持拖拽重排。拖拽过程中其他 item 会自动补位，松手后播放回弹动画。

- **fixed** 为 `true` 的 item 不可拖拽，也不作为拖拽落点。
- **sticky** 为 `true` 的 item 在拖拽期间跟随指针，不参与 sticky 吸附。

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
