import type { LayoutOptions, TimeRangeInput, TimelineItem, TimelineRow } from '@chronaxis/core';

export interface TimelineOptions<T = unknown> extends Omit<LayoutOptions, 'width'> {
  range: TimeRangeInput;
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
}

export interface TimelineInstance<T = unknown> {
  destroy(): void;
}
