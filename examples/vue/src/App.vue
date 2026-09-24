<script setup lang="ts">
import { ref } from 'vue';
import {
  Timeline,
  type ChronaxisVueHandle,
  type ItemClickEvent,
  type RangeChangeEvent,
  type SelectionChangeEvent,
  type TimelineData,
  type TimelineItem,
  type TimelineRow,
} from '@chronaxis/vue';

interface TaskData { owner: string; priority: number }

const initialRows: TimelineRow[] = [
  { id: 'planning', label: 'Planning' },
  { id: 'delivery', label: 'Delivery' },
];
const initialItems: TimelineItem<TaskData>[] = [
  { id: 'scope', rowId: 'planning', start: '2026-01-05', end: '2026-02-12', label: 'Scope', data: { owner: 'Mina', priority: 1 } },
  { id: 'review', rowId: 'planning', start: '2026-01-24', end: '2026-02-26', label: 'Review', data: { owner: 'Alex', priority: 2 } },
  { id: 'build', rowId: 'delivery', start: '2026-02-10', end: '2026-04-02', label: 'Build', data: { owner: 'Nora', priority: 1 } },
];
const data = ref<TimelineData<TaskData>>({ rows: initialRows, items: initialItems });
const timeline = ref<ChronaxisVueHandle<TaskData> | null>(null);
const events = ref<string[]>([]);
const initialRange = { start: '2026-01-01', end: '2026-04-30' };

function record(message: string) { events.value = [message, ...events.value].slice(0, 5); }
function onRangeChange(event: RangeChangeEvent) { record(`Range: ${event.source}`); }
function onItemClick(event: ItemClickEvent<TaskData>) { record(`Activated: ${event.item.label} — ${event.item.data?.owner}`); }
function onSelectionChange(event: SelectionChangeEvent<TaskData>) { record(`Selected: ${event.selectedItem?.label ?? 'none'}`); }
function updateItems() {
  data.value = {
    ...data.value,
    items: data.value.items.map((item) => item.id === 'build'
      ? { ...item, label: 'Build and verify', end: '2026-04-16' }
      : item),
  };
}
function updateData() {
  data.value = {
    rows: [...initialRows, { id: 'launch', label: 'Launch' }],
    items: [...initialItems, {
      id: 'release', rowId: 'launch', start: '2026-04-02', end: '2026-04-24',
      label: 'Release', data: { owner: 'Iris', priority: 1 },
    }],
  };
}
</script>

<template>
  <main>
    <p class="eyebrow">Vue adapter validation</p>
    <h1>Chronaxis in Vue</h1>
    <p>Reactive data flows into one browser timeline. The viewport and selection stay in Chronaxis.</p>
    <div class="toolbar" aria-label="Timeline controls">
      <button @click="timeline?.instance?.zoomIn()">Zoom in</button>
      <button @click="timeline?.instance?.zoomOut()">Zoom out</button>
      <button @click="timeline?.instance?.fit()">Fit</button>
      <button @click="timeline?.instance?.clearSelection()">Clear selection</button>
      <button @click="updateItems">Update items</button>
      <button @click="updateData">Update data</button>
    </div>
    <Timeline
      ref="timeline"
      class="vue-timeline"
      aria-label="Vue project timeline"
      :rows="data.rows"
      :items="data.items"
      :initial-range="initialRange"
      :interactions="{ pan: true, wheelZoom: 'modifier' }"
      :overlap="{ mode: 'stack' }"
      @range-change="onRangeChange"
      @item-click="onItemClick"
      @selection-change="onSelectionChange"
    />
    <section aria-label="Recent events">
      <h2>Events</h2>
      <p v-if="events.length === 0">Select an item or use a control.</p>
      <ul v-else><li v-for="(event, index) in events" :key="index">{{ event }}</li></ul>
    </section>
  </main>
</template>
