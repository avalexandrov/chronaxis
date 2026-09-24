// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick, shallowReactive, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline, type ChronaxisVueHandle } from './index.js';
import type { TimelineItem, TimelineRow } from '@chronaxis/browser/runtime';

interface TaskData { owner: string }
const range = { start: '2026-01-01', end: '2026-03-01' };
const rows: TimelineRow[] = [{ id: 'row', label: 'Original row' }];
const items: TimelineItem<TaskData>[] = [
  { id: 'first', rowId: 'row', start: '2026-01-05', end: '2026-01-24', label: 'First', data: { owner: 'Alex' } },
  { id: 'second', rowId: 'row', start: '2026-01-12', end: '2026-02-01', label: 'Second', data: { owner: 'Bea' } },
];

let host: HTMLElement;
let app: App<Element> | null;
let handle: ChronaxisVueHandle<TaskData> | null;
let observers: Array<{ disconnect: ReturnType<typeof vi.fn> }>;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

const props = shallowReactive({
  rows: rows as readonly TimelineRow[],
  items: items as readonly TimelineItem<TaskData>[],
  initialRange: range,
  overlap: { mode: 'stack' as const },
  renderItem: undefined as ((item: { label?: string }) => string) | undefined,
  onSelection: undefined as ((event: unknown) => void) | undefined,
  onRange: undefined as ((event: unknown) => void) | undefined,
  onItem: undefined as ((event: unknown) => void) | undefined,
});

function mount() {
  app = createApp(defineComponent({
    setup: () => () => h(Timeline, {
      ...props,
      ref: (value) => { handle = value as ChronaxisVueHandle<TaskData> | null; },
      'onSelection-change': props.onSelection,
      'onRange-change': props.onRange,
      'onItem-click': props.onItem,
      class: 'vue-host',
      'aria-label': 'Test timeline',
      style: { height: '360px' },
    }),
  }));
  app.mount(host);
}

function item(id: string): HTMLElement {
  return host.querySelector<HTMLElement>(`[data-chronaxis-item-id="${id}"]`)!;
}

async function framesOnce() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(0));
  await nextTick();
}

beforeEach(() => {
  props.rows = rows;
  props.items = items;
  props.initialRange = range;
  props.overlap = { mode: 'stack' };
  props.renderItem = undefined;
  props.onSelection = undefined;
  props.onRange = undefined;
  props.onItem = undefined;
  app = null;
  handle = null;
  host = document.createElement('div');
  document.body.append(host);
  observers = [];
  frames = new Map();
  nextFrame = 1;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });
  class MockResizeObserver {
    readonly disconnect = vi.fn();
    constructor() { observers.push(this); }
    observe(): void {}
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  app?.unmount();
  host.remove();
  vi.unstubAllGlobals();
});

describe('Timeline', () => {
  it('mounts one timeline with data, range, stack lanes, and host attributes', () => {
    mount();
    expect(host.querySelectorAll('.chronaxis')).toHaveLength(1);
    expect(host.querySelector('.vue-host')?.getAttribute('aria-label')).toBe('Test timeline');
    expect(host.textContent).toContain('Original row');
    expect(item('first').textContent).toBe('First');
    expect(item('first').style.top).not.toBe(item('second').style.top);
    expect(handle?.instance?.getRange()).toEqual({ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 2, 1) });
  });

  it('atomically replaces both collections while keeping viewport, selection, and root', async () => {
    mount();
    const instance = handle!.instance!;
    const root = host.querySelector('.chronaxis');
    instance.zoomIn();
    const navigated = instance.getRange();
    instance.selectItem('first');
    props.rows = [{ id: 'new', label: 'New row' }];
    props.items = [{ id: 'new-item', rowId: 'new', start: '2026-02-10', label: 'New item', data: { owner: 'Nora' } }];
    await nextTick();
    await framesOnce();
    expect(handle?.instance).toBe(instance);
    expect(host.querySelector('.chronaxis')).toBe(root);
    expect(instance.getRange()).toEqual(navigated);
    expect(instance.getSelectedItemId()).toBeNull();
    expect(host.textContent).toContain('New row');
    expect(item('new-item')).toBeTruthy();
    expect(observers).toHaveLength(1);
  });

  it('uses collection references, not nested in-place mutations', async () => {
    mount();
    const mutable = [...items];
    props.items = mutable;
    await nextTick();
    mutable[0] = { ...mutable[0]!, label: 'Changed' };
    await nextTick();
    expect(item('first').textContent).toBe('First');
    props.items = [...mutable];
    await nextTick();
    await framesOnce();
    expect(item('first').textContent).toBe('Changed');
  });

  it('keeps initial range and options as creation-time configuration', async () => {
    mount();
    const instance = handle!.instance!;
    const originalTop = item('first').style.top;
    instance.zoomIn();
    const navigated = instance.getRange();
    props.initialRange = { start: '2030-01-01', end: '2031-01-01' };
    props.overlap = { mode: 'stack' };
    await nextTick();
    expect(handle?.instance).toBe(instance);
    expect(instance.getRange()).toEqual(navigated);
    expect(item('first').style.top).toBe(originalTop);
  });

  it('bridges current Vue listeners and typed browser event payloads', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const rangeListener = vi.fn();
    const itemListener = vi.fn();
    props.onSelection = first;
    props.onRange = rangeListener;
    props.onItem = itemListener;
    mount();
    props.onSelection = second;
    await nextTick();
    handle!.instance!.zoomIn();
    await framesOnce();
    expect(rangeListener).toHaveBeenCalledWith(expect.objectContaining({ source: 'zoomIn' }));
    handle!.instance!.selectItem('first');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ selectedItem: expect.objectContaining({ data: { owner: 'Alex' } }) }));
    item('first').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(itemListener).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ data: { owner: 'Alex' } }) }));
  });

  it('refreshes changed DOM callbacks without replacing the instance', async () => {
    props.renderItem = (entry) => `A ${entry.label}`;
    mount();
    const instance = handle!.instance!;
    expect(item('first').textContent).toBe('A First');
    props.renderItem = (entry) => `B ${entry.label}`;
    await nextTick();
    await framesOnce();
    expect(handle?.instance).toBe(instance);
    expect(item('first').textContent).toBe('B First');
  });

  it('exposes the browser API and destroys it on unmount; remount has one root', () => {
    mount();
    const exposed = handle!;
    const instance = exposed.instance!;
    instance.zoomIn();
    instance.zoomOut();
    instance.scrollTo('2026-02-01');
    instance.selectItem('first');
    expect(instance.getSelectedItemId()).toBe('first');
    instance.clearSelection();
    instance.fit();
    expect(instance.getSelectedItemId()).toBeNull();
    app!.unmount();
    app = null;
    expect(exposed.instance).toBeNull();
    expect(handle).toBeNull();
    expect(host.querySelector('.chronaxis')).toBeNull();
    expect(observers[0]?.disconnect).toHaveBeenCalledOnce();
    mount();
    expect(host.querySelectorAll('.chronaxis')).toHaveLength(1);
    expect(observers).toHaveLength(2);
  });

  it('handles 1,000 items without tracking nested data or remounting on pan/zoom', async () => {
    props.items = Array.from({ length: 1000 }, (_, i): TimelineItem<TaskData> => ({
      id: `item-${i}`, rowId: 'row', start: Date.UTC(2026, 0, 1) + i * 1000,
      label: `Item ${i}`, data: { owner: 'Alex' },
    }));
    mount();
    const instance = handle!.instance!;
    instance.zoomIn();
    await framesOnce();
    expect(handle?.instance).toBe(instance);
    expect(observers).toHaveLength(1);
  });
});
