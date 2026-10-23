import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  ReplaceUrgentCareConfigurationRequest,
  UrgentCareConfigurationResponse,
  UrgentCareReadinessResponse,
} from './urgent-care-configuration-api.models';
import {
  parseUrgentConfigurationJson,
  serializeUrgentConfigurationRequest,
} from './exact-json-decimal';

@Injectable({ providedIn: 'root' })
export class UrgentCareConfigurationApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(RUNTIME_CONFIG).apiBaseUrl}/me/care-capabilities/urgent-configuration`;

  get(): Observable<UrgentCareConfigurationResponse> {
    return this.http
      .get(this.url, { responseType: 'text' })
      .pipe(map(parseUrgentConfigurationJson));
  }

  replace(
    request: ReplaceUrgentCareConfigurationRequest,
  ): Observable<UrgentCareConfigurationResponse> {
    return this.http
      .put(this.url, serializeUrgentConfigurationRequest(request), {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'text',
      })
      .pipe(map(parseUrgentConfigurationJson));
  }

  readiness(): Observable<UrgentCareReadinessResponse> {
    return this.http.get<UrgentCareReadinessResponse>(`${this.url}/readiness`);
  }
}
