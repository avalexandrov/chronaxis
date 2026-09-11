import { describe, expect, it } from 'vitest';
import { alignTimeInRange, fitRange, panRange, zoomRange } from './viewport.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const limits = { minDuration: 5 * MINUTE, maxDuration: 50 * 365.25 * DAY };

describe('zoomRange', () => {
  const range = { start: 1_000, end: 2_000 };
  const broadLimits = { minDuration: 1, maxDuration: 10_000 };

  it.each([
    { ratio: 0, anchor: 1_000 },
    { ratio: 0.5, anchor: 1_500 },
    { ratio: 1, anchor: 2_000 },
    { ratio: 0.27, anchor: 1_270 },
  ])('keeps the $ratio anchor stable', ({ ratio, anchor }) => {
    const zoomed = zoomRange(range, 0.4, ratio, broadLimits);
    expect(zoomed.start + (zoomed.end - zoomed.start) * ratio).toBeCloseTo(anchor, 12);
  });

  it('reduces and increases duration for zoom in and out', () => {
    expect(zoomRange(range, 1 / 1.5, 0.5, broadLimits).end - zoomRange(range, 1 / 1.5, 0.5, broadLimits).start)
      .toBeCloseTo(1_000 / 1.5);
    expect(zoomRange(range, 1.5, 0.5, broadLimits).end - zoomRange(range, 1.5, 0.5, broadLimits).start)
      .toBe(1_500);
  });

  it('clamps to minimum and maximum interactive durations', () => {
    const atMinimum = zoomRange({ start: 0, end: 10 * MINUTE }, 0.01, 0.5, limits);
    expect(atMinimum.end - atMinimum.start).toBe(5 * MINUTE);
    const atMaximum = zoomRange({ start: 0, end: 40 * 365.25 * DAY }, 10, 0.5, limits);
    expect(atMaximum.end - atMaximum.start).toBe(limits.maxDuration);
  });

  it('only permits ranges outside limits to move back toward the supported bounds', () => {
    const tooSmall = { start: 0, end: MINUTE };
    expect(zoomRange(tooSmall, 0.5, 0.5, limits)).toEqual(tooSmall);
    expect(zoomRange(tooSmall, 1.5, 0.5, limits).end - zoomRange(tooSmall, 1.5, 0.5, limits).start)
      .toBe(limits.minDuration);

    const tooLarge = { start: 0, end: 100 * 365.25 * DAY };
    expect(zoomRange(tooLarge, 1.5, 0.5, limits)).toEqual(tooLarge);
    expect(zoomRange(tooLarge, 1 / 1.5, 0.5, limits).end - zoomRange(tooLarge, 1 / 1.5, 0.5, limits).start)
      .toBe(limits.maxDuration);
  });

  it('does not accumulate anchor drift across repeated zooms', () => {
    const ratio = 0.314159;
    const anchor = range.start + (range.end - range.start) * ratio;
    let current = range;
    for (let index = 0; index < 20; index += 1) current = zoomRange(current, 0.9, ratio, broadLimits);
    expect(current.start + (current.end - current.start) * ratio).toBeCloseTo(anchor, 9);
  });
});

describe('panRange', () => {
  const range = { start: 100, end: 300 };

  it('dragging content right reveals earlier time', () => {
    expect(panRange(range, 0.25)).toEqual({ start: 50, end: 250 });
  });

  it('dragging content left reveals later time', () => {
    expect(panRange(range, -0.25)).toEqual({ start: 150, end: 350 });
  });

  it('preserves duration and treats zero displacement as identity', () => {
    const panned = panRange(range, 2.5);
    expect(panned.end - panned.start).toBe(200);
    expect(panRange(range, 0)).toEqual(range);
  });
});

describe('alignTimeInRange', () => {
  const range = { start: 100, end: 300 };

  it.each([
    { alignment: 'start' as const, expected: { start: 1_000, end: 1_200 } },
    { alignment: 'center' as const, expected: { start: 900, end: 1_100 } },
    { alignment: 'end' as const, expected: { start: 800, end: 1_000 } },
  ])('supports $alignment alignment while preserving duration', ({ alignment, expected }) => {
    expect(alignTimeInRange(range, 1_000, alignment)).toEqual(expected);
  });
});

describe('fitRange', () => {
  const options = { minimumDuration: 5 * MINUTE, paddingRatio: 0.05 };

  it('fits multiple items and adds padding around large gaps', () => {
    expect(fitRange([
      { id: 'a', rowId: 'row', start: 100, end: 200 },
      { id: 'b', rowId: 'row', start: 900, end: 1_100 },
    ], options)).toEqual({ start: 50, end: 1_150 });
  });

  it('uses the minimum duration around one or many coincident point items', () => {
    const result = fitRange([
      { id: 'a', rowId: 'row', start: 1_000, end: 1_000 },
      { id: 'b', rowId: 'row', start: 1_000, end: 1_000 },
    ], options)!;
    expect(result.end - result.start).toBe(5 * MINUTE);
    expect((result.start + result.end) / 2).toBe(1_000);
  });

  it('returns null for an empty collection', () => {
    expect(fitRange([], options)).toBeNull();
  });
});
