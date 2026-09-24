import type {
  ItemClassNameGetter, ItemClickEvent, ItemRenderer, OverlapOptions, RangeChangeEvent,
  RowClassNameGetter, RowLabelRenderer, SelectionChangeEvent, TickFormatter, TimeRangeInput,
  TimelineInstance, TimelineInteractionOptions, TimelineItem, TimelineRow, TimelineViewportOptions,
} from '@chronaxis/browser/runtime';

/** Rows, items, and DOM callbacks react to replacement; other options apply on mount. */
export interface TimelineProps<T = unknown> {
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
  initialRange: TimeRangeInput;
  viewport?: TimelineViewportOptions;
  interactions?: TimelineInteractionOptions;
  overlap?: OverlapOptions;
  defaultRowHeight?: number;
  rulerHeight?: number;
  rowLabelWidth?: number;
  itemHeight?: number;
  minimumItemWidth?: number;
  renderItem?: ItemRenderer<T>;
  renderRowLabel?: RowLabelRenderer;
  formatTick?: TickFormatter;
  getItemClassName?: ItemClassNameGetter<T>;
  getRowClassName?: RowClassNameGetter;
}

/** The component ref exposes the browser instance without duplicating its API. */
export interface ChronaxisVueHandle<T = unknown> {
  readonly instance: TimelineInstance<T> | null;
}

export interface TimelineEventListeners<T = unknown> {
  'onRange-change'?: (event: RangeChangeEvent) => void;
  'onItem-click'?: (event: ItemClickEvent<T>) => void;
  'onSelection-change'?: (event: SelectionChangeEvent<T>) => void;
}
