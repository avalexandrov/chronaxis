# Changelog

All notable user-facing changes to Chronaxis are documented here.

## 0.3.0

### Added

- `@chronaxis/vue`, a thin Vue 3.5+ adapter over the existing browser engine, with typed events, an exposed `TimelineInstance`, and DOM customization callbacks.
- A Vue example demonstrating stack layout, navigation, selection, and dynamic item and atomic row/item updates.
- Vue adapter unit, type, Node import, and real-browser smoke coverage.

### Behavior

- Vue `rows` and `items` updates are reference based and synchronized through one `setData()` call. Nested in-place edits require replacing the collection.
- `initialRange`, viewport, interactions, overlap, and geometry options apply when the Vue component mounts. Browser instance methods control the range afterward.

### Packages

- Coordinated `0.3.0` versions for `@chronaxis/core`, `@chronaxis/browser`, `@chronaxis/react`, and `@chronaxis/vue`.

## 0.2.0

### Added

- Optional overlap-aware item layout through `overlap: { mode: 'overlay' | 'stack', laneGap? }`.
- Deterministic per-row lane assignment, automatic stacked-row growth, and lane placement that remains stable through pan and zoom.
- Overlay and stack comparison in the vanilla example, plus overlap-density and pathological single-row scenarios in the performance harness.

### Fixed

- Stack mode gives temporally overlapping same-row items separate native pointer hit targets, removing the ambiguity caused by visually overlaying bars.

### Compatibility

- `overlay` remains the default, preserving existing `0.1.x` geometry and DOM paint-order behavior unless applications opt into `stack`.

## 0.1.0

### Added

- Framework-independent timeline normalization, scales, UTC ruler generation, layout, and viewport navigation.
- Accessible DOM/SVG browser timeline with pointer pan, modifier-wheel zoom, keyboard activation, single selection, typed events, and imperative controls.
- Dynamic item, row, and atomic data replacement with validated IDs and row references.
- DOM content callbacks, styling hooks, and namespaced CSS custom properties.
- Thin React adapter with reactive data and callbacks, Strict Mode cleanup, and a forwarded browser-instance ref.

### Performance

- Horizontal item culling and keyed DOM reuse.
- Reproducible benchmark coverage for datasets up to 10,000 items and 1,000 rows; measurements are engineering evidence rather than runtime guarantees.

### Accessibility

- Button semantics, accessible names, selected-state exposure, visible focus, Enter/Space activation, and decorative-grid hiding.
- Real-browser axe smoke checks across Chromium, Firefox, and WebKit.

### Packages

- ESM-only `@chronaxis/core`, `@chronaxis/browser`, and `@chronaxis/react` packages.
- Explicit browser runtime and stylesheet exports, generated TypeScript declarations, and MIT licensing.
