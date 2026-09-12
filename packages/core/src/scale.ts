import type { TimeScale } from './types.js';

function assertScale(scale: TimeScale): void {
  if (!Number.isFinite(scale.range.start) || !Number.isFinite(scale.range.end)) {
    throw new TypeError('Scale range times must be finite numbers.');
  }
  if (scale.range.end <= scale.range.start) {
    throw new RangeError('Scale range end must be after its start.');
  }
  if (!Number.isFinite(scale.width) || scale.width <= 0) {
    throw new RangeError('Scale width must be a positive finite number.');
  }
}

/** Projects a timestamp into plot-local pixels. */
export function timeToX(time: number, scale: TimeScale): number {
  assertScale(scale);
  if (!Number.isFinite(time)) throw new TypeError('Time must be a finite number.');
  return ((time - scale.range.start) / (scale.range.end - scale.range.start)) * scale.width;
}

/** Converts plot-local pixels back to a timestamp. */
export function xToTime(x: number, scale: TimeScale): number {
  assertScale(scale);
  if (!Number.isFinite(x)) throw new TypeError('X must be a finite number.');
  return scale.range.start + (x / scale.width) * (scale.range.end - scale.range.start);
}
