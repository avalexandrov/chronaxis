# `@chronaxis/vue`

A thin Vue 3 adapter for the Chronaxis browser timeline.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Timeline, type ChronaxisVueHandle, type TimelineItem } from '@chronaxis/vue';
import '@chronaxis/browser/styles.css';

interface TaskData { owner: string }
const rows = [{ id: 'work', label: 'Work' }];
const items = ref<TimelineItem<TaskData>[]>([
  { id: 'task', rowId: 'work', start: '2026-01-05', end: '2026-02-01', data: { owner: 'Alex' } },
]);
const timeline = ref<ChronaxisVueHandle<TaskData> | null>(null);
</script>

<template>
  <button @click="timeline?.instance?.fit()">Fit</button>
  <Timeline
    ref="timeline"
    class="project-timeline"
    aria-label="Project timeline"
    :rows="rows"
    :items="items"
    :initial-range="{ start: '2026-01-01', end: '2026-04-01' }"
    :overlap="{ mode: 'stack' }"
    @item-click="(event) => console.log(event.item.data?.owner)"
  />
</template>
```

Vue 3.5 or newer is a peer dependency. Import `@chronaxis/browser/styles.css` once in the application. The component's root `div` receives ordinary Vue attributes such as `class`, `style`, and `aria-label` and needs a useful width.

## Reactivity and lifecycle

`rows` and `items` update when their **array references change**. Replace an array after editing an item or row; nested in-place mutations are not watched. This keeps watcher cost independent of the size of large timelines. Changes to either collection are batched into one atomic `setData({ rows, items })` call, so changing both in the same Vue update is safe. For example, store both collections in one `ref<TimelineData<TaskData>>` and replace its value when moving items to new rows.

`initialRange`, `viewport`, `interactions`, `overlap`, and geometry props are read only when the component mounts. New inline objects for these props do not recreate the timeline. Use `timeline.value?.instance?.setRange(...)` for programmatic range changes. Remount deliberately if a different creation-time layout or interaction policy is needed.

The component ref exposes `{ instance: TimelineInstance<T> | null }`. `instance` becomes available after mount and clears during unmount. It is the existing browser API, with methods such as `fit`, `zoomIn`, `zoomOut`, `scrollTo`, `selectItem`, and `clearSelection`.

Events use Vue names: `@range-change`, `@item-click`, and `@selection-change`. Their payloads are the browser event payloads, including generic item data `T`. Vue's `emit` dispatches to current listeners without resubscribing or recreating the timeline.

`renderItem`, `renderRowLabel`, `formatTick`, `getItemClassName`, and `getRowClassName` are the browser's low-level DOM callbacks. They accept and return browser values, not Vue VNodes or slots. Changed callback props are forwarded through stable functions and trigger `setData()` to refresh cached content. There is no per-item Vue component mounting in this adapter.

Importing the package in Node is safe; rendering a Chronaxis timeline on the server is not supported. The browser instance is created after the host element mounts.
