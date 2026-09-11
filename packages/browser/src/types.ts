import type { LayoutOptions, TimeInput, TimeRange, TimeRangeInput, TimelineItem, TimelineRow } from '@chronaxis/core';

export type WheelZoomMode = 'modifier' | 'always' | false;
export type ScrollAlignment = 'start' | 'center' | 'end';

export interface TimelineViewportOptions {
  minZoomDuration?: number;
  maxZoomDuration?: number;
}

export interface TimelineInteractionOptions {
  pan?: boolean;
  wheelZoom?: WheelZoomMode;
}

export interface ScrollToOptions {
  align?: ScrollAlignment;
}

export interface TimelineOptions<T = unknown> extends Omit<LayoutOptions, 'width'> {
  range: TimeRangeInput;
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
  viewport?: TimelineViewportOptions;
  interactions?: TimelineInteractionOptions;
}

export interface TimelineInstance<T = unknown> {
  setRange(range: TimeRangeInput): void;
  getRange(): TimeRange;
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  scrollTo(time: TimeInput, options?: ScrollToOptions): void;
  destroy(): void;
}
