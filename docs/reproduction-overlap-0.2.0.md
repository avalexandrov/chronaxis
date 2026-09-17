# Overlapping-item pointer reproduction

## Reproduction

The vanilla example contains a single `Research` row with these two ranges:

| Item | Range |
| --- | --- |
| `Customer interviews` | 2025-12-27 to 2026-01-14 |
| `Market landscape` | 2026-01-10 to 2026-01-28 |

With Chronaxis 0.1 overlay layout, both item wrappers are vertically centered in
the same row. Their dates overlap from 2026-01-10 through 2026-01-14, so their
rectangles occupy the same pixels. At a point in that shared rectangle, click
the apparent `Customer interviews` bar. The activated item is `Market
landscape`.

The focused keyboard path remains unambiguous: tabbing to either button and
pressing Enter or Space activates that focused item.

## DOM and hit-testing result

This is correct browser hit testing, not a pointer-event defect.

`layoutTimeline` keeps visible scene items in consumer input order. The browser
renderer creates/reorders `.chronaxis-item` children in that same `scene.items`
order. Both wrappers are absolutely positioned children of one
`.chronaxis-items` stacking context and have no item-level `z-index`. Therefore
the later sibling is painted over the earlier sibling where their rectangles
intersect. For the example above, the DOM order is:

```html
<div class="chronaxis-items">
  <div class="chronaxis-item" data-chronaxis-item-id="interviews">…</div>
  <div class="chronaxis-item" data-chronaxis-item-id="landscape">…</div>
</div>
```

At a shared point, `document.elementFromPoint()` resolves to `landscape`, the
top-painted later sibling. The native `pointerdown` has the same target. The
timeline's delegated handler records `event.target.closest('[data-chronaxis-item-id]')`
before pointer capture is established, then activates that recorded ID on an
unmoved `pointerup`. Pointer capture affects subsequent event delivery; it does
not change the browser's initial hit test.

## Conclusion

Overlay mode has inherently ambiguous pointer targets whenever same-row item
rectangles visually overlap. The current behavior is predictable and matches
DOM paint order, but it cannot infer which visually obscured item the user
intended. Pointer-coordinate routing, z-index-on-hover, or click forwarding
would only hide that ambiguity and are intentionally out of scope.

The 0.2.0 solution is geometry: stack temporally overlapping items into
separate vertical lanes. In stack mode their wrappers must not overlap, so the
browser's ordinary hit testing selects the item the user clicks. Overlay remains
the backwards-compatible default and intentionally retains the documented
paint-order behavior.

## Regression coverage

Browser coverage in `tests/browser/timeline.smoke.spec.ts` uses real Chromium,
Firefox, and WebKit hit testing rather than the DOM test environment. It asserts
both of the following:

1. Overlay mode preserves the later-DOM-sibling activation at a shared point.
2. Stack mode gives each overlapping item a distinct vertical click target and
   activates the corresponding item; drag initiation from either target still
   pans after the existing threshold.

Both checks passed in Chromium, Firefox, and WebKit during the 0.2.0 work.

Core geometry tests remain the appropriate place for lane assignment and row
height semantics. The browser renderer should continue to consume only final
item and row geometry.
