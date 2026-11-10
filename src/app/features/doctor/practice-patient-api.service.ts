import { HttpErrorResponse, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  CreatePracticePatientAppointmentRequestDto,
  CreatePracticePatientRequestDto,
  DuplicatePracticePhoneDto,
  LinkOmniCareUserRequestDto,
  PageDto,
  PracticePatientAppointmentDto,
  PracticePatientDuplicateCandidateDto,
  PracticePatientDto,
  PracticePatientFilterDto,
  PracticePatientReconciliationDto,
} from './practice-patient-api.models';
import type { AvailabilityResponse } from './scheduled-care/scheduled-care.models';

export interface PracticePatientListOptions {
  readonly query?: string;
  readonly filter?: PracticePatientFilterDto;
  readonly page?: number;
  readonly size?: number;
  /** Bounded picker lookup (server caps at 20); blank query → most recent patients. */
  readonly limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PracticePatientApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/patients`;

  listPatients(options: PracticePatientListOptions = {}): Observable<PageDto<PracticePatientDto>> {
    let params = new HttpParams();
    const query = options.query?.trim();
    if (query) {
      params = params.set('query', query);
    }
    if (options.filter) {
      params = params.set('filter', options.filter);
    }
    if (options.page !== undefined) {
      params = params.set('page', options.page);
    }
    if (options.size !== undefined) {
      params = params.set('size', options.size);
    }
    if (options.limit !== undefined) {
      params = params.set('limit', options.limit);
    }
    return this.http.get<PageDto<PracticePatientDto>>(this.baseUrl, { params });
  }

  getPatient(id: string): Observable<PracticePatientDto> {
    return this.http.get<PracticePatientDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Creates an external patient. The server replays the same patient for a repeated
   * `Idempotency-Key`, so a double submit never creates two records.
   */
  createPatient(
    request: CreatePracticePatientRequestDto,
    idempotencyKey?: string,
  ): Observable<PracticePatientDto> {
    const headers = idempotencyKey
      ? new HttpHeaders({ 'Idempotency-Key': idempotencyKey })
      : undefined;
    return this.http.post<PracticePatientDto>(this.baseUrl, request, { headers });
  }

  findDuplicateCandidates(
    request: CreatePracticePatientRequestDto,
  ): Observable<readonly PracticePatientDuplicateCandidateDto[]> {
    return this.http.post<readonly PracticePatientDuplicateCandidateDto[]>(
      `${this.baseUrl}/duplicate-candidates`,
      request,
    );
  }

  createAppointment(
    patientId: string,
    request: CreatePracticePatientAppointmentRequestDto,
    idempotencyKey: string,
  ): Observable<PracticePatientAppointmentDto> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http.post<PracticePatientAppointmentDto>(
      `${this.baseUrl}/${encodeURIComponent(patientId)}/appointments`,
      request,
      { headers },
    );
  }

  getAppointmentAvailability(
    patientId: string,
    practiceLocationId: string,
    from: string,
    to: string,
  ): Observable<AvailabilityResponse> {
    const params = new HttpParams()
      .set('practiceLocationId', practiceLocationId)
      .set('from', from)
      .set('to', to);
    return this.http.get<AvailabilityResponse>(
      `${this.baseUrl}/${encodeURIComponent(patientId)}/appointments/availability`,
      { params },
    );
  }

  reconcileMrsPatient(
    patientId: string,
    idempotencyKey: string,
  ): Observable<PracticePatientReconciliationDto> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http.post<PracticePatientReconciliationDto>(
      `${this.baseUrl}/${encodeURIComponent(patientId)}/mrs-reconciliation`,
      null,
      { headers },
    );
  }

  duplicateOf(error: unknown): DuplicatePracticePhoneDto | null {
    if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
      return null;
    }
    const body = error.error as Partial<DuplicatePracticePhoneDto> | null;
    if (body && typeof body.existingPatientId === 'string') {
      return { existingPatientId: body.existingPatientId };
    }
    return null;
  }

  linkToOmniCareUser(
    id: string,
    request: LinkOmniCareUserRequestDto,
  ): Observable<PracticePatientDto> {
    return this.http.patch<PracticePatientDto>(`${this.baseUrl}/${id}/link`, request);
  }
}
