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

  it('preserves overlay geometry when overlap options are omitted or explicitly overlay', () => {
    const items = [
      { id: 'first', rowId: 'a', start: 200, end: 600 },
      { id: 'second', rowId: 'a', start: 400, end: 800 },
    ];
    const implicit = layout(items);
    const explicit = layoutTimeline({
      range: { start: 0, end: 1_000 },
      rows: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', height: 80 }],
      items,
      options: {
        width: 500,
        rowLabelWidth: 100,
        rulerHeight: 40,
        defaultRowHeight: 60,
        itemHeight: 20,
        overlap: { mode: 'overlay', laneGap: 13 },
      },
    });

    expect(explicit.rows).toEqual(implicit.rows);
    expect(explicit.items).toEqual(implicit.items);
  });

  it('expands stack-mode rows from the existing one-lane geometry and positions lanes with the configured gap', () => {
    const scene = layoutTimeline({
      range: { start: 0, end: 1_000 },
      rows: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', height: 80 }],
      items: [
        { id: 'a-first', rowId: 'a', start: 0, end: 700 },
        { id: 'a-second', rowId: 'a', start: 100, end: 800 },
        { id: 'a-third', rowId: 'a', start: 200, end: 900 },
        { id: 'b-item', rowId: 'b', start: 100, end: 200 },
      ],
      options: {
        width: 500,
        rowLabelWidth: 100,
        rulerHeight: 40,
        defaultRowHeight: 60,
        itemHeight: 20,
        overlap: { mode: 'stack', laneGap: 6 },
      },
    });

    expect(scene.rows).toEqual([
      { id: 'a', label: 'Alpha', x: 0, y: 0, width: 400, height: 112 },
      { id: 'b', label: 'Beta', x: 0, y: 112, width: 400, height: 80 },
    ]);
    expect(scene.items).toMatchObject([
      { id: 'a-first', y: 20, height: 20 },
      { id: 'a-second', y: 46, height: 20 },
      { id: 'a-third', y: 72, height: 20 },
      { id: 'b-item', y: 142, height: 20 },
    ]);
    expect(scene.plotHeight).toBe(192);
    expect(scene.height).toBe(232);
  });

  it('treats explicit row heights as stack-mode minimums without compressing item height', () => {
    const scene = layoutTimeline({
      range: { start: 0, end: 100 },
      rows: [{ id: 'short', label: 'Short', height: 12 }],
      items: [
        { id: 'first', rowId: 'short', start: 0, end: 100 },
        { id: 'second', rowId: 'short', start: 10, end: 90 },
      ],
      options: {
        width: 500,
        rowLabelWidth: 100,
        rulerHeight: 40,
        itemHeight: 30,
        overlap: { mode: 'stack', laneGap: 4 },
      },
    });

    expect(scene.rows[0]).toMatchObject({ height: 64 });
    expect(scene.items).toMatchObject([
      { id: 'first', y: 0, height: 30 },
      { id: 'second', y: 34, height: 30 },
    ]);
  });

  it('does not expand an empty stack-mode row just because its configured item height is larger', () => {
    const scene = layoutTimeline({
      range: { start: 0, end: 100 },
      rows: [{ id: 'empty', label: 'Empty', height: 12 }],
      items: [],
      options: { width: 500, itemHeight: 30, overlap: { mode: 'stack' } },
    });

    expect(scene.rows[0]).toMatchObject({ height: 12 });
  });

  it('keeps full-row lane assignments stable when viewport culling changes', () => {
    const input = {
      rows: [{ id: 'a', label: 'Alpha' }],
      items: [
        { id: 'earlier', rowId: 'a', start: 0, end: 250 },
        { id: 'selected', rowId: 'a', start: 100, end: 500 },
        { id: 'later', rowId: 'a', start: 300, end: 700 },
      ],
      options: {
        width: 500,
        rowLabelWidth: 100,
        rulerHeight: 40,
        defaultRowHeight: 60,
        itemHeight: 20,
        overlap: { mode: 'stack' as const },
      },
    };
    const initial = layoutTimeline({ ...input, range: { start: 0, end: 400 } });
    const panned = layoutTimeline({ ...input, range: { start: 300, end: 700 } });
    const returned = layoutTimeline({ ...input, range: { start: 0, end: 400 } });

    expect(initial.items.find((item) => item.id === 'selected')?.y).toBe(44);
    expect(panned.items.find((item) => item.id === 'selected')?.y).toBe(44);
    expect(returned.items.find((item) => item.id === 'selected')?.y).toBe(44);
    expect(panned.items.map((item) => item.id)).toEqual(['selected', 'later']);
  });

  it('keeps unrelated rows isolated when calculating stacked lanes', () => {
    const scene = layoutTimeline({
      range: { start: 0, end: 100 },
      rows: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }],
      items: [
        { id: 'a-one', rowId: 'a', start: 0, end: 100 },
        { id: 'a-two', rowId: 'a', start: 0, end: 100 },
        { id: 'b-one', rowId: 'b', start: 0, end: 100 },
      ],
      options: { width: 500, overlap: { mode: 'stack' } },
    });

    expect(scene.rows.map((row) => row.height)).toEqual([86, 56]);
    expect(scene.items).toMatchObject([
      { id: 'a-one', y: 15 },
      { id: 'a-two', y: 45 },
      { id: 'b-one', y: 101 },
    ]);
  });

  it('validates overlap mode and lane gap', () => {
    const input = {
      range: { start: 0, end: 100 },
      rows: [{ id: 'a', label: 'Alpha' }],
      items: [],
      options: { width: 500 },
    };

    expect(() => layoutTimeline({
      ...input,
      options: { ...input.options, overlap: { mode: 'other' as never } },
    })).toThrow(/Overlap mode/);
    expect(() => layoutTimeline({
      ...input,
      options: { ...input.options, overlap: { laneGap: -1 } },
    })).toThrow(/lane gap/);
    expect(() => layoutTimeline({
      ...input,
      options: { ...input.options, overlap: { laneGap: Number.NaN } },
    })).toThrow(/lane gap/);
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
