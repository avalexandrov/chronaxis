import { createTimeline, type TimelineItem, type TimelineRow } from '@chronaxis/browser';
import { fitRange, layoutTimeline, normalizeItems, type TimeRange } from '@chronaxis/core';
import '@chronaxis/browser/styles.css';
import './page.css';

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.UTC(2026, 0, 1);
const VIEWPORT: TimeRange = { start: BASE + 150 * DAY, end: BASE + 180 * DAY };
const SAMPLES = 24;
const STACK_LANE_GAP = 4;

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
  pathological?: boolean;
}

type OverlapDensity = 'low' | 'moderate' | 'heavy' | 'pathological';
type OverlapMode = 'overlay' | 'stack';
type LayoutSelection = OverlapMode | 'compare';

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
  pathological: { rows: 1, items: 1_000, pathological: true },
};

function intervalFor(index: number, density: OverlapDensity, revision: number): { startDay: number; durationDays: number } {
  if (density === 'pathological') return { startDay: 150 + revision, durationDays: 45 };
  if (density === 'low') {
    return {
      startDay: ((index * 7919 + revision * 37) % 540) - 90,
      durationDays: 1 + ((index * 13) % 3),
    };
  }
  if (density === 'heavy') {
    return {
      startDay: ((index * 173 + revision * 37) % 240) - 30,
      durationDays: 45 + ((index * 29) % 45),
    };
  }
  return {
    startDay: ((index * 7919 + revision * 37) % 540) - 90,
    durationDays: index % 11 === 0 ? 75 : 1 + ((index * 13) % 18),
  };
}

function generateData(scenario: Scenario, density: OverlapDensity, revision = 0): BenchmarkData {
  const rows = Array.from({ length: scenario.rows }, (_, index) => ({
    id: `row-${index}`,
    label: `Team ${index + 1}`,
    height: 44 + (index % 3) * 4,
  }));
  const items = Array.from({ length: scenario.items }, (_, index): TimelineItem<ItemData> => {
    const { startDay, durationDays } = intervalFor(index, density, revision);
    return {
      id: `task-${index}`,
      rowId: rows[scenario.pathological ? 0 : (index * 17) % rows.length]!.id,
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

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function measureOperation(root: HTMLElement, mutate: () => void): Promise<number> {
  const start = performance.now();
  mutate();
  await nextFrame();
  await nextFrame();
  void root.offsetHeight;
  return performance.now() - start;
}

function layoutDuration(
  data: BenchmarkData,
  normalizedItems: ReturnType<typeof normalizeItems<ItemData>>,
  range: TimeRange,
  width: number,
  overlapMode: OverlapMode,
): number {
  return timed(() => layoutTimeline({
    range,
    rows: data.rows,
    items: normalizedItems,
    options: {
      width,
      rowLabelWidth: 140,
      rulerHeight: 42,
      defaultRowHeight: 48,
      itemHeight: 24,
      overlap: overlapMode === 'stack' ? { mode: 'stack', laneGap: STACK_LANE_GAP } : { mode: 'overlay' },
    },
  })).duration;
}

async function runBenchmark(
  size: string,
  rendering: string,
  density: OverlapDensity,
  overlapMode: OverlapMode,
): Promise<Record<string, unknown>> {
  const scenario = scenarios[size] ?? scenarios.large!;
  const effectiveDensity = scenario.pathological ? 'pathological' : density;
  const data = generateData(scenario, effectiveDensity);
  const replacement = generateData(scenario, effectiveDensity, 1);
  const normalizedItems = normalizeItems(data.items);
  const normalizedReplacement = normalizeItems(replacement.items);
  const host = document.querySelector<HTMLElement>('#timeline-host')!;
  host.replaceChildren();
  let callbackCount = 0;
  const rich = rendering === 'rich';

  const construction = timed(() => createTimeline(host, {
    range: VIEWPORT,
    rows: data.rows,
    items: data.items,
    overlap: overlapMode === 'stack' ? { mode: 'stack', laneGap: STACK_LANE_GAP } : { mode: 'overlay' },
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
  }));
  const timeline = construction.value;
  const root = host.querySelector<HTMLElement>('.chronaxis')!;
  await nextFrame();
  void root.offsetHeight;
  const initialVisibleItems = root.querySelectorAll('[data-chronaxis-item-id]').length;
  const initialDomNodes = root.querySelectorAll('*').length;

  const width = host.clientWidth;
  const initialLayout = layoutDuration(data, normalizedItems, VIEWPORT, width, overlapMode);
  const initialCallbacks = callbackCount;

  const pan: number[] = [];
  const panLayout: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const range = { start: VIEWPORT.start + index * DAY, end: VIEWPORT.end + index * DAY };
    panLayout.push(layoutDuration(data, normalizedItems, range, width, overlapMode));
    pan.push(await measureOperation(root, () => timeline.setRange(range)));
  }

  timeline.setRange(VIEWPORT);
  await nextFrame();
  const zoom: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    zoom.push(await measureOperation(root, () => index % 2 === 0 ? timeline.zoomIn() : timeline.zoomOut()));
  }

  const selection: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    selection.push(await measureOperation(root, () => timeline.selectItem(`task-${(index * 7919) % scenario.items}`)));
  }

  const resize: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    resize.push(await measureOperation(root, () => {
      host.style.width = `${720 + (index % 8) * 80}px`;
    }));
  }
  host.style.width = '';

  const replacementLayout = layoutDuration(replacement, normalizedReplacement, VIEWPORT, width, overlapMode);
  const replacementCallbacksBefore = callbackCount;
  const replacementDuration = await measureOperation(root, () => timeline.setData(replacement));
  const replacementCallbacks = callbackCount - replacementCallbacksBefore;
  const fitDuration = timed(() => fitRange(normalizeItems(replacement.items), {
    minimumDuration: 5 * 60 * 1000,
  })).duration;

  const result = {
    build: import.meta.env.MODE,
    measurement: 'public-api-operation-to-paint',
    scenario: size,
    rendering,
    overlapDensity: effectiveDensity,
    overlapMode,
    laneGap: overlapMode === 'stack' ? STACK_LANE_GAP : 0,
    rows: scenario.rows,
    totalItems: scenario.items,
    visibleItems: initialVisibleItems,
    domNodes: initialDomNodes,
    initialConstructionMs: construction.duration,
    initialCoreLayoutMs: initialLayout,
    initialCustomItemCallbacks: rich ? initialCallbacks : 0,
    panOperationMs: stats(pan),
    panCoreLayoutMs: stats(panLayout),
    zoomOperationMs: stats(zoom),
    selectionOperationMs: stats(selection),
    resizeOperationMs: stats(resize),
    dataReplacementOperationMs: replacementDuration,
    dataReplacementCoreLayoutMs: replacementLayout,
    dataReplacementCustomItemCallbacks: replacementCallbacks,
    fitReferenceMs: fitDuration,
  };
  timeline.destroy();
  return result;
}

const controls = document.querySelector<HTMLFormElement>('#controls')!;
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;

async function execute(
  size: string,
  rendering: string,
  density: OverlapDensity,
  layout: LayoutSelection,
): Promise<void> {
  status.textContent = `Running ${size} / ${density} / ${layout}…`;
  document.body.dataset.benchmarkStatus = 'running';
  await nextFrame();
  try {
    const modes: OverlapMode[] = layout === 'compare' ? ['overlay', 'stack'] : [layout];
    const benchmarkResults = [];
    for (const overlapMode of modes) {
      benchmarkResults.push(await runBenchmark(size, rendering, density, overlapMode));
    }
    results.textContent = JSON.stringify({
      build: import.meta.env.MODE,
      measurement: {
        coreLayout: 'pure layoutTimeline with pre-normalized items',
        publicOperationToPaint: 'public API mutation through two animation frames and forced layout',
      },
      results: benchmarkResults,
    }, null, 2);
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
  void execute(
    String(data.get('size')),
    String(data.get('rendering')),
    String(data.get('density')) as OverlapDensity,
    String(data.get('layout')) as LayoutSelection,
  );
});

const params = new URLSearchParams(location.search);
if (params.has('autorun')) {
  const size = params.get('size') ?? 'large';
  const rendering = params.get('rendering') ?? params.get('mode') ?? 'rich';
  const density = (params.get('density') ?? 'moderate') as OverlapDensity;
  const layout = (params.get('layout') ?? 'compare') as LayoutSelection;
  (controls.elements.namedItem('size') as HTMLSelectElement).value = size;
  (controls.elements.namedItem('rendering') as HTMLSelectElement).value = rendering;
  (controls.elements.namedItem('density') as HTMLSelectElement).value = density;
  (controls.elements.namedItem('layout') as HTMLSelectElement).value = layout;
  void execute(size, rendering, density, layout);
}
