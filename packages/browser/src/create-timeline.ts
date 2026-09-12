import {
  alignTimeInRange,
  fitRange,
  layoutTimeline,
  normalizeItems,
  normalizeRange,
  normalizeTime,
  panRange,
  zoomRange,
} from '@chronaxis/core';
import type {
  LayoutOptions,
  NormalizedTimelineItem,
  TimeInput,
  TimeRange,
  TimeRangeInput,
  TimelineItem,
  TimelineRow,
  TimelineScene,
  ZoomLimits,
} from '@chronaxis/core';
import { renderScene } from './render.js';
import { itemSnapshot } from './snapshots.js';
import type {
  RangeChangeSource,
  ScrollToOptions,
  SelectionChangeSource,
  TimelineEventMap,
  TimelineData,
  TimelineInstance,
  TimelineOptions,
  WheelZoomMode,
} from './types.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const DEFAULT_MIN_ZOOM_DURATION = 5 * MINUTE;
const DEFAULT_MAX_ZOOM_DURATION = 50 * 365.25 * DAY;
const IMPERATIVE_ZOOM_FACTOR = 1.5;
const WHEEL_SENSITIVITY = 0.002;
const MAX_WHEEL_DELTA = 300;
const PAN_THRESHOLD = 4;

interface RuntimeState<T> {
  range: TimeRange;
  rows: TimelineRow[];
  rowsById: Map<string, TimelineRow>;
  items: NormalizedTimelineItem<T>[];
  itemsById: Map<string, NormalizedTimelineItem<T>>;
  selectedItemId: string | null;
  layoutOptions: Omit<LayoutOptions, 'width'>;
  zoomLimits: ZoomLimits;
  panEnabled: boolean;
  wheelZoom: WheelZoomMode;
}

interface PreparedRows {
  rows: TimelineRow[];
  rowsById: Map<string, TimelineRow>;
}

interface PreparedItems<T> {
  items: NormalizedTimelineItem<T>[];
  itemsById: Map<string, NormalizedTimelineItem<T>>;
}

interface PreparedData<T> extends PreparedRows, PreparedItems<T> {}

interface PointerGesture {
  pointerId: number;
  startClientX: number;
  startRange: TimeRange;
  plotWidth: number;
  itemId: string | null;
  active: boolean;
}

function positiveDuration(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive.`);
  return value;
}

function sameRange(left: TimeRange, right: TimeRange): boolean {
  return left.start === right.start && left.end === right.end;
}

function rangeSnapshot(range: TimeRange): Readonly<TimeRange> {
  return Object.freeze({ start: range.start, end: range.end });
}

function validateId(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
}

function prepareRows(rows: readonly TimelineRow[]): PreparedRows {
  const ownedRows: TimelineRow[] = [];
  const rowsById = new Map<string, TimelineRow>();
  for (const row of rows) {
    validateId(row.id, 'Timeline row ID');
    if (rowsById.has(row.id)) throw new Error(`Duplicate row ID: ${row.id}`);
    if (row.height !== undefined && (!Number.isFinite(row.height) || row.height <= 0)) {
      throw new RangeError(`Height for row "${row.id}" must be positive.`);
    }
    const ownedRow = { ...row };
    rowsById.set(row.id, ownedRow);
    ownedRows.push(ownedRow);
  }
  return { rows: ownedRows, rowsById };
}

function prepareItems<T>(items: readonly TimelineItem<T>[], rowsById: ReadonlyMap<string, TimelineRow>): PreparedItems<T> {
  const normalizedItems = normalizeItems(items);
  const itemsById = new Map<string, NormalizedTimelineItem<T>>();
  for (const item of normalizedItems) {
    validateId(item.id, 'Timeline item ID');
    validateId(item.rowId, `Row ID for timeline item "${item.id}"`);
    if (itemsById.has(item.id)) throw new Error(`Duplicate item ID: ${item.id}`);
    if (!rowsById.has(item.rowId)) {
      throw new Error(`Timeline item "${item.id}" references unknown row "${item.rowId}".`);
    }
    itemsById.set(item.id, item);
  }
  return { items: normalizedItems, itemsById };
}

function prepareData<T>(data: TimelineData<T>): PreparedData<T> {
  const preparedRows = prepareRows(data.rows);
  return { ...preparedRows, ...prepareItems(data.items, preparedRows.rowsById) };
}

function createRuntimeState<T>(options: TimelineOptions<T>): RuntimeState<T> {
  const minDuration = positiveDuration(
    options.viewport?.minZoomDuration ?? DEFAULT_MIN_ZOOM_DURATION,
    'Minimum zoom duration',
  );
  const maxDuration = positiveDuration(
    options.viewport?.maxZoomDuration ?? DEFAULT_MAX_ZOOM_DURATION,
    'Maximum zoom duration',
  );
  if (maxDuration < minDuration) {
    throw new RangeError('Maximum zoom duration must not be less than minimum zoom duration.');
  }

  const data = prepareData({ rows: options.rows, items: options.items });

  return {
    range: normalizeRange(options.range),
    rows: data.rows,
    rowsById: data.rowsById,
    items: data.items,
    itemsById: data.itemsById,
    selectedItemId: null,
    layoutOptions: {
      defaultRowHeight: options.defaultRowHeight,
      rulerHeight: options.rulerHeight,
      rowLabelWidth: options.rowLabelWidth,
      itemHeight: options.itemHeight,
      minimumItemWidth: options.minimumItemWidth,
    },
    zoomLimits: { minDuration, maxDuration },
    panEnabled: options.interactions?.pan ?? true,
    wheelZoom: options.interactions?.wheelZoom ?? 'modifier',
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
  let scene: TimelineScene | undefined = initialWidth > 1 ? initialScene : undefined;
  let pointerGesture: PointerGesture | undefined;
  let pendingRangeSource: RangeChangeSource | undefined;
  let lastNotifiedRange: TimeRange = { ...state.range };
  const subscriptions = new Map<keyof TimelineEventMap<T>, Set<(event: unknown) => void>>();

  const emit = <K extends keyof TimelineEventMap<T>>(type: K, event: TimelineEventMap<T>[K]) => {
    if (destroyed) return;
    const handlers = [...(subscriptions.get(type) ?? [])];
    const errors: unknown[] = [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      queueMicrotask(() => {
        if (errors.length === 1) throw errors[0];
        throw new AggregateError(errors, `Multiple Chronaxis ${String(type)} handlers failed.`);
      });
    }
  };

  const render = () => {
    frame = undefined;
    if (destroyed) return;
    const width = container.clientWidth;
    if (width <= 1) return;
    const nextScene = layoutTimeline({
      range: state.range,
      rows: state.rows,
      items: state.items,
      options: { ...state.layoutOptions, width },
    });
    renderScene(root, nextScene, {
      selectedItemId: state.selectedItemId,
      rowsById: state.rowsById,
      itemsById: state.itemsById,
      renderItem: options.renderItem,
      renderRowLabel: options.renderRowLabel,
      formatTick: options.formatTick,
      getItemClassName: options.getItemClassName,
      getRowClassName: options.getRowClassName,
    });
    scene = nextScene;

    const source = pendingRangeSource;
    pendingRangeSource = undefined;
    if (source && !sameRange(state.range, lastNotifiedRange)) {
      lastNotifiedRange = { ...state.range };
      emit('rangeChange', Object.freeze({ range: rangeSnapshot(state.range), source }));
    }
  };

  const scheduleRender = () => {
    if (destroyed || frame !== undefined) return;
    frame = requestAnimationFrame(render);
  };

  const updateRange = (range: TimeRange, source: RangeChangeSource): boolean => {
    if (destroyed || sameRange(range, state.range)) return false;
    state.range = range;
    pendingRangeSource = source;
    scheduleRender();
    return true;
  };

  const zoomBy = (durationFactor: number, anchorRatio: number, source: RangeChangeSource) => {
    if (destroyed) return;
    updateRange(zoomRange(state.range, durationFactor, anchorRatio, state.zoomLimits), source);
  };

  const selectItem = (itemId: string, source: SelectionChangeSource): boolean => {
    if (destroyed) return false;
    const item = state.itemsById.get(itemId);
    if (!item) throw new Error(`Unknown timeline item ID: ${itemId}`);
    if (state.selectedItemId === itemId) return false;
    state.selectedItemId = itemId;
    scheduleRender();
    emit('selectionChange', Object.freeze({ selectedItem: itemSnapshot(item), source }));
    return true;
  };

  const activateItem = (itemId: string, source: 'pointer' | 'keyboard') => {
    if (destroyed) return;
    const item = state.itemsById.get(itemId);
    if (!item) return;
    selectItem(itemId, source);
    emit('itemClick', Object.freeze({ item: itemSnapshot(item) }));
  };

  const reconcileSelection = () => {
    if (state.selectedItemId === null || state.itemsById.has(state.selectedItemId)) return;
    state.selectedItemId = null;
    emit('selectionChange', Object.freeze({ selectedItem: null, source: 'data' }));
  };

  const commitItems = (prepared: PreparedItems<T>) => {
    state.items = prepared.items;
    state.itemsById = prepared.itemsById;
    reconcileSelection();
    scheduleRender();
  };

  const commitRows = (prepared: PreparedRows) => {
    state.rows = prepared.rows;
    state.rowsById = prepared.rowsById;
    scheduleRender();
  };

  const commitData = (prepared: PreparedData<T>) => {
    state.rows = prepared.rows;
    state.rowsById = prepared.rowsById;
    state.items = prepared.items;
    state.itemsById = prepared.itemsById;
    reconcileSelection();
    scheduleRender();
  };

  const plotPosition = (event: MouseEvent): { localX: number; scene: TimelineScene } | null => {
    if (!scene) return null;
    const bounds = root.getBoundingClientRect();
    const localX = event.clientX - bounds.left - scene.plotX;
    if (!Number.isFinite(localX) || localX < 0 || localX > scene.plotWidth) return null;
    return { localX, scene };
  };

  const itemIdFromTarget = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    const item = target.closest<HTMLElement>('[data-chronaxis-item-id]');
    return item && root.contains(item) ? item.dataset.chronaxisItemId ?? null : null;
  };

  const handleWheel = (event: WheelEvent) => {
    const enabled = state.wheelZoom === 'always'
      || (state.wheelZoom === 'modifier' && (event.ctrlKey || event.metaKey));
    if (!enabled) return;
    const position = plotPosition(event);
    if (!position) return;
    event.preventDefault();
    const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? position.scene.plotWidth
        : 1;
    const delta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, event.deltaY * modeScale));
    const anchorRatio = Math.max(0, Math.min(1, position.localX / position.scene.plotWidth));
    zoomBy(Math.exp(delta * WHEEL_SENSITIVITY), anchorRatio, 'wheel');
  };

  const finishPointerGesture = (event: PointerEvent): PointerGesture | undefined => {
    if (!pointerGesture || event.pointerId !== pointerGesture.pointerId) return undefined;
    const finished = pointerGesture;
    try {
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    pointerGesture = undefined;
    root.classList.remove('chronaxis-panning');
    return finished;
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || !scene) return;
    const position = plotPosition(event);
    if (!position) return;
    const bounds = root.getBoundingClientRect();
    const localY = event.clientY - bounds.top - position.scene.rulerHeight;
    if (localY < 0 || localY > position.scene.plotHeight) return;
    const itemId = itemIdFromTarget(event.target);
    if (!state.panEnabled && !itemId) return;
    pointerGesture = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startRange: { ...state.range },
      plotWidth: position.scene.plotWidth,
      itemId,
      active: false,
    };
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an enhancement; window-level pointer delivery may still continue.
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!pointerGesture || event.pointerId !== pointerGesture.pointerId) return;
    const deltaX = event.clientX - pointerGesture.startClientX;
    if (!pointerGesture.active) {
      if (Math.abs(deltaX) < PAN_THRESHOLD) return;
      pointerGesture.active = true;
      if (state.panEnabled) root.classList.add('chronaxis-panning');
    }
    if (!state.panEnabled) return;
    event.preventDefault();
    updateRange(panRange(pointerGesture.startRange, deltaX / pointerGesture.plotWidth), 'pan');
  };

  const handlePointerUp = (event: PointerEvent) => {
    const finished = finishPointerGesture(event);
    if (finished && !finished.active && finished.itemId) activateItem(finished.itemId, 'pointer');
  };

  const handlePointerCancel = (event: PointerEvent) => {
    finishPointerGesture(event);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    const itemId = itemIdFromTarget(event.target);
    if (!itemId) return;
    event.preventDefault();
    activateItem(itemId, 'keyboard');
  };

  const removeInteractionListeners = () => {
    root.removeEventListener('wheel', handleWheel);
    root.removeEventListener('pointerdown', handlePointerDown);
    root.removeEventListener('pointermove', handlePointerMove);
    root.removeEventListener('pointerup', handlePointerUp);
    root.removeEventListener('pointercancel', handlePointerCancel);
    root.removeEventListener('keydown', handleKeyDown);
  };

  let observer: ResizeObserver | undefined;
  try {
    if (initialWidth > 1) renderScene(root, initialScene, {
      selectedItemId: null,
      rowsById: state.rowsById,
      itemsById: state.itemsById,
      renderItem: options.renderItem,
      renderRowLabel: options.renderRowLabel,
      formatTick: options.formatTick,
      getItemClassName: options.getItemClassName,
      getRowClassName: options.getRowClassName,
    });
    container.append(root);
    observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
    if (state.wheelZoom !== false) root.addEventListener('wheel', handleWheel, { passive: false });
    root.addEventListener('pointerdown', handlePointerDown);
    root.addEventListener('pointermove', handlePointerMove);
    root.addEventListener('pointerup', handlePointerUp);
    root.addEventListener('pointercancel', handlePointerCancel);
    root.addEventListener('keydown', handleKeyDown);
    if (state.panEnabled) root.classList.add('chronaxis-pannable');
  } catch (error) {
    destroyed = true;
    removeInteractionListeners();
    subscriptions.clear();
    observer?.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    root.remove();
    throw error;
  }

  return {
    setItems(items: readonly TimelineItem<T>[]) {
      if (destroyed) return;
      commitItems(prepareItems(items, state.rowsById));
    },
    setRows(rows: readonly TimelineRow[]) {
      if (destroyed) return;
      const prepared = prepareRows(rows);
      for (const item of state.items) {
        if (!prepared.rowsById.has(item.rowId)) {
          throw new Error(`Timeline item "${item.id}" references unknown row "${item.rowId}".`);
        }
      }
      commitRows(prepared);
    },
    setData(data: TimelineData<T>) {
      if (destroyed) return;
      commitData(prepareData(data));
    },
    setRange(range: TimeRangeInput) {
      if (destroyed) return;
      updateRange(normalizeRange(range), 'setRange');
    },
    getRange() {
      return { ...state.range };
    },
    fit() {
      if (destroyed) return;
      const next = fitRange(state.items, { minimumDuration: state.zoomLimits.minDuration });
      if (next) updateRange(next, 'fit');
    },
    zoomIn() {
      zoomBy(1 / IMPERATIVE_ZOOM_FACTOR, 0.5, 'zoomIn');
    },
    zoomOut() {
      zoomBy(IMPERATIVE_ZOOM_FACTOR, 0.5, 'zoomOut');
    },
    scrollTo(time: TimeInput, options?: ScrollToOptions) {
      if (destroyed) return;
      updateRange(alignTimeInRange(state.range, normalizeTime(time), options?.align), 'scrollTo');
    },
    selectItem(itemId: string) {
      selectItem(itemId, 'api');
    },
    clearSelection() {
      if (destroyed || state.selectedItemId === null) return;
      state.selectedItemId = null;
      scheduleRender();
      emit('selectionChange', Object.freeze({ selectedItem: null, source: 'api' }));
    },
    getSelectedItemId() {
      return state.selectedItemId;
    },
    on<K extends keyof TimelineEventMap<T>>(type: K, handler: (event: TimelineEventMap<T>[K]) => void) {
      if (destroyed) return () => {};
      let handlers = subscriptions.get(type);
      if (!handlers) {
        handlers = new Set();
        subscriptions.set(type, handlers);
      }
      const internalHandler = handler as (event: unknown) => void;
      handlers.add(internalHandler);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        handlers?.delete(internalHandler);
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (pointerGesture) {
        try {
          if (root.hasPointerCapture(pointerGesture.pointerId)) root.releasePointerCapture(pointerGesture.pointerId);
        } catch {
          // The browser may have already released capture.
        }
        pointerGesture = undefined;
      }
      pendingRangeSource = undefined;
      subscriptions.clear();
      removeInteractionListeners();
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      root.remove();
    },
  };
}
