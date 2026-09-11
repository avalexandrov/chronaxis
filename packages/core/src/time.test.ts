import { describe, expect, it } from 'vitest';
import { normalizeItem, normalizeItems, normalizeRange, normalizeTime } from './time.js';

describe('time normalization', () => {
  it('accepts timestamps, Dates, and parseable strings', () => {
    const expected = Date.UTC(2026, 0, 2);
    expect(normalizeTime(expected)).toBe(expected);
    expect(normalizeTime(new Date(expected))).toBe(expected);
    expect(normalizeTime('2026-01-02T00:00:00Z')).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 'not-a-date', new Date(Number.NaN)])(
    'rejects invalid input %s',
    (input) => expect(() => normalizeTime(input)).toThrow(TypeError),
  );

  it('requires a positive range duration', () => {
    expect(() => normalizeRange({ start: 10, end: 10 })).toThrow(RangeError);
    expect(() => normalizeRange({ start: 11, end: 10 })).toThrow(RangeError);
  });

  it('normalizes point and ranged items without mutating the source', () => {
    const source = [
      { id: 'point', rowId: 'a', start: '2026-01-01T00:00:00Z' },
      { id: 'span', rowId: 'a', start: 10, end: 20, data: { owner: 'Alex' } },
    ];
    const normalized = normalizeItems(source);
    expect(normalized[0]?.end).toBe(normalized[0]?.start);
    expect(normalized[1]).toMatchObject({ start: 10, end: 20, data: { owner: 'Alex' } });
    expect(source[0]).not.toHaveProperty('end');
  });

  it('rejects items with reversed dates', () => {
    expect(() => normalizeItem({ id: 'bad', rowId: 'a', start: 20, end: 10 })).toThrow(RangeError);
  });
});
