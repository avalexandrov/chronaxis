import { expectTypeOf } from 'vitest';
import type {
  ChronaxisVueHandle, ItemClickEvent, ItemRenderer, SelectionChangeEvent,
  TimelineInstance, TimelineItem, TimelineProps,
} from '@chronaxis/vue';

interface TaskData { owner: string; priority: number }

expectTypeOf<TimelineProps<TaskData>['items']>().toEqualTypeOf<readonly TimelineItem<TaskData>[]>();
expectTypeOf<ItemClickEvent<TaskData>['item']['data']>().toEqualTypeOf<TaskData | undefined>();
expectTypeOf<SelectionChangeEvent<TaskData>['selectedItem']>()
  .toMatchTypeOf<{ data?: TaskData } | null>();
expectTypeOf<Parameters<ItemRenderer<TaskData>>[0]['data']>().toEqualTypeOf<TaskData | undefined>();
expectTypeOf<ChronaxisVueHandle<TaskData>['instance']>()
  .toEqualTypeOf<TimelineInstance<TaskData> | null>();

// @ts-expect-error Item data retains its declared shape.
const invalid: TimelineItem<TaskData> = { id: 'bad', rowId: 'r', start: 0, data: { owner: 42, priority: 1 } };
void invalid;
