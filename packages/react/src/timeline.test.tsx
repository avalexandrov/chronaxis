// @vitest-environment happy-dom
import { StrictMode, act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline } from './timeline.js';
import type { TimelineInstance, TimelineItem, TimelineRow } from '@chronaxis/browser';

interface TaskData {
  owner: string;
}

const initialRange = { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' };
const rows: TimelineRow[] = [{ id: 'row', label: 'Original row' }];
const items: TimelineItem<TaskData>[] = [
  { id: 'item', rowId: 'row', start: '2026-01-05', end: '2026-01-10', label: 'Original item', data: { owner: 'Alex' } },
  { id: 'other', rowId: 'row', start: '2026-01-12', end: '2026-01-15', label: 'Other item', data: { owner: 'Bea' } },
];

interface ObserverRecord {
  callback: ResizeObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
}

let host: HTMLElement;
let reactRoot: Root;
let observers: ObserverRecord[];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

async function render(node: React.ReactNode): Promise<void> {
  await act(async () => reactRoot.render(node));
}

async function flushFrames(): Promise<void> {
  await act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
}

function chronaxisRoot(): HTMLElement {
  return host.querySelector<HTMLElement>('.chronaxis')!;
}

function item(itemId = 'item'): HTMLElement {
  return [...host.querySelectorAll<HTMLElement>('[data-chronaxis-item-id]')]
    .find((node) => node.dataset.chronaxisItemId === itemId)!;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  observers = [];
  frames = new Map();
  nextFrame = 1;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });

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
  reactRoot = createRoot(host);
});

afterEach(async () => {
  await act(async () => reactRoot.unmount());
  host.remove();
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe('Timeline', () => {
  it('mounts initial rows/items/range and applies safe div props', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    await render(
      <Timeline<TaskData>
        ref={ref}
        className="project-timeline"
        aria-label="Project plan"
        style={{ height: 400 }}
        rows={rows}
        items={items}
        initialRange={initialRange}
      />,
    );

    expect(host.querySelector('.project-timeline')?.getAttribute('aria-label')).toBe('Project plan');
    expect(host.querySelector('.project-timeline')?.getAttribute('style')).toContain('height: 400px');
    expect(host.textContent).toContain('Original row');
    expect(host.textContent).toContain('Original item');
    expect(ref.current?.getRange()).toEqual({ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 1, 1) });
  });

  it('updates rows/items atomically without recreating the instance or resetting the viewport', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    const view = (nextRows: readonly TimelineRow[], nextItems: readonly TimelineItem<TaskData>[]) => (
      <Timeline ref={ref} rows={nextRows} items={nextItems} initialRange={initialRange} />
    );
    await render(view(rows, items));
    const instance = ref.current;
    const root = chronaxisRoot();
    act(() => instance?.zoomIn());
    await flushFrames();
    const changedRange = instance?.getRange();

    const nextRows = [{ id: 'replacement', label: 'Replacement row' }];
    const nextItems = [{ id: 'replacement-item', rowId: 'replacement', start: '2026-01-20', label: 'Replacement item', data: { owner: 'Dana' } }];
    await render(view(nextRows, nextItems));
    await flushFrames();

    expect(ref.current).toBe(instance);
    expect(chronaxisRoot()).toBe(root);
    expect(ref.current?.getRange()).toEqual(changedRange);
    expect(host.textContent).toContain('Replacement row');
    expect(host.textContent).toContain('Replacement item');
    expect(observers).toHaveLength(1);
  });

  it('treats initial range and configuration as creation-time props', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    await render(
      <Timeline
        ref={ref}
        rows={rows}
        items={items}
        initialRange={initialRange}
        viewport={{ minZoomDuration: 1_000 }}
        interactions={{ pan: true }}
      />,
    );
    const instance = ref.current;
    act(() => instance?.zoomIn());
    const interactiveRange = instance!.getRange();

    await render(
      <Timeline
        ref={ref}
        rows={rows}
        items={items}
        initialRange={{ start: '2030-01-01', end: '2031-01-01' }}
        viewport={{ minZoomDuration: 99_000 }}
        interactions={{ pan: false }}
      />,
    );

    expect(ref.current).toBe(instance);
    expect(ref.current?.getRange()).toEqual(interactiveRange);
    expect(observers).toHaveLength(1);
  });

  it('preserves selection reconciliation through reactive data updates', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    const selection = vi.fn();
    await render(<Timeline ref={ref} rows={rows} items={items} initialRange={initialRange} onSelectionChange={selection} />);
    act(() => ref.current?.selectItem('item'));
    expect(ref.current?.getSelectedItemId()).toBe('item');

    await render(<Timeline ref={ref} rows={rows} items={[items[1]!]} initialRange={initialRange} onSelectionChange={selection} />);
    expect(ref.current?.getSelectedItemId()).toBeNull();
    expect(selection).toHaveBeenLastCalledWith({ selectedItem: null, source: 'data' });
  });

  it('forwards all event props with current payloads', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    const onRangeChange = vi.fn();
    const onItemClick = vi.fn();
    const onSelectionChange = vi.fn();
    await render(
      <Timeline
        ref={ref}
        rows={rows}
        items={items}
        initialRange={initialRange}
        onRangeChange={onRangeChange}
        onItemClick={onItemClick}
        onSelectionChange={onSelectionChange}
      />,
    );

    act(() => ref.current?.zoomIn());
    await flushFrames();
    expect(onRangeChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'zoomIn' }));

    await act(async () => item().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'keyboard' }));
    expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ data: { owner: 'Alex' } }) }));
  });

  it('uses latest event and DOM customization callbacks without recreating', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    const firstSelection = vi.fn();
    const secondSelection = vi.fn();
    const firstRender = vi.fn((entry: { label?: string }) => `First ${entry.label}`);
    const secondRender = vi.fn((entry: { label?: string }) => `Second ${entry.label}`);
    await render(
      <Timeline ref={ref} rows={rows} items={items} initialRange={initialRange} onSelectionChange={firstSelection} renderItem={firstRender} />,
    );
    const instance = ref.current;
    expect(item().textContent).toBe('First Original item');

    await render(
      <Timeline ref={ref} rows={rows} items={items} initialRange={initialRange} onSelectionChange={secondSelection} renderItem={secondRender} />,
    );
    await flushFrames();
    expect(ref.current).toBe(instance);
    expect(item().textContent).toBe('Second Original item');
    act(() => ref.current?.selectItem('other'));
    expect(firstSelection).not.toHaveBeenCalled();
    expect(secondSelection).toHaveBeenCalledOnce();
  });

  it('exposes the browser instance and clears the ref on unmount', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    await render(<Timeline ref={ref} rows={rows} items={items} initialRange={initialRange} />);
    expect(ref.current).toEqual(expect.objectContaining({ fit: expect.any(Function), zoomIn: expect.any(Function) }));
    const before = ref.current!.getRange();
    act(() => ref.current?.zoomIn());
    expect(ref.current!.getRange()).not.toEqual(before);
    act(() => ref.current?.fit());
    expect(ref.current!.getRange().start).toBeLessThanOrEqual(Date.UTC(2026, 0, 5));

    await act(async () => reactRoot.unmount());
    expect(ref.current).toBeNull();
    expect(observers[0]?.disconnect).toHaveBeenCalledOnce();
    reactRoot = createRoot(host);
  });

  it('cleans Strict Mode setup and leaves one live Chronaxis root', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    await render(
      <StrictMode><Timeline ref={ref} rows={rows} items={items} initialRange={initialRange} /></StrictMode>,
    );

    expect(host.querySelectorAll('.chronaxis')).toHaveLength(1);
    expect(observers).toHaveLength(2);
    expect(observers[0]?.disconnect).toHaveBeenCalledOnce();
    expect(observers[1]?.disconnect).not.toHaveBeenCalled();
    expect(ref.current).not.toBeNull();
  });

  it('can unmount and remount cleanly', async () => {
    const view = <Timeline rows={rows} items={items} initialRange={initialRange} />;
    await render(view);
    await render(null);
    expect(host.querySelector('.chronaxis')).toBeNull();
    expect(observers[0]?.disconnect).toHaveBeenCalledOnce();

    await render(view);
    expect(host.querySelectorAll('.chronaxis')).toHaveLength(1);
    expect(observers).toHaveLength(2);
  });

  it('does not rerender the consumer tree for Chronaxis range frames', async () => {
    const ref = { current: null as TimelineInstance<TaskData> | null };
    let consumerRenders = 0;
    function Consumer() {
      consumerRenders += 1;
      const stableRows = useRef(rows).current;
      const stableItems = useRef(items).current;
      return <Timeline ref={ref} rows={stableRows} items={stableItems} initialRange={initialRange} onRangeChange={() => {}} />;
    }
    await render(<Consumer />);
    const rendersAfterMount = consumerRenders;
    act(() => ref.current?.zoomIn());
    await flushFrames();
    expect(consumerRenders).toBe(rendersAfterMount);
  });
});
