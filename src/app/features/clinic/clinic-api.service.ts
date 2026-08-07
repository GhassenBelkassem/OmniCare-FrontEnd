import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicBootstrapResponse, MeAccessResponse, MeClinicsResponse } from './clinic-api.models';

@Injectable({ providedIn: 'root' })
export class ClinicApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  getAccess(): Observable<MeAccessResponse> {
    return this.http.get<MeAccessResponse>(`${this.config.apiBaseUrl}/me/access`);
  }

  getClinics(): Observable<MeClinicsResponse> {
    return this.http.get<MeClinicsResponse>(`${this.config.apiBaseUrl}/me/clinics`);
  }

  getBootstrap(clinicId: string): Observable<ClinicBootstrapResponse> {
    const path = `${this.config.apiBaseUrl}/clinics/${encodeURIComponent(clinicId)}/bootstrap`;
    return this.http.get<ClinicBootstrapResponse>(path);
  }
}
