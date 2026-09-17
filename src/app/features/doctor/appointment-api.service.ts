import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  AppointmentDto,
  AvailabilityExceptionDto,
  AvailabilityExceptionRequestDto,
  AvailabilityRuleDto,
  BookingRequestDto,
  DoctorStatsDto,
  SlotDto,
} from './appointment-api.models';

@Injectable({ providedIn: 'root' })
export class AppointmentApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/appointments`;
  private readonly availabilityUrl = `${this.baseUrl}/availability`;

  listRules(): Observable<readonly AvailabilityRuleDto[]> {
    return this.http.get<readonly AvailabilityRuleDto[]>(`${this.availabilityUrl}/rules`);
  }

  saveRules(rules: readonly AvailabilityRuleDto[]): Observable<readonly AvailabilityRuleDto[]> {
    return this.http.put<readonly AvailabilityRuleDto[]>(`${this.availabilityUrl}/rules`, rules);
  }

  listExceptions(from: string, to: string): Observable<readonly AvailabilityExceptionDto[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<readonly AvailabilityExceptionDto[]>(`${this.availabilityUrl}/exceptions`, { params });
  }

  addException(input: AvailabilityExceptionRequestDto): Observable<AvailabilityExceptionDto> {
    return this.http.post<AvailabilityExceptionDto>(`${this.availabilityUrl}/exceptions`, input);
  }

  deleteException(id: string): Observable<void> {
    return this.http.delete<void>(`${this.availabilityUrl}/exceptions/${id}`);
  }

  listSlots(doctorId: string, from: string, to: string): Observable<readonly SlotDto[]> {
    const params = new HttpParams().set('doctorId', doctorId).set('from', from).set('to', to);
    return this.http.get<readonly SlotDto[]>(`${this.availabilityUrl}/slots`, { params });
  }

  book(input: BookingRequestDto): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(this.baseUrl, input);
  }

  listAppointments(from: string, to: string): Observable<readonly AppointmentDto[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<readonly AppointmentDto[]>(this.baseUrl, { params });
  }

  getAppointment(id: string): Observable<AppointmentDto> {
    return this.http.get<AppointmentDto>(`${this.baseUrl}/${id}`);
  }

  cancelAppointment(id: string): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.baseUrl}/${id}/cancel`, {});
  }

  startAppointment(id: string): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.baseUrl}/${id}/start`, {});
  }

  completeAppointment(id: string): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.baseUrl}/${id}/complete`, {});
  }

  todayStats(): Observable<DoctorStatsDto> {
    return this.http.get<DoctorStatsDto>(`${this.baseUrl}/stats/today`);
  }
}
