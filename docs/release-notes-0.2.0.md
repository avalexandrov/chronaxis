# Chronaxis 0.2.0

Chronaxis 0.2.0 adds an optional lane layout for timelines that contain concurrent work in the same row.

## Stack overlapping work when needed

Chronaxis still defaults to the `0.1.x` overlay behavior. Applications that want distinct visual and pointer targets for concurrent items can opt in at creation time:

```ts
createTimeline(container, {
  range,
  rows,
  items,
  overlap: { mode: 'stack' },
});
```

The React adapter accepts the same creation-time option:

```tsx
<Timeline rows={rows} items={items} initialRange={range} overlap={{ mode: 'stack' }} />
```

Stack mode partitions items into deterministic per-row temporal lanes. Touching ranged intervals can reuse a lane. A zero-duration point collides with points and ranges that begin at its timestamp (and ranges that contain it), but can reuse a lane with a range ending there. Rows grow to fit the configured item height and required lanes, and lane placement is calculated before horizontal culling so it stays stable while users pan or zoom. The default lane gap is 4px and can be changed with `laneGap`.

## Compatibility and interaction

No application is switched to stack layout automatically: `overlap` is optional and its default mode is `overlay`. Existing overlay geometry and paint-order behavior therefore remain intact. In stack mode, formerly intersecting bars occupy separate vertical wrappers, allowing ordinary browser hit testing to activate the bar that was clicked without pointer-routing workarounds.

`overlap` follows the existing browser/React creation-time geometry convention. Change it by creating a new timeline (or remounting React `Timeline`), not through a new imperative configuration API.

## Performance and scope

Lane assignment performs a sort-and-partition pass across each row's full data set before viewport culling. The browser still creates DOM only for horizontally visible items. In the recorded 10,000-item moderate-overlap run, core pan-layout median was 1.7 ms for stack versus 0.8 ms for overlay; the one-row 1,000-item stress case stayed below 1.4 ms core p95 for stack. The expanded performance harness records pure core-layout and public operation-to-paint measurements for 100, 1,000, 5,000, and 10,000-item data sets at low, moderate, and heavy overlap densities, plus the pathological case. Recorded measurements are in [the performance report](performance-phase-6.md); they are comparative evidence, not universal guarantees.

This release adds no new framework adapters, controlled viewport/selection APIs, drag-and-drop, tooltips, or other unrelated timeline features.
