/** Minimal temporal shape needed for deterministic interval lane assignment. */
export interface LaneItem {
  readonly start: number;
  readonly end: number;
}

/** Lane indices are aligned with the supplied item order. */
export interface ItemLaneAssignment {
  readonly lanes: readonly number[];
  readonly laneCount: number;
}

interface IndexedLaneItem {
  readonly item: LaneItem;
  readonly index: number;
}

interface ActiveLane {
  readonly end: number;
  /** Points remain occupied for other items that begin at the same timestamp. */
  readonly point: boolean;
  readonly lane: number;
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pushHeap<T>(heap: T[], value: T, compare: (left: T, right: T) => number): void {
  heap.push(value);
  let child = heap.length - 1;
  while (child > 0) {
    const parent = Math.floor((child - 1) / 2);
    const parentValue = heap[parent];
    if (parentValue === undefined || compare(parentValue, value) <= 0) break;
    heap[child] = parentValue;
    child = parent;
  }
  heap[child] = value;
}

function popHeap<T>(heap: T[], compare: (left: T, right: T) => number): T | undefined {
  const first = heap[0];
  const last = heap.pop();
  if (first === undefined || last === undefined || heap.length === 0) return first;

  let parent = 0;
  while (true) {
    const left = parent * 2 + 1;
    const right = left + 1;
    if (left >= heap.length) break;
    const leftValue = heap[left];
    const rightValue = heap[right];
    const child = rightValue !== undefined && leftValue !== undefined && compare(rightValue, leftValue) < 0
      ? right
      : left;
    const childValue = heap[child];
    if (childValue === undefined || compare(last, childValue) <= 0) break;
    heap[parent] = childValue;
    parent = child;
  }
  heap[parent] = last;
  return first;
}

function compareActiveLanes(left: ActiveLane, right: ActiveLane): number {
  return compareNumbers(left.end, right.end) || compareNumbers(left.lane, right.lane);
}

function assertValidInterval(item: LaneItem, index: number): void {
  if (!Number.isFinite(item.start) || !Number.isFinite(item.end)) {
    throw new RangeError(`Lane item at index ${index} must have finite start and end times.`);
  }
  if (item.end < item.start) {
    throw new RangeError(`Lane item at index ${index} ends before it starts.`);
  }
}

/**
 * Assigns the minimum number of reusable vertical lanes for the items of one row.
 *
 * Ranged items use half-open intervals: an item ending at `t` can share a lane
 * with one beginning at `t`. A zero-duration point at `t` collides with points
 * and ranges beginning at `t`, plus ranges whose half-open interval contains `t`.
 * It may share a lane with a range ending at `t`.
 */
export function assignItemLanes(items: readonly LaneItem[]): ItemLaneAssignment {
  const ordered: IndexedLaneItem[] = items.map((item, index) => {
    assertValidInterval(item, index);
    return { item, index };
  });
  ordered.sort((left, right) => (
    compareNumbers(left.item.start, right.item.start)
    || compareNumbers(left.item.end, right.item.end)
    || compareNumbers(left.index, right.index)
  ));

  const lanes = new Array<number>(items.length);
  const active: ActiveLane[] = [];
  const available: number[] = [];
  let laneCount = 0;
  let orderedIndex = 0;

  while (orderedIndex < ordered.length) {
    const firstInGroup = ordered[orderedIndex];
    if (firstInGroup === undefined) break;
    const start = firstInGroup.item.start;

    // Release lanes only between start-time groups. Keeping point lanes occupied
    // through this group makes coincident points and same-start ranges collide.
    while (true) {
      const earliest = active[0];
      if (!earliest || (earliest.point ? earliest.end >= start : earliest.end > start)) break;
      const released = popHeap(active, compareActiveLanes);
      if (released) pushHeap(available, released.lane, compareNumbers);
    }

    let groupEnd = orderedIndex + 1;
    while (groupEnd < ordered.length && ordered[groupEnd]?.item.start === start) groupEnd += 1;

    for (let index = orderedIndex; index < groupEnd; index += 1) {
      const entry = ordered[index];
      if (entry === undefined) continue;
      const lane = popHeap(available, compareNumbers) ?? laneCount++;
      lanes[entry.index] = lane;
      pushHeap(active, {
        end: entry.item.end,
        point: entry.item.start === entry.item.end,
        lane,
      }, compareActiveLanes);
    }
    orderedIndex = groupEnd;
  }

  return { lanes, laneCount };
}
