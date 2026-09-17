# `@chronaxis/browser`

Accessible interactive DOM/SVG timelines powered by `@chronaxis/core`.

```ts
import { createTimeline } from '@chronaxis/browser';
import '@chronaxis/browser/styles.css';

const timeline = createTimeline(container, {
  range: { start: '2026-01-01', end: '2026-04-01' },
  rows: [{ id: 'delivery', label: 'Delivery' }],
  items: [{ id: 'build', rowId: 'delivery', start: '2026-01-05', end: '2026-02-20' }],
  overlap: { mode: 'stack' },
});
```

Overlap defaults to the backwards-compatible `overlay` mode. `stack` gives same-row concurrent items separate vertical lanes and expands rows automatically; use `laneGap` to override its 4px default. This is creation-time layout configuration.

Import `@chronaxis/browser/runtime` only when a CSS-free, Node-import-safe entry is required. Mounting requires a modern browser. See the [repository README](https://github.com/avalexandrov/chronaxis#readme) for API, styling, accessibility, and browser support details.
