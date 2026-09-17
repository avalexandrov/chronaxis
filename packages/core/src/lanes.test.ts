import { describe, expect, it } from 'vitest';
import { assignItemLanes, type LaneItem } from './lanes.js';

function item(start: number, end: number): LaneItem {
  return { start, end };
}

describe('item lane assignment', () => {
  it('assigns lane zero to non-overlapping items regardless of input order', () => {
    const items = [item(20, 30), item(0, 10), item(10, 20)];

    expect(assignItemLanes(items)).toEqual({ lanes: [0, 0, 0], laneCount: 1 });
  });

  it('separates partially overlapping items', () => {
    expect(assignItemLanes([item(0, 10), item(5, 15)])).toEqual({
      lanes: [0, 1],
      laneCount: 2,
    });
  });

  it('reuses a lane across a chain of endpoint-touching intervals', () => {
    expect(assignItemLanes([item(0, 10), item(5, 15), item(10, 20)])).toEqual({
      lanes: [0, 1, 0],
      laneCount: 2,
    });
  });

  it('handles complete containment with the minimum number of lanes', () => {
    expect(assignItemLanes([item(0, 10), item(2, 3), item(3, 8)])).toEqual({
      lanes: [0, 1, 1],
      laneCount: 2,
    });
  });

  it('places identical ranges in deterministic separate lanes', () => {
    expect(assignItemLanes([item(0, 10), item(0, 10), item(0, 10)])).toEqual({
      lanes: [0, 1, 2],
      laneCount: 3,
    });
  });

  it('uses start, end, then original input order as deterministic tie breakers', () => {
    const items = [item(0, 10), item(0, 5), item(0, 5)];

    expect(assignItemLanes(items)).toEqual({ lanes: [2, 0, 1], laneCount: 3 });
  });

  it('reuses the lowest available lane after multiple items end together', () => {
    const items = [item(0, 10), item(0, 10), item(10, 20), item(10, 20)];

    expect(assignItemLanes(items)).toEqual({ lanes: [0, 1, 0, 1], laneCount: 2 });
  });

  it('separates every item that starts simultaneously', () => {
    expect(assignItemLanes([item(0, 10), item(0, 5), item(0, 3)])).toEqual({
      lanes: [2, 1, 0],
      laneCount: 3,
    });
  });

  it('gives coincident points separate lanes and collides a point with a containing range', () => {
    expect(assignItemLanes([item(5, 5), item(5, 5), item(0, 10)])).toEqual({
      lanes: [1, 2, 0],
      laneCount: 3,
    });
  });

  it('allows a point to reuse a lane at a range end but not at its start', () => {
    expect(assignItemLanes([item(0, 5), item(5, 5), item(5, 10)])).toEqual({
      lanes: [0, 0, 1],
      laneCount: 2,
    });
  });

  it('does not mutate inputs and returns the same result for repeated full-row assignment', () => {
    const items = [item(20, 30), item(0, 15), item(10, 25)];
    const snapshot = structuredClone(items);

    expect(assignItemLanes(items)).toEqual({ lanes: [0, 0, 1], laneCount: 2 });
    expect(assignItemLanes(items)).toEqual({ lanes: [0, 0, 1], laneCount: 2 });
    expect(items).toEqual(snapshot);
  });

  it('rejects malformed temporal intervals', () => {
    expect(() => assignItemLanes([item(5, 4)])).toThrow(/ends before it starts/);
    expect(() => assignItemLanes([{ start: Number.NaN, end: 1 }])).toThrow(/finite start and end/);
  });
});
