import { generateTickTimes, formatTick, selectTickInterval } from './ruler.js';
import { timeToX } from './scale.js';
import type { LayoutOptions, NormalizedTimelineItem, TimelineRow, TimelineScene, TimeRange } from './types.js';

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
  const rowIds = new Set<string>();
  let y = 0;
  const rows = input.rows.map((row) => {
    if (rowIds.has(row.id)) throw new Error(`Duplicate row ID: ${row.id}`);
    rowIds.add(row.id);
    const height = positive(row.height ?? defaultRowHeight, `Height for row "${row.id}"`);
    const sceneRow = { id: row.id, label: row.label, x: 0, y, width: plotWidth, height };
    y += height;
    return sceneRow;
  });
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const scale = { range, width: plotWidth };
  const items = input.items.flatMap((item) => {
    const row = rowsById.get(item.rowId);
    if (!row) throw new Error(`Timeline item "${item.id}" references unknown row "${item.rowId}".`);
    if (item.end < range.start || item.start > range.end) return [];
    const visibleStart = Math.max(item.start, range.start);
    const visibleEnd = Math.min(item.end, range.end);
    const startX = timeToX(visibleStart, scale);
    const endX = timeToX(visibleEnd, scale);
    const renderedWidth = Math.max(minimumItemWidth, endX - startX);
    const renderedX = Math.min(startX, plotWidth - renderedWidth);
    const renderedHeight = Math.min(itemHeight, row.height);
    return [{
      id: item.id,
      rowId: item.rowId,
      label: item.label,
      x: Math.max(0, renderedX),
      y: row.y + (row.height - renderedHeight) / 2,
      width: Math.min(plotWidth, renderedWidth),
      height: renderedHeight,
      clippedStart: item.start < range.start,
      clippedEnd: item.end > range.end,
    }];
  });
  const interval = selectTickInterval(range.end - range.start, plotWidth);
  const ticks = generateTickTimes(range, interval).map((time) => ({
    time,
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
