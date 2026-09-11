import { describe, expect, it } from 'vitest';
import { generateTickTimes, selectTickInterval } from './ruler.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('ruler intervals', () => {
  it('selects intervals from visible duration and width', () => {
    expect(selectTickInterval(10 * 60_000, 1_000)).toMatchObject({ unit: 'minute', step: 1 });
    expect(selectTickInterval(2 * HOUR, 800)).toMatchObject({ unit: 'minute', step: 15 });
    expect(selectTickInterval(10 * HOUR, 1_000)).toMatchObject({ unit: 'hour', step: 1 });
    expect(selectTickInterval(10 * DAY, 1_000)).toMatchObject({ unit: 'day', step: 1 });
    expect(selectTickInterval(365.25 * DAY, 1_200)).toMatchObject({ unit: 'month', step: 1 });
    expect(selectTickInterval(4 * 365.25 * DAY, 400).unit).toBe('year');
  });

  it('aligns daily ticks and includes ticks on range boundaries', () => {
    const start = Date.UTC(2026, 0, 1, 13);
    const end = Date.UTC(2026, 0, 4);
    expect(generateTickTimes({ start, end }, { unit: 'day', step: 1, approximateMs: DAY })).toEqual([
      Date.UTC(2026, 0, 2),
      Date.UTC(2026, 0, 3),
      Date.UTC(2026, 0, 4),
    ]);
  });

  it('advances calendar months rather than fixed 30-day periods', () => {
    const ticks = generateTickTimes(
      { start: Date.UTC(2026, 0, 15), end: Date.UTC(2026, 3, 1) },
      { unit: 'month', step: 1, approximateMs: 30.4375 * DAY },
    );
    expect(ticks).toEqual([Date.UTC(2026, 1, 1), Date.UTC(2026, 2, 1), Date.UTC(2026, 3, 1)]);
  });

  it('keeps multi-day tick phases stable while the range pans across a month boundary', () => {
    const interval = { unit: 'day' as const, step: 2, approximateMs: 2 * DAY };
    const first = generateTickTimes({ start: Date.UTC(2026, 0, 30, 12), end: Date.UTC(2026, 1, 5) }, interval);
    const shifted = generateTickTimes({ start: Date.UTC(2026, 0, 31, 12), end: Date.UTC(2026, 1, 6) }, interval);
    expect(first.filter((tick) => shifted.includes(tick))).toEqual(
      first.filter((tick) => tick >= shifted[0]! && tick <= shifted.at(-1)!),
    );
    expect([...first, ...shifted].every((tick) => tick % (2 * DAY) === 0)).toBe(true);
  });

  it('keeps multi-week ticks aligned to a stable Monday anchor while panning', () => {
    const interval = { unit: 'week' as const, step: 2, approximateMs: 14 * DAY };
    const anchor = Date.UTC(1970, 0, 5);
    const first = generateTickTimes({ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 2, 1) }, interval);
    const shifted = generateTickTimes({ start: Date.UTC(2026, 0, 8), end: Date.UTC(2026, 2, 8) }, interval);
    expect([...first, ...shifted].every((tick) => (tick - anchor) % (14 * DAY) === 0)).toBe(true);
    expect(first.filter((tick) => shifted.includes(tick)).length).toBeGreaterThan(0);
  });

  it('rejects invalid selection dimensions', () => {
    expect(() => selectTickInterval(0, 100)).toThrow(RangeError);
    expect(() => selectTickInterval(DAY, 0)).toThrow(RangeError);
  });
});
