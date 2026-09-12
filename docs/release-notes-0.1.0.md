# Chronaxis 0.1.0

Chronaxis is a framework-agnostic TypeScript library for accessible, interactive web timelines. Version 0.1.0 is its initial public release.

## Packages

- `@chronaxis/core` provides DOM-independent time normalization, scale and ruler utilities, layout geometry, and viewport navigation.
- `@chronaxis/browser` renders core scenes with DOM/SVG and adds lifecycle, pointer and wheel interactions, keyboard activation, selection, dynamic data, and typed events.
- `@chronaxis/react` is a thin declarative adapter that owns one browser instance, reacts to data and callback changes, and exposes `TimelineInstance<T>` through a ref.

The dependency direction stays deliberately one-way: core → browser → React. Applications can use the engine directly, mount the browser renderer imperatively, or use the React component without changing the underlying model.

## Highlights

- `number`, `Date`, and string time inputs with normalized numeric output.
- Rows and generic items, horizontally culled into a DOM-independent scene.
- Pointer pan, Ctrl/Cmd-wheel zoom, fit, scroll, range control, and configurable interactive zoom limits.
- Single selection and typed `rangeChange`, `selectionChange`, and `itemClick` events.
- Validated `setItems`, `setRows`, and atomic `setData` updates that preserve the viewport.
- DOM content callbacks, stable CSS hooks, and namespaced visual custom properties.
- ESM-first packaging, generated declarations, explicit CSS import, and Node-safe runtime imports.

## Accessibility and browser support

Timeline items use button semantics, accessible names, `aria-pressed`, visible focus, and Enter/Space activation. Decorative grid markup is hidden from assistive technology. Automated axe and interaction smoke tests run in Chromium, Firefox, and WebKit. This testing does not constitute a formal WCAG conformance claim.

Chronaxis targets modern evergreen browsers and uses `ResizeObserver`, Pointer Events, `requestAnimationFrame`, and `Intl.DateTimeFormat` without bundled legacy polyfills.

## Scalability

Chronaxis horizontally culls off-screen items and reuses DOM nodes by stable item ID. The development harness covers datasets up to 10,000 items and 1,000 rows. Actual performance depends on visible content, custom renderer complexity, browser, and hardware; these dataset sizes are test coverage, not performance guarantees.

## Evolving areas

During the `0.x` series, APIs may evolve based on consumer feedback. DOM customization callbacks, exact renderer implementation and structure, and React creation-time configuration semantics should be considered experimental. The data model, core layout/navigation operations, browser instance, typed events, CSS entry point, and React component form the intended initial public surface.
