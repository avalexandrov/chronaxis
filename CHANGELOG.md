# Changelog

All notable user-facing changes to Chronaxis are documented here.

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
