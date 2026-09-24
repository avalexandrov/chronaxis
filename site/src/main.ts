import { createTimeline, type TimelineInstance, type TimelineItemSnapshot } from '@chronaxis/browser';
import '@chronaxis/browser/styles.css';
import './site.css';
import { examples, project, type Entry, type Example } from './data';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Site root missing');
const path = app.dataset.page ?? 'index.html';
const base = import.meta.env.BASE_URL;
const href = (path: string) => `${base}${path}`;
const repo = 'https://github.com/avalexandrov/chronaxis';
const source = (path: string) => `${repo}/blob/main/${path}`;
const packageDocs = (name: string) => source(`packages/${name}/README.md`);
const link = (path: string, label: string, className = '') => `<a class="${className}" href="${href(path)}">${label}</a>`;

function shell(content: string): void {
  app!.innerHTML = `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="container nav-inner">${link('', '<span class="brand-mark">◈</span> Chronaxis', 'brand')}<nav aria-label="Main navigation">${link('guide/vanilla/', 'Guide')}${link('examples/project-release/', 'Examples')}${link('performance/', 'Performance')}<a href="${repo}">GitHub ↗</a><a href="https://www.npmjs.com/package/@chronaxis/browser">npm ↗</a></nav></div></header><main id="main">${content}</main><footer class="footer"><div class="container"><strong>Chronaxis</strong><span>Framework-agnostic timelines for the web.</span><a href="${repo}">Source on GitHub ↗</a></div></footer>`;
}
function toolbar(id: string, update = false): string {
  return `<div class="toolbar" aria-label="Timeline controls" data-toolbar="${id}"><button type="button" data-action="fit">Fit</button><button type="button" data-action="zoom-in" aria-label="Zoom in">＋</button><button type="button" data-action="zoom-out" aria-label="Zoom out">−</button><button type="button" data-action="reset">Reset</button>${update ? '<button type="button" data-action="update">Simulate update</button>' : ''}</div>`;
}
function timeLabel(value: number, tick?: Example['tick']): string {
  return new Intl.DateTimeFormat('en-GB', tick === 'hours'
    ? { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(value);
}
function mountTimeline(example: Example, hostId: string, detailId?: string): TimelineInstance<Entry> {
  const host = document.getElementById(hostId);
  if (!host) throw new Error(`Missing ${hostId}`);
  let items = example.items;
  const timeline = createTimeline<Entry>(host, {
    rows: example.rows, items, range: example.range, overlap: { mode: 'stack' },
    rowLabelWidth: 134, itemHeight: 30, defaultRowHeight: 50,
    renderRowLabel(row) {
      const label = document.createElement('span');
      label.className = 'row-label';
      label.textContent = row.label;
      return label;
    },
    renderItem(item) {
      const content = document.createElement('span');
      content.className = 'item-content';
      const name = document.createElement('strong');
      name.textContent = item.label ?? item.id;
      const owner = document.createElement('small');
      owner.textContent = item.data?.owner ?? '';
      content.append(name, owner);
      return content;
    },
    getItemClassName(item) { return `status-${item.data?.status ?? 'planned'}`; },
    formatTick({ time, unit, defaultLabel }) {
      if (example.tick === 'hours' && (unit === 'minute' || unit === 'hour')) {
        return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }).format(time);
      }
      if (example.tick === 'years' && (unit === 'year' || unit === 'quarter')) {
        return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', year: 'numeric' }).format(time);
      }
      return defaultLabel;
    },
  });
  const detail = detailId && document.getElementById(detailId);
  const show = (item: TimelineItemSnapshot<Entry> | null) => {
    if (!detail) return;
    if (!item) { detail.textContent = 'Select an item to see its details.'; return; }
    const row = example.rows.find((row) => row.id === item.rowId)?.label ?? item.rowId;
    detail.replaceChildren();
    const title = document.createElement('strong'); title.textContent = item.label ?? item.id;
    const meta = document.createElement('span'); meta.textContent = `${row} · ${item.data?.owner ?? ''} · ${timeLabel(item.start, example.tick)} – ${timeLabel(item.end, example.tick)}`;
    detail.append(title, meta);
  };
  timeline.on('selectionChange', ({ selectedItem }) => show(selectedItem));
  document.querySelector(`[data-toolbar="${hostId}"]`)?.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (action === 'fit') timeline.fit();
    if (action === 'zoom-in') timeline.zoomIn();
    if (action === 'zoom-out') timeline.zoomOut();
    if (action === 'reset') timeline.setRange(example.range);
    if (action === 'update' && example.update) {
      items = items === example.items ? example.update(example.items) : example.items;
      timeline.setItems(items);
      const button = document.querySelector<HTMLButtonElement>(`[data-toolbar="${hostId}"] [data-action="update"]`);
      if (button) button.textContent = items === example.items ? 'Simulate update' : 'Restore plan';
      const selected = items.find((item) => item.id === timeline.getSelectedItemId());
      if (selected) show({ ...selected, start: Date.parse(String(selected.start)), end: Date.parse(String(selected.end)) } as TimelineItemSnapshot<Entry>);
    }
  });
  return timeline;
}
function card(example: Example): string {
  return `<a class="example-card" href="${href(`examples/${example.slug}/`)}"><span class="card-icon" aria-hidden="true">${{ 'project-release': '▥', deployment: '↗', booking: '▦', history: '◷' }[example.slug]}</span><span class="eyebrow">${example.eyebrow}</span><h3>${example.title}</h3><p>${example.description}</p><span class="card-link">Open live example →</span></a>`;
}
const snippets = {
  vanilla: `import { createTimeline } from '@chronaxis/browser';\nimport '@chronaxis/browser/styles.css';\n\ncreateTimeline(container, {\n  rows, items, range,\n  overlap: { mode: 'stack' },\n});`,
  react: `import { Timeline } from '@chronaxis/react';\nimport '@chronaxis/browser/styles.css';\n\n<Timeline\n  rows={rows}\n  items={items}\n  initialRange={range}\n  overlap={{ mode: 'stack' }}\n  style={{ height: 400 }}\n/>`,
  vue: `<script setup lang="ts">\nimport { Timeline } from '@chronaxis/vue';\nimport '@chronaxis/browser/styles.css';\n</script>\n\n<template>\n  <Timeline\n    :rows="rows"\n    :items="items"\n    :initial-range="range"\n    :overlap="{ mode: 'stack' }"\n    style="height: 400px"\n  />\n</template>`,
};
const install = {
  vanilla: 'npm install @chronaxis/browser',
  react: 'npm install @chronaxis/react @chronaxis/browser',
  vue: 'npm install @chronaxis/vue @chronaxis/browser vue',
};
const name = { vanilla: 'Vanilla TypeScript', react: 'React', vue: 'Vue' };
function code(text: string): string {
  const escaped = text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return `<pre><code>${escaped}</code></pre>`;
}
function guideLinks(): string {
  return `<div class="guide-links">${(['vanilla','react','vue'] as const).map((key) => link(`guide/${key}/`, name[key])).join('')}</div>`;
}
function quickStart(): string {
  return `<section class="section" id="guide"><div class="container"><div class="section-heading"><span class="eyebrow">Integrate</span><h2>Use Chronaxis your way</h2><p>One browser timeline, with thin adapters when your application needs them.</p></div><div class="quickstart"><div class="tab-list" role="tablist" aria-label="Framework code examples">${(['vanilla','react','vue'] as const).map((key, i) => `<button id="tab-${key}" role="tab" aria-controls="panel-${key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${key}">${name[key]}</button>`).join('')}</div>${(['vanilla','react','vue'] as const).map((key, i) => `<div id="panel-${key}" class="tab-panel" role="tabpanel" aria-labelledby="tab-${key}" ${i ? 'hidden' : ''}>${code(install[key])}${code(snippets[key])}<div class="panel-links">${link(`guide/${key}/`, `Read ${name[key]} guide →`)}<a href="${packageDocs(key === 'vanilla' ? 'browser' : key)}">Package API and README ↗</a>${link(`try/${key}/`, `Try ${name[key]} live ↗`)}</div></div>`).join('')}</div></div></section>`;
}
function initTabs(): void {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  function select(index: number): void {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      document.getElementById(`panel-${tab.dataset.tab}`)!.hidden = !active;
    });
    tabs[index]!.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); select((index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length); }
      if (event.key === 'Home') { event.preventDefault(); select(0); }
      if (event.key === 'End') { event.preventDefault(); select(tabs.length - 1); }
    });
  });
}
function home(): void {
  shell(`<section class="hero"><div class="container"><div class="hero-copy"><span class="eyebrow">TypeScript timeline engine</span><h1>Framework-agnostic timelines for the web.</h1><p>Interactive timelines in TypeScript with a framework-independent engine and thin browser, React, and Vue integrations.</p><div class="hero-actions">${link('guide/vanilla/', 'Get started', 'button primary')}${link('examples/project-release/', 'View examples', 'button secondary')}<a class="text-link" href="${repo}">GitHub ↗</a></div></div><div class="demo-frame"><div class="demo-heading"><div><span class="eyebrow">Live timeline · @chronaxis/browser</span><h2>Product launch plan</h2></div>${toolbar('hero-timeline')}</div><div id="hero-timeline" class="timeline-host hero-timeline" aria-label="Product launch timeline"></div><p class="instruction">Drag to pan · Ctrl/Cmd + wheel to zoom · Click an item to select</p><div id="hero-detail" class="selection-detail" aria-live="polite">Select an item to see its details.</div></div></div></section><section class="section contrast"><div class="container"><div class="section-heading"><span class="eyebrow">Why Chronaxis?</span><h2>One engine, several ways in.</h2></div><div class="feature-grid"><div><h3>Independent core</h3><p>Time, layout, lanes, and viewport math live in <code>@chronaxis/core</code>.</p></div><div><h3>Direct browser API</h3><p>Mount from TypeScript. Pan, zoom, select, update data, and handle typed events.</p></div><div><h3>Thin adapters</h3><p>React and Vue manage the same browser timeline instance.</p></div><div><h3>Designed for real data</h3><p>Overlap-aware stacking, horizontal culling, keyed DOM reuse, and keyboard interaction.</p></div></div></div></section>${quickStart()}<section class="section contrast" id="examples"><div class="container"><div class="section-heading"><span class="eyebrow">Use cases</span><h2>Built for more than project plans.</h2><p>Four live datasets show different time scales and row models.</p></div><div class="card-grid">${examples.map(card).join('')}</div></div></section><section class="section"><div class="container architecture"><div><span class="eyebrow">Architecture</span><h2>Framework choice stays at the edge.</h2><p>The core handles timeline math and layout. The browser package renders and owns interactions. React and Vue are thin adapters over that browser instance.</p></div><pre class="architecture-diagram" aria-label="Core powers browser, which powers React and Vue">@chronaxis/core\n       ↓\n@chronaxis/browser\n    ↙       ↘\n React     Vue</pre></div></section><section class="section contrast"><div class="container performance-teaser"><div><span class="eyebrow">Performance</span><h2>Measured with large timelines.</h2><p>The existing benchmark covers up to 10,000 items, 1,000 rows, rich custom content, and stack layout. Horizontal culling limits item DOM work to visible content; keyed DOM reuse reduces reconstruction.</p>${link('performance/', 'Read the performance summary →', 'text-link')}</div><div class="metric"><strong>10,000</strong><span>items in the largest measured dataset</span></div></div></section>`);
  mountTimeline({ ...project, rows: project.rows.filter((row) => row.id !== 'platform'), items: project.items.filter((item) => item.rowId !== 'platform') }, 'hero-timeline', 'hero-detail');
  initTabs();
}
function examplePage(example: Example): void {
  shell(`<section class="page-top"><div class="container"><a class="back" href="${href('')}#examples">← All examples</a><span class="eyebrow">${example.eyebrow}</span><h1>${example.title}</h1><p>${example.description}</p></div></section><section class="container example-body"><div class="example-layout"><div class="demo-frame"><div class="demo-heading"><div><span class="eyebrow">Live browser API example</span><h2>${example.title}</h2></div>${toolbar('example-timeline', Boolean(example.update))}</div><div id="example-timeline" class="timeline-host example-timeline example-timeline--${example.slug}" aria-label="${example.title} timeline"></div><p class="instruction">Drag to pan · Ctrl/Cmd + wheel to zoom · Click an item to select</p></div><aside class="example-aside"><span class="eyebrow">Selected item</span><div id="example-detail" class="selection-detail" aria-live="polite">Select an item to see its details.</div><h2>What this shows</h2><p>${example.lesson}</p><a href="${source('site/src/data.ts')}">View dataset source ↗</a><a href="${source('site/src/main.ts')}">View timeline source ↗</a></aside></div><div class="next-examples"><h2>Explore another time scale</h2><div class="mini-links">${examples.filter((item) => item !== example).map((item) => link(`examples/${item.slug}/`, `${item.title} →`)).join('')}</div></div></section>`);
  mountTimeline(example, 'example-timeline', 'example-detail');
}
function guidePage(key: keyof typeof snippets): void {
  shell(`<section class="page-top"><div class="container"><span class="eyebrow">Integration guide</span><h1>${name[key]}</h1><p>${key === 'vanilla' ? 'Use the imperative browser API directly from TypeScript or JavaScript.' : `Use the ${name[key]} adapter over the same browser timeline.`}</p></div></section><section class="container guide-body"><div class="guide-main"><h2>Install</h2>${code(install[key])}<h2>Mount a timeline</h2><p>Supply rows, items, a visible range, and optional overlap stacking. Give the host a useful height.</p>${code(snippets[key])}<p>Pan by dragging, zoom with Ctrl/Cmd + wheel, and select items by pointer or keyboard.</p><div class="panel-links"><a href="${packageDocs(key === 'vanilla' ? 'browser' : key)}">Read package API and README ↗</a><a href="${source(`examples/${key}/src/${key === 'vue' ? 'App.vue' : key === 'react' ? 'main.tsx' : 'main.ts'}`)}">View live example source ↗</a>${link(`try/${key}/`, `Try ${name[key]} live ↗`)}</div><h2>Compare integrations</h2>${guideLinks()}</div><aside class="guide-aside"><span class="eyebrow">Architecture</span><p><code>@chronaxis/core</code> handles time and layout. <code>@chronaxis/browser</code> handles DOM rendering and interaction. Framework adapters mount that instance.</p><a href="${packageDocs('core')}">Core package docs ↗</a></aside></section>`);
}
function performancePage(): void {
  shell(`<section class="page-top"><div class="container"><span class="eyebrow">Performance</span><h1>Measured, with context.</h1><p>Chronaxis has been profiled in production Vite builds with deterministic synthetic datasets and browser timing.</p></div></section><section class="container performance-body"><div class="stats"><div><strong>10,000</strong><span>items tested</span></div><div><strong>1,000</strong><span>rows tested</span></div><div><strong>881</strong><span>visible items in the 10,000-item moderate-overlap case</span></div></div><div class="prose"><h2>What the renderer does</h2><p>Horizontal culling creates item DOM for the visible time window. Keyed row and item nodes are reused as the viewport changes, while changed custom content is rebuilt only where needed. Stack layout has also been profiled across low, moderate, and heavy overlap.</p><p>In the report’s 10,000-item moderate-overlap rich-content case, both overlay and stack rendered 881 visible items. Median operation-to-paint pan times in that measured Chromium environment were 32.6 ms and 31.7 ms respectively. These are benchmark observations, not device-wide frame-rate guarantees.</p><p>Canvas rendering and row virtualization were not justified by the measured workloads. Performance still depends on visible content, custom DOM complexity, and the device.</p><a class="button primary" href="${source('docs/performance-phase-6.md')}">Read methodology and full results ↗</a><p><a href="${source('examples/performance/src/main.ts')}">View performance harness source ↗</a></p></div></section>`);
}
if (path === 'index.html') home();
else if (path.startsWith('examples/')) examplePage(examples.find((example) => path.includes(`/${example.slug}/`)) ?? project);
else if (path.startsWith('guide/')) guidePage((path.split('/')[1] as keyof typeof snippets) ?? 'vanilla');
else performancePage();
