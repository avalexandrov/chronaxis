import type { TimelineItem, TimelineRow, TimeRangeInput } from '@chronaxis/browser';

export interface Entry { owner: string; status: 'done' | 'active' | 'planned'; note?: string }
export interface Example {
  slug: string; title: string; eyebrow: string; description: string; lesson: string;
  rows: TimelineRow[]; items: TimelineItem<Entry>[]; range: TimeRangeInput;
  tick?: 'hours' | 'years'; update?: (items: TimelineItem<Entry>[]) => TimelineItem<Entry>[];
}

type Row = string;
type RecordItem = [Row, string, string, string, Entry['status'], string];
function data(rows: Row[], records: RecordItem[]): Pick<Example, 'rows' | 'items'> {
  return {
    rows: rows.map((label) => ({ id: label.toLowerCase().replaceAll(' ', '-'), label })),
    items: records.map(([row, label, start, end, status, owner], index) => ({
      id: `item-${index}`, rowId: row.toLowerCase().replaceAll(' ', '-'), label, start, end,
      data: { owner, status },
    })),
  };
}

export const project: Example = {
  slug: 'project-release', title: 'Project / release planning', eyebrow: 'Weeks · teams · stacked work',
  description: 'A release plan across seven teams. Overlapping tasks retain separate lanes, even as the viewport changes.',
  lesson: 'Try selecting a task, then simulate a plan update. The changed items keep their IDs while the browser instance updates in place.',
  range: { start: '2026-10-01', end: '2026-12-05' },
  ...data(['Product', 'Design', 'Frontend', 'Backend', 'Platform', 'QA', 'Launch'], [
    ['Product','Discovery synthesis','2026-10-02','2026-10-16','done','Mina'],
    ['Product','Release scope','2026-10-11','2026-10-30','active','Mina'],
    ['Product','Partner review','2026-10-22','2026-11-06','planned','Omar'],
    ['Product','Beta feedback','2026-11-08','2026-11-24','planned','Omar'],
    ['Design','Information architecture','2026-10-05','2026-10-21','done','Lea'],
    ['Design','Visual system','2026-10-15','2026-11-06','active','Lea'],
    ['Design','Accessibility pass','2026-10-26','2026-11-12','planned','Ari'],
    ['Design','Launch assets','2026-11-14','2026-11-30','planned','Lea'],
    ['Frontend','Navigation shell','2026-10-12','2026-10-31','active','Noah'],
    ['Frontend','Timeline views','2026-10-22','2026-11-16','active','Noah'],
    ['Frontend','Settings flow','2026-11-03','2026-11-20','planned','Ivy'],
    ['Frontend','Polish and fixes','2026-11-19','2026-12-02','planned','Ivy'],
    ['Backend','Schema revision','2026-10-08','2026-10-24','done','Inez'],
    ['Backend','Reporting API','2026-10-20','2026-11-11','active','Inez'],
    ['Backend','Import pipeline','2026-10-29','2026-11-20','planned','Sam'],
    ['Backend','Load review','2026-11-17','2026-11-28','planned','Sam'],
    ['Platform','Preview environments','2026-10-09','2026-10-29','done','Kai'],
    ['Platform','Observability','2026-10-23','2026-11-12','active','Kai'],
    ['Platform','Rollout controls','2026-11-09','2026-11-26','planned','Kai'],
    ['QA','Test plan','2026-10-20','2026-11-03','active','Sofia'],
    ['QA','Integration testing','2026-11-03','2026-11-21','planned','Sofia'],
    ['QA','Accessibility audit','2026-11-09','2026-11-25','planned','Ari'],
    ['QA','Release candidate','2026-11-24','2026-12-02','planned','Sofia'],
    ['Launch','Docs draft','2026-11-05','2026-11-22','planned','Mina'],
    ['Launch','Support brief','2026-11-16','2026-11-28','planned','Omar'],
    ['Launch','Go / no-go','2026-11-27','2026-11-29','planned','Team'],
    ['Launch','Staged release','2026-11-30','2026-12-04','planned','Team'],
  ]),
  update(items) { return items.map((item) => item.label === 'Timeline views'
    ? { ...item, end: '2026-11-22', data: { owner: 'Noah', status: 'done' } }
    : item.label === 'Accessibility audit'
      ? { ...item, start: '2026-11-04', data: { owner: 'Ari', status: 'active' } }
      : item); },
};

export const deployment: Example = {
  slug: 'deployment', title: 'Deployment timeline', eyebrow: 'Hours · operations · rollout',
  description: 'A two-day release window from artifact build through monitoring. Short events use ordinary timeline items.',
  lesson: 'Zoom into the canary phase to see the hour-scale ruler. Monitoring and rollout stages overlap intentionally.',
  range: { start: '2026-10-14T06:00:00Z', end: '2026-10-15T20:00:00Z' }, tick: 'hours',
  ...data(['Build','Staging','Canary','Production','Monitoring'], [
    ['Build','Compile','2026-10-14T07:00:00Z','2026-10-14T08:30:00Z','done','CI'],
    ['Build','Security scan','2026-10-14T08:00:00Z','2026-10-14T09:30:00Z','done','CI'],
    ['Build','Artifact signed','2026-10-14T09:30:00Z','2026-10-14T10:00:00Z','done','CI'],
    ['Staging','Deploy staging','2026-10-14T10:00:00Z','2026-10-14T11:30:00Z','done','Platform'],
    ['Staging','Smoke tests','2026-10-14T11:00:00Z','2026-10-14T13:00:00Z','active','QA'],
    ['Staging','Data check','2026-10-14T12:15:00Z','2026-10-14T13:45:00Z','active','Backend'],
    ['Canary','10% rollout','2026-10-14T14:00:00Z','2026-10-14T16:00:00Z','active','Platform'],
    ['Canary','Error budget review','2026-10-14T15:00:00Z','2026-10-14T16:30:00Z','active','SRE'],
    ['Canary','50% rollout','2026-10-14T17:00:00Z','2026-10-14T19:00:00Z','planned','Platform'],
    ['Production','100% rollout','2026-10-15T08:00:00Z','2026-10-15T10:00:00Z','planned','Platform'],
    ['Production','Regional check','2026-10-15T09:30:00Z','2026-10-15T12:00:00Z','planned','SRE'],
    ['Monitoring','Canary metrics','2026-10-14T14:00:00Z','2026-10-14T21:00:00Z','active','SRE'],
    ['Monitoring','Rollback window','2026-10-15T08:00:00Z','2026-10-15T16:00:00Z','planned','SRE'],
    ['Monitoring','Post-release watch','2026-10-15T10:00:00Z','2026-10-15T19:00:00Z','planned','SRE'],
  ]),
};

export const booking: Example = {
  slug: 'booking', title: 'Booking / resource schedule', eyebrow: 'One day · shared resources',
  description: 'Rooms and equipment become rows; reservations become ranges. Concurrent reservations stack where they overlap.',
  lesson: 'Select a booking to see its resource, customer, and exact time. This is a read-only schedule.',
  range: { start: '2026-10-14T07:00:00Z', end: '2026-10-14T22:00:00Z' }, tick: 'hours',
  ...data(['Studio A','Studio B','Meeting Room','Camera Kit','Editing Suite'], [
    ['Studio A','Product film','2026-10-14T08:00:00Z','2026-10-14T12:00:00Z','active','Northstar'],
    ['Studio A','Set reset','2026-10-14T11:30:00Z','2026-10-14T12:30:00Z','planned','Facilities'],
    ['Studio A','Interview session','2026-10-14T13:00:00Z','2026-10-14T16:30:00Z','planned','Atlas'],
    ['Studio A','Lighting prep','2026-10-14T16:00:00Z','2026-10-14T17:30:00Z','planned','Crew'],
    ['Studio B','Portraits','2026-10-14T08:30:00Z','2026-10-14T11:00:00Z','active','Meridian'],
    ['Studio B','Training video','2026-10-14T11:30:00Z','2026-10-14T15:30:00Z','planned','Cedar'],
    ['Studio B','Audio pickup','2026-10-14T15:00:00Z','2026-10-14T17:00:00Z','planned','Atlas'],
    ['Meeting Room','Planning review','2026-10-14T09:00:00Z','2026-10-14T10:30:00Z','active','Northstar'],
    ['Meeting Room','Client briefing','2026-10-14T11:00:00Z','2026-10-14T12:00:00Z','planned','Meridian'],
    ['Meeting Room','Production sync','2026-10-14T13:00:00Z','2026-10-14T14:00:00Z','planned','Crew'],
    ['Meeting Room','Screening','2026-10-14T16:00:00Z','2026-10-14T18:00:00Z','planned','Cedar'],
    ['Camera Kit','Studio A kit','2026-10-14T08:00:00Z','2026-10-14T12:00:00Z','active','Northstar'],
    ['Camera Kit','Maintenance','2026-10-14T12:00:00Z','2026-10-14T13:00:00Z','planned','Crew'],
    ['Camera Kit','Field shoot','2026-10-14T13:30:00Z','2026-10-14T18:30:00Z','planned','Atlas'],
    ['Editing Suite','Assembly cut','2026-10-14T08:00:00Z','2026-10-14T11:30:00Z','active','Cedar'],
    ['Editing Suite','Color pass','2026-10-14T12:00:00Z','2026-10-14T15:00:00Z','planned','Meridian'],
    ['Editing Suite','Review export','2026-10-14T14:30:00Z','2026-10-14T17:00:00Z','planned','Northstar'],
  ]),
};

export const history: Example = {
  slug: 'history', title: 'Historical / event timeline', eyebrow: 'Decades · categories · context',
  description: 'A small illustrative chronology across technology, science, culture, and exploration. Events are rendered with ordinary item ranges.',
  lesson: 'Zoom from decades to years and pan across the chronology. Short events use short ranges, without a special milestone type.',
  range: { start: '1950-01-01', end: '2030-01-01' }, tick: 'years',
  ...data(['Technology','Science','Culture','Exploration'], [
    ['Technology','Transistor era','1950-01-01','1962-01-01','done','Computing'],
    ['Technology','Mainframe growth','1958-01-01','1975-01-01','done','Computing'],
    ['Technology','Personal computing','1975-01-01','1990-01-01','done','Computing'],
    ['Technology','Web adoption','1991-01-01','2005-01-01','done','Internet'],
    ['Technology','Mobile computing','2007-01-01','2020-01-01','done','Devices'],
    ['Technology','Open data tools','2011-01-01','2025-01-01','active','Software'],
    ['Science','Space science','1957-01-01','1976-01-01','done','Research'],
    ['Science','Ocean mapping','1965-01-01','1985-01-01','done','Research'],
    ['Science','Genome projects','1990-01-01','2004-01-01','done','Biology'],
    ['Science','Exoplanet surveys','1995-01-01','2020-01-01','done','Astronomy'],
    ['Science','Climate observations','1980-01-01','2025-01-01','active','Earth science'],
    ['Science','Open science','2008-01-01','2026-01-01','active','Research'],
    ['Culture','Television expansion','1950-01-01','1970-01-01','done','Media'],
    ['Culture','Home video','1976-01-01','1995-01-01','done','Media'],
    ['Culture','Digital publishing','1993-01-01','2010-01-01','done','Publishing'],
    ['Culture','Streaming era','2005-01-01','2025-01-01','active','Media'],
    ['Culture','Online archives','2000-01-01','2026-01-01','active','Archives'],
    ['Exploration','Early orbital flights','1957-01-01','1964-01-01','done','Space'],
    ['Exploration','Lunar missions','1968-01-01','1973-01-01','done','Space'],
    ['Exploration','Deep-space probes','1977-01-01','2005-01-01','done','Space'],
    ['Exploration','Long-duration stations','1986-01-01','2015-01-01','done','Space'],
    ['Exploration','Mars rovers','1997-01-01','2025-01-01','active','Space'],
    ['Exploration','Ocean expeditions','2000-01-01','2024-01-01','done','Earth'],
  ]),
};

export const examples = [project, deployment, booking, history];
