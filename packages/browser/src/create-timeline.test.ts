// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimeline } from './create-timeline.js';
import type { TimelineOptions } from './types.js';

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
