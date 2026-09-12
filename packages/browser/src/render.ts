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

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function addClasses(node: Element, classNames: string | undefined): void {
  const tokens = classNames?.split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length > 0) node.classList.add(...tokens);
}

function appendContent(node: HTMLElement, content: Node | string | null): void {
  if (content !== null) node.append(content);
}

function findItem(root: HTMLElement, itemId: string): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('[data-chronaxis-item-id]')]
    .find((item) => item.dataset.chronaxisItemId === itemId);
}

export function renderScene<T>(root: HTMLElement, scene: TimelineScene, options: RenderOptions<T>): void {
  const document = root.ownerDocument;
  const activeElement = document.activeElement;
  const focusedItemId = activeElement instanceof HTMLElement && root.contains(activeElement)
    ? activeElement.closest<HTMLElement>('[data-chronaxis-item-id]')?.dataset.chronaxisItemId
    : undefined;
  const fragment = document.createDocumentFragment();

  const ruler = element(document, 'div', 'chronaxis-ruler');
  ruler.style.height = `${scene.rulerHeight}px`;
  const corner = element(document, 'div', 'chronaxis-ruler-corner');
  corner.style.width = `${scene.rowLabelWidth}px`;
  corner.textContent = 'Timeline';
  ruler.append(corner);
  const tickLayer = element(document, 'div', 'chronaxis-ruler-ticks');
  tickLayer.style.cssText = `left:${scene.plotX}px;width:${scene.plotWidth}px;height:${scene.rulerHeight}px`;
  for (const tick of scene.ticks) {
    const label = element(document, 'div', 'chronaxis-tick-label');
    label.style.left = `${tick.x}px`;
    label.textContent = options.formatTick?.(Object.freeze({
      time: tick.time,
      unit: tick.unit,
      step: tick.step,
      defaultLabel: tick.label,
    })) ?? tick.label;
    tickLayer.append(label);
  }
  ruler.append(tickLayer);
  fragment.append(ruler);

  const body = element(document, 'div', 'chronaxis-body');
  body.style.cssText = `top:${scene.rulerHeight}px;height:${scene.plotHeight}px`;
  for (const row of scene.rows) {
    const currentRow = options.rowsById.get(row.id);
    if (!currentRow) throw new Error(`Missing runtime row for scene row "${row.id}".`);
    const snapshot = rowSnapshot(currentRow);
    const rowNode = element(document, 'div', 'chronaxis-row');
    rowNode.style.cssText = `top:${row.y}px;height:${row.height}px`;
    rowNode.dataset.chronaxisRowId = row.id;
    addClasses(rowNode, options.getRowClassName?.(snapshot));
    const label = element(document, 'div', 'chronaxis-row-label');
    label.style.width = `${scene.rowLabelWidth}px`;
    appendContent(label, options.renderRowLabel ? options.renderRowLabel(snapshot) : row.label);
    rowNode.append(label);
    body.append(rowNode);
  }
  fragment.append(body);

  const grid = document.createElementNS(SVG_NS, 'svg');
  grid.classList.add('chronaxis-grid');
  grid.style.cssText = `left:${scene.plotX}px;top:${scene.rulerHeight}px`;
  grid.setAttribute('width', String(scene.plotWidth));
  grid.setAttribute('height', String(scene.plotHeight));
  grid.setAttribute('viewBox', `0 0 ${scene.plotWidth} ${scene.plotHeight}`);
  grid.setAttribute('aria-hidden', 'true');
  for (const line of scene.gridLines) {
    const node = document.createElementNS(SVG_NS, 'line');
    node.setAttribute('x1', String(line.x));
    node.setAttribute('x2', String(line.x));
    node.setAttribute('y1', String(line.y1));
    node.setAttribute('y2', String(line.y2));
    grid.append(node);
  }
  fragment.append(grid);

  const plot = element(document, 'div', 'chronaxis-items');
  plot.style.cssText = `left:${scene.plotX}px;top:${scene.rulerHeight}px;width:${scene.plotWidth}px;height:${scene.plotHeight}px`;
  for (const item of scene.items) {
    const currentItem = options.itemsById.get(item.id);
    if (!currentItem) throw new Error(`Missing runtime item for scene item "${item.id}".`);
    const snapshot = itemSnapshot(currentItem);
    const selected = item.id === options.selectedItemId;
    const node = element(document, 'div', 'chronaxis-item');
    node.style.cssText = `left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px`;
    node.title = item.label ?? item.id;
    node.dataset.chronaxisItemId = item.id;
    node.dataset.rowId = item.rowId;
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', item.label ?? item.id);
    node.setAttribute('aria-pressed', String(selected));
    if (selected) {
      node.dataset.selected = 'true';
      node.classList.add('chronaxis-item--selected');
    }
    if (item.clippedStart) node.classList.add('chronaxis-item-clipped-start');
    if (item.clippedEnd) node.classList.add('chronaxis-item-clipped-end');
    addClasses(node, options.getItemClassName?.(snapshot));
    appendContent(node, options.renderItem ? options.renderItem(snapshot, Object.freeze({ selected })) : item.label ?? '');
    plot.append(node);
  }
  fragment.append(plot);

  root.style.height = `${scene.height}px`;
  root.style.setProperty('--chronaxis-label-width', `${scene.rowLabelWidth}px`);
  root.replaceChildren(fragment);
  if (focusedItemId) findItem(root, focusedItemId)?.focus();
}
