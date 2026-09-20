import type {
  CreateLayoutConfig,
  Layout,
  LayoutFactory,
  LayoutPreset,
  SurplusRule,
} from './types';

/**
 * 主区行数上限，与组件内部的 VIRTUAL_TARGET_ROWS 保持一致。
 * 超过这个值主区就不再是「一屏」，会破坏「首屏 = 主区」这个前提。
 */
const MAX_MAIN_ROWS = 12;

/** 配置错误统一抛错，绝不静默降级。用函数声明以便 TS 识别 never 完成类型收窄。 */
function fail(message: string): never {
  throw new Error(`[pr-adaptive-grid] createLayout: ${message}`);
}

/** 校验单个主区模板：数量对齐、越界、重叠 */
const validatePreset = (count: number, preset: LayoutPreset) => {
  const { cols, rows, items } = preset;

  if (!Number.isInteger(cols) || cols < 1)
    fail(`presets[${count}].cols 必须是正整数，收到 ${cols}`);
  if (!Number.isInteger(rows) || rows < 1)
    fail(`presets[${count}].rows 必须是正整数，收到 ${rows}`);
  if (rows > MAX_MAIN_ROWS)
    fail(
      `presets[${count}].rows = ${rows}，超过上限 ${MAX_MAIN_ROWS}（主区会超出首屏）`,
    );
  if (items.length !== count)
    fail(`presets[${count}] 的 items 数量为 ${items.length}，必须等于 ${count}`);

  items.forEach((cell, i) => {
    const { x, y, w, h } = cell;
    if (![x, y, w, h].every((v) => Number.isInteger(v) && v >= 1)) {
      fail(`presets[${count}].items[${i}] 的 x / y / w / h 必须是 >= 1 的整数`);
    }
    if (x + w - 1 > cols)
      fail(
        `presets[${count}].items[${i}] 横向越界：x=${x} w=${w} 超出 cols=${cols}`,
      );
    if (y + h - 1 > rows)
      fail(
        `presets[${count}].items[${i}] 纵向越界：y=${y} h=${h} 超出 rows=${rows}`,
      );
  });

  // 重叠检测：逐格打标记，同一格被写两次即冲突
  const occupied = new Uint8Array(cols * rows);
  items.forEach((cell, i) => {
    for (let y = cell.y; y < cell.y + cell.h; y++) {
      for (let x = cell.x; x < cell.x + cell.w; x++) {
        const slot = (y - 1) * cols + (x - 1);
        if (occupied[slot])
          fail(`presets[${count}].items[${i}] 与其它 item 重叠于 (x=${x}, y=${y})`);
        occupied[slot] = 1;
      }
    }
  });
};

/** 校验溢出规则自身的数值合理性 */
const validateSurplus = (rule: SurplusRule, index: number) => {
  const label = `surplus[${index}]`;
  if (!Number.isInteger(rule.divisibleBy) || rule.divisibleBy < 1)
    fail(`${label}.divisibleBy 必须是 >= 1 的整数`);
  if (!Number.isInteger(rule.startRow) || rule.startRow < 1)
    fail(`${label}.startRow 必须是 >= 1 的整数`);
  if (!Number.isInteger(rule.startCol) || rule.startCol < 1)
    fail(`${label}.startCol 必须是 >= 1 的整数`);
  if (!Number.isInteger(rule.span) || rule.span < 1)
    fail(`${label}.span 必须是 >= 1 的整数`);
  if (rule.step !== undefined && (!Number.isInteger(rule.step) || rule.step < 1))
    fail(`${label}.step 必须是 >= 1 的整数`);
  if (!Number.isInteger(rule.wrapAtCol) || rule.wrapAtCol <= rule.startCol)
    fail(`${label}.wrapAtCol 必须大于 startCol`);
  if (
    rule.lastItemSpan !== undefined &&
    (!Number.isInteger(rule.lastItemSpan) || rule.lastItemSpan < 1)
  )
    fail(`${label}.lastItemSpan 必须是 >= 1 的整数`);
};

/**
 * 按规则把剩余项铺到主区下方。
 * 列游标从 startCol 起，每铺一项前进 step；到达 wrapAtCol 时回到 startCol 并换行。
 */
const fillSurplus = (layout: Layout, rule: SurplusRule, count: number) => {
  const step = rule.step ?? rule.span;
  let x = rule.startCol;
  let y = rule.startRow;
  let rest = count;

  while (rest > 0) {
    if (x === rule.wrapAtCol) {
      x = rule.startCol;
      y += 1;
    }

    // 只剩最后一项且恰好位于起始列时，允许改用特殊宽度
    let span = rule.span;
    if (rest === 1 && x === rule.startCol && rule.lastItemSpan !== undefined) {
      span = rule.lastItemSpan;
    }

    layout.items.push({ x, y, w: span, h: 1 });
    rest -= 1;
    x += step;
  }
};

/**
 * 创建一个布局工厂。
 *
 * 生成流程与手写布局完全一致：
 * 1. 主区数量 = min(length, designCols × designRows)
 * 2. 缩减主区数量，直到剩余项能被 alignDivisor 整除
 * 3. 命中 presets[主区数量] 的模板（未命中直接抛错）
 * 4. 剩余项按 surplus 规则铺到主区下方
 */
export const createLayout = (config: CreateLayoutConfig): LayoutFactory => {
  const { gap, designCols, designRows, alignDivisor, presets, surplus } = config;

  // ── 构建期校验：一次算清，运行时零开销 ──
  if (!Number.isInteger(gap) || gap < 0)
    fail(`gap 必须是 >= 0 的整数，收到 ${gap}`);
  if (!Number.isInteger(designCols) || designCols < 1)
    fail(`designCols 必须是 >= 1 的整数，收到 ${designCols}`);
  if (!Number.isInteger(designRows) || designRows < 1)
    fail(`designRows 必须是 >= 1 的整数，收到 ${designRows}`);
  if (!Number.isInteger(alignDivisor) || alignDivisor < 1)
    fail(`alignDivisor 必须是 >= 1 的整数，收到 ${alignDivisor}`);

  const counts = Object.keys(presets).map(Number);
  if (counts.length === 0) fail('presets 不能为空');
  counts.forEach((count) => validatePreset(count, presets[count]));
  surplus?.forEach((rule, index) => validateSurplus(rule, index));

  return (length: number): Layout => {
    if (!Number.isFinite(length) || length < 0)
      fail(`length 必须是非负整数，收到 ${length}`);

    // 空列表：不进入任何模板匹配，直接给个空盘
    if (length === 0) return { gap, cols: 1, rows: 1, items: [] };

    const capacity = designCols * designRows;
    let itemsNum = Math.min(length, capacity);
    let surplusItemsNum = Math.max(0, length - itemsNum);

    // 缩减主区格数，直到余数能被 alignDivisor 整除
    while (surplusItemsNum % alignDivisor !== 0) {
      itemsNum -= 1;
      surplusItemsNum += 1;
      if (itemsNum < 1)
        fail(
          `无法把 ${length} 个 item 对齐到 alignDivisor=${alignDivisor}，请检查配置`,
        );
    }

    const preset = presets[itemsNum];
    if (!preset)
      fail(
        `presets 里没有 ${itemsNum} 的模板（length=${length}），请补上该数量或调整 designCols / designRows`,
      );

    // items 复制一份，避免外部修改污染模板
    const layout: Layout = {
      gap,
      cols: preset.cols,
      rows: preset.rows,
      items: preset.items.map((cell) => ({
        x: cell.x,
        y: cell.y,
        w: cell.w,
        h: cell.h,
      })),
    };

    if (surplusItemsNum > 0) {
      const rule = surplus?.find(
        (item) => surplusItemsNum % item.divisibleBy === 0,
      );
      if (!rule)
        fail(`没有匹配剩余数 ${surplusItemsNum} 的 surplus 规则（length=${length}）`);
      fillSurplus(layout, rule, surplusItemsNum);
    }

    return layout;
  };
};
