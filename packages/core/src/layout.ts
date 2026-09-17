import { generateTickTimes, formatTick, selectTickInterval } from './ruler.js';
import { assignItemLanes } from './lanes.js';
import { timeToX } from './scale.js';
import type { LayoutOptions, NormalizedTimelineItem, TimelineRow, TimelineScene, TimeRange } from './types.js';

/** Complete input to the pure layout engine. Items must already be normalized. */
export interface TimelineLayoutInput<T = unknown> {
  range: TimeRange;
  rows: readonly TimelineRow[];
  items: readonly NormalizedTimelineItem<T>[];
  options: LayoutOptions;
}

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive.`);
  return value;
}

function nonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative.`);
  return value;
}

interface RowLayout {
  readonly source: TimelineRow;
  readonly baseHeight: number;
  laneCount: number;
}

interface SceneRowLayout {
  readonly row: TimelineScene['rows'][number];
  readonly stackPadding: number;
}

interface IndexedItem<T> {
  readonly item: NormalizedTimelineItem<T>;
  readonly index: number;
}

/** Produces a DOM-independent scene and culls items outside the horizontal viewport. */
export function layoutTimeline<T>(input: TimelineLayoutInput<T>): TimelineScene {
  const range = input.range;
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    throw new TypeError('Timeline range times must be finite numbers.');
  }
  if (range.end <= range.start) throw new RangeError('Timeline range end must be after its start.');
  const width = positive(input.options.width, 'Timeline width');
  const rulerHeight = positive(input.options.rulerHeight ?? 42, 'Ruler height');
  const rowLabelWidth = Math.min(positive(input.options.rowLabelWidth ?? 140, 'Row label width'), width - 1);
  const plotWidth = positive(width - rowLabelWidth, 'Timeline plot width');
  const defaultRowHeight = positive(input.options.defaultRowHeight ?? 56, 'Default row height');
  const itemHeight = positive(input.options.itemHeight ?? 26, 'Item height');
  const minimumItemWidth = positive(input.options.minimumItemWidth ?? 3, 'Minimum item width');
  const overlapMode = input.options.overlap?.mode ?? 'overlay';
  if (overlapMode !== 'overlay' && overlapMode !== 'stack') {
    throw new RangeError('Overlap mode must be "overlay" or "stack".');
  }
  const laneGap = nonNegative(input.options.overlap?.laneGap ?? 4, 'Overlap lane gap');
  const rowIds = new Set<string>();
  const rowLayouts: RowLayout[] = input.rows.map((row) => {
    if (rowIds.has(row.id)) throw new Error(`Duplicate row ID: ${row.id}`);
    rowIds.add(row.id);
    return {
      source: row,
      baseHeight: positive(row.height ?? defaultRowHeight, `Height for row "${row.id}"`),
      laneCount: 0,
    };
  });
  const rowLayoutsById = new Map(rowLayouts.map((row) => [row.source.id, row]));
  const itemsByRowId = new Map<string, IndexedItem<T>[]>();
  for (const [index, item] of input.items.entries()) {
    if (!rowLayoutsById.has(item.rowId)) {
      throw new Error(`Timeline item "${item.id}" references unknown row "${item.rowId}".`);
    }
    const items = itemsByRowId.get(item.rowId);
    if (items) items.push({ item, index });
    else itemsByRowId.set(item.rowId, [{ item, index }]);
  }

  const lanesByItemIndex = new Array<number>(input.items.length).fill(0);
  if (overlapMode === 'stack') {
    for (const rowLayout of rowLayouts) {
      const rowItems = itemsByRowId.get(rowLayout.source.id) ?? [];
      const assignment = assignItemLanes(rowItems.map(({ item }) => item));
      rowLayout.laneCount = assignment.laneCount;
      for (const [index, rowItem] of rowItems.entries()) {
        lanesByItemIndex[rowItem.index] = assignment.lanes[index] ?? 0;
      }
    }
  }

  let y = 0;
  const sceneRowLayouts: SceneRowLayout[] = rowLayouts.map((rowLayout) => {
    const stackPadding = Math.max(0, (rowLayout.baseHeight - itemHeight) / 2);
    const height = overlapMode === 'stack' && rowLayout.laneCount > 0
      ? Math.max(
        rowLayout.baseHeight,
        2 * stackPadding + rowLayout.laneCount * itemHeight + (rowLayout.laneCount - 1) * laneGap,
      )
      : rowLayout.baseHeight;
    const row = { id: rowLayout.source.id, label: rowLayout.source.label, x: 0, y, width: plotWidth, height };
    y += height;
    return { row, stackPadding };
  });
  const rows = sceneRowLayouts.map(({ row }) => row);
  const rowsById = new Map(sceneRowLayouts.map((rowLayout) => [rowLayout.row.id, rowLayout]));
  const scale = { range, width: plotWidth };
  const items = input.items.flatMap((item, index) => {
    const rowLayout = rowsById.get(item.rowId);
    if (!rowLayout) throw new Error(`Timeline item "${item.id}" references unknown row "${item.rowId}".`);
    const row = rowLayout.row;
    if (item.end < range.start || item.start > range.end) return [];
    const visibleStart = Math.max(item.start, range.start);
    const visibleEnd = Math.min(item.end, range.end);
    const startX = timeToX(visibleStart, scale);
    const endX = timeToX(visibleEnd, scale);
    const renderedWidth = Math.max(minimumItemWidth, endX - startX);
    const renderedX = Math.min(startX, plotWidth - renderedWidth);
    const renderedHeight = overlapMode === 'stack' ? itemHeight : Math.min(itemHeight, row.height);
    const lane = overlapMode === 'stack' ? lanesByItemIndex[index] ?? 0 : 0;
    const itemY = overlapMode === 'stack'
      ? row.y + rowLayout.stackPadding + lane * (renderedHeight + laneGap)
      : row.y + (row.height - renderedHeight) / 2;
    return [{
      id: item.id,
      rowId: item.rowId,
      label: item.label,
      x: Math.max(0, renderedX),
      y: itemY,
      width: Math.min(plotWidth, renderedWidth),
      height: renderedHeight,
      clippedStart: item.start < range.start,
      clippedEnd: item.end > range.end,
    }];
  });
  const interval = selectTickInterval(range.end - range.start, plotWidth);
  const ticks = generateTickTimes(range, interval).map((time) => ({
    time,
    unit: interval.unit,
    step: interval.step,
    label: formatTick(time, interval),
    x: timeToX(time, scale),
  }));
  const plotHeight = y;
  const height = rulerHeight + plotHeight;
  return {
    width,
    height,
    rulerHeight,
    rowLabelWidth,
    plotX: rowLabelWidth,
    plotWidth,
    plotHeight,
    rows,
    items,
    ticks,
    gridLines: ticks.map(({ time, x }) => ({ time, x, y1: 0, y2: plotHeight })),
  };
}
