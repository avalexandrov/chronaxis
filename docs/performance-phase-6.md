# Phase 6 performance report

This report records the reproducible Phase 6 browser-rendering benchmark. Measurements are indicative rather than test thresholds: browser timing varies by machine, thermal state, and background load.

## Method

- Production Vite build, measured in Chromium through `performance.now()` with forced style calculation.
- Deterministic synthetic data with mixed short and long items, overlaps, off-screen items, and stable row assignment.
- 24 samples each for pan, zoom, selection, resize, and fit operations.
- Core layout and DOM rendering are timed separately.
- `simple` uses default text rendering. `rich` uses a custom item renderer that creates nested elements.
- The harness lives in `examples/performance` and can be run with `npm run perf`. Add `?autorun=1&size=large&mode=rich` to run a case automatically.

## Baseline: full DOM rebuild

Times below are milliseconds. Interaction columns are median / p95.

| Scenario | Mode | Rows | Total / visible items | DOM nodes | Initial layout | Initial render | Pan render | Zoom render | Selection render | Resize render | Replacement render |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Small | simple | 10 | 100 / 4 | 60 | 0.5 | 0.3 | 0.2 / 0.3 | 0.2 / 0.3 | 0.2 / 0.2 | 0.2 / 0.3 | 0.2 |
| Medium | simple | 25 | 1,000 / 82 | 166 | 0.5 | 0.7 | 0.9 / 1.4 | 1.5 / 2.7 | 0.6 / 1.1 | 0.6 / 1.0 | 1.2 |
| Large | simple | 50 | 5,000 / 445 | 567 | 0.6 | 2.3 | 3.1 / 3.5 | 5.7 / 9.8 | 2.5 / 3.0 | 2.5 / 3.9 | 5.4 |
| Large | rich | 50 | 5,000 / 445 | 1,854 | 0.6 | 4.8 | 5.8 / 6.3 | 9.8 / 16.2 | 4.9 / 5.5 | 5.2 / 6.1 | 6.6 |
| Very large | rich | 100 | 10,000 / 881 | 3,682 | 1.1 | 10.1 | 11.9 / 13.6 | 19.2 / 28.1 | 11.0 / 12.1 | 10.9 / 18.4 | 11.6 |
| Row-heavy 500 | simple | 500 | 1,000 / 82 | 1,116 | 0.7 | 4.2 | 4.1 / 6.3 | 3.7 / 5.1 | 3.3 / 4.3 | 3.1 / 4.2 | 3.4 |
| Row-heavy 1,000 | simple | 1,000 | 2,000 / 174 | 2,208 | 0.6 | 5.7 | 7.4 / 9.2 | 7.6 / 10.5 | 6.6 / 9.2 | 7.9 / 9.3 | 8.2 |

The large rich case invokes 445 custom item callbacks per render; the very-large rich case invokes 881. Core layout remains close to or below 1 ms while DOM work grows with visible rows, visible items, and custom-content complexity. Existing horizontal culling is effective: the 10,000-item case renders 881 visible items, so DOM size follows visible rather than total item count.

The evidence supports keyed DOM reuse and callback reuse for unchanged row/item data. It does not support replacing the renderer, adding a public performance API, or adding row virtualization in this phase.

## Production bundle baseline

The performance example build emitted 26.80 kB JavaScript (8.01 kB gzip) and 4.21 kB CSS (1.39 kB gzip). Final bundle and post-change measurements are recorded below after implementation.

## Optimized results

The renderer now retains its structural layers and keyed row/item elements between frames. Geometry and selection state are patched in place; row/item content and class callbacks run only for new or changed data, and selection-sensitive item content runs only for the affected item. When most of a large visible item set changes at once, Chronaxis constructs the next scene detached and commits it atomically instead of performing hundreds of live-node content replacements.

All callback results are prepared before live DOM mutation, preserving the renderer's failure/recovery behavior. Retained state is private in a `WeakMap`; no public API or scene contract changed.

| Scenario | Mode | Initial render | Pan render | Zoom render | Selection render | Resize render | Replacement render |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small | simple | 0.4 | 0.2 / 0.3 | 0.2 / 0.2 | 0.1 / 0.2 | 0.1 / 0.2 | 0.2 |
| Medium | simple | 0.9 | 0.7 / 0.8 | 1.3 / 2.0 | 0.2 / 0.3 | 0.8 / 0.9 | 1.6 |
| Large | simple | 2.8 | 2.8 / 3.1 | 6.5 / 9.8 | 0.3 / 0.4 | 3.7 / 4.2 | 4.9 |
| Large | rich | 4.7 | 3.1 / 3.3 | 8.1 / 12.7 | 0.4 / 0.9 | 3.6 / 4.2 | 7.4 |
| Very large | rich | 9.9 | 6.3 / 7.0 | 15.4 / 25.1 | 0.4 / 1.2 | 7.4 / 7.7 | 15.7 |
| Row-heavy 500 | simple | 3.3 | 0.7 / 0.8 | 1.4 / 1.7 | 0.2 / 0.4 | 0.7 / 0.8 | 2.7 |
| Row-heavy 1,000 | simple | 7.3 | 1.3 / 1.5 | 2.5 / 3.5 | 0.3 / 0.4 | 1.3 / 1.6 | 9.5 |

The DOM node and visible-item counts are unchanged from baseline. The improvement comes from doing less work on stable nodes, not from changing what is rendered.

In the representative large rich viewport, core produced 16 ticks and 16 matching grid lines. Their retained optimization was intentionally deferred: item/row DOM and consumer callbacks were the measured cost center. The harness also reports layout-plus-render totals; one final production check of this case measured 3.9 ms median pan total and 7.6 ms median zoom total.

Notable median changes:

- Large rich pan: 5.8 ms to 3.1 ms (47% faster).
- Large rich selection: 4.9 ms to 0.4 ms (92% faster).
- Very-large rich pan: 11.9 ms to 6.3 ms (47% faster).
- Very-large rich selection: 11.0 ms to 0.4 ms (96% faster).
- 1,000-row pan: 7.4 ms to 1.3 ms (82% faster).
- 1,000-row resize: 7.9 ms to 1.3 ms (84% faster).

For the large rich case, pan callback count falls from 445 every frame to a median of 9 newly visible items. Zoom invokes a median of 101 because the benchmark deliberately changes the visible duration substantially. Resize invokes 0, and the mixed visible/off-screen selection sequence invokes 0 at median and at most 1 in a measured frame. The very-large rich case shows the same pattern: 19 median callbacks for pan instead of 881.

Cold rendering remains essentially flat in the representative rich cases (4.8 to 4.7 ms for large; 10.1 to 9.9 ms for very large). The one-sample public construction measurements are noisier and rose from 2.6 to 3.1 ms for large rich and 4.6 to 6.2 ms for very-large rich. Wholesale rich-content replacement also rose (6.6 to 7.4 ms and 11.6 to 15.7 ms respectively), because every visible custom result must still be regenerated. This is the principal tradeoff; the recurring pan, selection, and resize paths improve materially.

The row-heavy curve does not justify row virtualization yet. Even with 1,000 rows and 2,208 DOM descendants, retained rendering keeps median pan and resize near 1.3 ms. Horizontal item culling continues to make total item count much less important than the visible count and custom DOM complexity.

## Bundle impact

The final performance-example production build emits 33.04 kB JavaScript (9.10 kB gzip) and 4.21 kB CSS (1.39 kB gzip). Compared with the baseline, JavaScript increased by 6.24 kB raw and 1.09 kB gzip; CSS is unchanged. This comparison includes the expanded benchmark reporting fields as well as the renderer change.

## Decision

Phase 6 stops at keyed DOM reuse. The measurements do not justify Canvas, row virtualization, a framework adapter, or a public performance API. Timing values remain documentation evidence rather than assertions in automated tests.
