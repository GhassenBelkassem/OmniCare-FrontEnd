import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  Appointment,
  AvailabilityResponse,
  BookingRequest,
  DoctorBookingAcceptResponse,
  DoctorHomeSummary,
  DoctorReasonCode,
  DoctorScheduledCareAgenda,
  ProposeBookingTimeRequest,
} from './scheduled-care.models';

@Injectable({ providedIn: 'root' })
export class ScheduledCareApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  getDoctorScheduledCare(from: string, to: string): Observable<DoctorScheduledCareAgenda> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<DoctorScheduledCareAgenda>(
      `${this.config.apiBaseUrl}/doctor/scheduled-care`,
      { params },
    );
  }

  getDoctorHomeSummary(): Observable<DoctorHomeSummary> {
    return this.http.get<DoctorHomeSummary>(
      `${this.config.apiBaseUrl}/doctor/scheduled-care/home-summary`,
    );
  }

  getDoctorBookingRequest(requestId: string): Observable<BookingRequest> {
    return this.http.get<BookingRequest>(
      `${this.config.apiBaseUrl}/doctor/booking-requests/${encodeURIComponent(requestId)}`,
    );
  }

  acceptBookingRequest(
    requestId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Observable<DoctorBookingAcceptResponse> {
    return this.http.post<DoctorBookingAcceptResponse>(
      `${this.config.apiBaseUrl}/doctor/booking-requests/${encodeURIComponent(requestId)}/accept`,
      { expectedVersion },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
  }

  proposeBookingTime(
    requestId: string,
    request: ProposeBookingTimeRequest,
    idempotencyKey: string,
  ): Observable<BookingRequest> {
    return this.http.post<BookingRequest>(
      `${this.config.apiBaseUrl}/doctor/booking-requests/${encodeURIComponent(requestId)}/proposals`,
      request,
      { headers: idempotencyHeaders(idempotencyKey) },
    );
  }

  declineBookingRequest(
    requestId: string,
    expectedVersion: number,
    reasonCode: DoctorReasonCode,
    idempotencyKey: string,
  ): Observable<BookingRequest> {
    return this.http.post<BookingRequest>(
      `${this.config.apiBaseUrl}/doctor/booking-requests/${encodeURIComponent(requestId)}/decline`,
      { expectedVersion, reasonCode },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
  }

  getAppointment(appointmentId: string): Observable<Appointment> {
    return this.http.get<Appointment>(
      `${this.config.apiBaseUrl}/appointments/${encodeURIComponent(appointmentId)}`,
    );
  }

  cancelAppointment(
    appointmentId: string,
    expectedVersion: number,
    reasonCode: DoctorReasonCode,
    idempotencyKey: string,
  ): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${this.config.apiBaseUrl}/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      { expectedVersion, reasonCode },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
  }

  getAvailability(
    doctorId: string,
    practiceLocationId: string,
    from: string,
    to: string,
  ): Observable<AvailabilityResponse> {
    const params = new HttpParams()
      .set('doctorId', doctorId)
      .set('practiceLocationId', practiceLocationId)
      .set('from', from)
      .set('to', to);
    return this.http.get<AvailabilityResponse>(
      `${this.config.apiBaseUrl}/appointments/availability/slots`,
      { params },
    );
  }
}

function idempotencyHeaders(key: string): HttpHeaders {
  return new HttpHeaders({ 'Idempotency-Key': key });
}
