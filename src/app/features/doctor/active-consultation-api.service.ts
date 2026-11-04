import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  ActiveConsultation,
  ConsultationSourceType,
  StartConsultationRequest,
} from './active-consultation.models';
import type {
  CompletedConsultationDetail,
  CompletedConsultationListItem,
} from './completed-consultation.models';

@Injectable({ providedIn: 'root' })
export class ActiveConsultationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  getActive(): Observable<ActiveConsultation | null> {
    return this.http.get<ActiveConsultation | null>(
      `${this.config.apiBaseUrl}/doctor/consultations/active`,
    );
  }

  startScheduled(
    sourceId: string,
    expectedSourceVersion: number,
    idempotencyKey: string,
  ): Observable<ActiveConsultation> {
    return this.startCanonical(
      'SCHEDULED_APPOINTMENT', sourceId, expectedSourceVersion, idempotencyKey,
    );
  }

  startCanonical(
    sourceType: ConsultationSourceType,
    sourceId: string,
    expectedSourceVersion: number,
    idempotencyKey: string,
  ): Observable<ActiveConsultation> {
    const request: StartConsultationRequest = {
      sourceType,
      sourceId,
      expectedSourceVersion,
    };
    return this.http.post<ActiveConsultation>(
      `${this.config.apiBaseUrl}/doctor/consultations/start`,
      request,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  get(consultationId: string): Observable<ActiveConsultation> {
    return this.http.get<ActiveConsultation>(`${this.config.apiBaseUrl}/doctor/consultations/${consultationId}`);
  }

  listCompleted(): Observable<readonly CompletedConsultationListItem[]> {
    return this.http.get<readonly CompletedConsultationListItem[]>(
      `${this.config.apiBaseUrl}/doctor/consultations/completed`,
    );
  }

  getCompleted(consultationId: string): Observable<CompletedConsultationDetail> {
    return this.http.get<CompletedConsultationDetail>(
      `${this.config.apiBaseUrl}/doctor/consultations/completed/${encodeURIComponent(consultationId)}`,
    );
  }

  finish(consultationId: string, expectedConsultationVersion: number,
         expectedClinicalRecordVersion: number, idempotencyKey: string): Observable<ActiveConsultation> {
    return this.http.post<ActiveConsultation>(
      `${this.config.apiBaseUrl}/doctor/consultations/${consultationId}/finish`,
      { expectedConsultationVersion, expectedClinicalRecordVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }
}
