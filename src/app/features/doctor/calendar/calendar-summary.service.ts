import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import type { CalendarSummary } from './calendar-summary.models';
import { addDaysToKey, weekdayOfDayKey } from './calendar-time';

/** The API accepts at most 42 days (six weeks) per call. */
export const MAX_SUMMARY_DAYS = 42;

export const SUMMARY_LOAD_ERROR = 'Impossible de charger le mois.';
export const SUMMARY_BAD_RANGE_ERROR = "La période demandée n'est pas valide.";
export const DAY_SUMMARY_LOAD_ERROR = 'Impossible de charger le résumé de la journée.';

/** ProblemDetail code of the backend for a bad period (G4-2b, 400). */
export const CALENDAR_RANGE_INVALID = 'CALENDAR_RANGE_INVALID';

/**
 * True for a 400 answer that is the backend's « période invalide » (fix 15). The ProblemDetail
 * `errorCode` is checked when present; a 400 without a body (or with the legacy `code`) counts too.
 */
export function isProblem400(error: unknown, code: string): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return false;
  const body = error.error as { readonly errorCode?: unknown; readonly code?: unknown } | null;
  const received = body !== null && typeof body === 'object' ? (body.errorCode ?? body.code) : undefined;
  return received === undefined || received === code;
}

/** French message of a failed summary call: CALENDAR_RANGE_INVALID says the period is wrong, anything else is generic. */
export function summaryErrorMessage(error: unknown): string {
  return isProblem400(error, CALENDAR_RANGE_INVALID) ? SUMMARY_BAD_RANGE_ERROR : SUMMARY_LOAD_ERROR;
}

/** French message of a failed summary call for one day (the Jour view): same rule, wording for a day. */
export function daySummaryErrorMessage(error: unknown): string {
  return isProblem400(error, CALENDAR_RANGE_INVALID) ? SUMMARY_BAD_RANGE_ERROR : DAY_SUMMARY_LOAD_ERROR;
}

export interface MonthGrid {
  /** First Monday of the grid, `YYYY-MM-DD`. */
  readonly from: string;
  /** Last Sunday of the grid, `YYYY-MM-DD`. */
  readonly to: string;
  readonly keys: readonly string[];
}

/**
 * The month grid as Tunis dates, from the Monday of the week of the 1st to the Sunday of the week of the
 * last day (4 to 6 weeks, so at most 42 days). `monthKey` is `YYYY-MM`. Pure calendar arithmetic through
 * `calendar-time.ts`: no browser zone is involved. `null` for an invalid month.
 */
export function monthGridOfMonth(monthKey: string): MonthGrid | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (match === null) return null;
  const firstWeekday = weekdayOfDayKey(`${monthKey}-01`);
  if (firstWeekday === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextFirst = month === 12 ? `${String(year + 1).padStart(4, '0')}-01-01` : `${match[1]}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = addDaysToKey(nextFirst, -1);
  const lastWeekday = weekdayOfDayKey(lastDay);
  if (lastWeekday === null) return null;
  const from = addDaysToKey(`${monthKey}-01`, -((firstWeekday + 6) % 7));
  const to = addDaysToKey(lastDay, 6 - ((lastWeekday + 6) % 7));
  const keys: string[] = [];
  for (let key = from; key <= to && keys.length < MAX_SUMMARY_DAYS; key = addDaysToKey(key, 1)) keys.push(key);
  return { from, to: keys[keys.length - 1], keys };
}

@Injectable({ providedIn: 'root' })
export class CalendarSummaryService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  /** `from` and `to` are Tunis dates, inclusive. */
  getSummary(from: string, to: string): Observable<CalendarSummary> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<CalendarSummary>(
      `${this.config.apiBaseUrl}/doctor/scheduled-care/calendar-summary`,
      { params },
    );
  }
}
