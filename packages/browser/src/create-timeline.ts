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
  TimelineRow,
  TimelineScene,
  ZoomLimits,
} from '@chronaxis/core';
import { renderScene } from './render.js';
import type { ScrollToOptions, TimelineInstance, TimelineOptions, WheelZoomMode } from './types.js';

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
  items: NormalizedTimelineItem<T>[];
  layoutOptions: Omit<LayoutOptions, 'width'>;
  zoomLimits: ZoomLimits;
  panEnabled: boolean;
  wheelZoom: WheelZoomMode;
}

interface PanGesture {
  pointerId: number;
  startClientX: number;
  startRange: TimeRange;
  plotWidth: number;
  active: boolean;
}

function positiveDuration(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive.`);
  return value;
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
  let panGesture: PanGesture | undefined;

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
    renderScene(root, nextScene);
    scene = nextScene;
  };

  const scheduleRender = () => {
    if (destroyed || frame !== undefined) return;
    frame = requestAnimationFrame(render);
  };

  const updateRange = (range: TimeRange) => {
    state.range = range;
    scheduleRender();
  };

  const zoomBy = (durationFactor: number, anchorRatio = 0.5) => {
    const next = zoomRange(state.range, durationFactor, anchorRatio, state.zoomLimits);
    if (next.start !== state.range.start || next.end !== state.range.end) updateRange(next);
  };

  const plotPosition = (event: MouseEvent): { localX: number; scene: TimelineScene } | null => {
    if (!scene) return null;
    const bounds = root.getBoundingClientRect();
    const localX = event.clientX - bounds.left - scene.plotX;
    if (!Number.isFinite(localX) || localX < 0 || localX > scene.plotWidth) return null;
    return { localX, scene };
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
    zoomBy(Math.exp(delta * WHEEL_SENSITIVITY), anchorRatio);
  };

  const finishPan = (event: PointerEvent) => {
    if (!panGesture || event.pointerId !== panGesture.pointerId) return;
    try {
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    panGesture = undefined;
    root.classList.remove('chronaxis-panning');
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (!state.panEnabled || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || !scene) return;
    const position = plotPosition(event);
    if (!position) return;
    const bounds = root.getBoundingClientRect();
    const localY = event.clientY - bounds.top - position.scene.rulerHeight;
    if (localY < 0 || localY > position.scene.plotHeight) return;
    panGesture = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startRange: { ...state.range },
      plotWidth: position.scene.plotWidth,
      active: false,
    };
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an enhancement; window-level pointer delivery may still continue.
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!panGesture || event.pointerId !== panGesture.pointerId) return;
    const deltaX = event.clientX - panGesture.startClientX;
    if (!panGesture.active) {
      if (Math.abs(deltaX) < PAN_THRESHOLD) return;
      panGesture.active = true;
      root.classList.add('chronaxis-panning');
    }
    event.preventDefault();
    updateRange(panRange(panGesture.startRange, deltaX / panGesture.plotWidth));
  };

  const handlePointerUp = (event: PointerEvent) => finishPan(event);
  const handlePointerCancel = (event: PointerEvent) => finishPan(event);

  const removeInteractionListeners = () => {
    root.removeEventListener('wheel', handleWheel);
    root.removeEventListener('pointerdown', handlePointerDown);
    root.removeEventListener('pointermove', handlePointerMove);
    root.removeEventListener('pointerup', handlePointerUp);
    root.removeEventListener('pointercancel', handlePointerCancel);
  };

  let observer: ResizeObserver | undefined;
  try {
    if (initialWidth > 1) renderScene(root, initialScene);
    container.append(root);
    observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
    if (state.wheelZoom !== false) root.addEventListener('wheel', handleWheel, { passive: false });
    if (state.panEnabled) {
      root.classList.add('chronaxis-pannable');
      root.addEventListener('pointerdown', handlePointerDown);
      root.addEventListener('pointermove', handlePointerMove);
      root.addEventListener('pointerup', handlePointerUp);
      root.addEventListener('pointercancel', handlePointerCancel);
    }
  } catch (error) {
    destroyed = true;
    removeInteractionListeners();
    observer?.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    root.remove();
    throw error;
  }

  return {
    setRange(range: TimeRangeInput) {
      const normalized = normalizeRange(range);
      updateRange(normalized);
    },
    getRange() {
      return { ...state.range };
    },
    fit() {
      const next = fitRange(state.items, { minimumDuration: state.zoomLimits.minDuration });
      if (next) updateRange(next);
    },
    zoomIn() {
      zoomBy(1 / IMPERATIVE_ZOOM_FACTOR);
    },
    zoomOut() {
      zoomBy(IMPERATIVE_ZOOM_FACTOR);
    },
    scrollTo(time: TimeInput, options?: ScrollToOptions) {
      const normalized = normalizeTime(time);
      updateRange(alignTimeInRange(state.range, normalized, options?.align));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (panGesture) {
        try {
          if (root.hasPointerCapture(panGesture.pointerId)) root.releasePointerCapture(panGesture.pointerId);
        } catch {
          // The browser may have already released capture.
        }
        panGesture = undefined;
      }
      removeInteractionListeners();
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      root.remove();
    },
  };
}
