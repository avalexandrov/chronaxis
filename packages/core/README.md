# `@chronaxis/core`

DOM-independent timeline normalization, scale, ruler, layout, and viewport math.

```ts
import { layoutTimeline, normalizeItems } from '@chronaxis/core';

const scene = layoutTimeline({
  range: { start: 0, end: 100 },
  rows: [{ id: 'row', label: 'Row' }],
  items: normalizeItems([{ id: 'item', rowId: 'row', start: 10, end: 30 }]),
  options: { width: 800 },
});
```

The package is ESM-only, has no runtime dependencies, and does not reference browser or framework APIs. See the [repository README](https://github.com/avalexandrov/chronaxis#readme) for the complete package overview.
