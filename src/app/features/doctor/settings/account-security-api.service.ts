import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  AccountDeviceResponse,
  AccountSecuritySummaryResponse,
  ChangePasswordRequest,
} from './account-security-api.models';

@Injectable({ providedIn: 'root' })
export class AccountSecurityApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(RUNTIME_CONFIG).apiBaseUrl;

  getSummary(): Observable<AccountSecuritySummaryResponse> {
    return this.http.get<AccountSecuritySummaryResponse>(`${this.apiBaseUrl}/me/account-security`);
  }

  getDevices(): Observable<readonly AccountDeviceResponse[]> {
    return this.http.get<readonly AccountDeviceResponse[]>(`${this.apiBaseUrl}/auth/devices`);
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiBaseUrl}/auth/password/change`, request);
  }

  logoutDevice(deviceId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/auth/devices/${encodeURIComponent(deviceId)}/logout`,
      {},
    );
  }
}
