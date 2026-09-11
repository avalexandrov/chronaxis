// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createTimeline } from './create-timeline.js';
import type { TimelineItem } from '@chronaxis/core';
import type { TimelineEventMap, TimelineInstance, TimelineOptions } from './types.js';

interface ObserverRecord {
  callback: ResizeObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
}

let observers: ObserverRecord[];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function timelineOptions(): TimelineOptions<{ owner: string }> {
  return {
    range: { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
    rows: [{ id: 'row', label: 'Original row' }],
    items: [{
      id: 'item',
      rowId: 'row',
      start: '2026-01-05T00:00:00Z',
      end: '2026-01-10T00:00:00Z',
      label: 'Original item',
      data: { owner: 'Alex' },
    }],
  };
}

function containerAt(width: number): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => width });
  document.body.append(container);
  return container;
}

function notifyResize(): void {
  const observer = observers[0]!;
  observer.callback([], observer as unknown as ResizeObserver);
}

function flushFrame(): void {
  const pending = [...frames.entries()];
  frames.clear();
  for (const [, callback] of pending) callback(0);
}

function rootOf(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('.chronaxis')!;
}

function itemOf(container: HTMLElement, itemId = 'item'): HTMLElement {
  return [...container.querySelectorAll<HTMLElement>('[data-chronaxis-item-id]')]
    .find((item) => item.dataset.chronaxisItemId === itemId)!;
}

function rowLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.chronaxis-row-label')]
    .map((row) => row.textContent ?? '');
}

function wheel(root: HTMLElement, options: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 370, clientY: 100, ...options });
  Object.defineProperties(event, {
    clientX: { value: options.clientX ?? 370 },
    clientY: { value: options.clientY ?? 100 },
    ctrlKey: { value: options.ctrlKey ?? false },
    metaKey: { value: options.metaKey ?? false },
    deltaY: { value: options.deltaY ?? 0 },
    deltaMode: { value: options.deltaMode ?? 0 },
  });
  root.dispatchEvent(event);
  return event;
}

function pointer(root: HTMLElement, type: string, options: PointerEventInit): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: options.clientX ?? 0 },
    clientY: { value: options.clientY ?? 70 },
    pointerId: { value: options.pointerId ?? 1 },
    pointerType: { value: options.pointerType ?? 'mouse' },
    isPrimary: { value: options.isPrimary ?? true },
    button: { value: options.button ?? 0 },
  });
  root.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.replaceChildren();
  observers = [];
  frames = new Map();
  nextFrame = 1;

  class MockResizeObserver {
    readonly disconnect = vi.fn();
    constructor(callback: ResizeObserverCallback) {
      observers.push({ callback, disconnect: this.disconnect });
    }
    observe(): void {}
  }

  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
});

afterEach(() => vi.unstubAllGlobals());

describe('createTimeline lifecycle', () => {
  it('owns a normalized snapshot instead of observing later caller mutations', () => {
    const options = timelineOptions();
    const container = containerAt(600);
    createTimeline(container, options);

    options.range.start = '2026-01-20T00:00:00Z';
    (options.rows[0] as { label: string }).label = 'Changed row';
    (options.items[0] as { label: string }).label = 'Changed item';
    notifyResize();
    flushFrame();

    expect(container.textContent).toContain('Original row');
    expect(container.textContent).toContain('Original item');
    expect(container.textContent).not.toContain('Changed');
  });

  it('coalesces resize notifications into one animation frame', () => {
    containerAt(600);
    createTimeline(document.body.lastElementChild as HTMLElement, timelineOptions());
    notifyResize();
    notifyResize();
    notifyResize();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
  });

  it('cancels pending work, disconnects once, and tolerates repeated destroy', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    notifyResize();
    timeline.destroy();
    timeline.destroy();

    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    expect(container.querySelector('.chronaxis')).toBeNull();
  });

  it('does not schedule rendering after destruction', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    timeline.destroy();
    notifyResize();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('leaves no root or observer when initialization validation fails', () => {
    const container = containerAt(600);
    const invalid = timelineOptions();
    invalid.range.end = invalid.range.start;
    expect(() => createTimeline(container, invalid)).toThrow(RangeError);
    expect(container.querySelector('.chronaxis')).toBeNull();
    expect(observers).toHaveLength(0);
    expect(frames.size).toBe(0);
  });

  it('cleans up the root and observer when observer setup fails', () => {
    class FailingResizeObserver {
      readonly disconnect = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
      observe(): void {
        throw new Error('Observer setup failed');
      }
    }
    vi.stubGlobal('ResizeObserver', FailingResizeObserver);
    const container = containerAt(600);

    expect(() => createTimeline(container, timelineOptions())).toThrow('Observer setup failed');
    expect(container.querySelector('.chronaxis')).toBeNull();
    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });
});

describe('timeline range API', () => {
  it('updates state immediately, returns copies, and preserves state after invalid input', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    timeline.setRange({ start: '2026-03-01T00:00:00Z', end: '2026-04-01T00:00:00Z' });
    const expected = { start: Date.UTC(2026, 2, 1), end: Date.UTC(2026, 3, 1) };
    expect(timeline.getRange()).toEqual(expected);

    const snapshot = timeline.getRange();
    snapshot.start = 0;
    expect(timeline.getRange()).toEqual(expected);
    expect(() => timeline.setRange({ start: 10, end: 5 })).toThrow(RangeError);
    expect(timeline.getRange()).toEqual(expected);
  });

  it('coalesces synchronous state updates into one render using the newest state', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    timeline.setRange({ start: 0, end: 1_000_000 });
    timeline.scrollTo(2_000_000);
    timeline.zoomIn();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    expect((timeline.getRange().start + timeline.getRange().end) / 2).toBe(2_000_000);
  });

  it('keeps temporal state unchanged when the container resizes', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const before = timeline.getRange();
    Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => 900 });
    notifyResize();
    flushFrame();
    expect(timeline.getRange()).toEqual(before);
  });

  it('supports fit, empty fit, zoom, and scroll alignment', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    timeline.fit();
    const fitted = timeline.getRange();
    expect(fitted.start).toBeLessThan(Date.UTC(2026, 0, 5));
    expect(fitted.end).toBeGreaterThan(Date.UTC(2026, 0, 10));

    const fittedDuration = fitted.end - fitted.start;
    timeline.zoomIn();
    expect(timeline.getRange().end - timeline.getRange().start).toBeCloseTo(fittedDuration / 1.5);
    timeline.zoomOut();
    expect(timeline.getRange().end - timeline.getRange().start).toBeCloseTo(fittedDuration);
    timeline.scrollTo(0, { align: 'start' });
    expect(timeline.getRange().start).toBe(0);

    const emptyOptions = timelineOptions();
    emptyOptions.items = [];
    const empty = createTimeline(containerAt(600), emptyOptions);
    const before = empty.getRange();
    empty.fit();
    expect(empty.getRange()).toEqual(before);
  });
});

describe('wheel zoom', () => {
  it('requires Ctrl or Cmd by default and only prevents handled wheel events', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const root = rootOf(container);
    const before = timeline.getRange();

    expect(wheel(root, { deltaY: -100 }).defaultPrevented).toBe(false);
    expect(timeline.getRange()).toEqual(before);
    const anchorRatio = 0.25;
    const anchorTime = before.start + (before.end - before.start) * anchorRatio;
    expect(wheel(root, { deltaY: -100, ctrlKey: true, clientX: 140 + 460 * anchorRatio }).defaultPrevented).toBe(true);
    const after = timeline.getRange();
    expect(after.end - after.start).toBeLessThan(before.end - before.start);
    expect(after.start + (after.end - after.start) * anchorRatio).toBeCloseTo(anchorTime);
  });

  it('supports always-on zoom and ignores the row-label gutter', () => {
    const options = timelineOptions();
    options.interactions = { wheelZoom: 'always' };
    const container = containerAt(600);
    const timeline = createTimeline(container, options);
    const root = rootOf(container);
    const before = timeline.getRange();

    expect(wheel(root, { deltaY: -50, clientX: 50 }).defaultPrevented).toBe(false);
    expect(timeline.getRange()).toEqual(before);
    expect(wheel(root, { deltaY: -50 }).defaultPrevented).toBe(true);
  });

  it('can be disabled and its listener is removed on destroy', () => {
    const disabledOptions = timelineOptions();
    disabledOptions.interactions = { wheelZoom: false };
    const disabledContainer = containerAt(600);
    const disabled = createTimeline(disabledContainer, disabledOptions);
    expect(wheel(rootOf(disabledContainer), { deltaY: -100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    disabled.destroy();

    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const root = rootOf(container);
    timeline.destroy();
    expect(wheel(root, { deltaY: -100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});

describe('pointer panning', () => {
  it('waits for the activation threshold, pans from the original range, and cancels safely', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const root = rootOf(container);
    Object.defineProperties(root, {
      setPointerCapture: { value: vi.fn(), configurable: true },
      hasPointerCapture: { value: vi.fn(() => true), configurable: true },
      releasePointerCapture: { value: vi.fn(), configurable: true },
    });
    const initial = timeline.getRange();

    expect(root.classList.contains('chronaxis-pannable')).toBe(true);
    pointer(root, 'pointerdown', { clientX: 300 });
    expect(root.setPointerCapture).toHaveBeenCalledWith(1);
    pointer(root, 'pointermove', { clientX: 303 });
    expect(timeline.getRange()).toEqual(initial);
    pointer(root, 'pointermove', { clientX: 320 });
    expect(timeline.getRange().start).toBeLessThan(initial.start);
    const panned = timeline.getRange();
    flushFrame();

    pointer(root, 'pointercancel', { clientX: 320 });
    pointer(root, 'pointermove', { clientX: 350 });
    expect(timeline.getRange()).toEqual(panned);
    expect(frames.size).toBe(0);
    expect(root.classList.contains('chronaxis-panning')).toBe(false);
  });

  it('does not start in the gutter and can be disabled', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const before = timeline.getRange();
    pointer(rootOf(container), 'pointerdown', { clientX: 50 });
    pointer(rootOf(container), 'pointermove', { clientX: 100 });
    expect(timeline.getRange()).toEqual(before);
    const enabledRoot = rootOf(container);
    timeline.destroy();
    pointer(enabledRoot, 'pointerdown', { clientX: 300 });
    pointer(enabledRoot, 'pointermove', { clientX: 350 });
    expect(timeline.getRange()).toEqual(before);

    const disabledOptions = timelineOptions();
    disabledOptions.interactions = { pan: false };
    const disabledContainer = containerAt(600);
    const disabled = createTimeline(disabledContainer, disabledOptions);
    pointer(rootOf(disabledContainer), 'pointerdown', { clientX: 300 });
    pointer(rootOf(disabledContainer), 'pointermove', { clientX: 350 });
    expect(disabled.getRange()).toEqual({
      start: Date.UTC(2026, 0, 1),
      end: Date.UTC(2026, 1, 1),
    });
  });
});

describe('selection and activation', () => {
  it('starts empty, selects by API, renders state, and clears without duplicate events', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const changes: TimelineEventMap<{ owner: string }>['selectionChange'][] = [];
    timeline.on('selectionChange', (event) => changes.push(event));

    expect(timeline.getSelectedItemId()).toBeNull();
    timeline.selectItem('item');
    expect(timeline.getSelectedItemId()).toBe('item');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ source: 'api', selectedItem: { id: 'item', start: Date.UTC(2026, 0, 5) } });
    expect(Object.isFrozen(changes[0])).toBe(true);
    expect(Object.isFrozen(changes[0]?.selectedItem)).toBe(true);
    flushFrame();
    expect(itemOf(container).dataset.selected).toBe('true');
    expect(itemOf(container).getAttribute('aria-pressed')).toBe('true');

    timeline.selectItem('item');
    expect(changes).toHaveLength(1);
    timeline.clearSelection();
    timeline.clearSelection();
    expect(timeline.getSelectedItemId()).toBeNull();
    expect(changes).toHaveLength(2);
    expect(changes[1]).toEqual({ selectedItem: null, source: 'api' });
  });

  it('rejects nonexistent and duplicate item IDs', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    expect(() => timeline.selectItem('missing')).toThrow(/Unknown timeline item ID/);
    const duplicateOptions = timelineOptions();
    duplicateOptions.items = [duplicateOptions.items[0]!, { ...duplicateOptions.items[0]! }];
    expect(() => createTimeline(containerAt(600), duplicateOptions)).toThrow(/Duplicate item ID/);
  });

  it('pointer activation selects an item and always emits itemClick', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const root = rootOf(container);
    const selectionSources: string[] = [];
    const clicks: string[] = [];
    timeline.on('selectionChange', (event) => selectionSources.push(event.source));
    timeline.on('itemClick', (event) => clicks.push(event.item.id));

    pointer(itemOf(container), 'pointerdown', { clientX: 210 });
    pointer(root, 'pointerup', { clientX: 212 });
    expect(timeline.getSelectedItemId()).toBe('item');
    expect(selectionSources).toEqual(['pointer']);
    expect(clicks).toEqual(['item']);

    pointer(itemOf(container), 'pointerdown', { clientX: 210 });
    pointer(root, 'pointerup', { clientX: 210 });
    expect(selectionSources).toEqual(['pointer']);
    expect(clicks).toEqual(['item', 'item']);
  });

  it('activates below the threshold but pans without activation above it', () => {
    const belowContainer = containerAt(600);
    const below = createTimeline(belowContainer, timelineOptions());
    const belowRoot = rootOf(belowContainer);
    const belowClicks = vi.fn();
    below.on('itemClick', belowClicks);
    pointer(itemOf(belowContainer), 'pointerdown', { clientX: 210 });
    pointer(belowRoot, 'pointermove', { clientX: 213 });
    pointer(belowRoot, 'pointerup', { clientX: 213 });
    expect(belowClicks).toHaveBeenCalledTimes(1);

    const dragContainer = containerAt(600);
    const dragged = createTimeline(dragContainer, timelineOptions());
    const dragRoot = rootOf(dragContainer);
    const dragClicks = vi.fn();
    const initialRange = dragged.getRange();
    dragged.on('itemClick', dragClicks);
    pointer(itemOf(dragContainer), 'pointerdown', { clientX: 210 });
    pointer(dragRoot, 'pointermove', { clientX: 230 });
    pointer(dragRoot, 'pointerup', { clientX: 230 });
    expect(dragClicks).not.toHaveBeenCalled();
    expect(dragged.getSelectedItemId()).toBeNull();
    expect(dragged.getRange().start).toBeLessThan(initialRange.start);
  });

  it('does not activate a cancelled pointer gesture', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const root = rootOf(container);
    const clicks = vi.fn();
    timeline.on('itemClick', clicks);
    pointer(itemOf(container), 'pointerdown', { clientX: 210 });
    pointer(root, 'pointercancel', { clientX: 210 });
    expect(clicks).not.toHaveBeenCalled();
    expect(timeline.getSelectedItemId()).toBeNull();
  });

  it('keeps selection while the item is culled and restores its selected rendering', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    timeline.selectItem('item');
    flushFrame();
    timeline.setRange({ start: '2030-01-01', end: '2030-02-01' });
    flushFrame();
    expect(itemOf(container)).toBeUndefined();
    expect(timeline.getSelectedItemId()).toBe('item');
    timeline.setRange({ start: '2026-01-01', end: '2026-02-01' });
    flushFrame();
    expect(itemOf(container).dataset.selected).toBe('true');
  });
});

describe('typed public events', () => {
  it('preserves generic item data types', () => {
    expectTypeOf<TimelineInstance<{ owner: string }>['on']>().toBeFunction();
    expectTypeOf<TimelineEventMap<{ owner: string }>['itemClick']['item']['data']>()
      .toEqualTypeOf<{ owner: string } | undefined>();
  });

  it('notifies multiple handlers and supports isolated idempotent unsubscription', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = timeline.on('selectionChange', first);
    timeline.on('selectionChange', second);
    unsubscribe();
    unsubscribe();
    timeline.selectItem('item');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('lets every handler run and surfaces failures asynchronously', () => {
    const queued: Array<() => void> = [];
    vi.stubGlobal('queueMicrotask', (callback: () => void) => queued.push(callback));
    const timeline = createTimeline(containerAt(600), timelineOptions());
    const second = vi.fn();
    timeline.on('selectionChange', () => { throw new Error('consumer failure'); });
    timeline.on('selectionChange', second);
    timeline.selectItem('item');
    expect(second).toHaveBeenCalledTimes(1);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toThrow('consumer failure');
    expect(timeline.getSelectedItemId()).toBe('item');
  });

  it('clears subscriptions and makes mutating APIs safe no-ops after destroy', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    const selection = vi.fn();
    const range = vi.fn();
    const unsubscribe = timeline.on('selectionChange', selection);
    timeline.on('rangeChange', range);
    const before = timeline.getRange();
    timeline.destroy();
    timeline.selectItem('item');
    timeline.clearSelection();
    timeline.setRange({ start: 0, end: 1 });
    timeline.fit();
    timeline.zoomIn();
    timeline.zoomOut();
    timeline.scrollTo(0);
    timeline.setItems([]);
    timeline.setRows([]);
    timeline.setData({ rows: [], items: [] });
    timeline.on('selectionChange', selection)();
    unsubscribe();
    expect(timeline.getRange()).toEqual(before);
    expect(timeline.getSelectedItemId()).toBeNull();
    expect(selection).not.toHaveBeenCalled();
    expect(range).not.toHaveBeenCalled();
  });
});

describe('dynamic data updates', () => {
  it('replaces items atomically, normalizes times, owns inputs, and preserves the viewport', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const beforeRange = timeline.getRange();
    const nextItems: TimelineItem<{ owner: string }>[] = [{
      id: 'replacement',
      rowId: 'row',
      start: '2026-01-12T00:00:00Z',
      end: '2026-01-20T00:00:00Z',
      label: 'Replacement',
      data: { owner: 'Bea' },
    }];
    timeline.setItems(nextItems);
    nextItems[0]!.label = 'Caller mutation';
    nextItems[0]!.start = '2030-01-01';
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(timeline.getRange()).toEqual(beforeRange);
    flushFrame();

    expect(itemOf(container, 'item')).toBeUndefined();
    expect(itemOf(container, 'replacement').textContent).toBe('Replacement');
    const clicks: TimelineEventMap<{ owner: string }>['itemClick'][] = [];
    timeline.on('itemClick', (event) => clicks.push(event));
    itemOf(container, 'replacement').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clicks[0]?.item).toMatchObject({
      start: Date.UTC(2026, 0, 12),
      label: 'Replacement',
      data: { owner: 'Bea' },
    });
  });

  it('rejects invalid item updates without changing state, selection, events, or scheduling', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const changes = vi.fn();
    timeline.on('selectionChange', changes);
    timeline.selectItem('item');
    flushFrame();
    changes.mockClear();
    vi.mocked(requestAnimationFrame).mockClear();

    expect(() => timeline.setItems([
      { id: 'duplicate', rowId: 'row', start: 0 },
      { id: 'duplicate', rowId: 'row', start: 1 },
    ])).toThrow(/Duplicate item ID/);
    expect(() => timeline.setItems([
      { id: 'orphan', rowId: 'missing', start: 0 },
    ])).toThrow(/unknown row/);
    expect(() => timeline.setItems([
      { id: 'invalid', rowId: 'row', start: 'not a date' },
    ])).toThrow(/Invalid time input/);
    expect(() => timeline.setItems([
      { id: 'backwards', rowId: 'row', start: 10, end: 5 },
    ])).toThrow(/ends before/);

    expect(timeline.getSelectedItemId()).toBe('item');
    expect(itemOf(container).textContent).toBe('Original item');
    expect(changes).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('uses the latest items for fit', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    timeline.setItems([{
      id: 'future', rowId: 'row', start: '2030-05-01', end: '2030-05-11',
    }]);
    timeline.fit();
    const fitted = timeline.getRange();
    expect(fitted.start).toBeLessThan(Date.UTC(2030, 4, 1));
    expect(fitted.end).toBeGreaterThan(Date.UTC(2030, 4, 11));

    timeline.setData({
      rows: [{ id: 'later-row', label: 'Later' }],
      items: [{ id: 'later', rowId: 'later-row', start: '2040-06-01', end: '2040-06-05' }],
    });
    timeline.fit();
    const combinedFit = timeline.getRange();
    expect(combinedFit.start).toBeLessThan(Date.UTC(2040, 5, 1));
    expect(combinedFit.end).toBeGreaterThan(Date.UTC(2040, 5, 5));
  });

  it('replaces and reorders owned rows while preserving range and selection', () => {
    const container = containerAt(600);
    const options = timelineOptions();
    options.rows = [
      { id: 'row', label: 'First' },
      { id: 'second', label: 'Second' },
    ];
    const timeline = createTimeline(container, options);
    timeline.selectItem('item');
    flushFrame();
    const beforeRange = timeline.getRange();
    const reordered = [
      { id: 'second', label: 'Second moved' },
      { id: 'row', label: 'First moved' },
    ];
    timeline.setRows(reordered);
    reordered[0]!.label = 'Caller mutation';
    flushFrame();

    expect(rowLabels(container)).toEqual(['Second moved', 'First moved']);
    expect(timeline.getRange()).toEqual(beforeRange);
    expect(timeline.getSelectedItemId()).toBe('item');
    expect(itemOf(container).dataset.selected).toBe('true');
  });

  it('rejects invalid rows and removal of referenced rows atomically', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    expect(() => timeline.setRows([
      { id: 'row', label: 'One' },
      { id: 'row', label: 'Two' },
    ])).toThrow(/Duplicate row ID/);
    expect(() => timeline.setRows([{ id: 'other', label: 'Other' }])).toThrow(/unknown row/);
    expect(() => timeline.setRows([{ id: 'row', label: 'Invalid', height: 0 }])).toThrow(/must be positive/);
    expect(() => timeline.setRows([{ id: '  ', label: 'Invalid' }])).toThrow(/non-empty string/);
    expect(frames.size).toBe(0);
    expect(rowLabels(container)).toEqual(['Original row']);
  });

  it('updates rows and items together and accepts an empty data set', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    timeline.setData({
      rows: [{ id: 'new-row', label: 'New row' }],
      items: [{ id: 'new-item', rowId: 'new-row', start: '2026-01-10', label: 'New item' }],
    });
    flushFrame();
    expect(rowLabels(container)).toEqual(['New row']);
    expect(itemOf(container, 'new-item').textContent).toBe('New item');

    timeline.setData({ rows: [], items: [] });
    flushFrame();
    expect(rowLabels(container)).toEqual([]);
    expect(container.querySelector('[data-chronaxis-item-id]')).toBeNull();
  });

  it('leaves both collections unchanged when a combined update fails', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    expect(() => timeline.setData({
      rows: [{ id: 'new-row', label: 'New row' }],
      items: [{ id: 'orphan', rowId: 'missing', start: 0 }],
    })).toThrow(/unknown row/);
    expect(frames.size).toBe(0);
    expect(rowLabels(container)).toEqual(['Original row']);
    expect(itemOf(container).textContent).toBe('Original item');
  });

  it('coalesces data calls and renders only the final committed state', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    timeline.setItems([{ id: 'first', rowId: 'row', start: '2026-01-06', label: 'First' }]);
    timeline.setItems([{ id: 'second', rowId: 'row', start: '2026-01-07', label: 'Second' }]);
    timeline.setRows([{ id: 'row', label: 'Final row' }]);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(rowLabels(container)).toEqual(['Final row']);
    expect(itemOf(container, 'first')).toBeUndefined();
    expect(itemOf(container, 'second').textContent).toBe('Second');
  });

  it('preserves item input order as DOM paint order', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    timeline.setItems([
      { id: 'bottom', rowId: 'row', start: '2026-01-06', end: '2026-01-08' },
      { id: 'top', rowId: 'row', start: '2026-01-06', end: '2026-01-08' },
    ]);
    flushFrame();
    expect([...container.querySelectorAll<HTMLElement>('[data-chronaxis-item-id]')]
      .map((item) => item.dataset.chronaxisItemId)).toEqual(['bottom', 'top']);
  });
});

describe('data reconciliation', () => {
  it('keeps selection across metadata, date, and row changes without emitting a selection event', () => {
    const container = containerAt(600);
    const options = timelineOptions();
    options.rows = [
      { id: 'row', label: 'First' },
      { id: 'second', label: 'Second' },
    ];
    const timeline = createTimeline(container, options);
    const changes = vi.fn();
    timeline.on('selectionChange', changes);
    timeline.selectItem('item');
    changes.mockClear();
    timeline.setItems([{
      id: 'item', rowId: 'second', start: '2026-01-15', end: '2026-01-20',
      label: 'Updated item', data: { owner: 'Casey' },
    }]);
    flushFrame();

    expect(timeline.getSelectedItemId()).toBe('item');
    expect(itemOf(container)).toMatchObject({ textContent: 'Updated item' });
    expect(itemOf(container).dataset.rowId).toBe('second');
    expect(itemOf(container).dataset.selected).toBe('true');
    expect(changes).not.toHaveBeenCalled();
  });

  it('clears a removed selection synchronously exactly once with data source', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    const changes: TimelineEventMap<{ owner: string }>['selectionChange'][] = [];
    timeline.selectItem('item');
    timeline.on('selectionChange', (event) => changes.push(event));
    timeline.setItems([]);

    expect(timeline.getSelectedItemId()).toBeNull();
    expect(changes).toEqual([{ selectedItem: null, source: 'data' }]);
    expect(frames.size).toBe(1);
  });

  it('emits current item snapshots after replacement', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const clicks: TimelineEventMap<{ owner: string }>['itemClick'][] = [];
    timeline.on('itemClick', (event) => clicks.push(event));
    timeline.setItems([{
      id: 'item', rowId: 'row', start: '2026-01-08', end: '2026-01-12',
      label: 'New snapshot', data: { owner: 'Dana' },
    }]);
    flushFrame();
    itemOf(container).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clicks[0]?.item).toMatchObject({
      label: 'New snapshot', data: { owner: 'Dana' },
      start: Date.UTC(2026, 0, 8),
    });
  });

  it('restores focused items by ID after data changes and does not restore removed items', () => {
    const container = containerAt(600);
    const options = timelineOptions();
    options.rows = [{ id: 'row', label: 'First' }, { id: 'second', label: 'Second' }];
    const timeline = createTimeline(container, options);
    itemOf(container).focus();
    timeline.setItems([{
      id: 'item', rowId: 'second', start: '2026-01-12', end: '2026-01-18', label: 'Moved', data: { owner: 'Alex' },
    }]);
    flushFrame();
    expect(document.activeElement).toBe(itemOf(container));
    expect(itemOf(container).dataset.rowId).toBe('second');

    timeline.setItems([]);
    flushFrame();
    expect(document.activeElement?.getAttribute('data-chronaxis-item-id')).toBeNull();
  });

  it('does not steal outside focus during a data update', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    timeline.setItems([{ id: 'item', rowId: 'row', start: 0, label: 'Updated' }]);
    flushFrame();
    expect(document.activeElement).toBe(outside);
  });
});

describe('dynamic data typing', () => {
  it('preserves the instance generic for inputs and updated event snapshots', () => {
    type ProjectTask = { owner: string; status: 'active' | 'done' };
    expectTypeOf<TimelineInstance<ProjectTask>['setItems']>()
      .parameter(0).toEqualTypeOf<readonly TimelineItem<ProjectTask>[]>();
    expectTypeOf<TimelineEventMap<ProjectTask>['itemClick']['item']['data']>()
      .toEqualTypeOf<ProjectTask | undefined>();

    if (false) {
      const typedTimeline = null as unknown as TimelineInstance<ProjectTask>;
      // @ts-expect-error Incorrect item data is rejected by the instance generic.
      typedTimeline.setItems([{ id: 'x', rowId: 'row', start: 0, data: { priority: 1 } }]);
    }
  });
});

describe('rangeChange events', () => {
  it('emits after rendering with the latest range and latest synchronous source', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    const events: TimelineEventMap['rangeChange'][] = [];
    timeline.on('rangeChange', (event) => events.push(event));
    timeline.setRange({ start: 0, end: 1_000_000 });
    timeline.scrollTo(2_000_000);
    timeline.zoomIn();
    expect(events).toHaveLength(0);
    flushFrame();
    expect(events).toHaveLength(1);
    expect(events[0]?.source).toBe('zoomIn');
    expect(events[0]?.range).toEqual(timeline.getRange());
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(Object.isFrozen(events[0]?.range)).toBe(true);
  });

  it('does not emit for unchanged state, including a round trip before rendering', () => {
    const timeline = createTimeline(containerAt(600), timelineOptions());
    const events = vi.fn();
    timeline.on('rangeChange', events);
    const initial = timeline.getRange();
    timeline.setRange(initial);
    expect(frames.size).toBe(0);
    timeline.setRange({ start: 0, end: 1_000 });
    timeline.setRange(initial);
    flushFrame();
    expect(events).not.toHaveBeenCalled();
  });

  it('reports sources for every viewport operation', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const root = rootOf(container);
    const sources: string[] = [];
    timeline.on('rangeChange', (event) => sources.push(event.source));

    timeline.setRange({ start: 0, end: 1_000_000 });
    flushFrame();
    timeline.fit();
    flushFrame();
    timeline.zoomIn();
    flushFrame();
    timeline.zoomOut();
    flushFrame();
    timeline.scrollTo(0);
    flushFrame();
    wheel(root, { deltaY: -100, ctrlKey: true });
    flushFrame();
    pointer(root, 'pointerdown', { clientX: 300 });
    pointer(root, 'pointermove', { clientX: 320 });
    flushFrame();
    pointer(root, 'pointercancel', { clientX: 320 });

    expect(sources).toEqual(['setRange', 'fit', 'zoomIn', 'zoomOut', 'scrollTo', 'wheel', 'pan']);
  });
});

describe('keyboard and focus', () => {
  it('makes items focusable buttons and activates with Enter and Space', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    const item = itemOf(container);
    const selectionSources: string[] = [];
    const clicks = vi.fn();
    timeline.on('selectionChange', (event) => selectionSources.push(event.source));
    timeline.on('itemClick', clicks);
    expect(item.tabIndex).toBe(0);
    expect(item.getAttribute('role')).toBe('button');
    expect(item.getAttribute('aria-label')).toBe('Original item');

    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(selectionSources).toEqual(['keyboard']);
    expect(clicks).toHaveBeenCalledTimes(2);
  });

  it('restores item focus after rerender without stealing outside focus', () => {
    const container = containerAt(600);
    const timeline = createTimeline(container, timelineOptions());
    itemOf(container).focus();
    timeline.zoomIn();
    flushFrame();
    expect(document.activeElement).toBe(itemOf(container));

    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    timeline.zoomOut();
    flushFrame();
    expect(document.activeElement).toBe(outside);
  });
});
