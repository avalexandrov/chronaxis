<script setup lang="ts" generic="T = unknown">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  createTimeline,
  type RangeChangeEvent,
  type SelectionChangeEvent,
  type ItemClickEvent,
  type TimelineInstance,
} from '@chronaxis/browser/runtime';
import type { TimelineProps } from './types.js';

const props = defineProps<TimelineProps<T>>();
const emit = defineEmits<{
  'range-change': [event: RangeChangeEvent];
  'item-click': [event: ItemClickEvent<T>];
  'selection-change': [event: SelectionChangeEvent<T>];
}>();
const host = ref<HTMLDivElement | null>(null);
let instance: TimelineInstance<T> | null = null;
let unsubscribers: Array<() => void> = [];

defineExpose({ get instance() { return instance; } });

onMounted(() => {
  if (!host.value) return;
  instance = createTimeline<T>(host.value, {
    range: props.initialRange,
    rows: props.rows,
    items: props.items,
    viewport: props.viewport,
    interactions: props.interactions,
    overlap: props.overlap,
    defaultRowHeight: props.defaultRowHeight,
    rulerHeight: props.rulerHeight,
    rowLabelWidth: props.rowLabelWidth,
    itemHeight: props.itemHeight,
    minimumItemWidth: props.minimumItemWidth,
    renderItem: (item, context) => props.renderItem
      ? props.renderItem(item, context) : item.label ?? '',
    renderRowLabel: (row) => props.renderRowLabel ? props.renderRowLabel(row) : row.label,
    formatTick: (context) => props.formatTick?.(context) ?? context.defaultLabel,
    getItemClassName: (item) => props.getItemClassName?.(item),
    getRowClassName: (row) => props.getRowClassName?.(row),
  });
  unsubscribers = [
    instance.on('rangeChange', (event) => emit('range-change', event)),
    instance.on('itemClick', (event) => emit('item-click', event)),
    instance.on('selectionChange', (event) => emit('selection-change', event)),
  ];
});

// Post-flush batches paired row/item replacements into one atomic browser update.
// Vue tracks only top-level prop references, never the contents of large datasets.
watch(
  () => [props.rows, props.items, props.renderItem, props.renderRowLabel,
    props.formatTick, props.getItemClassName, props.getRowClassName],
  () => instance?.setData({ rows: props.rows, items: props.items }),
  { flush: 'post' },
);

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribers) unsubscribe();
  unsubscribers = [];
  instance?.destroy();
  instance = null;
});
</script>

<template>
  <div ref="host" />
</template>
