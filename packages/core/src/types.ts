export type Timestamp = number;
/** A millisecond timestamp, Date, or date/time string accepted at API boundaries. */
export type TimeInput = number | Date | string;

/** A vertical lane in the timeline. */
export interface TimelineRow {
  id: string;
  label: string;
  height?: number;
}

/** Consumer item input; omitted `end` represents a point item. */
export interface TimelineItem<T = unknown> {
  id: string;
  rowId: string;
  start: TimeInput;
  end?: TimeInput;
  label?: string;
  data?: T;
}

/** Consumer-friendly viewport input. */
export interface TimeRangeInput {
  start: TimeInput;
  end: TimeInput;
}

/** Normalized millisecond viewport. */
export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
}

/** Item form after all time inputs have been normalized to milliseconds. */
export interface NormalizedTimelineItem<T = unknown> {
  id: string;
  rowId: string;
  start: Timestamp;
  end: Timestamp;
  label?: string;
  data?: T;
}

/** Numeric range and pixel width used for time projection. */
export interface TimeScale {
  range: TimeRange;
  width: number;
}

export type TickUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface TickInterval {
  unit: TickUnit;
  step: number;
  approximateMs: number;
}

/**
 * SceneRow, SceneItem, SceneTick, and SceneGridLine coordinates are plot-local:
 * x = 0 is the left edge of the temporal plot and y = 0 is below the ruler.
 */
export interface SceneRow {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneItem {
  id: string;
  rowId: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

export interface SceneTick {
  time: Timestamp;
  unit: TickUnit;
  step: number;
  label: string;
  x: number;
}

export interface SceneGridLine {
  time: Timestamp;
  x: number;
  y1: number;
  y2: number;
}

export interface TimelineScene {
  /** Total component dimensions, including the label gutter and ruler. */
  width: number;
  height: number;
  rulerHeight: number;
  rowLabelWidth: number;
  plotX: number;
  plotWidth: number;
  plotHeight: number;
  rows: SceneRow[];
  items: SceneItem[];
  ticks: SceneTick[];
  gridLines: SceneGridLine[];
}

/** Behavior for temporally overlapping items within one timeline row. */
export type OverlapMode = 'overlay' | 'stack';

/** Geometry options for overlap-aware item layout. */
export interface OverlapOptions {
  /** `overlay` preserves the legacy behavior; `stack` gives colliding items separate lanes. */
  mode?: OverlapMode;
  /** Vertical pixels between stacked item lanes. Defaults to 4 in stack mode. */
  laneGap?: number;
}

/** Geometry options for the pure layout engine. */
export interface LayoutOptions {
  width: number;
  defaultRowHeight?: number;
  rulerHeight?: number;
  rowLabelWidth?: number;
  itemHeight?: number;
  minimumItemWidth?: number;
  overlap?: OverlapOptions;
}
