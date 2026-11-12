import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { DashboardRole, isDashboardRole } from '../../core/auth/auth.models';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';

export interface InvitationValidation {
  readonly email: string;
  readonly role: DashboardRole;
  readonly expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class InvitationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(RUNTIME_CONFIG).apiBaseUrl}/auth/invitations`;

  validate(token: string): Observable<InvitationValidation> {
    return this.http.post<unknown>(`${this.baseUrl}/validate`, { token }).pipe(
      map((value) => {
        if (!isInvitationValidation(value)) {
          throw new Error('The server returned an invalid invitation response.');
        }
        return value;
      }),
    );
  }

  accept(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/accept`, { token, newPassword });
  }
}

function isInvitationValidation(value: unknown): value is InvitationValidation {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    typeof record['email'] === 'string' &&
    record['email'].length > 0 &&
    isDashboardRole(record['role']) &&
    typeof record['expiresAt'] === 'string' &&
    !Number.isNaN(Date.parse(record['expiresAt']))
  );
}
