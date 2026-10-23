import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  DoctorStaffDetail,
  DoctorStaffSummary,
  SecretaryInvitationRequest,
  SecretaryInvitationResponse,
  SecretaryPermission,
  SecretaryResendInvitationResponse,
} from './secretary-api.models';

/**
 * Doctor-side management of delegated secretaries, scoped to the signed-in
 * doctor via `/me`. The server derives the actor from the session, so no doctor
 * identifier is ever sent from the client.
 */
@Injectable({ providedIn: 'root' })
export class SecretaryApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/me/secretaries`;

  list(): Observable<readonly DoctorStaffSummary[]> {
    return this.http.get<readonly DoctorStaffSummary[]>(this.baseUrl);
  }

  invite(request: SecretaryInvitationRequest): Observable<SecretaryInvitationResponse> {
    return this.http.post<SecretaryInvitationResponse>(
      `${this.baseUrl}/invitations`,
      request,
    );
  }

  /** Single delegation, including the optional captured name. */
  detail(membershipId: string): Observable<DoctorStaffDetail> {
    return this.http.get<DoctorStaffDetail>(`${this.baseUrl}/${membershipId}`);
  }

  /**
   * Full replacement of the permission set, not a merge. Returns the detail
   * payload so the caller reads the authoritative saved state back rather than
   * patching what it sent.
   */
  replacePermissions(
    membershipId: string,
    permissions: readonly SecretaryPermission[],
  ): Observable<DoctorStaffDetail> {
    return this.http.patch<DoctorStaffDetail>(
      `${this.baseUrl}/${membershipId}/permissions`,
      { permissions },
    );
  }

  resendInvitation(
    membershipId: string,
  ): Observable<SecretaryResendInvitationResponse> {
    return this.http.post<SecretaryResendInvitationResponse>(
      `${this.baseUrl}/${membershipId}/invitation/resend`,
      {},
    );
  }

  suspend(membershipId: string): Observable<DoctorStaffSummary> {
    return this.http.post<DoctorStaffSummary>(
      `${this.baseUrl}/${membershipId}/suspension`,
      {},
    );
  }

  end(membershipId: string): Observable<DoctorStaffSummary> {
    return this.http.post<DoctorStaffSummary>(`${this.baseUrl}/${membershipId}/end`, {});
  }
}