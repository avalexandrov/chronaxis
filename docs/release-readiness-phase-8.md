# Phase 8 release-readiness report

## Recommendation

Chronaxis was technically ready for an initial `0.x` release after one human blocker: choosing a license. That decision was subsequently resolved as MIT during the 0.1.0 release-candidate preparation. No packages were published during this phase.

Use one coordinated `0.1.0` version for `@chronaxis/core`, `@chronaxis/browser`, and `@chronaxis/react`. Update the exact internal workspace dependency versions together, publish in dependency order (core, browser, React), and verify the three final tarballs again before publishing.

## Public API and breaking cleanup

The complete pre-change export inventory and classification is in [api-audit-phase-8.md](api-audit-phase-8.md). The package boundaries are coherent:

```text
@chronaxis/core
      ↑
@chronaxis/browser
      ↑
@chronaxis/react
```

Core's normalized item and scene types are deliberate integration APIs for alternate renderers, not browser leakage. Browser renderer helpers, snapshot builders, validation internals, and benchmark helpers remain private. The only breaking cleanup was removing the accidentally exported React `TimelineComponent` helper alias; `Timeline` retains its generic callable type. Naming and option grouping were otherwise retained because no material usability defect justified churn.

The stable initial surface is the data model, normalization/layout/navigation operations, `createTimeline`, `TimelineInstance`, typed events, CSS entry point, and React `Timeline` component. The following should remain explicitly experimental during `0.x`: DOM customization callbacks, exact DOM/class structure beyond documented hooks, callback invocation counts, and the set of React creation-time configuration props. The documented event payloads and synchronous/frame-coalesced timing semantics are intentional contracts.

## Packaging and modules

All three packages are ESM-only and target Node 18 or later for import/tooling compatibility. CommonJS output was not added because there is no demonstrated requirement. Deliberate entry points are:

- `@chronaxis/core`
- `@chronaxis/browser` (loads base CSS; bundler/browser use)
- `@chronaxis/browser/runtime` (same runtime API without the CSS side effect)
- `@chronaxis/browser/styles.css`
- `@chronaxis/react`

Node successfully imports core, browser runtime, and React without `window`, `document`, `HTMLElement`, or `ResizeObserver`. Mounting remains browser-only. The default browser entry intentionally imports CSS and is not the Node-safe entry.

Generated declarations preserve generic item data, refer only to exported package paths, and expose no DOM types from core. Browser callback declarations deliberately use DOM `Node`; React declarations reference the CSS-free browser runtime. Source maps, declarations, JavaScript, and browser CSS are present. Internal emitted modules are inside the tarball because public entry chunks depend on them, but package `exports` prevents unsupported subpath imports.

Dry-run package results after a clean build:

| Package | Packed | Unpacked | Files |
| --- | ---: | ---: | ---: |
| `@chronaxis/core@0.0.0` | 10.9 kB | 44.7 kB | 30 |
| `@chronaxis/browser@0.0.0` | 18.8 kB | 82.0 kB | 27 |
| `@chronaxis/react@0.0.0` | 4.6 kB | 15.1 kB | 10 |

Each package now contains its own README. No accidental runtime dependency or obvious artifact bloat was found.

## Dependencies and compatibility

Core has no dependencies. Browser depends only on core. React depends only on browser and declares React `>=18.2.0 <20.0.0` as a peer; an unused direct core dependency was removed. Playwright and axe are root development dependencies only.

The normal unit and production-example suite uses React 19.3.0. A separate temporary consumer installed the packed packages with React 18.3.1 and passed mount, forwarded-ref, and unmount cleanup checks. This supports the declared React 18.2–19 policy without adding a permanent compatibility matrix.

Chronaxis targets modern evergreen Chromium, Firefox, and WebKit. It intentionally relies on `ResizeObserver`, Pointer Events, `requestAnimationFrame`, and `Intl.DateTimeFormat` and ships no legacy-browser polyfills.

## CSS and accessibility

The base CSS is exported explicitly, marked as a package side effect so bundlers retain it, and imported once by consumers. Library selectors are scoped to `.chronaxis`; there are no host-page `body`, element, or global universal selectors. All 17 documented custom properties use the `--chronaxis-` prefix, have defaults, and are visual rather than geometric.

Items retain button semantics, keyboard Enter/Space activation, accessible labels, `aria-pressed`, and visible focus. The SVG grid is decorative and `aria-hidden`. No animation is present, so no reduced-motion branch is necessary. Axe found low-contrast colors in the two demos; their palettes were corrected. The final full-page automated run found no serious or critical axe violations in any tested engine. This is evidence, not a claim of WCAG conformance; manual screen-reader evaluation remains appropriate after release.

## Tests, examples, and CI

The final verification set covers 116 unit tests and 12 real-browser tests. The Playwright smoke suite exercises mounting, item rendering, pointer pan/capture, modifier-wheel zoom/preventDefault, selection, Enter/Space, dynamic data, React Strict Mode, atomic replacement, and destroy/unmount behavior in all three engines. Vanilla, performance, and React production builds pass. The performance harness now uses public imports only and measures public operation-to-paint behavior plus public core layout references.

CI now runs install, unit tests, typechecking, all production builds, `git diff --check`, browser installation, and the Playwright/axe suite on pushes to `main` and pull requests. It does not publish or automate releases.

No lint configuration was added. Existing code style is consistent, strict TypeScript covers every package/example, and adding a linter now would create configuration and formatting churn without addressing an observed release defect. Linting can be adopted separately once project conventions are chosen.

`.gitignore` now covers build output, TypeScript build state, dependencies, coverage, Playwright reports/results, tarballs, logs, common editor files, and OS metadata. Intentional benchmark documentation remains tracked.

## Metadata and blockers

Package descriptions, keywords, repository directory metadata, homepage, issue tracker, file allowlists, exports, types, side effects, and Node engine policy are present. Repository URLs were derived from the configured Git remote rather than invented.

Licensing was the sole blocker identified in this audit and was subsequently resolved as MIT. The 0.1.0 release-candidate preparation also coordinates package versions and exact internal dependency versions. Normal npm account, access, and provenance checks remain release-time operations rather than architecture concerns.

## After the initial release

Publish a small `0.1.x` line, collect real consumer feedback, and prioritize documentation or correctness fixes over new adapters. In particular, observe whether consumers need framework-native custom item content, reactive React configuration, or stronger semantic grouping before designing those contracts. Do not stabilize such additions from speculation; use `0.x` feedback to refine them while preserving the validated core/browser/React hierarchy.
