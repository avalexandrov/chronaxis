import { describe, expect, it } from 'vitest';
import { layoutTimeline } from './layout.js';

function layout(items = [
  { id: 'inside', rowId: 'a', start: 200, end: 400, label: 'Inside' },
]) {
  return layoutTimeline({
    range: { start: 0, end: 1_000 },
    rows: [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta', height: 80 },
    ],
    items,
    options: { width: 500, rowLabelWidth: 100, rulerHeight: 40, defaultRowHeight: 60, itemHeight: 20 },
  });
}

describe('timeline layout', () => {
  it('produces deterministic scene and row dimensions', () => {
    const scene = layout();
    expect(scene).toMatchObject({ width: 500, height: 180, rulerHeight: 40, rowLabelWidth: 100, plotWidth: 400, plotHeight: 140 });
    expect(scene.rows).toEqual([
      { id: 'a', label: 'Alpha', x: 0, y: 0, width: 400, height: 60 },
      { id: 'b', label: 'Beta', x: 0, y: 60, width: 400, height: 80 },
    ]);
    expect(scene.gridLines.every((line) => line.y1 === 0 && line.y2 === 140)).toBe(true);
  });

  it('positions items using plot geometry and their associated row', () => {
    const scene = layout([
      { id: 'a-item', rowId: 'a', start: 200, end: 400 },
      { id: 'b-item', rowId: 'b', start: 500, end: 750 },
    ]);
    expect(scene.items[0]).toMatchObject({ x: 80, y: 20, width: 80, height: 20 });
    expect(scene.items[1]).toMatchObject({ x: 200, y: 90, width: 100, height: 20 });
  });

  it('clips items that cross either or both viewport edges', () => {
    const scene = layout([
      { id: 'left', rowId: 'a', start: -100, end: 250 },
      { id: 'right', rowId: 'a', start: 750, end: 1_200 },
      { id: 'spanning', rowId: 'b', start: -100, end: 1_200 },
    ]);
    expect(scene.items[0]).toMatchObject({ x: 0, width: 100, clippedStart: true, clippedEnd: false });
    expect(scene.items[1]).toMatchObject({ x: 300, width: 100, clippedStart: false, clippedEnd: true });
    expect(scene.items[2]).toMatchObject({ x: 0, width: 400, clippedStart: true, clippedEnd: true });
  });

  it('culls items entirely outside the viewport', () => {
    const scene = layout([
      { id: 'before', rowId: 'a', start: -200, end: -1 },
      { id: 'after', rowId: 'a', start: 1_001, end: 1_200 },
      { id: 'visible', rowId: 'a', start: 10, end: 20 },
    ]);
    expect(scene.items.map((item) => item.id)).toEqual(['visible']);
  });

  it('renders point items with a minimum width', () => {
    expect(layout([{ id: 'point', rowId: 'a', start: 500, end: 500 }]).items[0]?.width).toBe(3);
    expect(layout([{ id: 'edge', rowId: 'a', start: 1_000, end: 1_000 }]).items[0]).toMatchObject({ x: 397, width: 3 });
  });

  it('centers a clamped item within a row shorter than the configured item height', () => {
    const scene = layoutTimeline({
      range: { start: 0, end: 1_000 },
      rows: [{ id: 'short', label: 'Short', height: 12 }],
      items: [{ id: 'item', rowId: 'short', start: 100, end: 200 }],
      options: { width: 500, rowLabelWidth: 100, rulerHeight: 40, itemHeight: 30 },
    });
    expect(scene.items[0]).toMatchObject({ y: 0, height: 12 });
  });

  it('rejects duplicate rows and unknown row references', () => {
    expect(() => layoutTimeline({
      range: { start: 0, end: 1 },
      rows: [{ id: 'a', label: 'A' }, { id: 'a', label: 'Again' }],
      items: [],
      options: { width: 500 },
    })).toThrow(/Duplicate row ID/);
    expect(() => layout([{ id: 'orphan', rowId: 'missing', start: 0, end: 0 }])).toThrow(/unknown row/);
  });
});
