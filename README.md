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
timeline.setItems(nextItems);
timeline.setRows(nextRows);
timeline.setData({ rows: nextRows, items: nextItems });

const unsubscribe = timeline.on('selectionChange', ({ selectedItem, source }) => {
  console.log(selectedItem?.id ?? null, source);
});

console.log(timeline.getRange()); // normalized numeric timestamps
console.log(timeline.getSelectedItemId());
unsubscribe();
timeline.destroy();
```

## Customization

Customization is configured when the timeline is created through focused,
framework-independent DOM hooks:

```ts
const timeline = createTimeline<ProjectTask>(container, {
  range,
  rows,
  items,

  renderItem(item, { selected }) {
    const content = container.ownerDocument.createElement('strong');
    content.textContent = `${selected ? '● ' : ''}${item.label ?? item.id}`;
    return content;
  },

  renderRowLabel(row) {
    return `Team: ${row.label}`;
  },

  formatTick({ time, unit, defaultLabel }) {
    return unit === 'month' ? customMonthFormatter(time) : defaultLabel;
  },

  getItemClassName(item) {
    return item.data?.status === 'delayed' ? 'is-delayed' : undefined;
  },

  getRowClassName(row) {
    return `team-${row.id}`;
  },
});
```

`renderItem()` controls only the contents of the Chronaxis-owned item element;
geometry, identity, selection, focus, ARIA state, and activation remain owned by
Chronaxis. Strings are always rendered as text, while DOM `Node` values enable
rich presentational content. `renderRowLabel()` follows the same content-only
contract for the owned row-label wrapper. These are plain DOM hooks, not
framework component adapters, and nested interactive controls are not supported.

Rendering and class callbacks receive frozen public snapshots with the current
runtime data. They may run during any Chronaxis render, including navigation,
resize, selection, and data updates, so they should be presentation-only and
must not rely on invocation counts or perform side effects.

The default ruler continues to use core's UTC calendar boundaries and English
UTC labels. `formatTick()` changes presentation only and receives `time`,
`unit`, `step`, and `defaultLabel`; it does not change tick boundaries or imply a
timezone system.

The supported visual theme properties are:

```css
.my-timeline {
  --chronaxis-font-family: system-ui;
  --chronaxis-font-size: 13px;
  --chronaxis-background: #fff;
  --chronaxis-text-color: #172033;
  --chronaxis-muted-text-color: #5f6b7a;
  --chronaxis-border-color: #dbe3ed;
  --chronaxis-grid-color: #dfe6ee;
  --chronaxis-row-border-color: #dbe3ed;
  --chronaxis-row-alt-background: #f8fafc;
  --chronaxis-ruler-background: #f3f6fa;
  --chronaxis-ruler-border-color: #dbe3ed;
  --chronaxis-item-background: #5367e8;
  --chronaxis-item-text-color: #fff;
  --chronaxis-item-border-color: transparent;
  --chronaxis-item-border-radius: 5px;
  --chronaxis-item-selected-outline: 0 0 0 3px #fff, 0 0 0 6px #29378f;
  --chronaxis-focus-ring: 3px solid rgb(23 32 51 / 35%);
}
```

These properties are intentionally visual and do not alter layout geometry.
Stable styling hooks are `.chronaxis`, `.chronaxis-ruler`, `.chronaxis-grid`,
`.chronaxis-row`, `.chronaxis-row-label`, `.chronaxis-item`, and
`.chronaxis-item--selected`. Item and row identity are exposed through
`data-chronaxis-item-id` and `data-chronaxis-row-id`; consumer item data is never
serialized into the DOM.

The browser instance supports atomic runtime data replacement through
`setItems()`, `setRows()`, and `setData()`, in addition to `setRange()`,
`getRange()`, `fit()`, `zoomIn()`, `zoomOut()`, `scrollTo()`, `selectItem()`,
`clearSelection()`, `getSelectedItemId()`, `on()`, and `destroy()`.

`setItems()` validates against the current rows, while `setRows()` rejects rows
that would orphan current items. Use `setData()` when rows and items need to
change together. Each call validates and prepares the complete next state before
committing it, owns copies of the supplied row/item records, normalizes item
times once, preserves the viewport, and schedules rendering through the shared
animation-frame scheduler. Failed updates leave all runtime state unchanged.
Input item order remains DOM paint order for overlapping items.

Selection is zero-or-one and is retained even while the selected item is outside
the visible range. Selection follows a surviving item ID across metadata, date,
and row changes. Removing the selected item clears selection synchronously and
emits one `selectionChange` with source `data`. Selecting an unknown ID throws a
validation error. `fit()` always uses the latest committed items and remains an
explicit viewport operation.

The typed event surface contains `rangeChange`, `selectionChange`, and
`itemClick`. Item events carry a read-only, normalized public item snapshot while
preserving the timeline's generic data type. Selection changes identify whether
they came from `pointer`, `keyboard`, `api`, or `data`; range changes identify the
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

Time inputs are normalized once to millisecond timestamps whenever they enter
the browser runtime, including dynamic updates. Ordered arrays drive layout,
while internal row-ID sets and item-ID maps support validation and identity
lookup. The layout engine consumes only owned rows, normalized items, and numeric
ranges; container width is supplied separately as projection geometry.

Scene geometry for rows, items, ticks, and grid lines is plot-local. In that
coordinate space, `x = 0` is the left edge of the temporal plot and `y = 0` is
the top of the rows below the ruler.

Invalid inputs, non-positive ranges, non-positive scale widths, duplicate row
IDs, duplicate item IDs, unknown item rows, and items whose end precedes their
start throw an error.

After `destroy()`, all mutating methods, including data replacement, and new
subscriptions are safe no-ops, old unsubscribe functions remain harmless, and
no events are emitted. Snapshot getters continue to return the final range and
selected item ID.
