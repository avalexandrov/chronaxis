import type { NormalizedTimelineItem, TimeRange, Timestamp } from './types.js';

export type RangeAlignment = 'start' | 'center' | 'end';

export interface ZoomLimits {
  minDuration: number;
  maxDuration: number;
}

export interface FitRangeOptions {
  paddingRatio?: number;
  minimumDuration: number;
}

function assertRange(range: TimeRange): void {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    throw new TypeError('Range times must be finite numbers.');
  }
  if (range.end <= range.start) throw new RangeError('Range end must be after its start.');
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive.`);
}

function constrainedDuration(current: number, requested: number, limits: ZoomLimits): number {
  assertPositive(limits.minDuration, 'Minimum zoom duration');
  assertPositive(limits.maxDuration, 'Maximum zoom duration');
  if (limits.maxDuration < limits.minDuration) {
    throw new RangeError('Maximum zoom duration must not be less than minimum zoom duration.');
  }

  if (current < limits.minDuration) {
    return requested <= current ? current : Math.min(Math.max(requested, limits.minDuration), limits.maxDuration);
  }
  if (current > limits.maxDuration) {
    return requested >= current ? current : Math.max(Math.min(requested, limits.maxDuration), limits.minDuration);
  }
  return Math.min(Math.max(requested, limits.minDuration), limits.maxDuration);
}

/** Zooms by multiplying the current duration while keeping the anchor time fixed. */
export function zoomRange(
  range: TimeRange,
  durationFactor: number,
  anchorRatio: number,
  limits: ZoomLimits,
): TimeRange {
  assertRange(range);
  assertPositive(durationFactor, 'Zoom duration factor');
  if (!Number.isFinite(anchorRatio) || anchorRatio < 0 || anchorRatio > 1) {
    throw new RangeError('Zoom anchor ratio must be between 0 and 1.');
  }

  const duration = range.end - range.start;
  const nextDuration = constrainedDuration(duration, duration * durationFactor, limits);
  const anchorTime = range.start + duration * anchorRatio;
  const start = anchorTime - nextDuration * anchorRatio;
  return { start, end: start + nextDuration };
}

/** Pans by a content displacement ratio: positive displacement reveals earlier time. */
export function panRange(range: TimeRange, contentDeltaRatio: number): TimeRange {
  assertRange(range);
  if (!Number.isFinite(contentDeltaRatio)) throw new TypeError('Pan ratio must be finite.');
  const duration = range.end - range.start;
  const offset = -contentDeltaRatio * duration;
  return { start: range.start + offset, end: range.end + offset };
}

export function alignTimeInRange(
  range: TimeRange,
  time: Timestamp,
  alignment: RangeAlignment = 'center',
): TimeRange {
  assertRange(range);
  if (!Number.isFinite(time)) throw new TypeError('Aligned time must be finite.');
  const duration = range.end - range.start;
  const ratio = alignment === 'start' ? 0 : alignment === 'end' ? 1 : 0.5;
  const start = time - duration * ratio;
  return { start, end: start + duration };
}

export function fitRange<T>(
  items: readonly NormalizedTimelineItem<T>[],
  options: FitRangeOptions,
): TimeRange | null {
  assertPositive(options.minimumDuration, 'Fit minimum duration');
  const paddingRatio = options.paddingRatio ?? 0.05;
  if (!Number.isFinite(paddingRatio) || paddingRatio < 0) {
    throw new RangeError('Fit padding ratio must be a non-negative finite number.');
  }
  if (items.length === 0) return null;

  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end < item.start) {
      throw new RangeError(`Timeline item "${item.id}" has an invalid normalized range.`);
    }
    start = Math.min(start, item.start);
    end = Math.max(end, item.end);
  }

  const itemDuration = end - start;
  if (itemDuration === 0) {
    const half = options.minimumDuration / 2;
    return { start: start - half, end: end + half };
  }
  const padding = itemDuration * paddingRatio;
  return { start: start - padding, end: end + padding };
}
