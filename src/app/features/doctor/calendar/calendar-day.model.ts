import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import type { DaySlot } from './calendar-day-slots.models';
import { isFollowUpItem, toRequestCalendarEvent } from './calendar-event.adapter';
import { isStateVisible } from './calendar-filters';
import {
  buildTimeline,
  clockMinutes,
  pastTimelinePercent,
  dotCounts,
  timelineBar,
  type TimelineBar,
} from './calendar-month.model';
import { patientLabel } from './calendar-privacy';
import { presentCalendarItem, type CalendarState, type CalendarTypeIcon } from './calendar-presentation';
import type { CalendarSummaryDay } from './calendar-summary.models';
import { formatTunisTime, tunisDayKey, tunisHourMinute } from './calendar-time';

/**
 * Display model of the day view (canvas « Agenda médecin » v3.3, board « Jour »). Nothing here decides
 * what is free, taken, past or booked, nor a level or a count: slot states come from day-slots, the
 * counts and the level from calendar-summary, and they are shown as received. The only work is
 * layout: ordering rows, merging neighbouring FREE slots into one row, placing bars on a time axis.
 */

export type DayRowKind = 'item' | 'free' | 'break' | 'closed' | 'now';

export interface ItemRow {
  readonly kind: 'item';
  readonly key: string;
  readonly resource: 'appointment' | 'request';
  readonly id: string;
  readonly startMin: number;
  readonly timeLabel: string;
  readonly rawName: string;
  readonly state: CalendarState;
  readonly stateLabel: string;
  readonly cssClass: string;
  readonly dashed: boolean;
  readonly struck: boolean;
  readonly typeIcon: CalendarTypeIcon;
  readonly cabinetLabel: string;
  readonly isRequest: boolean;
  readonly isPracticePatient: boolean;
  readonly canStart: boolean;
  readonly startMs: number;
  readonly endMs: number;
  /** Request that the doctor can still accept (the facade checks the same rule). */
  readonly canAccept: boolean;
  readonly canDecline: boolean;
}

export interface FreeRow {
  readonly kind: 'free';
  readonly key: string;
  readonly startMin: number;
  readonly endMin: number;
  readonly start: string;
  readonly end: string;
  readonly timeLabel: string;
  readonly label: string;
  readonly slotCount: number;
}

export interface BreakRow {
  readonly kind: 'break';
  readonly key: string;
  readonly startMin: number;
  readonly timeLabel: string;
  readonly title: string;
  readonly rangeLabel: string;
}

export interface ClosedRow {
  readonly kind: 'closed';
  readonly key: string;
  readonly startMin: number;
  readonly timeLabel: string;
  readonly label: string;
  /** The BLOCK exception that closes this window, when it is among the loaded ones (then « Rouvrir »). */
  readonly exceptionId: string | null;
}

export interface NowRow {
  readonly kind: 'now';
  readonly key: string;
  readonly startMin: number;
  readonly timeLabel: string;
  readonly ariaLabel: string;
}

export type DayRow = ItemRow | FreeRow | BreakRow | ClosedRow | NowRow;

/** A closing exception of the day, matched to a closed window by its Tunis times. */
export interface BlockException {
  readonly id: string;
  readonly start: string;
  readonly end: string;
}

// ---- small formatting helpers ----

export function minutesLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** « 45 min », « 1 h », « 1 h 30 ». */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export function pendingChipText(count: number): string {
  return count === 1 ? '1 demande en attente' : `${count} demandes en attente`;
}

/** « 11:30 – 12:30 » */
export function rangeText(start: string, end: string): string {
  return `${start} – ${end}`;
}

// ---- free rows ----

export interface FreeRun {
  readonly start: string;
  readonly end: string;
  readonly slotCount: number;
}

/**
 * Neighbouring FREE slots (one ends where the next starts) become one run. TAKEN and PAST slots are never
 * part of a run, so a taken slot is never shown as free and past free time is not shown at all.
 */
export function mergeFreeSlots(slots: readonly DaySlot[]): readonly FreeRun[] {
  const ordered = slots
    .filter((slot) => slot.state === 'FREE' && clockMinutes(slot.start) !== null && clockMinutes(slot.end) !== null)
    .sort((left, right) => (clockMinutes(left.start) ?? 0) - (clockMinutes(right.start) ?? 0));
  const runs: { start: string; end: string; slotCount: number }[] = [];
  for (const slot of ordered) {
    const last = runs.at(-1);
    if (last !== undefined && last.end === slot.start) {
      last.end = slot.end;
      last.slotCount += 1;
    } else {
      runs.push({ start: slot.start, end: slot.end, slotCount: 1 });
    }
  }
  return runs;
}

/** Number of FREE slots, as the API lists them (« Créneaux libres » of the summary card). */
export function freeSlotCount(slots: readonly DaySlot[] | null): number {
  return slots === null ? 0 : slots.filter((slot) => slot.state === 'FREE').length;
}

// ---- items ----

/** Items drawn as rows: appointments, and requests that have an exact time, of this Tunis day. */
export function dayItems(
  items: readonly DoctorScheduledCareItem[],
  dayKey: string,
  hidden: ReadonlySet<CalendarState>,
): readonly DoctorScheduledCareItem[] {
  return items.filter((item) => {
    if (dayKey === '' || tunisDayKey(item.start) !== dayKey) return false;
    if (item.resourceType === 'BOOKING_REQUEST' && toRequestCalendarEvent(item) === null) return false;
    if (item.resourceType === 'APPOINTMENT' && item.appointmentId === null) return false;
    return isStateVisible(
      presentCalendarItem(item, { isFollowUp: isFollowUpItem(item) }).state,
      hidden,
    );
  });
}

/** True when the day has at least one drawable item before the filters are applied. */
export function hasAnyItem(items: readonly DoctorScheduledCareItem[], dayKey: string): boolean {
  return dayItems(items, dayKey, new Set()).length > 0;
}

function toItemRow(item: DoctorScheduledCareItem, startableId: string | null, nowMs: number): ItemRow {
  const isRequest = item.resourceType === 'BOOKING_REQUEST';
  const presentation = presentCalendarItem(item, { isFollowUp: isFollowUpItem(item), nowMs });
  const id = (isRequest ? item.requestId : item.appointmentId) ?? '';
  const start = new Date(item.start);
  const startMs = start.getTime();
  return {
    kind: 'item',
    key: `${isRequest ? 'request' : 'appointment'}:${id}`,
    resource: isRequest ? 'request' : 'appointment',
    id,
    startMin: tunisHourMinute(start).minutes,
    timeLabel: formatTunisTime(start),
    rawName: item.subject.displayName,
    state: presentation.state,
    stateLabel: presentation.labelFr,
    cssClass: presentation.cssClass,
    dashed: presentation.dashed,
    struck: presentation.struck,
    typeIcon: presentation.typeIcon,
    cabinetLabel: item.cabinet?.name?.trim() || 'Cabinet non renseigné',
    isRequest,
    isPracticePatient: presentation.typeIcon === 'external',
    canStart: !isRequest && id === startableId,
    startMs,
    endMs: new Date(item.end).getTime(),
    canAccept: isRequest && item.status === 'PENDING_DOCTOR' && item.availableActions.includes('ACCEPT_REQUEST'),
    canDecline: isRequest && item.status === 'PENDING_DOCTOR' && item.availableActions.includes('DECLINE_REQUEST'),
  };
}

/**
 * The appointment « Démarrer » is offered on: today only, the first CONFIRMED appointment (time order) that has
 * not ended yet, and only while no other consultation is running (`canStart`, same condition as the CAL-3
 * panel). The command itself is the panel's one.
 */
export function nextStartableId(
  items: readonly DoctorScheduledCareItem[],
  dayKey: string,
  nowMs: number,
  canStart: boolean,
): string | null {
  if (!canStart || dayKey !== tunisDayKey(nowMs)) return null;
  const candidate = items
    .filter(
      (item) =>
        item.resourceType === 'APPOINTMENT' &&
        item.appointmentId !== null &&
        item.status === 'CONFIRMED' &&
        tunisDayKey(item.start) === dayKey &&
        new Date(item.end).getTime() > nowMs,
    )
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())[0];
  return candidate?.appointmentId ?? null;
}

// ---- the list ----

export interface DayRowsInput {
  readonly dayKey: string;
  readonly nowMs: number;
  readonly items: readonly DoctorScheduledCareItem[];
  readonly hiddenStates: ReadonlySet<CalendarState>;
  readonly slots: readonly DaySlot[] | null;
  readonly summary: CalendarSummaryDay | null;
  readonly blockExceptions: readonly BlockException[];
  readonly startableId: string | null;
}

const RANK: Readonly<Record<DayRowKind, number>> = { item: 0, free: 1, break: 2, closed: 3, now: 4 };

export function dayIsToday(dayKey: string, nowMs: number): boolean {
  return dayKey !== '' && dayKey === tunisDayKey(nowMs);
}

/** Every row of the day in time order, with the red « now » row between them (today only). */
export function buildDayRows(input: DayRowsInput): readonly DayRow[] {
  const rows: DayRow[] = dayItems(input.items, input.dayKey, input.hiddenStates).map((item) =>
    toItemRow(item, input.startableId, input.nowMs),
  );
  const closedDay = input.summary?.level === 'CLOSED';

  for (const run of mergeFreeSlots(closedDay || input.slots === null ? [] : input.slots)) {
    const startMin = clockMinutes(run.start) ?? 0;
    rows.push({
      kind: 'free',
      key: `free:${run.start}`,
      startMin,
      endMin: clockMinutes(run.end) ?? startMin,
      start: run.start,
      end: run.end,
      timeLabel: run.start,
      label: `Libre · ${rangeText(run.start, run.end)}`,
      slotCount: run.slotCount,
    });
  }

  const summary = closedDay ? null : input.summary;
  if (summary?.breakWindow) {
    const start = clockMinutes(summary.breakWindow.start);
    const end = clockMinutes(summary.breakWindow.end);
    if (start !== null && end !== null && end > start) {
      rows.push({
        kind: 'break',
        key: `break:${summary.breakWindow.start}`,
        startMin: start,
        timeLabel: summary.breakWindow.start,
        title: 'Pause déjeuner',
        rangeLabel: `${rangeText(summary.breakWindow.start, summary.breakWindow.end)} · ${durationLabel(end - start)}`,
      });
    }
  }
  for (const window of summary?.blockedWindows ?? []) {
    const start = clockMinutes(window.start);
    if (start === null) continue;
    rows.push({
      kind: 'closed',
      key: `closed:${window.start}`,
      startMin: start,
      timeLabel: window.start,
      label: `Fermé · ${rangeText(window.start, window.end)}`,
      exceptionId:
        input.blockExceptions.find((block) => block.start === window.start && block.end === window.end)?.id ?? null,
    });
  }

  rows.sort((left, right) => left.startMin - right.startMin || RANK[left.kind] - RANK[right.kind]);

  if (dayIsToday(input.dayKey, input.nowMs)) {
    const nowMin = tunisHourMinute(input.nowMs).minutes;
    const index = rows.findIndex((row) => row.startMin > nowMin);
    const clock = formatTunisTime(new Date(input.nowMs));
    const marker: NowRow = {
      kind: 'now',
      key: 'now',
      startMin: nowMin,
      timeLabel: clock,
      ariaLabel: `Maintenant, ${clock}`,
    };
    rows.splice(index === -1 ? rows.length : index, 0, marker);
  }
  return rows;
}

// ---- timeline ----

export interface BookedBar extends TimelineBar {
  readonly id: string;
  readonly cssClass: string;
  readonly label: string;
}

export interface DayAxisTick {
  readonly label: string;
  readonly leftPercent: number;
}

export interface DayTimelineView {
  readonly segments: readonly TimelineBar[];
  readonly breakBar: TimelineBar | null;
  readonly blocked: readonly TimelineBar[];
  readonly booked: readonly BookedBar[];
  readonly ticks: readonly DayAxisTick[];
  /** Position of the red marker in percent, only for today and inside the drawn span. */
  readonly nowPercent: number | null;
  /** CAL-FIX-2 fix 6: width of the grey « already past » part from the left (100 on a past day, 0 ahead). */
  readonly pastPercent: number;
  readonly ariaLabel: string;
}

/** Bars of the 14 px timeline: working segments, break, closed windows and the booked appointments. */
export function buildDayTimeline(
  summary: CalendarSummaryDay | null,
  items: readonly DoctorScheduledCareItem[],
  hidden: ReadonlySet<CalendarState>,
  dayKey: string,
  nowMs: number,
  discreet: boolean,
): DayTimelineView | null {
  if (summary === null || summary.level === 'CLOSED') return null;
  const base = buildTimeline(summary);
  if (base === null) return null;
  const { start: spanStart, end: spanEnd } = base.span;

  const booked: BookedBar[] = [];
  for (const item of items) {
    if (item.resourceType !== 'APPOINTMENT' || item.appointmentId === null) continue;
    if (tunisDayKey(item.start) !== dayKey) continue;
    const presentation = presentCalendarItem(item, { isFollowUp: isFollowUpItem(item) });
    if (presentation.state === 'cancelled' || !isStateVisible(presentation.state, hidden)) continue;
    const start = formatTunisTime(new Date(item.start));
    const bar = timelineBar({ start, end: formatTunisTime(new Date(item.end)) }, spanStart, spanEnd);
    if (bar === null) continue;
    booked.push({
      ...bar,
      id: item.appointmentId,
      cssClass: presentation.cssClass,
      label: `${start} ${patientLabel(item.subject.displayName, discreet)}`,
    });
  }
  booked.sort((left, right) => left.leftPercent - right.leftPercent);

  const ticks: DayAxisTick[] = [];
  for (let minute = Math.ceil(spanStart / 60) * 60; minute <= spanEnd; minute += 60) {
    ticks.push({
      label: String(Math.floor(minute / 60)).padStart(2, '0'),
      leftPercent: ((minute - spanStart) / (spanEnd - spanStart)) * 100,
    });
  }

  const nowMin = tunisHourMinute(nowMs).minutes;
  const nowPercent =
    dayIsToday(dayKey, nowMs) && nowMin >= spanStart && nowMin <= spanEnd
      ? ((nowMin - spanStart) / (spanEnd - spanStart)) * 100
      : null;

  const ariaLabel =
    booked.length === 0
      ? 'Chronologie de la journée : aucun rendez-vous.'
      : `Chronologie de la journée : ${booked.map((bar) => bar.label).join(', ')}.`;
  return {
    segments: base.segments,
    breakBar: base.breakBar,
    blocked: base.blocked,
    booked,
    ticks,
    nowPercent,
    pastPercent: pastTimelinePercent(base.span, dayKey, nowMs),
    ariaLabel,
  };
}

/** The first FREE slot of the day as the API lists it (« Premier créneau libre », fix 8); `null` when none. */
export function firstFreeSlot(slots: readonly DaySlot[] | null): DaySlot | null {
  if (slots === null) return null;
  return (
    [...slots]
      .filter((slot) => slot.state === 'FREE' && clockMinutes(slot.start) !== null)
      .sort((left, right) => (clockMinutes(left.start) ?? 0) - (clockMinutes(right.start) ?? 0))[0] ?? null
  );
}

/**
 * Text above the rows when the day has no appointment (fix 7): « Aucun rendez-vous · 3 créneaux libres »
 * when the API lists free slots, « Aucun rendez-vous ce jour » otherwise.
 */
export function emptyDayText(freeSlots: number): string {
  if (freeSlots <= 0) return 'Aucun rendez-vous ce jour';
  return `Aucun rendez-vous · ${freeSlots} ${freeSlots === 1 ? 'créneau libre' : 'créneaux libres'}`;
}

// ---- aside ----

export interface NextPatient {
  readonly id: string;
  readonly rawName: string;
  readonly timeLabel: string;
  readonly minutesUntil: number;
  readonly isPracticePatient: boolean;
}

/** « Patient suivant »: today only, the next CONFIRMED appointment that has not started yet. */
export function nextPatient(
  items: readonly DoctorScheduledCareItem[],
  dayKey: string,
  nowMs: number,
  hidden: ReadonlySet<CalendarState>,
): NextPatient | null {
  if (!dayIsToday(dayKey, nowMs)) return null;
  const next = items
    .filter(
      (item) =>
        item.resourceType === 'APPOINTMENT' &&
        item.appointmentId !== null &&
        item.status === 'CONFIRMED' &&
        tunisDayKey(item.start) === dayKey &&
        new Date(item.start).getTime() >= nowMs &&
        isStateVisible(presentCalendarItem(item, { isFollowUp: isFollowUpItem(item) }).state, hidden),
    )
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())[0];
  if (next === undefined || next.appointmentId === null) return null;
  const startMs = new Date(next.start).getTime();
  return {
    id: next.appointmentId,
    rawName: next.subject.displayName,
    timeLabel: formatTunisTime(new Date(startMs)),
    minutesUntil: Math.max(0, Math.ceil((startMs - nowMs) / 60_000)),
    isPracticePatient: presentCalendarItem(next, { isFollowUp: isFollowUpItem(next) }).typeIcon === 'external',
  };
}

/** « dans 12 min », « dans 1 h 05 », « maintenant ». */
export function untilLabel(minutes: number): string {
  if (minutes <= 0) return 'maintenant';
  return `dans ${durationLabel(minutes)}`;
}

export interface SummaryLine {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

/** Lines of the « Résumé » card: the API's counts as received and the number of FREE slots of day-slots. */
export function summaryLines(day: CalendarSummaryDay | null, freeSlots: number | null): readonly SummaryLine[] {
  const counts = day === null ? null : dotCounts(day);
  const line = (key: string, label: string, value: number | null): SummaryLine[] =>
    value === null ? [] : [{ key, label, value }];
  return [
    ...line('done', 'Terminés', counts?.done ?? null),
    ...line('followUpDone', 'Suivis terminés', counts?.followUpDone ?? null),
    ...line('inProgress', 'En cours', counts?.inProgress ?? null),
    ...line('upcoming', 'À venir', counts?.upcoming ?? null),
    ...line('followUpUpcoming', 'Suivis à venir', counts?.followUpUpcoming ?? null),
    ...line('request', 'Demandes en attente', day === null ? null : day.pendingRequestCount),
    ...line('free', 'Créneaux libres', freeSlots),
  ];
}
