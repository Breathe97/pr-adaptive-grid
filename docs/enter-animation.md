# 入场动画控制

`PrAdaptiveGrid` 中的每个 item 在首次挂载时会播放入场动画：从 `opacity: 0, scale(0.3)` 过渡到 `opacity: 1, scale(1)`。

## 首次初始渲染默认跳过动画

从 `v1.x` 开始，`PrAdaptiveGrid` **首次初始渲染会自动跳过入场动画**，所有 item 直接以完整样式显示。这是组件内部行为，无需外部配置。

原理：

```
组件创建 → initializing = true
    ↓
item 挂载 → onMounted 读取 noEnterAnimation = true → 跳过动画
    ↓
首次布局同步完成 → initializing = false
    ↓
后续新增 item → 正常播放入场动画
```

## 强制禁用入场动画

如果需要在特定场景下强制所有 item 跳过入场动画（无论是否首次渲染），可以通过 `no-enter-animation` prop 控制：

```vue
<PrAdaptiveGrid :no-enter-animation="true">
  <!-- item 全部跳过入场动画 -->
</PrAdaptiveGrid>
```

```vue
<PrAdaptiveGrid :no-enter-animation="someCondition">
  <!-- 动态控制 -->
</PrAdaptiveGrid>
```

## 启用首次入场动画（恢复默认行为）

如果希望首次渲染也播放入场动画，目前不提供直接开关。可以通过在首次布局完成后动态添加 item 的方式间接实现。

## 技术说明

### PrAdaptiveGrid.vue

- `initializing` ref — 标记是否处于首次初始渲染中
- `executeSyncLayout()` — 首次布局同步完成后，`await nextTick()` 等待 item 挂载，然后 `initializing = false`
- 模板中 `:no-enter-animation="props.noEnterAnimation || initializing"` — 外部传入或内部初始化只要有一个为 `true` 即跳过动画

### PrAdaptiveGridItem.vue

- `noEnterAnimation` prop — 控制当前 item 是否跳过入场动画
- `onMounted` 中判断：`true` 时直接设置 `opacity: 1; transform: scale(1)`，否则调用 `addTransform()` 播放入场动画

### 时序流程

```
PrAdaptiveGrid created
  ├── initializing = true
  ├── itemIds = []（暂无 item）
  │
  ├── setItems(ids) → spanIds = ids
  │     └── 等待 ResizeObserver 触发首次布局同步
  │
  ├── resize → isReady = true → LayoutKey 变化
  │     └── syncLayout() → rAF → executeSyncLayout()
  │           ├── layout.value = getLayout(...)
  │           ├── await nextTick() → span 占位 DOM 更新
  │           ├── getSpanGeos() → itemIds.value = ids
  │           │     └── Vue 调度 DOM 更新
  │           │
  │           ├── [DOM 更新] → PrAdaptiveGridItem 挂载
  │           │     └── onMounted → noEnterAnimation=true → 跳过动画 ✅
  │           │
  │           ├── await nextTick() → DOM 更新完成
  │           └── initializing = false
  │
  ├── changeUserCount(+1) → setItem(newId)
  │     └── 新 item 挂载 → noEnterAnimation=false → 播放入场动画 ✅
```
