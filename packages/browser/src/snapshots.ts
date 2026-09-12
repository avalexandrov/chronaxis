import type { NormalizedTimelineItem, TimelineRow } from '@chronaxis/core';
import type { TimelineItemSnapshot, TimelineRowSnapshot } from './types.js';

export function itemSnapshot<T>(item: NormalizedTimelineItem<T>): TimelineItemSnapshot<T> {
  return Object.freeze({
    id: item.id,
    rowId: item.rowId,
    start: item.start,
    end: item.end,
    label: item.label,
    data: item.data,
  });
}

export function rowSnapshot(row: TimelineRow): TimelineRowSnapshot {
  return Object.freeze({
    id: row.id,
    label: row.label,
    height: row.height,
  });
}
