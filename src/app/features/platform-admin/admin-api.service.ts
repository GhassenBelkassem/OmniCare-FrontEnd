import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  AccountStatus,
  AdminProfessional,
  Clinic,
  ClinicMembership,
  ClinicPage,
  CreateClinicInput,
  CreateDoctorInput,
  CreateProfessionalResult,
  PatientPage,
  ProfessionalPage,
  ProfessionalSearchInput,
  ProfessionalSession,
} from './admin-api.models';

/** Backend caps `pageSize` at 100; 20 keeps the directory compact without extra round-trips. */
const DEFAULT_PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/admin`;

  listProfessionals(search = '', page = 0): Observable<ProfessionalPage> {
    let params = new HttpParams().set('page', page).set('pageSize', DEFAULT_PAGE_SIZE);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ProfessionalPage>(`${this.baseUrl}/professionals`, { params });
  }

  /**
   * Canonical directory read. Filtering, sorting and pagination all happen in the
   * database, so the page returned is the page the server chose; there is no client-side
   * filtering to fall back to.
   */
  searchProfessionals(input: ProfessionalSearchInput = {}): Observable<ProfessionalPage> {
    const body: ProfessionalSearchInput = {
      ...(input.search?.trim() ? { search: input.search.trim() } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.page === undefined ? {} : { page: input.page }),
      pageSize: input.pageSize ?? DEFAULT_PAGE_SIZE,
    };
    return this.http.post<ProfessionalPage>(`${this.baseUrl}/professionals/search`, body);
  }

  getProfessional(userId: string): Observable<AdminProfessional> {
    return this.http.get<AdminProfessional>(`${this.baseUrl}/professionals/${userId}`);
  }

  /**
   * `idempotencyKey` is required rather than generated here so a caller can replay a
   * failed submission with the same key: the backend replays the original response
   * instead of creating a second account. Mint a new key only once an attempt has
   * actually succeeded.
   */
  createDoctor(input: CreateDoctorInput, idempotencyKey = requestKey()): Observable<CreateProfessionalResult> {
    return this.http.post<CreateProfessionalResult>(
      `${this.baseUrl}/professionals`,
      {
        ...input,
        role: 'DOCTOR',
        // Fixed, not magic: this screen provisions independent, platform-level
        // professionals. The endpoint creates no clinic_memberships row, so
        // affiliatedClinicId/alsoIndependent describe a standalone practice. Clinic-scoped
        // staff go through POST /admin/clinics/{clinicId}/administrators/invitations and
        // the clinic module's own onboarding. Revisit with a clinic picker.
        affiliatedClinicId: null,
        alsoIndependent: true,
      },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  updateProfessionalStatus(userId: string, status: AccountStatus): Observable<AdminProfessional> {
    return this.http.patch<AdminProfessional>(`${this.baseUrl}/professionals/${userId}/status`, { status });
  }

  resendInvitation(userId: string): Observable<AdminProfessional> {
    return this.http.post<AdminProfessional>(`${this.baseUrl}/professionals/${userId}/resend-invitation`, {});
  }

  listSessions(userId: string): Observable<readonly ProfessionalSession[]> {
    return this.http.get<readonly ProfessionalSession[]>(`${this.baseUrl}/professionals/${userId}/sessions`);
  }

  revokeSession(userId: string, sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/professionals/${userId}/sessions/${sessionId}`);
  }

  /** Signs every device out without touching the account status. */
  revokeAllSessions(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/professionals/${userId}/sessions`);
  }

  /**
   * Read-only patient directory. No sibling method exists for a single patient: the endpoint
   * has no per-user route, so the list is the only surface and there is nothing here to
   * enumerate one patient's data through.
   */
  listPatients(search = '', page = 0): Observable<PatientPage> {
    let params = new HttpParams().set('page', page).set('pageSize', DEFAULT_PAGE_SIZE);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<PatientPage>(`${this.baseUrl}/patients`, { params });
  }

  listClinics(search = '', page = 0): Observable<ClinicPage> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ClinicPage>(`${this.baseUrl}/clinics`, { params });
  }

  getClinic(clinicId: string): Observable<Clinic> {
    return this.http.get<Clinic>(`${this.baseUrl}/clinics/${clinicId}`);
  }

  /**
   * `idempotencyKey` is required rather than generated here so a caller can replay a
   * failed submission with the same key: the backend replays the original response
   * instead of registering a second clinic.
   */
  createClinic(input: CreateClinicInput, idempotencyKey = requestKey()): Observable<Clinic> {
    return this.http.post<Clinic>(`${this.baseUrl}/clinics`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  listMemberships(clinicId: string): Observable<readonly ClinicMembership[]> {
    return this.http.get<readonly ClinicMembership[]>(`${this.baseUrl}/clinics/${clinicId}/memberships`);
  }

  inviteClinicAdmin(clinicId: string, email: string, phone: string | null): Observable<ClinicMembership> {
    return this.http.post<ClinicMembership>(
      `${this.baseUrl}/clinics/${clinicId}/administrators/invitations`,
      { email, phone },
      { headers: { 'Idempotency-Key': requestKey() } },
    );
  }
}

function requestKey(): string {
  return newIdempotencyKey();
}

/** Mints a fresh `Idempotency-Key`. Exported so callers that must replay a failed attempt can share one implementation. */
export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
