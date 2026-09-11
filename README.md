# Chronaxis

Framework-agnostic timelines for the web.

This repository contains the interactive viewport-navigation MVP:

- `@chronaxis/core` — DOM-independent normalization, scales, range navigation, ticks, and layout
- `@chronaxis/browser` — mutable viewport state, browser interactions, lifecycle, and DOM/SVG rendering
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

timeline.zoomIn();
timeline.scrollTo('2026-03-01');
console.log(timeline.getRange()); // normalized numeric timestamps
timeline.destroy();
```

The browser instance supports `setRange()`, `getRange()`, `fit()`, `zoomIn()`,
`zoomOut()`, `scrollTo()`, and `destroy()`. Range mutations are applied to owned
runtime state immediately and visual updates are coalesced into animation frames.

Pointer dragging pans over the temporal plot. Wheel zoom defaults to Ctrl/Cmd +
wheel (and browser trackpad pinch events represented that way), so ordinary page
scrolling is not captured. Configure `interactions.wheelZoom` as `"always"` or
`false`, and disable dragging with `interactions.pan: false`.

Interactive zoom defaults to a five-minute minimum and a fixed 50-year maximum.
Configure these through `viewport.minZoomDuration` and
`viewport.maxZoomDuration`. Explicit `setRange()` and `fit()` results are not
constrained by those interactive limits. When an explicit range is already
outside a limit, zooming farther out is a no-op and the first zoom toward the
supported range returns to the nearest bound.

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
