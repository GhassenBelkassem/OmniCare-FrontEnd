import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { AppointmentDto, SlotDto } from '../appointment-api.models';

/**
 * The read and act surface a delegated secretary is granted on the doctor's
 * agenda.
 *
 * Creating a booking is deliberately absent: the contract exposes no patient
 * lookup for a secretary, so `POST /appointments/secretary-bookings` has no
 * client that could honestly fill it. Reschedule and cancel act on an existing
 * appointment instead.
 */
@Injectable({ providedIn: 'root' })
export class SecretaryAgendaApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/appointments`;

  /**
   * `GET /appointments` binds `from`/`to` as `Instant`, so a date-only value is rejected as a
   * malformed parameter. One calendar day is therefore sent as its own inclusive bounds: the day
   * opening at midnight UTC and its final instant, because the query is a `BETWEEN`.
   */
  list(day: string): Observable<readonly AppointmentDto[]> {
    return this.http.get<readonly AppointmentDto[]>(this.baseUrl, { params: dayBounds(day) });
  }

  /** Open slots for the delegating doctor, used to pick a new time. */
  listSlots(doctorId: string, day: string): Observable<readonly SlotDto[]> {
    const params = dayBounds(day).set('doctorId', doctorId);
    return this.http.get<readonly SlotDto[]>(`${this.baseUrl}/availability/slots`, { params });
  }

  reschedule(
    appointmentId: string,
    startTime: string,
    endTime: string,
  ): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(
      `${this.baseUrl}/${appointmentId}/secretary-reschedule`,
      { startTime, endTime },
    );
  }

  cancel(appointmentId: string): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(
      `${this.baseUrl}/${appointmentId}/secretary-cancel`,
      {},
    );
  }
}

/** Inclusive UTC bounds for a single ISO calendar day. */
function dayBounds(day: string): HttpParams {
  return new HttpParams().set('from', `${day}T00:00:00Z`).set('to', `${day}T23:59:59.999Z`);
}