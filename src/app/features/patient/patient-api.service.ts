import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  AcceptedOfferSummaryDto,
  AppointmentDto,
  AvailableDoctorDto,
  BookingRequestDto,
  ChangePasswordRequestDto,
  DoctorDirectoryDto,
  PatientProfileDto,
  SelectDoctorRequestDto,
  SlotDto,
  UpdateProfileRequestDto,
  UrgentRequestCreateRequestDto,
  UrgentRequestCreateResponseDto,
  UrgentRequestDto,
  UrgentVisitPreferenceDto,
} from './patient-api.models';

@Injectable({ providedIn: 'root' })
export class PatientApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = this.config.apiBaseUrl;

  availableDoctors(
    lat: number,
    lng: number,
    radius: number,
    visitType?: UrgentVisitPreferenceDto,
  ): Observable<readonly AvailableDoctorDto[]> {
    let params = new HttpParams()
      .set('lat', String(lat))
      .set('lng', String(lng))
      .set('radius', String(radius));
    if (visitType) params = params.set('visitType', visitType);
    return this.http.get<readonly AvailableDoctorDto[]>(
      `${this.baseUrl}/urgent-requests/available-doctors`,
      { params },
    );
  }

  doctors(query = '', lat?: number, lng?: number): Observable<readonly DoctorDirectoryDto[]> {
    const trimmed = query.trim();
    let params = trimmed ? new HttpParams().set('q', trimmed) : new HttpParams();
    const hasLocation = lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng);
    if (hasLocation) params = params.set('lat', String(lat)).set('lng', String(lng));
    return this.http.get<readonly DoctorDirectoryDto[]>(`${this.baseUrl}/doctors`, {
      params,
    });
  }

  /** @deprecated The Angular Patient workspace is development-only and direct booking is retired. */
  slots(_doctorId: string, _from: string, _to: string): Observable<readonly SlotDto[]> {
    return throwError(legacyPatientSchedulingRetired);
  }

  /** @deprecated New Patient scheduling is available only through the Flutter P2 request flow. */
  book(_input: BookingRequestDto): Observable<AppointmentDto> {
    return throwError(legacyPatientSchedulingRetired);
  }

  appointments(from: string, to: string): Observable<readonly AppointmentDto[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<readonly AppointmentDto[]>(`${this.baseUrl}/appointments`, { params });
  }

  /**
   * Versioned cancellation (G-1 P3b): the legacy PATCH is retired (410). The patient gives no
   * reason; the server checks ownership, CONFIRMED status, the version and the slot not passed.
   */
  cancelAppointment(id: string, expectedVersion: number, idempotencyKey: string): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(
      `${this.baseUrl}/appointments/${encodeURIComponent(id)}/cancel`,
      { expectedVersion, reasonCode: null },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  createUrgentRequest(
    input: UrgentRequestCreateRequestDto,
  ): Observable<UrgentRequestCreateResponseDto> {
    return this.http.post<UrgentRequestCreateResponseDto>(`${this.baseUrl}/urgent-requests`, input);
  }

  urgentRequest(id: string): Observable<UrgentRequestDto> {
    return this.http.get<UrgentRequestDto>(`${this.baseUrl}/urgent-requests/${id}`);
  }

  urgentOffers(id: string): Observable<readonly AcceptedOfferSummaryDto[]> {
    return this.http.get<readonly AcceptedOfferSummaryDto[]>(
      `${this.baseUrl}/urgent-requests/${id}/offers`,
    );
  }

  selectDoctor(id: string, offerId: string): Observable<UrgentRequestDto> {
    const input: SelectDoctorRequestDto = { offerId };
    return this.http.patch<UrgentRequestDto>(
      `${this.baseUrl}/urgent-requests/${id}/select`,
      input,
    );
  }

  cancelUrgentRequest(id: string): Observable<UrgentRequestDto> {
    return this.http.patch<UrgentRequestDto>(
      `${this.baseUrl}/urgent-requests/${id}/cancel`,
      {},
    );
  }

  profile(): Observable<PatientProfileDto> {
    const params = new HttpParams().set('includeMedical', 'false');
    return this.http.get<PatientProfileDto>(`${this.baseUrl}/profile`, { params });
  }

  updateProfile(input: UpdateProfileRequestDto): Observable<PatientProfileDto> {
    return this.http.patch<PatientProfileDto>(`${this.baseUrl}/profile`, input);
  }

  changePassword(input: ChangePasswordRequestDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/password/change`, input);
  }
}

export const LEGACY_PATIENT_SCHEDULING_RETIRED_MESSAGE =
  'La réservation Patient Angular est retirée. Utilisez le parcours mobile OmniCare.';

function legacyPatientSchedulingRetired(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 410,
    statusText: 'Gone',
    error: {
      code: 'LEGACY_BOOKING_RETIRED',
      message: LEGACY_PATIENT_SCHEDULING_RETIRED_MESSAGE,
    },
  });
}
