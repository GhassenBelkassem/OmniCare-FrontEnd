import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  RecordConsultationDetail,
  RecordConsultationPage,
  RecordMedicationList,
} from './record/patient-record.models';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import type {
  PatientChartDocumentDto,
  PatientChartDocumentPreviewDto,
  PatientChartDocumentType,
  PatientChartDocumentsDto,
  PatientChartDto,
  PatientChartHistoryDto,
  PatientChartMedicalSummaryDto,
  PatientContactUpdateRequest,
  PatientContactUpdateResponse,
} from './patient-chart-api.models';

@Injectable({ providedIn: 'root' })
export class PatientChartApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  getChart(patientId: string): Observable<PatientChartDto> {
    return this.http.get<PatientChartDto>(this.url(patientId));
  }

  getMedicalSummary(patientId: string): Observable<PatientChartMedicalSummaryDto> {
    return this.http.get<PatientChartMedicalSummaryDto>(this.url(patientId, '/medical-summary'));
  }


  /** Keyset-paginated consultation history (G-1 P2d). */
  getConsultationPage(patientId: string, cursor: string | null, size = 20): Observable<RecordConsultationPage> {
    const params: Record<string, string | number> = { size };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<RecordConsultationPage>(this.url(patientId, '/consultations'), { params });
  }

  /** One consultation's finalized clinical content, fetched when its card is expanded. */
  getConsultationDetail(patientId: string, consultationId: string): Observable<RecordConsultationDetail> {
    return this.http.get<RecordConsultationDetail>(
      this.url(patientId, `/consultations/${encodeURIComponent(consultationId)}`),
    );
  }

  getMedications(patientId: string, state: 'current' | 'past'): Observable<RecordMedicationList> {
    return this.http.get<RecordMedicationList>(this.url(patientId, '/medications'), { params: { state } });
  }


  downloadArtifact(patientId: string, consultationId: string, artifactId: string): Observable<Blob> {
    return this.http.get(
      this.url(
        patientId,
        `/consultations/${encodeURIComponent(consultationId)}/artifacts/${encodeURIComponent(artifactId)}`,
      ),
      { responseType: 'blob' },
    );
  }

  getDocuments(patientId: string): Observable<PatientChartDocumentsDto> {
    return this.http.get<PatientChartDocumentsDto>(this.url(patientId, '/documents'));
  }

  /** Owner of an external patient only (server-decided); 409 PATIENT_CONTACT_VERSION_CONFLICT on a stale version. */
  updateContact(patientId: string, request: PatientContactUpdateRequest, idempotencyKey: string): Observable<PatientContactUpdateResponse> {
    return this.http.patch<PatientContactUpdateResponse>(
      `${this.config.apiBaseUrl}/patients/${encodeURIComponent(patientId)}/contact`,
      request,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  uploadDocument(
    patientId: string,
    file: File,
    metadata: { readonly documentType: PatientChartDocumentType; readonly title: string },
    idempotencyKey: string,
  ): Observable<PatientChartDocumentDto> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('metadata', JSON.stringify(metadata));
    return this.http.post<PatientChartDocumentDto>(this.url(patientId, '/documents'), body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  createPreview(
    patientId: string,
    documentId: string,
    idempotencyKey: string,
  ): Observable<PatientChartDocumentPreviewDto> {
    return this.http.post<PatientChartDocumentPreviewDto>(
      this.url(patientId, `/documents/${encodeURIComponent(documentId)}/preview`),
      null,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  previewPage(
    patientId: string,
    documentId: string,
    preview: PatientChartDocumentPreviewDto,
    page: number,
  ): Observable<Blob> {
    return this.http.get(
      this.url(
        patientId,
        `/documents/${encodeURIComponent(documentId)}/preview/${encodeURIComponent(preview.sessionId)}/pages/${page}`,
      ),
      { responseType: 'blob', headers: new HttpHeaders({ 'X-Preview-Token': preview.token }) },
    );
  }

  getHistory(patientId: string): Observable<PatientChartHistoryDto> {
    return this.http.get<PatientChartHistoryDto>(this.url(patientId, '/history'));
  }

  private url(patientId: string, suffix = ''): string {
    return `${this.config.apiBaseUrl}/patients/${encodeURIComponent(patientId)}/chart${suffix}`;
  }
}

export function newChartIdempotencyKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${random}`;
}
