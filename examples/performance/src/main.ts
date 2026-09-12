import { createTimeline, type TimelineItem, type TimelineRow } from '@chronaxis/browser';
import { fitRange, layoutTimeline, normalizeItems, type NormalizedTimelineItem, type TimeRange } from '@chronaxis/core';
import { renderScene, type RenderOptions } from '../../../packages/browser/src/render.js';
import '@chronaxis/browser/styles.css';
import './page.css';

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.UTC(2026, 0, 1);
const VIEWPORT: TimeRange = { start: BASE + 150 * DAY, end: BASE + 180 * DAY };
const SAMPLES = 24;

interface BenchmarkData {
  rows: TimelineRow[];
  items: TimelineItem<ItemData>[];
}

interface ItemData {
  owner: string;
  status: 'planned' | 'active' | 'done';
  revision: number;
}

interface Scenario {
  rows: number;
  items: number;
}

interface Stats {
  average: number;
  median: number;
  p95: number;
  max: number;
}

const scenarios: Record<string, Scenario> = {
  small: { rows: 10, items: 100 },
  medium: { rows: 25, items: 1_000 },
  large: { rows: 50, items: 5_000 },
  'very-large': { rows: 100, items: 10_000 },
  'rows-500': { rows: 500, items: 1_000 },
  'rows-1000': { rows: 1_000, items: 2_000 },
};

function generateData(scenario: Scenario, revision = 0): BenchmarkData {
  const rows = Array.from({ length: scenario.rows }, (_, index) => ({
    id: `row-${index}`,
    label: `Team ${index + 1}`,
    height: 44 + (index % 3) * 4,
  }));
  const items = Array.from({ length: scenario.items }, (_, index): TimelineItem<ItemData> => {
    const startDay = ((index * 7919 + revision * 37) % 540) - 90;
    const durationDays = index % 11 === 0 ? 75 : 1 + ((index * 13) % 18);
    return {
      id: `task-${index}`,
      rowId: rows[(index * 17) % rows.length]!.id,
      start: BASE + startDay * DAY,
      end: BASE + (startDay + durationDays) * DAY,
      label: `Task ${index + 1}`,
      data: {
        owner: `Owner ${(index * 7) % 23}`,
        status: (['planned', 'active', 'done'] as const)[index % 3]!,
        revision,
      },
    };
  });
  return { rows, items };
}

function stats(values: number[]): Stats {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (value: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0;
  return {
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1) ?? 0,
  };
}

function timed<T>(callback: () => T): { duration: number; value: T } {
  const start = performance.now();
  const value = callback();
  return { duration: performance.now() - start, value };
}

function prepare<T>(data: { rows: TimelineRow[]; items: TimelineItem<T>[] }) {
  const items = normalizeItems(data.items);
  return {
    rows: data.rows,
    items,
    rowsById: new Map(data.rows.map((row) => [row.id, row])),
    itemsById: new Map(items.map((item) => [item.id, item])),
  };
}

function forceStyle(root: HTMLElement): void {
  void root.offsetHeight;
}

function measureRender<T>(
  root: HTMLElement,
  range: TimeRange,
  width: number,
  prepared: ReturnType<typeof prepare<T>>,
  options: RenderOptions<T>,
): { layout: number; render: number; visible: number; callbacks: number; ticks: number; gridLines: number } {
  const layout = timed(() => layoutTimeline({
    range,
    rows: prepared.rows,
    items: prepared.items,
    options: { width, rowLabelWidth: 140, rulerHeight: 42, defaultRowHeight: 48, itemHeight: 24 },
  }));
  const callbacksBefore = callbackCount;
  const render = timed(() => {
    renderScene(root, layout.value, options);
    forceStyle(root);
  });
  return {
    layout: layout.duration,
    render: render.duration,
    visible: layout.value.items.length,
    callbacks: callbackCount - callbacksBefore,
    ticks: layout.value.ticks.length,
    gridLines: layout.value.gridLines.length,
  };
}

let callbackCount = 0;

async function runBenchmark(size: string, mode: string): Promise<Record<string, unknown>> {
  const scenario = scenarios[size] ?? scenarios.large!;
  const data = generateData(scenario);
  const replacement = generateData(scenario, 1);
  const prepared = prepare(data);
  const replacementPrepared = prepare(replacement);
  const host = document.querySelector<HTMLElement>('#timeline-host')!;
  host.replaceChildren();
  callbackCount = 0;
  const rich = mode === 'rich';
  const renderOptions: RenderOptions<ItemData> = {
    selectedItemId: null,
    rowsById: prepared.rowsById,
    itemsById: prepared.itemsById,
    renderItem: rich ? (item) => {
      callbackCount += 1;
      const content = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = item.label ?? item.id;
      const owner = document.createElement('small');
      owner.textContent = item.data?.owner ?? '';
      content.append(title, owner);
      return content;
    } : undefined,
  };
  const width = host.clientWidth;

  const warmRoot = document.createElement('div');
  warmRoot.className = 'chronaxis benchmark-root';
  host.append(warmRoot);
  measureRender(warmRoot, VIEWPORT, width, prepared, renderOptions);
  warmRoot.remove();

  const root = document.createElement('div');
  root.className = 'chronaxis benchmark-root';
  host.append(root);
  const initial = measureRender(root, VIEWPORT, width, prepared, renderOptions);

  const publicHost = document.createElement('div');
  publicHost.className = 'public-host';
  host.append(publicHost);
  const construction = timed(() => createTimeline(publicHost, {
    range: VIEWPORT,
    rows: data.rows,
    items: data.items,
    renderItem: renderOptions.renderItem,
  }));
  construction.value.destroy();
  publicHost.remove();

  const pan = Array.from({ length: SAMPLES }, (_, index) => measureRender(
    root,
    { start: VIEWPORT.start + index * DAY, end: VIEWPORT.end + index * DAY },
    width,
    prepared,
    { ...renderOptions, rowsById: prepared.rowsById, itemsById: prepared.itemsById },
  ));
  const zoom = Array.from({ length: SAMPLES }, (_, index) => {
    const duration = (10 + (index % 12) * 10) * DAY;
    const center = (VIEWPORT.start + VIEWPORT.end) / 2;
    return measureRender(
      root,
      { start: center - duration / 2, end: center + duration / 2 },
      width,
      prepared,
      { ...renderOptions, rowsById: prepared.rowsById, itemsById: prepared.itemsById },
    );
  });
  const selection = Array.from({ length: SAMPLES }, (_, index) => {
    const visibleId = `task-${(index * 7919) % scenario.items}`;
    return measureRender(
      root,
      VIEWPORT,
      width,
      prepared,
      { ...renderOptions, selectedItemId: visibleId, rowsById: prepared.rowsById, itemsById: prepared.itemsById },
    );
  });
  const resize = Array.from({ length: SAMPLES }, (_, index) => measureRender(
    root,
    VIEWPORT,
    720 + (index % 8) * 80,
    prepared,
    { ...renderOptions, rowsById: prepared.rowsById, itemsById: prepared.itemsById },
  ));
  const replacementResult = measureRender(
    root,
    VIEWPORT,
    width,
    replacementPrepared,
    { ...renderOptions, rowsById: replacementPrepared.rowsById, itemsById: replacementPrepared.itemsById },
  );
  const setDataPreparation = timed(() => prepare(replacement));
  const fit = Array.from({ length: SAMPLES }, () => timed(() => fitRange(prepared.items, {
    minimumDuration: 5 * 60 * 1000,
  })).duration);
  const nodeCount = root.querySelectorAll('*').length;

  return {
    build: import.meta.env.MODE,
    renderer: 'keyed-reuse',
    scenario: size,
    mode,
    rows: scenario.rows,
    totalItems: scenario.items,
    visibleItems: initial.visible,
    domNodes: nodeCount,
    tickCount: initial.ticks,
    gridLineCount: initial.gridLines,
    customRenderCallbacksPerRender: rich ? initial.callbacks : 0,
    initialConstructionMs: construction.duration,
    initialLayoutMs: initial.layout,
    initialRenderMs: initial.render,
    initialTotalMs: initial.layout + initial.render,
    panLayoutMs: stats(pan.map((sample) => sample.layout)),
    panRenderMs: stats(pan.map((sample) => sample.render)),
    panTotalMs: stats(pan.map((sample) => sample.layout + sample.render)),
    panCustomItemCallbacks: stats(pan.map((sample) => sample.callbacks)),
    zoomLayoutMs: stats(zoom.map((sample) => sample.layout)),
    zoomRenderMs: stats(zoom.map((sample) => sample.render)),
    zoomTotalMs: stats(zoom.map((sample) => sample.layout + sample.render)),
    zoomCustomItemCallbacks: stats(zoom.map((sample) => sample.callbacks)),
    selectionRenderMs: stats(selection.map((sample) => sample.render)),
    selectionTotalMs: stats(selection.map((sample) => sample.layout + sample.render)),
    selectionCustomItemCallbacks: stats(selection.map((sample) => sample.callbacks)),
    resizeLayoutMs: stats(resize.map((sample) => sample.layout)),
    resizeRenderMs: stats(resize.map((sample) => sample.render)),
    resizeTotalMs: stats(resize.map((sample) => sample.layout + sample.render)),
    resizeCustomItemCallbacks: stats(resize.map((sample) => sample.callbacks)),
    dataPreparationMs: setDataPreparation.duration,
    dataReplacementLayoutMs: replacementResult.layout,
    dataReplacementRenderMs: replacementResult.render,
    dataReplacementTotalMs: replacementResult.layout + replacementResult.render,
    dataReplacementCustomItemCallbacks: replacementResult.callbacks,
    fitMs: stats(fit),
  };
}

const controls = document.querySelector<HTMLFormElement>('#controls')!;
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;

async function execute(size: string, mode: string): Promise<void> {
  status.textContent = `Running ${size} / ${mode}…`;
  document.body.dataset.benchmarkStatus = 'running';
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  try {
    const result = await runBenchmark(size, mode);
    results.textContent = JSON.stringify(result, null, 2);
    document.body.dataset.benchmarkStatus = 'complete';
    status.textContent = 'Complete.';
  } catch (error) {
    document.body.dataset.benchmarkStatus = 'failed';
    status.textContent = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

controls.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(controls);
  void execute(String(data.get('size')), String(data.get('mode')));
});

const params = new URLSearchParams(location.search);
if (params.has('autorun')) {
  const size = params.get('size') ?? 'large';
  const mode = params.get('mode') ?? 'rich';
  (controls.elements.namedItem('size') as HTMLSelectElement).value = size;
  (controls.elements.namedItem('mode') as HTMLSelectElement).value = mode;
  void execute(size, mode);
}
