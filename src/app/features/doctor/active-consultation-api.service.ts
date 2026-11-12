import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  AccessRequestState,
  ActiveConsultation,
  ConsultationAbortReason,
  ConsultationFollowUpOutcome,
  ConsultationFollowUpSlot,
  ConsultationSourceType,
  StartConsultationRequest,
} from './active-consultation.models';
import type { AvailabilityResponse } from './scheduled-care/scheduled-care.models';
import type {
  CompletedConsultationDetail,
  CompletedConsultationListItem,
  CompletedConsultationPage,
} from './completed-consultation.models';

export interface FinishReadiness {
  readonly ready: boolean;
  readonly clinicalRecordSaved: boolean;
  readonly diagnosisReady: boolean;
  readonly medicationDecisionReady: boolean;
  readonly followUpReady: boolean;
  readonly prescriptionReady: boolean;
  readonly ordersReady: boolean;
  readonly artifactsReady: boolean;
  readonly missing: readonly string[];
}

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

  listCompleted(page = 0, size = 50): Observable<CompletedConsultationPage> {
    return this.http.get<readonly CompletedConsultationListItem[]>(
      `${this.config.apiBaseUrl}/doctor/consultations/completed`,
      { params: { page, size }, observe: 'response' },
    ).pipe(map((response) => this.toCompletedPage(response, page, size)));
  }

  getCompleted(consultationId: string): Observable<CompletedConsultationDetail> {
    return this.http.get<CompletedConsultationDetail>(
      `${this.config.apiBaseUrl}/doctor/consultations/completed/${encodeURIComponent(consultationId)}`,
    );
  }

  /**
   * « Terminer ». `expectedClinicalRecordVersion: null` only resumes an existing closure (page
   * reopened in FINALIZING): the server then uses the versions it captured at the first call.
   */
  finish(consultationId: string, expectedConsultationVersion: number,
         expectedClinicalRecordVersion: number | null, idempotencyKey: string): Observable<ActiveConsultation> {
    return this.http.post<ActiveConsultation>(
      `${this.config.apiBaseUrl}/doctor/consultations/${consultationId}/finish`,
      { expectedConsultationVersion, expectedClinicalRecordVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  /** G-1 D4: the doctor's free slots for the follow-up (OmniCare patients never get slots under 2 h). */
  followUpAvailability(consultationId: string, practiceLocationId: string, from: string, to: string): Observable<AvailabilityResponse> {
    return this.http.get<AvailabilityResponse>(
      `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/follow-up/availability`,
      { params: { practiceLocationId, from, to } },
    );
  }

  /** Stores the chosen follow-up slot on the consultation (not reserved until « Terminer »). */
  saveFollowUpSlot(consultationId: string, slot: { readonly start: string; readonly end: string; readonly practiceLocationId: string }): Observable<ConsultationFollowUpSlot> {
    return this.http.put<ConsultationFollowUpSlot>(
      `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/follow-up-slot`,
      slot,
    );
  }

  clearFollowUpSlot(consultationId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/follow-up-slot`,
    );
  }

  /** After SLOT_TAKEN: books the follow-up on another slot (same rules as « Terminer »). */
  rebookFollowUp(consultationId: string, slot: { readonly start: string; readonly end: string; readonly practiceLocationId: string },
                 idempotencyKey: string): Observable<ConsultationFollowUpOutcome> {
    return this.http.post<ConsultationFollowUpOutcome>(
      `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/follow-up`,
      slot,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  /** G-1 D2: « Demander l'accès » (the patient answers in their app). */
  requestAccess(consultationId: string, idempotencyKey: string): Observable<AccessRequestState> {
    return this.http.post<AccessRequestState>(
      `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/access-requests`,
      null,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  cancelAccessRequest(consultationId: string, requestId: string, expectedVersion: number, idempotencyKey: string): Observable<AccessRequestState> {
    return this.http.post<AccessRequestState>(
      `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/access-requests/${encodeURIComponent(requestId)}/cancel`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  /** « Annuler la consultation »: IN_PROGRESS only, refused once anything is signed. */
  abort(consultationId: string, reason: ConsultationAbortReason, expectedConsultationVersion: number,
        idempotencyKey: string): Observable<ActiveConsultation> {
    return this.http.post<ActiveConsultation>(
      `${this.config.apiBaseUrl}/doctor/consultations/${consultationId}/abort`,
      { reason, expectedConsultationVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  finishReadiness(consultationId: string, expectedClinicalRecordVersion: number): Observable<FinishReadiness> {
    return this.http.get<FinishReadiness>(
      `${this.config.apiBaseUrl}/doctor/consultations/${consultationId}/finish-readiness`,
      { params: { expectedClinicalRecordVersion } },
    );
  }


  private toCompletedPage(
    response: HttpResponse<readonly CompletedConsultationListItem[]>,
    requestedPage: number,
    requestedSize: number,
  ): CompletedConsultationPage {
    const items = response.body ?? [];
    const page = this.headerInteger(response, 'X-Page') ?? requestedPage;
    const pageSize = this.headerInteger(response, 'X-Page-Size') ?? requestedSize;
    const totalCount = this.headerInteger(response, 'X-Total-Count') ?? items.length;
    const totalPages = this.headerInteger(response, 'X-Total-Pages')
      ?? (totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize));
    return {
      items,
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNext: response.headers.get('X-Has-Next') === 'true',
    };
  }

  private headerInteger(
    response: HttpResponse<readonly CompletedConsultationListItem[]>,
    name: string,
  ): number | null {
    const value = response.headers.get(name);
    if (value === null || !/^\d+$/.test(value)) return null;
    return Number.parseInt(value, 10);
  }
}
