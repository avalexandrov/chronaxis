import { createTimeline, type TimelineItem, type TimelineRow } from '@chronaxis/browser';
import '@chronaxis/browser/styles.css';
import './page.css';

const rows: readonly TimelineRow[] = [
  { id: 'research', label: 'Research' },
  { id: 'design', label: 'Design', height: 64 },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'launch', label: 'Launch', height: 60 },
];

const items: readonly TimelineItem[] = [
  { id: 'interviews', rowId: 'research', start: '2025-12-27', end: '2026-01-14', label: 'Customer interviews' },
  { id: 'landscape', rowId: 'research', start: '2026-01-10', end: '2026-01-28', label: 'Market landscape' },
  { id: 'flows', rowId: 'design', start: '2026-01-16', end: '2026-02-12', label: 'Core flows' },
  { id: 'system', rowId: 'design', start: '2026-02-02', end: '2026-02-26', label: 'Design system' },
  { id: 'shell', rowId: 'frontend', start: '2026-02-09', end: '2026-03-03', label: 'Application shell' },
  { id: 'timeline', rowId: 'frontend', start: '2026-02-23', end: '2026-04-06', label: 'Timeline UI' },
  { id: 'schema', rowId: 'backend', start: '2026-01-27', end: '2026-02-17', label: 'Data model' },
  { id: 'api', rowId: 'backend', start: '2026-02-12', end: '2026-03-18', label: 'Delivery API' },
  { id: 'beta', rowId: 'launch', start: '2026-03-23', end: '2026-03-23', label: 'Beta' },
  { id: 'rollout', rowId: 'launch', start: '2026-03-26', end: '2026-04-08', label: 'Rollout' },
];

const updatedItems: readonly TimelineItem[] = [
  { id: 'landscape', rowId: 'research', start: '2026-01-08', end: '2026-01-24', label: 'Landscape complete' },
  { id: 'flows', rowId: 'design', start: '2026-01-20', end: '2026-02-16', label: 'Validated flows' },
  { id: 'system', rowId: 'design', start: '2026-02-04', end: '2026-03-02', label: 'Design system v1' },
  { id: 'shell', rowId: 'frontend', start: '2026-02-12', end: '2026-03-08', label: 'Application shell' },
  { id: 'timeline', rowId: 'frontend', start: '2026-02-26', end: '2026-04-10', label: 'Interactive timeline' },
  { id: 'schema', rowId: 'backend', start: '2026-01-27', end: '2026-02-20', label: 'Data model' },
  { id: 'api', rowId: 'backend', start: '2026-02-16', end: '2026-03-22', label: 'Delivery API' },
  { id: 'qa', rowId: 'launch', start: '2026-03-10', end: '2026-03-27', label: 'Release QA' },
  { id: 'beta', rowId: 'launch', start: '2026-03-30', end: '2026-03-30', label: 'Beta' },
  { id: 'rollout', rowId: 'launch', start: '2026-04-01', end: '2026-04-14', label: 'Rollout' },
];

let currentRows = rows;
let currentItems = items;

const container = document.querySelector<HTMLElement>('#timeline');
if (!container) throw new Error('Timeline container not found.');

const timeline = createTimeline(container, {
  range: { start: '2026-01-01T00:00:00Z', end: '2026-04-01T00:00:00Z' },
  rows,
  items,
});

const eventLog = document.querySelector<HTMLOListElement>('#event-log');

function logEvent(name: string, detail: string): void {
  if (!eventLog) return;
  const entry = document.createElement('li');
  const timestamp = document.createElement('time');
  timestamp.dateTime = new Date().toISOString();
  timestamp.textContent = new Date().toLocaleTimeString();
  const message = document.createElement('span');
  message.textContent = `${name} — ${detail}`;
  entry.append(timestamp, message);
  eventLog.prepend(entry);
  while (eventLog.children.length > 12) eventLog.lastElementChild?.remove();
}

timeline.on('itemClick', ({ item }) => {
  logEvent('itemClick', `${item.label ?? item.id} (${item.id})`);
});

timeline.on('selectionChange', ({ selectedItem, source }) => {
  logEvent('selectionChange', `${selectedItem?.label ?? 'none'} via ${source}`);
});

timeline.on('rangeChange', ({ range, source }) => {
  const start = new Date(range.start).toISOString().slice(0, 10);
  const end = new Date(range.end).toISOString().slice(0, 10);
  logEvent('rangeChange', `${start} → ${end} via ${source}`);
});

document.querySelector('.demo-toolbar')?.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
  if (action === 'zoom-in') timeline.zoomIn();
  else if (action === 'zoom-out') timeline.zoomOut();
  else if (action === 'fit') timeline.fit();
  else if (action === 'launch') timeline.scrollTo('2026-03-23T00:00:00Z');
  else if (action === 'quarter') {
    timeline.setRange({ start: '2026-01-01T00:00:00Z', end: '2026-04-01T00:00:00Z' });
  }
  else if (action === 'clear-selection') timeline.clearSelection();
  else if (action === 'updated-schedule') {
    currentItems = updatedItems;
    timeline.setItems(currentItems);
  }
  else if (action === 'reorder-rows') {
    const order = ['launch', 'research', 'design', 'frontend', 'backend'];
    currentRows = [...currentRows].sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
    timeline.setRows(currentRows);
  }
  else if (action === 'remove-selected') {
    const selectedItemId = timeline.getSelectedItemId();
    if (selectedItemId) {
      currentItems = currentItems.filter((item) => item.id !== selectedItemId);
      timeline.setItems(currentItems);
    }
  }
  else if (action === 'restore-data') {
    currentRows = rows;
    currentItems = items;
    timeline.setData({ rows: currentRows, items: currentItems });
  }
});
