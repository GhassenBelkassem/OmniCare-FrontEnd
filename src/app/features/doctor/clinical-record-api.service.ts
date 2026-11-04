import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import type { ClinicalRecordPayload, ClinicalRecordResponse } from './clinical-record.models';

@Injectable({ providedIn: 'root' })
export class ClinicalRecordApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  read(consultationId: string): Observable<ClinicalRecordResponse> {
    return this.http.get<ClinicalRecordResponse>(this.url(consultationId));
  }

  save(
    consultationId: string,
    expectedClinicalRecordVersion: number,
    clinicalRecord: ClinicalRecordPayload,
    idempotencyKey: string,
  ): Observable<ClinicalRecordResponse> {
    return this.http.put<ClinicalRecordResponse>(
      this.url(consultationId),
      { expectedClinicalRecordVersion, clinicalRecord },
      { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
    );
  }

  private url(consultationId: string): string {
    return `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/clinical-record`;
  }
}
