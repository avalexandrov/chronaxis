# Chronaxis

Framework-agnostic timelines for the web.

This repository contains the first static MVP:

- `@chronaxis/core` — DOM-independent normalization, scales, ticks, and layout
- `@chronaxis/browser` — lifecycle and DOM/SVG rendering
- `@chronaxis/vanilla-example` — a Vite-powered browser demo

## Development

```sh
npm install
npm test
npm run build
npm run dev
```

## Browser API

```ts
import { createTimeline } from '@chronaxis/browser';

const timeline = createTimeline(container, {
  range: { start: '2026-01-01', end: '2026-04-01' },
  rows,
  items,
});

timeline.destroy();
```

Time inputs are normalized once to millisecond timestamps when they enter the
browser runtime. The layout engine consumes only normalized items and numeric
ranges; container width is supplied separately as projection geometry.

Scene geometry for rows, items, ticks, and grid lines is plot-local. In that
coordinate space, `x = 0` is the left edge of the temporal plot and `y = 0` is
the top of the rows below the ruler.

Invalid inputs, non-positive ranges, non-positive scale widths, duplicate row
IDs, unknown item rows, and items whose end precedes their start throw an error.
The ruler currently supports intervals from one minute through five years;
Phase 2 should define zoom bounds if views outside that range are allowed.
