import type { TimelineScene } from '@chronaxis/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface RenderOptions {
  selectedItemId: string | null;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function findItem(root: HTMLElement, itemId: string): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('[data-chronaxis-item-id]')]
    .find((item) => item.dataset.chronaxisItemId === itemId);
}

export function renderScene(root: HTMLElement, scene: TimelineScene, options: RenderOptions): void {
  const activeElement = root.ownerDocument.activeElement;
  const focusedItemId = activeElement instanceof HTMLElement && root.contains(activeElement)
    ? activeElement.closest<HTMLElement>('[data-chronaxis-item-id]')?.dataset.chronaxisItemId
    : undefined;
  const fragment = document.createDocumentFragment();
  root.replaceChildren();
  root.style.height = `${scene.height}px`;
  root.style.setProperty('--chronaxis-label-width', `${scene.rowLabelWidth}px`);

  const ruler = element('div', 'chronaxis-ruler');
  ruler.style.height = `${scene.rulerHeight}px`;
  const corner = element('div', 'chronaxis-ruler-corner');
  corner.style.width = `${scene.rowLabelWidth}px`;
  corner.textContent = 'Timeline';
  ruler.append(corner);
  const tickLayer = element('div', 'chronaxis-ruler-ticks');
  tickLayer.style.cssText = `left:${scene.plotX}px;width:${scene.plotWidth}px;height:${scene.rulerHeight}px`;
  for (const tick of scene.ticks) {
    const label = element('div', 'chronaxis-tick-label');
    label.style.left = `${tick.x}px`;
    label.textContent = tick.label;
    tickLayer.append(label);
  }
  ruler.append(tickLayer);
  fragment.append(ruler);

  const body = element('div', 'chronaxis-body');
  body.style.cssText = `top:${scene.rulerHeight}px;height:${scene.plotHeight}px`;
  for (const row of scene.rows) {
    const rowNode = element('div', 'chronaxis-row');
    rowNode.style.cssText = `top:${row.y}px;height:${row.height}px`;
    const label = element('div', 'chronaxis-row-label');
    label.style.width = `${scene.rowLabelWidth}px`;
    label.textContent = row.label;
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

  const plot = element('div', 'chronaxis-items');
  plot.style.cssText = `left:${scene.plotX}px;top:${scene.rulerHeight}px;width:${scene.plotWidth}px;height:${scene.plotHeight}px`;
  for (const item of scene.items) {
    const node = element('div', 'chronaxis-item');
    node.style.cssText = `left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px`;
    node.textContent = item.label ?? '';
    node.title = item.label ?? item.id;
    node.dataset.chronaxisItemId = item.id;
    node.dataset.rowId = item.rowId;
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', item.label ?? item.id);
    const selected = item.id === options.selectedItemId;
    node.setAttribute('aria-pressed', String(selected));
    if (selected) {
      node.dataset.selected = 'true';
      node.classList.add('chronaxis-item--selected');
    }
    if (item.clippedStart) node.classList.add('chronaxis-item-clipped-start');
    if (item.clippedEnd) node.classList.add('chronaxis-item-clipped-end');
    plot.append(node);
  }
  fragment.append(plot);
  root.append(fragment);
  if (focusedItemId) findItem(root, focusedItemId)?.focus();
}
