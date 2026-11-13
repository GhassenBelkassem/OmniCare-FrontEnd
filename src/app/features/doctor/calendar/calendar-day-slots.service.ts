import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import type { DaySlotsResponse } from './calendar-day-slots.models';
import { isProblem400 } from './calendar-summary.service';

export const DAY_SLOTS_LOAD_ERROR = 'Impossible de charger les créneaux libres.';
export const DAY_SLOTS_BAD_DATE_ERROR = "La date demandée n'est pas valide.";

/** ProblemDetail code of the backend for a bad date (G4-3, 400). */
export const DAY_SLOTS_DATE_INVALID = 'DAY_SLOTS_DATE_INVALID';

/** French message of a failed day-slots call: DAY_SLOTS_DATE_INVALID says the date is wrong, anything else is generic. */
export function daySlotsErrorMessage(error: unknown): string {
  return isProblem400(error, DAY_SLOTS_DATE_INVALID) ? DAY_SLOTS_BAD_DATE_ERROR : DAY_SLOTS_LOAD_ERROR;
}

@Injectable({ providedIn: 'root' })
export class CalendarDaySlotsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  /** `date` is a Tunis calendar date, `YYYY-MM-DD`. */
  getDaySlots(date: string): Observable<DaySlotsResponse> {
    const params = new HttpParams().set('date', date);
    return this.http.get<DaySlotsResponse>(
      `${this.config.apiBaseUrl}/doctor/scheduled-care/day-slots`,
      { params },
    );
  }
}
