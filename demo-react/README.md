# demo-react

`pr-adaptive-grid` 的 React 版演示，与 `/demo`（Vue 3 版）在功能与 UI 上完全对齐。

## 启动

```bash
npm install
npm run dev
```

## 说明

- `src/pr-adaptive-grid/` 是组件的 React 移植版：
  - `PrAdaptiveGrid.tsx` — 网格容器：虚拟列表（overScan）、拖拽排序、sticky/fixed、iOS 风格虚拟滚动条、`setItem` / `setItems` / `removeItems`（通过 ref 暴露）
  - `PrAdaptiveGridItem.tsx` — item 三层结构（position / size / visual）+ WAAPI 入场、退场、补位、回弹动画
  - `layouts/` — 三种内置布局（默认 / 演讲 / 移动端），与 Vue 版逐行一致
  - `pr-adaptive-grid.css` — 组件样式（类名与 Vue 版一致）
- `src/App.tsx` — 演示页：Sticky / Fixed 切换、增减 item、三种布局切换、打乱、重置、四边边距调试，与 Vue 版 demo 逻辑一致

## 与 Vue 版的差异（仅实现层）

- 插槽 → 渲染函数（`children` 为 `(item) => ReactNode`）
- `ref` 暴露方法通过 `forwardRef` + `useImperativeHandle`
- Vue 的响应式 watch/computed → React state + effect / 渲染期纯计算
- 入场动画标记（`recentlyAdded`）在 layout 提交后的 effect 中清理，对应 Vue 的 `nextTick` 时序
