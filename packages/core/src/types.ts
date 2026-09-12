export type Timestamp = number;
export type TimeInput = number | Date | string;

export interface TimelineRow {
  id: string;
  label: string;
  height?: number;
}

export interface TimelineItem<T = unknown> {
  id: string;
  rowId: string;
  start: TimeInput;
  end?: TimeInput;
  label?: string;
  data?: T;
}

export interface TimeRangeInput {
  start: TimeInput;
  end: TimeInput;
}

export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
}

export interface NormalizedTimelineItem<T = unknown> {
  id: string;
  rowId: string;
  start: Timestamp;
  end: Timestamp;
  label?: string;
  data?: T;
}

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

export interface LayoutOptions {
  width: number;
  defaultRowHeight?: number;
  rulerHeight?: number;
  rowLabelWidth?: number;
  itemHeight?: number;
  minimumItemWidth?: number;
}
