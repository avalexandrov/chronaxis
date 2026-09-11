# Chronaxis

Framework-agnostic timelines for the web.

This repository contains the interactive timeline MVP:

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
timeline.selectItem('timeline');

const unsubscribe = timeline.on('selectionChange', ({ selectedItem, source }) => {
  console.log(selectedItem?.id ?? null, source);
});

console.log(timeline.getRange()); // normalized numeric timestamps
console.log(timeline.getSelectedItemId());
unsubscribe();
timeline.destroy();
```

The browser instance supports `setRange()`, `getRange()`, `fit()`, `zoomIn()`,
`zoomOut()`, `scrollTo()`, `selectItem()`, `clearSelection()`,
`getSelectedItemId()`, `on()`, and `destroy()`. Selection is zero-or-one and is
retained even while the selected item is outside the visible range. Selecting an
unknown ID throws a validation error.

The typed event surface contains `rangeChange`, `selectionChange`, and
`itemClick`. Item events carry a read-only, normalized public item snapshot while
preserving the timeline's generic data type. Selection changes identify whether
they came from `pointer`, `keyboard`, or `api`; range changes identify the
viewport operation that produced them. `itemClick` is an activation event and is
emitted even when the activated item was already selected.

Range mutations are applied to owned runtime state immediately, so `getRange()`
always returns the latest value. Rendering and `rangeChange` are coalesced into
animation frames: synchronous mutations produce one notification after the
corresponding render, containing the latest range and source. Unchanged state
does not emit an event. Selection events are emitted synchronously.

Items are focusable buttons with label-based accessible names, visible focus,
and selected state exposed through `aria-pressed` and `data-selected`. Pointer
movement below the four-pixel pan threshold activates an item; movement at or
beyond it pans without activation. Enter and Space activate focused items. When
a render rebuilds the scene, focus is restored only if a Chronaxis item owned it
and that item remains visible.

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
IDs, duplicate item IDs, unknown item rows, and items whose end precedes their
start throw an error.

After `destroy()`, mutating methods and new subscriptions are safe no-ops, old
unsubscribe functions remain harmless, and no events are emitted. Snapshot
getters continue to return the final range and selected item ID.
