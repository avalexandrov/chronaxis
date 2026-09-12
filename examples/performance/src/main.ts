import { createTimeline, type TimelineItem, type TimelineRow } from '@chronaxis/browser';
import { fitRange, layoutTimeline, normalizeItems, type TimeRange } from '@chronaxis/core';
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

function layoutDuration(data: BenchmarkData, range: TimeRange, width: number): number {
  return timed(() => layoutTimeline({
    range,
    rows: data.rows,
    items: normalizeItems(data.items),
    options: { width, rowLabelWidth: 140, rulerHeight: 42, defaultRowHeight: 48, itemHeight: 24 },
  })).duration;
}

async function runBenchmark(size: string, mode: string): Promise<Record<string, unknown>> {
  const scenario = scenarios[size] ?? scenarios.large!;
  const data = generateData(scenario);
  const replacement = generateData(scenario, 1);
  const host = document.querySelector<HTMLElement>('#timeline-host')!;
  host.replaceChildren();
  let callbackCount = 0;
  const rich = mode === 'rich';

  const construction = timed(() => createTimeline(host, {
    range: VIEWPORT,
    rows: data.rows,
    items: data.items,
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

  const width = host.clientWidth;
  const initialLayout = layoutDuration(data, VIEWPORT, width);
  const initialCallbacks = callbackCount;

  const pan: number[] = [];
  const panLayout: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const range = { start: VIEWPORT.start + index * DAY, end: VIEWPORT.end + index * DAY };
    panLayout.push(layoutDuration(data, range, width));
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

  const replacementLayout = layoutDuration(replacement, VIEWPORT, width);
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
    mode,
    rows: scenario.rows,
    totalItems: scenario.items,
    visibleItems: root.querySelectorAll('[data-chronaxis-item-id]').length,
    domNodes: root.querySelectorAll('*').length,
    initialConstructionMs: construction.duration,
    initialLayoutReferenceMs: initialLayout,
    initialCustomItemCallbacks: rich ? initialCallbacks : 0,
    panOperationMs: stats(pan),
    panLayoutReferenceMs: stats(panLayout),
    zoomOperationMs: stats(zoom),
    selectionOperationMs: stats(selection),
    resizeOperationMs: stats(resize),
    dataReplacementOperationMs: replacementDuration,
    dataReplacementLayoutReferenceMs: replacementLayout,
    dataReplacementCustomItemCallbacks: replacementCallbacks,
    fitReferenceMs: fitDuration,
  };
  timeline.destroy();
  return result;
}

const controls = document.querySelector<HTMLFormElement>('#controls')!;
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;

async function execute(size: string, mode: string): Promise<void> {
  status.textContent = `Running ${size} / ${mode}…`;
  document.body.dataset.benchmarkStatus = 'running';
  await nextFrame();
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
