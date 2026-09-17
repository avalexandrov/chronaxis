# `@chronaxis/react`

A thin React adapter for the framework-independent Chronaxis browser engine.

```tsx
import { useRef } from 'react';
import { Timeline, type TimelineInstance } from '@chronaxis/react';
import '@chronaxis/browser/styles.css';

const timelineRef = useRef<TimelineInstance<TaskData>>(null);

<Timeline<TaskData>
  ref={timelineRef}
  rows={rows}
  items={items}
  initialRange={{ start: '2026-01-01', end: '2026-04-01' }}
  overlap={{ mode: 'stack' }}
  style={{ height: 500 }}
  onSelectionChange={(event) => console.log(event.selectedItem)}
/>
```

Reactive props are `rows`, `items`, event callbacks, and DOM customization callbacks. `initialRange`, `viewport`, `interactions`, `overlap`, and geometry props are read when the component mounts. `overlap` defaults to `overlay`; set `overlap={{ mode: 'stack' }}` for separate lanes and automatic row growth when work overlaps in a row. Changing a creation-time prop after mount does not reconfigure the existing timeline. Viewport and selection state remain inside Chronaxis and are available through the forwarded `TimelineInstance` ref.

Import base styles once from `@chronaxis/browser/styles.css`. The outer React-owned `div` still needs application-appropriate dimensions.

Customization callbacks return DOM `Node`, string, or null values. React elements, portals, controlled range/selection, and server rendering of the timeline are not supported by this first adapter.

The supported peer range is React 18.2 through React 19. See the [repository README](https://github.com/avalexandrov/chronaxis#readme) for the complete API and support policy.
