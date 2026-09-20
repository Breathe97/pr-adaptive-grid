import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getLayout as defaultGetLayout } from './layouts/layout.pc-speaker';
import { PrAdaptiveGridItem } from './PrAdaptiveGridItem';
import type {
  Geo,
  GridItemInput,
  GridItemsOptions,
  Layout,
  LayoutCell,
  LayoutFactory,
  ResizeHandler,
  SetLayoutOptions,
} from './types';
import type {
  PrAdaptiveGridExpose,
  PrAdaptiveGridItemDragStartEvent,
} from './types';

const SCROLLBAR_EDGE_ZONE = 24; // px，鼠标/触摸在此距离右边缘内时显示滚动条
const SCROLLBAR_TRACK_PAD = 10; // 与 CSS top/bottom 一致
const SYNC_LAYOUT_DRAG_INTERVAL_MS = 300;

/** 虚拟模式行高：基于「视口内目标行数」计算，不随总行数变化。 */
const VIRTUAL_TARGET_ROWS = 12;

const DEFAULT_GEO: Geo = { cx: 0, cy: 0, left: 0, top: 0, width: 0, height: 0 };
const DEFAULT_ITEM_OPTIONS: Required<GridItemsOptions> = {
  sticky: false,
  fixed: false,
};

type StoredItemOptions = Required<GridItemsOptions>;

type DragState = {
  id: string;
  startPointer: { x: number; y: number };
  startGeo: Geo;
  currentCenter: { x: number; y: number };
  fromIndex: number;
  overIndex: number;
};

export interface PrAdaptiveGridProps {
  /** 渲染函数，接收 item 信息（对应 Vue 的默认插槽） */
  children: (
    item: Geo & { id: string; sticky: boolean; fixed: boolean },
  ) => ReactNode;
}

/** 只合并显式传入的 sticky / fixed，避免 index 或 undefined 覆盖已有状态。 */
const normalizeItemOptions = (
  options?: GridItemsOptions,
): Partial<StoredItemOptions> => {
  const next: Partial<StoredItemOptions> = {};
  if (typeof options?.sticky === 'boolean') next.sticky = options.sticky;
  if (typeof options?.fixed === 'boolean') next.fixed = options.fixed;
  return next;
};

/** 行高与余数分配结果 */
type RowMetrics = { base: number; extra: number; gap: number };

/** 第 y 行（1 起）的顶部偏移：前 extra 行各多占 1px */
const rowTop = (y: number, m: RowMetrics): number =>
  (y - 1) * (m.base + m.gap) + Math.min(y - 1, m.extra);

/** 第 y 行起跨 h 行的格子高度：只把落在跨度内的补足像素算进来 */
const rowSpanHeight = (y: number, h: number, m: RowMetrics): number =>
  h * m.base +
  (h - 1) * m.gap +
  Math.max(0, Math.min(y + h - 1, m.extra) - Math.min(y - 1, m.extra));

/** 从 LayoutCell 计算像素几何 */
const computeItemGeo = (
  cell: LayoutCell,
  colWidth: number,
  m: RowMetrics,
): Geo => {
  const { x, y, w, h } = cell;
  const left = (x - 1) * (colWidth + m.gap);
  const top = rowTop(y, m);
  const width = w * colWidth + (w - 1) * m.gap;
  const height = rowSpanHeight(y, h, m);
  return {
    cx: left + width / 2,
    cy: top + height / 2,
    left,
    top,
    width,
    height,
  };
};

const PrAdaptiveGrid = forwardRef<PrAdaptiveGridExpose, PrAdaptiveGridProps>(
  function PrAdaptiveGrid(props, ref) {
    const { children } = props;

    const wrapperRef = useRef<HTMLDivElement>(null); // 外层 wrapper（滚动条挂这里）
    const scrollRef = useRef<HTMLDivElement>(null); // 滚动容器

    const isReadyRef = useRef(false); // 是否准备就绪（首次 ResizeObserver 回调后）
    // 当前布局工厂，外部通过 setLayout 替换；用 ref 供事件回调读取最新值
    const layoutFactoryRef = useRef<LayoutFactory>(defaultGetLayout);
    const [layoutVersion, setLayoutVersion] = useState(0); // 工厂版本，驱动 layoutKey 变化后重算
    const [overScan, setOverScan] = useState(1); // 虚拟列表溢出渲染屏数
    const [skipEnterBatch, setSkipEnterBatch] = useState(false); // 本批新增项是否跳过入场动画
    const resizeHandlerRef = useRef<ResizeHandler | undefined>(undefined); // 尺寸变化回调
    // 内部布局结果 state；setter 改名避免与公开方法 setLayout 撞名
    const [layout, setLayoutState] = useState<Layout>({
      gap: 8,
      cols: 1,
      rows: 1,
      items: [],
    }); // 仅 span 占位几何
    const [size, setSize] = useState({ width: 0, height: 0 }); // 容器尺寸（行高与位移动画时长）
    const [scrollTop, setScrollTop] = useState(0); // 滚动容器 scrollTop，Sticky 定位用
    const [scrollbarVisible, setScrollbarVisible] = useState(false);
    const scrollbarHoverRef = useRef(false);
    const scrollbarDraggingRef = useRef(false);
    const scrollbarTimerRef = useRef(0);
    const scrollbarEdgeTimerRef = useRef(0);
    const scrollbarDragOffsetRef = useRef(0); // 拖拽时指针相对于滑块顶部的偏移

    const [spanIds, setSpanIdsState] = useState<string[]>([]); // 当前渲染的 span id 顺序
    const spanIdsRef = useRef<string[]>([]);
    const [leavingIds, setLeavingIdsState] = useState<string[]>([]); // 当前退场的 item
    const leavingIdsRef = useRef<string[]>([]);
    const [settlingCount, setSettlingCount] = useState(0); // 当前正在回弹的 item 数量
    const [forcedVisibleId, setForcedVisibleId] = useState<string | null>(null);
    const recentlyAddedRef = useRef(new Set<string>()); // 最近通过 setItem 添加的 item id，用于入场动画判断

    const [itemOptionsById, setItemOptionsByIdState] = useState(
      () => new Map<string, StoredItemOptions>(),
    );
    const itemOptionsRef = useRef(itemOptionsById); // 同步镜像，供事件回调读取最新值

    const [dragState, setDragState] = useState<DragState | undefined>(
      undefined,
    );
    const dragStateRef = useRef<DragState | undefined>(undefined); // 同步镜像，供事件回调读取最新值

    /** 拖拽期间缓存的容器视口信息（left/top/clientHeight）。
     *  render 里逐 item 读 getBoundingClientRect 会强制同步布局，
     *  内容复杂 + 低性能设备时是拖拽卡顿/闪烁的主要来源，缓存后拖拽几何变纯 state 计算。 */
    const dragViewportRef = useRef<
      { left: number; top: number; clientHeight: number } | undefined
    >(undefined);
    const refreshDragViewport = () => {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragViewportRef.current = {
        left: rect.left,
        top: rect.top,
        clientHeight: el.clientHeight,
      };
    };

    // 布局同步节流机制（拖拽期间约每 300ms 最多执行一次）
    const syncLayoutTokenRef = useRef(0);
    const syncLayoutDragTimerIdRef = useRef(0);
    const syncLayoutLastDragRunAtRef = useRef(0);
    const syncLayoutQueuedRef = useRef(false);
    const syncLayoutResolversRef = useRef<Array<() => void>>([]);
    const lastSyncedLayoutKeyRef = useRef(''); // 最近一次真正执行过布局计算的 layoutKey，用于跳过重复计算

    /** 统一更新 spanIds（ref 镜像 + state） */
    const updateSpanIds = (next: string[]) => {
      spanIdsRef.current = next;
      setSpanIdsState(next);
    };

    /** 统一更新 leavingIds（ref 镜像 + state） */
    const updateLeavingIds = (next: string[]) => {
      leavingIdsRef.current = next;
      setLeavingIdsState(next);
    };

    /** 统一更新 itemOptions（ref 镜像 + state） */
    const updateItemOptions = (next: Map<string, StoredItemOptions>) => {
      itemOptionsRef.current = next;
      setItemOptionsByIdState(next);
    };

    /** 统一更新 dragState（ref 镜像 + state） */
    const updateDragState = (next: DragState | undefined) => {
      dragStateRef.current = next;
      setDragState(next);
    };

    /** 写入或合并指定 item 的状态；未传入任何选项时跳过，避免无谓的对象创建。 */
    const setItemOptions = (id: string, options?: GridItemsOptions) => {
      const merged = normalizeItemOptions(options);
      if (Object.keys(merged).length === 0) return;
      const next = new Map(itemOptionsRef.current);
      const current = next.get(id) ?? DEFAULT_ITEM_OPTIONS;
      next.set(id, { ...current, ...merged });
      updateItemOptions(next);
    };

    // ── 派生几何（每次渲染按当前 state 纯计算） ──

    /** 列宽 */
    const colWidth = (() => {
      const { gap, cols } = layout;
      if (cols <= 0 || size.width <= 0) return 0;
      return (size.width - (cols - 1) * gap) / cols;
    })();

    /**
     * 行高与余数分配：把「可视高度 - 行间距」平分给 targetRows 行。
     * 除不尽的部分按 1px 依次补给前几行（行与行之间最多差 1px），让 rows 行正好铺满可视高度。
     * 不能直接向下取整 —— 那会让 rows 行累计少掉「行数 × 小数部分」像素，
     * 底部露出一条黑边（11 行布局最多差 10px，且随视口高度忽有忽无）。
     * 容器高度可能带小数，先取整，避免总高度超出可视区挤出多余滚动条。
     */
    const rowMetrics = useMemo<RowMetrics>(() => {
      const { gap, rows } = layout;
      const totalRows = Math.min(rows, VIRTUAL_TARGET_ROWS);
      if (totalRows <= 0) return { base: 0, extra: 0, gap };
      const usable = Math.max(
        0,
        Math.floor(size.height) - (totalRows - 1) * gap,
      );
      const base = Math.floor(usable / totalRows);
      return { base, extra: usable - base * totalRows, gap };
    }, [layout, size.height]);

    /** 所有 item 的几何数据 */
    const itemGeos = useMemo(() => {
      const cells = layout.items;
      const n = cells.length;
      const result = new Array<Geo>(n);
      for (let i = 0; i < n; i++) {
        result[i] = computeItemGeo(cells[i], colWidth, rowMetrics);
      }
      return result;
    }, [layout, colWidth, rowMetrics]);

    /** 总内容高度：取所有 item 底部的最大值，不受 layout.rows 限制。
     *  不能用「数组最后一个 item」—— layout.items 的顺序不保证按行递增，
     *  末位 item 若不在最低行，容器就会少算高度，底部直接露出黑边。 */
    const totalContentHeight = (() => {
      let bottom = 0;
      for (const geo of itemGeos) {
        const itemBottom = geo.top + geo.height;
        if (itemBottom > bottom) bottom = itemBottom;
      }
      return bottom;
    })();

    // 供 document 级事件回调（挂载时注册，闭包不刷新）读取最新派生值
    const derivedRef = useRef({ itemGeos, totalContentHeight });
    derivedRef.current = { itemGeos, totalContentHeight };

    /**
     * 按 top 升序排列的 item 下标 + 最大格子高度。
     * 虚拟窗口靠二分查找定位可视范围，而 layout.items 的顺序不保证按 top 递增
     * （如 pc-speaker 的 n=10 依次是 1,5,1,1,3,3,8,8,10,10 行），
     * 直接在原数组上二分会把整行 item 判成不可见 —— 底部空出一条黑边。
     */
    const geoOrder = useMemo(() => {
      const order = itemGeos.map((_, i) => i);
      order.sort((a, b) => itemGeos[a].top - itemGeos[b].top);
      let maxHeight = 0;
      for (const geo of itemGeos) {
        if (geo.height > maxHeight) maxHeight = geo.height;
      }
      return { order, maxHeight };
    }, [itemGeos]);

    /** 当前可见的 item 原始索引（含 overScan 缓冲）。在有序下标上二分 + 局部扫描，避免全量遍历。 */
    const visibleIndices = useMemo(() => {
      const geos = itemGeos;
      const n = geos.length;
      if (n === 0) return [];
      if (overScan < 0) return Array.from({ length: n }, (_, i) => i); // 负数禁用虚拟列表

      const { order, maxHeight } = geoOrder;
      const viewH = scrollRef.current?.clientHeight ?? size.height;
      const rangeStart = scrollTop - overScan * viewH;
      const rangeEnd = scrollTop + viewH + overScan * viewH;

      // 二分：第一个 top >= rangeStart 的 item
      let lo = 0;
      let hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (geos[order[mid]].top < rangeStart) lo = mid + 1;
        else hi = mid;
      }
      // 起点回退：跨多行的大格顶部在 rangeStart 之前，但底部压在可视区内
      let scanStart = lo;
      while (
        scanStart > 0 &&
        geos[order[scanStart - 1]].top + maxHeight >= rangeStart
      ) {
        scanStart--;
      }

      // 二分：第一个 top > rangeEnd 的 item
      lo = 0;
      hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (geos[order[mid]].top <= rangeEnd) lo = mid + 1;
        else hi = mid;
      }
      const scanEnd = lo;

      // 只在 scanStart~scanEnd 范围内做完整判断，通常几十个 item
      const result: number[] = [];
      for (let i = scanStart; i < scanEnd; i++) {
        const index = order[i];
        const geo = geos[index];
        if (geo.top + geo.height >= rangeStart && geo.top <= rangeEnd) {
          result.push(index);
        }
      }
      result.sort((a, b) => a - b); // 还原原始下标顺序，避免渲染顺序随滚动抖动
      return result;
    }, [itemGeos, geoOrder, scrollTop, overScan, size.height]);

    /** visibleIndices + 强制渲染集合（过滤越界索引）。
     *  sticky item 永久渲染，不受虚拟窗口排除：
     *  否则滚动后 sticky item 被卸载/重建，吸附位置与层级会错乱。 */
    const visibleIndicesWithDrag = (() => {
      const set = new Set(visibleIndices);
      if (forcedVisibleId) {
        const idx = spanIds.indexOf(forcedVisibleId);
        if (idx !== -1) set.add(idx);
      }
      // sticky 不参与动态渲染排除，始终加入渲染集合
      spanIds.forEach((id, i) => {
        if (itemOptionsById.get(id)?.sticky) set.add(i);
      });
      const max = spanIds.length;
      return [...set].filter((i) => i >= 0 && i < max).sort((a, b) => a - b);
    })();

    /** 读取指定 item 的 sticky / fixed 状态，未设置时返回默认状态。 */
    const getItemOptions = (id: string): StoredItemOptions =>
      itemOptionsById.get(id) ?? DEFAULT_ITEM_OPTIONS;

    /** 判断 item 是否固定；固定 item 不可被拖动，也不作为拖拽落点。 */
    const isFixedItem = (id?: string) => {
      if (id === undefined) return false;
      return (
        itemOptionsRef.current.get(id)?.fixed ?? DEFAULT_ITEM_OPTIONS.fixed
      );
    };

    const isFixedSpanIndex = (index: number) =>
      isFixedItem(spanIdsRef.current[index]);

    /**
     * 移除 item 之后重新平衡顺序：fixed item 回到移除前的槽位，其余 item 按原相对顺序填满剩余空位。
     * 不做这步的话，splice 会让被移除项之后的所有 item 整体前移一格，fixed item 也跟着挪，
     * 与「锁定槽位」的语义直接冲突。
     * @param fixedSlotBefore 移除**之前**记录的各 fixed item 槽位快照
     */
    const reorderKeepingFixedSlots = (
      fixedSlotBefore: Map<string, number>,
    ) => {
      const ids = spanIdsRef.current;
      const total = ids.length;
      if (total === 0 || fixedSlotBefore.size === 0) return;

      const slots = new Array<string | undefined>(total);
      const pinned = new Set<string>();

      // fixed 先按移除前的槽位占位；越界（原本在末尾、总数变小）或撞车的往前找最近空位
      fixedSlotBefore.forEach((slotBefore, id) => {
        if (!ids.includes(id)) return;
        let pos = Math.min(slotBefore, total - 1);
        while (pos > 0 && slots[pos] !== undefined) pos -= 1;
        if (slots[pos] !== undefined) return;
        slots[pos] = id;
        pinned.add(id);
      });

      // 其余 item 按原相对顺序填满剩下的空位
      let cursor = 0;
      ids.forEach((id) => {
        if (pinned.has(id)) return;
        while (cursor < total && slots[cursor] !== undefined) cursor += 1;
        if (cursor >= total) return;
        slots[cursor] = id;
        cursor += 1;
      });

      const next = slots.filter((id): id is string => id !== undefined);
      // 顺序真的变了才提交，避免无谓的重渲染
      if (
        next.length === total &&
        next.some((spanId, index) => spanId !== ids[index])
      ) {
        updateSpanIds(next);
      }
    };

    // ── 布局同步 ──

    /** 布局 key：容器尺寸、span 数量或布局工厂版本变化时触发重新计算。 */
    const layoutKey = `${size.width}-${size.height}-${spanIds.length}-${layoutVersion}`;

    /**
     * 真正执行布局同步；token 用来丢弃过期异步结果。
     * 同一 layoutKey 只算一次：setItems 等改动 spanIds 后会立即 syncLayout，
     * 随后 layoutKey 的 effect 还会再触发一次，不去重就会把布局工厂跑两遍。
     */
    const executeSyncLayout = () => {
      if (isReadyRef.current === false) return;
      if (layoutKey === lastSyncedLayoutKeyRef.current) return;
      lastSyncedLayoutKeyRef.current = layoutKey;

      syncLayoutTokenRef.current++;
      setLayoutState(layoutFactoryRef.current(spanIdsRef.current.length));
      // recentlyAdded 清理与入场开关关闭放到 layout 提交后的 effect 中，
      // 保证新 item 首帧渲染时仍带入场动画标记（对应 Vue 的 nextTick 时序）。
    };

    const resolveSyncLayoutWaiters = () => {
      const resolvers = syncLayoutResolversRef.current;
      syncLayoutResolversRef.current = [];
      resolvers.forEach((resolve) => resolve());
    };

    const runQueuedSyncLayout = () => {
      if (!syncLayoutQueuedRef.current) return Promise.resolve();
      syncLayoutQueuedRef.current = false;
      executeSyncLayout();
      resolveSyncLayoutWaiters();
      return Promise.resolve();
    };

    const cancelScheduledSyncLayout = () => {
      if (syncLayoutDragTimerIdRef.current) {
        clearTimeout(syncLayoutDragTimerIdRef.current);
        syncLayoutDragTimerIdRef.current = 0;
      }
    };

    /** 拖拽中：约每 300ms 最多执行一次布局同步。 */
    const scheduleSyncLayoutDrag = () => {
      if (syncLayoutDragTimerIdRef.current) return;

      const elapsed = Date.now() - syncLayoutLastDragRunAtRef.current;
      const delay = Math.max(0, SYNC_LAYOUT_DRAG_INTERVAL_MS - elapsed);

      syncLayoutDragTimerIdRef.current = window.setTimeout(() => {
        syncLayoutDragTimerIdRef.current = 0;
        syncLayoutLastDragRunAtRef.current = Date.now();
        void runQueuedSyncLayout().then(() => {
          if (syncLayoutQueuedRef.current) scheduleSyncLayoutDrag();
        });
      }, delay);
    };

    /**
     * 重新计算布局并刷新 span 几何。
     * @param duringDrag 拖拽移动触发的重排，使用节流；非拖拽直接同步执行。
     */
    const syncLayout = (duringDrag = false) => {
      syncLayoutQueuedRef.current = true;
      return new Promise<void>((resolve) => {
        syncLayoutResolversRef.current.push(resolve);
        if (duringDrag) {
          scheduleSyncLayoutDrag();
          return;
        }
        // 非拖拽：立即执行，避免 spanIds 已变但 layout 未更新导致 visibleIndices 不同步
        void runQueuedSyncLayout().then(resolve);
      });
    };

    // layout 提交后清理入场标记并恢复入场开关（对应 Vue 的 nextTick 时序）
    useEffect(() => {
      recentlyAddedRef.current.clear();
      setSkipEnterBatch(false);
    }, [layout]);

    // 布局受外部变量实时变化：容器尺寸、span 数量或布局工厂版本变化时触发重新计算
    // （layoutKey 的定义见上方「布局同步」段）。
    useEffect(() => {
      void syncLayout();
    }, [layoutKey]);

    // ── 拖拽排序 ──

    /** 拖拽换位后，让 sticky / fixed 跟随槽位而不是跟随 id。 */
    const applySlotOptionsAfterReorder = (
      prevSpanIds: string[],
      nextSpanIds: string[],
    ) => {
      const prevSlotOptions = prevSpanIds.map(
        (spanId) => itemOptionsRef.current.get(spanId) ?? DEFAULT_ITEM_OPTIONS,
      );
      const nextOptions = new Map(itemOptionsRef.current);
      let changed = false;

      nextSpanIds.forEach((spanId, index) => {
        const slotOptions = prevSlotOptions[index];
        const current = nextOptions.get(spanId) ?? DEFAULT_ITEM_OPTIONS;
        if (
          current.sticky === slotOptions.sticky &&
          current.fixed === slotOptions.fixed
        ) {
          return;
        }
        nextOptions.set(spanId, { ...slotOptions });
        changed = true;
      });

      // 选项没有任何变化时不提交新 Map，避免无谓的重渲染
      if (changed) updateItemOptions(nextOptions);
    };

    /** 将指定 id 移动到目标 span 下标，返回是否真的发生了排序变化。 */
    const moveSpanId = (id: string, toIndex: number) => {
      const ids = spanIdsRef.current;
      const fromIndex = ids.indexOf(id);
      if (fromIndex === -1) return false;

      const targetIndex = Math.max(0, Math.min(toIndex, ids.length - 1));
      if (fromIndex === targetIndex) return false;
      if (isFixedItem(id) || isFixedSpanIndex(targetIndex)) return false;

      const prevSpanIds = [...ids];

      // 碰撞双方任一为 sticky item 时优先交换而不是挤压：sticky 的视觉位置被吸附在视口内，
      // 挤压会让它从吸附位长途奔袭到新槽位，轨迹过长看起来像动画丢失；交换只需短距离过渡。
      const targetId = ids[targetIndex];
      const isDragSticky = itemOptionsRef.current.get(id)?.sticky;
      const isTargetSticky =
        targetId &&
        targetId !== id &&
        itemOptionsRef.current.get(targetId)?.sticky;
      if (isDragSticky || isTargetSticky) {
        const nextSpanIds = [...ids];
        nextSpanIds[fromIndex] = targetId;
        nextSpanIds[targetIndex] = id;
        updateSpanIds(nextSpanIds);
        applySlotOptionsAfterReorder(prevSpanIds, nextSpanIds);
        return true;
      }

      const fixedSlots = new Map<number, string>();
      ids.forEach((spanId, index) => {
        if (spanId !== id && isFixedItem(spanId)) fixedSlots.set(index, spanId);
      });

      const movableSlotIndexes = ids
        .map((_, index) => index)
        .filter((index) => !fixedSlots.has(index));
      const targetMovableIndex = movableSlotIndexes.indexOf(targetIndex);
      if (targetMovableIndex === -1) return false;

      const movableIds = movableSlotIndexes
        .map((index) => ids[index])
        .filter((spanId) => spanId !== id);
      movableIds.splice(targetMovableIndex, 0, id);

      const nextSpanIds = [...ids];
      movableSlotIndexes.forEach((slotIndex, index) => {
        nextSpanIds[slotIndex] = movableIds[index];
      });
      updateSpanIds(nextSpanIds);
      applySlotOptionsAfterReorder(prevSpanIds, nextSpanIds);
      return true;
    };

    /** 根据拖拽 item 的视觉中心点，寻找距离最近的 span 槽位。 */
    const getNearestSpanIndex = (
      center: { x: number; y: number },
      fallbackIndex: number,
    ) => {
      let nearestIndex = fallbackIndex;
      let nearestScore = Number.POSITIVE_INFINITY;

      const viewportHeight = scrollRef.current?.clientHeight ?? 0;

      derivedRef.current.itemGeos.forEach((geo, index) => {
        const id = spanIdsRef.current[index];
        // 正在退场的 item 不参与拖拽目标判断，避免拖到即将移除的槽位。
        if (id !== undefined && leavingIdsRef.current.includes(id)) return;
        if (isFixedItem(id)) return;

        // sticky item 的视觉位置被吸附在视口内，与槽位占位不同；
        // 距离判定必须用吸附后的视觉 cy，否则滚动越多偏差越大，拖到看得见的 Sticky item 上会判定到别的槽位。
        let cy = geo.cy;
        if (viewportHeight > 0 && itemOptionsRef.current.get(id)?.sticky) {
          const minCenterY = scrollTop + geo.height / 2;
          const maxCenterY =
            scrollTop +
            Math.max(geo.height / 2, viewportHeight - geo.height / 2);
          cy = Math.min(Math.max(geo.cy, minCenterY), maxCenterY);
        }

        // 用平方距离比较即可，不需要开方，结果排序一致且计算更轻。
        const dx = center.x - geo.cx;
        const dy = center.y - cy;
        const score = dx * dx + dy * dy;
        if (score >= nearestScore) return;

        nearestIndex = index;
        nearestScore = score;
      });

      return nearestIndex;
    };

    /** 根据当前 pointer 位置刷新拖拽中心点，并在跨槽位时调整 spanIds 顺序。 */
    const updateDragStateFromPointer = (
      state: DragState,
      event: PointerEvent,
    ) => {
      const dx = event.clientX - state.startPointer.x;
      const dy = event.clientY - state.startPointer.y;
      const currentCenter = {
        x: state.startGeo.cx + dx,
        y: state.startGeo.cy + dy,
      };
      const overIndex = getNearestSpanIndex(currentCenter, state.overIndex);
      const didReorder =
        overIndex !== state.overIndex && moveSpanId(state.id, overIndex);
      const nextState = { ...state, currentCenter, overIndex };
      updateDragState(nextState);

      return { didReorder };
    };

    /** 开始拖拽：记录指针起点、item 初始 geo 与原始下标。 */
    const onItemDragStart: PrAdaptiveGridItemDragStartEvent = (
      id,
      event,
      origin,
    ) => {
      if (isFixedItem(id)) return;

      const fromIndex = spanIdsRef.current.indexOf(id);
      const slotGeo =
        fromIndex === -1 ? undefined : derivedRef.current.itemGeos[fromIndex];
      if (!slotGeo) return;

      refreshDragViewport(); // 缓存容器视口信息，拖拽期间的渲染不再逐 item 读布局

      // sticky item 的视觉位置被吸附在视口内，与槽位占位不同；滚动越多偏差越大。
      // 拖拽跟随必须从视觉位置起步，否则 currentCenter 以槽位为基准会向上/向下偏移。
      const startGeo = stickyGeoFor(id, fromIndex) ?? slotGeo;

      setForcedVisibleId(id); // 虚拟模式下确保拖拽 item 始终渲染
      event.preventDefault();
      // 注意：不能在此处把滚动容器的 overflow 切成 visible，否则 scrollTop 会被重置为 0，已滚动的网格整体坍塌。
      // 参考基准用 pointerdown 坐标而非阈值触发时的坐标：
      // 这样提交拖拽瞬间 currentCenter 就已包含阈值内的位移，item 精确贴合鼠标，无滞后。
      const originX = origin?.x ?? event.clientX;
      const originY = origin?.y ?? event.clientY;
      updateDragState({
        id,
        startPointer: { x: originX, y: originY },
        startGeo,
        currentCenter: {
          x: startGeo.cx + (event.clientX - originX),
          y: startGeo.cy + (event.clientY - originY),
        },
        fromIndex,
        overIndex: fromIndex,
      });
    };

    /** 拖拽移动：更新临时 geo，并在目标槽位变化时让其他 item 补位。 */
    const onItemDragMove = (id: string, event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.id !== id) return;

      event.preventDefault();
      const { didReorder } = updateDragStateFromPointer(state, event);
      if (didReorder) void syncLayout(true);
    };

    /** 结束拖拽：先落位并立刻清 dragState 触发回弹，再异步同步布局。 */
    const onItemDragEnd = (id: string, event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.id !== id) return;
      event.preventDefault();

      updateDragStateFromPointer(state, event);
      updateDragState(undefined);
      setForcedVisibleId(null);
      dragViewportRef.current = undefined; // 拖拽结束，释放缓存
      void syncLayout();
    };

    // ── item 增删 ──

    /**
     * 把「目标位置」归一化成最终槽位序列。
     * - 已存在的 item 未传 index ⇒ 保持它在当前顺序里的槽位（只改状态、不重排）
     * - fixed item 先按当前槽位钉死，新增 / 重排都顶不走它们
     * - 其余按 (index 升序, 数组下标升序) 稳定排序后依次落位，冲突顺延到下一个空位
     */
    const computeNextSpanIds = (
      list: GridItemInput[],
      current: string[],
    ): string[] => {
      const currentSet = new Set(current);
      const currentIndexById = new Map(current.map((id, index) => [id, index]));

      // 去重：同一个 id 只取最后一次声明，并记下它的数组下标
      const declared = new Map<string, { index: number; order: number }>();
      list.forEach((item, order) => {
        if (!item?.id) return;
        // 已存在的 item 但没传 index ⇒ 保持它在当前顺序里的槽位，index 只当定位用、不重排。
        // 否则「只改 sticky / fixed 状态」会被当成重排，把用户拖拽出来的顺序打回原样。
        const existingIndex = currentIndexById.get(item.id);
        const index =
          item.index ?? (existingIndex === undefined ? order : existingIndex);
        declared.set(item.id, { index, order });
      });

      const addedCount = [...declared.keys()].filter(
        (id) => !currentSet.has(id),
      ).length;
      const total = current.length + addedCount;
      if (total === 0) return [];

      // 稳定排序：index 升序；index 相同则按数组下标升序
      const ordered = [...declared.entries()].sort((a, b) =>
        a[1].index === b[1].index
          ? a[1].order - b[1].order
          : a[1].index - b[1].index,
      );

      const slots = new Array<string | undefined>(total);

      // fixed item 先按当前槽位钉死：新增 / 重排都不许把它们顶走。
      // 否则新 item 抢下槽位 0，后面所有 item 依次后移，fixed 那个也被挤开 —— 与「锁定槽位」的语义直接冲突。
      const pinned = new Set<string>();
      current.forEach((id, index) => {
        if (!isFixedItem(id)) return;
        slots[Math.min(index, total - 1)] = id;
        pinned.add(id);
      });

      /** 从 target 起找第一个空位落座；target 越界自动纠正到合法区间 */
      const takeSlot = (id: string, target: number) => {
        let pos = Math.max(0, Math.min(target, total - 1));
        while (pos < total && slots[pos] !== undefined) pos += 1;
        if (pos >= total) return;
        slots[pos] = id;
      };

      ordered.forEach(([id, meta]) => {
        if (pinned.has(id)) return; // fixed item 的槽位已经锁定，忽略它的重排请求
        takeSlot(id, meta.index);
      });

      // 未被提及的已有项：按原相对顺序填满剩余空位（已钉死的 fixed item 跳过，避免被写进第二个槽位）
      let cursor = 0;
      current.forEach((id) => {
        if (declared.has(id) || pinned.has(id)) return;
        while (cursor < total && slots[cursor] !== undefined) cursor += 1;
        if (cursor >= total) return;
        slots[cursor] = id;
        cursor += 1;
      });

      return slots.filter((id): id is string => id !== undefined);
    };

    /** 结束进行中的拖拽（重排会让拖拽的起始下标失效） */
    const cancelDrag = () => {
      if (!dragStateRef.current) return;
      updateDragState(undefined);
      setForcedVisibleId(null);
      dragViewportRef.current = undefined;
    };

    /** 完全重建 item 列表：清空顺序 / sticky / fixed，按传入顺序重排 */
    const replaceItems = (ids: string[]) => {
      cancelDrag();
      const nextIds: string[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        nextIds.push(id);
      }
      updateLeavingIds([]);
      updateItemOptions(new Map());
      recentlyAddedRef.current.clear();
      nextIds.forEach((id) => recentlyAddedRef.current.add(id));
      updateSpanIds(nextIds);
      void syncLayout();
    };

    /**
     * 批量设置 / 新增 / 重排 item。
     * - 传 id：改该 id 的参数；同时传 index 就是把它重排到目标槽位
     * - 只传 index（不传 id）：改「当前第 index 个槽位」那个 item 的参数，不重排
     * 未提及的已有项保持原相对顺序。
     */
    const setItems = (list: GridItemInput[]) => {
      if (!Array.isArray(list) || list.length === 0) return;
      cancelDrag();

      // 解析目标 id：显式 id 优先（允许是尚未存在的新 item）；只给 index 时按当前槽位定位
      const resolved: (GridItemInput & { id: string })[] = [];
      list.forEach((item) => {
        if (!item) return;
        const targetId = item.id ?? (item.index === undefined ? undefined : spanIdsRef.current[item.index]);
        if (!targetId) return;
        resolved.push({ ...item, id: targetId });
      });
      if (resolved.length === 0) return;

      resolved.forEach((item) => {
        // 正在退场的 id 被重新声明 → 复活，取消退场
        const leaving = leavingIdsRef.current;
        const leavingIndex = leaving.indexOf(item.id);
        if (leavingIndex !== -1) {
          const nextLeaving = [...leaving];
          nextLeaving.splice(leavingIndex, 1);
          updateLeavingIds(nextLeaving);
        }
        setItemOptions(item.id, item);
        if (!spanIdsRef.current.includes(item.id)) {
          recentlyAddedRef.current.add(item.id);
        }
      });

      updateSpanIds(computeNextSpanIds(resolved, spanIdsRef.current));
      void syncLayout();
    };

    /** 设置布局工厂；可选完全重建 item 列表与渲染配置 */
    const setLayout = (factory: LayoutFactory, options: SetLayoutOptions = {}) => {
      if (options.overScan !== undefined) setOverScan(options.overScan);

      // 先换工厂并记版本，保证随后触发的重算用的是新工厂
      if (factory !== layoutFactoryRef.current) {
        layoutFactoryRef.current = factory;
        setLayoutVersion((v) => v + 1);
      }

      if (options.ids) {
        setSkipEnterBatch(options.animate === false);
        replaceItems(options.ids);
      }
    };

    /** 注册尺寸变化回调；覆盖式，重复调用替换上一个 */
    const onResize = (handler: ResizeHandler) => {
      resizeHandlerRef.current = handler;
    };

    /** 移除 item 并重算布局 */
    const removeItems = (removeIds: string[]) => {
      const nextLeaving = [...leavingIdsRef.current];
      for (const id of removeIds) {
        if (!spanIdsRef.current.includes(id)) continue;
        if (nextLeaving.includes(id)) continue;
        nextLeaving.push(id);
      }
      updateLeavingIds(nextLeaving);
    };

    /** item 退场动画完成后，真正从 span 列表中移除。 */
    const onItemLeaveEnd = (id: string) => {
      const leaving = leavingIdsRef.current;
      const leavingIndex = leaving.indexOf(id);
      // 已经被 setItem 复活了，忽略这次退场完成回调
      if (leavingIndex === -1) return;
      if (dragStateRef.current?.id === id) {
        updateDragState(undefined);
      }
      const nextLeaving = [...leaving];
      nextLeaving.splice(leavingIndex, 1);
      updateLeavingIds(nextLeaving);

      const ids = spanIdsRef.current;
      const spanIndex = ids.indexOf(id);

      // 先记下移除前各 fixed item 的槽位：splice 之后它们会整体前移，
      // 事后再读 spanIds 拿到的是「已经前移过的」下标，按那个保位等于没保。
      const fixedSlotBefore = new Map<string, number>();
      if (spanIndex !== -1) {
        ids.forEach((spanId, index) => {
          if (index === spanIndex || !isFixedItem(spanId)) return;
          fixedSlotBefore.set(spanId, index);
        });
      }

      const nextOptions = new Map(itemOptionsRef.current);
      nextOptions.delete(id);
      updateItemOptions(nextOptions);

      if (spanIndex === -1) return;

      const nextIds = [...ids];
      nextIds.splice(spanIndex, 1);
      updateSpanIds(nextIds);
      reorderKeepingFixedSlots(fixedSlotBefore);
    };

    /** 跟踪 item 回弹状态变化，维护 settlingCount。 */
    const onItemSettlingChange = (_id: string, isSettling: boolean) => {
      setSettlingCount((c) => c + (isSettling ? 1 : -1));
    };

    // ── 滚动与虚拟滚动条 ──

    const showScrollbar = () => {
      setScrollbarVisible(true);
      clearTimeout(scrollbarTimerRef.current);
    };
    const hideScrollbar = () => {
      if (scrollbarHoverRef.current || scrollbarDraggingRef.current) return;
      setScrollbarVisible(false);
    };
    const delayHideScrollbar = () => {
      clearTimeout(scrollbarTimerRef.current);
      scrollbarTimerRef.current = window.setTimeout(hideScrollbar, 1000);
    };

    /** 记录滚动偏移，显示虚拟滚动条并在停止后自动隐藏 */
    const onScroll = () => {
      const el = scrollRef.current;
      if (!el) return;
      setScrollTop(el.scrollTop);
      // 拖拽中滚动会改变容器视口位置，同步刷新缓存，保证拖拽几何不漂移
      if (dragStateRef.current) refreshDragViewport();
      if (derivedRef.current.totalContentHeight > el.clientHeight) {
        showScrollbar();
        delayHideScrollbar();
      }
    };

    /** 鼠标进入滚动条区域 → 保持显示 */
    const onScrollbarEnter = () => {
      scrollbarHoverRef.current = true;
      if (
        derivedRef.current.totalContentHeight >
        (scrollRef.current?.clientHeight ?? 0)
      ) {
        showScrollbar();
      }
    };
    /** 鼠标离开滚动条区域 → 恢复自动隐藏 */
    const onScrollbarLeave = () => {
      scrollbarHoverRef.current = false;
      if (!scrollbarDraggingRef.current) delayHideScrollbar();
    };

    /** 鼠标/触摸在 wrapper 上移动：检测是否靠近右边缘以显示滚动条 */
    const onWrapperPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (scrollbarDraggingRef.current) return;
      const el = scrollRef.current;
      if (!el || derivedRef.current.totalContentHeight <= el.clientHeight)
        return;
      const rect = el.getBoundingClientRect();
      const dist = rect.right - e.clientX;
      if (dist >= 0 && dist <= SCROLLBAR_EDGE_ZONE) {
        showScrollbar();
        clearTimeout(scrollbarEdgeTimerRef.current);
      } else {
        // 离开边缘区域后延迟隐藏（给短暂离开再回来的缓冲）
        if (!scrollbarHoverRef.current && !scrollbarDraggingRef.current) {
          clearTimeout(scrollbarEdgeTimerRef.current);
          scrollbarEdgeTimerRef.current = window.setTimeout(() => {
            if (!scrollbarHoverRef.current && !scrollbarDraggingRef.current)
              delayHideScrollbar();
          }, 300);
        }
      }
    };

    /** 开始拖拽滚动条 */
    const onScrollbarPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = scrollRef.current;
      const totalH = derivedRef.current.totalContentHeight;
      if (!el || totalH <= el.clientHeight) return;
      e.preventDefault();

      const { top, height } = el.getBoundingClientRect();
      const p = SCROLLBAR_TRACK_PAD;
      const clickY = e.clientY - top - p; // 相对于轨道顶部的 Y
      const trackH = height - p * 2;
      const scrollRange = totalH - el.clientHeight;
      const thumbH = Math.max(40, (el.clientHeight / totalH) * trackH);
      const travel = trackH - thumbH;
      const currentThumbTop = (scrollTop / scrollRange) * travel;

      if (clickY >= currentThumbTop && clickY <= currentThumbTop + thumbH) {
        // 点在滑块上 → 记录指针相对滑块顶部的偏移，不跳转位置
        scrollbarDragOffsetRef.current = clickY - currentThumbTop;
      } else {
        // 点在轨道上 → 跳到点击位置（以滑块中心为拖拽起点）
        const ratio =
          travel > 0
            ? Math.max(0, Math.min((clickY - thumbH / 2) / travel, 1))
            : 0;
        el.scrollTop = ratio * scrollRange;
        setScrollTop(el.scrollTop);
        scrollbarDragOffsetRef.current = thumbH / 2;
      }

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      scrollbarDraggingRef.current = true;
    };

    /** 拖拽中 pointermove（document 级监听） */
    const onScrollbarPointerMove = (e: PointerEvent) => {
      if (!scrollbarDraggingRef.current) return;
      const el = scrollRef.current;
      const totalH = derivedRef.current.totalContentHeight;
      if (!el || totalH <= el.clientHeight) return;

      const { top, height } = el.getBoundingClientRect();
      const p = SCROLLBAR_TRACK_PAD;
      const trackH = height - p * 2;
      const thumbH = Math.max(40, (el.clientHeight / totalH) * trackH);
      const travel = trackH - thumbH;
      const pointerY = e.clientY - top - p - scrollbarDragOffsetRef.current;
      const ratio =
        travel > 0 ? Math.max(0, Math.min(pointerY / travel, 1)) : 0;
      el.scrollTop = ratio * (totalH - el.clientHeight);
      setScrollTop(el.scrollTop);
    };

    /** 拖拽结束 pointerup（document 级监听） */
    const onScrollbarPointerUp = () => {
      if (!scrollbarDraggingRef.current) return;
      scrollbarDraggingRef.current = false;
      if (!scrollbarHoverRef.current) delayHideScrollbar();
    };

    // ── 挂载 / 卸载 ──

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;

      let pendingSize = { width: 0, height: 0 };
      let resizeTimer = 0;

      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        pendingSize = { width, height };
        /**
         * 先派发尺寸（外部可在回调里同步 setLayout），再写入 size 驱动重算。
         * 顺序不能反：反了会先用旧尺寸算一遍、再用新尺寸算一遍。
         */
        const applySize = () => {
          resizeHandlerRef.current?.({
            width: pendingSize.width,
            height: pendingSize.height,
          });
          setSize(pendingSize);
          // 拖拽中容器尺寸变化会改变视口位置，同步刷新缓存
          if (dragStateRef.current) refreshDragViewport();
        };
        if (isReadyRef.current === false) {
          isReadyRef.current = true;
          applySize();
          return;
        }
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(applySize, 50); // 节流
      });
      observer.observe(el);

      // 全局 pointermove/up 监听滚动条拖拽
      document.addEventListener('pointermove', onScrollbarPointerMove);
      document.addEventListener('pointerup', onScrollbarPointerUp);

      return () => {
        document.removeEventListener('pointermove', onScrollbarPointerMove);
        document.removeEventListener('pointerup', onScrollbarPointerUp);
        observer.disconnect();
        if (resizeTimer) clearTimeout(resizeTimer);
        cancelScheduledSyncLayout();
        syncLayoutQueuedRef.current = false;
        resolveSyncLayoutWaiters();
      };
    }, []);

    // 暴露方法（对应 Vue defineExpose）
    useImperativeHandle(ref, () => ({
      setLayout,
      onResize,
      setItems,
      removeItems,
    }));

    // ── 渲染 ──

    /** content 容器撑开滚动高度 */
    const containerStyle: CSSProperties = { height: `${totalContentHeight}px` };

    /** iOS 风格虚拟滚动条滑块样式 */
    const scrollbarThumbStyle: CSSProperties = (() => {
      const el = scrollRef.current;
      const totalH = totalContentHeight;
      if (!el || totalH <= 0) return {};
      const { clientHeight } = el;
      if (totalH <= clientHeight) return {};
      const p = SCROLLBAR_TRACK_PAD;
      const trackH = clientHeight - p * 2;
      const thumbH = Math.max(40, (clientHeight / totalH) * trackH);
      const travel = trackH - thumbH;
      const thumbTop = (scrollTop / (totalH - clientHeight)) * travel;
      return {
        height: `${thumbH}px`,
        transform: `translateY(${thumbTop}px)`,
      };
    })();

    /** sticky 只调整视觉位置，不改 spanIds 的真实占位。 */
    const stickyGeoFor = (id: string, index: number): Geo | undefined => {
      if (!getItemOptions(id).sticky) return undefined;
      if (dragState?.id === id) return undefined;

      const geo = itemGeos[index];
      if (!geo) return undefined;

      // 拖拽中用缓存的 clientHeight，避免 render 里逐 item 触发同步布局
      const viewportHeight =
        (dragState ? dragViewportRef.current?.clientHeight : undefined) ??
        scrollRef.current?.clientHeight ??
        size.height;
      if (viewportHeight <= 0) return geo;

      const minCenterY = scrollTop + geo.height / 2;
      const maxCenterY =
        scrollTop + Math.max(geo.height / 2, viewportHeight - geo.height / 2);
      const stickyCy = Math.min(Math.max(geo.cy, minCenterY), maxCenterY);

      return {
        ...geo,
        top: stickyCy - geo.height / 2,
        cy: stickyCy,
      };
    };

    /**
     * 根据拖拽中心点生成临时 geo，让拖拽项直接跟随指针。
     * 返回的是「屏幕坐标」：拖拽项使用 fixed 定位，可超出网格边界显示。
     */
    const dragGeoFor = (id: string): Geo | undefined => {
      const state = dragState;
      if (!state || state.id !== id) return undefined;

      // 优先用拖拽开始时缓存的容器视口信息：render 里逐 item 读 getBoundingClientRect
      // 会在内容复杂时造成强制同步布局抖动，是低性能设备拖拽卡顿/闪烁的主要来源
      let vp = dragViewportRef.current;
      if (!vp) {
        refreshDragViewport();
        vp = dragViewportRef.current;
      }
      if (!vp) return undefined;

      // 内容坐标 → 屏幕坐标：x 相对容器左边，y 额外减去已滚动的 scrollTop
      const cx = vp.left + state.currentCenter.x;
      const cy = vp.top + state.currentCenter.y - scrollTop;
      return {
        ...state.startGeo,
        cx,
        cy,
        left: cx - state.startGeo.width / 2,
        top: cy - state.startGeo.height / 2,
      };
    };

    return (
      <div
        ref={wrapperRef}
        className="pr-adaptive-grid-wrapper"
        onPointerMove={onWrapperPointerMove}
      >
        <div ref={scrollRef} className="pr-adaptive-grid" onScroll={onScroll}>
          <div className="pr-adaptive-grid-content" style={containerStyle} />
          {visibleIndicesWithDrag.map((idx) => {
            const id = spanIds[idx];
            if (id === undefined) return null;
            const opts = getItemOptions(id);
            return (
              <PrAdaptiveGridItem
                key={id}
                id={id}
                geo={itemGeos[idx] ?? DEFAULT_GEO}
                // 显式传滚动容器：fixed item 的 offsetParent 在 contain/transform 祖先下
                // 不可靠（PC 端 #app-frame { contain: layout }），坐标换算必须以滚动容器为准
                scrollEl={scrollRef.current}
                stickyGeo={stickyGeoFor(id, idx)}
                dragGeo={dragGeoFor(id)}
                sticky={opts.sticky}
                fixed={opts.fixed}
                draggable={!opts.fixed}
                dragging={dragState?.id === id}
                leaving={leavingIds.includes(id)}
                noEnterAnimation={
                  skipEnterBatch || !recentlyAddedRef.current.has(id)
                }
                onDragStart={onItemDragStart}
                onDragMove={onItemDragMove}
                onDragEnd={onItemDragEnd}
                onLeaveEnd={onItemLeaveEnd}
                settlingCount={settlingCount}
                onSettlingChange={onItemSettlingChange}
              >
                {(item) => children(item)}
              </PrAdaptiveGridItem>
            );
          })}
        </div>
        {/* iOS 风格虚拟滚动条（在 overflow 容器外，避免被裁剪） */}
        <div
          className={`pr-adaptive-grid-scrollbar-track${scrollbarVisible ? ' is-visible' : ''}`}
          onPointerEnter={onScrollbarEnter}
          onPointerLeave={onScrollbarLeave}
          onPointerDown={onScrollbarPointerDown}
        >
          <div
            className="pr-adaptive-grid-scrollbar-thumb"
            style={scrollbarThumbStyle}
          />
        </div>
      </div>
    );
  },
);

export default PrAdaptiveGrid;
