import type {
  NormalizedTimelineItem,
  TimeRange,
  TimeInput,
  TimelineItem,
  TimeRangeInput,
} from './types.js';

export function normalizeTime(input: TimeInput): number {
  const value = input instanceof Date ? input.getTime() :
    typeof input === 'string' ? Date.parse(input) : input;

  if (!Number.isFinite(value)) {
    throw new TypeError(`Invalid time input: ${String(input)}`);
  }

  return value;
}

export function normalizeRange(range: TimeRangeInput): TimeRange {
  const start = normalizeTime(range.start);
  const end = normalizeTime(range.end);
  if (end <= start) {
    throw new RangeError('Timeline range end must be after its start.');
  }
  return { start, end };
}

export function normalizeItem<T>(item: TimelineItem<T>): NormalizedTimelineItem<T> {
  const start = normalizeTime(item.start);
  const end = item.end === undefined ? start : normalizeTime(item.end);
  if (end < start) {
    throw new RangeError(`Timeline item "${item.id}" ends before it starts.`);
  }
  return { ...item, start, end };
}

export function normalizeItems<T>(items: readonly TimelineItem<T>[]): NormalizedTimelineItem<T>[] {
  return items.map(normalizeItem);
}
