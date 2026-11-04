import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import type { ClinicalOrder, ClinicalOrderCategory, ClinicalOrderDefinition, ClinicalOrderListResponse } from './clinical-order.models';

@Injectable({ providedIn: 'root' })
export class ClinicalOrderApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  list(consultationId: string): Observable<ClinicalOrderListResponse> {
    return this.http.get<ClinicalOrderListResponse>(this.base(consultationId));
  }
  create(consultationId: string, category: ClinicalOrderCategory, definition: ClinicalOrderDefinition, key: string): Observable<ClinicalOrder> {
    return this.http.post<ClinicalOrder>(this.base(consultationId), { category, definition }, { headers: this.headers(key) });
  }
  update(consultationId: string, order: ClinicalOrder, definition: ClinicalOrderDefinition, key: string): Observable<ClinicalOrder> {
    return this.http.put<ClinicalOrder>(`${this.base(consultationId)}/${order.clinicalOrderId}`,
      { expectedClinicalOrderVersion: order.clinicalOrderVersion, category: order.category, definition }, { headers: this.headers(key) });
  }
  finalize(consultationId: string, order: ClinicalOrder, key: string): Observable<ClinicalOrder> {
    return this.http.post<ClinicalOrder>(`${this.base(consultationId)}/${order.clinicalOrderId}/finalize`,
      { expectedClinicalOrderVersion: order.clinicalOrderVersion, category: order.category, definition: order.definition }, { headers: this.headers(key) });
  }
  private base(id: string): string { return `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(id)}/clinical-orders`; }
  private headers(key: string): HttpHeaders { return new HttpHeaders({ 'Idempotency-Key': key }); }
}
