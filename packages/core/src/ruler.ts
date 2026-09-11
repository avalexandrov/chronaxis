import type { TickInterval, TickUnit, TimeRange } from './types.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK_ANCHOR = Date.UTC(1970, 0, 5);

const INTERVALS: readonly TickInterval[] = [
  { unit: 'minute', step: 1, approximateMs: MINUTE },
  { unit: 'minute', step: 5, approximateMs: 5 * MINUTE },
  { unit: 'minute', step: 15, approximateMs: 15 * MINUTE },
  { unit: 'minute', step: 30, approximateMs: 30 * MINUTE },
  { unit: 'hour', step: 1, approximateMs: HOUR },
  { unit: 'hour', step: 3, approximateMs: 3 * HOUR },
  { unit: 'hour', step: 6, approximateMs: 6 * HOUR },
  { unit: 'hour', step: 12, approximateMs: 12 * HOUR },
  { unit: 'day', step: 1, approximateMs: DAY },
  { unit: 'day', step: 2, approximateMs: 2 * DAY },
  { unit: 'week', step: 1, approximateMs: 7 * DAY },
  { unit: 'week', step: 2, approximateMs: 14 * DAY },
  { unit: 'month', step: 1, approximateMs: 30.4375 * DAY },
  { unit: 'quarter', step: 1, approximateMs: 91.3125 * DAY },
  { unit: 'year', step: 1, approximateMs: 365.25 * DAY },
  { unit: 'year', step: 2, approximateMs: 2 * 365.25 * DAY },
  { unit: 'year', step: 5, approximateMs: 5 * 365.25 * DAY },
];

export function selectTickInterval(duration: number, width: number, targetSpacing = 100): TickInterval {
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Duration must be positive.');
  if (!Number.isFinite(width) || width <= 0) throw new RangeError('Width must be positive.');
  const desired = duration * targetSpacing / width;
  return INTERVALS.reduce((best, candidate) =>
    Math.abs(Math.log(candidate.approximateMs / desired)) < Math.abs(Math.log(best.approximateMs / desired))
      ? candidate : best,
  );
}

function floorToInterval(time: number, interval: TickInterval): Date {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  if (interval.unit === 'year') return new Date(Date.UTC(year - (year % interval.step), 0, 1));
  if (interval.unit === 'quarter') return new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
  if (interval.unit === 'month') return new Date(Date.UTC(year, month - (month % interval.step), 1));
  const unitMs = interval.unit === 'week' ? 7 * DAY
    : interval.unit === 'day' ? DAY
      : interval.unit === 'hour' ? HOUR
        : MINUTE;
  const anchor = interval.unit === 'week' ? WEEK_ANCHOR : 0;
  const duration = unitMs * interval.step;
  return new Date(anchor + Math.floor((time - anchor) / duration) * duration);
}

function addInterval(date: Date, unit: TickUnit, step: number): Date {
  const next = new Date(date);
  if (unit === 'year') next.setUTCFullYear(next.getUTCFullYear() + step);
  else if (unit === 'quarter') next.setUTCMonth(next.getUTCMonth() + 3 * step);
  else if (unit === 'month') next.setUTCMonth(next.getUTCMonth() + step);
  else if (unit === 'week') next.setUTCDate(next.getUTCDate() + 7 * step);
  else if (unit === 'day') next.setUTCDate(next.getUTCDate() + step);
  else if (unit === 'hour') next.setUTCHours(next.getUTCHours() + step);
  else next.setUTCMinutes(next.getUTCMinutes() + step);
  return next;
}

export function generateTickTimes(range: TimeRange, interval: TickInterval): number[] {
  if (range.end <= range.start) throw new RangeError('Range end must be after its start.');
  let cursor = floorToInterval(range.start, interval);
  while (cursor.getTime() < range.start) cursor = addInterval(cursor, interval.unit, interval.step);
  const ticks: number[] = [];
  while (cursor.getTime() <= range.end) {
    ticks.push(cursor.getTime());
    cursor = addInterval(cursor, interval.unit, interval.step);
  }
  return ticks;
}

export function formatTick(time: number, interval: TickInterval): string {
  const options: Intl.DateTimeFormatOptions = interval.unit === 'minute' || interval.unit === 'hour'
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }
    : interval.unit === 'day' || interval.unit === 'week'
      ? { month: 'short', day: 'numeric', timeZone: 'UTC' }
      : interval.unit === 'year'
        ? { year: 'numeric', timeZone: 'UTC' }
        : { month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat('en-US', options).format(time);
}
