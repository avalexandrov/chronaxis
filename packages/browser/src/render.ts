import type { NormalizedTimelineItem, TimelineRow, TimelineScene } from '@chronaxis/core';
import { itemSnapshot, rowSnapshot } from './snapshots.js';
import type {
  ItemClassNameGetter,
  ItemRenderer,
  RowClassNameGetter,
  RowLabelRenderer,
  TickFormatter,
} from './types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
type RenderContent = Node | string | null;

export interface RenderOptions<T = unknown> {
  selectedItemId: string | null;
  rowsById: ReadonlyMap<string, TimelineRow>;
  itemsById: ReadonlyMap<string, NormalizedTimelineItem<T>>;
  renderItem?: ItemRenderer<T>;
  renderRowLabel?: RowLabelRenderer;
  formatTick?: TickFormatter;
  getItemClassName?: ItemClassNameGetter<T>;
  getRowClassName?: RowClassNameGetter;
}

interface RowNodeState {
  node: HTMLElement;
  label: HTMLElement;
  source: TimelineRow;
  consumerClasses: string[];
  geometry: string;
  labelWidth: string;
}

interface ItemNodeState<T> {
  node: HTMLElement;
  source: NormalizedTimelineItem<T>;
  selected: boolean;
  consumerClasses: string[];
  geometry: string;
  clippedStart: boolean;
  clippedEnd: boolean;
}

interface RenderState<T> {
  ruler: HTMLElement;
  corner: HTMLElement;
  tickLayer: HTMLElement;
  body: HTMLElement;
  grid: SVGSVGElement;
  plot: HTMLElement;
  rows: Map<string, RowNodeState>;
  items: Map<string, ItemNodeState<T>>;
  renderItem?: ItemRenderer<T>;
  renderRowLabel?: RowLabelRenderer;
  getItemClassName?: ItemClassNameGetter<T>;
  getRowClassName?: RowClassNameGetter;
}

interface PreparedRow {
  id: string;
  source: TimelineRow;
  content?: RenderContent;
  consumerClasses?: string[];
  refresh: boolean;
}

interface PreparedItem<T> {
  id: string;
  source: NormalizedTimelineItem<T>;
  selected: boolean;
  content?: RenderContent;
  consumerClasses?: string[];
  refreshContent: boolean;
  refreshClasses: boolean;
}

const states = new WeakMap<HTMLElement, RenderState<unknown>>();

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function classTokens(classNames: string | undefined): string[] {
  return classNames?.split(/\s+/).filter(Boolean) ?? [];
}

function replaceContent(node: HTMLElement, content: RenderContent): void {
  node.replaceChildren();
  if (content !== null) node.append(content);
}

function createState<T>(document: Document): RenderState<T> {
  const ruler = element(document, 'div', 'chronaxis-ruler');
  const corner = element(document, 'div', 'chronaxis-ruler-corner');
  corner.textContent = 'Timeline';
  const tickLayer = element(document, 'div', 'chronaxis-ruler-ticks');
  ruler.append(corner, tickLayer);
  const body = element(document, 'div', 'chronaxis-body');
  const grid = document.createElementNS(SVG_NS, 'svg');
  grid.classList.add('chronaxis-grid');
  grid.setAttribute('aria-hidden', 'true');
  const plot = element(document, 'div', 'chronaxis-items');
  return { ruler, corner, tickLayer, body, grid, plot, rows: new Map(), items: new Map() };
}

function isMounted(root: HTMLElement, state: RenderState<unknown>): boolean {
  return state.ruler.parentNode === root
    && state.body.parentNode === root
    && state.grid.parentNode === root
    && state.plot.parentNode === root;
}

function applyConsumerClasses(node: HTMLElement, previous: string[], next: string[]): void {
  if (previous.length > 0) node.classList.remove(...previous);
  if (next.length > 0) node.classList.add(...next);
}

export function renderScene<T>(root: HTMLElement, scene: TimelineScene, options: RenderOptions<T>): void {
  const document = root.ownerDocument;
  const stored = states.get(root) as RenderState<T> | undefined;
  const reusable = stored && isMounted(root, stored as RenderState<unknown>) ? stored : undefined;
  // Updating most of a large visible set costs more than constructing it detached.
  // Keep keyed nodes for interactive frames, but retain the proven atomic rebuild
  // path for wholesale item replacement.
  const changedItems = reusable && scene.items.length >= 100
    ? scene.items.reduce((count, item) => (
      reusable.items.get(item.id)?.source === options.itemsById.get(item.id) ? count : count + 1
    ), 0)
    : 0;
  const state = reusable && changedItems <= scene.items.length / 2 ? reusable : createState<T>(document);
  const activeElement = document.activeElement;
  const focusedItemId = activeElement instanceof HTMLElement && root.contains(activeElement)
    ? activeElement.closest<HTMLElement>('[data-chronaxis-item-id]')?.dataset.chronaxisItemId
    : undefined;

  // Resolve all consumer callbacks before changing the live tree. A failure leaves
  // both the DOM and retained renderer state at the last successfully rendered frame.
  const tickLabels = scene.ticks.map((tick) => options.formatTick?.(Object.freeze({
    time: tick.time,
    unit: tick.unit,
    step: tick.step,
    defaultLabel: tick.label,
  })) ?? tick.label);

  const rowRendererChanged = state.renderRowLabel !== options.renderRowLabel;
  const rowClassGetterChanged = state.getRowClassName !== options.getRowClassName;
  const preparedRows = scene.rows.map((row): PreparedRow => {
    const source = options.rowsById.get(row.id);
    if (!source) throw new Error(`Missing runtime row for scene row "${row.id}".`);
    const current = state.rows.get(row.id);
    const refresh = !current || current.source !== source || rowRendererChanged || rowClassGetterChanged;
    if (!refresh) return { id: row.id, source, refresh };
    const snapshot = rowSnapshot(source);
    return {
      id: row.id,
      source,
      refresh,
      content: options.renderRowLabel ? options.renderRowLabel(snapshot) : row.label,
      consumerClasses: classTokens(options.getRowClassName?.(snapshot)),
    };
  });

  const itemRendererChanged = state.renderItem !== options.renderItem;
  const itemClassGetterChanged = state.getItemClassName !== options.getItemClassName;
  const preparedItems = scene.items.map((item): PreparedItem<T> => {
    const source = options.itemsById.get(item.id);
    if (!source) throw new Error(`Missing runtime item for scene item "${item.id}".`);
    const current = state.items.get(item.id);
    const selected = item.id === options.selectedItemId;
    const sourceChanged = !current || current.source !== source;
    const refreshContent = sourceChanged || itemRendererChanged
      || Boolean(options.renderItem && current?.selected !== selected);
    const refreshClasses = sourceChanged || itemClassGetterChanged;
    if (!refreshContent && !refreshClasses) {
      return { id: item.id, source, selected, refreshContent, refreshClasses };
    }
    const snapshot = itemSnapshot(source);
    return {
      id: item.id,
      source,
      selected,
      refreshContent,
      refreshClasses,
      content: refreshContent
        ? options.renderItem
          ? options.renderItem(snapshot, Object.freeze({ selected }))
          : item.label ?? ''
        : undefined,
      consumerClasses: refreshClasses ? classTokens(options.getItemClassName?.(snapshot)) : undefined,
    };
  });

  state.ruler.style.height = `${scene.rulerHeight}px`;
  state.corner.style.width = `${scene.rowLabelWidth}px`;
  state.tickLayer.style.cssText = `left:${scene.plotX}px;width:${scene.plotWidth}px;height:${scene.rulerHeight}px`;
  const tickFragment = document.createDocumentFragment();
  scene.ticks.forEach((tick, index) => {
    const label = element(document, 'div', 'chronaxis-tick-label');
    label.style.left = `${tick.x}px`;
    label.textContent = tickLabels[index] ?? '';
    tickFragment.append(label);
  });
  state.tickLayer.replaceChildren(tickFragment);

  state.body.style.cssText = `top:${scene.rulerHeight}px;height:${scene.plotHeight}px`;
  const visibleRows = new Set(preparedRows.map((row) => row.id));
  for (const [id, current] of state.rows) {
    if (!visibleRows.has(id)) {
      current.node.remove();
      state.rows.delete(id);
    }
  }
  preparedRows.forEach((prepared, index) => {
    const row = scene.rows[index]!;
    let current = state.rows.get(prepared.id);
    if (!current) {
      const node = element(document, 'div', 'chronaxis-row');
      const label = element(document, 'div', 'chronaxis-row-label');
      node.dataset.chronaxisRowId = row.id;
      node.append(label);
      current = { node, label, source: prepared.source, consumerClasses: [], geometry: '', labelWidth: '' };
      state.rows.set(prepared.id, current);
    }
    const geometry = `top:${row.y}px;height:${row.height}px`;
    if (current.geometry !== geometry) {
      current.node.style.cssText = geometry;
      current.geometry = geometry;
    }
    const labelWidth = `${scene.rowLabelWidth}px`;
    if (current.labelWidth !== labelWidth) {
      current.label.style.width = labelWidth;
      current.labelWidth = labelWidth;
    }
    if (prepared.refresh) {
      applyConsumerClasses(current.node, current.consumerClasses, prepared.consumerClasses!);
      current.node.classList.add('chronaxis-row');
      replaceContent(current.label, prepared.content!);
      current.source = prepared.source;
      current.consumerClasses = prepared.consumerClasses!;
    }
    if (state.body.children[index] !== current.node) {
      state.body.insertBefore(current.node, state.body.children[index] ?? null);
    }
  });

  state.grid.style.cssText = `left:${scene.plotX}px;top:${scene.rulerHeight}px`;
  state.grid.setAttribute('width', String(scene.plotWidth));
  state.grid.setAttribute('height', String(scene.plotHeight));
  state.grid.setAttribute('viewBox', `0 0 ${scene.plotWidth} ${scene.plotHeight}`);
  const gridFragment = document.createDocumentFragment();
  for (const line of scene.gridLines) {
    const node = document.createElementNS(SVG_NS, 'line');
    node.setAttribute('x1', String(line.x));
    node.setAttribute('x2', String(line.x));
    node.setAttribute('y1', String(line.y1));
    node.setAttribute('y2', String(line.y2));
    gridFragment.append(node);
  }
  state.grid.replaceChildren(gridFragment);

  state.plot.style.cssText = `left:${scene.plotX}px;top:${scene.rulerHeight}px;width:${scene.plotWidth}px;height:${scene.plotHeight}px`;
  const visibleItems = new Set(preparedItems.map((item) => item.id));
  for (const [id, current] of state.items) {
    if (!visibleItems.has(id)) {
      current.node.remove();
      state.items.delete(id);
    }
  }
  preparedItems.forEach((prepared, index) => {
    const item = scene.items[index]!;
    let current = state.items.get(prepared.id);
    let created = false;
    if (!current) {
      const node = element(document, 'div', 'chronaxis-item');
      node.dataset.chronaxisItemId = item.id;
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      current = {
        node,
        source: prepared.source,
        selected: prepared.selected,
        consumerClasses: [],
        geometry: '',
        clippedStart: false,
        clippedEnd: false,
      };
      state.items.set(prepared.id, current);
      created = true;
    }
    const node = current.node;
    const geometry = `left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px`;
    if (current.geometry !== geometry) {
      node.style.cssText = geometry;
      current.geometry = geometry;
    }
    if (created || current.source !== prepared.source) {
      node.title = item.label ?? item.id;
      node.dataset.rowId = item.rowId;
      node.setAttribute('aria-label', item.label ?? item.id);
    }
    if (prepared.refreshClasses) {
      applyConsumerClasses(node, current.consumerClasses, prepared.consumerClasses!);
      current.consumerClasses = prepared.consumerClasses!;
      node.classList.add('chronaxis-item');
    }
    if (created || current.selected !== prepared.selected) {
      node.setAttribute('aria-pressed', String(prepared.selected));
      node.classList.toggle('chronaxis-item--selected', prepared.selected);
      if (prepared.selected) node.dataset.selected = 'true';
      else delete node.dataset.selected;
    }
    if (created || current.clippedStart !== item.clippedStart) {
      node.classList.toggle('chronaxis-item-clipped-start', item.clippedStart);
      current.clippedStart = item.clippedStart;
    }
    if (created || current.clippedEnd !== item.clippedEnd) {
      node.classList.toggle('chronaxis-item-clipped-end', item.clippedEnd);
      current.clippedEnd = item.clippedEnd;
    }
    if (prepared.refreshContent) replaceContent(node, prepared.content!);
    current.source = prepared.source;
    current.selected = prepared.selected;
    if (state.plot.children[index] !== node) {
      state.plot.insertBefore(node, state.plot.children[index] ?? null);
    }
  });

  state.renderItem = options.renderItem;
  state.renderRowLabel = options.renderRowLabel;
  state.getItemClassName = options.getItemClassName;
  state.getRowClassName = options.getRowClassName;
  root.style.height = `${scene.height}px`;
  root.style.setProperty('--chronaxis-label-width', `${scene.rowLabelWidth}px`);
  if (!stored || !isMounted(root, state as RenderState<unknown>)) {
    root.replaceChildren(state.ruler, state.body, state.grid, state.plot);
    states.set(root, state as RenderState<unknown>);
  }
  if (focusedItemId && !root.contains(document.activeElement)) state.items.get(focusedItemId)?.node.focus();
}
