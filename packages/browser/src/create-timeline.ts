import { layoutTimeline, normalizeItems, normalizeRange } from '@chronaxis/core';
import type { LayoutOptions, NormalizedTimelineItem, TimeRange, TimelineRow } from '@chronaxis/core';
import { renderScene } from './render.js';
import type { TimelineInstance, TimelineOptions } from './types.js';

interface RuntimeState<T> {
  range: TimeRange;
  rows: TimelineRow[];
  items: NormalizedTimelineItem<T>[];
  layoutOptions: Omit<LayoutOptions, 'width'>;
}

function createRuntimeState<T>(options: TimelineOptions<T>): RuntimeState<T> {
  return {
    range: normalizeRange(options.range),
    rows: options.rows.map((row) => ({ ...row })),
    items: normalizeItems(options.items),
    layoutOptions: {
      defaultRowHeight: options.defaultRowHeight,
      rulerHeight: options.rulerHeight,
      rowLabelWidth: options.rowLabelWidth,
      itemHeight: options.itemHeight,
      minimumItemWidth: options.minimumItemWidth,
    },
  };
}

export function createTimeline<T>(container: HTMLElement, options: TimelineOptions<T>): TimelineInstance<T> {
  if (!(container instanceof HTMLElement)) throw new TypeError('A valid HTMLElement container is required.');

  const state = createRuntimeState(options);
  const initialWidth = container.clientWidth;
  const validationWidth = initialWidth > 1
    ? initialWidth
    : Math.max((state.layoutOptions.rowLabelWidth ?? 140) + 1, 2);
  const initialScene = layoutTimeline({
    range: state.range,
    rows: state.rows,
    items: state.items,
    options: { ...state.layoutOptions, width: validationWidth },
  });
  const root = document.createElement('div');
  root.className = 'chronaxis';
  let destroyed = false;
  let frame: number | undefined;

  const render = () => {
    frame = undefined;
    if (destroyed) return;
    const width = container.clientWidth;
    if (width <= 1) return;
    renderScene(root, layoutTimeline({
      range: state.range,
      rows: state.rows,
      items: state.items,
      options: { ...state.layoutOptions, width },
    }));
  };

  const scheduleRender = () => {
    if (destroyed || frame !== undefined) return;
    frame = requestAnimationFrame(render);
  };

  let observer: ResizeObserver | undefined;
  try {
    if (initialWidth > 1) renderScene(root, initialScene);
    container.append(root);
    observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
  } catch (error) {
    destroyed = true;
    observer?.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    root.remove();
    throw error;
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      root.remove();
    },
  };
}
