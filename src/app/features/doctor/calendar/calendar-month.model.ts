import { isStateVisible } from './calendar-filters';
import type { CalendarState } from './calendar-presentation';
import type { CalendarDayLevel, CalendarSummaryDay } from './calendar-summary.models';
import { tunisDayKey, tunisFormatter, tunisHourMinute, tunisInstant } from './calendar-time';

/**
 * Display mapping of one month-grid day. Nothing here computes a level, a load percentage or a slot
 * count: those come from the API and are only shown. The only arithmetic is the split of a status
 * count into its follow-up and non-follow-up dots, as the canvas draws them.
 */
export const MAX_DOTS = 5;

export type DotKind =
  | 'upcoming'
  | 'followUpUpcoming'
  | 'inProgress'
  | 'done'
  | 'followUpDone'
  | 'absent'
  | 'waitingPatient'
  | 'request';

/** Colours of the canvas (« Agenda médecin » v3.3). */
export const DOT_COLOR: Readonly<Record<DotKind, string>> = {
  upcoming: '#2563EB',
  followUpUpcoming: '#7A5AF8',
  inProgress: '#0F826D',
  done: '#0F826D',
  followUpDone: '#BDB4FE',
  absent: '#D92D20',
  waitingPatient: '#93C5FD',
  request: '#F79009',
};

/** Which « Filtres » state hides each dot. */
export const DOT_FILTER_STATE: Readonly<Record<DotKind, CalendarState>> = {
  upcoming: 'upcoming',
  followUpUpcoming: 'followUpUpcoming',
  inProgress: 'inProgress',
  done: 'done',
  followUpDone: 'followUpDone',
  absent: 'absent',
  waitingPatient: 'waitingPatient',
  request: 'request',
};

/** Dot kind of a calendar state (preview rows); states without a dot give `null`. */
export function dotKindOfState(state: CalendarState | undefined): DotKind | null {
  switch (state) {
    case 'upcoming':
    case 'followUpUpcoming':
    case 'inProgress':
    case 'done':
    case 'followUpDone':
    case 'absent':
    case 'waitingPatient':
    case 'request':
      return state;
    default:
      return null;
  }
}

export interface DayDot {
  readonly kind: DotKind;
  readonly color: string;
}

export interface DayDots {
  /** At most {@link MAX_DOTS}, in the canvas order, cancelled never shown. */
  readonly dots: readonly DayDot[];
  /** « +n »: how many dots did not fit, 0 when all fit. */
  readonly overflow: number;
}

const DOT_ORDER: readonly DotKind[] = [
  'upcoming',
  'followUpUpcoming',
  'inProgress',
  'done',
  'followUpDone',
  'absent',
  'waitingPatient',
  'request',
];

function nonNegative(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** One entry per dot kind with the number of appointments it stands for (filters not applied). */
export function dotCounts(day: CalendarSummaryDay): Readonly<Record<DotKind, number>> {
  const counts = day.countsByStatus;
  const followUp = day.followUpCountsByStatus;
  const confirmed = nonNegative(counts.CONFIRMED);
  const confirmedFollowUp = Math.min(nonNegative(followUp.CONFIRMED), confirmed);
  const completed = nonNegative(counts.COMPLETED);
  const completedFollowUp = Math.min(nonNegative(followUp.COMPLETED), completed);
  return {
    upcoming: confirmed - confirmedFollowUp,
    followUpUpcoming: confirmedFollowUp,
    inProgress: nonNegative(counts.IN_PROGRESS),
    done: completed - completedFollowUp,
    followUpDone: completedFollowUp,
    absent: nonNegative(counts.NO_SHOW),
    waitingPatient: nonNegative(counts.PROPOSED) + nonNegative(day.awaitingPatientRequestCount),
    request: nonNegative(day.pendingRequestCount),
  };
}

/** The dots of a day: one per appointment, hidden states left out, max 5 then « +n ». */
export function buildDayDots(day: CalendarSummaryDay, hidden: ReadonlySet<CalendarState>): DayDots {
  const counts = dotCounts(day);
  const all: DayDot[] = [];
  for (const kind of DOT_ORDER) {
    if (!isStateVisible(DOT_FILTER_STATE[kind], hidden)) continue;
    for (let index = 0; index < counts[kind]; index += 1) all.push({ kind, color: DOT_COLOR[kind] });
  }
  return { dots: all.slice(0, MAX_DOTS), overflow: Math.max(0, all.length - MAX_DOTS) };
}

export const LEVEL_LABEL: Readonly<Record<CalendarDayLevel, string>> = {
  AVAILABLE: 'disponible',
  BUSY: 'chargé',
  FULL: 'complet',
  CLOSED: 'fermé',
};

const LEVEL_CHIP: Readonly<Record<CalendarDayLevel, string>> = {
  AVAILABLE: 'Disponible',
  BUSY: 'Chargé',
  FULL: 'Complet',
  CLOSED: 'Fermé',
};

/** Level chip text of the preview: « Disponible », « Chargé », « Complet », « Fermé ». */
export function levelChipLabel(level: CalendarDayLevel): string {
  return LEVEL_CHIP[level];
}

/** « Fermé » for a weekly day off, « Congé » for an exception, nothing for an open day. */
export function closedText(day: CalendarSummaryDay): string {
  if (day.level !== 'CLOSED') return '';
  return day.closedReason === 'EXCEPTION' ? 'Congé' : 'Fermé';
}

/** Day of the month of a `YYYY-MM-DD` key. */
export function dayNumber(key: string): number {
  return Number(key.slice(8, 10));
}

const LONG_DATE = tunisFormatter({ weekday: 'long', day: 'numeric', month: 'long' });
const LONG_DATE_YEAR = tunisFormatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1);
}

/** « Lundi 16 novembre » (Tunis). */
export function shortDateLabel(key: string): string {
  const instant = tunisInstant(key, '12:00');
  return instant === null ? key : capitalize(LONG_DATE.format(instant));
}

/** « Lundi 16 novembre 2026 » (Tunis). */
export function longDateLabel(key: string): string {
  const instant = tunisInstant(key, '12:00');
  return instant === null ? key : capitalize(LONG_DATE_YEAR.format(instant));
}

function pendingPhrase(count: number): string {
  return count === 1 ? '1 demande en attente' : `${count} demandes en attente`;
}

/** « 6 / 16 créneaux réservés », as the API gives the two numbers. */
export function slotsText(day: CalendarSummaryDay): string {
  return `${day.takenSlots} / ${day.bookableSlots} créneaux réservés`;
}

/**
 * « Lundi 16 novembre, disponible, 6 sur 16 créneaux réservés, 2 demandes en attente ». The pending
 * requests are left out when the « Demande » filter is off; the workload stays (it is objective).
 */
export function dayAriaLabel(day: CalendarSummaryDay, hidden: ReadonlySet<CalendarState>): string {
  const parts = [shortDateLabel(day.date), LEVEL_LABEL[day.level]];
  if (day.level === 'CLOSED') {
    if (day.closedReason === 'EXCEPTION') parts.push('congé');
    return parts.join(', ');
  }
  parts.push(`${day.takenSlots} sur ${day.bookableSlots} créneaux réservés`);
  const pending = nonNegative(day.pendingRequestCount);
  if (pending > 0 && isStateVisible('request', hidden)) parts.push(pendingPhrase(pending));
  return parts.join(', ');
}

/** Pending requests wording of the preview line: « 2 en attente ». */
export function pendingCountShown(day: CalendarSummaryDay, hidden: ReadonlySet<CalendarState>): number {
  return isStateVisible('request', hidden) ? nonNegative(day.pendingRequestCount) : 0;
}

/** Width of the bottom bar: exactly the API's percentage (0 when the API sends none). */
export function barWidthPercent(day: CalendarSummaryDay): number {
  return day.level === 'CLOSED' || day.loadPercent === null ? 0 : day.loadPercent;
}

// ---- legend ----

export interface LegendLevel {
  readonly level: CalendarDayLevel;
  readonly label: string;
}

/** The thresholds come from the API (defaults only before the first answer). */
export function legendLevels(busyFrom = 50, fullFrom = 85): readonly LegendLevel[] {
  return [
    { level: 'AVAILABLE', label: `Disponible (moins de ${busyFrom} %)` },
    { level: 'BUSY', label: `Chargé (${busyFrom}–${fullFrom} %)` },
    { level: 'FULL', label: `Complet (${fullFrom} % et plus)` },
    { level: 'CLOSED', label: 'Fermé' },
  ];
}

const LEGEND_DOTS: readonly { readonly kind: DotKind; readonly label: string }[] = [
  { kind: 'upcoming', label: 'Rendez-vous à venir' },
  { kind: 'followUpUpcoming', label: 'Suivi à venir' },
  { kind: 'followUpDone', label: 'Suivi terminé' },
  { kind: 'done', label: 'Terminé' },
  { kind: 'request', label: 'Demande en attente' },
];

/** The dot entries of the legend row (the colour comes from {@link DOT_COLOR}). */
export function legendDotItems(): readonly { readonly kind: DotKind; readonly label: string }[] {
  return LEGEND_DOTS;
}

// ---- mini timeline ----

export function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 24 || minute > 59 ? null : hour * 60 + minute;
}

export interface TimelineBar {
  readonly leftPercent: number;
  readonly widthPercent: number;
}

export interface DayTimeline {
  readonly segments: readonly TimelineBar[];
  readonly breakBar: TimelineBar | null;
  readonly blocked: readonly TimelineBar[];
  readonly extras: readonly TimelineBar[];
  /** Start and end of the drawn span, « HH:mm ». */
  readonly startLabel: string;
  readonly endLabel: string;
  /** The drawn span in minutes of the Tunis day. */
  readonly span: { readonly start: number; readonly end: number };
}

/** Drawing geometry of the preview's timeline: windows as percentages of the open span. */
export function buildTimeline(day: CalendarSummaryDay): DayTimeline | null {
  const windows = [...day.workingSegments, ...day.extraWindows];
  const starts = windows.map((w) => clockMinutes(w.start)).filter((v): v is number => v !== null);
  const ends = windows.map((w) => clockMinutes(w.end)).filter((v): v is number => v !== null);
  if (starts.length === 0 || ends.length === 0) return null;
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  if (end <= start) return null;
  const bar = (window: { readonly start: string; readonly end: string }): TimelineBar | null =>
    timelineBar(window, start, end);
  const nonNull = (list: readonly (TimelineBar | null)[]): TimelineBar[] =>
    list.filter((item): item is TimelineBar => item !== null);
  return {
    segments: nonNull(day.workingSegments.map(bar)),
    breakBar: day.breakWindow === null ? null : bar(day.breakWindow),
    blocked: nonNull(day.blockedWindows.map(bar)),
    extras: nonNull(day.extraWindows.map(bar)),
    startLabel: minutesToLabel(start),
    endLabel: minutesToLabel(end),
    span: { start, end },
  };
}

/** A window (or an appointment's minutes) as a bar inside the span; `null` when it falls outside. */
export function timelineBar(
  window: { readonly start: string; readonly end: string },
  spanStart: number,
  spanEnd: number,
): TimelineBar | null {
  const from = clockMinutes(window.start);
  const to = clockMinutes(window.end);
  if (from === null || to === null || to <= from || spanEnd <= spanStart) return null;
  const length = spanEnd - spanStart;
  const left = Math.max(0, ((from - spanStart) / length) * 100);
  const right = Math.min(100, ((to - spanStart) / length) * 100);
  return right <= left ? null : { leftPercent: left, widthPercent: right - left };
}

function minutesToLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// ---- past time (CAL-FIX-2 fix 6) ----

/** Label of the level chip of a PAST day: the day is over, its workload is history. */
export const PAST_DAY_LABEL = 'Passé';

/** True when the Tunis day `dayKey` is before today (Tunis) at `nowMs`. */
export function isPastDay(dayKey: string, nowMs: number): boolean {
  return dayKey !== '' && dayKey < tunisDayKey(nowMs);
}

/**
 * How much of a timeline span (Tunis minutes of `dayKey`) is already past at `nowMs`, in percent from the
 * left: 100 for a past day, 0 for a future day, the elapsed part for today. Display only: it greys the
 * part of the day before now and never changes a value from the API.
 */
export function pastTimelinePercent(
  span: { readonly start: number; readonly end: number },
  dayKey: string,
  nowMs: number,
): number {
  const today = tunisDayKey(nowMs);
  if (dayKey === '' || dayKey > today || span.end <= span.start) return 0;
  if (dayKey < today) return 100;
  const now = tunisHourMinute(nowMs).minutes;
  return Math.min(100, Math.max(0, ((now - span.start) / (span.end - span.start)) * 100));
}

