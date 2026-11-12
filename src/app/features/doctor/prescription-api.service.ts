import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import type { PrescriptionContent, PrescriptionResponse } from './prescription.models';

@Injectable({ providedIn: 'root' })
export class PrescriptionApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  read(id: string): Observable<PrescriptionResponse> { return this.http.get<PrescriptionResponse>(this.url(id)); }
  save(id: string, expectedPrescriptionVersion: number, prescription: PrescriptionContent, key: string): Observable<PrescriptionResponse> {
    return this.http.put<PrescriptionResponse>(this.url(id), { expectedPrescriptionVersion, prescription }, { headers: new HttpHeaders({ 'Idempotency-Key': key }) });
  }
  finalize(id: string, expectedPrescriptionVersion: number, expectedClinicalRecordVersion: number, key: string): Observable<PrescriptionResponse> {
    return this.http.post<PrescriptionResponse>(`${this.url(id)}/finalize`, { expectedPrescriptionVersion, expectedClinicalRecordVersion, confirmation: true }, { headers: new HttpHeaders({ 'Idempotency-Key': key }) });
  }
  /** Clears an unsigned draft (DRAFT only). Returns the empty state and the version to send next. */
  discard(id: string, expectedPrescriptionVersion: number, key: string): Observable<PrescriptionResponse> {
    return this.http.delete<PrescriptionResponse>(this.url(id), { params: { expectedPrescriptionVersion }, headers: new HttpHeaders({ 'Idempotency-Key': key }) });
  }
  private url(id: string): string { return `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(id)}/prescription`; }
}
