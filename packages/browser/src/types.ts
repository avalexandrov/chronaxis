import type { LayoutOptions, TickUnit, TimeInput, TimeRange, TimeRangeInput, TimelineItem, TimelineRow } from '@chronaxis/core';

export type WheelZoomMode = 'modifier' | 'always' | false;
export type ScrollAlignment = 'start' | 'center' | 'end';

/** Creation-time interactive zoom limits, expressed in milliseconds. */
export interface TimelineViewportOptions {
  minZoomDuration?: number;
  maxZoomDuration?: number;
}

/** Creation-time pointer and wheel behavior. */
export interface TimelineInteractionOptions {
  pan?: boolean;
  wheelZoom?: WheelZoomMode;
}

/** Options for positioning a time within the current viewport duration. */
export interface ScrollToOptions {
  align?: ScrollAlignment;
}

export type SelectionChangeSource = 'pointer' | 'keyboard' | 'api' | 'data';
export type RangeChangeSource = 'setRange' | 'fit' | 'zoomIn' | 'zoomOut' | 'scrollTo' | 'wheel' | 'pan';

/** Immutable normalized item data exposed to callbacks and events. */
export interface TimelineItemSnapshot<T = unknown> {
  readonly id: string;
  readonly rowId: string;
  readonly start: number;
  readonly end: number;
  readonly label?: string;
  readonly data?: T;
}

/** Immutable row data exposed to customization callbacks. */
export interface TimelineRowSnapshot {
  readonly id: string;
  readonly label: string;
  readonly height?: number;
}

/** Context supplied when Chronaxis requests item DOM content. */
export interface ItemRenderContext {
  readonly selected: boolean;
}

/** Metadata for a generated ruler tick. */
export interface TickFormatContext {
  readonly time: number;
  readonly unit: TickUnit;
  readonly step: number;
  readonly defaultLabel: string;
}

/** Produces contents for a Chronaxis-owned item wrapper. React elements are not supported. */
export type ItemRenderer<T = unknown> = (
  item: TimelineItemSnapshot<T>,
  context: ItemRenderContext,
) => Node | string | null;
/** Produces contents for a Chronaxis-owned row-label wrapper. */
export type RowLabelRenderer = (row: TimelineRowSnapshot) => Node | string | null;
/** Formats a ruler tick without changing its interval or position. */
export type TickFormatter = (context: TickFormatContext) => string;
/** Returns consumer CSS classes for an item wrapper. */
export type ItemClassNameGetter<T = unknown> = (item: TimelineItemSnapshot<T>) => string | undefined;
/** Returns consumer CSS classes for a row wrapper. */
export type RowClassNameGetter = (row: TimelineRowSnapshot) => string | undefined;

/** Emitted after a range-changing render; synchronous changes are frame-coalesced. */
export interface RangeChangeEvent {
  readonly range: Readonly<TimeRange>;
  readonly source: RangeChangeSource;
}

/** Emitted whenever an item is activated by pointer or keyboard. */
export interface ItemClickEvent<T = unknown> {
  readonly item: TimelineItemSnapshot<T>;
}

/** Emitted synchronously when the selected item changes. */
export interface SelectionChangeEvent<T = unknown> {
  readonly selectedItem: TimelineItemSnapshot<T> | null;
  readonly source: SelectionChangeSource;
}

/** Maps public event names to their payloads. */
export interface TimelineEventMap<T = unknown> {
  rangeChange: RangeChangeEvent;
  itemClick: ItemClickEvent<T>;
  selectionChange: SelectionChangeEvent<T>;
}

/** Creation options for the imperative browser timeline. */
export interface TimelineOptions<T = unknown> extends Omit<LayoutOptions, 'width'> {
  range: TimeRangeInput;
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
  viewport?: TimelineViewportOptions;
  interactions?: TimelineInteractionOptions;
  renderItem?: ItemRenderer<T>;
  renderRowLabel?: RowLabelRenderer;
  formatTick?: TickFormatter;
  getItemClassName?: ItemClassNameGetter<T>;
  getRowClassName?: RowClassNameGetter;
}

/** Atomic row and item replacement payload. */
export interface TimelineData<T = unknown> {
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
}

/** Imperative lifecycle, data, navigation, selection, and event API. */
export interface TimelineInstance<T = unknown> {
  /** Replaces items without changing the viewport. */
  setItems(items: readonly TimelineItem<T>[]): void;
  /** Replaces rows after validating that current items remain valid. */
  setRows(rows: readonly TimelineRow[]): void;
  /** Atomically replaces rows and items without changing the viewport. */
  setData(data: TimelineData<T>): void;
  /** Sets the viewport without changing data. */
  setRange(range: TimeRangeInput): void;
  /** Returns a copy of the current normalized viewport. */
  getRange(): TimeRange;
  /** Fits the viewport to all current items. */
  fit(): void;
  /** Narrows the viewport around its center. */
  zoomIn(): void;
  /** Widens the viewport around its center. */
  zoomOut(): void;
  /** Positions a time within the current viewport duration. */
  scrollTo(time: TimeInput, options?: ScrollToOptions): void;
  /** Selects a known item by ID. */
  selectItem(itemId: string): void;
  /** Clears the current selection. */
  clearSelection(): void;
  /** Returns the selected item ID, or null. */
  getSelectedItemId(): string | null;
  /** Subscribes to a typed public event and returns an unsubscribe function. */
  on<K extends keyof TimelineEventMap<T>>(
    type: K,
    handler: (event: TimelineEventMap<T>[K]) => void,
  ): () => void;
  /** Removes DOM, listeners, observers, scheduled work, and subscriptions. */
  destroy(): void;
}
