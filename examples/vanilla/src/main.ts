import { createTimeline, type TimelineItem, type TimelineRow } from '@chronaxis/browser';
import '@chronaxis/browser/styles.css';
import './page.css';

const rows: TimelineRow[] = [
  { id: 'research', label: 'Research' },
  { id: 'design', label: 'Design', height: 64 },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'launch', label: 'Launch', height: 60 },
];

const items: TimelineItem[] = [
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

const container = document.querySelector<HTMLElement>('#timeline');
if (!container) throw new Error('Timeline container not found.');

const timeline = createTimeline(container, {
  range: { start: '2026-01-01T00:00:00Z', end: '2026-04-01T00:00:00Z' },
  rows,
  items,
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
});
