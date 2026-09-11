import { describe, expect, it } from 'vitest';
import { timeToX, xToTime } from './scale.js';
import type { TimeScale } from './types.js';

const scale: TimeScale = { range: { start: 1_000, end: 3_000 }, width: 500 };

describe('time scale', () => {
  it('maps viewport boundaries exactly', () => {
    expect(timeToX(1_000, scale)).toBe(0);
    expect(timeToX(3_000, scale)).toBe(500);
    expect(xToTime(0, scale)).toBe(1_000);
    expect(xToTime(500, scale)).toBe(3_000);
  });

  it('extrapolates consistently outside the viewport', () => {
    expect(timeToX(0, scale)).toBe(-250);
    expect(timeToX(4_000, scale)).toBe(750);
    expect(xToTime(-250, scale)).toBe(0);
    expect(xToTime(750, scale)).toBe(4_000);
  });

  it('is invertible within floating-point tolerance', () => {
    for (const time of [-10_000, 1_000, 1_234.567, 3_000, 40_000]) {
      expect(xToTime(timeToX(time, scale), scale)).toBeCloseTo(time, 10);
    }
    for (const x of [-300, 0, 13.37, 500, 900]) {
      expect(timeToX(xToTime(x, scale), scale)).toBeCloseTo(x, 10);
    }
  });

  it('rejects invalid range, width, time, and x values', () => {
    expect(() => timeToX(1, { range: { start: 1, end: 1 }, width: 10 })).toThrow(RangeError);
    expect(() => timeToX(1, { range: { start: 0, end: 1 }, width: 0 })).toThrow(RangeError);
    expect(() => timeToX(Number.NaN, scale)).toThrow(TypeError);
    expect(() => xToTime(Number.POSITIVE_INFINITY, scale)).toThrow(TypeError);
  });
});
