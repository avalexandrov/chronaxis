import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type ReactElement,
  type RefAttributes,
} from 'react';
import {
  createTimeline,
  type ItemClassNameGetter,
  type ItemRenderer,
  type RangeChangeEvent,
  type RowClassNameGetter,
  type RowLabelRenderer,
  type SelectionChangeEvent,
  type ItemClickEvent,
  type OverlapOptions,
  type TickFormatter,
  type TimeRangeInput,
  type TimelineInstance,
  type TimelineInteractionOptions,
  type TimelineItem,
  type TimelineRow,
  type TimelineViewportOptions,
} from '@chronaxis/browser/runtime';

interface ReactiveCallbacks<T> {
  onRangeChange?: (event: RangeChangeEvent) => void;
  onItemClick?: (event: ItemClickEvent<T>) => void;
  onSelectionChange?: (event: SelectionChangeEvent<T>) => void;
  renderItem?: ItemRenderer<T>;
  renderRowLabel?: RowLabelRenderer;
  formatTick?: TickFormatter;
  getItemClassName?: ItemClassNameGetter<T>;
  getRowClassName?: RowClassNameGetter;
}

interface CreationProps {
  /** Initial viewport; changes after mount are intentionally ignored. */
  initialRange: TimeRangeInput;
  /** Creation-time viewport limits. */
  viewport?: TimelineViewportOptions;
  /** Creation-time interaction behavior. */
  interactions?: TimelineInteractionOptions;
  defaultRowHeight?: number;
  rulerHeight?: number;
  rowLabelWidth?: number;
  itemHeight?: number;
  minimumItemWidth?: number;
  /** Creation-time overlapping-item layout behavior. */
  overlap?: OverlapOptions;
}

/** Props for the React-owned timeline container. Rows, items, and callbacks are reactive. */
export type TimelineProps<T = unknown> = Omit<ComponentPropsWithoutRef<'div'>, 'children'>
  & CreationProps
  & ReactiveCallbacks<T>
  & {
    rows: readonly TimelineRow[];
    items: readonly TimelineItem<T>[];
  };

interface DataSync<T> {
  rows: readonly TimelineRow[];
  items: readonly TimelineItem<T>[];
  renderItem?: ItemRenderer<T>;
  renderRowLabel?: RowLabelRenderer;
  formatTick?: TickFormatter;
  getItemClassName?: ItemClassNameGetter<T>;
  getRowClassName?: RowClassNameGetter;
}

function TimelineInner<T>(
  props: TimelineProps<T>,
  forwardedRef: ForwardedRef<TimelineInstance<T>>,
): ReactElement {
  const {
    rows,
    items,
    initialRange,
    viewport,
    interactions,
    defaultRowHeight,
    rulerHeight,
    rowLabelWidth,
    itemHeight,
    minimumItemWidth,
    overlap,
    onRangeChange,
    onItemClick,
    onSelectionChange,
    renderItem,
    renderRowLabel,
    formatTick,
    getItemClassName,
    getRowClassName,
    ...containerProps
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<TimelineInstance<T> | null>(null);
  const latest = useRef<ReactiveCallbacks<T>>({});
  latest.current = {
    onRangeChange,
    onItemClick,
    onSelectionChange,
    renderItem,
    renderRowLabel,
    formatTick,
    getItemClassName,
    getRowClassName,
  };
  const lastSync = useRef<DataSync<T> | null>(null);

  useImperativeHandle(forwardedRef, () => instance as TimelineInstance<T>, [instance]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const timeline = createTimeline<T>(container, {
      range: initialRange,
      rows,
      items,
      viewport,
      interactions,
      defaultRowHeight,
      rulerHeight,
      rowLabelWidth,
      itemHeight,
      minimumItemWidth,
      overlap,
      renderItem: (item, context) => {
        const renderer = latest.current.renderItem;
        return renderer ? renderer(item, context) : item.label ?? '';
      },
      renderRowLabel: (row) => {
        const renderer = latest.current.renderRowLabel;
        return renderer ? renderer(row) : row.label;
      },
      formatTick: (context) => latest.current.formatTick?.(context) ?? context.defaultLabel,
      getItemClassName: (item) => latest.current.getItemClassName?.(item),
      getRowClassName: (row) => latest.current.getRowClassName?.(row),
    });
    const unsubscribers = [
      timeline.on('rangeChange', (event) => latest.current.onRangeChange?.(event)),
      timeline.on('itemClick', (event) => latest.current.onItemClick?.(event)),
      timeline.on('selectionChange', (event) => latest.current.onSelectionChange?.(event)),
    ];
    lastSync.current = {
      rows,
      items,
      renderItem,
      renderRowLabel,
      formatTick,
      getItemClassName,
      getRowClassName,
    };
    setInstance(timeline);

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      timeline.destroy();
      lastSync.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!instance) return;
    const previous = lastSync.current;
    const next: DataSync<T> = {
      rows,
      items,
      renderItem,
      renderRowLabel,
      formatTick,
      getItemClassName,
      getRowClassName,
    };
    if (previous
      && previous.rows === rows
      && previous.items === items
      && previous.renderItem === renderItem
      && previous.renderRowLabel === renderRowLabel
      && previous.formatTick === formatTick
      && previous.getItemClassName === getItemClassName
      && previous.getRowClassName === getRowClassName) return;
    instance.setData({ rows, items });
    lastSync.current = next;
  }, [
    instance,
    rows,
    items,
    renderItem,
    renderRowLabel,
    formatTick,
    getItemClassName,
    getRowClassName,
  ]);

  return <div {...containerProps} ref={containerRef} />;
}

type TimelineComponent = <T = unknown>(
  props: TimelineProps<T> & RefAttributes<TimelineInstance<T>>,
) => ReactElement;

/**
 * Thin React adapter over `createTimeline`. Viewport interaction stays in Chronaxis;
 * the forwarded ref exposes the existing `TimelineInstance<T>` directly.
 */
export const Timeline = forwardRef(TimelineInner) as TimelineComponent;
(Timeline as TimelineComponent & { displayName?: string }).displayName = 'Timeline';
