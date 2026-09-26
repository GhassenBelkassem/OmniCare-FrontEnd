import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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

  slots(doctorId: string, from: string, to: string): Observable<readonly SlotDto[]> {
    const params = new HttpParams().set('doctorId', doctorId).set('from', from).set('to', to);
    return this.http.get<readonly SlotDto[]>(`${this.baseUrl}/appointments/availability/slots`, {
      params,
    });
  }

  book(input: BookingRequestDto): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(`${this.baseUrl}/appointments`, input);
  }

  appointments(from: string, to: string): Observable<readonly AppointmentDto[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<readonly AppointmentDto[]>(`${this.baseUrl}/appointments`, { params });
  }

  cancelAppointment(id: string): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.baseUrl}/appointments/${id}/cancel`, {});
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
