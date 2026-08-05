import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  AccountStatus,
  AdminProfessional,
  Clinic,
  ClinicMembership,
  ClinicPage,
  CreateClinicInput,
  CreateDoctorInput,
  ProfessionalPage,
  ProfessionalSession,
} from './admin-api.models';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/admin`;

  listProfessionals(search = '', page = 0): Observable<ProfessionalPage> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ProfessionalPage>(`${this.baseUrl}/professionals`, { params });
  }

  getProfessional(userId: string): Observable<AdminProfessional> {
    return this.http.get<AdminProfessional>(`${this.baseUrl}/professionals/${userId}`);
  }

  createDoctor(input: CreateDoctorInput): Observable<void> {
    return this.http.post<AdminProfessional>(
      `${this.baseUrl}/professionals`,
      { ...input, role: 'DOCTOR', affiliatedClinicId: null, alsoIndependent: true },
      { headers: { 'Idempotency-Key': requestKey() } },
    ).pipe(map(() => undefined));
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

  listClinics(search = '', page = 0): Observable<ClinicPage> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ClinicPage>(`${this.baseUrl}/clinics`, { params });
  }

  getClinic(clinicId: string): Observable<Clinic> {
    return this.http.get<Clinic>(`${this.baseUrl}/clinics/${clinicId}`);
  }

  createClinic(input: CreateClinicInput): Observable<Clinic> {
    return this.http.post<Clinic>(`${this.baseUrl}/clinics`, input, {
      headers: { 'Idempotency-Key': requestKey() },
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
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
