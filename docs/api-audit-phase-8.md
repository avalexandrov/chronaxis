# Phase 8 public API audit

This inventory was recorded before changing package exports during release hardening. “Integration” means deliberately public for renderer or adapter composition, even when most application users will not need it.

## `@chronaxis/core`

| Export | Classification | Rationale |
| --- | --- | --- |
| `Timestamp`, `TimeInput`, `TimeRangeInput`, `TimeRange` | Public API | Shared time input and normalized range vocabulary. |
| `TimelineRow`, `TimelineItem<T>` | Public API | Primary data model. |
| `NormalizedTimelineItem<T>` | Integration API | Numeric item form consumed by pure layout/navigation utilities. |
| `TimeScale` | Integration API | Input contract for the public scale functions. |
| `TickUnit`, `TickInterval` | Integration API | Public ruler calculation and formatting contracts. |
| `SceneRow`, `SceneItem`, `SceneTick`, `SceneGridLine`, `TimelineScene` | Integration API | Framework-independent scene output for alternate renderers. |
| `LayoutOptions`, `TimelineLayoutInput<T>` | Integration API | Inputs to the pure layout engine. |
| `RangeAlignment`, `ZoomLimits`, `FitRangeOptions` | Integration API | Inputs to the pure viewport helpers. |
| `normalizeTime`, `normalizeRange`, `normalizeItem`, `normalizeItems` | Public API | Explicit boundary normalization helpers. |
| `timeToX`, `xToTime` | Public API | Reversible public scale math. |
| `selectTickInterval`, `generateTickTimes`, `formatTick` | Integration API | Deterministic UTC ruler primitives used by `layoutTimeline`. |
| `layoutTimeline` | Public API | Primary DOM-independent engine operation. |
| `zoomRange`, `panRange`, `alignTimeInRange`, `fitRange` | Public API | Pure navigation operations. |

No core export is an accidental DOM or React contract. The normalized and scene types are lower-level than typical application usage, but are necessary for the stated framework-independent engine package rather than browser implementation leakage.

## `@chronaxis/browser`

Both the default entry and `@chronaxis/browser/runtime` deliberately expose the same JavaScript/TypeScript API. The default entry additionally loads base CSS; `runtime` exists so framework adapters and Node-based tooling can import without a stylesheet side effect.

| Export | Classification | Rationale |
| --- | --- | --- |
| `createTimeline` | Public API | Primary imperative browser constructor. |
| `TimelineInstance<T>`, `TimelineOptions<T>`, `TimelineData<T>` | Public API | Browser lifecycle, configuration, and atomic data contracts. |
| `TimelineViewportOptions`, `TimelineInteractionOptions`, `WheelZoomMode` | Public API | Creation-time navigation and interaction configuration. |
| `ScrollAlignment`, `ScrollToOptions` | Public API | `scrollTo()` option vocabulary. |
| `TimelineItemSnapshot<T>`, `TimelineRowSnapshot` | Public API | Immutable callback/event views. |
| `ItemRenderContext`, `TickFormatContext` | Public API | Customization callback context. |
| `ItemRenderer<T>`, `RowLabelRenderer`, `TickFormatter`, `ItemClassNameGetter<T>`, `RowClassNameGetter` | Public API | Low-level DOM presentation customization. |
| `RangeChangeEvent`, `ItemClickEvent<T>`, `SelectionChangeEvent<T>`, `TimelineEventMap<T>` | Public API | Typed event payloads and subscription map. |
| `RangeChangeSource`, `SelectionChangeSource` | Public API | Public event source metadata. |
| Re-exported `TimeInput`, `TimeRange`, `TimeRangeInput`, `TimelineItem<T>`, `TimelineRow` | Public API | Common usage should not require a second package import. |
| `@chronaxis/browser/styles.css` | Integration API | Explicit, bundler-discoverable base stylesheet. |

`renderScene`, `RenderOptions`, snapshot builders, renderer state, preparation/validation helpers, and interaction constants are source-internal and are not reachable through package exports. This is intentional and should remain so.

## `@chronaxis/react`

| Export | Classification | Rationale |
| --- | --- | --- |
| `Timeline<T>` | Public API | Primary React component. |
| `TimelineProps<T>` | Public API | Declarative props contract, including standard `div` attributes. |
| `TimelineComponent` | Accidental/internal | Helper alias used to preserve the generic `forwardRef` signature; consumers do not need it. Removed from the public entry during this audit. |
| Re-exported browser/core data, event, callback, option, and instance types | Public API | Keeps normal React usage on one import path without duplicating definitions. |

React does not export hooks, React-specific imperative handles, controlled state models, or rendering internals.

## Naming and option conclusions

- `Input` consistently means consumer-friendly time values; normalized ranges and snapshots use numeric timestamps.
- `Timeline` (component), `createTimeline` (constructor), and `TimelineInstance` (imperative handle) are distinct and coherent.
- The browser option shape is acceptably flat for layout values and appropriately groups viewport and interaction behavior. A redesign would add churn without resolving a demonstrated usability defect.
- React’s `initialRange` name honestly communicates creation-time behavior. `rows`, `items`, events, and DOM callbacks are reactive; viewport, interactions, range, and geometry options are creation-time.
- DOM customization callbacks are intentionally experimental for an initial `0.x` release because framework-native item content and a callback invalidation API have not been designed.

## Corrections identified

1. Removed the accidental public `TimelineComponent` alias while preserving the generic `Timeline` declaration.
2. Reworked the performance example to use only public browser and core imports; renderer internals remain private.
3. Add package metadata that can be established from the repository, but treat the missing license decision as a human release blocker.
