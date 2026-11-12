import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  Appointment,
  AvailabilityResponse,
  BookingRequest,
  DoctorBookingAcceptResponse,
  DoctorHomeSummary,
  DoctorReasonCode,
  DoctorScheduledCareAgenda,
  DoctorScheduledCareItem,
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

  getAppointment(
    appointmentId: string,
    overview: DoctorScheduledCareItem | null = null,
  ): Observable<Appointment> {
    return this.http.get<unknown>(
      `${this.config.apiBaseUrl}/appointments/${encodeURIComponent(appointmentId)}`,
    ).pipe(map((response) => normalizeAppointment(response, appointmentId, overview)));
  }

  cancelAppointment(
    appointmentId: string,
    expectedVersion: number,
    reasonCode: DoctorReasonCode,
    idempotencyKey: string,
    overview: DoctorScheduledCareItem | null = null,
  ): Observable<Appointment> {
    // G-1 P3b: every appointment type is cancelled here; the server answers with the same shape
    // as GET /appointments/{id} (booking-request projection or plain appointment).
    return this.http.post<unknown>(
      `${this.config.apiBaseUrl}/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      { expectedVersion, reasonCode },
      { headers: idempotencyHeaders(idempotencyKey) },
    ).pipe(map((response) => normalizeAppointment(response, appointmentId, overview)));
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

interface LegacyAppointmentResponse {
  readonly id: string;
  readonly doctorId: string;
  readonly patientName: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: Appointment['status'];
  readonly notes: string | null;
  readonly quotedPriceTnd: number | null;
  readonly createdAt: string;
  readonly subjectType?: string;
  readonly practicePatientId?: string | null;
  readonly version?: number;
}

function normalizeAppointment(
  response: unknown,
  appointmentId: string,
  overview: DoctorScheduledCareItem | null,
): Appointment {
  if (isRichAppointment(response)) return response;
  if (!isLegacyAppointment(response) || response.id !== appointmentId) {
    throw new Error('Invalid appointment response');
  }
  const matchingOverview = overview?.appointmentId === appointmentId ? overview : null;
  const durationMinutes = Math.max(
    0,
    Math.round((Date.parse(response.endTime) - Date.parse(response.startTime)) / 60_000),
  );
  return {
    appointmentId: response.id,
    sourceBookingRequestId: matchingOverview?.sourceBookingRequestId ?? null,
    version: typeof response.version === 'number' ? response.version : matchingOverview?.version ?? null,
    status: response.status,
    doctor: {
      doctorId: response.doctorId,
      displayName: matchingOverview?.doctor.displayName ?? 'Médecin',
      specialty: matchingOverview?.doctor.specialty ?? null,
    },
    subject: {
      subjectType: matchingOverview?.subject.subjectType ?? response.subjectType ?? 'SELF',
      familyMemberId: null,
      displayName: matchingOverview?.subject.displayName ?? response.patientName?.trim() ?? 'Patient',
      relationship: matchingOverview?.subject.relationship ?? null,
    },
    cabinet: {
      practiceLocationId: '',
      name: matchingOverview?.cabinet.name ?? 'Cabinet non renseigné',
      address: matchingOverview?.cabinet.address ?? '',
      city: matchingOverview?.cabinet.city ?? '',
      governorate: matchingOverview?.cabinet.governorate ?? '',
      timezone: matchingOverview?.timezone ?? 'Africa/Tunis',
    },
    slot: {
      start: response.startTime,
      end: response.endTime,
      timezone: matchingOverview?.timezone ?? 'Africa/Tunis',
      durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 0,
    },
    quotedPrice: response.quotedPriceTnd === null
      ? null
      : { amount: response.quotedPriceTnd, currency: 'TND', quotedAt: response.createdAt },
    confirmedAt: response.createdAt,
    createdAt: response.createdAt,
    updatedAt: matchingOverview?.updatedAt ?? response.createdAt,
    cancellation: matchingOverview?.cancellation ?? null,
    intakeStatus: matchingOverview?.intakeStatus ?? null,
    // Overview actions only hold while the appointment is still in the status they were computed for.
    availableActions: matchingOverview?.status === response.status ? matchingOverview.availableActions : [],
    practicePatient: response.practicePatientId
      ? {
          practicePatientId: response.practicePatientId,
          dateOfBirth: null,
          sex: null,
          phone: null,
          email: null,
          address: null,
        }
      : null,
    consultationReason: response.notes,
  };
}

function isRichAppointment(value: unknown): value is Appointment {
  if (!isObject(value)) return false;
  return typeof value['appointmentId'] === 'string' &&
    isObject(value['doctor']) && typeof value['doctor']['displayName'] === 'string' &&
    isObject(value['subject']) && typeof value['subject']['displayName'] === 'string' &&
    isObject(value['cabinet']) && typeof value['cabinet']['timezone'] === 'string' &&
    isObject(value['slot']) && typeof value['slot']['start'] === 'string' &&
    Array.isArray(value['availableActions']);
}

function isLegacyAppointment(value: unknown): value is LegacyAppointmentResponse {
  if (!isObject(value)) return false;
  return typeof value['id'] === 'string' &&
    typeof value['doctorId'] === 'string' &&
    typeof value['startTime'] === 'string' &&
    typeof value['endTime'] === 'string' &&
    typeof value['status'] === 'string' &&
    typeof value['createdAt'] === 'string' &&
    (value['patientName'] === null || typeof value['patientName'] === 'string') &&
    (value['notes'] === null || typeof value['notes'] === 'string') &&
    (value['quotedPriceTnd'] === null || typeof value['quotedPriceTnd'] === 'number');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function idempotencyHeaders(key: string): HttpHeaders {
  return new HttpHeaders({ 'Idempotency-Key': key });
}
