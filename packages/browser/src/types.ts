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

export type SelectionChangeSource = 'pointer' | 'keyboard' | 'api' | 'data';
export type RangeChangeSource = 'setRange' | 'fit' | 'zoomIn' | 'zoomOut' | 'scrollTo' | 'wheel' | 'pan';

export interface TimelineItemSnapshot<T = unknown> {
  readonly id: string;
  readonly rowId: string;
  readonly start: number;
  readonly end: number;
  readonly label?: string;
  readonly data?: T;
}

export interface RangeChangeEvent {
  readonly range: Readonly<TimeRange>;
  readonly source: RangeChangeSource;
}

export interface ItemClickEvent<T = unknown> {
  readonly item: TimelineItemSnapshot<T>;
}

export interface SelectionChangeEvent<T = unknown> {
  readonly selectedItem: TimelineItemSnapshot<T> | null;
  readonly source: SelectionChangeSource;
}

export interface TimelineEventMap<T = unknown> {
  rangeChange: RangeChangeEvent;
  itemClick: ItemClickEvent<T>;
  selectionChange: SelectionChangeEvent<T>;
}

export interface TimelineOptions<T = unknown> extends Omit<LayoutOptions, 'width'> {
  range: TimeRangeInput;
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
  viewport?: TimelineViewportOptions;
  interactions?: TimelineInteractionOptions;
}

export interface TimelineData<T = unknown> {
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
}

export interface TimelineInstance<T = unknown> {
  setItems(items: readonly TimelineItem<T>[]): void;
  setRows(rows: readonly TimelineRow[]): void;
  setData(data: TimelineData<T>): void;
  setRange(range: TimeRangeInput): void;
  getRange(): TimeRange;
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  scrollTo(time: TimeInput, options?: ScrollToOptions): void;
  selectItem(itemId: string): void;
  clearSelection(): void;
  getSelectedItemId(): string | null;
  on<K extends keyof TimelineEventMap<T>>(
    type: K,
    handler: (event: TimelineEventMap<T>[K]) => void,
  ): () => void;
  destroy(): void;
}
