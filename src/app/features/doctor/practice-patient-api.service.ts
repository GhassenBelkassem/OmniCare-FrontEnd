import { HttpErrorResponse, HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  CreatePracticePatientRequestDto,
  DuplicatePracticePhoneDto,
  LinkOmniCareUserRequestDto,
  PageDto,
  PracticePatientDto,
  PracticePatientFilterDto,
} from './practice-patient-api.models';

export interface PracticePatientListOptions {
  readonly query?: string;
  readonly filter?: PracticePatientFilterDto;
  readonly page?: number;
  readonly size?: number;
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
    return this.http.get<PageDto<PracticePatientDto>>(this.baseUrl, { params });
  }

  getPatient(id: string): Observable<PracticePatientDto> {
    return this.http.get<PracticePatientDto>(`${this.baseUrl}/${id}`);
  }

  createPatient(request: CreatePracticePatientRequestDto): Observable<PracticePatientDto> {
    return this.http.post<PracticePatientDto>(this.baseUrl, request);
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

  linkToOmniCareUser(id: string, request: LinkOmniCareUserRequestDto): Observable<PracticePatientDto> {
    return this.http.patch<PracticePatientDto>(`${this.baseUrl}/${id}/link`, request);
  }
}
