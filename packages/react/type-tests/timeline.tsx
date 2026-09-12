import { createRef } from 'react';
import { expectTypeOf } from 'vitest';
import {
  Timeline,
  type TimelineInstance,
  type TimelineItem,
  type TimelineProps,
  type TimelineRow,
} from '@chronaxis/react';

interface TaskData {
  owner: string;
  priority: number;
}

const rows: TimelineRow[] = [{ id: 'row', label: 'Row' }];
const items: TimelineItem<TaskData>[] = [{
  id: 'item',
  rowId: 'row',
  start: 0,
  data: { owner: 'Alex', priority: 1 },
}];
const timelineRef = createRef<TimelineInstance<TaskData>>();

const timeline = (
  <Timeline<TaskData>
    ref={timelineRef}
    rows={rows}
    items={items}
    initialRange={{ start: 0, end: 100 }}
    onItemClick={(event) => {
      expectTypeOf(event.item.data?.owner).toEqualTypeOf<string | undefined>();
      expectTypeOf(event.item.data?.priority).toEqualTypeOf<number | undefined>();
    }}
    onSelectionChange={(event) => {
      expectTypeOf(event.selectedItem?.data?.owner).toEqualTypeOf<string | undefined>();
    }}
  />
);

expectTypeOf(timeline).toMatchTypeOf<React.ReactElement>();
expectTypeOf(timelineRef.current).toEqualTypeOf<TimelineInstance<TaskData> | null>();
expectTypeOf<TimelineProps<TaskData>['items']>().toEqualTypeOf<readonly TimelineItem<TaskData>[]>();

const invalid = (
  <Timeline<TaskData>
    rows={rows}
    // @ts-expect-error TaskData.owner must be a string.
    items={[{ id: 'bad', rowId: 'row', start: 0, data: { owner: 42, priority: 1 } }]}
    initialRange={{ start: 0, end: 100 }}
  />
);

void invalid;
