<script setup lang="ts">
import { ref } from 'vue';
import { Timeline, type ChronaxisVueHandle, type TimelineItem } from '@chronaxis/vue';

interface TaskData { owner: string; priority: number }
const rows = [{ id: 'work', label: 'Work' }];
const items: TimelineItem<TaskData>[] = [{
  id: 'task', rowId: 'work', start: 0, data: { owner: 'Alex', priority: 1 },
}];
const timeline = ref<ChronaxisVueHandle<TaskData> | null>(null);
timeline.value?.instance?.selectItem('task');
const renderItem = (item: { data?: TaskData }) => item.data?.owner ?? '';
function onItemClick(event: { item: { data?: TaskData } }) { console.log(event.item.data?.priority); }
function onSelectionChange(event: { selectedItem: { data?: TaskData } | null }) {
  console.log(event.selectedItem?.data?.owner);
}
</script>

<template>
  <Timeline ref="timeline" :rows="rows" :items="items" :initial-range="{ start: 0, end: 100 }"
    :render-item="renderItem" @item-click="onItemClick" @selection-change="onSelectionChange" />
</template>
