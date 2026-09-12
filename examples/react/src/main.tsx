import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Timeline,
  type TimelineData,
  type TimelineInstance,
  type TimelineItem,
  type TimelineRow,
} from '@chronaxis/react';
import '@chronaxis/browser/styles.css';
import './page.css';

interface TaskData {
  owner: string;
  status: 'planned' | 'active' | 'done';
}

const initialRows: TimelineRow[] = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'release', label: 'Release' },
];

const initialItems: TimelineItem<TaskData>[] = [
  { id: 'research', rowId: 'discovery', start: '2026-01-06', end: '2026-01-22', label: 'Research', data: { owner: 'Mina', status: 'done' } },
  { id: 'design', rowId: 'discovery', start: '2026-01-19', end: '2026-02-09', label: 'Design', data: { owner: 'Alice', status: 'active' } },
  { id: 'engine', rowId: 'delivery', start: '2026-02-02', end: '2026-03-12', label: 'Engine', data: { owner: 'Noah', status: 'active' } },
  { id: 'qa', rowId: 'release', start: '2026-03-09', end: '2026-03-27', label: 'Release QA', data: { owner: 'Sofia', status: 'planned' } },
];

const updatedItems: TimelineItem<TaskData>[] = initialItems.map((item) => (
  item.id === 'engine'
    ? { ...item, end: '2026-03-20', label: 'Engine + integration', data: { owner: 'Noah', status: 'done' } }
    : item
));

const expandedData: TimelineData<TaskData> = {
  rows: [...initialRows, { id: 'adoption', label: 'Adoption' }],
  items: [
    ...updatedItems,
    { id: 'docs', rowId: 'adoption', start: '2026-03-18', end: '2026-04-10', label: 'Launch docs', data: { owner: 'Inez', status: 'planned' } },
  ],
};

const initialRange = { start: '2026-01-01', end: '2026-04-15' };

function App() {
  const timelineRef = useRef<TimelineInstance<TaskData>>(null);
  const [data, setData] = useState<TimelineData<TaskData>>({ rows: initialRows, items: initialItems });
  const [mounted, setMounted] = useState(true);
  const [events, setEvents] = useState<string[]>([]);
  const record = (message: string) => setEvents((current) => [message, ...current].slice(0, 6));

  return (
    <main>
      <p className="eyebrow">Thin framework adapter, full Chronaxis engine</p>
      <h1>Chronaxis — React Adapter</h1>
      <p className="intro">
        Rows and items come from React state. Viewport interaction stays inside Chronaxis.
      </p>

      <div className="toolbar" aria-label="Timeline controls">
        <button type="button" onClick={() => timelineRef.current?.zoomIn()}>Zoom in</button>
        <button type="button" onClick={() => timelineRef.current?.zoomOut()}>Zoom out</button>
        <button type="button" onClick={() => timelineRef.current?.fit()}>Fit</button>
        <button type="button" onClick={() => timelineRef.current?.clearSelection()}>Clear selection</button>
        <button type="button" onClick={() => setData((current) => ({ ...current, items: updatedItems }))}>Update items</button>
        <button type="button" onClick={() => setData(expandedData)}>Update rows + items</button>
        <button type="button" onClick={() => setData({ rows: initialRows, items: initialItems })}>Reset data</button>
        <button type="button" onClick={() => setMounted((value) => !value)}>{mounted ? 'Unmount' : 'Remount'}</button>
      </div>

      {mounted ? (
        <Timeline<TaskData>
          ref={timelineRef}
          className="react-timeline"
          aria-label="React project timeline"
          style={{ height: 390 }}
          rows={data.rows}
          items={data.items}
          initialRange={initialRange}
          interactions={{ pan: true, wheelZoom: 'modifier' }}
          getItemClassName={(item) => `status-${item.data?.status ?? 'planned'}`}
          renderItem={(item, context) => {
            const content = document.createElement('span');
            const title = document.createElement('strong');
            const owner = document.createElement('small');
            title.textContent = `${context.selected ? '● ' : ''}${item.label ?? item.id}`;
            owner.textContent = item.data?.owner ?? '';
            content.append(title, owner);
            return content;
          }}
          onRangeChange={(event) => record(`Range: ${event.source}`)}
          onItemClick={(event) => record(`Activated: ${event.item.label ?? event.item.id}`)}
          onSelectionChange={(event) => record(`Selected: ${event.selectedItem?.label ?? 'none'}`)}
        />
      ) : (
        <div className="unmounted">Timeline unmounted. Use Remount to create a fresh instance.</div>
      )}

      <section className="events" aria-labelledby="events-heading">
        <h2 id="events-heading">React callback events</h2>
        {events.length === 0 ? <p>No events yet.</p> : <ol>{events.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}</ol>}
      </section>
    </main>
  );
}

createRoot(document.querySelector('#root')!).render(<StrictMode><App /></StrictMode>);
