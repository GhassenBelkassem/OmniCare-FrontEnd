import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { isFollowUpItem } from './calendar-event.adapter';
import { presentCalendarItem } from './calendar-presentation';
import { patientLabel } from './calendar-privacy';
import { formatTunisTime, tunisDayKey, tunisFormatter } from './calendar-time';

/** The search starts at two characters. */
export const MIN_SEARCH_LENGTH = 2;

const DAY_LABEL = tunisFormatter({ weekday: 'short', day: 'numeric', month: 'short' });

/** Lower case, without accents, single spaces: « Hélène  Ben Ali » → « helene ben ali ». */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/\s+/g, ' ')
    .trim();
}

export type CalendarSearchKind = 'appointment' | 'request';

export interface CalendarSearchResult {
  /** `appointmentId` or `requestId`: the same id the calendar cards carry. */
  readonly id: string;
  readonly kind: CalendarSearchKind;
  /** Tunis day, `YYYY-MM-DD`. */
  readonly dayKey: string;
  /** « lun. 16 nov. » */
  readonly dayLabel: string;
  /** « 09:30 » (Tunis). */
  readonly timeLabel: string;
  /** Patient name as shown: initials in « Mode discret ». */
  readonly name: string;
  readonly stateLabel: string;
  /** `oc-cal-state--<state>`, for the status chip. */
  readonly cssClass: string;
  readonly startMs: number;
}

export interface CalendarSearchOutcome {
  /** True once the query has at least two characters. */
  readonly active: boolean;
  readonly results: readonly CalendarSearchResult[];
  /** Ids of the matching cards: they stay normal, the others are dimmed. */
  readonly ids: ReadonlySet<string>;
}

const INACTIVE: CalendarSearchOutcome = { active: false, results: [], ids: new Set() };

/**
 * Searches the appointments and requests **already loaded** for the visible period, by patient name
 * (case and accent insensitive). Nothing is fetched. The patient name is matched even in « Mode
 * discret » (the doctor knows who they are looking for), but only initials are ever displayed.
 */
export function searchCalendarItems(
  items: readonly DoctorScheduledCareItem[],
  query: string,
  discreet: boolean,
  nowMs: number = Date.now(),
): CalendarSearchOutcome {
  const needle = normalizeSearchText(query);
  if (needle.length < MIN_SEARCH_LENGTH) return INACTIVE;

  const results: CalendarSearchResult[] = [];
  for (const item of items) {
    const kind: CalendarSearchKind | null =
      item.resourceType === 'APPOINTMENT' ? 'appointment' : item.resourceType === 'BOOKING_REQUEST' ? 'request' : null;
    const id = kind === 'appointment' ? item.appointmentId : item.requestId;
    const startMs = Date.parse(item.start ?? '');
    if (kind === null || id === null || !Number.isFinite(startMs)) continue;
    if (!normalizeSearchText(item.subject?.displayName).includes(needle)) continue;

    const state = presentCalendarItem(item, { isFollowUp: isFollowUpItem(item), nowMs });
    results.push({
      id,
      kind,
      dayKey: tunisDayKey(startMs),
      dayLabel: DAY_LABEL.format(new Date(startMs)),
      timeLabel: formatTunisTime(new Date(startMs)),
      name: patientLabel(item.subject?.displayName, discreet),
      stateLabel: state.labelFr,
      cssClass: state.cssClass,
      startMs,
    });
  }
  results.sort((left, right) => left.startMs - right.startMs);
  return { active: true, results, ids: new Set(results.map((result) => result.id)) };
}
